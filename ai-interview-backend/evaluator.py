import json
from utils import call_llm

def evaluate_answer(question: str, answer: str):
    prompt = f"""
Evaluate this technical answer. Return ONLY JSON:

{{
  "evaluation": {{
    "capability": "strong | medium | weak",
    "confidence_level": "high | medium | low", 
    "reasoning": "string",
    "ideal_answer": "string"
  }}
}}

QUESTION: {question}
ANSWER: {answer}
"""
    response = call_llm(prompt)
    try:
        return json.loads(response)
    except:
        return {
            "evaluation": {
                "capability": "medium",
                "confidence_level": "medium", 
                "reasoning": "Basic understanding shown",
                "ideal_answer": "Detailed technical response expected"
            }
        }
