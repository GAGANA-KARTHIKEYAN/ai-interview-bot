import json
from utils import call_llm

def extract_skills(cv_text: str, jd_text: str):
    prompt = f"""
You are an AI that extracts skills.

CV:
{cv_text}

Job Description:
{jd_text}

TASK:
1. Identify skills present in BOTH CV and JD
2. Return ONLY valid JSON

{{
  "matched_skills": [
    {{
      "skill": "string",
      "relevance": "high | medium | low",
      "reason": "string"
    }}
  ]
}}
"""
    response = call_llm(prompt)
    try:
        return json.loads(response)
    except:
        return {"matched_skills": []}
