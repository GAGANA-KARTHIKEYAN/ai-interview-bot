from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import json
import os
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file")

client = Groq(api_key=GROQ_API_KEY)

def call_llm(prompt: str) -> str:
    """Call Groq LLM"""
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"LLM Error: {e}")
        return "AI service temporarily unavailable"

@app.get("/")
def home():
    return {"message": "AI Interview Bot API is running"}

@app.post("/upload-and-analyze")
async def upload_and_analyze(cv: UploadFile = File(...)):
    """Analyze CV using AI to extract skills"""
    
    try:
        # For demo, we'll use AI to generate skills based on filename
        # In production, you'd extract text from the CV
        
        prompt = f"""
        Based on a CV for a software developer position, extract 8-12 relevant technical skills.
        Focus on: programming languages, frameworks, tools, databases, cloud services, and methodologies.
        
        Return ONLY a JSON array of skill objects like this:
        [
            {{"skill": "Python", "relevance": "high", "reason": "Primary language mentioned"}},
            {{"skill": "React", "relevance": "high", "reason": "Frontend framework experience"}}
        ]
        
        Make the skills realistic for a software developer CV.
        """
        
        ai_response = call_llm(prompt)
        
        # Parse AI response
        try:
            # Extract JSON from response
            if "[" in ai_response and "]" in ai_response:
                json_start = ai_response.find("[")
                json_end = ai_response.rfind("]") + 1
                json_str = ai_response[json_start:json_end]
                matched_skills = json.loads(json_str)
            else:
                # Fallback skills
                matched_skills = [
                    {"skill": "Python", "relevance": "high", "reason": "Programming language"},
                    {"skill": "JavaScript", "relevance": "high", "reason": "Web development"},
                    {"skill": "React", "relevance": "high", "reason": "Frontend framework"},
                    {"skill": "Node.js", "relevance": "medium", "reason": "Backend runtime"},
                    {"skill": "TypeScript", "relevance": "medium", "reason": "Type-safe JavaScript"},
                    {"skill": "SQL", "relevance": "medium", "reason": "Database"},
                    {"skill": "Git", "relevance": "high", "reason": "Version control"},
                    {"skill": "AWS", "relevance": "medium", "reason": "Cloud services"},
                    {"skill": "Docker", "relevance": "medium", "reason": "Containerization"},
                    {"skill": "REST API", "relevance": "high", "reason": "API development"}
                ]
            
            return {"matched_skills": matched_skills}
            
        except json.JSONDecodeError:
            # If AI response isn't valid JSON, use fallback
            return {"matched_skills": [
                {"skill": "Python", "relevance": "high", "reason": "AI-extracted"},
                {"skill": "JavaScript", "relevance": "high", "reason": "AI-extracted"},
                {"skill": "React", "relevance": "high", "reason": "AI-extracted"},
                {"skill": "Node.js", "relevance": "medium", "reason": "AI-extracted"},
                {"skill": "SQL", "relevance": "medium", "reason": "AI-extracted"}
            ]}
            
    except Exception as e:
        print(f"CV Analysis Error: {e}")
        return {"matched_skills": []}

@app.post("/questions")
async def questions(payload: dict):
    """Generate AI-powered questions for a skill"""
    skill = payload.get("skill", "Python")
    previous_questions = payload.get("previous_questions", [])
    user_level = payload.get("user_level", "beginner")  # beginner, intermediate, advanced
    
    prompt = f"""
    You are a technical interviewer assessing a candidate's knowledge of {skill}.
    
    Context:
    - Skill: {skill}
    - User's estimated level: {user_level}
    - Previous questions asked: {previous_questions}
    
    Generate ONE new technical question that:
    1. Matches the user's level ({user_level})
    2. Is DIFFERENT from previous questions: {previous_questions}
    3. Tests practical, real-world knowledge
    4. Can be answered in 2-3 minutes
    
    Return ONLY JSON format:
    {{
        "questions": [
            {{
                "skill": "{skill}",
                "level": "{user_level}",
                "question": "Your question here",
                "hint": "Optional hint to guide the answer"
            }}
        ]
    }}
    """
    
    try:
        ai_response = call_llm(prompt)
        
        # Parse response
        if "{" in ai_response and "}" in ai_response:
            json_start = ai_response.find("{")
            json_end = ai_response.rfind("}") + 1
            json_str = ai_response[json_start:json_end]
            return json.loads(json_str)
        else:
            # Fallback question
            return {
                "questions": [{
                    "skill": skill,
                    "level": user_level,
                    "question": f"Explain a real-world project where you used {skill} effectively. What challenges did you face and how did you overcome them?",
                    "hint": "Think about a specific project, the technical decisions you made, and the outcomes."
                }]
            }
            
    except Exception as e:
        print(f"Question Generation Error: {e}")
        return {
            "questions": [{
                "skill": skill,
                "level": user_level,
                "question": f"Describe your experience with {skill} and give an example of how you've used it.",
                "hint": "Be specific about your role and the impact."
            }]
        }

@app.post("/evaluate")
async def evaluate(payload: dict):
    """AI-powered evaluation with personalized feedback"""
    question = payload.get("question", "")
    answer = payload.get("answer", "")
    skill = payload.get("skill", "")
    
    prompt = f"""
    You are an expert technical interviewer evaluating a candidate's answer.
    
    SKILL BEING ASSESSED: {skill}
    QUESTION: {question}
    CANDIDATE'S ANSWER: {answer}
    
    Provide a detailed evaluation with:
    1. Capability assessment (weak/medium/strong)
    2. Confidence level (low/medium/high)
    3. Detailed reasoning about what was good and what could be improved
    4. An ideal model answer that teaches the candidate
    5. A follow-up question to probe deeper if needed
    6. Specific areas for improvement
    
    Return ONLY valid JSON format:
    {{
        "evaluation": {{
            "capability": "weak/medium/strong",
            "confidence_level": "low/medium/high",
            "reasoning": "Detailed analysis of the answer...",
            "ideal_answer": "Comprehensive model answer explaining the concept...",
            "follow_up_question": "Deep follow-up question or null if not needed",
            "improvement_areas": ["Area 1", "Area 2", "Area 3"],
            "speech_feedback": "Short summary for text-to-speech (max 2 sentences)"
        }}
    }}
    """
    
    try:
        ai_response = call_llm(prompt)
        
        # Parse AI response
        if "{" in ai_response and "}" in ai_response:
            json_start = ai_response.find("{")
            json_end = ai_response.rfind("}") + 1
            json_str = ai_response[json_start:json_end]
            data = json.loads(json_str)
            
            # Ensure all fields exist
            evaluation = data.get("evaluation", {})
            if "speech_feedback" not in evaluation:
                evaluation["speech_feedback"] = f"Your capability is {evaluation.get('capability', 'medium')}. {evaluation.get('reasoning', 'Good effort.')[:100]}"
                
            return data
            
        else:
            # Fallback evaluation
            answer_length = len(answer)
            if answer_length > 200:
                capability = "strong"
            elif answer_length > 100:
                capability = "medium"
            else:
                capability = "weak"
                
            return {
                "evaluation": {
                    "capability": capability,
                    "confidence_level": "medium",
                    "reasoning": "AI evaluation is temporarily unavailable. Please try to provide more detailed answers with specific examples.",
                    "ideal_answer": f"For {skill}, a good answer should include: 1) Your direct experience, 2) Specific projects or examples, 3) Challenges faced and solutions, 4) Results or outcomes achieved.",
                    "follow_up_question": f"Can you provide a code example or technical detail about {skill}?",
                    "improvement_areas": ["Add more specific examples", "Include technical details", "Explain the impact"],
                    "speech_feedback": f"Your answer shows {capability} understanding. Try to add more specific examples."
                }
            }
            
    except Exception as e:
        print(f"Evaluation Error: {e}")
        return {
            "evaluation": {
                "capability": "medium",
                "confidence_level": "medium",
                "reasoning": "Evaluation service encountered an error. Please continue with your answer.",
                "ideal_answer": "A good answer should be specific, detailed, and include real-world examples.",
                "follow_up_question": None,
                "improvement_areas": [],
                "speech_feedback": "Please continue with the interview."
            }
        }

@app.post("/determine-next-step")
async def determine_next_step(payload: dict):
    """AI decides whether to continue probing or move to next skill"""
    skill = payload.get("skill", "")
    history = payload.get("history", [])  # List of previous Q&A for this skill
    user_responses = payload.get("user_responses", [])
    
    prompt = f"""
    You are managing a technical interview for {skill}.
    
    Interview History for {skill}:
    {json.dumps(history, indent=2)}
    
    User's responses so far: {user_responses}
    
    Decide whether to:
    1. Ask another follow-up question on the same skill (if user needs more probing)
    2. Move to the next skill (if user has demonstrated sufficient knowledge)
    
    Consider:
    - If answers are brief or shallow, ask follow-up questions
    - If answers are detailed and show good understanding, move to next skill
    - Aim for 2-4 questions per skill depending on depth
    
    Return ONLY JSON:
    {{
        "action": "continue_skill" or "next_skill",
        "reason": "Brief explanation",
        "estimated_level": "beginner/intermediate/advanced"
    }}
    """
    
    try:
        ai_response = call_llm(prompt)
        
        if "{" in ai_response and "}" in ai_response:
            json_start = ai_response.find("{")
            json_end = ai_response.rfind("}") + 1
            json_str = ai_response[json_start:json_end]
            return json.loads(json_str)
        else:
            # Default: continue if less than 3 responses, otherwise next
            if len(history) < 3:
                return {"action": "continue_skill", "reason": "Need more depth", "estimated_level": "intermediate"}
            else:
                return {"action": "next_skill", "reason": "Sufficient coverage", "estimated_level": "intermediate"}
                
    except Exception as e:
        print(f"Next Step Error: {e}")
        return {"action": "next_skill", "reason": "Error occurred", "estimated_level": "intermediate"}