
# Intelligent AI Interview Platform

An adaptive, serverless technical recruitment platform that conducts real-time multimodal interviews. This application utilizes generative AI to parse resumes, dynamically generate technical questions, evaluate behavioral metrics, and track candidate growth across multiple sessions.

## Features

- **Automated Resume Parsing:** Extracts technical skills and experience from PDF resumes using `pdfplumber`.
- **Active Memory (RAG):** Persists candidate history in DynamoDB and uses Retrieval-Augmented Generation to re-test historical weaknesses in subsequent interviews.
- **Adaptive Difficulty Engine:** Adjusts the complexity of technical questions in real-time based on the candidate's previous answers.
- **Multimodal Evaluation:** Simultaneously processes text transcripts and live webcam frames (Base64) using Amazon Bedrock (Nova Lite) to score both technical accuracy and behavioral confidence.
- **Serverless Architecture:** Fully decoupled frontend and backend for massive horizontal scalability and sub-3-second inference latency.

## Technology Stack

- **Frontend:** Next.js 15, React Webcam (Deployed on AWS Amplify)
- **Backend API:** FastAPI wrapped in Mangum (AWS Lambda via API Gateway)
- **Generative AI:** Amazon Nova Lite Multimodal (via AWS Bedrock)
- **Database & Storage:** Amazon DynamoDB (Active Memory Ledger) & Amazon S3 (Resume Storage)

##  Architecture

1. **Client Tier:** Next.js dashboard securely captures user input and transmits Base64 webcam frames asynchronously.
2. **Logic Tier:** AWS API Gateway routes traffic to a stateless AWS Lambda function running Python (FastAPI).
3. **Resource Tier:** Lambda offloads heavy multimodal inference to Amazon Bedrock and retrieves historical context from DynamoDB.

## Local Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- AWS Account with Bedrock (Nova Lite access), S3, and DynamoDB configured.

### Environment Variables
Create a `.env` file in your backend directory:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=InterviewLedger
S3_BUCKET_NAME=interview-resumes
```

### Running the Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Running the Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📄 License
This project was developed in association with LNA Technologies Private Limited as part of an academic internship program.
