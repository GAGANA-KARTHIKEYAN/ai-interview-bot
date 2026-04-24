# Backend Architecture Deep Dive: FastAPI Brain on AWS Lambda

This document provides a complete technical breakdown of the Backend Stack,
the Multimodal Data Collection Pipeline, and the FastAPI Brain — including
exactly how these three components communicate with each other end-to-end.

---

## PART 1: The Backend Stack

### What is FastAPI?
FastAPI is a modern, high-performance Python web framework for building APIs.
It is the "Central Brain" of our project — every single action the user takes
on the frontend is handled by a FastAPI function (called an "endpoint") on
the backend.

Why FastAPI and not Django or Flask?
- Speed: FastAPI is one of the fastest Python frameworks in the world.
  It uses "async/await" programming, meaning it can handle multiple
  candidates at the same time without freezing.
- Automatic Docs: FastAPI auto-generates an API documentation page
  (Swagger UI), which makes testing and debugging much easier.
- Pydantic Validation: Every piece of data that comes into the backend
  is automatically "validated." If a wrong data type is sent, FastAPI
  rejects it immediately before it can corrupt the database.

### What is AWS Lambda?
Lambda is AWS's Serverless Compute Service. Think of it as a "sleeping
function" that wakes up only when a request arrives, does its job in
seconds, and goes back to sleep.

The Key Challenge: FastAPI is designed to run on a persistent server.
AWS Lambda is a "one-shot" function. They are not naturally compatible.

The Solution — Mangum:
We used a Python library called "Mangum" to act as a bridge (adapter).
Mangum wraps our entire FastAPI application and translates AWS Lambda's
event format into the standard format that FastAPI understands.

How it works:
  [Candidate Action]
       ↓
  [AWS API Gateway receives the HTTP request]
       ↓
  [API Gateway triggers the Lambda function]
       ↓
  [Mangum translates the Lambda "event" into an HTTP request]
       ↓
  [FastAPI processes it as a normal API call]
       ↓
  [FastAPI returns the response back through Mangum → Lambda → API Gateway → Candidate]

### What is AWS API Gateway?
API Gateway is the "Front Door" of our cloud backend.
- It receives every HTTP request from the Next.js frontend.
- It performs security checks (rate limiting, authentication headers).
- It uses "Proxy Integration" to forward the full request to Lambda
  without modifying it.
- It sends the Lambda response back to the frontend.

The diagram you shared shows this exact flow:
  [AWS API Gateway] ——uses Proxy Integrations——> [AWS Lambda (FastAPI Brain)]

---

## PART 2: Multimodal Data Collection

### What is "Multimodal"?
It means capturing data in multiple formats simultaneously. Our system
captures three types of data from the candidate at the same time:

  1. TEXT (What they typed)
  2. VOICE (What they said — converted to text in real-time)
  3. VIDEO FRAMES (What they looked like — behavioral analysis)

### How Voice-to-Text Works (Web Speech API):
- The browser's built-in "Web Speech API" listens to the microphone.
- As the candidate speaks, it converts the audio to text in real-time.
- This transcript is sent to the backend as a simple text string.
- No audio file is ever stored — only the text transcript.

Why? It is more cost-efficient and privacy-friendly than recording
full audio files on a server.

### How Video Frame Capture Works (MediaRecorder API + Base64):
This is the more complex part. Here is the step-by-step:

  Step 1 — Capture:
    The "react-webcam" library accesses the candidate's camera every
    few seconds using the browser's MediaRecorder API.

  Step 2 — Encode:
    The captured frame (a raw image) is converted into a "Base64 string."
    Base64 is a way to represent any binary file (like an image) as a
    long string of text characters.
    Example: "/9j/4AAQSkZJRgABAQ..." (imagine thousands of characters)

  Step 3 — Package:
    The frontend bundles the Base64 frame strings together with the
    candidate's text answer and voice transcript into a single JSON object
    called a "Knowledge Packet."

  Step 4 — Transmit:
    This Knowledge Packet is sent as a single HTTP POST request to the
    AWS API Gateway endpoint.

Why Base64?
  - HTTP requests are designed for text data.
  - Base64 lets us send image data as text inside a standard JSON body.
  - We don't need to set up a separate file upload system for video.

---

## PART 3: The FastAPI Brain

The FastAPI Brain is the processing core that receives the Knowledge
Packet and orchestrates five tasks simultaneously:

### Task 1: Consolidated Prompting
When the candidate's answer arrives, the Brain doesn't just send it raw
to the AI. It builds a "Consolidated Prompt" that includes:

  - The original question that was asked
  - The candidate's history (retrieved from DynamoDB via Active Memory)
  - The current difficulty level (Stage 1-4)
  - The candidate's text answer and voice transcript
  - A specific instruction telling Nova Lite what to do: "Evaluate this
    answer. Give a score from 0-10. Then decide: Hint, Retry, or Next?"

This consolidated context is what makes our AI "Smart" instead of naive.

### Task 2: Adaptive Logic Scaling
After Nova Lite returns its evaluation, the Brain runs the following
decision tree:

  If Score >= 8:  → Move UP to next difficulty level (Stage + 1)
  If Score 5-7:   → Stay at same level, ask a related follow-up
  If Score 3-4:   → Give a HINT and allow a Retry
  If Score < 3:   → Move DOWN to simpler level (Stage - 1), log as Gap

This logic is hardcoded in Python inside the FastAPI "next_question"
endpoint, ensuring the AI's decision is always within defined boundaries.

### Task 3: Parallel Vision Evaluation (Groq)
While Nova Lite evaluates the technical answer, the Brain simultaneously
sends the Base64 video frames to Groq's Llama 3.2 Vision model.

The prompt sent to Groq is:
  "You are a behavioral interviewer. Analyze this image of a candidate.
   Rate their eye contact, confidence, and attentiveness on a scale of
   0.0 to 1.0. Return JSON: {eye_contact: 0.X, confidence: 0.X}"

Groq returns the behavioral JSON in under 800ms. The Brain receives both
the Nova (Technical) score and the Groq (Behavioral) score.

### Task 4: Score Merging (The Evaluation Hub)
Once both scores are received, the Brain merges them:
  Final Score = (Technical Score × 0.70) + (Behavioral Score × 0.30)

This weighted formula ensures that a candidate who knows the answer but
looks nervous doesn't fail, and a confident candidate who gives a wrong
answer doesn't pass either.

### Task 5: DynamoDB Sync (Persistence)
The Brain immediately writes the merged score, the question, and the
decision (Hint/Retry/Next) to the candidate's DynamoDB Growth Ledger.

---

## PART 4: Full Communication Flow (End-to-End)

Here is the complete path from candidate action to the next question:

  [CANDIDATE]
  Types answer + webcam captures frame
       ↓
  [NEXT.JS FRONTEND]
  Packages text + voice transcript + Base64 frames into JSON
       ↓
  [AWS API GATEWAY]
  Receives HTTP POST, security-checks it, forwards to Lambda
       ↓
  [AWS LAMBDA (via Mangum)]
  Wakes up, Mangum translates event to FastAPI format
       ↓
  [FASTAPI BRAIN]
  ├── Fetches candidate history from DynamoDB (Active Memory RAG)
  ├── Builds Consolidated Prompt → Sends to Amazon Nova Lite (Bedrock)
  └── Sends Base64 frames → Sends to Groq Llama 3.2 Vision (parallel)
       ↓
  [NOVA LITE returns: Technical Score + Next Decision]
  [GROQ returns: Behavioral Score JSON]
       ↓
  [FASTAPI BRAIN]
  Merges scores → Runs Adaptive Logic → Saves to DynamoDB → Generates next question
       ↓
  [AWS API GATEWAY]
  Returns the next question + combined score JSON
       ↓
  [NEXT.JS FRONTEND]
  Displays the next question to the candidate

Total time for this entire loop: Under 2 seconds.

---

Document Status: FINALIZED
