from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from datetime import datetime
import json
import os
import re
import shutil
import traceback
import logging
from dotenv import load_dotenv
from groq import Groq
from typing import List, Dict, Any, Optional, cast
import pdfplumber
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add this CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vercel persistence: /tmp is the only writable directory
DATA_DIR = "/tmp/data"
RESUMES_DIR = os.path.join(DATA_DIR, "resumes")
PROFILES_FILE = os.path.join(DATA_DIR, "profiles.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")

# Startup logic to ensure directories exist in /tmp
def ensure_dirs():
    try:
        os.makedirs(RESUMES_DIR, exist_ok=True)
        logger.info(f"Initialized directories at {DATA_DIR}")
    except Exception as e:
        logger.error(f"Failed to create directories: {e}")

@app.on_event("startup")
async def startup_event():
    ensure_dirs()

def get_profiles():
    if not os.path.exists(PROFILES_FILE): return []
    try:
        with open(PROFILES_FILE, 'r') as f: return json.load(f)
    except: return []

def save_profiles(profiles):
    with open(PROFILES_FILE, 'w') as f: json.dump(profiles, f, indent=2)

def get_users():
    if not os.path.exists(USERS_FILE): return []
    try:
        with open(USERS_FILE, 'r') as f: return json.load(f)
    except: return []

def save_users(users):
    with open(USERS_FILE, 'w') as f: json.dump(users, f, indent=2)

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.error("GROQ_API_KEY not found in environment")
        return None
    try:
        return Groq(api_key=api_key)
    except Exception as e:
        logger.error(f"Failed to initialize Groq client: {e}")
        return None

def call_llm(prompt: str, max_tokens: int = 2500) -> str:
    client = get_groq_client()
    if not client: return "Error: AI not configured. Please set GROQ_API_KEY in Vercel."
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        return ""

def extract_json(text: str) -> Any:
    """Extract JSON from text with multiple fallback strategies"""
    if not text: return None
    try:
        # Strategy 1: Find JSON in code blocks
        code_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
        code_blocks = re.findall(code_block_pattern, text)
        for block in code_blocks:
            try:
                return json.loads(block.strip())
            except: continue
        
        # Strategy 2: Find first '[' or '{' and last ']' or '}'
        json_match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except: pass
            
        # Strategy 3: Raw parse
        return json.loads(text)
    except Exception as e:
        logger.warning(f"JSON extraction failed: {e}")
        return None

# --- API Endpoints ---

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Vercel Python Function"}

@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "writable_dir_exists": os.path.exists(DATA_DIR),
        "timestamp": datetime.now().isoformat(),
        "env": "production" if os.getenv("VERCEL") else "development"
    }

@app.post("/api/auth")
async def auth(payload: dict):
    auth_type, email, password, name = payload.get("type"), payload.get("email"), payload.get("password"), payload.get("name")
    users = cast(List[Dict[str, Any]], get_users())
    
    if auth_type == "signup":
        if not email: return {"success": False, "error": "Email required"}
        if any(u["email"] == email for u in users): return {"success": False, "error": "User exists"}
        new_user = {
            "id": int(datetime.now().timestamp() * 1000),
            "email": email, "password": password, "name": name or email.split("@")[0],
            "createdAt": datetime.now().isoformat()
        }
        users.append(new_user)
        save_users(users)
        return {"success": True}
    
    elif auth_type == "login":
        user = next((u for u in users if u["email"] == email and u["password"] == password), None)
        if not user: return {"success": False, "error": "Invalid credentials"}
        return {"success": True, "user": {"id": user["id"], "email": user["email"], "name": user.get("name")}}
    
    return {"success": False, "error": "Invalid type"}

@app.get("/api/profile")
async def get_profile(email: str = Header(None)):
    if not email: return {"email": None, "resume": None, "parsedResume": None}
    profiles = get_profiles()
    profile = next((p for p in profiles if p["email"] == email), None)
    return profile or {"email": email, "resume": None, "parsedResume": None}

@app.post("/api/profile")
async def update_profile(payload: dict):
    email = payload.get("email")
    if not email: raise HTTPException(status_code=400, detail="Email required")
    profiles = cast(List[Dict[str, Any]], get_profiles())
    user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
    
    profile_data = payload.copy()
    profile_data["updatedAt"] = datetime.now().isoformat()
    
    if user_idx > -1:
        existing = profiles[user_idx]
        for key in existing:
            if key not in profile_data or profile_data[key] is None:
                profile_data[key] = existing[key]
        profiles[user_idx] = profile_data
    else:
        profiles.append(profile_data)
        
    save_profiles(profiles)
    return {"success": True}

@app.post("/api/resume")
async def upload_resume(resume: UploadFile = File(...), email: str = Header(None)):
    if not email: raise HTTPException(status_code=400, detail="Email required")
    safe_email = email.replace("@", "_").replace(".", "_")
    file_name = f"{safe_email}.pdf"
    file_path = os.path.join(RESUMES_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(resume.file, buffer)
    
    profiles = get_profiles()
    profile_data = {
        "email": email, "resume": f"/api/uploads/{file_name}",
        "parsedResume": None, "updatedAt": datetime.now().isoformat()
    }
    
    user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
    if user_idx > -1: profiles[user_idx] = profile_data
    else: profiles.append(profile_data)
    save_profiles(profiles)
    
    return {"success": True, "resumeUrl": profile_data["resume"]}

@app.get("/api/uploads/{filename}")
async def serve_file(filename: str):
    file_path = os.path.join(RESUMES_DIR, filename)
    if not os.path.exists(file_path): raise HTTPException(status_code=404)
    return FileResponse(file_path)

@app.delete("/api/resume")
async def delete_resume(email: str = Header(None)):
    if not email: raise HTTPException(status_code=400, detail="Email required")
    safe_email = email.replace("@", "_").replace(".", "_")
    file_path = os.path.join(RESUMES_DIR, f"{safe_email}.pdf")
    if os.path.exists(file_path): os.remove(file_path)
    
    profiles = get_profiles()
    user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
    if user_idx > -1:
        profiles[user_idx]["resume"] = None
        profiles[user_idx]["parsedResume"] = None
        save_profiles(profiles)
    return {"success": True}

@app.post("/api/resume/parse")
async def parse_resume(payload: dict):
    email = payload.get("email")
    if not email: return {"success": False, "error": "Email required"}
    safe_email = email.replace("@", "_").replace(".", "_")
    file_path = os.path.join(RESUMES_DIR, f"{safe_email}.pdf")
    
    if not os.path.exists(file_path): raise HTTPException(status_code=404, detail="No resume")
    
    try:
        with pdfplumber.open(file_path) as pdf:
            text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        if len(text) > 4000: text = text[:4000]
            
        prompt = f"Extract technical skills from CV text: {text}. Return ONLY a JSON array of objects with 'skill' and 'experience_level'."
        ai_response = call_llm(prompt)
        matched_skills = extract_json(ai_response)
        
        if not isinstance(matched_skills, list): matched_skills = []
        final_skills = [s.get("skill", "Unknown") for s in matched_skills if isinstance(s, dict)]
        parsed_data = {"skills": final_skills, "skillDetails": matched_skills, "parsedAt": datetime.now().isoformat()}
        
        profiles = get_profiles()
        user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
        if user_idx > -1: profiles[user_idx]["parsedResume"] = parsed_data
        else: profiles.append({"email": email, "parsedResume": parsed_data})
        save_profiles(profiles)
            
        return {"success": True, "skills": final_skills}
    except Exception as e:
        logger.error(f"Parse error: {e}")
        return {"success": False}

@app.post("/api/upload-and-analyze")
async def upload_and_analyze(cv: UploadFile = File(...)):
    try:
        logger.info(f"Uploading and analyzing CV: {cv.filename}")
        with pdfplumber.open(cv.file) as pdf:
            text = "\n".join([p.extract_text() or "" for p in pdf.pages])
        if len(text) > 4000: text = text[:4000]
        logger.info(f"Extracted {len(text)} chars of text from CV")
        
        prompt = f"""
        You are an expert technical recruiter analyzing a candidate's CV.
        CV CONTENT:
        {text}
        
        Extract ALL technical skills (Languages, Frameworks, Tools, Databases).
        For each skill, estimate experience level (beginner/intermediate/advanced/expert) and category.
        Also provide 2 typical interview questions for that skill.
        
        Return ONLY a valid JSON array:
        [
            {{
                "skill": "Python",
                "experience_level": "intermediate",
                "category": "language",
                "typical_questions": ["Explain decorators", "How is memory managed?"]
            }}
        ]
        """
        ai_response = call_llm(prompt, max_tokens=2500)
        matched_skills = extract_json(ai_response)
        
        if not matched_skills or not isinstance(matched_skills, list):
            logger.warning("No skills extracted or bad format. Using fallbacks.")
            matched_skills = get_fallback_skills()
        
        return {"matched_skills": matched_skills}
    except Exception as e:
        logger.error(f"CV Analysis Error: {e}")
        return {"matched_skills": get_fallback_skills()}

def get_fallback_skills():
    return [
        {"skill": "Python", "experience_level": "intermediate", "category": "language", "typical_questions": ["What are list comprehensions?", "Difference between list and tuple?"]},
        {"skill": "JavaScript", "experience_level": "intermediate", "category": "language", "typical_questions": ["What is a closure?", "How does 'this' work?"]},
        {"skill": "React", "experience_level": "intermediate", "category": "framework", "typical_questions": ["What are hooks?", "Virtual DOM explanation?"]},
        {"skill": "Node.js", "experience_level": "intermediate", "category": "framework", "typical_questions": ["Event loop explanation?", "How to handle async errors?"]}
    ]

@app.post("/api/start-interview")
async def start_interview(payload: dict):
    skills = payload.get("skills", [])
    if not skills: return {"success": False, "error": "No skills"}
    
    first = skills[0]
    skill_name = first.get("skill")
    level = first.get("experience_level", "intermediate")
    
    # Generate a dynamic opening question
    prompt = f"Start a technical interview for skill '{skill_name}' at level '{level}'. Generate a professional opening question. Return JSON: {{'question': '...', 'skill': '{skill_name}'}}"
    ai_response = call_llm(prompt)
    resp = extract_json(ai_response) or {}
    
    question_text = resp.get("question", f"Tell me about your experience with {skill_name}.")
    question_data = {"question": question_text, "skill": skill_name, "question_type": "opening"}
    
    interview_state = {
        "current_skill_index": 0, "skills": skills,
        "questions_asked": {skill_name: [question_data]},
        "answers_received": {skill_name: []},
        "conv_history": [{"role": "assistant", "content": question_text}]
    }
    return {"success": True, "question": question_data, "interview_state": interview_state}

@app.post("/api/next-question")
async def next_question(payload: dict):
    skill, answer, history, skills_remaining = payload.get("skill"), payload.get("answer"), payload.get("history", []), payload.get("skills_remaining", [])
    
    # Analyze answer and decide next step
    prompt = f"""
    Interviewer evaluating '{skill}'.
    Previous question history: {json.dumps(history[-3:])}
    Latest answer: '{answer}'
    
    Analyze the answer. Should we ask a follow-up or move to next skill?
    If follow-up, provide a challenging question.
    If move on, set should_transition to true.
    
    Return JSON: {{ "should_transition": bool, "next_question": "string", "feedback": "string" }}
    """
    ai_response = call_llm(prompt)
    resp = extract_json(ai_response) or {}
    
    should_transition = resp.get("should_transition", False)
    if (should_transition or len(history) > 6) and skills_remaining:
        next_skill = skills_remaining[0]
        transition_q = f"Great. Let's move on to {next_skill['skill']}. How would you describe your proficiency here?"
        return {
            "success": True, 
            "should_transition": {"transition": True, "next_skill": next_skill},
            "next_question": {"question": transition_q, "skill": next_skill['skill']},
            "analysis": resp
        }
    
    return {
        "success": True,
        "should_transition": {"transition": False},
        "next_question": {"question": resp.get("next_question", "Interesting. Can you elaborate further?"), "skill": skill},
        "analysis": resp
    }

@app.post("/api/evaluate")
async def evaluate(payload: dict):
    question, answer, skill = payload.get("question"), payload.get("answer"), payload.get("skill")
    prompt = f"""
    Evaluate this interview answer:
    Skill: {skill}
    Question: {question}
    Answer: {answer}
    
    Provide detailed feedback and a score (0-10).
    Return JSON: {{ "capability": "weak/medium/strong/expert", "scores": {{ "overall_score": 7 }}, "summary_feedback": "...", "strengths": [], "areas_for_improvement": [] }}
    """
    ai_response = call_llm(prompt)
    eval_data = extract_json(ai_response)
    
    if not eval_data:
        eval_data = {"capability": "medium", "scores": {"overall_score": 6}, "summary_feedback": "The answer was adequate but could use more technical depth."}
        
    return {"evaluation": eval_data}

@app.post("/api/final-report")
async def generate_final_report(payload: dict):
    skills, histories = payload.get("skills", []), payload.get("histories", [])
    prompt = f"Create a final summary for an interview assessing: {json.dumps(skills)}. Summarize performance and give a hiring recommendation. Return JSON with 'overall_score', 'overall_proficiency', 'summary'."
    ai_response = call_llm(prompt, max_tokens=3000)
    return extract_json(ai_response) or {"overall_score": 70, "summary": "Interview complete. Good performance overall."}
