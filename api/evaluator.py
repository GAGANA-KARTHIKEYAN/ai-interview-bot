import json
from utils import call_llm

def evaluate_answer(question: str, answer: str, skill: str, context: dict = None):
    """Enhanced evaluation with context awareness"""
    
    prompt = f"""
    Evaluate this technical answer for {skill}.
    
    Question: {question}
    Answer: {answer}
    
    Context: This is part of an ongoing interview. Previous questions have established some baseline.
    
    Provide a detailed evaluation including:
    - Capability (weak/medium/strong/expert)
    - Confidence (low/medium/high)
    - Technical accuracy (what they got right/wrong)
    - Practical experience indicators
    - Communication clarity
    - Ideal answer
    - Knowledge gaps identified
    - Strengths shown
    - Follow-up suggestions
    - Overall score (1-10)
    
    Return ONLY valid JSON:
    {{
        "evaluation": {{
            "capability": "string",
            "confidence": "string",
            "technical_accuracy": {{
                "correct": ["point1", "point2"],
                "incorrect": ["point1", "point2"],
                "missed": ["point1", "point2"]
            }},
            "experience_shown": true/false,
            "communication_clarity": "string",
            "ideal_answer": "string",
            "knowledge_gaps": ["gap1", "gap2"],
            "strengths": ["strength1", "strength2"],
            "follow_up_focus": "string",
            "overall_score": 0-10,
            "feedback_summary": "string"
        }}
    }}
    """
    
    response = call_llm(prompt)
    try:
        # Try to extract JSON
        if "{" in response and "}" in response:
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            return json.loads(response[json_start:json_end])
    except:
        pass
    
    # Fallback evaluation
    return generate_fallback_evaluation(answer)

def generate_fallback_evaluation(answer: str) -> dict:
    """Generate a reasonable fallback evaluation"""
    word_count = len(answer.split())
    
    if word_count > 100:
        capability = "strong"
        score = 8
    elif word_count > 50:
        capability = "medium"
        score = 6
    else:
        capability = "weak"
        score = 4
    
    return {
        "evaluation": {
            "capability": capability,
            "confidence": "medium",
            "technical_accuracy": {
                "correct": ["General understanding"],
                "incorrect": [],
                "missed": ["Specific technical details"]
            },
            "experience_shown": word_count > 75,
            "communication_clarity": "good" if word_count > 50 else "needs improvement",
            "ideal_answer": "A strong answer should include specific examples, technical details, and demonstrate practical experience.",
            "knowledge_gaps": ["Technical depth", "Specific examples"],
            "strengths": ["Attempted to answer"],
            "follow_up_focus": "Ask for specific examples",
            "overall_score": score,
            "feedback_summary": f"Your answer shows {capability} understanding. Try to include more technical details and real-world examples."
        }
    }