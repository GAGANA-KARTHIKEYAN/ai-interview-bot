# v3.0.0 - Fully migrated to AWS (DynamoDB + S3) + Historical Weakness RAG
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
from typing import List, Dict, Any, Optional, cast
import pdfplumber
import pypdf
from pydantic import BaseModel
import aws_db

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
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, email, Accept, Origin, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent, X-Requested-With",
                    "Access-Control-Max-Age": "86400",
                }
            )
        response = await call_next(request)
        # Force CORS headers on all successful responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, email, Accept, Origin, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent, X-Requested-With"
        return response
    except Exception as e:
        logger.error(f"CRITICAL ERROR: {e}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e), "msg": "Internal Server Error"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, email, Accept, Origin, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent, X-Requested-With",
            }
        )

# ========== AWS CONFIGURATION ==========
# DynamoDB and S3 are configured via aws_db.py (boto3 uses env vars AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY, AWS_REGION automatically from the environment / Lambda IAM role)
logger.info("Using AWS DynamoDB + S3 for storage (Supabase removed)")

# Create data directories - only in /tmp for Lambda
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    DATA_DIR = "/tmp/data"
else:
    DATA_DIR = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "data"))

RESUMES_DIR = os.path.join(DATA_DIR, "resumes")
PROFILES_FILE = os.path.join(DATA_DIR, "profiles.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

# Ensure directories exist
try:
    os.makedirs(RESUMES_DIR, exist_ok=True)
    logger.info(f"Resumes directory ready at: {RESUMES_DIR}")
except Exception as e:
    logger.error(f"Error creating directory: {e}")

# Root and Health check endpoints
@app.get("/")
async def root():
    return {"message": "AI Interview Bot API is running", "environment": "lambda" if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") else "local"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Mount static files safely
try:
    if os.path.exists(RESUMES_DIR):
        app.mount("/uploads", StaticFiles(directory=RESUMES_DIR), name="uploads")
except Exception as e:
    logger.error(f"Failed to mount static files: {e}")

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
    
    try:
        if auth_type == "signup":
            existing = aws_db.get_user(email)
            if existing:
                return {"success": False, "error": "User already exists"}
            created_at = datetime.now().isoformat()
            aws_db.save_user(email, name or email.split("@")[0], created_at)
            aws_db.save_profile(email, {"email": email, "resume": None, "parsedResume": None})
            return {"success": True}
        elif auth_type == "login":
            # Local fallback: verify user exists + password stored in DynamoDB profile
            user = aws_db.get_user(email)
            if not user:
                return {"success": False, "error": "Invalid credentials"}
            # Simple password check (stored on save)
            stored_pw = aws_db.get_profile(email).get("password", "")
            if stored_pw and stored_pw != password:
                return {"success": False, "error": "Invalid credentials"}
            return {"success": True, "user": {"email": user["email"], "name": user.get("name")}}
    except Exception as e:
        logger.error(f"Auth error: {e}")
        # Fallback to local JSON file for development
        users = cast(List[Dict[str, Any]], get_users())
        if auth_type == "signup":
            if any(u["email"] == email for u in users):
                return {"success": False, "error": "User already exists"}
            new_user = {
                "id": int(datetime.now().timestamp() * 1000),
                "email": email, "password": password,
                "name": name or email.split("@")[0],
                "createdAt": datetime.now().isoformat()
            }
            users.append(new_user)
            save_users(users)
            return {"success": True}
        elif auth_type == "login":
            user = next((u for u in users if u["email"] == email and u["password"] == password), None)
            if not user:
                return {"success": False, "error": "Invalid credentials"}
            return {"success": True, "user": {"id": user["id"], "email": user["email"], "name": user.get("name")}}
    
    return {"success": False, "error": "Invalid type"}

@app.get("/api/profile")
async def get_profile(email: str = Header(None)):
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    try:
        profile = aws_db.get_profile(email)
        if profile:
            return {
                "email": profile.get("email", email),
                "resume": profile.get("resume"),
                "parsedResume": profile.get("parsedResume")
            }
    except Exception as e:
        logger.error(f"DynamoDB get_profile failed: {e}")
    
    # Local fallback
    profiles = get_profiles()
    profile = next((p for p in profiles if p["email"] == email), None)
    if not profile:
        return {"email": email, "resume": None, "parsedResume": None}
    return profile

@app.post("/api/profile")
async def update_profile(payload: dict):
    profile_data = payload.get("profile", payload)
    email = profile_data.get("email") or payload.get("email")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    new_data = {
        "email": email,
        "resume": profile_data.get("resume"),
        "parsedResume": profile_data.get("parsedResume", profile_data.get("parsed_resume")),
        "updated_at": datetime.now().isoformat()
    }
    
    try:
        existing = aws_db.get_profile(email) or {}
        merged = {**existing, **{k: v for k, v in new_data.items() if v is not None}}
        aws_db.save_profile(email, merged)
        return {"success": True}
    except Exception as e:
        logger.error(f"DynamoDB update_profile failed: {e}")
        # Local fallback
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
                profiles[user_idx].update({k: v for k, v in local_data.items() if v is not None})
            else:
                profiles.append(local_data)
            save_profiles(profiles)
            return {"success": True}
        except Exception as e2:
            return {"success": False, "error": str(e2)}

@app.post("/api/resume")
async def upload_resume_profile(resume: UploadFile = File(...), email: str = Header(None)):
    if not email:
        raise HTTPException(status_code=400, detail="Email header required")
    
    safe_email = email.replace("@", "_").replace(".", "_")
    file_name = f"{safe_email}.pdf"
    
    try:
        content = await resume.read()
        if len(content) == 0:
            raise Exception("Uploaded file is empty")
        
        # Upload to S3
        s3_url = aws_db.upload_to_s3(content, file_name, content_type="application/pdf")
        resume_url = f"/api/uploads/{file_name}"
        
        # Update profile in DynamoDB
        existing = aws_db.get_profile(email) or {}
        existing.update({
            "email": email,
            "resume": resume_url,
            "s3_url": s3_url,
            "parsedResume": None,
            "updated_at": datetime.now().isoformat()
        })
        aws_db.save_profile(email, existing)
        
        logger.info(f"Resume for {email} uploaded to S3: {s3_url}")
        return {"success": True, "resumeUrl": resume_url}
    except Exception as e:
        logger.error(f"Resume upload failed: {e}")
        # Local fallback: save to disk
        file_path = os.path.join(RESUMES_DIR, file_name)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        try:
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            resume_url = f"/api/uploads/{file_name}"
            profiles = get_profiles()
            profile_data = {"email": email, "resume": resume_url, "parsedResume": None}
            user_idx = next((i for i, p in enumerate(profiles) if p["email"] == email), -1)
            if user_idx > -1:
                profiles[user_idx] = profile_data
            else:
                profiles.append(profile_data)
            save_profiles(profiles)
            return {"success": True, "resumeUrl": resume_url}
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"File save error: {str(e2)}")

@app.get("/api/uploads/{filename}")
async def serve_file(filename: str):
    from fastapi.responses import Response
    
    # Try to fetch from S3
    try:
        s3 = aws_db.s3
        response = s3.get_object(Bucket=aws_db.S3_BUCKET_NAME, Key=f"resumes/{filename}")
        pdf_bytes = response["Body"].read()
        return Response(content=pdf_bytes, media_type="application/pdf")
    except Exception as e:
        logger.warning(f"S3 fetch failed, trying local: {e}")
    
    # Fallback to local file system
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
    
    # Delete from S3
    try:
        aws_db.s3.delete_object(Bucket=aws_db.S3_BUCKET_NAME, Key=f"resumes/{file_name}")
    except Exception as e:
        logger.warning(f"S3 delete failed: {e}")
    
    # Delete from local disk (if exists)
    file_path = os.path.join(RESUMES_DIR, file_name)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Clear from DynamoDB profile
    try:
        existing = aws_db.get_profile(email) or {}
        existing.update({"resume": None, "s3_url": None, "parsedResume": None})
        aws_db.save_profile(email, existing)
    except Exception as e:
        logger.warning(f"DynamoDB profile clear failed: {e}")
    
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

# Initialize AWS Bedrock client lazily
def get_bedrock_client():
    try:
        import boto3
        
        region = os.environ.get("APP_REGION", "us-east-1")
        # Ensure we are using the region that has model access enabled
        return boto3.client("bedrock-runtime", region_name=region)
    except Exception as e:
        logger.error(f"Failed to initialize Bedrock client: {e}")
        return None

@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "llm_engine": "amazon.nova-lite-v1:0 (AWS Bedrock)",
        "storage_backend": "AWS DynamoDB + S3",
        "environment": "cloud" if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") else "local",
        "data_dir_exists": os.path.exists(DATA_DIR),
        "resumes_dir_exists": os.path.exists(RESUMES_DIR),
        "timestamp": datetime.now().isoformat()
    }

def call_llm(prompt: str, max_tokens: int = 2000) -> str:
    """Call Amazon Nova Lite via AWS Bedrock Converse API"""
    client = get_bedrock_client()
    if not client:
        return "Error: AI Bedrock runtime not configured properly."
    
    try:
        response = client.converse(
            modelId="amazon.nova-lite-v1:0",
            messages=[
                {
                    "role": "user",
                    "content": [{"text": prompt}]
                }
            ],
            inferenceConfig={
                "temperature": 0.7,
                "maxTokens": max_tokens
            }
        )
        
        # Bedrock Converse API response format
        output_message = response.get("output", {}).get("message", {})
        content_blocks = output_message.get("content", [])
        
        if content_blocks and len(content_blocks) > 0:
            return content_blocks[0].get("text", "").strip()
            
        return ""
    except Exception as e:
        logger.error(f"Bedrock LLM Error: {e}")
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
    
    try:
        sessions = aws_db.get_history(email)
        return {"history": sessions}
    except Exception as e:
        logger.error(f"DynamoDB history fetch failed: {e}")
        # Local fallback
        history_data = get_history()
        user_history = [h for h in history_data if h.get("email") == email]
        return {"history": user_history}

@app.post("/api/history")
async def add_history(payload: dict, email: str = Header(None)):
    user_email = email or payload.get("email")
    interview = payload.get("interview")
    if not user_email or not interview:
        raise HTTPException(status_code=400, detail="Email and interview data required")
    
    try:
        aws_db.save_full_session(
            email=user_email,
            session_data=interview
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"DynamoDB history save failed: {e}")
        # Local fallback
        history_obj = {"email": user_email, "data": interview, "created_at": datetime.now().isoformat()}
        history_data = get_history()
        history_data.append(history_obj)
        save_history(history_data)
        return {"success": True}

class UploadBase64Payload(BaseModel):
    filename: str
    file_data: str # base64 string
    email: str = None

@app.post("/api/upload-and-analyze-base64")
async def upload_and_analyze_base64(payload: UploadBase64Payload):
    """Analyze CV/Resume using AI by receiving base64 JSON (Fix API Gateway Multipart issues)"""
    try:
        # Strip header if data URI scheme was included (e.g. data:application/pdf;base64,...)
        base64_data = payload.file_data
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]
            
        content = base64.b64decode(base64_data)
        filename = payload.filename.lower()
        
        if len(content) == 0:
            return {"success": False, "error": "Empty file received. Please try uploading again."}
            
        # Helper to check if file is base64 or binary
        is_pdf = content[:4] == b'%PDF'
        is_docx = content[:4] == b'PK\x03\x04'
        
        text_chunks = []
        image_count = 0
        
        if is_pdf or filename.endswith('.pdf'):
            # 1. Try pdfplumber
            try:
                with pdfplumber.open(io.BytesIO(content)) as pdf:
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
                    reader = pypdf.PdfReader(io.BytesIO(content))
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_chunks.append(page_text)
                except Exception as e:
                    logger.error(f"pypdf failed: {e}")
        
        elif is_docx or filename.endswith('.docx'):
            try:
                doc = docx.Document(io.BytesIO(content))
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
            
        text = "\n".join(text_chunks).strip()
        
        if not text:
            logger.warning(f"No text extracted. Images: {image_count}")
            if image_count > 0:
                return {
                    "success": False, 
                    "error": f"Scanned document detected ({image_count} images). This system needs searchable text. Please upload a CV exported from Word/Google Docs."
                }
            return {"success": False, "error": "Could not read document text. Please ensure the file is not corrupted or password-protected."}
            
        prompt = f'''
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
        '''
        
        ai_response = call_llm(prompt, max_tokens=2500)
        logger.info(f"Raw AI Response length: {len(ai_response)}")
        
        # Parse AI response
        try:
            matched_skills = json.loads(ai_response)
            if isinstance(matched_skills, dict) and "matched_skills" in matched_skills:
                matched_skills = matched_skills["matched_skills"]
        except:
            json_match = re.search(r'\[\s*\{.*\}\s*\]', ai_response, re.DOTALL)
            if json_match:
                try:
                    matched_skills = json.loads(json_match.group())
                except:
                    matched_skills = []
            else:
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
        logger.error(f"CV Base64 Analysis Error: {traceback.format_exc()}")
        return {"matched_skills": get_fallback_skills()}

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
async def start_interview(payload: dict, email: str = Header(None)):
    """Initialize interview with first question — with Historical Weakness RAG injection"""
    skills = payload.get("skills", [])
    
    if not skills:
        return {"success": False, "error": "No skills provided"}
    
    first_skill = skills[0]
    skill_name = first_skill["skill"]
    experience_level = first_skill.get("experience_level", "intermediate")
    
    # ===== HISTORICAL WEAKNESS RAG INJECTION =====
    past_weaknesses = []
    if email:
        try:
            past_weaknesses = aws_db.get_candidate_weaknesses(email, skill_name)
        except Exception as e:
            logger.warning(f"Could not retrieve weakness history for RAG: {e}")
    
    weakness_context = ""
    if past_weaknesses:
        weakness_list = "\n".join([f"- {w}" for w in past_weaknesses[:8]])
        weakness_context = f"""
    IMPORTANT HISTORICAL CONTEXT (from previous interview sessions):
    This candidate previously struggled with the following specific concepts in {skill_name}:
{weakness_list}
    
    Your opening question MUST subtly probe one of these weakness areas to see if they have improved.
    Do NOT directly mention that these are their past weaknesses. Just craft a pointed question around them.
    """
    
    if "typical_questions" in first_skill and first_skill["typical_questions"] and not past_weaknesses:
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
        prompt = f"""
        You are starting a technical interview for a {experience_level} level candidate.
        
        Skill to assess: {skill_name}
        Candidate's estimated level: {experience_level}
        {weakness_context}
        
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

@app.post("/api/submit-answer")
async def submit_answer_consolidated(payload: dict, email: str = Header(None)):
    """
    SINGLE SOURCE OF TRUTH: One LLM call for Evaluation + Decision + Next Question
    """
    skill = payload.get("skill", "")
    answer = payload.get("answer", "")
    question = payload.get("question", "")
    history = payload.get("history", [])
    skills_remaining = payload.get("skills_remaining", [])
    input_type = payload.get("input_type", "TEXT")
    frames = payload.get("video_frames", [])

    if not skill or not answer or not question:
        raise HTTPException(status_code=400, detail="Missing required fields")

    # 1. Behavioral Analysis (if video)
    vision_context = ""
    if input_type == "VIDEO" and frames:
        client = get_groq_client()
        if client:
            try:
                content = [{"type": "text", "text": "Analyze behavioral aspects: face visibility, eye contact, professional presence. Under 30 words."}]
                for f in frames[:3]: # Limit frames to save tokens
                    content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{f}"}})
                v_resp = client.chat.completions.create(
                    model="llama-3.2-11b-vision-preview",
                    messages=[{"role": "user", "content": content}],
                    temperature=0.3,
                    max_tokens=200
                )
                vision_context = f"VIDEO ANALYSIS: {v_resp.choices[0].message.content.strip()}"
            except Exception as e:
                logger.error(f"Vision error: {e}")
                vision_context = "VIDEO ANALYSIS: Error processing frames."

    # 2. Level and Attempt Tracking
    current_level = payload.get("level", 1)
    attempt_count = 1
    for h in reversed(history):
        if h.get("skill") == skill and h.get("question") == question:
            attempt_count += 1
        else:
            if h.get("skill") == skill: break

    # 3. CONSOLIDATED PROMPT (Adaptive Level-Based)
    skill_history = [h.get("question") for h in history if h.get("skill") == skill]
    
    prompt = f"""
    You are an expert technical interviewer conducting a skill-based adaptive interview.
    Your goal is to evaluate the FULL depth of the skill "{skill}".

    LEVEL-BASED MODEL:
    Level 1: Basic understanding / definitions.
    Level 2: Conceptual depth / internal mechanics.
    Level 3: Practical application / real-world trade-offs / architecture.
    Level 4: Advanced mastery / edge cases / complex optimization.

    ADAPTIVE LOGIC:
    - START at Level {current_level}.
    - MAX QUESTIONS PER SKILL: 4. Total questions answered for "{skill}": {len(skill_history)}. 
      *RULE*: If {len(skill_history)} >= 4, you MUST set action to "move_next".
    
    - If Answer is HIGH quality:
      * ACTION: "level_up" or "move_next". Move to a SIGNIFICANTLY deeper or different area.
      * YOU MUST NOT REPEAT any of {skill_history}.
    
    - If Answer is MEDIUM quality (Correct but lacks detail):
      * ACTION: "probe" or "level_up". 
      * **CRITICAL**: DO NOT repeat "{question}". Move directly to a DIFFERENT TOPIC within "{skill}" to assess breadth.
    
    - If Answer is LOW quality: 
      * Attempt 1 for this question: Action: "retry". Rephrase and explain what was missing.
      * Attempt 2 for this question: Action: "hint". Provide a technical hint for "{question}".
      * Attempt 3 or if Answer is detailed (>40 words): Action: "probe" or "move_next". **FORCE A CHANGE**. Move to a COMPLETELY DIFFERENT topic within "{skill}" or the next skill.

    - **PROGRESSION RULE**: The interview MUST NOT get stuck. If a user is struggling with one specific concept, move to a different one to see if they understand other parts of the skill.

    - **CRITICAL SYNC RULE**: Each turn MUST advance the conversation. Use "move_next" to transition to skills in `skills_remaining`.
    - SYNC CHECK: The "feedback_to_user" field is conversational. The "next_question" field is the actual technical task.

    CONTEXT:
    - Current Skill: {skill}
    - Current Level: {current_level}/4
    - Current Question: {question}
    - Candidate Answer: "{answer}"
    - Attempt Count for THIS specific question: {attempt_count}
    - {vision_context}
    
    OUTPUT FORMAT (JSON ONLY):
    {{
      "action": "retry | hint | probe | level_up | level_down | move_next",
      "skill": "{skill}",
      "level": 1-4,
      "feedback_to_user": "Short, natural transition or correction based on the candidate's last answer.",
      "next_question": "The actual technical question to be displayed (only one).",
      "evaluation": {{
        "quality": "low | medium | high",
        "understanding": "incorrect | partial | correct",
        "confidence": "low | medium | high",
        "scores": {{
          "technical": 0-10,
          "confidence": 0-10,
          "communication": 0-10,
          "behavioral": 0-10,
          "overall_score": 0-10
        }},
        "technical_accuracy": {{
          "correct": ["List specific technical keywords, patterns, or formulas mentioned correctly by the candidate. MINIMUM 2 items."],
          "missed": ["List specific technical details or nuances that were missing but expected for a high-quality answer."],
          "incorrect": ["List any technical inaccuracies or misstatements."]
        }},
        "strengths": ["list of behavioral or general technical strengths"],
        "weaknesses": ["list of behavioral or general technical weaknesses"],
        "improvement_tips": ["Actionable advice for the candidate"]
      }}
    }}

    **TECHNICAL EXTRACTION RULES**: 
    - You MUST identify specific technical nouns/concepts (e.g., "Virtual DOM", "CAP Theorem", "Hydration", "Event Loop"). 
    - DO NOT return empty lists for "correct" if the candidate showed ANY understanding. 
    - Be specific. Instead of "answered correctly", use "Correctly explained state persistence using LocalStorage".
    - **MANDATORY**: Your JSON response MUST explicitly include the "technical_accuracy" object exactly as shown, with "correct", "missed", and "incorrect" arrays. Do not skip this field.

    SYNC RULE: 
    - The "feedback_to_user" should contain your FULL evaluation. If the candidate missed something or you want them to elaborate, explain exactly what they missed and ask them to provide more detail HERE in the feedback.
    - **CRITICAL**: The "next_question" must be a pure, standalone technical question. DO NOT put conversational filler, corrections, or phrases like "You missed X, so can you elaborate?" in "next_question". It must be ONLY the technical prompt.
    - If the "feedback_to_user" and "next_question" are combined by the UI, they must not result in redundant sentences.
    """

    try:
        ai_response = call_llm(prompt, max_tokens=3000)
        result = extract_json(ai_response)
        
        # Default level fallback
        if "level" not in result:
            result["level"] = current_level

        # Force move action if max questions reached (max 3 questions -> len(skill_history) >= 2)
        if len(skill_history) >= 2 and result.get("action") != "move_next":
            result["action"] = "move_next"
            if "feedback_to_user" not in result or len(str(result.get("feedback_to_user", ""))) < 5:
                result["feedback_to_user"] = "You've provided enough detail on this topic. Let's move on to the next skill."
            result["next_question"] = ""

        # Guarantee evaluation block is never missing
        if "evaluation" not in result or not isinstance(result["evaluation"], dict):
            result["evaluation"] = {}
            
        eval_dict = result["evaluation"]
        eval_dict["quality"] = eval_dict.get("quality", "medium")
        eval_dict["understanding"] = eval_dict.get("understanding", "partial")
        eval_dict["confidence"] = eval_dict.get("confidence", "medium")
        
        if "scores" not in eval_dict or not isinstance(eval_dict["scores"], dict):
            eval_dict["scores"] = {"overall_score": 5, "technical": 5}
        if "technical_accuracy" not in eval_dict or not isinstance(eval_dict["technical_accuracy"], dict):
            eval_dict["technical_accuracy"] = {"correct": ["(System: LLM skipped technical extraction)"], "missed": [], "incorrect": []}

        # Ensure scores are clamped between 0 and 10 and format is clean
        for k, v in list(eval_dict["scores"].items()):
            if isinstance(v, (int, float)):
                eval_dict["scores"][k] = max(0, min(10, int(v)))
            elif isinstance(v, str):
                try:
                    num = float(v.split('/')[0].strip())
                    eval_dict["scores"][k] = max(0, min(10, int(num)))
                except (ValueError, TypeError):
                    eval_dict["scores"][k] = 5

        # Logic for skill transition
        should_transition = {"transition": False}
        if result.get("action") == "move_next":
            if skills_remaining:
                should_transition = {
                    "transition": True,
                    "reason": "Concluding skill exploration",
                    "next_skill": skills_remaining[0],
                    "complete": False
                }
            else:
                should_transition = {"transition": True, "reason": "Interview complete", "complete": True}
            
            # CRITICAL: Prevent the LLM from leaking "I have no questions" as the next technical question.
            result["next_question"] = ""

        # ===== HISTORICAL WEAKNESS RAG: Save weaknesses to DynamoDB =====
        # Fire-and-forget: don't block the response if DynamoDB is unavailable
        if email:
            try:
                aws_db.append_history_and_extract_weaknesses(
                    email=email,
                    skill=skill,
                    question=question,
                    answer=answer,
                    evaluation=eval_dict
                )
            except Exception as rag_err:
                logger.warning(f"RAG weakness save failed (non-blocking): {rag_err}")

        return {
            "success": True,
            "evaluation": result.get("evaluation", {}),
            "decision": {
                "action": result.get("action"),
                "feedback_to_user": result.get("feedback_to_user"),
                "next_question": result.get("next_question"),
                "level": result.get("level")
            },
            "should_transition": should_transition,
            "attempt_count": attempt_count
        }
    except Exception as e:
        logger.error(f"Level-based logic error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/next-question")
async def next_question(payload: dict):
    """
    Expert AI Interviewer decision logic
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
    
    # Calculate attempt_count for the current question
    # We look back in history at how many times the SAME question text was asked for this skill
    attempt_count = 1
    for h in reversed(history):
        if h.get("skill") == skill and h.get("question") == previous_question:
            attempt_count += 1
        else:
            # Once we see a different question for this skill, we stop counting attempts for the 'current' one
            if h.get("skill") == skill:
                break

    decision_prompt = f"""
    You are an expert AI interviewer. Follow these CORE RULES strictly:
    
    1. DO NOT assume meaning from weak answers like "idk" or "not sure".
    2. DO NOT move next on a single weak attempt.
    3. Attempt 1 (weak) -> Retry (encourage/rephrase)
    4. Attempt 2 (weak) -> Hint (guide/simplify)
    5. Attempt 3 (weak) -> Move Next (conclude weak)
    
    CURRENT CONTEXT:
    - Skill: {skill}
    - Question asked: {previous_question}
    - Candidate's answer: {previous_answer}
    - Attempt number for this specific question: {attempt_count}
    
    DECISION LOGIC:
    - Evaluate quality: low / medium / high
    - If low quality + attempt < 3: decide 'retry' or 'hint'.
    - If low quality + attempt >= 3: decide 'move_next'.
    - If medium/high quality: decide 'probe' (deeper) or 'move_next' (if satisfied).
    
    OUTPUT FORMAT (JSON ONLY):
    {{
      "action": "retry | hint | move_next | probe",
      "response": "Your natural, supportive interviewer response",
      "question": "The next or same question (ONLY ONE)"
    }}
    
    DECISION GUIDELINES:
    - If "retry" or "hint": keep the NEXT question the SAME as the current one (maybe slightly rephrased). Use this ONLY if the answer was truly missing technical depth or explicitly "idk".
    - If "probe" or "level_up": generate a NEW, more challenging question for the SAME skill. **CRITICAL: DO NOT repeat the current question text.**
    - If "move_next": switch focus to the next skill area in `skills_remaining`.
    - **CRITICAL**: If the candidate provided a strong/expert answer, you MUST "level_up" or "move_next". DO NOT "retry" or "hint" on strong answers.
    - If next skill is needed, and skills_remaining is {skills_remaining}, transition naturally.
    """
    
    try:
        ai_response = call_llm(decision_prompt)
        decision = extract_json(ai_response)
        
        if not decision or "action" not in decision:
            raise ValueError("Invalid AI decision format")
            
        # Determine transition if move_next suggests a new skill
        should_transition = {"transition": False}
        if decision["action"] == "move_next":
            # If the AI says move_next, and we have skills remaining, we might transition
            # This is partly handled by the prompt, but we reinforce it here
            if skills_remaining and (attempt_count >= 3 or "next skill" in decision.get("response", "").lower()):
                should_transition = {
                    "transition": True, 
                    "reason": "Moving to next skill area",
                    "next_skill": skills_remaining[0],
                    "complete": False
                }
            elif not skills_remaining and (attempt_count >= 3 or "complete" in decision.get("response", "").lower()):
                 should_transition = {
                    "transition": True, 
                    "reason": "Interview complete",
                    "complete": True
                }

        return {
            "success": True,
            "action": decision["action"],
            "response": decision["response"],
            "next_question": {
                "question": decision["question"],
                "skill": skill
            },
            "should_transition": should_transition,
            "attempt_count": attempt_count
        }

    except Exception as e:
        logger.error(f"Decision logic error: {e}")
        # Robust fallback
        return {
            "success": True,
            "action": "move_next",
            "response": "That's helpful. Let's move on to explore another area.",
            "next_question": {
                "question": f"Can you tell me about your experience with {skills_remaining[0] if skills_remaining else 'the next topic'}?",
                "skill": skills_remaining[0] if skills_remaining else skill
            },
            "should_transition": {"transition": True, "next_skill": skills_remaining[0] if skills_remaining else None, "complete": not skills_remaining}
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
    You are an expert AI interviewer evaluating a candidate's technical answer.
    Your behavior must be natural, fair, and consistent. AVOID HALLUCINATIONS.
    
    CORE EVALUATION RULES:
    1. DO NOT assume meaning from weak or unclear answers (e.g., "idk", "not sure").
    2. If the answer is filler or ignorance, the Technical Score MUST BE 0.
    3. Score ONLY applicable metrics based on {input_type}:
       - TEXT: Technical + Confidence (others 0).
       - VOICE: Technical + Confidence + Communication (behavioral 0).
       - VIDEO: Score All 4.
    
    CONTEXT:
    - Input Type: {input_type}
    - Skill: {skill}
    - Question: {question}
    - Candidate Answer: "{answer}"
    {vision_context}
    
    STRICT SCORING (1-10):
    - 0-2: Admitted ignorance, totally wrong, or filler only.
    - 3-5: Mentioned concepts but no depth or examples.
    - 6-7: Good understanding, some gaps.
    - 8-10: Expert-level demonstration with specific real-world examples.
    
    Return ONLY valid JSON:
    {{
        "evaluation": {{
            "capability": "weak/medium/strong/expert",
            "technical_accuracy": {{ "correct": [], "missed": [], "incorrect": [] }},
            "scores": {{ "technical_score": 0-10, "confidence_score": 0-10, "communication_score": 0-10, "behavioral_score": 0-10, "overall_score": 0-10 }},
            "summary_feedback": "Your concise, professional interviewer feedback to the candidate. Do not hallucinate intent.",
            "ideal_answer": "..."
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
            
        # Ensure scores are clamped between 0 and 10
        if isinstance(evaluation, dict) and "scores" in evaluation and isinstance(evaluation["scores"], dict):
            for k, v in list(evaluation["scores"].items()):
                if isinstance(v, (int, float)):
                    evaluation["scores"][k] = max(0, min(10, int(v)))
                elif isinstance(v, str):
                    try:
                        num = float(v.split('/')[0].strip())
                        evaluation["scores"][k] = max(0, min(10, int(num)))
                    except (ValueError, TypeError):
                        evaluation["scores"][k] = 5
        
        return {"evaluation": evaluation}
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        return {"evaluation": generate_fallback_evaluation(answer)}

def generate_fallback_evaluation(answer: str) -> dict:
    """Generate fallback evaluation"""
    ans_lower = answer.lower().strip()
    
    # Strictly handle IDK / empty cases in fallback
    if not ans_lower or ans_lower in ["idk", "i dont know", "i don't know", "pass", "not sure", "no idea"]:
        return {
            "capability": "weak",
            "confidence": "low",
            "technical_accuracy": {
                "correct_concepts": [],
                "missed_concepts": ["Did not attempt to answer"],
                "misunderstood_concepts": []
            },
            "gaps_identified": {
                "knowledge_gaps": ["Complete knowledge gap on this topic"],
                "depth_gaps": ["No depth provided"],
                "example_gaps": "No concrete examples provided"
            },
            "experience_indicators": {
                "had_real_examples": False,
                "discussed_challenges": False,
                "example_quality": "none",
                "star_method_used": False
            },
            "communication": {
                "clarity": "low",
                "structure": "poor",
                "hesitation_markers": True,
                "pacing": "poor",
                "filler_words": True
            },
            "strengths": [],
            "areas_for_improvement": ["Need to study this specific topic", "Attempt to reason through the problem even if unsure"],
            "ideal_answer": "A strong answer demonstrates clear understanding and provides examples.",
            "scores": {
                "technical_score": 0,
                "confidence_score": 0,
                "communication_score": 0,
                "behavioral_score": 0,
                "overall_score": 0
            },
            "score_explanations": {
                "technical_explanation": "Candidate did not know the answer.",
                "confidence_explanation": "Low confidence.",
                "communication_explanation": "No meaningful communication.",
                "behavioral_explanation": "N/A"
            },
            "summary_feedback": "You were unable to answer this question. Review the core concepts and try to provide partial knowledge if you don't know the exact answer."
        }
        
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
    if Mangum is not None:
        handler = Mangum(app, lifespan="off")
        logger.info("Mangum handler initialized")
    else:
        logger.warning("Mangum not found, handler not initialized")
        def handler(event, context):
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "Mangum not available"})
            }
except Exception as e:
    logger.error(f"Mangum initialization error: {e}")
    def handler(event, context):
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
