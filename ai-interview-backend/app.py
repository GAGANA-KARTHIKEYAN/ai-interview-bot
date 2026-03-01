from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import json
import os
import re
import traceback
import logging
from dotenv import load_dotenv
from groq import Groq
from typing import List, Dict, Any, Optional
import pdfplumber
from pydantic import BaseModel
# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add this CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vercel.com/gagana-karthikeyans-projects/ai-interview-bot",  # Your Vercel frontend URL
        "http://localhost:3000"  # For local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Clear any proxy settings that Render might be setting
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file")
client = Groq(api_key=GROQ_API_KEY)  # Make sure it's exactly this, no other arguments

def call_llm(prompt: str, max_tokens: int = 2000) -> str:
    """Call Groq LLM"""
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        return ""

def extract_json(text: str) -> dict:
    """Extract JSON from text with multiple fallback strategies"""
    # Try to find JSON in code blocks
    code_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    code_blocks = re.findall(code_block_pattern, text)
    
    for block in code_blocks:
        try:
            return json.loads(block.strip())
        except:
            continue
    
    # Try to find JSON object
    json_pattern = r'\{[\s\S]*\}'
    matches = re.findall(json_pattern, text)
    
    for match in matches:
        try:
            return json.loads(match)
        except:
            continue
    
    # Try to find array
    array_pattern = r'\[[\s\S]*\]'
    matches = re.findall(array_pattern, text)
    
    for match in matches:
        try:
            result = json.loads(match)
            if isinstance(result, list):
                return {"data": result}
        except:
            continue
    
    return {}

@app.get("/")
def home():
    return {"message": "AI Interview Bot API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "Backend is running"}
    
@app.post("/upload-and-analyze")
async def upload_and_analyze(cv: UploadFile = File(...)):
    """Analyze CV using AI to extract skills with experience levels"""
    
    try:
        # Extract text from PDF
        text = ""
        with pdfplumber.open(cv.file) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        # Truncate if too long
        text = text[:4000] if len(text) > 4000 else text
        logger.info(f"Extracted {len(text)} characters from CV")
        
        prompt = f"""
        You are an expert technical recruiter analyzing a candidate's CV for a software developer position.
        
        CV CONTENT:
        {text}
        
        Based on this CV content, extract ALL technical skills mentioned:
        - Programming languages (Python, JavaScript, Java, etc.)
        - Frameworks (React, Django, Spring, etc.)
        - Tools (Git, Docker, Jenkins, etc.)
        - Databases (SQL, MongoDB, PostgreSQL, etc.)
        - Cloud platforms (AWS, Azure, GCP, etc.)
        
        For each skill:
        1. Identify it from the CV
        2. Estimate experience level based on context (beginner/intermediate/advanced/expert)
        3. Categorize it appropriately
        4. Add 2-3 typical interview questions for this skill at the estimated level
        
        Return ONLY a valid JSON array with this exact structure - no other text:
        [
            {{
                "skill": "Python",
                "experience_level": "intermediate",
                "category": "language",
                "typical_questions": [
                    "Explain Python decorators and when you'd use them",
                    "How does Python handle memory management?"
                ]
            }}
        ]
        
        Include 8-15 skills. If unsure about exact level, default to "intermediate".
        """
        
        ai_response = call_llm(prompt, max_tokens=2500)
        logger.info(f"Raw AI Response length: {len(ai_response)}")
        
        # Parse AI response
        try:
            # Try to parse as JSON directly
            matched_skills = json.loads(ai_response)
            if isinstance(matched_skills, dict) and "matched_skills" in matched_skills:
                matched_skills = matched_skills["matched_skills"]
        except:
            # Try to extract JSON using regex
            json_match = re.search(r'\[\s*\{.*\}\s*\]', ai_response, re.DOTALL)
            if json_match:
                try:
                    matched_skills = json.loads(json_match.group())
                except:
                    matched_skills = []
            else:
                # Try to find array in code blocks
                code_match = re.search(r'```(?:json)?\s*(\[[\s\S]*?\])\s*```', ai_response, re.DOTALL)
                if code_match:
                    try:
                        matched_skills = json.loads(code_match.group(1))
                    except:
                        matched_skills = []
                else:
                    matched_skills = []
        
        # If still no skills, use fallback
        if not matched_skills or len(matched_skills) == 0:
            logger.warning("No skills extracted, using fallback")
            matched_skills = get_fallback_skills()
        
        # Ensure each skill has all required fields
        for skill in matched_skills:
            if "typical_questions" not in skill or not skill["typical_questions"]:
                skill["typical_questions"] = generate_fallback_questions(skill["skill"], skill.get("experience_level", "intermediate"))
            if "category" not in skill:
                skill["category"] = categorize_skill(skill["skill"])
            if "experience_level" not in skill:
                skill["experience_level"] = "intermediate"
        
        logger.info(f"Extracted {len(matched_skills)} skills")
        return {"matched_skills": matched_skills}
            
    except Exception as e:
        logger.error(f"CV Analysis Error: {traceback.format_exc()}")
        return {"matched_skills": get_fallback_skills()}

def get_fallback_skills():
    """Return fallback skills list"""
    return [
        {
            "skill": "Python", 
            "experience_level": "intermediate", 
            "category": "language",
            "typical_questions": [
                "Explain Python decorators and when you'd use them",
                "What are list comprehensions and when are they useful?"
            ]
        },
        {
            "skill": "JavaScript", 
            "experience_level": "intermediate", 
            "category": "language",
            "typical_questions": [
                "Explain closures in JavaScript",
                "How does the event loop work?"
            ]
        },
        {
            "skill": "React", 
            "experience_level": "intermediate", 
            "category": "framework",
            "typical_questions": [
                "Explain the virtual DOM and how React uses it",
                "What are React hooks and why were they introduced?"
            ]
        },
        {
            "skill": "Node.js", 
            "experience_level": "intermediate", 
            "category": "framework",
            "typical_questions": [
                "How does the event loop work in Node.js?",
                "Explain middleware in Express.js"
            ]
        },
        {
            "skill": "SQL", 
            "experience_level": "intermediate", 
            "category": "database",
            "typical_questions": [
                "Explain different types of JOINs",
                "What is normalization and why is it important?"
            ]
        },
        {
            "skill": "Git", 
            "experience_level": "intermediate", 
            "category": "tool",
            "typical_questions": [
                "Explain your Git branching strategy",
                "How do you resolve merge conflicts?"
            ]
        }
    ]

def generate_fallback_questions(skill: str, level: str) -> list:
    """Generate fallback questions for a skill"""
    base_questions = {
        "beginner": [
            f"What is {skill} and when would you use it?",
            f"Explain the basic concepts of {skill}"
        ],
        "intermediate": [
            f"What are the most important features of {skill}?",
            f"Explain a challenging problem you solved with {skill}"
        ],
        "advanced": [
            f"Explain advanced optimization techniques in {skill}",
            f"What are the common pitfalls in {skill} and how to avoid them?"
        ],
        "expert": [
            f"Design a complex system using {skill}",
            f"How would you teach {skill} to a junior developer?"
        ]
    }
    level_key = level if level in base_questions else "intermediate"
    return base_questions[level_key]

def categorize_skill(skill: str) -> str:
    """Categorize a skill based on name"""
    skill_lower = skill.lower()
    languages = ['python', 'javascript', 'java', 'typescript', 'c++', 'c#', 'go', 'rust', 'php', 'swift', 'kotlin']
    frameworks = ['react', 'angular', 'vue', 'django', 'flask', 'spring', 'express', 'node', 'next', 'nestjs']
    databases = ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'oracle', 'sqlite', 'cassandra']
    tools = ['git', 'docker', 'kubernetes', 'jenkins', 'aws', 'azure', 'gcp', 'terraform', 'ansible']
    
    if any(lang in skill_lower for lang in languages):
        return "language"
    elif any(fw in skill_lower for fw in frameworks):
        return "framework"
    elif any(db in skill_lower for db in databases):
        return "database"
    elif any(tool in skill_lower for tool in tools):
        return "tool"
    return "other"

@app.post("/start-interview")
async def start_interview(payload: dict):
    """Initialize interview with first question"""
    skills = payload.get("skills", [])
    
    if not skills:
        return {"success": False, "error": "No skills provided"}
    
    # Get first skill
    first_skill = skills[0]
    skill_name = first_skill["skill"]
    experience_level = first_skill.get("experience_level", "intermediate")
    
    # Use predefined questions if available
    if "typical_questions" in first_skill and first_skill["typical_questions"]:
        question_text = first_skill["typical_questions"][0]
        question_data = {
            "question": question_text,
            "context": f"Opening question about {skill_name}",
            "expected_depth": experience_level,
            "skill": skill_name,
            "question_type": "opening",
            "follow_up_potential": True
        }
    else:
        # Generate dynamic question
        prompt = f"""
        You are starting a technical interview for a {experience_level} level candidate.
        
        Skill to assess: {skill_name}
        Candidate's estimated level: {experience_level}
        
        Generate a natural, conversational OPENING question that:
        1. Is warm and professional
        2. Asks about their experience with {skill_name}
        3. Encourages them to share a specific project or challenge
        4. Makes them feel comfortable to start talking
        
        Return ONLY this JSON:
        {{
            "question": "Your question here",
            "context": "Brief context",
            "skill": "{skill_name}"
        }}
        """
        
        try:
            ai_response = call_llm(prompt)
            extracted = extract_json(ai_response)
            question_data = {
                "question": extracted.get("question", f"Tell me about your experience with {skill_name}"),
                "context": extracted.get("context", "Opening question"),
                "expected_depth": experience_level,
                "skill": skill_name,
                "question_type": "opening",
                "follow_up_potential": True
            }
        except:
            question_data = {
                "question": f"Let's start with {skill_name}. Could you walk me through a project where you used it? I'm interested in the challenges you faced.",
                "context": "Opening question",
                "expected_depth": experience_level,
                "skill": skill_name,
                "question_type": "opening",
                "follow_up_potential": True
            }
    
    # Create interview session state
    interview_state = {
        "current_skill_index": 0,
        "skills": skills,
        "questions_asked": {skill_name: [question_data]},
        "answers_received": {skill_name: []},
        "evaluations": {skill_name: []},
        "skill_progress": {skill_name: {"questions_asked": 1, "status": "in_progress"}},
        "conversation_flow": {
            skill_name: [{"type": "question", "content": question_data}]
        }
    }
    
    return {
        "success": True,
        "question": question_data,
        "interview_state": interview_state
    }

@app.post("/next-question")
async def next_question(payload: dict):
    """
    Dynamically generate the next question based on answer analysis
    """
    skill = payload.get("skill", "")
    previous_answer = payload.get("answer", "")
    previous_question = payload.get("question", "")
    history = payload.get("history", [])
    skills_remaining = payload.get("skills_remaining", [])
    
    if not skill or not previous_answer:
        return {
            "success": False,
            "error": "Missing required fields"
        }
    
    # First, analyze the answer
    analysis_prompt = f"""
    Analyze this candidate's answer for a technical interview.
    
    Skill: {skill}
    Question asked: {previous_question}
    Candidate's answer: {previous_answer}
    
    Analyze deeply and return JSON with:
    1. What concepts did they demonstrate understanding of?
    2. What concepts did they miss or misunderstand?
    3. How deep was their answer? (superficial / moderate / deep / expert)
    4. Did they provide specific examples from experience?
    5. What's their likely true proficiency level? (beginner/intermediate/advanced/expert)
    6. What specific aspect should be explored next?
    
    Return ONLY this JSON:
    {{
        "demonstrated_concepts": ["concept1", "concept2"],
        "missing_concepts": ["concept1", "concept2"],
        "answer_depth": "moderate",
        "had_examples": true,
        "true_proficiency": "intermediate",
        "next_focus": "specific area to probe next"
    }}
    """
    
    try:
        analysis_response = call_llm(analysis_prompt)
        analysis = extract_json(analysis_response)
        if not analysis:
            analysis = {
                "demonstrated_concepts": [],
                "missing_concepts": [],
                "answer_depth": "moderate",
                "had_examples": False,
                "true_proficiency": "intermediate",
                "next_focus": "general"
            }
    except:
        analysis = {
            "demonstrated_concepts": [],
            "missing_concepts": [],
            "answer_depth": "moderate",
            "had_examples": False,
            "true_proficiency": "intermediate",
            "next_focus": "general"
        }
    
    # Determine if we should ask a follow-up or move on
    questions_asked = len([h for h in history if h.get("skill") == skill])
    
    # Decision logic
    should_transition = False
    reason = "Continue exploring"
    
    if questions_asked >= 3 and analysis.get("answer_depth") in ["deep", "expert"]:
        should_transition = True
        reason = "Strong understanding shown, moving to next skill"
    elif questions_asked >= 4:
        should_transition = True
        reason = "Sufficient questions asked for this skill"
    elif analysis.get("answer_depth") == "superficial" and questions_asked >= 3:
        should_transition = True
        reason = "Limited depth, moving on to assess other areas"
    
    # If we should transition and there are more skills
    if should_transition and skills_remaining:
        return {
            "success": True,
            "should_transition": {"transition": True, "reason": reason, "next_skill": skills_remaining[0] if skills_remaining else None},
            "analysis": analysis
        }
    elif should_transition and not skills_remaining:
        return {
            "success": True,
            "should_transition": {"transition": True, "reason": "Interview complete", "complete": True},
            "analysis": analysis
        }
    
    # Generate contextual follow-up question
    question_prompt = f"""
    You're a technical interviewer. Based on this candidate's answer, ask a natural follow-up question.
    
    Skill: {skill}
    Previous question: {previous_question}
    Candidate's answer: {previous_answer}
    
    Analysis:
    - Demonstrated: {analysis.get('demonstrated_concepts', [])}
    - Missing: {analysis.get('missing_concepts', [])}
    - Depth: {analysis.get('answer_depth')}
    - Had examples: {analysis.get('had_examples')}
    - Next focus: {analysis.get('next_focus', 'general')}
    
    Generate a SINGLE follow-up question that:
    1. ACKNOWLEDGES something they said (e.g., "You mentioned X, that's interesting...")
    2. Probes deeper into an area they didn't fully explain
    3. Asks for a specific example if they didn't provide one
    4. Sounds natural and conversational
    
    Return ONLY this JSON:
    {{
        "question": "Your follow-up question",
        "context": "Why you're asking this",
        "focus_area": "what this targets",
        "skill": "{skill}"
    }}
    """
    
    try:
        question_response = call_llm(question_prompt)
        next_question = extract_json(question_response)
        
        if not next_question or "question" not in next_question:
            # Fallback questions based on analysis
            if not analysis.get("had_examples"):
                next_question = {
                    "question": f"You mentioned some aspects of {skill}. Could you share a specific example where you applied it in a real project?",
                    "context": "Asking for concrete example",
                    "focus_area": "examples",
                    "skill": skill
                }
            elif analysis.get("missing_concepts"):
                next_question = {
                    "question": f"Can you elaborate more on {analysis['missing_concepts'][0]}? How does that work in practice?",
                    "context": "Probing missing concept",
                    "focus_area": analysis['missing_concepts'][0],
                    "skill": skill
                }
            else:
                next_question = {
                    "question": f"Based on what you've shared, can you tell me about a challenging problem you solved with {skill}?",
                    "context": "Seeking depth",
                    "focus_area": "challenges",
                    "skill": skill
                }
    except:
        next_question = {
            "question": f"Can you tell me more about your experience with {skill}? What was the most challenging aspect?",
            "context": "Follow-up",
            "focus_area": "general",
            "skill": skill
        }
    
    return {
        "success": True,
        "next_question": next_question,
        "analysis": analysis,
        "should_transition": {"transition": False, "reason": reason}
    }

@app.post("/evaluate")
async def evaluate(payload: dict):
    """
    Comprehensive evaluation of answer with detailed feedback
    """
    question = payload.get("question", "")
    answer = payload.get("answer", "")
    skill = payload.get("skill", "")
    
    prompt = f"""
    You're a technical interviewer evaluating a candidate's answer.
    
    Skill: {skill}
    Question: {question}
    Answer: {answer}
    
    Evaluate this answer and provide comprehensive feedback. Be extremely detailed.
    
    Return ONLY this JSON:
    {{
        "evaluation": {{
            "capability": "weak/medium/strong/expert",
            "confidence": "low/medium/high",
            "technical_accuracy": {{
                "correct_concepts": ["concept1", "concept2"],
                "missed_concepts": ["concept1", "concept2"],
                "misunderstood_concepts": ["concept1", "concept2"]
            }},
            "gaps_identified": {{
                "knowledge_gaps": ["specific gap 1", "specific gap 2"],
                "depth_gaps": ["should have explained X", "missed Y"],
                "example_gaps": "Didn't provide concrete examples"
            }},
            "experience_indicators": {{
                "had_real_examples": true/false,
                "discussed_challenges": true/false,
                "example_quality": "poor/good/excellent",
                "star_method_used": true/false
            }},
            "communication": {{
                "clarity": "low/medium/high",
                "structure": "poor/good/excellent",
                "hesitation_markers": true/false,
                "pacing": "too_fast/balanced/slow",
                "filler_words": true/false
            }},
            "strengths": ["strength1", "strength2", "strength3"],
            "areas_for_improvement": ["area1", "area2", "area3"],
            "ideal_answer": "Provide a comprehensive model answer that would be considered excellent. Include key technical points, structure, and depth expected.",
            "scores": {{
                "technical_score": 0-10,
                "confidence_score": 0-10,
                "communication_score": 0-10,
                "behavioral_score": 0-10,
                "overall_score": 0-10
            }},
            "score_explanations": {{
                "technical_explanation": "Why this technical score was given",
                "confidence_explanation": "Analysis of confidence markers",
                "communication_explanation": "Why this communication score",
                "behavioral_explanation": "Explanation of behavioral score"
            }},
            "summary_feedback": "2-3 sentence summary for the candidate"
        }}
    }}
    """
    
    try:
        ai_response = call_llm(prompt, max_tokens=4000)
        result = extract_json(ai_response)
        
        if result and "evaluation" in result:
            evaluation = result["evaluation"]
        elif result:
            evaluation = result
        else:
            evaluation = generate_fallback_evaluation(answer)
        
        return {"evaluation": evaluation}
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        return {"evaluation": generate_fallback_evaluation(answer)}

def generate_fallback_evaluation(answer: str) -> dict:
    """Generate fallback evaluation"""
    word_count = len(answer.split())
    
    if word_count > 100:
        capability = "strong"
        tech_score = 8
    elif word_count > 50:
        capability = "medium"
        tech_score = 6
    else:
        capability = "weak"
        tech_score = 4
    
    return {
        "capability": capability,
        "confidence": "medium",
        "technical_accuracy": {
            "correct_concepts": ["Basic understanding shown"],
            "missed_concepts": ["Technical depth could be improved"],
            "misunderstood_concepts": []
        },
        "gaps_identified": {
            "knowledge_gaps": ["Missing specific technical details"],
            "depth_gaps": ["Surface-level explanation only"],
            "example_gaps": "No concrete examples provided"
        },
        "experience_indicators": {
            "had_real_examples": word_count > 75,
            "discussed_challenges": False,
            "example_quality": "good" if word_count > 100 else "poor",
            "star_method_used": False
        },
        "communication": {
            "clarity": "high" if word_count > 50 else "medium",
            "structure": "good" if word_count > 75 else "fair",
            "hesitation_markers": False,
            "pacing": "balanced",
            "filler_words": False
        },
        "strengths": ["Attempted to answer the question"],
        "areas_for_improvement": ["Add specific examples", "Include technical details", "Structure answer better"],
        "ideal_answer": "A strong answer should include specific technical details, real-world examples, and demonstrate deep understanding through clear explanation of concepts and their practical application.",
        "scores": {
            "technical_score": tech_score,
            "confidence_score": 6,
            "communication_score": 6,
            "behavioral_score": 5,
            "overall_score": tech_score
        },
        "score_explanations": {
            "technical_explanation": f"Answer shows {capability} technical understanding",
            "confidence_explanation": "Medium confidence based on answer length and detail",
            "communication_explanation": "Communication is adequate but could be clearer",
            "behavioral_explanation": "Limited behavioral/experiential examples provided"
        },
        "summary_feedback": f"Your answer shows {capability} understanding. Try to include more specific technical details and real-world examples."
    }

@app.post("/generate-skill-summary")
async def generate_skill_summary(payload: dict):
    """Generate summary for a skill after multiple questions"""
    skill = payload.get("skill", "")
    history = payload.get("history", [])
    evaluations = payload.get("evaluations", [])
    
    prompt = f"""
    Create a summary of the candidate's knowledge for {skill}.
    
    Q&A history: {json.dumps(history, indent=2)[:1000]}
    Evaluations: {json.dumps(evaluations, indent=2)[:1000]}
    
    Return ONLY this JSON:
    {{
        "skill": "{skill}",
        "proficiency_level": "beginner/intermediate/advanced/expert",
        "strengths": ["strength1", "strength2"],
        "weaknesses": ["weakness1", "weakness2"],
        "recommendations": ["rec1", "rec2"],
        "summary": "2-3 sentence summary"
    }}
    """
    
    try:
        ai_response = call_llm(prompt)
        summary = extract_json(ai_response)
        if not summary:
            summary = {
                "skill": skill,
                "proficiency_level": "intermediate",
                "strengths": ["Shows interest"],
                "weaknesses": ["Needs more depth"],
                "recommendations": ["Practice with real projects"],
                "summary": f"Candidate shows basic understanding of {skill}."
            }
        return summary
    except:
        return {
            "skill": skill,
            "proficiency_level": "intermediate",
            "strengths": ["Attempted to answer"],
            "weaknesses": ["Could provide more detail"],
            "recommendations": ["Review fundamentals"],
            "summary": f"Assessment completed for {skill}."
        }

@app.post("/final-report")
async def final_report(payload: dict):
    """Generate comprehensive final interview report"""
    skills = payload.get("skills", [])
    skill_summaries = payload.get("skill_summaries", [])
    
    prompt = f"""
    Create a final interview report.
    
    Skills assessed: {json.dumps(skills, indent=2)[:500]}
    Skill summaries: {json.dumps(skill_summaries, indent=2)[:500]}
    
    Return ONLY this JSON:
    {{
        "overall_score": 0-100,
        "overall_proficiency": "junior/mid/senior/lead",
        "technical_strengths": ["strength1", "strength2"],
        "development_areas": ["area1", "area2"],
        "hiring_recommendation": "strong_yes/yes/with_reservations/no",
        "summary": "2-3 sentence overall summary",
        "skill_breakdown": {{
            "skill_name": "proficiency_level"
        }}
    }}
    """
    
    try:
        ai_response = call_llm(prompt, max_tokens=3000)
        report = extract_json(ai_response)
        if not report:
            report = {
                "overall_score": 70,
                "overall_proficiency": "mid",
                "hiring_recommendation": "with_reservations",
                "summary": "Candidate shows potential but needs more depth in key areas."
            }
        return report
    except:
        return {
            "overall_score": 70,
            "overall_proficiency": "mid",
            "hiring_recommendation": "with_reservations",
            "summary": "Interview completed successfully."
        }
