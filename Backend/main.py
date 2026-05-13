from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from pymongo import MongoClient
import os
import datetime
from functools import wraps
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
# Load environment variables
load_dotenv()
app = Flask(__name__)
# Enable CORS for the React frontend
CORS(app, resources={r"/api/*": {"origins": "*"}})
# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-prod')
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/aitutor')
# Database Connection
try:
    client = MongoClient(MONGO_URI)
    db = client.get_database()
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
@app.route('/api/content/pdf', methods=['GET'])
def get_chapter_pdf():
    # Expecting query parameters: ?std=1&subjectName=Mathematics&chapterName=Shapes and Space
    std = request.args.get('std', type=int)
    subject_name = request.args.get('subjectName')
    chapter_name = request.args.get('chapterName')
    if not all([std, subject_name, chapter_name]):
        return jsonify({"error": "Missing required parameters: std, subjectName, chapterName"}), 400
    try:
        pdf_doc = pdfs_collection.find_one({
            'std': std,
            'subjectName': subject_name,
            'chapterName': chapter_name
        }, {'_id': 0, 'ncertUrl': 1})
        
        if not pdf_doc:
            return jsonify({"error": "PDF not found"}), 404
            
        return jsonify({"ncertUrl": pdf_doc.get('ncertUrl')}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
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