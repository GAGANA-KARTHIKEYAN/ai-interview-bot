# INTERNSHIP PROJECT REPORT

---

**Project Title:** Intelligent AI Interview Platform

**Submitted To:** LNA Technologies Pvt. Ltd.
No. 15, Kadugodi, Bangalore – 560067

**Submitted By:**
Gagana Karthikeyan
Rakshitha K
Students, School of Computer Science and Engineering
RV University, Bangalore – 560059

**Internship Duration:** 24th January 2026 – 21st April 2026

**Industry Mentor:** Divya P K, Director, LNA Technologies Pvt. Ltd.

---

## Table of Contents

1. Executive Summary
2. Introduction
3. Project Objectives
4. Technical Architecture
5. Work Performed
6. Key Features and Innovations
7. Weekly Progress Log
8. Challenges and Solutions
9. Results and Outcomes
10. Learnings and Skills Acquired
11. Conclusion

---

## 1. Executive Summary

During the internship period at LNA Technologies Pvt. Ltd., we designed, developed, and deployed a fully functional **Intelligent AI Interview Platform** — a serverless, cloud-native web application that automates technical interview sessions using Generative AI. The platform extracts candidate skills from uploaded resumes, conducts adaptive technical interviews using a four-level difficulty model, evaluates responses using Amazon Nova Lite, performs real-time behavioral analysis using Groq's Vision AI, and maintains a persistent growth ledger across sessions using AWS DynamoDB.

The project progressed through three phases — Requirements and Prototyping, Core Development, and Cloud Deployment and Testing — and culminated in a fully deployed, production-ready system on AWS. The platform represents a significant application of cloud-native serverless architecture and large language model integration for enterprise-grade interview automation.

---

## 2. Introduction

LNA Technologies Pvt. Ltd. identified a growing need in the recruitment industry for an automated, intelligent, and unbiased interview system that could reduce the time and cost of initial technical screening while providing candidates with a meaningful, growth-oriented evaluation experience.

We were assigned the task of building this platform from the ground up during the internship. The system was designed to serve both enterprise recruiters (as a screening tool) and candidates (as a practice and growth tracking platform). The project required expertise in full-stack web development, cloud infrastructure, and large language model integration — all of which were developed and applied over the course of the internship.

---

## 3. Project Objectives

The following objectives were defined at the start of the internship:

- To build a serverless, scalable web platform capable of conducting automated AI-driven technical interviews.
- To implement accurate resume parsing and skill extraction from PDF and DOCX formats.
- To develop a four-level adaptive questioning engine that adjusts difficulty based on candidate performance in real-time.
- To implement a Historical Weakness RAG (Retrieval-Augmented Generation) system that tracks and responds to individual candidate growth across multiple sessions.
- To integrate real-time behavioral analysis using Vision AI to assess candidate confidence, eye contact, and professional presence.
- To enforce interview integrity through multi-layer tab switching and focus detection.
- To deploy the complete system on AWS using a serverless architecture for cost efficiency and scalability.

---

## 4. Technical Architecture

The platform follows a **Three-Tier Serverless Architecture**:

### 4.1 Presentation Tier (Frontend)
- Framework: Next.js 15 (React 19, TypeScript)
- UI: Tailwind CSS with Framer Motion animations
- Browser APIs: Web Speech API (voice transcription), MediaRecorder API (webcam capture)
- Deployment: AWS Amplify

### 4.2 Logic Tier (Backend)
- Framework: FastAPI (Python 3.11)
- Serverless Adapter: Mangum (wraps FastAPI for AWS Lambda)
- Deployment: AWS Lambda + API Gateway (Proxy Integration)
- Key Libraries: pdfplumber, python-docx, boto3, pydantic

### 4.3 Data & Intelligence Tier
- Resume Storage: Amazon S3 (bucket: ai-interview-bot-storage)
- Database: AWS DynamoDB (3 tables: InterviewUsers, InterviewProfiles, InterviewHistory)
- Primary AI: Amazon Nova Lite v1 via AWS Bedrock Converse API
- Vision AI: Groq Cloud — Llama 3.2 Vision (llama-3.2-11b-vision-preview)

---

## 5. Work Performed

### 5.1 Phase 1 — Requirements and Prototyping (Jan 24 – Feb 14, 2026)

During the initial phase, we:
- Analysed the problem statement and defined system requirements.
- Studied existing interview automation research (11 peer-reviewed papers).
- Set up the development environment (Node.js, Python, Git).
- Built the initial prototype with Firebase authentication, local file storage, and Groq-based LLM integration.
- Implemented the basic interview loop: resume upload → parsing → question generation → answer submission.

### 5.2 Phase 2 — Core Development (Feb 15 – Mar 12, 2026)

- Implemented the full authentication flow using Next.js and custom API.
- Built the resume parsing pipeline using pdfplumber and python-docx.
- Developed the AI-driven skill extraction prompt for the Groq LLM.
- Implemented the standard interview flow with question generation and answer evaluation.
- Built the multimodal input pipeline: Web Speech API (voice), MediaRecorder API (video frames as Base64).
- Implemented the four-layer Interview Integrity System:
  - visibilitychange API (tab switching)
  - window.blur events (Alt+Tab / app switching)
  - Resize-based split-screen heuristic (< 70% screen width)
  - Focus polling every 1.5 seconds (Chrome/Edge fallback)
  - Auto-termination after 3 violations with session logging.
- Built the Dashboard UI with interview history, skill cards, and score visualisation.

### 5.3 Phase 3 — AWS Migration and Deployment (Mar 13 – Apr 21, 2026)

- Migrated all storage from local JSON files to AWS DynamoDB (3 tables).
- Migrated resume file storage to Amazon S3.
- Wrapped FastAPI with Mangum and deployed to AWS Lambda via Serverless Framework.
- Configured AWS API Gateway with Proxy Integration for all endpoints.
- Replaced Groq text LLM with Amazon Nova Lite via Bedrock Converse API for primary reasoning.
- Retained Groq Cloud specifically for Llama 3.2 Vision (behavioral frame analysis).
- Implemented the Historical Weakness RAG system:
  - append_history_and_extract_weaknesses(): extracts missed/incorrect concepts after each answer.
  - get_candidate_weaknesses(): retrieves past gaps before each session.
  - RAG injection into Nova Lite prompt as historical context.
- Redesigned the evaluation engine into a single Consolidated Prompt architecture.
- Implemented the four-level adaptive difficulty model (Basic → Conceptual → Applied → Expert).
- Conducted end-to-end testing across all modules.
- Completed full project documentation.

---

## 6. Key Features and Innovations

### 6.1 Active Memory RAG (Primary Innovation)
The platform's most significant innovation is its Historical Weakness Retrieval-Augmented Generation system. Before each interview session, the system queries DynamoDB for the candidate's past technical failures (missed and incorrect concepts). These are injected into the AI's prompt context, enabling the bot to specifically probe known weak areas without revealing this to the candidate. This transforms the platform from a one-time quiz tool to a long-term personal career development coach.

### 6.2 Four-Level Adaptive Questioning Engine
The interview engine follows a structured pedagogical model:
- Level 1: Basic definitions and recall
- Level 2: Conceptual understanding and internal mechanics
- Level 3: Real-world application and architecture decisions
- Level 4: Advanced mastery, edge cases, and optimisation

The AI dynamically escalates or de-escalates difficulty based on answer quality, with a maximum of four questions per skill to prevent stagnation.

### 6.3 Hybrid AI Strategy (Nova Lite + Groq)
The system uses a dual AI provider approach:
- Amazon Nova Lite (Bedrock): For technical reasoning, evaluation, and adaptive decision-making. Chosen for AWS-native security, long context windows, and reliable JSON output.
- Groq Llama 3.2 Vision: For behavioral frame analysis. Chosen for its LPU hardware that delivers sub-800ms image inference — critical for a live interview feel.

### 6.4 Consolidated Single-Prompt Architecture
All evaluation logic — answer scoring, adaptive decision, next question generation, and weakness extraction — is handled in a single LLM call. This reduces response latency by eliminating sequential API calls.

### 6.5 Interview Integrity System
A four-layer browser-based malpractice detection system using the Page Visibility API, window focus events, resize-based split-screen detection, and aggressive polling. Interviews are automatically terminated and logged after three violations.

---

## 7. Weekly Progress Log

| Week | Dates | Work Completed |
|:---|:---|:---|
| Week 1 | Jan 24 – Jan 30 | Problem analysis, objective definition, environment setup, Firebase auth integration |
| Week 2 | Jan 31 – Feb 6 | Authentication flow, profile setup, resume upload pipeline, initial backend |
| Week 3 | Feb 7 – Feb 14 | Resume parsing (pdfplumber), skill extraction with Groq LLM, question generation prototype |
| Week 4 | Feb 15 – Feb 21 | Interview flow implementation, answer evaluation, basic scoring |
| Week 5 | Feb 22 – Feb 28 | Dashboard UI, interview history, score visualisation, Framer Motion animations |
| Week 6 | Mar 1 – Mar 7 | Multimodal input (voice + webcam), Base64 encoding, video frame pipeline |
| Week 7 | Mar 8 – Mar 14 | Interview Integrity System (tab detection, auto-termination), testing |
| Week 8 | Mar 15 – Mar 21 | AWS infrastructure setup: DynamoDB (3 tables), S3 bucket, IAM roles, Mangum/Lambda |
| Week 9 | Mar 22 – Mar 28 | AWS migration (data + storage), API Gateway configuration, CORS, deployment |
| Week 10 | Mar 29 – Apr 4 | Nova Lite (Bedrock) integration, consolidated prompt architecture |
| Week 11 | Apr 5 – Apr 11 | Historical Weakness RAG, weakness extraction, DynamoDB Growth Ledger |
| Week 12 | Apr 12 – Apr 18 | Four-level adaptive engine, score clamping, full end-to-end testing |
| Week 13 | Apr 19 – Apr 21 | Final documentation, report writing, presentation preparation |

---

## 8. Challenges and Solutions

### Challenge 1: AWS Lambda Statelessness
**Problem:** FastAPI is designed for persistent servers. AWS Lambda is stateless and loses all context after each invocation.
**Solution:** Used the Mangum adapter to bridge FastAPI and Lambda. All session state is persisted to DynamoDB after every API call, enabling seamless session continuity.

### Challenge 2: Prompt Blowout in RAG
**Problem:** As candidates completed more sessions, the weakness list grew indefinitely, causing the AI prompt to exceed token limits.
**Solution:** Implemented deduplication and a hard cap of 15 most recent weaknesses per skill, preventing prompt overflow while retaining the most relevant context.

### Challenge 3: Video Frame Latency
**Problem:** Initial tests with standard cloud GPU APIs showed 3–5 second delays per video frame, breaking the live interview experience.
**Solution:** Migrated video analysis to Groq's LPU hardware (Llama 3.2 Vision), reducing frame analysis to under 800 milliseconds.

### Challenge 4: Tab Switch False Positives
**Problem:** API error overlays triggered window.blur events, causing unintended tab-switch penalties to be applied during legitimate UI interactions.
**Solution:** Implemented an ignoreFocusLossRef guard and a 500ms debounce, preventing cascade re-entry during error handling.

### Challenge 5: Inconsistent AI JSON Output
**Problem:** Nova Lite occasionally returned malformed JSON or scores as strings (e.g., "8/10"), breaking the frontend score parser.
**Solution:** Added multi-strategy JSON extraction using regex with fallback patterns, plus score clamping (0–10) with string parsing for edge cases.

---

## 9. Results and Outcomes

The completed platform delivers the following capabilities:

- Automated parsing of PDF and DOCX resumes with skill extraction in under 4 seconds.
- Dynamic, personalised interview sessions driven by the candidate's actual resume content.
- Four-level adaptive difficulty adjustment in real-time based on answer quality.
- Historical Weakness RAG system that successfully carries forward technical gaps between sessions.
- Parallel behavioral scoring using Vision AI with graceful fallback when no camera is available.
- Four-layer interview integrity enforcement with automatic session termination and audit logging.
- Near real-time DynamoDB synchronisation ensuring zero data loss across sessions.
- Full cloud deployment on AWS with zero-downtime scalability for multiple concurrent users.

---

## 10. Learnings and Skills Acquired

**Gagana Karthikeyan:**
- AWS serverless architecture: Lambda, API Gateway, DynamoDB, S3, Bedrock, IAM
- Large Language Model prompt engineering (consolidated prompts, RAG injection)
- FastAPI backend development and Mangum serverless adapter integration
- Amazon Nova Lite integration via Bedrock Converse API
- Groq Vision API integration for real-time behavioral analysis
- NoSQL data modelling for interview sessions and growth tracking

**Rakshitha K:**
- Next.js 15 full-stack frontend development
- Browser API integration: Web Speech API, MediaRecorder API, Page Visibility API
- Multimodal input pipeline (voice transcription, Base64 video encoding)
- Interview integrity system design and implementation
- Research and literature survey (11 peer-reviewed papers)
- UI/UX design with Framer Motion and Tailwind CSS

---

## 11. Conclusion

Over the course of thirteen weeks at LNA Technologies Pvt. Ltd., we successfully designed, developed, and deployed a complete Intelligent AI Interview Platform. The project involved the application of cutting-edge technologies including serverless cloud architecture, generative AI reasoning, retrieval-augmented generation, and real-time vision AI — all integrated into a production-ready system.

The platform's primary innovation — the Active Memory RAG system — represents a meaningful contribution to the field of AI-assisted recruitment, enabling long-term candidate growth tracking that no existing academic or commercial solution currently provides at this level of integration.

We are grateful to LNA Technologies for providing the opportunity, infrastructure, and guidance required to build a project of this scale. The experience has significantly enhanced our technical competency and our understanding of real-world software engineering practices.

---

**Submitted by:**

Gagana Karthikeyan
RV University — School of Computer Science and Engineering

Rakshitha K
RV University — School of Computer Science and Engineering

**Date:** 21st April 2026

---
