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

# Create data directories (Note: in Vercel, /tmp is the only writable directory)
# However, we will use /tmp/data for temporary storage in serverless execution
DATA_DIR = "/tmp/data"
RESUMES_DIR = os.path.join(DATA_DIR, "resumes")
PROFILES_FILE = os.path.join(DATA_DIR, "profiles.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")

os.makedirs(RESUMES_DIR, exist_ok=True)

def get_profiles():
    if not os.path.exists(PROFILES_FILE):
        return []
    try:
        with open(PROFILES_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_profiles(profiles):
    with open(PROFILES_FILE, 'w') as f:
        json.dump(profiles, f, indent=2)

def get_users():
    if not os.path.exists(USERS_FILE):
        return []
    try:
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

@app.post("/api/auth")
async def auth(payload: dict):
    auth_type = payload.get("type")
    email = payload.get("email")
    password = payload.get("password")
    name = payload.get("name")
    
    users = cast(List[Dict[str, Any]], get_users())
    
    if auth_type == "signup":
        if not email:
            return {"success": False, "error": "Email required"}
            
        if any(u["email"] == email for u in users):
            return {"success": False, "error": "User exists"}
        
        email_str = cast(str, email)
        new_user = {
            "id": int(datetime.now().timestamp() * 1000),
            "email": email_str,
            "password": password,
            "name": name or email_str.split("@")[0],
            "createdAt": datetime.now().isoformat()
        }
        users.append(new_user)
        save_users(users)
        return {"success": True}
    
    elif auth_type == "login":
        user = next((u for u in users if u["email"] == email and u["password"] == password), None)
        if not user:
            return {"success": False, "error": "Invalid credentials"}
        
        return {
            "success": True, 
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user.get("name")
            }
        }
    
    return {"success": False, "error": "Invalid type"}

@app.get("/api/profile")
async def get_profile(email: str = Header(None)):
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    profiles = get_profiles()
    profile = next((p for p in profiles if p["email"] == email), None)
    
    if not profile:
        return {"email": email, "resume": None, "parsedResume": None}
    
    return profile

@app.post("/api/profile")
async def update_profile(payload: dict):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
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
async def upload_resume_profile(resume: UploadFile = File(...), email: str = Header(None)):
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    safe_email = email.replace("@", "_").replace(".", "_")
    file_name = f"{safe_email}.pdf"
    file_path = os.path.join(RESUMES_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(resume.file, buffer)
    
    profiles = get_profiles()
    profile_data = {
        "email": email,
        "resume": f"/api/uploads/{file_name}",
        "parsedResume": None,
        "updatedAt": datetime.now().isoformat()
    }
    
    user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
    if user_idx > -1:
        profiles[user_idx] = profile_data
    else:
        profiles.append(profile_data)
        
    save_profiles(profiles)
    
    return {"success": True, "resumeUrl": profile_data["resume"]}

@app.get("/api/uploads/{filename}")
async def serve_resume(filename: str):
    file_path = os.path.join(RESUMES_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@app.delete("/api/resume")
async def delete_resume_profile(email: str = Header(None)):
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    safe_email = email.replace("@", "_").replace(".", "_")
    file_name = f"{safe_email}.pdf"
    file_path = os.path.join(RESUMES_DIR, file_name)
    
    if os.path.exists(file_path):
        os.remove(file_path)
    
    profiles = get_profiles()
    user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
    if user_idx > -1:
        profiles[user_idx]["resume"] = None
        profiles[user_idx]["parsedResume"] = None
        save_profiles(profiles)
        
    return {"success": True}

@app.post("/api/resume/parse")
async def parse_resume_profile(payload: dict):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
        
    safe_email = email.replace("@", "_").replace(".", "_")
    file_name = f"{safe_email}.pdf"
    file_path = os.path.join(RESUMES_DIR, file_name)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="No resume found")
    
    try:
        with pdfplumber.open(file_path) as pdf:
            text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        
        if len(text) > 4000:
            text = text[0:4000]
            
        prompt = f"""
        Extract technical skills from this CV text:
        {text}
        Return ONLY a JSON array of objects with "skill" and "experience_level".
        """
        
        ai_response = call_llm(prompt)
        matched_skills = extract_json(ai_response)
        
        if not isinstance(matched_skills, list):
            matched_skills = []
            
        final_skills = [s.get("skill", "Unknown") for s in matched_skills if isinstance(s, dict)]
        
        parsed_data = {
            "skills": final_skills,
            "skillDetails": matched_skills,
            "parsedAt": datetime.now().isoformat()
        }
        
        profiles = get_profiles()
        user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
        if user_idx > -1:
            profiles[user_idx]["parsedResume"] = parsed_data
            save_profiles(profiles)
        else:
            profiles.append({"email": email, "parsedResume": parsed_data})
            save_profiles(profiles)
            
        return {"success": True, "skills": final_skills}
    except Exception as e:
        logger.error(f"Parse error: {e}")
        raise HTTPException(status_code=500, detail="Parse failed")

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

@app.get("/api/status")
async def get_status():
    api_key = os.getenv("GROQ_API_KEY")
    return {
        "status": "online",
        "groq_configured": bool(api_key),
        "timestamp": datetime.now().isoformat()
    }

def call_llm(prompt: str, max_tokens: int = 2000) -> str:
    client = get_groq_client()
    if not client:
        return "Error: AI not configured. Please set GROQ_API_KEY."
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

def extract_json(text: str) -> dict:
    code_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    code_blocks = re.findall(code_block_pattern, text)
    for block in code_blocks:
        try:
            return json.loads(block.strip())
        except:
            continue
    json_pattern = r'\{[\s\S]*\}'
    matches = re.findall(json_pattern, text)
    for match in matches:
        try:
            return json.loads(match)
        except:
            continue
    array_pattern = r'\[[\s\S]*\]'
    matches = re.findall(array_pattern, text)
    for match in matches:
        try:
            result = json.loads(match)
            if isinstance(result, list):
                return result
        except:
            continue
    return {}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Vercel Backend is running"}

@app.post("/api/upload-and-analyze")
async def upload_and_analyze(cv: UploadFile = File(...)):
    try:
        text_chunks: list[str] = []
        with pdfplumber.open(cv.file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_chunks.append(str(page_text))
        text: str = "\n".join(text_chunks)
        if len(text) > 4000:
            text = text[0:4000]
        
        prompt = f"""Extract skills from this CV: {text}. Return ONLY valid JSON array."""
        ai_response = call_llm(prompt, max_tokens=2500)
        matched_skills = extract_json(ai_response)
        return {"matched_skills": matched_skills}
    except Exception as e:
        logger.error(f"CV Analysis Error: {e}")
        return {"matched_skills": []}

@app.post("/api/start-interview")
async def start_interview(payload: dict):
    skills = payload.get("skills", [])
    if not skills:
        return {"success": False, "error": "No skills provided"}
    first_skill = skills[0]
    skill_name = first_skill["skill"]
    question_text = first_skill.get("typical_questions", [f"Tell me about {skill_name}"])[0]
    
    question_data = {
        "question": question_text,
        "skill": skill_name,
        "question_type": "opening"
    }
    
    interview_state = {
        "current_skill_index": 0,
        "skills": skills,
        "questions_asked": {skill_name: [question_data]},
        "answers_received": {skill_name: []}
    }
    
    return {"success": True, "question": question_data, "interview_state": interview_state}

@app.post("/api/evaluate")
async def evaluate(payload: dict):
    # Mock evaluation for Vercel
    return {
        "evaluation": {
            "capability": "strong",
            "confidence": "strong",
            "summary_feedback": "Good answer on the basic concepts.",
            "scores": {"overall_score": 8}
        }
    }

@app.post("/api/next-question")
async def next_question(payload: dict):
    skill = payload.get("skill", "")
    return {
        "success": True,
        "question": {"question": f"Can you tell me more about your work with {skill}?", "skill": skill}
    }

@app.post("/api/generate-skill-summary")
async def generate_skill_summary(payload: dict):
    return "The candidate shows strong grasp of core concepts."

@app.post("/api/final-report")
async def generate_final_report(payload: dict):
    return {
        "overall_summary": "Great interview overall.",
        "skills_assessed": [],
        "recommendation": "Hire"
    }
