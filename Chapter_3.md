Chapter 3

In this chapter, I have outlined the core requirements needed to build and run the AI Interview Bot. Before we started the actual coding, we had to clearly define what the system should do (Functional) and how well it should perform (Non-Functional). I also detailed the specific hardware and software tools we used to make sure the platform stays stable, even when multiple candidates are taking interviews at the same time.

3.1 Functional Requirements 
Functional requirements describe the actual tasks our system can perform. Based on our project scope, the following features were implemented:
*   **User Management**: Candidates can register and login securely to access their own personalized interview dashboard.
*   **Resume Ingestion**: The system allows users to upload their resumes in PDF or DOCX formats, which are then parsed to extract specific technical skills.
*   **Adaptive Questioning**: The AI generates technical questions in real-time, scaling the difficulty from level 1 to level 4 based on the candidate's previous performance.
*   **Multimodal Response**: The platform captures responses through three separate streams: text inputs, voice-to-text transcription, and video-frame analysis.
*   **Automated Evaluation**: Our hub evaluates the technical depth of the answer while simultaneously checking behavioral signals like confidence and eye contact.
*   **Growth Ledger Persistence**: Every interview session is stored in a database so that the "Active Memory" feature can track student weaknesses over multiple sessions.

3.2 Non Functional Requirements 
Non-functional requirements focus on the "quality" of the system. We wanted to make sure the app feels professional and reliable:
*   **High Performance**: The AI reasoning engine (Amazon Nova Lite) is tuned to generate questions and feedback in less than 3 seconds to avoid awkward silences.
*   **Serverless Scalability**: By using AWS Lambda, the system can automatically scale up to handle hundreds of concurrent users without any manual server management.
*   **Data Security**: We used secure IAM roles and encrypted S3 buckets to ensure that candidate resumes and interview data are never leaked.
*   **Interactive Usability**: The Next.js dashboard was designed with smooth animations to keep the user focused and relaxed during the interview process.
*   **System Reliability**: The backend is stateless, meaning if a candidate's internet blips, they can refresh the page and rehydrate their session without losing progress.

3.3 Hardware Requirements 
The hardware requirements formulated for the project were:
*   **Personal Computer/Laptop**: A standard machine for running the web application.
*   **Memory**: At least 8 GB of RAM to handle modern browser tabs and media streams simultaneously.
*   **Communication Peripherals**: A working Webcam and Microphone are mandatory for capturing the candidate's behavioral and voice responses.
*   **Internet Connectivity**: A stable broadband connection is required for low-latency communication with the AWS Bedrock and Groq APIs.

Fig. 3.1: Requirement Overview Diagram
[Add screenshot or diagram showing the relationship between User, Resume, and AI layers]

3.4 Software requirements 
The software requirements formulated for this project were:
*   **Frontend Framework**: **Next.js 15** with TypeScript and Tailwind CSS for a modern, responsive UI.
*   **Backend Framework**: **FastAPI** (Python 3.11) for handling high-concurrency API requests.
*   **Compute Infrastructure**: **AWS Lambda** and **API Gateway** for an entirely serverless backend.
*   **Data Storage**: **AWS DynamoDB** for session history (Ledger) and **AWS S3** for resume asset storage.
*   **AI Models**: **Amazon Bedrock (Nova Lite)** for technical reasoning and **Groq (Llama 3.2 Vision)** for behavioral analysis.
*   **Capture APIs**: Browser-based **Web Speech API** for transcription and **MediaRecorder** for frame capture.

Fig. 3.2: System Architecture Diagram
[Add screenshot of the 3-tier architecture diagram from the presentation]

3.5 Summary
To summarize, this chapter defined the total environment needed for the AI Interview Bot to function correctly in a real-world scenario. By combining a powerful frontend like Next.js with a serverless AWS backend, we've created a system that is both feature-rich and highly efficient. These requirements serve as the blueprint for the System Design and Implementation chapters that follow.

CHAPTER 3 READY
