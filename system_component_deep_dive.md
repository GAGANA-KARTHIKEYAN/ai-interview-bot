# System Component Deep Dive: AI Interview Platform

This document provides a detailed technical breakdown of the seven core pillars of our Intelligent Interview Platform. These components are ordered from fundamental baseline infrastructure to our most advanced intellectual innovations.

---

### **1. Persistence (The Final State)**
*   **What it is:** The system’s long-term storage and session-syncing mechanism.
*   **How it works:** After every interaction, the system synchronizes the current state (questions asked, scores received) to **AWS DynamoDB**. At the end of the session, a PDF generator compiles these metrics into a downloadable report.
*   **Why it’s used:** Since our backend (**AWS Lambda**) is "Stateless," it loses context the moment an API call ends. Persistence ensures that even if a user refreshes their browser, the interview can "rehydrate" perfectly without data loss.

### **2. Resume Ingestion (The Gateway)**
*   **What it is:** The automated entry module that builds a candidate's profile.
*   **How it works:** It uses `pdfplumber` to extract raw text from uploaded files. This text is sent to **Amazon Nova Lite** with a specific instruction to identify technical keywords, experience years, and core tools, converting a PDF into a clean, queryable JSON skill vector.
*   **Why it’s used:** It removes the need for manual data entry. By "Ingesting" the CV first, we ensure the interview is 100% personalized to the candidate’s actual background.

### **3. Multimodal Capture (The Sensing Layer)**
*   **What it is:** A parallel data-processing pipeline for Voice, Video, and Text.
*   **How it works:** While the candidate answers, the frontend uses the **Web Speech API** for instant transcription and the **MediaRecorder API** to sample video frames as Base64 strings. These are sent to the backend as a single unified "Knowledge Packet."
*   **Why it’s used:** True interviews are not just about technical answers. This layer allows the AI to "sense" the candidate’s communication style and confidence (Behavioral) alongside their knowledge (Technical).

### **4. Evaluation Hub (The Analysis Engine)**
*   **What it is:** A hybrid analysis system that merges technical scoring with Vision AI.
*   **How it works:** It uses **Llama 3.2 Vision (via Groq)** to analyze video frames for behavioral traits and **Amazon Nova Lite** to check technical accuracy. The Hub then combines these into a weighted score (e.g., 70% Technical, 30% Behavioral).
*   **Why it’s used:** It provides an objective, unbiased score. By centralizing evaluation into one "Hub," we ensure every candidate is graded on a consistent, data-driven baseline.

### **5. Dynamic Generation (The Creation Layer)**
*   **What it is:** The AI-driven engine that creates customized technical questions.
*   **How it works:** Instead of a static question bank, it sends a **Prompt Context** to **AWS Bedrock**. This context includes the candidate's skills and the desired difficulty level (1-4). The AI then generates a unique, one-of-a-kind question specifically for that user.
*   **Why it’s used:** It prevents cheating and ensures "infinite variety." No two interviews are ever the same, making the platform much more robust than standard test platforms.

### **6. Adaptive Cycle (The Pedagogical Brain)**
*   **What it is:** A logic-driven loop that manages hints, retries, and difficulty progression.
*   **How it works:** If a candidate struggle, the system chooses between offering a **Hint (Scaffolding)**, allowing a **Retry**, or moving down to a simpler level. Conversely, success triggers a move to a higher difficulty "Stage."
*   **Why it’s used:** To simulate a **Human Mentor**. It makes the interview feel like a supportive, adaptive conversation rather than a rigid, punishing test.

### **7. Active Memory (The Major Innovation)**
*   **What it is:** A RAG-based (Retrieval-Augmented Generation) system that tracks technical gaps over time.
*   **How it works:** This is the project's primary **Research Novelty**. Before an interview starts, the system queries the **DynamoDB Growth Ledger** to find what the candidate struggled with in the past. It then injects those "Historical Gaps" into the AI’s current context.
*   **Why it’s used:** It transforms the bot from a "one-off tester" to a **"Personal Career Coach."** It ensures that candidates are held accountable for their learning journey, forcing them to improve on their previous weaknesses.

---
**Document Status: FINALIZED**
