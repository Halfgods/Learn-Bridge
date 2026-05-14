from flask import Flask, jsonify, request, make_response, Response
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
import os
import re
import datetime
from functools import wraps
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import difflib
import requests as req_lib
# Load environment variables from this file's directory (works regardless of cwd)
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
app = Flask(__name__)


def _cors_allowed_origins() -> list[str]:
    """Origins allowed to call this API (browser Origin header, incl. port)."""
    default = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:3000,http://127.0.0.1:3000"
    )
    raw = os.environ.get("CORS_ORIGINS", default)
    return [o.strip() for o in raw.split(",") if o.strip()]


# Match all paths so every route gets CORS headers; explicit origins so e.g.
# http://localhost:8081 → http://127.0.0.1:5000 works (different host/port).
CORS(
    app,
    resources={
        r".*": {
            "origins": _cors_allowed_origins(),
            "allow_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        }
    },
)
# Configuration
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or os.environ.get(
    "JWT_SECRET", "dev-secret-key-change-in-prod"
)
MONGO_URI = os.environ.get("MONGO_URI") or "mongodb://localhost:27017/aitutor"
# Database Connection
try:
    client = MongoClient(MONGO_URI)
    try:
        db = client.get_database()
    except ConfigurationError:
        db = client[os.environ.get("MONGO_DB_NAME", "aitutor")]
    print(f"✅ Connected to MongoDB: {db.name}")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
# Collections
users_collection = db['users']
curriculum_collection = db['curriculums']
pdfs_collection = db['ncertpdfs']
quizzes_collection = db['quizzes']
# ==========================================
# AUTH ROUTES
# ==========================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]
                
        if not token:
            return jsonify({'error': 'Token is missing!'}), 401
            
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_collection.find_one({'email': data['email']}, {'_id': 0, 'password': 0})
            if not current_user:
                raise Exception("User not found")
        except Exception as e:
            return jsonify({'error': 'Token is invalid!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({"error": "Missing required fields"}), 400
        
    if users_collection.find_one({'email': data['email']}):
        return jsonify({"error": "User already exists"}), 400
        
    hashed_password = generate_password_hash(data['password'])
    
    new_user = {
        'name': data['name'],
        'email': data['email'],
        'password': hashed_password,
        'grade': data.get('grade'),
        'board': data.get('board'),
        'createdAt': datetime.datetime.utcnow()
    }
    
    users_collection.insert_one(new_user)
    
    token = jwt.encode({
        'email': new_user['email'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({"message": "Registered successfully", "token": token}), 201
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Missing email or password"}), 400
        
    user = users_collection.find_one({'email': data['email']})
    
    if not user or not check_password_hash(user['password'], data['password']):
        return jsonify({"error": "Invalid email or password"}), 401
        
    token = jwt.encode({
        'email': user['email'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({"message": "Logged in successfully", "token": token}), 200
@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_user_profile(current_user):
    return jsonify({"user": current_user}), 200
# ==========================================
# CURRICULUM ROUTES
# ==========================================
@app.route('/api/curriculum/classes', methods=['GET'])
def get_classes():
    try:
        classes = curriculum_collection.distinct('std')
        classes.sort()
        return jsonify({"classes": classes}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/curriculum/class/<int:std>/subjects', methods=['GET'])
def get_subjects(std):
    try:
        subjects = curriculum_collection.distinct('subjectName', {'std': std})
        return jsonify({"subjects": subjects}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/curriculum/class/<int:std>/subject/<subject_name>/chapters', methods=['GET'])
def get_chapters(std, subject_name):
    try:
        curriculum = curriculum_collection.find_one({'std': std, 'subjectName': subject_name}, {'_id': 0, 'chapters': 1})
        if not curriculum:
            return jsonify({"error": "Curriculum not found"}), 404
            
        chapters = curriculum.get('chapters', [])
        # Subdocuments in Mongoose arrays have ObjectIds which are not JSON serializable by default
        for ch in chapters:
            if '_id' in ch:
                ch['_id'] = str(ch['_id'])
                
        return jsonify({"chapters": chapters}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# ==========================================
# CONTENT ROUTES
# ==========================================

def _fuzzy_find_pdf(std: int, subject_name: str, chapter_name: str):
    """
    Find the best-matching PDF document using a two-pass approach:
    1. Exact match (fast)
    2. Case-insensitive regex match
    3. Fuzzy token-overlap scoring across all docs for that std+subject
    Returns the MongoDB doc or None.
    """
    # Pass 1: exact
    doc = pdfs_collection.find_one(
        {'std': std, 'subjectName': subject_name, 'chapterName': chapter_name},
        {'_id': 0, 'ncertUrl': 1, 'chapterName': 1}
    )
    if doc:
        return doc

    # Pass 2: case-insensitive exact
    doc = pdfs_collection.find_one(
        {
            'std': std,
            'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
            'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
        },
        {'_id': 0, 'ncertUrl': 1, 'chapterName': 1}
    )
    if doc:
        return doc

    # Pass 3: fuzzy — score every chapter in this std+subject and pick best
    candidates = list(pdfs_collection.find(
        {
            'std': std,
            'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
        },
        {'_id': 0, 'ncertUrl': 1, 'chapterName': 1}
    ))
    if not candidates:
        # Try without subject filter (broad search)
        candidates = list(pdfs_collection.find(
            {'std': std},
            {'_id': 0, 'ncertUrl': 1, 'chapterName': 1}
        ))

    if not candidates:
        return None

    query_norm = chapter_name.lower().strip()

    def score(db_name: str) -> float:
        db_norm = db_name.lower().strip()
        # SequenceMatcher ratio (char-level)
        seq_ratio = difflib.SequenceMatcher(None, query_norm, db_norm).ratio()
        # Token overlap (word-level Jaccard)
        q_words = set(re.findall(r'\w+', query_norm))
        d_words = set(re.findall(r'\w+', db_norm))
        if not q_words or not d_words:
            token_score = 0.0
        else:
            intersection = q_words & d_words
            union = q_words | d_words
            token_score = len(intersection) / len(union)
        return 0.45 * seq_ratio + 0.55 * token_score

    best = max(candidates, key=lambda d: score(d.get('chapterName', '')))
    best_score = score(best.get('chapterName', ''))

    # Require a minimum match quality of 35% to avoid wild mismatches
    if best_score < 0.35:
        return None

    return best


@app.route('/api/content/pdf', methods=['GET'])
def get_chapter_pdf():
    std = request.args.get('std', type=int)
    subject_name = request.args.get('subjectName')
    chapter_name = request.args.get('chapterName')
    if not all([std, subject_name, chapter_name]):
        return jsonify({"error": "Missing required parameters: std, subjectName, chapterName"}), 400
    subject_name = subject_name.strip()
    chapter_name = " ".join(chapter_name.split())
    try:
        pdf_doc = _fuzzy_find_pdf(std, subject_name, chapter_name)
        if not pdf_doc:
            return jsonify({"error": "PDF not found"}), 404
        return jsonify({
            "ncertUrl": pdf_doc.get('ncertUrl'),
            "matchedChapter": pdf_doc.get('chapterName'),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/content/pdf/proxy', methods=['GET'])
def proxy_pdf():
    """
    Fetch the NCERT PDF server-side and stream it back to the browser.
    This bypasses the X-Frame-Options / CORS restrictions that NCERT sets
    on direct browser requests.

    Query params: same as /api/content/pdf  (std, subjectName, chapterName)
    Optional: ?url=<direct ncertUrl> to skip DB lookup
    """
    direct_url = request.args.get('url')

    if direct_url:
        ncert_url = direct_url
    else:
        std = request.args.get('std', type=int)
        subject_name = request.args.get('subjectName')
        chapter_name = request.args.get('chapterName')
        if not all([std, subject_name, chapter_name]):
            return jsonify({"error": "Missing required parameters"}), 400
        subject_name = subject_name.strip()
        chapter_name = " ".join(chapter_name.split())
        pdf_doc = _fuzzy_find_pdf(std, subject_name, chapter_name)
        if not pdf_doc:
            return jsonify({"error": "PDF not found"}), 404
        ncert_url = pdf_doc.get('ncertUrl')

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Referer': 'https://ncert.nic.in/',
        }
        upstream = req_lib.get(ncert_url, headers=headers, timeout=30, stream=True)
        upstream.raise_for_status()

        def generate():
            for chunk in upstream.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk

        response = Response(
            generate(),
            status=upstream.status_code,
            content_type='application/pdf',
        )
        response.headers['Content-Disposition'] = 'inline'
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
    except req_lib.RequestException as e:
        return jsonify({"error": f"Failed to fetch PDF: {e}"}), 502
@app.route('/api/content/related', methods=['GET'])
def get_related_concepts():
    std = request.args.get('std', type=int)
    subject_name = request.args.get('subjectName')
    chapter_name = request.args.get('chapterName')
    return jsonify({"message": f"Related concepts for chapter {chapter_name}"}), 501
# ==========================================
# ASSESSMENT ROUTES
# ==========================================
@app.route('/api/assessment/random', methods=['GET'])
def get_random_assessment():
    try:
        # Fetch up to 10 random quizzes using MongoDB aggregation
        pipeline = [{"$sample": {"size": 10}}]
        random_quizzes = list(quizzes_collection.aggregate(pipeline))
        
        assessment_questions = []
        for quiz in random_quizzes:
            if quiz.get("questions") and len(quiz["questions"]) > 0:
                # Pick the first question from the quiz
                question = quiz["questions"][0]
                assessment_questions.append({
                    "q": question.get("q"),
                    "options": question.get("options", []),
                    "correct": question.get("ans", 0),
                    "subject": quiz.get("subjectName", "General")
                })
        
        if not assessment_questions:
            return jsonify({"error": "No questions found"}), 404
            
        return jsonify({"questions": assessment_questions}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
if __name__ == '__main__':
    # Run the application
    app.run(host='0.0.0.0', port=5000, debug=True)