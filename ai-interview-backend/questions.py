import json
from utils import call_llm

def generate_questions(skill: str, level: str = "intermediate", previous_questions: list = None):
    """Generate dynamic questions based on skill and level"""
    
    previous = previous_questions or []
    previous_text = f"Previous questions: {previous}" if previous else "This is the first question."
    
    prompt = f"""
    Generate 1 technical interview question for: {skill}
    Target level: {level}
    {previous_text}
    
    The question should:
    1. Match the {level} level
    2. Be different from previous questions
    3. Test practical knowledge, not just definitions
    4. Allow for follow-up questions
    5. Include a brief context about why you're asking
    
    Return ONLY JSON:
    {{
        "questions": [
            {{
                "skill": "{skill}",
                "level": "{level}",
                "question": "Your question here",
                "context": "Why this question is being asked",
                "follow_up_potential": true/false,
                "key_points": ["point1", "point2"]
            }}
        ]
    }}
    """
    
    response = call_llm(prompt)
    print(f"\n🔍 Question generation for {skill}: {response[:200]}...")
    
    try:
        # Extract JSON from response
        if "{" in response and "}" in response:
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            return json.loads(response[json_start:json_end])
    except:
        pass
    
    # Fallback questions
    return generate_fallback_question(skill, level)

def generate_fallback_question(skill: str, level: str) -> dict:
    """Generate appropriate fallback question"""
    
    questions = {
        "beginner": [
            f"Can you explain what {skill} is and when you would use it?",
            f"What's your experience with {skill}? Can you describe a simple project where you used it?",
            f"What are the basic concepts you need to understand to work with {skill}?"
        ],
        "intermediate": [
            f"Tell me about a challenging problem you solved using {skill}. What was your approach?",
            f"How do you handle error cases and edge conditions when working with {skill}?",
            f"Compare {skill} with alternative technologies. When would you choose it over others?"
        ],
        "advanced": [
            f"Describe the architecture of a complex system you built using {skill}. What were the key design decisions?",
            f"How would you optimize a {skill}-based application for performance and scalability?",
            f"What are the most common pitfalls when working with {skill} and how do you avoid them?"
        ]
    }
    
    level_questions = questions.get(level, questions["intermediate"])
    import random
    question = random.choice(level_questions)
    
    return {
        "questions": [{
            "skill": skill,
            "level": level,
            "question": question,
            "context": f"Assessing {level} level understanding of {skill}",
            "follow_up_potential": True,
            "key_points": ["Experience", "Technical knowledge", "Problem-solving"]
        }]
    }

def generate_follow_up_question(previous_question: str, previous_answer: str, skill: str):
    """Generate a follow-up question based on previous answer"""
    
    prompt = f"""
    Based on this answer about {skill}, generate a natural follow-up question.
    
    Previous question: {previous_question}
    Candidate's answer: {previous_answer}
    
    Generate a follow-up that:
    1. Probes deeper into points they mentioned
    2. Asks for clarification on vague statements
    3. Challenges them to provide examples if they didn't
    4. Tests edge cases they might not have considered
    
    Return ONLY JSON:
    {{
        "follow_up": {{
            "question": "Your follow-up question",
            "focus": "What aspect you're probing",
            "difficulty": "same/deeper",
            "based_on": "What in their answer triggered this"
        }}
    }}
    """
    
    response = call_llm(prompt)
    try:
        if "{" in response and "}" in response:
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            return json.loads(response[json_start:json_end])
    except:
        pass
    
    return {
        "follow_up": {
            "question": f"Can you elaborate on that point? What specific challenges did you face?",
            "focus": "elaboration",
            "difficulty": "same",
            "based_on": "Need more detail"
        }
    }