# Complete Project Reference: End-to-End, CIE-2 Changes & Test Cases
# AI Interview Bot — RV University Mini Project (Phase 3)
# Based directly on source code: app.py, aws_db.py, Presentation_Content.md

==========================================================================
SECTION 1: FULL END-TO-END EXPLANATION — WHAT, HOW, AND WHY
==========================================================================

## STEP 1: USER SIGNUP & LOGIN
---
WHAT: The candidate creates an account using their email and password.
HOW:  The frontend sends a POST to /api/auth with {email, password, type:"signup"}.
      FastAPI calls aws_db.save_user() which stores the email and name in the
      DynamoDB "InterviewUsers" table. It also creates an empty profile in the
      "InterviewProfiles" table.
WHY:  We need a persistent identity tied to each candidate across multiple sessions
      so the Active Memory system can track their improvement over time.

## STEP 2: RESUME UPLOAD
---
WHAT: The candidate uploads their PDF or DOCX resume.
HOW:  The frontend converts the file to a Base64 string and sends it to
      /api/upload-and-analyze-base64.

      The backend:
        1. Decodes the Base64 string back to raw bytes.
        2. Checks the magic bytes: b'%PDF' for PDF, b'PK\x03\x04' for DOCX.
        3. Uses pdfplumber to open the PDF and extract text page-by-page.
           (Fallback: pypdf if pdfplumber fails. Fallback for DOCX: python-docx)
        4. Uploads the raw bytes to AWS S3 bucket "ai-interview-bot-storage"
           under the "resumes/" folder.
        5. Saves the S3 URL to the DynamoDB ProfileS table.

WHY:  S3 is used for file storage (not DynamoDB) because NoSQL databases
      are not designed for binary file storage. S3 is designed for objects
      and provides 99.999999999% durability — the file is never lost.

## STEP 3: SKILL EXTRACTION (AI-DRIVEN PARSING)
---
WHAT: The raw CV text is sent to an AI model which extracts the candidate's
      technical skills.
HOW:  The backend builds this prompt and sends it to Nova Lite (Bedrock):

      "Extract technical skills from this CV text: [text]
       For each skill, return:
       - skill name
       - experience_level (beginner/intermediate/advanced/expert)
       - category (language/framework/database/tool)
       - typical_questions: [2 questions]
       Return as a JSON array ONLY."

      Nova Lite returns a JSON array. The backend parses it using regex
      and json.loads() with multiple fallback strategies.

WHY:  Skill extraction is the foundation of the entire interview. Without it,
      the bot has nothing to ask about. An AI-driven extraction is more accurate
      than simple keyword matching because it understands context
      (e.g., "I used React to build the frontend" → React = framework).

## STEP 4: ACTIVE MEMORY CHECK (Historical Weakness RAG)
---
WHAT: Before starting the interview, the system retrieves the candidate's
      past technical failures from DynamoDB.
HOW:  When /api/start-interview is called with the candidate's email:

      past_weaknesses = aws_db.get_candidate_weaknesses(email, skill_name)

      This queries the "InterviewHistory" DynamoDB table and returns a list like:
      ["list slicing", "GIL concept", "generator expressions"]

      These weaknesses are then injected into the AI prompt as:
      "IMPORTANT HISTORICAL CONTEXT:
       This candidate struggled with: list slicing, GIL concept.
       Your opening question MUST probe one of these areas.
       Do NOT tell them these are their past weaknesses."

WHY:  This is the PRIMARY INNOVATION of the project. Without Active Memory,
      every interview starts the same for every candidate. With it, the bot
      acts like a tutor who has read all your past homework and knows exactly
      where to push you to grow.

## STEP 5: ADAPTIVE INTERVIEW SESSION (The 4-Level Engine)
---
WHAT: The interview dynamically adjusts its difficulty based on the
      candidate's performance in real-time.
HOW:  The /api/submit-answer endpoint receives the candidate's answer and
      runs a SINGLE "CONSOLIDATED PROMPT" through Nova Lite that simultaneously:
        1. Evaluates the quality of the answer (low/medium/high)
        2. Decides the next action (retry/hint/probe/level_up/move_next)
        3. Generates the next question (if applicable)
        4. Extracts "missed" and "incorrect" concepts for the weakness ledger

      The 4-Level Model embedded in the prompt:
        Level 1: Basic definitions and "What is X?"
        Level 2: Conceptual depth and "How does X work internally?"
        Level 3: Real-world trade-offs and architecture decisions
        Level 4: Advanced mastery, edge cases, optimization

      Decision Table:
        HIGH quality answer  → level_up or move_next
        MEDIUM quality       → probe (a different subtopic within same skill)
        LOW quality, attempt 1 → retry (encourage, rephrase)
        LOW quality, attempt 2 → hint (provide technical clue)
        LOW quality, attempt 3 → force move_next (move on, log gap)
        max 4 questions/skill  → force move_next regardless of quality

WHY:  A fixed question bank is unfair. If a candidate is an expert in Python,
      asking "What is a variable" wastes their time. Our system finds the
      EXACT ceiling of a candidate's knowledge — like a digital oral exam.
      This is called "Pedagogical Scaffolding" in education research.

## STEP 6: BEHAVIORAL VIDEO ANALYSIS (Groq Llama 3.2 Vision)
---
WHAT: While the candidate answers, their webcam captures frames for
      behavioral analysis.
HOW:  If input_type == "VIDEO" and video_frames are provided:
        - The backend takes up to 3 Base64 frames.
        - Sends them to Groq's "llama-3.2-11b-vision-preview" model
          with this prompt: "Analyze behavioral aspects: face visibility,
          eye contact, professional presence. Under 30 words."
        - The response is appended to the consolidated evaluation as:
          "VIDEO ANALYSIS: Good eye contact, professional background."
        - This context is passed to Nova Lite along with the text answer.

WHY:  Groq is used specifically for vision because it runs on LPU hardware
      (Language Processing Unit), not standard GPU. This gives sub-800ms
      frame analysis speeds. If we used Bedrock for vision, it would add
      3-5 seconds per frame — breaking the live interview experience.
      If no video is provided, this entire step is SKIPPED automatically.

## STEP 7: WEAKNESS EXTRACTION & DynamoDB SYNC (Active Memory Write)
---
WHAT: After each answer is evaluated, the "missed" and "incorrect" concepts
      are saved back to the DynamoDB Growth Ledger.
HOW:  aws_db.append_history_and_extract_weaknesses() is called with the
      full evaluation dict. It reads:
        - evaluation["technical_accuracy"]["missed"]
        - evaluation["technical_accuracy"]["incorrect"]
      Appends these to the candidate's skill-specific weakness list.
      Deduplicates and caps the list at 15 items to prevent "prompt blowout."

WHY:  This is what makes the "Active Memory" persistent. The weakness becomes
      available the NEXT TIME the candidate logs in, closing the feedback loop
      between sessions automatically.

## STEP 8: SESSION FINALIZATION & REPORT GENERATION
---
WHAT: After all skills are covered, the session is saved and a report is shown.
HOW:  The frontend sends the complete session data to /api/history:
      aws_db.save_full_session(email, session_data)
      This appends the full session (date, scores, feedback) to the
      candidate's "sessions" list in DynamoDB.
      The frontend then calculates and renders the Growth Ledger dashboard
      showing technical, behavioral, and overall scores for each skill.

WHY:  Without a permanent store of session data, the candidate would never
      know how they performed in past interviews. The report also provides
      specific "missed concepts" and "improvement tips" generated by Nova Lite.

==========================================================================
SECTION 2: ALL NEW CHANGES MADE AFTER CIE 2
==========================================================================

CIE 2 was approximately completed around 12th March 2026.
At that point, the system had:
  - Basic auth (simple JSON file)
  - Resume upload and parsing (local file system)
  - Groq-based question generation (Llama 3.1 text-only)
  - Basic answer evaluation
  - Local feedback storage

## NEW CHANGE 1: Full AWS Serverless Migration (13 Mar – 26 Mar 2026)
---
BEFORE: Backend ran on a local Uvicorn server or Render cloud server.
        All data was stored in local JSON files (profiles.json, history.json).
        Resume files were stored on the server's local disk.

AFTER:  FastAPI wrapped with Mangum to run on AWS Lambda.
        All user/session data moved to AWS DynamoDB (3 tables).
        All resume files moved to AWS S3.
        API Gateway added as the public-facing endpoint.

WHY:    A local server crashes if too many users connect simultaneously.
        AWS Lambda scales to thousands of users automatically.
        DynamoDB provides millisecond reads regardless of data size.
        Cost drops to near-zero when the platform is not in use.

## NEW CHANGE 2: Amazon Nova Lite Integration (27 Mar – 10 Apr 2026)
---
BEFORE: All LLM calls went to Groq (Llama 3.1) for both skill extraction
        and question generation.

AFTER:  The primary reasoning engine (call_llm) now calls:
        boto3.client("bedrock-runtime").converse(
            modelId="amazon.nova-lite-v1:0", ...
        )
        Groq is retained ONLY for Llama 3.2 Vision (behavioral frames).

WHY:    Amazon Nova Lite provides longer context windows and better JSON
        formatting compliance, which is critical for our "CONSOLIDATED PROMPT"
        that must return both an evaluation and a next question in one JSON.
        It also keeps the data flow inside the AWS private cloud (security).

## NEW CHANGE 3: Active Memory RAG System (27 Mar – 10 Apr 2026)
---
BEFORE: Every interview started fresh with no memory of past sessions.
        Weaknesses were never tracked between interviews.

AFTER:  DynamoDB now has a "weaknesses" field per candidate per skill.
        Function: append_history_and_extract_weaknesses() extracts "missed"
        and "incorrect" fields from every evaluation and stores them.
        Function: get_candidate_weaknesses() retrieves them before each session.
        These are injected into the Nova Lite prompt as "Historical Context."

WHY:    This is the primary research novelty of the project. It transforms
        the bot from a one-off quiz tool to a long-term growth tracker.

## NEW CHANGE 4: Consolidated Single-Prompt Architecture (27 Mar – 10 Apr 2026)
---
BEFORE: Evaluation and next-question generation were two separate LLM calls,
        leading to slower response times and inconsistency.

AFTER:  A single "CONSOLIDATED PROMPT" handles:
          1. Evaluation of the current answer
          2. Decision (retry/hint/probe/level_up/move_next)
          3. Generation of the next question
          4. Extraction of technical_accuracy.missed and .incorrect
        All in ONE API call to Nova Lite.

WHY:    Every API call to Bedrock adds ~1-2 seconds of latency. Combining
        all logic into one call cuts our response time roughly in half.

## NEW CHANGE 5: 4-Level Adaptive Difficulty Engine (27 Mar – 10 Apr 2026)
---
BEFORE: Questions were generated without a structured difficulty tier.

AFTER:  The prompt now includes a formal 4-level model:
        Level 1: Basic → Level 2: Conceptual → Level 3: Applied → Level 4: Expert
        With strict progression rules and a 4-question-per-skill cap.

WHY:    Without levels, the AI could jump erratically between easy and hard
        questions. The structured model ensures consistent, fair assessment.

## NEW CHANGE 6: Groq Vision for Behavioral Analysis (27 Mar – 10 Apr 2026)
---
BEFORE: No behavioral analysis existed. Scores were purely text-based.

AFTER:  If video_frames are provided (Base64 strings from the webcam),
        the backend sends them to llama-3.2-11b-vision-preview via Groq.
        The analysis ("eye contact, presence, confidence") is embedded as
        "VIDEO ANALYSIS: [result]" inside the consolidated prompt to Nova Lite.

WHY:    Technical knowledge alone doesn't define a good candidate.
        Body language and professional presence are real interview factors.
        Groq LPU gives sub-800ms vision inference, keeping the UX smooth.

## NEW CHANGE 7: Score Validation & Clamping (11 Apr – 21 Apr 2026)
---
BEFORE: AI sometimes returned scores as "8/10" (string) or values > 10.

AFTER:  All scores are now clamped between 0 and 10 using:
        max(0, min(10, int(v)))
        String scores like "8/10" are parsed by splitting on "/" first.

WHY:    Without validation, a score of "9/10" stored as a string would
        break the frontend charts and the final percentage calculation.

## NEW CHANGE 8: Complete Report Documentation (11 Apr – 21 Apr 2026)
---
BEFORE: No formal academic report existed.

AFTER:  7 complete chapters drafted (Introduction → Conclusion).
        Technical diagrams created in diagrams_for_snapshot.html.
        System Component Deep Dive, Backend Architecture, and
        Technical Deep Dive documents created for jury defense.

==========================================================================
SECTION 3: EVERY ACTIVITY AFTER CIE 2 IN DEPTH
==========================================================================

Week 1 (13 Mar – 19 Mar): AWS Infrastructure Setup
  - Created AWS account and configured IAM roles for Lambda, DynamoDB, S3.
  - Created 3 DynamoDB tables: InterviewUsers, InterviewProfiles, InterviewHistory.
  - Created S3 bucket: ai-interview-bot-storage.
  - Wrote aws_db.py module with all CRUD functions for DynamoDB and S3.
  - Installed Mangum library and wrapped FastAPI app for Lambda compatibility.
  - Deployed initial version to Lambda via Serverless Framework (serverless.yml).
  - Ran CORS configuration tests to ensure API Gateway worked with Next.js.

Week 2 (20 Mar – 26 Mar): Migration & Testing
  - Migrated all user data from JSON files to DynamoDB.
  - Migrated resume storage from local disk to S3.
  - Added dual "try DynamoDB, fallback to local JSON" pattern for resilience.
  - Ran full end-to-end tests of the signup → resume → dashboard flow on AWS.
  - Debugged Lambda cold-start issues and added /api/health and /api/status endpoints.

Week 3 (27 Mar – 2 Apr): Nova Lite + Active Memory RAG
  - Created get_bedrock_client() function using boto3 bedrock-runtime.
  - Replaced all Groq text LLM calls with Nova Lite Converse API.
  - Confirmed model ID: amazon.nova-lite-v1:0 (us-east-1 region).
  - Designed and implemented the weakness extraction logic:
      append_history_and_extract_weaknesses() function in aws_db.py.
  - Added get_candidate_weaknesses() query function.
  - Integrated RAG injection into /api/start-interview endpoint.
  - Tested RAG: ran two sessions, confirmed second session probed first's gaps.

Week 4 (3 Apr – 10 Apr): Consolidated Prompt + Vision Integration
  - Redesigned /api/submit-answer to use a single "CONSOLIDATED PROMPT."
  - Added 4-level adaptive logic with retry/hint/probe/level_up/move_next.
  - Added maximum 4-questions-per-skill enforcement (force move_next).
  - Added Groq Llama 3.2 Vision call for Base64 video frame analysis.
  - Integrated "VIDEO ANALYSIS:" context into consolidated prompt.
  - Added score clamping (0-10) and string score parsing (e.g., "8/10").
  - Added technical_accuracy enforcement (correct/missed/incorrect arrays).
  - Fixed "prompt blowout" by capping weakness list at 15 items.

Week 5 (11 Apr – 21 Apr): Documentation + Presentation Prep
  - Drafted all 7 report chapters (Chapter_1.md through Chapter_7.md).
  - Created technical diagrams in diagrams_for_snapshot.html.
  - Wrote system_component_deep_dive.md — 7 core components explained.
  - Wrote backend_architecture_deep_dive.md — FastAPI, Lambda, Mangum explained.
  - Wrote technical_deep_dive.md — full communication flows with code.
  - Prepared jury defense scripts and presentation talking points.
  - Updated Weekly Diary to April 21, 2026.

==========================================================================
SECTION 4: TEST CASES TO SHOW IN THE PRESENTATION
==========================================================================

Show these 4 test cases. They cover Unit, Integration, and System levels.

---
TEST CASE 1 (Unit Test): Resume Parser
MODULE: /api/upload-and-analyze-base64
INPUT:  A standard PDF resume (1-2 pages) with Python, React, AWS listed.
STEPS:  Upload the PDF via the Upload Resume page.
EXPECTED OUTPUT: System returns a JSON array:
  [{"skill": "Python", "experience_level": "intermediate", "category": "language"},
   {"skill": "React", "experience_level": "intermediate", "category": "framework"},
   {"skill": "AWS", "experience_level": "beginner", "category": "tool"}]
SHOW:   Screenshot of the Skill Cards appearing on the dashboard.
WHY:    Shows that AI parsing works correctly on real-world documents.

---
TEST CASE 2 (Unit Test): Adaptive Level Escalation
MODULE: /api/submit-answer
INPUT:  A HIGH quality answer (detailed, 80+ words, uses correct technical terms).
EXPECTED OUTPUT: JSON from Nova Lite shows:
  { "action": "level_up", "level": 2, "evaluation": {"quality": "high"} }
SHOW:   The difficulty level indicator on the interview screen moving from
        "Basic" to "Conceptual" after a strong answer.
WHY:    Shows the 4-Level Adaptive Engine is working correctly.

---
TEST CASE 3 (Integration Test): Active Memory RAG
MODULE: /api/start-interview (second session for same user)
INPUT:  Same email, second login. First session had Python questions with
        "generator expressions" and "GIL" flagged as missed.
EXPECTED OUTPUT: The opening question for the second Python session specifically
        targets one of these gaps. Example:
        "Can you walk me through how Python's GIL (Global Interpreter Lock)
        works and how it affects multi-threaded programs?"
SHOW:   Side-by-side comparison of first-session missed concepts (from DB)
        vs. second-session opening question.
WHY:    This is your biggest innovation. Show that the bot REMEMBERS.
        This is what makes your project different from ALL the papers in
        your literature survey.

---
TEST CASE 4 (System Test / Edge Case): Empty / Weak Answer
MODULE: /api/submit-answer (three rounds on same question)
INPUT:
  Round 1: Answer = "I don't know"
  Round 2: Answer = "Not sure, something about memory?"
  Round 3: Answer = "idk"
EXPECTED OUTPUT:
  Round 1: {"action": "retry", "feedback": "Let me rephrase..."}
  Round 2: {"action": "hint", "feedback": "Here's a clue: Think about..."}
  Round 3: {"action": "move_next", "feedback": "Let's explore a different area."}
SHOW:   Three question turns on the interview screen demonstrating the
        retry → hint → move_next progression.
WHY:    Shows the system is intelligent enough not to get stuck on a
        student who doesn't know the answer. It gracefully moves on.

---
BONUS TEST (if time permits): Fail-safe / No Camera Mode
MODULE: /api/submit-answer with no video_frames
INPUT:  Same answer but video_frames = [] (empty list)
EXPECTED OUTPUT: Vision analysis is completely skipped. The system returns
  a normal evaluation based purely on the text answer.
SHOW:   The "Behavioral Score" section shows "N/A" or "Camera Required"
        while Technical and Communication scores still appear.
WHY:    Shows your architecture is modular and resilient. It works even
        without a webcam — a key selling point for accessibility.

==========================================================================
Document Status: FINALIZED
All information sourced from: app.py, aws_db.py, weekly diary entries,
Presentation_Content.md, and direct code analysis.
==========================================================================
