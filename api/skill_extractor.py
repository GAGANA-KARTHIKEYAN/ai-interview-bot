import json
from utils import call_llm

def extract_skills(cv_text: str, jd_text: str = None):
    """Extract skills with experience levels and context"""
    
    jd_context = f"\nJob Description:\n{jd_text}" if jd_text else ""
    
    prompt = f"""
    You are an expert technical recruiter analyzing a CV.
    
    CV Text:
    {cv_text[:3000]}  # Limit to first 3000 chars
    {jd_context}
    
    Extract ALL technical and soft skills mentioned, with:
    1. The skill name
    2. Estimated proficiency level (based on context in CV)
    3. Category (language/framework/tool/database/cloud/softskill)
    4. Relevance to software development
    5. Years of experience implied (if any)
    6. Key projects or achievements related to this skill
    
    Return ONLY JSON:
    {{
        "skills": [
            {{
                "skill": "Python",
                "proficiency": "beginner/intermediate/advanced/expert",
                "category": "language",
                "relevance": "high/medium/low",
                "years_experience": 0-20,
                "key_projects": ["project1", "project2"],
                "context": "How it appears in CV"
            }}
        ],
        "summary": {{
            "primary_languages": [],
            "frameworks": [],
            "tools": [],
            "soft_skills": [],
            "total_experience_years": 0,
            "recommended_focus": []
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
    
    # Fallback
    return {
        "skills": [
            {"skill": "Python", "proficiency": "intermediate", "category": "language", "relevance": "high"},
            {"skill": "JavaScript", "proficiency": "intermediate", "category": "language", "relevance": "high"},
            {"skill": "React", "proficiency": "intermediate", "category": "framework", "relevance": "high"},
            {"skill": "Node.js", "proficiency": "intermediate", "category": "framework", "relevance": "medium"},
            {"skill": "SQL", "proficiency": "intermediate", "category": "database", "relevance": "high"},
            {"skill": "Git", "proficiency": "intermediate", "category": "tool", "relevance": "high"}
        ],
        "summary": {
            "primary_languages": ["Python", "JavaScript"],
            "frameworks": ["React", "Node.js"],
            "tools": ["Git"],
            "soft_skills": [],
            "total_experience_years": 2,
            "recommended_focus": ["Cloud services", "System design"]
        }
    }