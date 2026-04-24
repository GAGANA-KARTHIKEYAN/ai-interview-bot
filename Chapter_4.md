Chapter 4 

In this chapter, I have documented the overall design and architecture of the AI Interview Bot. Before starting the development, it was important to visualize how the different components like the frontend, the cloud backend, and the AI models would communicate. This chapter covers both the high-level system view and the detailed functional breakdown of each module.

4.1 Design of Mini Project

A High level design specification aims to illustrate the overall system architecture of the software while designing it. The high level diagrams are used to present a wider picture on what is the aim or functionality of different modules of the system.

4.1 High Level Design

4.1.1 System Architecture
The system follows a modern 3-Tier Serverless Cloud Architecture. By choosing this design, we ensured that the application remains entirely stateless, meaning it can scale up to handle many students without any data loss or server lag. The frontend is built on Next.js 15, which communicates with a FastAPI backend hosted on AWS Lambda. All data flows securely through an Amazon API Gateway, and persistent information like resumes and interview history are stored in AWS S3 and DynamoDB respectively.

Fig. 4.1: System Architecture of Your project
[Add screenshot of the system architecture diagram here]

4.2 Detailed Design

The Design of the System involved the following considerations:

4.2.1 Structure Chart
A structure chart is a top-down, hierarchical diagram used in software engineering to visualize a system's architecture by breaking it into modules, representing their dependencies, and detailing data/control passing.

Fig. 4.2: Structure Chart
[Add screenshot or diagram here]

Our project’s structure chart is organized into four main branches: the **Ingestion Layer**, the **Logic Layer**, the **Evaluation Layer**, and the **State Layer**. The Ingestion layer handles the input from the user's resume and camera. The Logic layer uses AI to decide the next question. The Evaluation layer scores the candidate's technical and behavioral performance, and finally, the State layer ensures everything is saved to the cloud database.

4.2.2 Functional Description of the Modules

**Resume Profiling Module**
This module is responsible for initializing the candidate's profile. It reads the uploaded file and uses NLP to identify the core technical skills that the interview should focus on.
*   **Input**: Candidate Resume (PDF or DOCX format).
*   **Output**: Structured Skill Profile (JSON list of technical competencies).

**Active Memory Module**
This module fetches the candidate's historical data. It checks if the candidate has taken any interviews before and retrieves specific "technical gaps" or weaknesses they showed in the past.
*   **Input**: Unique User Identifier (Email address).
*   **Output**: Historical Weakness Report and Performance Ledger.

**Adaptive Interview Engine**
This is the core "thinking" part of the bot. It uses the extracted skills and the historical gaps to generate a live, adaptive sequence of questions that scale across 4 difficulty levels.
*   **Input**: Current Skill target, Difficulty Level (1-4), and Historical Context.
*   **Output**: Real-time Technical Question (via Amazon Nova Lite).

**Multimodal Evaluation Hub**
This module analyzes the candidate's response in real-time. It processes the text of the answer, the voice transcription, and the video frames from the webcam to provide a hybrid score.
*   **Input**: Candidate Answer Text, Voice Stream, and Base64 Video Frames.
*   **Output**: Unified Technical Accuracy and Behavioral Confidence Scores.

**Persistence & Reporting Module**
The final module handles the wrap-up of the session. It synchronizes the latest scores with the database and generates a comprehensive report that the student can download.
*   **Input**: Aggregate Session Metrics and Individual Question Scores.
*   **Output**: Updated Performance Ledger and Final Interview Feedback Report.

CHAPTER 4 READY
