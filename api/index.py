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

os.makedirs(RESUMES_DIR, exist_ok=True)

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
    if not client: return "Error: AI not configured."
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
    try:
        # Try finding JSON in code blocks
        code_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if code_match:
            return json.loads(code_match.group(1).strip())
        
        # Try raw JSON object/array
        json_match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', text)
        if json_match:
            return json.loads(json_match.group(1))
        
        return json.loads(text)
    except:
        return {}

# --- API Endpoints ---

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Vercel Python Function"}

@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "timestamp": datetime.now().isoformat()
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
    if not email: raise HTTPException(status_code=400, detail="Email required")
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
    safe_email = email.replace("@", "_").replace(".", "_")
    file_path = os.path.join(RESUMES_DIR, f"{safe_email}.pdf")
    
    if not os.path.exists(file_path): raise HTTPException(status_code=404, detail="No resume")
    
    try:
        with pdfplumber.open(file_path) as pdf:
            text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        if len(text) > 4000: text = text[:4000]
            
        prompt = f"Extract skills from this CV text:\n{text}\nReturn ONLY JSON array of {{'skill': str, 'experience_level': str}}."
        ai_response = call_llm(prompt)
        matched_skills = extract_json(ai_response)
        
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
        with pdfplumber.open(cv.file) as pdf:
            text = "\n".join([p.extract_text() or "" for p in pdf.pages])
        if len(text) > 4000: text = text[:4000]
        
        prompt = f"""
        Extract skills from CV: {text}
        Return ONLY valid JSON array: [{{ "skill": "...", "experience_level": "...", "category": "...", "typical_questions": [...] }}]
        """
        ai_response = call_llm(prompt, max_tokens=2500)
        matched_skills = extract_json(ai_response)
        return {"matched_skills": matched_skills or []}
    except Exception as e:
        logger.error(f"CV Analysis Error: {e}")
        return {"matched_skills": []}

@app.post("/api/start-interview")
async def start_interview(payload: dict):
    skills = payload.get("skills", [])
    if not skills: return {"success": False, "error": "No skills"}
    first = skills[0]
    question_data = {
        "question": first.get("typical_questions", [f"Tell me about {first['skill']}"])[0],
        "skill": first["skill"],
        "question_type": "opening"
    }
    interview_state = {
        "current_skill_index": 0, "skills": skills,
        "questions_asked": {first["skill"]: [question_data]},
        "answers_received": {first["skill"]: []}
    }
    return {"success": True, "question": question_data, "interview_state": interview_state}

@app.post("/api/next-question")
async def next_question(payload: dict):
    skill, previous_answer, history, skills_remaining = payload.get("skill"), payload.get("answer"), payload.get("history", []), payload.get("skills_remaining", [])
    
    prompt = f"Analyze answer: '{previous_answer}' for skill: '{skill}'. Should we ask follow-up or move to next skill? Return JSON with 'should_transition' (bool) and 'next_question' (str)."
    ai_response = call_llm(prompt)
    resp = extract_json(ai_response)
    
    should_transition = resp.get("should_transition", False)
    if should_transition and skills_remaining:
        next_skill = skills_remaining[0]
        return {"success": True, "should_transition": {"transition": True, "next_skill": next_skill}, "next_question": {"question": f"Let's move to {next_skill['skill']}. How much experience do you have?", "skill": next_skill['skill']}}
    
    return {
        "success": True,
        "should_transition": {"transition": False},
        "next_question": {"question": resp.get("next_question", "Can you tell me more about that?"), "skill": skill}
    }

@app.post("/api/evaluate")
async def evaluate(payload: dict):
    question, answer, skill, input_type = payload.get("question"), payload.get("answer"), payload.get("skill"), payload.get("input_type", "TEXT")
    
    prompt = f"""
    Evaluate candidate answer.
    Question: {question}
    Answer: {answer}
    Skill: {skill}
    Input: {input_type}
    Return JSON with 'capability', 'confidence_score', 'technical_score', 'summary_feedback'.
    """
    ai_response = call_llm(prompt)
    eval_data = extract_json(ai_response)
    
    # Fallback to ensure UI doesn't crash
    if not eval_data:
        eval_data = {"capability": "medium", "scores": {"overall_score": 7}, "summary_feedback": "Fair answer."}
        
    return {"evaluation": eval_data}

@app.post("/api/final-report")
async def generate_final_report(payload: dict):
    skills, summaries = payload.get("skills", []), payload.get("skill_summaries", [])
    prompt = f"Create final report for skills {json.dumps(skills)}. Return JSON with 'overall_score', 'overall_proficiency', 'summary'."
    ai_response = call_llm(prompt, max_tokens=3000)
    return extract_json(ai_response) or {"overall_score": 70, "summary": "Interview completed."}
