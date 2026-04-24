import collections
import collections.abc
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN

def create_presentation():
    prs = Presentation()
    
    # 1. Slide 1: Title Slide
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    title = slide.shapes.title
    subtitle = slide.placeholders[1]
    title.text = "Resilience-Enabled AI Interview Platform\n(AI Interview Bot)"
    subtitle.text = "Team Members: [Student Name & USN]\nProject Guide: Prof. Sheela S\nAssistant Professor, School of CSE, RV University"

    # Define content for all slides
    slides_data = [
        ("Problem Definition", [
            "Manual resume screening is time-consuming and inconsistent.",
            "Recruiters struggle with high volumes of candidates.",
            "Freshers lack realistic feedback-driven practice platforms.",
            "Current AI bots lack long-term 'Active Memory' to assess growth."
        ]),
        ("Introduction & Scope", [
            "Scalable serverless platform using Next.js and AWS Bedrock.",
            "AI Engine: Amazon Nova Lite for high-speed technical reasoning.",
            "Scope: Automated resume parsing, adaptive Q&A, and weakness tracking.",
            "Real-time behavioral analysis via webcam integration."
        ]),
        ("Objectives", [
            "Automate technical skill extraction from PDF/DOCX resumes.",
            "Generate adaptive, level-based questions in real-time.",
            "Implement Active Memory for tracking weaknesses via DynamoDB.",
            "Provide detailed evaluation reports summarizing technical/behavioral scores."
        ]),
        ("Literature Survey (1/3)", [
            "1. Resume Parser Using AI [1]: BERT-based models for high-accuracy skill matching.",
            "2. AI Bot for Interview Preparation [2]: Discussed multimodal analysis but high computational cost.",
            "3. AI-Based Interview System [3]: Scalable bots for standardized recruitment rounds."
        ]),
        ("Literature Survey (2/3)", [
            "4. AI-Powered Assistant Chatbot [4]: NLP-based conversational bots for simulated prep.",
            "5. MERN-Based Mock Interview System [5]: Used semantic similarity for text-based grading.",
            "6. Hiring Process Optimization [6]: Automated filtering during preliminary stages."
        ]),
        ("Literature Survey (3/3)", [
            "7. Automated Interview Assessment [7]: Focuses on voice fluency and facial expressions.",
            "8. Interview Bot: NLP and ML [8]: Standardizing interviews using ML models.",
            "Gap: Most systems lack adaptive conversational depth and long-term memory."
        ]),
        ("Proposed Methodology", [
            "1. Resume Ingestion: Secure upload to AWS S3 storage.",
            "2. Skill Extraction: AI profiling and experience mapping.",
            "3. Active Memory Loop: Retrieving past technical gaps from DynamoDB.",
            "4. Adaptive Session: Real-time Q&A with AWS Bedrock.",
            "5. Evaluation: Automated results and behavioral reports."
        ]),
        ("Requirement Specification", [
            "Functional: Resume parsing, live recording, and automated grading.",
            "Performance: Low latency (<3s) using Nova Lite edge inference.",
            "Security: AWS IAM roles and encrypted S3 data handling.",
            "Availability: Serverless scaling for concurrent sessions."
        ]),
        ("Design & Architecture", [
            "Frontend: Next.js 15 + Tailwind + Framer Motion.",
            "Backend: Python FastAPI on AWS Lambda + API Gateway.",
            "Database: AWS DynamoDB persistence.",
            "Intelligence: Amazon Nova Lite (Bedrock Converse API).",
            "[Add Architecture Diagram Here]"
        ]),
        ("Innovation", [
            "Active Memory: Stores technical gaps to re-test in future sessions.",
            "Amazon Nova Lite: High throughput for natural, adaptive dialogue.",
            "Historical RAG: Personalized 'knowledge ledger' for every candidate.",
            "Automated Evaluation: Grading based on reasoning depth, not just keywords."
        ]),
        ("Implementation", [
            "Fully migrated to AWS Serverless (Lambda, S3, DynamoDB).",
            "Custom weakness extraction logic saves gaps to DynamoDB.",
            "Responsive Next.js dashboard with Framer Motion animations.",
            "Bedrock Converse API integration for low-latency AI responses."
        ]),
        ("Testing", [
            "Unit Testing: Validated skill extraction for Java, Python, and React.",
            "Integration Testing: Verified S3-Lambda data flow efficiency.",
            "Stress Testing: Tested concurrent Lambda execution and timeout handling.",
            "Manual Verification: Conducted internal mock rounds for grading accuracy."
        ]),
        ("Hardware & Software", [
            "Software: Next.js 15, FastAPI, AWS (Bedrock, Lambda, DynamoDB).",
            "Hardware: PC with 8GB RAM, Webcam, Microphone.",
            "Connectivity: Stable internet for real-time video/AI streaming.",
            "Cloud: Entirely hosted on Amazon Web Services (AWS)."
        ]),
        ("References", [
            "[1] M. Chiranjeevi, 'Resume Parser Using AI,' IJCRT, 2024.",
            "[2] K. Waghmare et al., 'AI Bot for Interview Preparation,' 2024.",
            "[3] P. Pandeya et al., 'AI-Based Interview System,' 2025.",
            "[4] A. Singh et al., 'AI-Powered Interview Chatbot,' 2025.",
            "[5] V. Verma et al., 'AI-Powered Mock Interview System,' 2025.",
            "[9] G. N. Ashwath, 'REST API Design for Scalability,' 2024.",
            "[11] S. Raghavan, 'Groq LPU: AI Inference Architecture,' 2024."
        ])
    ]

    # Create slides
    for title_text, bullets in slides_data:
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = title_text
        
        tf = slide.placeholders[1].text_frame
        tf.word_wrap = True
        
        for bullet in bullets:
            p = tf.add_paragraph()
            p.text = bullet
            p.level = 0
            p.space_after = Pt(10)

    # Save
    prs.save('Phase3_Presentation_Automated.pptx')
    print("PowerPoint generated: Phase3_Presentation_Automated.pptx")

if __name__ == "__main__":
    create_presentation()
