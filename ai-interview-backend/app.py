# v2.1.0 - binary media types + supabase PDF storage
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from datetime import datetime
import json
import os
import re
import shutil
import traceback
import logging
import io
import base64
import sys
from dotenv import load_dotenv
from groq import Groq
from typing import List, Dict, Any, Optional, cast
import pdfplumber
import pypdf
from pydantic import BaseModel
from supabase import create_client, Client

# Optional imports for Lambda runtime
try:
    from mangum import Mangum
except ImportError:
    Mangum = None

try:
    import docx
except ImportError:
    docx = None

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request, call_next):
    # Log incoming request
    logger.info(f"Incoming request: {request.method} {request.url}")
    try:
        # Handle OPTIONS preflight directly - before call_next
        if request.method == "OPTIONS":
            return JSONResponse(
                content={},
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, email, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent",
                    "Access-Control-Max-Age": "86400",
                }
            )
        response = await call_next(request)
        # Reinforce CORS headers for every response
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, email, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent"
        return response
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, email, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent",
            }
        )

# ========== SUPABASE CONFIGURATION ==========
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = None
supabase_error = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client initialized successfully")
    except Exception as e:
        supabase_error = str(e)
        print(f"Failed to initialize Supabase: {e}")
else:
    supabase_error = "SUPABASE_URL or SUPABASE_KEY missing"
    print(supabase_error)

# Create data directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    DATA_DIR = "/tmp/data"
else:
    DATA_DIR = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "data"))

RESUMES_DIR = os.path.join(DATA_DIR, "resumes")
PROFILES_FILE = os.path.join(DATA_DIR, "profiles.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

try:
    os.makedirs(RESUMES_DIR, exist_ok=True)
    print(f"Resumes directory ready at: {RESUMES_DIR}")
except Exception as e:
    print(f"Error creating directory: {e}")

# Mount static files to serve resumes
app.mount("/uploads", StaticFiles(directory=RESUMES_DIR), name="uploads")

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

def get_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_history(history):
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)

@app.post("/api/auth")
async def auth(payload: dict):
    auth_type = payload.get("type", "login")
    email = payload.get("email")
    password = payload.get("password")
    name = payload.get("name")
    
    if not email or not password:
        return {"success": False, "error": "Email and password required"}
        
    if supabase:
        try:
            if auth_type == "signup":
                # Check if exists
                res = supabase.table("users").select("*").eq("email", email).execute()
                if res.data: return {"success": False, "error": "User already exists"}
                # Insert
                new_user = {
                    "email": email, "password": password, 
                    "name": name or email.split("@")[0]
                }
                supabase.table("users").insert(new_user).execute()
                # Create profile
                supabase.table("profiles").insert({"email": email}).execute()
                return {"success": True}
            elif auth_type == "login":
                res = supabase.table("users").select("*").eq("email", email).eq("password", password).execute()
                if not res.data: return {"success": False, "error": "Invalid credentials"}
                user = res.data[0]
                return {"success": True, "user": {"id": user.get("id"), "email": user["email"], "name": user.get("name")}}
        except Exception as e:
            logger.error(f"Supabase auth failed: {e}")
            return {"success": False, "error": f"Database Error: {str(e)}"}

    # If in cloud (Lambda) and Supabase is missing, DO NOT fall back to ephemeral storage
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return {
            "success": False, 
            "error": "CRITICAL: Database configuration missing. Please add SUPABASE_URL and SUPABASE_KEY to Amplify environment variables."
        }

    # Fallback to local storage (Only for local development)
    users = cast(List[Dict[str, Any]], get_users())
    if auth_type == "signup":
        if any(u["email"] == email for u in users):
            return {"success": False, "error": "User already exists"}
        new_user = {
            "id": int(datetime.now().timestamp() * 1000),
            "email": email,
            "password": password,
            "name": name or email.split("@")[0],
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
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    if supabase:
        try:
            res = supabase.table("profiles").select("*").eq("email", email).execute()
            if res.data:
                p = res.data[0]
                # Map snake_case to camelCase for frontend
                return {
                    "email": p.get("email"),
                    "resume": p.get("resume"),
                    "parsedResume": p.get("parsed_resume")
                }
        except Exception as e:
            logger.error(f"Supabase get_profile failed: {e}")

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
    
    # Map camelCase from frontend to snake_case for Supabase
    mapped_data = {
        "email": email,
        "resume": payload.get("resume"),
        "parsed_resume": payload.get("parsedResume"),
        "updated_at": datetime.now().isoformat()
    }
    
    if supabase:
        try:
            res = supabase.table("profiles").select("*").eq("email", email).execute()
            if res.data:
                # Merge existing data to preserve resume_base64 if not provided
                existing = res.data[0]
                final_data = {**existing, **{k: v for k, v in mapped_data.items() if v is not None}}
                supabase.table("profiles").update(final_data).eq("email", email).execute()
            else:
                supabase.table("profiles").insert(mapped_data).execute()
            # If we succeeded with Supabase, we can still fall back to local below for redundancy
        except Exception as e:
            logger.error(f"Supabase update_profile failed: {e}")
            return {"success": False, "error": f"Database Error: {str(e)}"}

    # If in cloud (Lambda) and Supabase is missing, DO NOT fall back to ephemeral profile
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return {"success": False, "error": "Database configuration missing. Profile could not be saved."}

    # Fallback to local storage
    try:
        profiles = cast(List[Dict[str, Any]], get_profiles())
        user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
        
        local_data = {
            "email": email,
            "resume": payload.get("resume"),
            "parsedResume": payload.get("parsedResume"),
            "updatedAt": datetime.now().isoformat()
        }
        
        if user_idx > -1:
            # Merge
            profiles[user_idx].update({k: v for k, v in local_data.items() if v is not None})
        else:
            profiles.append(local_data)
        
        save_profiles(profiles)
        return {"success": True}
    except Exception as e:
        logger.error(f"Local profile update failed: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/resume")
async def upload_resume_profile(resume: UploadFile = File(...), email: str = Header(None)):
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    # Save file
    safe_email = email.replace("@", "_").replace(".", "_")
    file_name = f"{safe_email}.pdf"
    file_path = os.path.join(RESUMES_DIR, file_name)
    
    # Ensure directory exists before every save attempt to be super safe
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    try:
        content = await resume.read()
        if len(content) == 0:
            raise Exception("Uploaded file is empty")
            
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        logger.info(f"Successfully saved profile resume for {email} to {file_path} ({len(content)} bytes)")
    except Exception as e:
        logger.error(f"Failed to save profile resume for {email}: {e}")
        raise HTTPException(status_code=500, detail=f"File save error: {str(e)}")
    
    resume_url = f"/api/uploads/{file_name}"
    
    # Base64 encode the PDF for permanent DB storage (bypassing ephemeral /tmp)
    import base64
    b64_content = base64.b64encode(content).decode('ascii')
    
    if supabase:
        try:
            profile_data = {
                "email": email,
                "resume": resume_url,
                "resume_base64": b64_content,
                "parsed_resume": None,
                "updated_at": datetime.now().isoformat()
            }
            res = supabase.table("profiles").select("*").eq("email", email).execute()
            if res.data:
                supabase.table("profiles").update(profile_data).eq("email", email).execute()
            else:
                supabase.table("profiles").insert(profile_data).execute()
        except Exception as e:
            logger.error(f"Supabase upload sync failed: {e}")

    # Update profile
    profiles = get_profiles()
    profile_data = {
        "email": email,
        "resume": resume_url,
        "parsedResume": None,
        "updatedAt": datetime.now().isoformat()
    }
    
    user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
    if user_idx > -1:
        profiles[user_idx] = profile_data
    else:
        profiles.append(profile_data)
        
    save_profiles(profiles)
    
    return {"success": True, "resumeUrl": resume_url}

@app.get("/api/uploads/{filename}")
async def serve_file(filename: str):
    import base64
    from fastapi.responses import Response
    
    # Extract email from filename (e.g., test_example_com.pdf -> test@example.com)
    # The frontend usually requests the file_name generated by upload
    safe_email = filename.replace(".pdf", "")
    
    if supabase:
        try:
            # We must search profiles to find the matching resume
            # Since we replaced '@' and '.' with '_', it's tricky to reverse perfectly,
            # so we'll fetch the profile where resume URL matches
            res = supabase.table("profiles").select("resume_base64").eq("resume", f"/api/uploads/{filename}").execute()
            if res.data and res.data[0].get("resume_base64"):
                b64_content = res.data[0]["resume_base64"]
                pdf_bytes = base64.b64decode(b64_content)
                return Response(content=pdf_bytes, media_type="application/pdf")
        except Exception as e:
            logger.error(f"Supabase serve_file failed: {e}")
            
    # Fallback to local file system if Supabase isn't configured or failed
    file_path = os.path.join(RESUMES_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@app.delete("/api/resume")
async def delete_resume_profile(email: str = Header(None)):
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    # Delete file
    safe_email = email.replace("@", "_").replace(".", "_")
    file_name = f"{safe_email}.pdf"
    file_path = os.path.join(RESUMES_DIR, file_name)
    
    if os.path.exists(file_path):
        os.remove(file_path)
        
    if supabase:
        try:
            update_data = {
                "resume": None,
                "resume_base64": None,
                "parsed_resume": None,
                "updated_at": datetime.now().isoformat()
            }
            supabase.table("profiles").update(update_data).eq("email", email).execute()
        except Exception as e:
            logger.error(f"Supabase delete sync failed: {e}")
    
    # Update profile locally
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
        # We need to create an UploadFile object to reuse upload_and_analyze
        with open(file_path, "rb") as f:
            # Note: upload_and_analyze expects an UploadFile
            # We can just call the logic directly or mock it
            pass
        
        # Let's extract text and call the LLM logic
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



# Clear any proxy settings that Render might be setting
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

# Initialize Groq client lazily
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
        "supabase_connected": bool(supabase),
        "supabase_error": supabase_error,
        "environment": "cloud" if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") else "local",
        "data_dir_exists": os.path.exists(DATA_DIR),
        "resumes_dir_exists": os.path.exists(RESUMES_DIR),
        "timestamp": datetime.now().isoformat()
    }

def call_llm(prompt: str, max_tokens: int = 2000) -> str:
    """Call Groq LLM"""
    client = get_groq_client()
    if not client:
        return "Error: AI not configured. Please set GROQ_API_KEY."
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        return ""

def extract_json(text: str) -> dict:
    """Extract JSON from text with multiple fallback strategies"""
    # Try to find JSON in code blocks
    code_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    code_blocks = re.findall(code_block_pattern, text)
    
    for block in code_blocks:
        try:
            return json.loads(block.strip())
        except:
            continue
    
    # Try to find JSON object
    json_pattern = r'\{[\s\S]*\}'
    matches = re.findall(json_pattern, text)
    
    for match in matches:
        try:
            return json.loads(match)
        except:
            continue
    
    # Try to find array
    array_pattern = r'\[[\s\S]*\]'
    matches = re.findall(array_pattern, text)
    
    for match in matches:
        try:
            result = json.loads(match)
            if isinstance(result, list):
                return {"data": result}
        except:
            continue
    
    return {}

@app.get("/")
def home():
    return {"message": "AI Interview Bot API is running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Backend is running"}

@app.get("/api/history")
async def fetch_history(email: str = Header(None)):
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    if supabase:
        try:
            res = supabase.table("history").select("*").eq("email", email).order("created_at", desc=True).execute()
            return {"history": [r["data"] for r in res.data]}
        except Exception as e:
            logger.error(f"Supabase history fetch failed: {e}")

    # If in cloud (Lambda) and Supabase is missing, DO NOT fall back to ephemeral history
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return {"history": [], "warning": "Database disconnected. Historical data unavailable."}

    history_data = get_history()
    user_history = [h for h in history_data if h.get("email") == email]
    return {"history": user_history}

@app.post("/api/history")
async def add_history(payload: dict, email: str = Header(None)):
    user_email = email or payload.get("email")
    interview = payload.get("interview")
    if not user_email or not interview:
        raise HTTPException(status_code=400, detail="Email and interview data required")
    
    if supabase:
        try:
            supabase.table("history").insert({
                "email": user_email,
                "data": interview,
                "created_at": datetime.now().isoformat()
            }).execute()
        except Exception as e:
            logger.error(f"Supabase history save failed: {e}")
            return {"success": False, "error": f"Database Error: {str(e)}"}

    # If in cloud (Lambda) and Supabase is missing, DO NOT fall back to ephemeral history
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return {"success": False, "error": "Database configuration missing. Interview history could not be saved."}

    # Fallback/Redundancy to local storage
    history_obj = {"email": user_email, "data": interview, "created_at": datetime.now().isoformat()}
    history_data = get_history()
    history_data.append(history_obj)
    save_history(history_data)
    return {"success": True}

@app.post("/api/upload-and-analyze")
async def upload_and_analyze(cv: UploadFile = File(None), resume: UploadFile = File(None)):
    """Analyze CV/Resume using AI to extract skills with experience levels"""
    file_obj = cv or resume
    if not file_obj:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    try:
        content = await file_obj.read()
        filename = file_obj.filename.lower()
        
        if len(content) == 0:
            return {"success": False, "error": "Empty file received. Please try uploading again."}
        
        # Check if content is base64-encoded by API Gateway
        import base64
        file_content = content
        
        # Helper to check if file is base64 or binary
        is_pdf = content[:4] == b'%PDF'
        is_docx = content[:4] == b'PK\x03\x04'
        
        if not (is_pdf or is_docx):
            try:
                decoded = base64.b64decode(content)
                if decoded[:4] == b'%PDF':
                    logger.info("Content was base64 encoded PDF")
                    file_content = decoded
                    is_pdf = True
                elif decoded[:4] == b'PK\x03\x04':
                    logger.info("Content was base64 encoded DOCX")
                    file_content = decoded
                    is_docx = True
            except Exception:
                pass  # Not base64 or failed to decode
        
        text_chunks = []
        image_count = 0
        
        if is_pdf or filename.endswith('.pdf'):
            # 1. Try pdfplumber
            try:
                with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_chunks.append(str(page_text))
                        image_count += len(page.images)
                logger.debug(f"pdfplumber extracted {len(text_chunks)} pages. Images: {image_count}")
            except Exception as e:
                logger.warning(f"pdfplumber failed: {e}")
                
            # 2. Try pypdf fallback
            if not text_chunks:
                try:
                    reader = pypdf.PdfReader(io.BytesIO(file_content))
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_chunks.append(page_text)
                except Exception as e:
                    logger.error(f"pypdf failed: {e}")
        
        elif is_docx or filename.endswith('.docx'):
            try:
                doc = docx.Document(io.BytesIO(file_content))
                for para in doc.paragraphs:
                    if para.text:
                        text_chunks.append(para.text)
                # Also check tables
                for table in doc.tables:
                    for row in table.rows:
                        for cell in row.cells:
                            if cell.text:
                                text_chunks.append(cell.text)
                logger.info(f"docx extracted {len(text_chunks)} chunks")
            except Exception as e:
                logger.error(f"docx parsing failed: {e}")
                return {"success": False, "error": f"Failed to parse Word document: {str(e)}"}
        else:
            return {"success": False, "error": "Unsupported file format. Please upload PDF or DOCX."}
            
        text: str = "\n".join(text_chunks).strip()
        
        if not text:
            logger.warning(f"No text extracted. Images: {image_count}")
            if image_count > 0:
                return {
                    "success": False, 
                    "error": f"Scanned document detected ({image_count} images). This system needs searchable text. Please upload a CV exported from Word/Google Docs."
                }
            return {"success": False, "error": "Could not read document text. Please ensure the file is not corrupted or password-protected."}
            
        prompt = f"""
        Extract technical skills from the candidate's CV.
        
        CV CONTENT:
        {text}
        
        Analyze the text and identify:
        1. Programming languages
        2. Frameworks and Libraries
        3. Developer Tools (Git, Docker, etc.)
        4. Databases (SQL, NoSQL)
        5. Cloud / Infrastructure
        
        For each skill, provide:
        - skill: The canonical name
        - experience_level: (beginner, intermediate, advanced, or expert)
        - category: (language, framework, database, tool, or other)
        - typical_questions: [2 interview questions]
        
        Return the result as a JSON array ONLY. 
        If no technical skills are found, try to infer the most likely skills based on project descriptions.
        DO NOT include skills that are definitely not present.
        """
        
        ai_response = call_llm(prompt, max_tokens=2500)
        logger.info(f"Raw AI Response length: {len(ai_response)}")
        
        # Parse AI response
        try:
            # Try to parse as JSON directly
            matched_skills = json.loads(ai_response)
            if isinstance(matched_skills, dict) and "matched_skills" in matched_skills:
                matched_skills = matched_skills["matched_skills"]
        except:
            # Try to extract JSON using regex
            json_match = re.search(r'\[\s*\{.*\}\s*\]', ai_response, re.DOTALL)
            if json_match:
                try:
                    matched_skills = json.loads(json_match.group())
                except:
                    matched_skills = []
            else:
                # Try to find array in code blocks
                code_match = re.search(r'```(?:json)?\s*(\[[\s\S]*?\])\s*```', ai_response, re.DOTALL)
                if code_match:
                    try:
                        matched_skills = json.loads(code_match.group(1))
                    except:
                        matched_skills = []
                else:
                    matched_skills = []
        
        # If still no skills, use fallback
        if not matched_skills or len(matched_skills) == 0:
            logger.warning("No skills extracted, using fallback")
            matched_skills = get_fallback_skills()
        
        # Ensure each skill has all required fields
        for skill in matched_skills:
            if not isinstance(skill, dict):
                continue
            if "skill" not in skill:
                skill["skill"] = "Unknown Skill"
                
            if "typical_questions" not in skill or not skill["typical_questions"]:
                skill["typical_questions"] = generate_fallback_questions(str(skill["skill"]), str(skill.get("experience_level", "intermediate")))
            if "category" not in skill:
                skill["category"] = categorize_skill(str(skill["skill"]))
            if "experience_level" not in skill:
                skill["experience_level"] = "intermediate"
        
        logger.info(f"Extracted {len(matched_skills)} skills")
        return {"matched_skills": matched_skills}
            
    except Exception as e:
        logger.error(f"CV Analysis Error: {traceback.format_exc()}")
        return {"matched_skills": get_fallback_skills()}

def get_fallback_skills():
    """Return fallback skills list"""
    return [
        {
            "skill": "Python", 
            "experience_level": "intermediate", 
            "category": "language",
            "typical_questions": [
                "Explain Python decorators and when you'd use them",
                "What are list comprehensions and when are they useful?"
            ]
        },
        {
            "skill": "JavaScript", 
            "experience_level": "intermediate", 
            "category": "language",
            "typical_questions": [
                "Explain closures in JavaScript",
                "How does the event loop work?"
            ]
        },
        {
            "skill": "React", 
            "experience_level": "intermediate", 
            "category": "framework",
            "typical_questions": [
                "Explain the virtual DOM and how React uses it",
                "What are React hooks and why were they introduced?"
            ]
        },
        {
            "skill": "Node.js", 
            "experience_level": "intermediate", 
            "category": "framework",
            "typical_questions": [
                "How does the event loop work in Node.js?",
                "Explain middleware in Express.js"
            ]
        },
        {
            "skill": "SQL", 
            "experience_level": "intermediate", 
            "category": "database",
            "typical_questions": [
                "Explain different types of JOINs",
                "What is normalization and why is it important?"
            ]
        },
        {
            "skill": "Git", 
            "experience_level": "intermediate", 
            "category": "tool",
            "typical_questions": [
                "Explain your Git branching strategy",
                "How do you resolve merge conflicts?"
            ]
        }
    ]

def generate_fallback_questions(skill: str, level: str) -> list:
    """Generate fallback questions for a skill"""
    base_questions = {
        "beginner": [
            f"What is {skill} and when would you use it?",
            f"Explain the basic concepts of {skill}"
        ],
        "intermediate": [
            f"What are the most important features of {skill}?",
            f"Explain a challenging problem you solved with {skill}"
        ],
        "advanced": [
            f"Explain advanced optimization techniques in {skill}",
            f"What are the common pitfalls in {skill} and how to avoid them?"
        ],
        "expert": [
            f"Design a complex system using {skill}",
            f"How would you teach {skill} to a junior developer?"
        ]
    }
    level_key = level if level in base_questions else "intermediate"
    return base_questions[level_key]

def categorize_skill(skill: str) -> str:
    """Categorize a skill based on name"""
    skill_lower = skill.lower()
    languages = ['python', 'javascript', 'java', 'typescript', 'c++', 'c#', 'go', 'rust', 'php', 'swift', 'kotlin']
    frameworks = ['react', 'angular', 'vue', 'django', 'flask', 'spring', 'express', 'node', 'next', 'nestjs']
    databases = ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'oracle', 'sqlite', 'cassandra']
    tools = ['git', 'docker', 'kubernetes', 'jenkins', 'aws', 'azure', 'gcp', 'terraform', 'ansible']
    
    if any(lang in skill_lower for lang in languages):
        return "language"
    elif any(fw in skill_lower for fw in frameworks):
        return "framework"
    elif any(db in skill_lower for db in databases):
        return "database"
    elif any(tool in skill_lower for tool in tools):
        return "tool"
    return "other"

@app.post("/api/start-interview")
async def start_interview(payload: dict):
    """Initialize interview with first question"""
    skills = payload.get("skills", [])
    
    if not skills:
        return {"success": False, "error": "No skills provided"}
    
    # Get first skill
    first_skill = skills[0]
    skill_name = first_skill["skill"]
    experience_level = first_skill.get("experience_level", "intermediate")
    
    # Use predefined questions if available
    if "typical_questions" in first_skill and first_skill["typical_questions"]:
        question_text = first_skill["typical_questions"][0]
        question_data = {
            "question": question_text,
            "context": f"Opening question about {skill_name}",
            "expected_depth": experience_level,
            "skill": skill_name,
            "question_type": "opening",
            "follow_up_potential": True
        }
    else:
        # Generate dynamic question
        prompt = f"""
        You are starting a technical interview for a {experience_level} level candidate.
        
        Skill to assess: {skill_name}
        Candidate's estimated level: {experience_level}
        
        Generate a natural, conversational OPENING question that:
        1. Is warm and professional
        2. Asks about their experience with {skill_name}
        3. Encourages them to share a specific project or challenge
        4. Makes them feel comfortable to start talking
        
        Return ONLY this JSON:
        {{
            "question": "Your question here",
            "context": "Brief context",
            "skill": "{skill_name}"
        }}
        """
        
        try:
            ai_response = call_llm(prompt)
            extracted = extract_json(ai_response)
            question_data = {
                "question": extracted.get("question", f"Tell me about your experience with {skill_name}"),
                "context": extracted.get("context", "Opening question"),
                "expected_depth": experience_level,
                "skill": skill_name,
                "question_type": "opening",
                "follow_up_potential": True
            }
        except:
            question_data = {
                "question": f"Let's start with {skill_name}. Could you walk me through a project where you used it? I'm interested in the challenges you faced.",
                "context": "Opening question",
                "expected_depth": experience_level,
                "skill": skill_name,
                "question_type": "opening",
                "follow_up_potential": True
            }
    
    # Create interview session state
    interview_state = {
        "current_skill_index": 0,
        "skills": skills,
        "questions_asked": {skill_name: [question_data]},
        "answers_received": {skill_name: []},
        "evaluations": {skill_name: []},
        "skill_progress": {skill_name: {"questions_asked": 1, "status": "in_progress"}},
        "conversation_flow": {
            skill_name: [{"type": "question", "content": question_data}]
        }
    }
    
    return {
        "success": True,
        "question": question_data,
        "interview_state": interview_state
    }

@app.post("/api/next-question")
async def next_question(payload: dict):
    """
    Dynamically generate the next question based on answer analysis
    """
    skill = payload.get("skill", "")
    previous_answer = payload.get("answer", "")
    previous_question = payload.get("question", "")
    history = payload.get("history", [])
    skills_remaining = payload.get("skills_remaining", [])
    
    if not skill or not previous_answer:
        return {
            "success": False,
            "error": "Missing required fields"
        }
    
    # First, analyze the answer
    analysis_prompt = f"""
    Analyze this candidate's answer for a technical interview.
    
    Skill: {skill}
    Question asked: {previous_question}
    Candidate's answer: {previous_answer}
    
    Analyze deeply and return JSON with:
    1. What concepts did they demonstrate understanding of?
    2. What concepts did they miss or misunderstand?
    3. How deep was their answer? (superficial / moderate / deep / expert)
    4. Did they provide specific examples from experience?
    5. What's their likely true proficiency level? (beginner/intermediate/advanced/expert)
    6. What specific aspect should be explored next?
    
    Return ONLY this JSON:
    {{
        "demonstrated_concepts": ["concept1", "concept2"],
        "missing_concepts": ["concept1", "concept2"],
        "answer_depth": "moderate",
        "had_examples": true,
        "true_proficiency": "intermediate",
        "next_focus": "specific area to probe next"
    }}
    """
    
    try:
        analysis_response = call_llm(analysis_prompt)
        analysis = extract_json(analysis_response)
        if not analysis:
            analysis = {
                "demonstrated_concepts": [],
                "missing_concepts": [],
                "answer_depth": "moderate",
                "had_examples": False,
                "true_proficiency": "intermediate",
                "next_focus": "general"
            }
    except:
        analysis = {
            "demonstrated_concepts": [],
            "missing_concepts": [],
            "answer_depth": "moderate",
            "had_examples": False,
            "true_proficiency": "intermediate",
            "next_focus": "general"
        }
    
    # Determine if we should ask a follow-up or move on
    questions_asked = len([h for h in history if h.get("skill") == skill])
    
    # Decision logic
    should_transition = False
    reason = "Continue exploring"
    
    if questions_asked >= 3 and analysis.get("answer_depth") in ["deep", "expert"]:
        should_transition = True
        reason = "Strong understanding shown, moving to next skill"
    elif questions_asked >= 4:
        should_transition = True
        reason = "Sufficient questions asked for this skill"
    elif analysis.get("answer_depth") == "superficial" and questions_asked >= 3:
        should_transition = True
        reason = "Limited depth, moving on to assess other areas"
    
    # If we should transition and there are more skills
    if should_transition and skills_remaining:
        return {
            "success": True,
            "should_transition": {"transition": True, "reason": reason, "next_skill": skills_remaining[0] if skills_remaining else None},
            "analysis": analysis
        }
    elif should_transition and not skills_remaining:
        return {
            "success": True,
            "should_transition": {"transition": True, "reason": "Interview complete", "complete": True},
            "analysis": analysis
        }
    
    # Generate contextual follow-up question
    question_prompt = f"""
    You're a technical interviewer. Based on this candidate's answer, ask a natural follow-up question.
    
    Skill: {skill}
    Previous question: {previous_question}
    Candidate's answer: {previous_answer}
    
    Analysis:
    - Demonstrated: {analysis.get('demonstrated_concepts', [])}
    - Missing: {analysis.get('missing_concepts', [])}
    - Depth: {analysis.get('answer_depth')}
    - Had examples: {analysis.get('had_examples')}
    - Next focus: {analysis.get('next_focus', 'general')}
    
    Generate a SINGLE follow-up question that:
    1. ACKNOWLEDGES something they said (e.g., "You mentioned X, that's interesting...")
    2. Probes deeper into an area they didn't fully explain
    3. Asks for a specific example if they didn't provide one
    4. Sounds natural and conversational
    
    Return ONLY this JSON:
    {{
        "question": "Your follow-up question",
        "context": "Why you're asking this",
        "focus_area": "what this targets",
        "skill": "{skill}"
    }}
    """
    
    try:
        question_response = call_llm(question_prompt)
        next_question = extract_json(question_response)
        
        if not next_question or "question" not in next_question:
            # Fallback questions based on analysis
            if not analysis.get("had_examples"):
                next_question = {
                    "question": f"You mentioned some aspects of {skill}. Could you share a specific example where you applied it in a real project?",
                    "context": "Asking for concrete example",
                    "focus_area": "examples",
                    "skill": skill
                }
            elif analysis.get("missing_concepts"):
                next_question = {
                    "question": f"Can you elaborate more on {analysis['missing_concepts'][0]}? How does that work in practice?",
                    "context": "Probing missing concept",
                    "focus_area": analysis['missing_concepts'][0],
                    "skill": skill
                }
            else:
                next_question = {
                    "question": f"Based on what you've shared, can you tell me about a challenging problem you solved with {skill}?",
                    "context": "Seeking depth",
                    "focus_area": "challenges",
                    "skill": skill
                }
    except:
        next_question = {
            "question": f"Can you tell me more about your experience with {skill}? What was the most challenging aspect?",
            "context": "Follow-up",
            "focus_area": "general",
            "skill": skill
        }
    
    return {
        "success": True,
        "next_question": next_question,
        "analysis": analysis,
        "should_transition": {"transition": False, "reason": reason}
    }

@app.post("/api/evaluate")
async def evaluate(payload: dict, email: str = Header(None)):
    """
    Comprehensive evaluation of answer with detailed feedback
    """
    question = payload.get("question", "")
    answer = payload.get("answer", "")
    skill = payload.get("skill", "")
    user_email = email or payload.get("email", "unknown")
    
    # Priority for input_type from payload
    input_type = payload.get("input_type")
    if not input_type:
        input_type = "TEXT"
        if "[VIDEO RECORDING" in answer:
            input_type = "VIDEO"
        elif "Voice input" in answer:
            input_type = "VOICE"
    
    vision_context = ""
    frames = payload.get("video_frames", [])
    if input_type == "VIDEO" and frames:
        client = get_groq_client()
        if client:
            try:
                content: list[dict[str, Any]] = [{"type": "text", "text": "Analyze these video frames from an interview. 1. Is the candidate's face clearly visible? 2. Are they making good eye contact with the camera, or looking away? 3. Is the camera covered/blank? Keep it under 30 words focusing strictly on these behavioral aspects."}]
                for f in frames:
                    content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{f}"}})
                v_resp = client.chat.completions.create(
                    model="llama-3.2-11b-vision-preview",
                    messages=[{"role": "user", "content": content}],
                    temperature=0.3,
                    max_tokens=200
                )
                vision_context = f"\nBEHAVIORAL VIDEO ANALYSIS:\n{v_resp.choices[0].message.content.strip()}\n"
            except Exception as e:
                logger.error(f"Vision AI error: {e}")
                vision_context = "\nBEHAVIORAL VIDEO ANALYSIS: Processing error.\n"
        else:
            vision_context = "\nBEHAVIORAL VIDEO ANALYSIS: Vision AI not configured.\n"
    elif input_type == "VIDEO":
        vision_context = "\nBEHAVIORAL VIDEO ANALYSIS: No frames provided.\n"

    prompt = f"""
    You're a technical interviewer evaluating a candidate's answer.
    Your mission is to be a TOUGH and REALISTIC interviewer. Do NOT give high scores for generic or "fluffy" answers.
    
    CONTEXT: {input_type} | SKILL: {skill} | ANSWER: "{answer}"
    Question: {question}
    {vision_context}
    
    STRICT SCORING RULES:
    1. Score ONLY applicable metrics based on input type:
       - If TEXT input: Score Technical + Confidence. (Communication/Behavioral MUST be strictly 0).
       - If VOICE input: Score Technical + Confidence + Communication. (Behavioral MUST be strictly 0).
       - If VIDEO input: Score All 4 (Technical, Confidence, Communication, Behavioral).
    2. LOW QUALITY / "IDK" ANSWERS:
       - If the answer is "i don't know", "idk", or totally irrelevant/empty, Technical score MUST be 0 or 1.
       - NEVER give a passing score (>= 5) for "idk".
    3. TECHNICAL EVALUATION: 
       - If the answer is vague or generic (e.g., "I know React well"), score < 3.
       - If they mention concepts but no details/examples, score 4-5.
       - Score 8+ ONLY for specific, accurate technical demonstration with examples.
    4. BEHAVIORAL EVALUATION (VIDEO ONLY):
       - Use vision context to assess professional presence and eye contact.
    5. OVERALL SCORE CALCULATION: 
       - Calculate the mathematical average of ONLY the scored metrics (ignore metrics that are 0).
       - Ensure the calculated "overall_score" is accurate in the JSON.
    
    Return ONLY this JSON:
    {{
        "evaluation": {{
            "capability": "weak/medium/strong/expert",
            "confidence": "low/medium/high",
            "technical_accuracy": {{
                "correct_concepts": [], "missed_concepts": [], "misunderstood_concepts": []
            }},
            "gaps_identified": {{
                "knowledge_gaps": [], "depth_gaps": [], "example_gaps": ""
            }},
            "experience_indicators": {{
                "had_real_examples": bool, "discussed_challenges": bool, "example_quality": "string", "star_method_used": bool
            }},
            "communication": {{
                "clarity": "string", "structure": "string", "hesitation_markers": bool, "pacing": "string", "filler_words": bool
            }},
            "strengths": [], "areas_for_improvement": [], "ideal_answer": "string",
            "scores": {{
                "technical_score": 0-10, "confidence_score": 0-10, "communication_score": 0-10, "behavioral_score": 0-10, "overall_score": 0-10
            }},
            "score_explanations": {{
                "technical_explanation": "...", "confidence_explanation": "...", "communication_explanation": "...", "behavioral_explanation": "..."
            }},
            "summary_feedback": "..."
        }}
    }}
    """
    
    try:
        ai_response = call_llm(prompt, max_tokens=4000)
        result = extract_json(ai_response)
        
        if result and "evaluation" in result:
            evaluation = result["evaluation"]
        elif result:
            evaluation = result
        else:
            evaluation = generate_fallback_evaluation(answer)
        
        return {"evaluation": evaluation}
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        return {"evaluation": generate_fallback_evaluation(answer)}

def generate_fallback_evaluation(answer: str) -> dict:
    """Generate fallback evaluation"""
    word_count = len(answer.split())
    
    if word_count > 100:
        capability = "strong"
        tech_score = 8
    elif word_count > 50:
        capability = "medium"
        tech_score = 6
    else:
        capability = "weak"
        tech_score = 4
    
    return {
        "capability": capability,
        "confidence": "medium",
        "technical_accuracy": {
            "correct_concepts": ["Basic understanding shown"],
            "missed_concepts": ["Technical depth could be improved"],
            "misunderstood_concepts": []
        },
        "gaps_identified": {
            "knowledge_gaps": ["Missing specific technical details"],
            "depth_gaps": ["Surface-level explanation only"],
            "example_gaps": "No concrete examples provided"
        },
        "experience_indicators": {
            "had_real_examples": word_count > 75,
            "discussed_challenges": False,
            "example_quality": "good" if word_count > 100 else "poor",
            "star_method_used": False
        },
        "communication": {
            "clarity": "high" if word_count > 50 else "medium",
            "structure": "good" if word_count > 75 else "fair",
            "hesitation_markers": False,
            "pacing": "balanced",
            "filler_words": False
        },
        "strengths": ["Attempted to answer the question"],
        "areas_for_improvement": ["Add specific examples", "Include technical details", "Structure answer better"],
        "ideal_answer": "A strong answer should include specific technical details, real-world examples, and demonstrate deep understanding through clear explanation of concepts and their practical application.",
        "scores": {
            "technical_score": tech_score,
            "confidence_score": 6,
            "communication_score": 6,
            "behavioral_score": 5,
            "overall_score": tech_score
        },
        "score_explanations": {
            "technical_explanation": f"Answer shows {capability} technical understanding",
            "confidence_explanation": "Medium confidence based on answer length and detail",
            "communication_explanation": "Communication is adequate but could be clearer",
            "behavioral_explanation": "Limited behavioral/experiential examples provided"
        },
        "summary_feedback": f"Your answer shows {capability} understanding. Try to include more specific technical details and real-world examples."
    }

@app.post("/api/generate-skill-summary")
async def generate_skill_summary(payload: dict):
    """Generate summary for a skill after multiple questions"""
    skill = payload.get("skill", "")
    history = payload.get("history", [])
    evaluations = payload.get("evaluations", [])
    
    prompt = f"""
    Create a summary of the candidate's knowledge for {skill}.
    
    Q&A history: {json.dumps(history, indent=2)[:1000]}
    Evaluations: {json.dumps(evaluations, indent=2)[:1000]}
    
    Return ONLY this JSON:
    {{
        "skill": "{skill}",
        "proficiency_level": "beginner/intermediate/advanced/expert",
        "strengths": ["strength1", "strength2"],
        "weaknesses": ["weakness1", "weakness2"],
        "recommendations": ["rec1", "rec2"],
        "summary": "2-3 sentence summary"
    }}
    """
    
    try:
        ai_response = call_llm(prompt)
        summary = extract_json(ai_response)
        if not summary:
            summary = {
                "skill": skill,
                "proficiency_level": "intermediate",
                "strengths": ["Shows interest"],
                "weaknesses": ["Needs more depth"],
                "recommendations": ["Practice with real projects"],
                "summary": f"Candidate shows basic understanding of {skill}."
            }
        return summary
    except:
        return {
            "skill": skill,
            "proficiency_level": "intermediate",
            "strengths": ["Attempted to answer"],
            "weaknesses": ["Could provide more detail"],
            "recommendations": ["Review fundamentals"],
            "summary": f"Assessment completed for {skill}."
        }

@app.post("/api/final-report")
async def final_report(payload: dict):
    """Generate comprehensive final interview report"""
    skills = payload.get("skills", [])
    skill_summaries = payload.get("skill_summaries", [])
    
    prompt = f"""
    Create a final interview report.
    
    Skills assessed: {json.dumps(skills, indent=2)[:500]}
    Skill summaries: {json.dumps(skill_summaries, indent=2)[:500]}
    
    Return ONLY this JSON:
    {{
        "overall_score": 0-100,
        "overall_proficiency": "junior/mid/senior/lead",
        "technical_strengths": ["strength1", "strength2"],
        "development_areas": ["area1", "area2"],
        "hiring_recommendation": "strong_yes/yes/with_reservations/no",
        "summary": "2-3 sentence overall summary",
        "skill_breakdown": {{
            "skill_name": "proficiency_level"
        }}
    }}
    """
    
    try:
        ai_response = call_llm(prompt, max_tokens=3000)
        report = extract_json(ai_response)
        if not report:
            report = {
                "overall_score": 70,
                "overall_proficiency": "mid",
                "hiring_recommendation": "with_reservations",
                "summary": "Candidate shows potential but needs more depth in key areas."
            }
        return report
    except:
        return {
            "overall_score": 70,
            "overall_proficiency": "mid",
            "hiring_recommendation": "with_reservations",
            "summary": "Interview completed successfully."
        }
# Add handler for AWS Lambda
try:
    handler = Mangum(app)
    print("Mangum handler initialized")
except NameError:
    print("FastAPI app not defined, cannot init Mangum")
except Exception as e:
    print(f"Mangum initialization error: {e}")
