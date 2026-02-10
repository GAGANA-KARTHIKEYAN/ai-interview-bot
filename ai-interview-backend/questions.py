import json
from utils import call_llm

def generate_questions(skill: str):
    prompt = f"""Generate 1 PERFECT technical interview question for: {skill}

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "skill": "{skill}",
      "level": "technical",
      "question": "Your detailed technical question here"
    }}
  ]
}}"""

    response = call_llm(prompt)
    print(f"\n🔍 RAW LLM RESPONSE for {skill}: {response}")

    try:
        return json.loads(response)
    except:
        return {
            "questions": [{
                "skill": skill,
                "question": f"Explain how you would implement {skill} in production"
            }]
        }
