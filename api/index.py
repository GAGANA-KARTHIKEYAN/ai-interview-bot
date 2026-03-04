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

# --- Interview Endpoints ---

@app.post("/api/upload-and-analyze")
async def upload_and_analyze(cv: UploadFile = File(...)):
    """Analyze CV using AI to extract skills with experience levels"""
    try:
        # Extract text from PDF
        text_chunks: list[str] = []
        with pdfplumber.open(cv.file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_chunks.append(str(page_text))
        
        text: str = "\n".join(text_chunks)
        
        # Truncate if too long
        if len(text) > 4000:
            text = text[0:4000]
        logger.info(f"Extracted {len(text)} characters from CV for analysis")
        
        prompt = f"""
        You are an expert technical recruiter analyzing a candidate's CV for a software developer position.
        
        CV CONTENT:
        {text}
        
        Based on this CV content, extract ALL technical skills mentioned (Languages, Frameworks, Tools, Databases, Cloud).
        
        For each skill:
        1. Identify it from the CV
        2. Estimate experience level (beginner/intermediate/advanced/expert)
        3. Categorize it appropriately
        4. Add 2-3 typical interview questions for this skill
        
        Return ONLY a valid JSON array with this exact structure:
        [
            {{
                "skill": "Python",
                "experience_level": "intermediate",
                "category": "language",
                "typical_questions": [
                    "Explain Python decorators and when you'd use them",
                    "How does Python handle memory management?"
                ]
            }}
        ]
        
        Include 8-15 skills. Defaults to "intermediate" if unsure.
        """
        
        ai_response = call_llm(prompt, max_tokens=2500)
        matched_skills = extract_json(ai_response)
        
        if not matched_skills or not isinstance(matched_skills, list):
            logger.warning("No skills extracted or invalid JSON, using fallbacks")
            matched_skills = get_fallback_skills()
        
        # Ensure schema consistency
        for skill in matched_skills:
            if not isinstance(skill, dict): continue
            if "skill" not in skill: skill["skill"] = "Unknown"
            if "typical_questions" not in skill or not skill["typical_questions"]:
                skill["typical_questions"] = generate_fallback_questions(str(skill["skill"]), str(skill.get("experience_level", "intermediate")))
            if "category" not in skill: skill["category"] = categorize_skill(str(skill["skill"]))
            if "experience_level" not in skill: skill["experience_level"] = "intermediate"
            
        return {"matched_skills": matched_skills}
    except Exception as e:
        logger.error(f"CV Analysis Error: {traceback.format_exc()}")
        return {"matched_skills": get_fallback_skills()}

def get_fallback_skills():
    return [
        {"skill": "Python", "experience_level": "intermediate", "category": "language", "typical_questions": ["What are list comprehensions?", "Explain decorators."]},
        {"skill": "JavaScript", "experience_level": "intermediate", "category": "language", "typical_questions": ["Explain closures.", "How does the event loop work?"]},
        {"skill": "React", "experience_level": "intermediate", "category": "framework", "typical_questions": ["Difference between functional and class components?", "What are hooks?"]},
        {"skill": "SQL", "experience_level": "intermediate", "category": "database", "typical_questions": ["Explain JOIN types.", "What is normalization?"]}
    ]

def generate_fallback_questions(skill: str, level: str) -> list:
    base = {
        "beginner": [f"What is {skill}?", f"Basic concepts of {skill}?"],
        "intermediate": [f"Core features of {skill}?", f"Problem solved with {skill}?"],
        "advanced": [f"Optimizations in {skill}?", f"Common pitfalls in {skill}?"],
        "expert": [f"System design with {skill}?", f"Architecture patterns in {skill}?"]
    }
    return base.get(level.lower(), base["intermediate"])

def categorize_skill(skill: str) -> str:
    s = skill.lower()
    if any(x in s for x in ['python', 'js', 'java', 'go', 'ruby']): return "language"
    if any(x in s for x in ['react', 'django', 'spring', 'node']): return "framework"
    if any(x in s for x in ['sql', 'postgres', 'mongo']): return "database"
    if any(x in s for x in ['git', 'docker', 'aws']): return "tool"
    return "other"

@app.post("/api/start-interview")
async def start_interview(payload: dict):
    """Initialize interview with first question"""
    skills = payload.get("skills", [])
    if not skills: return {"success": False, "error": "No skills provided"}
    
    first = skills[0]
    skill_name = first["skill"]
    level = first.get("experience_level", "intermediate")
    
    # Generate dynamic opening question
    prompt = f"""
    Starting interview for a {level} level candidate in {skill_name}.
    Generate a warm, professional, and conversational OPENING question.
    Encourage them to share a specific project.
    
    Return ONLY JSON:
    {{
        "question": "Question text",
        "context": "Brief context",
        "skill": "{skill_name}"
    }}
    """
    try:
        ai_response = call_llm(prompt)
        res = extract_json(ai_response)
        question_text = res.get("question", f"Tell me about your experience with {skill_name}.")
        context = res.get("context", "Opening")
    except:
        question_text = f"Let's start with {skill_name}. Walk me through a project where you used it effectively."
        context = "Opening"
        
    question_data = {
        "question": question_text,
        "context": context,
        "expected_depth": level,
        "skill": skill_name,
        "question_type": "opening",
        "follow_up_potential": True
    }
    
    interview_state = {
        "current_skill_index": 0,
        "skills": skills,
        "questions_asked": {skill_name: [question_data]},
        "answers_received": {skill_name: []},
        "evaluations": {skill_name: []},
        "skill_progress": {skill_name: {"questions_asked": 1, "status": "in_progress"}}
    }
    
    return {"success": True, "question": question_data, "interview_state": interview_state}

@app.post("/api/next-question")
async def next_question(payload: dict):
    """Dynamically generate next question or transition"""
    skill = payload.get("skill", "")
    prev_answer = payload.get("answer", "")
    prev_question = payload.get("question", "")
    history = payload.get("history", [])
    skills_rem = payload.get("skillsRemaining", [])

    if not skill or not prev_answer: return {"success": False, "error": "Missing fields"}

    # 1. Analyze Answer
    analysis_prompt = f"""
    Analyze this technical answer for {skill}.
    Question: {prev_question}
    Answer: {prev_answer}
    
    Analyze deeply and return JSON:
    {{
        "demonstrated_concepts": ["c1", "c2"],
        "missing_concepts": ["c1", "c2"],
        "answer_depth": "superficial/moderate/deep/expert",
        "had_examples": true/false,
        "true_proficiency": "beginner/intermediate/advanced/expert",
        "next_focus": "probe area"
    }}
    """
    analysis = extract_json(call_llm(analysis_prompt)) or {
        "demonstrated_concepts": [], "missing_concepts": [], "answer_depth": "moderate",
        "had_examples": False, "true_proficiency": "intermediate", "next_focus": "general"
    }

    # 2. Decision Logic
    q_asked = len([h for h in history if h.get("skill") == skill])
    should_transition = False
    reason = "Proceeding"

    if q_asked >= 3 and analysis.get("answer_depth") in ["deep", "expert"]:
        should_transition = True
        reason = "Strong depth shown"
    elif q_asked >= 4:
        should_transition = True
        reason = "Maximum questions for this skill"
    elif analysis.get("answer_depth") == "superficial" and q_asked >= 3:
        should_transition = True
        reason = "Limited depth, moving to other areas"

    if should_transition:
        return {
            "success": True,
            "should_transition": {"transition": True, "reason": reason, "next_skill": skills_rem[0] if skills_rem else None, "complete": not bool(skills_rem)},
            "analysis": analysis
        }

    # 3. Generate Follow-up
    q_prompt = f"""
    You are a technical interviewer evaluating a candidate for {skill}.
    Their previous answer to your last question was: "{prev_answer}"
    
    1. Acknowledge their point briefly or transition naturally.
    2. Ask ONE conversational follow-up question that directly references or builds upon their last answer. 
    Make it robust, challenging, and highly context-aware. If they missed concepts ({analysis.get('missing_concepts')}), probe into them directly.
    
    Return ONLY JSON: {{ "question": "...", "context": "...", "focus_area": "...", "skill": "{skill}" }}
    """
    nxt_q = extract_json(call_llm(q_prompt))
    if not nxt_q or "question" not in nxt_q:
        nxt_q = {"question": f"Can you elaborate more on how {skill} handles scalability?", "context": "Fallback", "skill": skill}

    return {"success": True, "next_question": nxt_q, "analysis": analysis, "should_transition": {"transition": False}}

@app.post("/api/evaluate")
async def evaluate(payload: dict):
    """Detailed 4-metric evaluation"""
    question, answer, skill = payload.get("question", ""), payload.get("answer", ""), payload.get("skill", "")
    input_type = "TEXT"
    if "[VIDEO RECORDING" in answer: input_type = "VIDEO"
    elif "Voice input" in answer: input_type = "VOICE"

    prompt = f"""
    Evaluate candidate's technical answer.
    SKILL: {skill} | INPUT: {input_type} | Q: {question} | A: {answer}
    
    STRICT SCORING RULES:
    1. Base Evaluation: If the answer is "I don't know", "idk", extremely brief (e.g., < 10 words without substance), or completely irrelevant, give a technical score of 0 or 1, and be harsh in the feedback.
    2. TEXT Input: Score ONLY Technical + Confidence. (Communication and Behavioral MUST be 0).
    3. VOICE Input: Score Technical + Communication + Confidence. (Behavioral MUST be 0).
    4. VIDEO Input: Score all 4 (Technical, Confidence, Communication, Behavioral).
    
    Return ONLY JSON with this EXACT nested structure:
    {{
      "evaluation": {{
        "capability": "weak/medium/strong/expert",
        "confidence": "low/medium/high",
        "technical_accuracy": {{ "correct_concepts": [], "missed_concepts": [], "misunderstood_concepts": [] }},
        "gaps_identified": {{ "knowledge_gaps": [], "depth_gaps": [], "example_gaps": "string" }},
        "experience_indicators": {{ "had_real_examples": bool, "discussed_challenges": bool, "example_quality": "string", "star_method_used": bool }},
        "communication": {{ "clarity": "string", "structure": "string", "hesitation_markers": bool, "pacing": "string", "filler_words": bool }},
        "strengths": [], "areas_for_improvement": [], "ideal_answer": "string",
        "scores": {{ "technical_score": 0-10, "confidence_score": 0-10, "communication_score": 0-10, "behavioral_score": 0-10, "overall_score": 0-10 }},
        "score_explanations": {{ "technical_explanation": "...", "confidence_explanation": "...", "communication_explanation": "...", "behavioral_explanation": "..." }},
        "summary_feedback": "..."
      }}
    }}
    """
    try:
        ai_resp = call_llm(prompt, max_tokens=4000)
        res = extract_json(ai_resp)
        evaluation = res.get("evaluation", res) if res else generate_fallback_evaluation(answer)
        
        # Enforce UI rules by removing invalid scores based on input type
        if "scores" in evaluation:
            if input_type == "TEXT":
                evaluation["scores"].pop("communication_score", None)
                evaluation["scores"].pop("behavioral_score", None)
            elif input_type == "VOICE":
                evaluation["scores"].pop("behavioral_score", None)
                
        return {"evaluation": evaluation}
    except:
        eval_fallback = generate_fallback_evaluation(answer)
        if "scores" in eval_fallback:
            if input_type == "TEXT":
                eval_fallback["scores"].pop("communication_score", None)
                eval_fallback["scores"].pop("behavioral_score", None)
            elif input_type == "VOICE":
                eval_fallback["scores"].pop("behavioral_score", None)
        return {"evaluation": eval_fallback}

def generate_fallback_evaluation(answer: str) -> dict:
    wc = len(answer.split())
    if wc < 5 or answer.lower().strip() in ["i don't know", "idk", "no idea"]:
        return {
            "capability": "weak", "confidence": "low",
            "technical_accuracy": {"correct_concepts": [], "missed_concepts": ["All required concepts"], "misunderstood_concepts": []},
            "gaps_identified": {"knowledge_gaps": ["Did not answer"], "depth_gaps": ["No depth provided"], "example_gaps": "No examples given"},
            "experience_indicators": {"had_real_examples": False, "discussed_challenges": False, "example_quality": "none", "star_method_used": False},
            "communication": {"clarity": "low", "structure": "none", "hesitation_markers": True, "pacing": "fast", "filler_words": False},
            "strengths": [], "areas_for_improvement": ["Must provide technical answer even if unsure"],
            "ideal_answer": "Please provide your technical understanding of the topic, even if limited.",
            "scores": {"technical_score": 0, "confidence_score": 2, "communication_score": 0, "behavioral_score": 0, "overall_score": 0},
            "score_explanations": {"technical_explanation": "No technical substance provided."},
            "summary_feedback": "You didn't answer the question. Please try to elaborate on what you do know next time."
        }
        
    cap = "strong" if wc > 100 else "medium" if wc > 50 else "weak"
    score = 8 if wc > 100 else 6 if wc > 50 else 4
    return {
        "capability": cap, "confidence": "medium",
        "technical_accuracy": {"correct_concepts": ["General overview"], "missed_concepts": ["Specific depth"], "misunderstood_concepts": []},
        "gaps_identified": {"knowledge_gaps": ["Technical detail"], "depth_gaps": ["Surface explanation"], "example_gaps": "No examples"},
        "experience_indicators": {"had_real_examples": wc > 75, "discussed_challenges": False, "example_quality": "fair", "star_method_used": False},
        "communication": {"clarity": "medium", "structure": "basic", "hesitation_markers": False, "pacing": "balanced", "filler_words": False},
        "strengths": ["Clear attempt"], "areas_for_improvement": ["Add examples", "Increase depth"],
        "ideal_answer": "A robust answer would include specific technical details and real-world examples.",
        "scores": {"technical_score": score, "confidence_score": 6, "communication_score": 6, "behavioral_score": 5, "overall_score": score},
        "score_explanations": {"technical_explanation": f"Shows {cap} knowledge", "confidence_explanation": "Medium confidence", "communication_explanation": "Clear", "behavioral_explanation": "N/A"},
        "summary_feedback": f"Your answer demonstrates {cap} understanding. Add more specific details."
    }

@app.post("/api/generate-skill-summary")
async def generate_skill_summary(payload: dict):
    skill, history, items = payload.get("skill"), payload.get("history", []), payload.get("evaluations", [])
    prompt = f"Summarize candidate proficiency in {skill} based on history: {json.dumps(history[:3])}. Return JSON: {{ 'skill': '{skill}', 'proficiency_level': '...', 'strengths': [], 'weaknesses': [], 'recommendations': [], 'summary': '...' }}"
    summary = extract_json(call_llm(prompt)) or {"skill": skill, "proficiency_level": "intermediate", "summary": "Assessment complete."}
    return summary

@app.post("/api/final-report")
async def final_report(payload: dict):
    skills, summaries = payload.get("skills", []), payload.get("skillSummaries", [])
    prompt = f"Generate final hiring report for skills: {json.dumps(skills)}. Summaries: {json.dumps(summaries)}. Return JSON: {{ 'overall_score': 0-100, 'overall_proficiency': '...', 'hiring_recommendation': '...', 'summary': '...' }}"
    report = extract_json(call_llm(prompt, max_tokens=3000)) or {"overall_score": 70, "summary": "Interview complete."}
    return report
