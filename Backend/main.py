from flask import Flask, jsonify, request, make_response, Response, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
import os
import re
import datetime
import traceback
from functools import wraps
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import difflib
import requests as req_lib
from requests.adapters import HTTPAdapter
from requests.exceptions import ConnectionError, Timeout
from urllib3.util.retry import Retry
import urllib3
import uuid

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
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
# Global 500 error handler — ensures JSON even for unhandled exceptions
@app.errorhandler(500)
def internal_error(e):
    tb = traceback.format_exc()
    print("!!! 500 ERROR:", tb)
    return jsonify({"error": f"Internal server error", "detail": str(e)}), 500

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
teacher_quizzes_collection = db["teacher_quizzes"]
quiz_attempts_collection = db["quiz_attempts"]
chapter_attempts_collection = db["chapter_attempts"]
concept_graphs_collection = db["concept_graphs"]
chapter_pdfs_collection = db["chapter_pdfs"]
chapter_teacher_quizzes_collection = db["chapter_teacher_quizzes"]

TEACHER_ACCESS_CODE = (os.environ.get("TEACHER_ACCESS_CODE") or "NOVA-TEACHER").strip()


def _norm_board(val) -> str:
    return (val or "").strip()


def _optional_user_from_bearer():
    parts = (request.headers.get("Authorization") or "").split()
    if len(parts) != 2 or parts[0] != "Bearer":
        return None
    try:
        data = jwt.decode(parts[1], app.config["SECRET_KEY"], algorithms=["HS256"])
        return users_collection.find_one({"email": data["email"]}, {"_id": 0, "password": 0})
    except Exception:
        return None


def _serialize_user(user: dict | None) -> dict | None:
    if not user:
        return user
    out = {k: v for k, v in user.items() if k != "password"}
    if isinstance(out.get("createdAt"), datetime.datetime):
        out["createdAt"] = out["createdAt"].replace(tzinfo=datetime.timezone.utc).isoformat()
    if "role" not in out:
        out["role"] = "student"
    return out


def _iso_dt(val):
    if isinstance(val, datetime.datetime):
        return val.replace(tzinfo=datetime.timezone.utc).isoformat()
    return val
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
    role = (data.get("role") or "student").strip().lower()
    if role not in ("student", "teacher"):
        role = "student"
    if role == "student" and (data.get("grade") is None or not data.get("board")):
        return jsonify({"error": "Class and board are required for students"}), 400

    new_user = {
        "name": data["name"],
        "email": data["email"],
        "password": hashed_password,
        "role": role,
        "grade": data.get("grade"),
        "board": data.get("board"),
        "createdAt": datetime.datetime.utcnow(),
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

    expected = (data.get("expectedRole") or "").strip().lower()
    if expected in ("student", "teacher"):
        actual = user.get("role") or "student"
        if actual != expected:
            return jsonify(
                {
                    "error": f"This account is registered as a {actual}. Switch to {actual.capitalize()} above and try again."
                }
            ), 400
        
    token = jwt.encode({
        'email': user['email'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({"message": "Logged in successfully", "token": token}), 200
@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_user_profile(current_user):
    return jsonify({"user": _serialize_user(current_user)}), 200


@app.route("/api/auth/become-teacher", methods=["POST"])
@token_required
def become_teacher(current_user):
    """Students may upgrade to teacher with the school access code (env TEACHER_ACCESS_CODE)."""
    if current_user.get("role") == "teacher":
        return jsonify({"error": "Already a teacher"}), 400
    body = request.get_json() or {}
    code = (body.get("code") or "").strip()
    if not TEACHER_ACCESS_CODE or code != TEACHER_ACCESS_CODE:
        return jsonify({"error": "Invalid teacher access code"}), 403
    users_collection.update_one({"email": current_user["email"]}, {"$set": {"role": "teacher"}})
    user = users_collection.find_one({"email": current_user["email"]}, {"_id": 0, "password": 0})
    return jsonify({"user": _serialize_user(user)}), 200


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
@app.route('/api/curriculum/class/<int:std>/all-chapters', methods=['GET'])
def get_all_chapters(std):
    try:
        docs = list(curriculum_collection.find({'std': std}, {'_id': 0, 'subjectName': 1, 'chapters.chapterName': 1}))
        chapters = []
        for doc in docs:
            subject = doc.get('subjectName', '')
            for ch in (doc.get('chapters') or []):
                chapters.append({
                    'subjectName': subject,
                    'chapterName': ch.get('chapterName', ''),
                })
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
        {'_id': 0, 'ncertUrl': 1, 'chapterName': 1, 'updatedBy': 1}
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
        {'_id': 0, 'ncertUrl': 1, 'chapterName': 1, 'updatedBy': 1}
    )
    if doc:
        return doc

    # Pass 3: fuzzy — score every chapter in this std+subject and pick best
    candidates = list(pdfs_collection.find(
        {
            'std': std,
            'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
        },
        {'_id': 0, 'ncertUrl': 1, 'chapterName': 1, 'updatedBy': 1}
    ))
    if not candidates:
        # Try without subject filter (broad search)
        candidates = list(pdfs_collection.find(
            {'std': std},
            {'_id': 0, 'ncertUrl': 1, 'chapterName': 1, 'updatedBy': 1}
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
            "updatedBy": pdf_doc.get('updatedBy'),
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

    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://ncert.nic.in/',
        'Accept': 'application/pdf,image/webp,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
    }

    session = req_lib.Session()
    retries = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods={'GET'},
    )
    session.mount('https://', HTTPAdapter(max_retries=retries))

    for attempt in range(3):
        try:
            upstream = session.get(
                ncert_url,
                headers=headers,
                timeout=30,
                stream=True,
                verify=False,
            )
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
        except (ConnectionError, Timeout):
            if attempt < 2:
                continue
            return jsonify({"error": f"Failed to fetch PDF: NCERT server unreachable. Please try again later."}), 502
        except req_lib.RequestException as e:
            return jsonify({"error": f"Failed to fetch PDF: {e}"}), 502


@app.route('/api/content/pdf/confirm', methods=['POST'])
def confirm_chapter_pdf():
    """
    Save a confirmed PDF URL for a specific chapter.
    Only writes to MongoDB if no confirmed entry exists yet (idempotent).
    Body: { std, subjectName, chapterName, ncertUrl }
    """
    body = request.get_json(force=True) or {}
    std = body.get('std')
    subject_name = (body.get('subjectName') or '').strip()
    chapter_name = ' '.join((body.get('chapterName') or '').split())
    ncert_url = (body.get('ncertUrl') or '').strip()

    if not all([std, subject_name, chapter_name, ncert_url]):
        return jsonify({"error": "Missing fields: std, subjectName, chapterName, ncertUrl"}), 400

    try:
        # Upsert — only insert if no confirmed doc exists for this chapter yet
        result = pdfs_collection.update_one(
            {
                'std': std,
                'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
                'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
            },
            {
                '$setOnInsert': {
                    'std': std,
                    'subjectName': subject_name,
                    'chapterName': chapter_name,
                    'ncertUrl': ncert_url,
                    'confirmedByUser': True,
                }
            },
            upsert=True,
        )
        action = 'inserted' if result.upserted_id else 'already_exists'
        return jsonify({"status": action}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/content/pdf/update', methods=['PUT'])
@token_required
def teacher_update_pdf(current_user):
    """
    Teacher-only: overwrite the NCERT PDF URL for a chapter.
    Records who updated it. Permanent change in DB.
    Body: { std, subjectName, chapterName, ncertUrl }
    """
    if current_user.get('role') != 'teacher':
        return jsonify({"error": "Only teachers can update PDF links"}), 403

    body = request.get_json(force=True) or {}
    std = body.get('std')
    subject_name = (body.get('subjectName') or '').strip()
    chapter_name = ' '.join((body.get('chapterName') or '').split())
    ncert_url = (body.get('ncertUrl') or '').strip()

    if not all([std, subject_name, chapter_name, ncert_url]):
        return jsonify({"error": "Missing fields: std, subjectName, chapterName, ncertUrl"}), 400

    try:
        teacher_name = current_user.get('name') or current_user.get('email')
        result = pdfs_collection.update_one(
            {
                'std': std,
                'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
                'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
            },
            {
                '$set': {
                    'std': std,
                    'subjectName': subject_name,
                    'chapterName': chapter_name,
                    'ncertUrl': ncert_url,
                    'updatedBy': teacher_name,
                    'updatedAt': datetime.datetime.utcnow().isoformat(),
                }
            },
            upsert=True,
        )
        action = 'updated' if result.modified_count or result.upserted_id else 'no_change'
        return jsonify({"status": action, "updatedBy": teacher_name}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/content/pdf/subject', methods=['GET'])
def get_subject_pdf():
    """
    Return the whole-book proxy URL for a subject.
    Prefers the explicit 'Full Textbook' sentinel seeded by seed.js.
    Falls back to deriving chapter-01 URL from any existing chapter URL.
    """
    std = request.args.get('std', type=int)
    subject_name = (request.args.get('subjectName') or '').strip()
    if not std or not subject_name:
        return jsonify({"error": "Missing std or subjectName"}), 400

    try:
        subject_filter = re.compile(f'^{re.escape(subject_name)}$', re.I)

        # Pass 1: explicit Full Textbook sentinel (seeded by seed.js)
        full_doc = pdfs_collection.find_one(
            {'std': std, 'subjectName': subject_filter, 'isFullBook': True},
            {'_id': 0, 'ncertUrl': 1}
        )
        if full_doc:
            ncert_url = full_doc['ncertUrl']
        else:
            # Pass 2: derive from any existing chapter URL
            sample = pdfs_collection.find_one(
                {'std': std, 'subjectName': subject_filter},
                {'_id': 0, 'ncertUrl': 1}
            )
            if not sample:
                return jsonify({"error": "No PDFs found for this subject"}), 404
            # Replace last 2 digit chapter suffix with 01
            ncert_url = re.sub(r'(\d{2})\.pdf$', '01.pdf', sample['ncertUrl'])

        proxy_url = f"/api/content/pdf/proxy?url={req_lib.utils.requote_uri(ncert_url)}"
        return jsonify({"ncertUrl": ncert_url, "proxyUrl": proxy_url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/content/related', methods=['GET'])
def get_related_concepts():
    std = request.args.get('std', type=int)
    subject_name = request.args.get('subjectName')
    chapter_name = request.args.get('chapterName')
    if not all([std, subject_name, chapter_name]):
        return jsonify({"error": "Missing params"}), 400
    try:
        # Check if teacher has saved a custom graph
        saved = concept_graphs_collection.find_one(
            {
                'std': std,
                'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
                'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
            },
            {'_id': 0, 'nodes': 1, 'edges': 1, 'updatedBy': 1}
        )
        if saved:
            return jsonify({
                "concepts": saved.get('nodes', []),
                "edges": saved.get('edges', []),
                "updatedBy": saved.get('updatedBy'),
            }), 200

        # Fallback: generate nodes from sibling chapters
        subject_filter = re.compile(f'^{re.escape(subject_name)}$', re.I)
        curriculum = curriculum_collection.find_one(
            {'std': std, 'subjectName': subject_filter},
            {'_id': 0, 'chapters.chapterName': 1}
        )
        if not curriculum:
            return jsonify({"concepts": []}), 200
        all_chapters = [ch.get('chapterName', '') for ch in (curriculum.get('chapters') or []) if ch.get('chapterName')]
        center_norm = chapter_name.lower().strip()
        related = [c for c in all_chapters if c.lower().strip() != center_norm]
        import random
        random.shuffle(related)
        related = related[:6]
        nodes = []
        cx, cy = 50, 50
        gradients = [
            "gradient-cyan text-white",
            "gradient-yellow text-amber-900",
            "gradient-peach text-orange-900",
            "gradient-mint text-emerald-900",
            "gradient-primary text-white",
            "gradient-cyan text-white",
        ]
        import math
        for i, name in enumerate(related):
            angle = (2 * math.pi * i) / len(related) - math.pi / 2
            r = 32
            x = round(cx + r * math.cos(angle), 1)
            y = round(cy + r * math.sin(angle), 1)
            nodes.append({
                "id": f"ch-{i}",
                "name": name,
                "x": x,
                "y": y,
                "color": gradients[i % len(gradients)],
            })
        return jsonify({"concepts": nodes, "edges": []}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/content/related', methods=['PUT'])
@token_required
def save_related_concepts(current_user):
    """Teacher-only: save the concept graph nodes, edges for a chapter."""
    if current_user.get('role') != 'teacher':
        return jsonify({"error": "Only teachers can update concept graphs"}), 403

    body = request.get_json(force=True) or {}
    std = body.get('std')
    subject_name = (body.get('subjectName') or '').strip()
    chapter_name = ' '.join((body.get('chapterName') or '').split())
    nodes = body.get('nodes', [])
    edges = body.get('edges', [])

    if not all([std, subject_name, chapter_name]):
        return jsonify({"error": "Missing fields: std, subjectName, chapterName"}), 400

    try:
        teacher_name = current_user.get('name') or current_user.get('email')
        concept_graphs_collection.update_one(
            {
                'std': std,
                'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
                'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
            },
            {
                '$set': {
                    'std': std,
                    'subjectName': subject_name,
                    'chapterName': chapter_name,
                    'nodes': nodes,
                    'edges': edges,
                    'updatedBy': teacher_name,
                    'updatedAt': datetime.datetime.utcnow().isoformat(),
                }
            },
            upsert=True,
        )
        return jsonify({"status": "saved", "updatedBy": teacher_name}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# CHAPTER PDFs (teacher-uploaded PDF links)
# ==========================================

@app.route('/api/content/chapter-pdfs', methods=['GET'])
def get_chapter_pdfs():
    std = request.args.get('std', type=int)
    subject_name = request.args.get('subjectName')
    chapter_name = request.args.get('chapterName')
    if not all([std, subject_name, chapter_name]):
        return jsonify({"error": "Missing params"}), 400
    try:
        docs = list(chapter_pdfs_collection.find(
            {
                'std': std,
                'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
                'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
            },
            {'_id': 0}
        ).sort('createdAt', -1))
        return jsonify({"pdfs": docs}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'pdfs')
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.route('/api/uploads/pdfs/<filename>')
def serve_chapter_pdf(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route('/api/content/chapter-pdfs', methods=['POST'])
@token_required
def add_chapter_pdf(current_user):
    if current_user.get('role') != 'teacher':
        return jsonify({"error": "Only teachers can upload PDFs"}), 403
    try:
        body = request.get_json(force=True) or {}
    except Exception:
        return jsonify({"error": "Invalid JSON body"}), 400
    std = body.get('std')
    subject_name = (body.get('subjectName') or '').strip()
    chapter_name = ' '.join((body.get('chapterName') or '').split())
    file_b64 = (body.get('file') or '').strip()
    label = (body.get('label') or '').strip() or 'Untitled PDF'
    if std is None or not subject_name or not chapter_name or not file_b64:
        return jsonify({"error": "Missing fields: std, subjectName, chapterName, file (base64)"}), 400
    try:
        import base64
        raw = base64.b64decode(file_b64)
        ext = '.pdf'
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)
        with open(file_path, 'wb') as f:
            f.write(raw)
        teacher_name = current_user.get('name') or current_user.get('email')
        pdf_url = f"/api/uploads/pdfs/{unique_name}"
        doc = {
            'std': std,
            'subjectName': subject_name,
            'chapterName': chapter_name,
            'pdfUrl': pdf_url,
            'filename': unique_name,
            'label': label,
            'uploadedBy': teacher_name,
            'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        chapter_pdfs_collection.insert_one(doc)
        return jsonify({"status": "added", "pdf": doc}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/content/chapter-pdfs', methods=['DELETE'])
@token_required
def delete_chapter_pdf(current_user):
    if current_user.get('role') != 'teacher':
        return jsonify({"error": "Only teachers can delete PDFs"}), 403
    body = request.get_json(force=True) or {}
    pdf_url = (body.get('pdfUrl') or '').strip()
    std = body.get('std')
    subject_name = (body.get('subjectName') or '').strip()
    chapter_name = ' '.join((body.get('chapterName') or '').split())
    if not all([std, subject_name, chapter_name, pdf_url]):
        return jsonify({"error": "Missing fields"}), 400
    try:
        doc = chapter_pdfs_collection.find_one({
            'std': std,
            'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
            'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
            'pdfUrl': pdf_url,
        })
        if doc and doc.get('filename'):
            file_path = os.path.join(UPLOAD_DIR, doc['filename'])
            if os.path.exists(file_path):
                os.remove(file_path)
        chapter_pdfs_collection.delete_one({
            'std': std,
            'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
            'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
            'pdfUrl': pdf_url,
        })
        return jsonify({"status": "deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# LEADERBOARD (teachers)
# ==========================================
@app.route("/api/leaderboard", methods=["GET"])
@token_required
def get_leaderboard(current_user):
    if current_user.get("role") != "teacher":
        return jsonify({"error": "Teachers only"}), 403
    pipeline = [
        {"$group": {
            "_id": "$studentEmail",
            "studentName": {"$first": "$studentName"},
            "xp": {"$sum": "$score"},
            "quizzesDone": {"$sum": 1},
        }},
        {"$sort": {"xp": -1}},
        {"$limit": 100},
    ]
    raw = list(quiz_attempts_collection.aggregate(pipeline))
    rows = []
    for i, r in enumerate(raw):
        rows.append({
            "rank": i + 1,
            "name": r.get("studentName") or r["_id"],
            "xp": r.get("xp", 0),
            "lessons": r.get("quizzesDone", 0),
        })
    return jsonify({"rows": rows}), 200


@app.route("/api/student/achievements", methods=["GET"])
@token_required
def student_achievements(current_user):
    if current_user.get("role") != "student":
        return jsonify({"error": "Students only"}), 403
    attempts = list(quiz_attempts_collection.find(
        {"studentEmail": current_user["email"]},
        {"_id": 0},
    ).sort("submittedAt", -1))
    total = len(attempts)
    if total == 0:
        return jsonify({
            "totalQuizzes": 0,
            "averageScore": 0,
            "bestScore": 0,
            "totalScore": 0,
            "maxScore": 0,
            "subjects": [],
            "recent": [],
        }), 200
    best = max(attempts, key=lambda a: (a.get("score") or 0) / max(a.get("total") or 1, 1))
    subjects = set()
    for att in attempts:
        qid = att.get("quizId")
        if qid:
            quiz = teacher_quizzes_collection.find_one({"quizId": qid}, {"_id": 0, "subject": 1})
            if quiz and quiz.get("subject"):
                subjects.add(quiz["subject"])
    recent = []
    for att in attempts[:5]:
        qid = att.get("quizId")
        title = ""
        if qid:
            quiz = teacher_quizzes_collection.find_one({"quizId": qid}, {"_id": 0, "title": 1})
            if quiz:
                title = quiz.get("title") or ""
        recent.append({
            "quizId": qid,
            "title": title,
            "score": att.get("score"),
            "total": att.get("total"),
            "submittedAt": _iso_dt(att.get("submittedAt")),
        })
    total_score = sum(a.get("score") or 0 for a in attempts)
    max_possible = sum(a.get("total") or 0 for a in attempts)
    return jsonify({
        "totalQuizzes": total,
        "averageScore": round(total_score / max_possible * 100, 1) if max_possible else 0,
        "bestScore": best.get("score"),
        "bestTotal": best.get("total"),
        "totalScore": total_score,
        "maxScore": max_possible,
        "subjects": sorted(subjects),
        "recent": recent,
    }), 200


def _parse_deadline_iso(raw):
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip().replace("Z", "+00:00")
    try:
        dt = datetime.datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        return None


@app.route("/api/teacher/quizzes", methods=["GET"])
@token_required
def list_my_teacher_quizzes(current_user):
    if current_user.get("role") != "teacher":
        return jsonify({"error": "Teachers only"}), 403
    out = []
    for doc in teacher_quizzes_collection.find(
        {"teacherEmail": current_user["email"]},
        {
            "_id": 0,
            "quizId": 1,
            "title": 1,
            "subject": 1,
            "deadline": 1,
            "createdAt": 1,
            "questionCount": 1,
            "targetGrade": 1,
            "targetBoard": 1,
        },
    ).sort("createdAt", -1).limit(200):
        item = {
            "quizId": doc.get("quizId"),
            "title": doc.get("title"),
            "subject": doc.get("subject"),
            "deadline": _iso_dt(doc.get("deadline")),
            "createdAt": _iso_dt(doc.get("createdAt")),
            "questionCount": int(doc.get("questionCount") or 0),
            "targetGrade": doc.get("targetGrade"),
            "targetBoard": doc.get("targetBoard"),
        }
        out.append(item)
    return jsonify({"quizzes": out}), 200


@app.route("/api/teacher/quizzes/<quiz_id>", methods=["GET"])
@token_required
def get_teacher_quiz_detail(current_user, quiz_id):
    if current_user.get("role") != "teacher":
        return jsonify({"error": "Teachers only"}), 403
    doc = teacher_quizzes_collection.find_one({"quizId": quiz_id, "teacherEmail": current_user["email"]}, {"_id": 0})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    doc["deadline"] = _iso_dt(doc.get("deadline"))
    doc["createdAt"] = _iso_dt(doc.get("createdAt"))
    return jsonify({"quiz": doc}), 200


@app.route("/api/teacher/quizzes", methods=["POST"])
@token_required
def create_teacher_quiz(current_user):
    if current_user.get("role") != "teacher":
        return jsonify({"error": "Teachers only"}), 403
    body = request.get_json() or {}
    title = (body.get("title") or "").strip()
    subject = (body.get("subject") or "").strip()
    deadline_raw = body.get("deadline")
    questions = body.get("questions") or []
    if not title or not subject:
        return jsonify({"error": "title and subject are required"}), 400
    dline = _parse_deadline_iso(deadline_raw) if isinstance(deadline_raw, str) else None
    if not dline:
        return jsonify({"error": "deadline must be a valid ISO date-time string"}), 400
    norm_q = []
    for q in questions:
        opts = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
        if len(opts) < 2:
            continue
        try:
            ci = int(q.get("correct", 0))
        except (TypeError, ValueError):
            ci = 0
        ci = max(0, min(ci, len(opts) - 1))
        qt = (q.get("q") or "").strip()
        if not qt:
            continue
        norm_q.append({"q": qt, "options": opts, "correct": ci})
    if not norm_q:
        return jsonify({"error": "Add at least one question with 2+ options"}), 400

    tg_raw = body.get("targetGrade")
    tb_raw = _norm_board(body.get("targetBoard"))
    if tg_raw is None or not tb_raw:
        return jsonify({"error": "targetGrade and targetBoard are required so the right students are notified"}), 400
    try:
        tg = int(tg_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "targetGrade must be a number"}), 400

    qid = uuid.uuid4().hex
    doc = {
        "quizId": qid,
        "teacherEmail": current_user["email"],
        "teacherName": current_user.get("name") or "",
        "title": title,
        "subject": subject,
        "deadline": dline,
        "questions": norm_q,
        "questionCount": len(norm_q),
        "targetGrade": tg,
        "targetBoard": tb_raw,
        "createdAt": datetime.datetime.utcnow(),
    }
    teacher_quizzes_collection.insert_one(doc)
    resp = {k: v for k, v in doc.items() if k != "_id"}
    resp["deadline"] = _iso_dt(resp.get("deadline"))
    resp["createdAt"] = _iso_dt(resp.get("createdAt"))
    return jsonify({"quiz": resp}), 201


@app.route("/api/student/quiz-assignments", methods=["GET"])
@token_required
def student_quiz_assignments(current_user):
    """Quizzes assigned to this student's grade + board, with completion status."""
    if current_user.get("role") != "student":
        return jsonify({"assignments": [], "pendingCount": 0}), 200
    g_ = current_user.get("grade")
    b_ = _norm_board(current_user.get("board"))
    if g_ is None or not b_:
        return jsonify({"assignments": [], "pendingCount": 0}), 200
    try:
        g_int = int(g_)
    except (TypeError, ValueError):
        return jsonify({"assignments": [], "pendingCount": 0}), 200

    attempts = list(
        quiz_attempts_collection.find({"studentEmail": current_user["email"]}, {"_id": 0})
    )
    by_q = {a.get("quizId"): a for a in attempts}

    assignments = []
    pending = 0
    cursor = teacher_quizzes_collection.find(
        {"targetGrade": g_int, "targetBoard": b_},
        {"_id": 0, "questions": 0},
    ).sort("deadline", 1).limit(300)

    for doc in cursor:
        qid = doc.get("quizId")
        att = by_q.get(qid)
        completed = att is not None
        if not completed:
            pending += 1
        assignments.append(
            {
                "quizId": qid,
                "title": doc.get("title"),
                "subject": doc.get("subject"),
                "deadline": _iso_dt(doc.get("deadline")),
                "teacherName": doc.get("teacherName") or "",
                "questionCount": int(doc.get("questionCount") or 0),
                "completed": completed,
                "score": att.get("score") if att else None,
                "total": att.get("total") if att else None,
                "submittedAt": _iso_dt(att.get("submittedAt")) if att and att.get("submittedAt") else None,
            }
        )
    return jsonify({"assignments": assignments, "pendingCount": pending}), 200


@app.route("/api/quizzes/published", methods=["GET"])
@token_required
def list_student_quizzes_filtered(current_user):
    """Same as quiz-assignments for students; kept for compatibility."""
    if current_user.get("role") == "teacher":
        return jsonify({"quizzes": []}), 200
    # Delegate logic inline (avoid internal HTTP)
    g_ = current_user.get("grade")
    b_ = _norm_board(current_user.get("board"))
    if g_ is None or not b_:
        return jsonify({"quizzes": []}), 200
    try:
        g_int = int(g_)
    except (TypeError, ValueError):
        return jsonify({"quizzes": []}), 200
    out = []
    for doc in teacher_quizzes_collection.find(
        {"targetGrade": g_int, "targetBoard": b_},
        {"_id": 0, "quizId": 1, "title": 1, "subject": 1, "deadline": 1, "teacherName": 1, "questionCount": 1},
    ).sort("deadline", 1).limit(300):
        out.append(
            {
                "quizId": doc.get("quizId"),
                "title": doc.get("title"),
                "subject": doc.get("subject"),
                "deadline": _iso_dt(doc.get("deadline")),
                "teacherName": doc.get("teacherName") or "",
                "questionCount": int(doc.get("questionCount") or 0),
            }
        )
    return jsonify({"quizzes": out}), 200


@app.route("/api/quizzes/<quiz_id>", methods=["GET"])
def get_quiz_for_taking(quiz_id):
    doc = teacher_quizzes_collection.find_one({"quizId": quiz_id}, {"_id": 0})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    safe_q = []
    for q in doc.get("questions") or []:
        safe_q.append({"q": q.get("q"), "options": q.get("options") or []})
    my_attempt = None
    user = _optional_user_from_bearer()
    if user and user.get("role") == "student":
        att = quiz_attempts_collection.find_one(
            {"quizId": quiz_id, "studentEmail": user["email"]}, {"_id": 0}
        )
        if att:
            my_attempt = {
                "score": att.get("score"),
                "total": att.get("total"),
                "submittedAt": _iso_dt(att.get("submittedAt")),
            }
    return jsonify(
        {
            "quiz": {
                "quizId": doc.get("quizId"),
                "title": doc.get("title"),
                "subject": doc.get("subject"),
                "deadline": _iso_dt(doc.get("deadline")),
                "questions": safe_q,
            },
            "myAttempt": my_attempt,
        }
    ), 200


@app.route("/api/quizzes/<quiz_id>/submit", methods=["POST"])
@token_required
def submit_teacher_quiz(current_user, quiz_id):
    doc = teacher_quizzes_collection.find_one({"quizId": quiz_id}, {"_id": 0})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    body = request.get_json() or {}
    answers = body.get("answers") or []
    qs = doc.get("questions") or []
    score = 0
    for i, q in enumerate(qs):
        if i >= len(answers):
            break
        try:
            picked = int(answers[i])
        except (TypeError, ValueError):
            continue
        if picked == int(q.get("correct", 0)):
            score += 1

    if current_user.get("role") != "student":
        return jsonify({"score": score, "total": len(qs), "saved": False}), 200

    existing = quiz_attempts_collection.find_one({"quizId": quiz_id, "studentEmail": current_user["email"]})
    if existing:
        return jsonify(
            {
                "score": existing.get("score"),
                "total": existing.get("total"),
                "saved": True,
                "alreadyCompleted": True,
            }
        ), 200

    quiz_attempts_collection.insert_one(
        {
            "quizId": quiz_id,
            "studentEmail": current_user["email"],
            "studentName": current_user.get("name") or "",
            "grade": current_user.get("grade"),
            "board": _norm_board(current_user.get("board")),
            "score": score,
            "total": len(qs),
            "answers": answers,
            "submittedAt": datetime.datetime.utcnow(),
        }
    )
    return jsonify({"score": score, "total": len(qs), "saved": True, "alreadyCompleted": False}), 200


@app.route("/api/teacher/quizzes/<quiz_id>/attempts", methods=["GET"])
@token_required
def list_quiz_attempts_for_teacher(current_user, quiz_id):
    if current_user.get("role") != "teacher":
        return jsonify({"error": "Teachers only"}), 403
    own = teacher_quizzes_collection.find_one(
        {"quizId": quiz_id, "teacherEmail": current_user["email"]}, {"_id": 1}
    )
    if not own:
        return jsonify({"error": "Not found"}), 404
    rows = list(
        quiz_attempts_collection.find({"quizId": quiz_id}, {"_id": 0}).limit(500)
    )
    rows.sort(key=lambda r: (-(r.get("score") or 0) / max(r.get("total") or 1, 1)))
    for r in rows:
        if isinstance(r.get("submittedAt"), datetime.datetime):
            r["submittedAt"] = _iso_dt(r.get("submittedAt"))
    return jsonify({"attempts": rows}), 200


# ==========================================
# KNOWLEDGE GRAPH ROUTES
# ==========================================
@app.route('/api/knowledge-graph/subjects', methods=['GET'])
def kg_subjects():
    std = request.args.get('std', type=int)
    board = request.args.get('board', 'CBSE')
    if not std:
        return jsonify({"error": "std is required"}), 400
    try:
        subjects = curriculum_collection.distinct('subjectName', {'std': std})
        return jsonify(subjects), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/knowledge-graph', methods=['GET'])
def kg_graph():
    std = request.args.get('std', type=int)
    board = request.args.get('board', 'CBSE')
    subject = request.args.get('subject')
    if not std or not subject:
        return jsonify({"error": "std and subject are required"}), 400
    try:
        subject_filter = re.compile(f'^{re.escape(subject)}$', re.I)
        curriculum = curriculum_collection.find_one(
            {'std': std, 'subjectName': subject_filter},
            {'_id': 0, 'chapters': 1}
        )
        if not curriculum or not curriculum.get('chapters'):
            return jsonify({"nodes": []}), 200

        nodes = []
        for i, ch in enumerate(curriculum['chapters']):
            ch_name = ch.get('chapterName', '')
            if not ch_name:
                continue
            raw_prereqs = ch.get('prerequisites')
            if not raw_prereqs:
                raw_prereqs = [curriculum['chapters'][i - 1]['chapterName']] if i > 0 else []
            elif isinstance(raw_prereqs, str):
                raw_prereqs = [raw_prereqs]
            raw_concepts = ch.get('concepts')
            if not raw_concepts:
                words = re.findall(r'[A-Za-z]+', ch_name)
                raw_concepts = list(dict.fromkeys(w for w in words if len(w) > 2))[:6]
            elif isinstance(raw_concepts, str):
                raw_concepts = [raw_concepts]
            nodes.append({
                "chapterName": ch_name,
                "concepts": raw_concepts,
                "prerequisites": raw_prereqs,
                "difficulty": ch.get('difficulty', 0),
            })
        return jsonify({"nodes": nodes}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/knowledge-graph/gaps', methods=['GET'])
@token_required
def kg_gaps(current_user):
    subject = request.args.get('subject')
    if not subject:
        return jsonify({"error": "subject is required"}), 400
    try:
        grade = current_user.get('grade')
        board = _norm_board(current_user.get('board'))
        if grade is None:
            return jsonify({"error": "User grade not set"}), 400

        subject_filter = re.compile(f'^{re.escape(subject)}$', re.I)
        curriculum = curriculum_collection.find_one(
            {'std': int(grade), 'subjectName': subject_filter},
            {'_id': 0, 'chapters': 1}
        )
        if not curriculum or not curriculum.get('chapters'):
            return jsonify({"totalNodes": 0, "masteredNodes": 0, "weakChapters": [], "prerequisiteGaps": []}), 200

        chapters = curriculum['chapters']
        total_nodes = len(chapters)

        attempts = list(quiz_attempts_collection.find(
            {"studentEmail": current_user["email"]},
            {"_id": 0, "quizId": 1, "score": 1, "total": 1}
        ))
        quiz_ids = [a["quizId"] for a in attempts if "quizId" in a]
        quiz_map = {}
        if quiz_ids:
            for q in teacher_quizzes_collection.find(
                {"quizId": {"$in": quiz_ids}},
                {"_id": 0, "quizId": 1, "subject": 1}
            ):
                quiz_map[q["quizId"]] = q.get("subject", "")

        chapter_scores = {}
        for att in attempts:
            qid = att.get("quizId")
            if quiz_map.get(qid) != subject:
                continue
            pct = (att.get("score") or 0) / max(att.get("total") or 1, 1) * 100
            for ch in chapters:
                ch_name = ch.get("chapterName", "")
                if ch_name not in chapter_scores or pct > chapter_scores[ch_name]:
                    chapter_scores[ch_name] = pct

        chapter_attempts = list(chapter_attempts_collection.find(
            {"studentEmail": current_user["email"], "subject": subject},
            {"_id": 0, "chapter": 1, "score": 1, "total": 1}
        ))
        for att in chapter_attempts:
            ch_name = att.get("chapter", "")
            pct = (att.get("score") or 0) / max(att.get("total") or 1, 1) * 100
            if ch_name not in chapter_scores or pct > chapter_scores[ch_name]:
                chapter_scores[ch_name] = pct

        mastered = 0
        weak_chapters = []
        chapter_name_set = {ch.get("chapterName", "") for ch in chapters}

        for ch in chapters:
            ch_name = ch.get("chapterName", "")
            score = chapter_scores.get(ch_name, 0)
            if score >= 70:
                mastered += 1
            elif 0 < score < 40 or ch_name not in chapter_scores:
                weak_chapters.append({"chapterName": ch_name})

        prereq_gaps = []
        for ch in chapters:
            ch_name = ch.get("chapterName", "")
            raw_prereqs = ch.get("prerequisites")
            prereqs = raw_prereqs if isinstance(raw_prereqs, list) else ([raw_prereqs] if isinstance(raw_prereqs, str) else [])
            if not prereqs and curriculum['chapters'].index(ch) > 0:
                prev = curriculum['chapters'][curriculum['chapters'].index(ch) - 1]
                prereqs = [prev.get("chapterName", "")]
            for prereq in prereqs:
                if prereq in chapter_name_set:
                    prereq_score = chapter_scores.get(prereq, 0)
                    if prereq_score < 40:
                        prereq_gaps.append({
                            "recommendation": f"Strengthen \"{prereq}\" before attempting \"{ch_name}\"",
                            "missingPrerequisite": prereq,
                            "prereqScore": round(prereq_score),
                        })

        prereq_gaps.sort(key=lambda g: g["prereqScore"])
        return jsonify({
            "totalNodes": total_nodes,
            "masteredNodes": mastered,
            "weakChapters": weak_chapters,
            "prerequisiteGaps": prereq_gaps,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# CHAPTER QUIZ ROUTES
# ==========================================
@app.route('/api/chapter/quiz', methods=['GET'])
def get_chapter_quiz():
    """Return teacher-customized quiz for a chapter, or auto-generate if none."""
    std = request.args.get('std', type=int)
    subject = request.args.get('subject')
    chapter = request.args.get('chapter')
    if not std or not subject or not chapter:
        return jsonify({"error": "std, subject, chapter are required"}), 400
    try:
        # Check for teacher-customized quiz first
        saved = chapter_teacher_quizzes_collection.find_one(
            {
                'std': std,
                'subjectName': re.compile(f'^{re.escape(subject)}$', re.I),
                'chapterName': re.compile(f'^{re.escape(chapter)}$', re.I),
            },
            {'_id': 0, 'questions': 1, 'updatedBy': 1}
        )
        if saved and saved.get('questions'):
            return jsonify({"questions": saved['questions'], "updatedBy": saved.get('updatedBy')}), 200

        # Fallback: auto-generate 3 MCQs
        subject_filter = re.compile(f'^{re.escape(subject)}$', re.I)
        curriculum = curriculum_collection.find_one(
            {'std': std, 'subjectName': subject_filter},
            {'_id': 0, 'chapters': 1}
        )
        if not curriculum or not curriculum.get('chapters'):
            return jsonify({"questions": []}), 200

        all_ch_names = [ch.get('chapterName', '') for ch in curriculum['chapters'] if ch.get('chapterName')]
        related = [n for n in all_ch_names if n.lower().strip() != chapter.lower().strip()]
        import random; random.shuffle(related)
        distractors = related[:3]

        all_subjects = curriculum_collection.distinct('subjectName', {'std': std})

        chapter_words = list(dict.fromkeys(
            w for w in re.findall(r'[A-Za-z]+', chapter) if len(w) > 2
        )) or [chapter]

        questions = [
            {
                "q": f"What is the main topic of \"{chapter}\"?",
                "options": [chapter] + distractors[:2] if len(distractors) >= 2 else [chapter, "General Knowledge", "Basic Concepts"],
                "correct": 0,
            },
            {
                "q": f"Which subject does \"{chapter}\" belong to?",
                "options": ([subject] + [s for s in all_subjects if s.lower() != subject.lower()])[:4],
                "correct": 0,
            },
            {
                "q": f"What concept is explored in \"{chapter}\"?",
                "options": chapter_words + ["General Knowledge", "Basic Math", "Fundamentals"],
                "correct": 0,
            },
        ]
        return jsonify({"questions": questions}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/chapter/quiz', methods=['PUT'])
@token_required
def save_chapter_quiz(current_user):
    """Teacher-only: save custom quiz questions for a chapter."""
    if current_user.get('role') != 'teacher':
        return jsonify({"error": "Only teachers can edit chapter quizzes"}), 403
    body = request.get_json() or {}
    std = body.get('std')
    subject_name = (body.get('subjectName') or '').strip()
    chapter_name = ' '.join((body.get('chapterName') or '').split())
    questions = body.get('questions') or []
    if not all([std, subject_name, chapter_name]):
        return jsonify({"error": "std, subjectName, chapterName are required"}), 400
    if not questions or not isinstance(questions, list):
        return jsonify({"error": "questions must be a non-empty array"}), 400
    try:
        norm_q = []
        for q in questions:
            qt = (q.get('q') or '').strip()
            opts = [str(o).strip() for o in (q.get('options') or []) if str(o).strip()]
            if len(opts) < 2 or not qt:
                continue
            try:
                ci = int(q.get('correct', 0))
            except (TypeError, ValueError):
                ci = 0
            ci = max(0, min(ci, len(opts) - 1))
            item = {'q': qt, 'options': opts, 'correct': ci}
            if q.get('image'):
                item['image'] = q['image'].strip()
            norm_q.append(item)
        if not norm_q:
            return jsonify({"error": "At least one valid question with 2+ options required"}), 400
        teacher_name = current_user.get('name') or current_user.get('email')
        chapter_teacher_quizzes_collection.update_one(
            {
                'std': std,
                'subjectName': re.compile(f'^{re.escape(subject_name)}$', re.I),
                'chapterName': re.compile(f'^{re.escape(chapter_name)}$', re.I),
            },
            {
                '$set': {
                    'std': std,
                    'subjectName': subject_name,
                    'chapterName': chapter_name,
                    'questions': norm_q,
                    'updatedBy': teacher_name,
                    'updatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
        return jsonify({"status": "saved", "questions": norm_q, "updatedBy": teacher_name}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/chapter/attempt', methods=['POST'])
@token_required
def submit_chapter_attempt(current_user):
    """Save a chapter quiz attempt."""
    body = request.get_json() or {}
    std = body.get('std')
    subject = body.get('subject')
    chapter = body.get('chapter')
    score = body.get('score')
    total = body.get('total')
    answers = body.get('answers', [])

    if not all([std, subject, chapter, score is not None, total is not None]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        existing = chapter_attempts_collection.find_one({
            "studentEmail": current_user["email"],
            "subject": subject,
            "chapter": chapter,
            "std": int(std),
        })
        if existing:
            if (existing.get("score") or 0) >= int(score):
                return jsonify({
                    "saved": True,
                    "alreadyCompleted": True,
                    "score": existing["score"],
                    "total": existing["total"],
                }), 200
            chapter_attempts_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"score": int(score), "total": int(total), "answers": answers, "submittedAt": datetime.datetime.utcnow()}}
            )
        else:
            chapter_attempts_collection.insert_one({
                "studentEmail": current_user["email"],
                "studentName": current_user.get("name", ""),
                "std": int(std),
                "subject": subject,
                "chapter": chapter,
                "score": int(score),
                "total": int(total),
                "answers": answers,
                "submittedAt": datetime.datetime.utcnow(),
            })
        return jsonify({"saved": True, "score": int(score), "total": int(total)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/chapter/progress', methods=['GET'])
@token_required
def get_chapter_progress(current_user):
    """Return per-chapter quiz progress for the current student (used by concept map)."""
    try:
        attempts = list(chapter_attempts_collection.find(
            {"studentEmail": current_user["email"]},
            {"_id": 0, "subject": 1, "chapter": 1, "score": 1, "total": 1}
        ))
        result = []
        for att in attempts:
            pct = round((att.get("score") or 0) / max(att.get("total") or 1, 1) * 100)
            result.append({
                "chapterName": att.get("chapter", ""),
                "subjectName": att.get("subject", ""),
                "quizScore": att.get("score", 0),
                "totalQuestions": att.get("total", 0),
                "isCompleted": True,
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# TEACHER — VIEW STUDENT CHAPTER PROGRESS
# ==========================================
@app.route('/api/teacher/students/progress', methods=['GET'])
@token_required
def teacher_student_chapter_progress(current_user):
    if current_user.get("role") != "teacher":
        return jsonify({"error": "Teachers only"}), 403
    try:
        subject = request.args.get("subject", "")
        pipeline = [
            {"$group": {
                "_id": {"email": "$studentEmail", "name": "$studentName", "std": "$std"},
                "attempts": {"$push": {
                    "subject": "$subject",
                    "chapter": "$chapter",
                    "score": "$score",
                    "total": "$total",
                    "submittedAt": "$submittedAt"
                }}
            }},
            {"$sort": {"_id.name": 1}}
        ]
        results = list(chapter_attempts_collection.aggregate(pipeline))
        students = []
        for r in results:
            email = r["_id"]["email"]
            name = r["_id"]["name"] or email
            std = r["_id"].get("std", "")
            attempts = r["attempts"]
            if subject:
                attempts = [a for a in attempts if a.get("subject", "").lower() == subject.lower()]
            chapters_done = len(set(a["chapter"] for a in attempts if a.get("score", 0) > 0))
            total_score = sum(a.get("score", 0) for a in attempts)
            max_score = sum(a.get("total", 0) for a in attempts)
            pct = round(total_score / max(max_score, 1) * 100)
            chapters_detail = {}
            for a in attempts:
                ch = a.get("chapter", "")
                if ch not in chapters_detail or (a.get("score", 0) or 0) > (chapters_detail[ch].get("score", 0) or 0):
                    chapters_detail[ch] = {
                        "chapter": ch,
                        "subject": a.get("subject", ""),
                        "score": a.get("score", 0),
                        "total": a.get("total", 0),
                        "submittedAt": a.get("submittedAt", ""),
                    }
            students.append({
                "email": email,
                "name": name,
                "std": std,
                "chaptersDone": chapters_done,
                "totalScore": total_score,
                "maxScore": max_score,
                "percentage": pct,
                "chapters": sorted(chapters_detail.values(), key=lambda x: x["chapter"]),
            })
        return jsonify({"students": students}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
                    "correct": question.get("correct", 0),
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