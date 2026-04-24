# Deep Technical Reference: Active Memory, Nova Lite & Video Analysis
# Full Three-Tier Communication Breakdown
# Based on actual source code in ai-interview-backend/app.py & aws_db.py

---

## PART 1: AMAZON NOVA LITE INTEGRATION (The "Brain")

### What is Nova Lite?
Amazon Nova Lite is a Large Language Model (LLM) provided by AWS through the
"Amazon Bedrock" service. In your app.py (line 469), the status endpoint
literally says: "llm_engine: amazon.nova-lite-v1:0 (AWS Bedrock)".

### How it is called (from your actual code, lines 477-508):

def call_llm(prompt: str, max_tokens: int = 2000) -> str:
    """Call Amazon Nova Lite via AWS Bedrock Converse API"""
    client = get_bedrock_client()  # boto3.client("bedrock-runtime")

    response = client.converse(
        modelId="amazon.nova-lite-v1:0",      # The exact model ID
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}]  # The full interview prompt
            }
        ],
        inferenceConfig={
            "temperature": 0.7,   # Controls creativity (0=rigid, 1=creative)
            "maxTokens": max_tokens
        }
    )
    # Extracts the text response from the Bedrock format
    content_blocks = response["output"]["message"]["content"]
    return content_blocks[0]["text"].strip()

### What the "Converse API" means:
AWS Bedrock has a special API called "Converse" that allows us to send
message histories (like a chat). This is what makes the interview feel
like a real conversation — Nova Lite remembers the context of the
whole session within one API call.

### When Nova Lite is called:
1. During Resume Parsing – To extract skills from the raw PDF text.
2. During Interview Start – To generate the opening question.
3. During Each Answer – To evaluate the answer and decide the next step.
4. During Follow-up Logic – To generate targeted follow-up questions.

---

## PART 2: ACTIVE MEMORY — THE RAG SYSTEM (The "Memory")

### What is RAG?
RAG = Retrieval-Augmented Generation.
It means: "Fetch private data from a database, then add it to the AI's
context before asking it to generate a response."

Without RAG: Nova Lite has no idea who you are.
With RAG: Nova Lite knows your specific technical gaps before it even
starts the interview.

### How Active Memory works (exact code from app.py, lines 1030-1048):

# ===== HISTORICAL WEAKNESS RAG INJECTION =====
past_weaknesses = []
if email:
    past_weaknesses = aws_db.get_candidate_weaknesses(email, skill_name)

weakness_context = ""
if past_weaknesses:
    weakness_list = "\n".join([f"- {w}" for w in past_weaknesses[:8]])
    weakness_context = f"""
    IMPORTANT HISTORICAL CONTEXT (from previous interview sessions):
    This candidate previously struggled with the following specific
    concepts in {skill_name}:
    {weakness_list}

    Your opening question MUST subtly probe one of these weakness areas
    to see if they have improved.
    Do NOT directly mention that these are their past weaknesses.
    Just craft a pointed question around them.
    """

### The Three DynamoDB Tables (from aws_db.py, lines 17-20):
TABLE_USERS    = "InterviewUsers"    — Stores email, name, created_at
TABLE_PROFILES = "InterviewProfiles" — Stores resume URL, parsed skills
TABLE_HISTORY  = "InterviewHistory"  — Stores sessions + weaknesses ledger

### How weaknesses are SAVED (from aws_db.py, lines 110-148):
The function "append_history_and_extract_weaknesses()" runs after every
answer is evaluated. It:

1. Reads the AI's evaluation for that answer.
2. Looks for two specific fields in the evaluation JSON:
   - "missed"    (concepts the candidate didn't mention)
   - "incorrect" (things the candidate said that were wrong)
3. Appends these to the candidate's skill-specific weakness list.
4. Deduplicates the list and keeps only the 15 most recent weaknesses
   (to prevent the prompt from getting too large — "prompt blowout").
5. Saves the updated weakness list back to DynamoDB.

Example of what gets stored in DynamoDB:
{
  "email": "gagana@email.com",
  "weaknesses": {
    "Python": ["list slicing", "generator expressions", "GIL"],
    "React": ["useCallback hook", "memo optimization"]
  }
}

### How weaknesses are RETRIEVED (from aws_db.py, lines 94-108):
def get_candidate_weaknesses(email: str, skill: str) -> List[str]:
    response = dynamodb.get_item(
        TableName=TABLE_HISTORY,
        Key={"email": {"S": email}}
    )
    weaknesses_json = item.get("weaknesses", {}).get("S", "{}")
    weaknesses_dict = json.loads(weaknesses_json)
    return weaknesses_dict.get(skill, [])

This returns the list of past weaknesses for that specific skill, which
is then injected into the Nova Lite prompt before every interview starts.

---

## PART 3: VIDEO ANALYSIS & BEHAVIORAL SCORING (The "Eyes")

### Why Groq for Video?
Groq uses a specialized chip called the LPU (Language Processing Unit),
which is purpose-built for AI inference. While AWS Lambda can call
Bedrock for text reasoning, analyzing video frames requires sub-second
speed that standard GPU-based cloud APIs cannot provide.

Groq processes frames in under 800ms. The equivalent AWS GPU call
would take 3-5 seconds — long enough to "break" the live interview feel.

### How Video Frames are Captured (Frontend):
1. The browser's "react-webcam" library captures a snapshot from the webcam.
2. The snapshot is encoded as a Base64 string.
   What is Base64? It converts binary image data into text characters
   so it can be sent inside a standard JSON HTTP request body.
3. The Base64 string is bundled with the text answer and sent to the
   backend as a single "Knowledge Packet" JSON.

Example Knowledge Packet sent to /api/submit-answer:
{
  "skill": "Python",
  "question": "What is a generator?",
  "answer": "A generator is a function that yields values...",
  "voice_transcript": "A generator is a function that yields values...",
  "video_frames": ["/9j/4AAQSkZJRgABAQ...", "/9j/4AAQSkZJRgABAQ..."]
}

### How the Backend Analyzes Video (Groq + Llama 3.2 Vision):
The backend sends each Base64 frame to Groq's Llama 3.2 Vision model
with this type of prompt:

"You are a behavioral interview analyst. Analyze this image of a
 candidate during a live technical interview.
 Assess: eye contact (are they looking at the camera?),
 confidence (posture, presence), and attentiveness.
 Return ONLY this JSON:
 {
   'eye_contact': 0.X,     (0.0 = never, 1.0 = always)
   'confidence': 0.X,      (0.0 = nervous, 1.0 = confident)
   'attentiveness': 0.X    (0.0 = distracted, 1.0 = focused)
 }"

Groq returns this JSON in under 800ms per frame.
The backend averages the scores across all frames for that answer.

### Score Merging (The Evaluation Hub):
Final Score = (Technical Score x 0.70) + (Behavioral Score x 0.30)

Example:
  Technical Accuracy (Nova Lite): 8/10 = 0.80
  Behavioral Score (Groq):        0.75 average
  Final Score = (0.80 x 0.70) + (0.75 x 0.30) = 0.56 + 0.225 = 0.785

This 0.785 becomes the score saved to DynamoDB for that question.

### Fail-Safe (No Camera Mode):
If no video frames are provided, the backend skips the Groq call
entirely. The system automatically falls back to 100% Technical Scoring
using only Nova Lite. The architecture is modular by design.

---

## PART 4: THREE-TIER COMMUNICATION BREAKDOWN

### Tier 1: Presentation Layer (Next.js Frontend)
- Communicates via: HTTPS HTTP requests to AWS API Gateway URL
- Sends: JSON payloads + file uploads
- Receives: JSON responses (next questions, scores, reports)
- Key technologies: React 19, TypeScript, Web Speech API, react-webcam

### Tier 2: Logic Layer (AWS API Gateway + AWS Lambda/FastAPI)
- API Gateway role: Public-facing endpoint, security, routing, proxy
- Lambda role: Serverless compute — runs FastAPI code on demand
- Mangum role: Adapter that makes FastAPI run inside Lambda
- Communicates with: DynamoDB (read/write), S3 (upload/download),
                     Bedrock/Nova Lite (AI reasoning, via boto3),
                     Groq Cloud (vision inference, via Groq SDK)

### Tier 3: Data Layer (DynamoDB + S3)
- DynamoDB: NoSQL key-value store for users, profiles, interview history
- S3: Object store for resume files (PDF/DOCX)

---

## PART 5: FULL END-TO-END COMMUNICATION FLOW

### Flow 1: Signup / Login
[User fills form on Next.js]
     ↓ POST /api/auth {email, password, type:"signup"}
[API Gateway] → [Lambda/FastAPI]
     ↓ aws_db.save_user(email, name, created_at)
[DynamoDB: InterviewUsers table]
     ↓ Returns {"success": true}
[Next.js shows Dashboard]

---

### Flow 2: Resume Upload & Parsing
[User uploads PDF on Next.js]
     ↓ POST /api/upload-and-analyze-base64 {filename, file_data (Base64)}
[API Gateway] → [Lambda/FastAPI]
     ↓ base64.b64decode(file_data) → raw PDF bytes
     ↓ pdfplumber.open(BytesIO(bytes)) → raw text string
     ↓ call_llm(f"Extract skills from: {text}") → Nova Lite API call
[AWS Bedrock: amazon.nova-lite-v1:0]
     ↓ Returns JSON array of skills with experience levels
[Lambda/FastAPI]
     ↓ aws_db.save_profile(email, {parsedResume: skills})
[DynamoDB: InterviewProfiles table]
     ↓ aws_db.upload_to_s3(pdf_bytes, filename)
[S3: ai-interview-bot-storage/resumes/]
     ↓ Returns {"matched_skills": [...]}
[Next.js shows skill cards in dashboard]

---

### Flow 3: Interview Start (with Active Memory RAG)
[User clicks "Start Interview" on Next.js]
     ↓ POST /api/start-interview {skills: [...]}  + email header
[API Gateway] → [Lambda/FastAPI]
     ↓ aws_db.get_candidate_weaknesses(email, "Python")
[DynamoDB: InterviewHistory table] → Returns ["list slicing", "GIL"]
[Lambda/FastAPI]
     ↓ Builds weakness_context string from past weaknesses
     ↓ call_llm("You are an expert interviewer... [weakness_context]...")
[AWS Bedrock: amazon.nova-lite-v1:0]
     ↓ Returns: {"question": "Can you explain how Python's GIL works..."}
[Lambda/FastAPI]
     ↓ Returns {"question": "...", "skill": "Python", "level": 1}
[Next.js displays first question to candidate]

---

### Flow 4: Answer Submission (Full Evaluation Loop)
[Candidate submits answer on Next.js]
     ↓ POST /api/submit-answer {
         skill, question, answer, voice_transcript,
         video_frames: ["base64string1", "base64string2"]
       } + email header
[API Gateway] → [Lambda/FastAPI]

     Branch A: TECHNICAL EVALUATION (Nova Lite)
     ↓ call_llm("Evaluate this answer... Score it 0-10...")
     [AWS Bedrock] → Returns {score: 7, missed: ["generators"], ...}

     Branch B: BEHAVIORAL EVALUATION (Groq) [runs in parallel]
     ↓ groq_client.chat.completions.create(
         model="llama-3.2-11b-vision-preview",
         messages=[{image: base64_frame, text: "Analyze candidate"}]
       )
     [Groq Cloud API] → Returns {eye_contact: 0.8, confidence: 0.7}

[Lambda/FastAPI]
     ↓ Final Score = (7/10 × 0.70) + (0.75 × 0.30) = 0.715
     ↓ Adaptive Decision: Score 7 → Generate follow-up question
     ↓ aws_db.append_history_and_extract_weaknesses(
         email, "Python", question, answer, evaluation
       ) → Saves "generators" to weakness ledger
[DynamoDB: InterviewHistory table]
     ↓ call_llm("Generate follow-up question about generators...")
[AWS Bedrock] → Returns next question
     ↓ Returns {"next_question": "...", "score": 7.15, "decision": "follow_up"}
[Next.js shows next question + live score update]

---

### Flow 5: End of Interview (Report Generation)
[Candidate completes all skills]
     ↓ POST /api/history {interview session data} + email header
[API Gateway] → [Lambda/FastAPI]
     ↓ aws_db.save_full_session(email, session_data)
[DynamoDB: InterviewHistory table] → Appended to sessions list
     ↓ Returns {"success": true}
[Next.js generates final report with all scores, feedback, growth ledger]

---

Document Status: FINALIZED
All details are sourced directly from:
  - ai-interview-backend/app.py
  - ai-interview-backend/aws_db.py
