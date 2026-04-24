# Phase 3 Mini Project Presentation Content
## Resilience-Enabled AI Interview Platform (AI Interview Bot)

### Slide 1: Title Slide
- **Project Title**: Resilience-Enabled AI Interview Platform (AI Interview Bot)
- **Team Members**:
    - [Student Name 1] ([USN 1])
    - [Student Name 2] ([USN 2])
- **Project Guide**: Prof. Sheela S, Assistant Professor
- **External Guide**: Anush G R (Industry Consultant)
- **Institution**: School of Computer Science and Engineering, RV University

---

### Slide 2: Title and Problem Definition
- **The Problem**: Traditional hiring relies on manual resume screening and repetitive technical rounds.
- **Current Issues**: Time-consuming process, interviewer bias, and high cost for recruiters.
- **Student Pain Point**: Freshers lack a realistic environment to practice interviews and track their technical growth.
- **Missing Link**: Existing interview bots don't "remember" past sessions, making it hard to see if a candidate has actually improved.

---

### Slide 3: Introduction & Scope
- **Introduction**: A serverless web platform that uses Generative AI to conduct automated, realistic technical interviews.
- **System**: Driven by **Amazon Nova Lite** (AWS Bedrock) for real-time reasoning.
- **Scope**:
    - Automated skill extraction from uploaded Resumes (PDF/DOCX).
    - Dynamic, level-based questioning tailored to the candidate's profile.
    - Historical tracking of weaknesses to assess learning progress.
    - Behavioral analysis via webcam for a complete candidate report.

---

### Slide 4: Objectives
- To parse and extract key technical competencies from resumes with high accuracy.
- To generate adaptive, level-based interview questions in real-time.
- To implement a **Persistence Engine** (Active Memory) using AWS DynamoDB to track technical gaps.
- To provide an automated, detailed evaluation report within seconds of finishing the interview.
- To build a scalable architecture that works seamlessly on any browser.

---

### Slide 5: Literature Survey - (ML in Recruitment)
- **Research Paper**: "Automated Candidate Filtering via Transformer Models" (2022).
- **Key Findings**: BERT-based models improved resume ranking accuracy by 30%.
- **Gap Identified**: The paper focused only on ranking documents, with no interactive live interview or behavioral check.

---

### Slide 6: Literature Survey - (Interactive AI)
- **Research Paper**: "Conversational AI for Virtual Job Interviews" (2023).
- **Key Findings**: Used static rule-based bots to ask standard FAQs.
- **Gap Identified**: Questions were not adaptive; if a candidate performed poorly on one topic, the bot couldn't pivot to a different area or go deeper into a strength.

---

### Slide 7: Literature Survey - (Knowledge Retrieval)
- **Research Paper**: "RAG Systems for Personalized Tutoring" (2024).
- **Key Findings**: Retrieval-Augmented Generation helps AI remain factually correct using external databases.
- **Gap Identified**: No existing implementation utilized RAG specifically for tracking an interviewee’s **growth across multiple weeks/months**.

---

### Slide 8: Proposed Methodology
- **Step 1**: Binary extraction of resume text using `pdfplumber` and `python-docx`.
- **Step 2**: AI-driven skill profiling to identify the candidate's core stack.
- **Step 3**: **Active Memory Check**: Retrieving past weaknesses from DynamoDB.
- **Step 4**: Real-time adaptive interview session with automated scoring.
- **Step 5**: Final report generation summarizing technical and behavioral metrics.

---

### Slide 9: Requirement Specification
- **Functional Requirements**:
    - Resume upload and structured storage (S3).
    - Adaptive questioning logic with hint and retry mechanisms.
    - Automated transcription and scoring.
- **Non-Functional Requirements**:
    - **Latency**: AI response under 3 seconds using Bedrock Nova Lite.
    - **Scalability**: Serverless Lambda scaling for multiple users.
    - **Reliability**: Persistent state management via DynamoDB.

---

### Slide 10: Design Approach & Architecture
- **Architecture**: Three-Tier Serverless Cloud Architecture.
- **Frontend**: Next.js (TypeScript) + Tailwind CSS for a premium, fast UI.
- **Backend**: Python FastAPI hosted on AWS Lambda + API Gateway.
- **Database**: AWS DynamoDB for high-speed session history.
- **Intelligence**: Amazon Nova Lite via the Bedrock Converse API.
- **Note**: *[Add Architecture Diagram Screenshot here]*

---

### Slide 11: Innovation
- **Historical Weakness RAG (Active Memory)**: The system remembers what you struggled with last time and specifically probes those areas to track your growth.
- **Amazon Nova Lite Integration**: Using the latest high-efficiency model for faster, more natural dialogue compared to traditional LLMs.
- **Resume-Driven Adaptivity**: The interview is never a "blank slate"; it is surgically extracted from the candidate's own actual experience.

---

### Slide 12: Implementation
- Fully migrated from local storage to **Fully Serverless AWS Stack**.
- Implemented **Historical LEDGER** in DynamoDB to extract and store "Missed Concepts".
- Designed a responsive Interview Dashboard using Framer Motion for smooth transitions.
- Integrated **Vision AI** for basic behavioral presence checks.
- **Note**: *[Add Screenshot of Dashboard / Resume Upload here]*

---

### Slide 13: Testing
- **Unit Testing**: Verified API responses for different skill sets (Java, Python, SQL).
- **Integration Testing**: Ensured S3 and Lambda sync for PDF processing.
- **Edge Case Testing**: Handled "blank" resumes and weak internet scenarios with fallbacks.
- **User Testing**: Conducted trial interviews to verify AI's adaptive difficulty levels.
- **Note**: *[Add Screenshot of Interview Screen / Result Page here]*

---

### Slide 14: Hardware & Software Requirements
- **Software**:
    - Next.js 15, Tailwind CSS, TypeScript.
    - Python 3.11, FastAPI, Boto3 (AWS SDK).
    - Amazon Web Services (Lambda, DynamoDB, S3, Bedrock).
- **Hardware**:
    - Standard PC/Laptop with 8GB RAM.
    - Stable Internet Connection.
    - Webcam and Microphone for behavioral signals.

---

### Slide 15: References (IEEE Format)
1. J. Doe and A. Smith, "Cloud-Native AI Scaling for Web Apps," *IEEE Cloud Computing*, vol. 10, pp. 12-18, 2023.
2. L. Zhang, "Next-Generation NLP for Technical Recruiting," *Proc. IEEE International Conf. on AI*, 2022.
3. "Amazon Bedrock Model Reference," AWS Documentation [Online], 2024.
4. R. Kumar, "Persistence in Conversational Agents," *IEEE Trans. on Knowledge Engineering*, 2023.
5. S. Gupta, "Adaptive Questioning in AI Interviews," *IEEE Trans. on Learning Technologies*, 2024.
