from typing import List, Dict, Any
import json
from utils import call_llm

class InterviewFlowManager:
    """
    Manages the dynamic interview flow, deciding when to probe deeper or move on
    """
    
    def __init__(self):
        self.current_skill_index = 0
        self.skill_sessions = {}  # skill -> {questions, answers, evaluations}
        self.overall_context = {
            "skills_covered": [],
            "current_depth": "initial",
            "user_level_estimate": "intermediate"
        }
    
    def initialize_skills(self, skills: list):
        """Initialize interview sessions for each skill"""
        for skill in skills:
            self.skill_sessions[skill["skill"]] = {
                "skill_data": skill,
                "questions": [],
                "answers": [],
                "evaluations": [],
                "status": "pending",  # pending, in_progress, completed
                "proficiency_estimate": None
            }
    
    def should_continue_skill(self, skill: str) -> dict:
        """Determine if we should ask another question for this skill"""
        session = self.skill_sessions.get(skill, {})
        questions_asked = len(session.get("questions", []))
        evaluations = session.get("evaluations", [])
        
        # If no questions asked yet, definitely continue
        if questions_asked == 0:
            return {"continue": True, "reason": "First question", "depth": "initial"}
        
        # If less than 2 questions, continue for baseline
        if questions_asked < 2:
            return {"continue": True, "reason": "Need more baseline", "depth": "establishing"}
        
        # Analyze last evaluation
        if evaluations:
            last_eval = evaluations[-1]
            capability = last_eval.get("capability", "medium")
            
            # If answer was weak and we've asked few questions, probe deeper
            if capability == "weak" and questions_asked < 4:
                return {"continue": True, "reason": "Weak answer needs probing", "depth": "probing"}
            
            # If answer was strong but we haven't covered depth, ask advanced
            if capability == "strong" and questions_asked < 3:
                return {"continue": True, "reason": "Test advanced knowledge", "depth": "advanced"}
            
            # If we've asked 3+ questions, evaluate overall
            if questions_asked >= 3:
                # Check pattern of answers
                capabilities = [e.get("capability", "medium") for e in evaluations]
                strong_count = sum(1 for c in capabilities if c == "strong")
                weak_count = sum(1 for c in capabilities if c == "weak")
                
                if strong_count >= 2:
                    return {"continue": False, "reason": "Strong understanding shown", "depth": "sufficient"}
                elif weak_count >= 2 and questions_asked >= 4:
                    return {"continue": False, "reason": "Fundamental gaps - note for review", "depth": "incomplete"}
                elif questions_asked >= 5:
                    return {"continue": False, "reason": "Sufficient questions asked", "depth": "adequate"}
        
        # Default to continue if uncertain
        return {"continue": True, "reason": "Gather more information", "depth": "ongoing"}
    
    def determine_next_question_type(self, skill: str) -> str:
        """Determine what type of question to ask next"""
        session = self.skill_sessions.get(skill, {})
        questions = session.get("questions", [])
        
        if len(questions) == 0:
            return "opening"
        
        # Check last evaluation
        evaluations = session.get("evaluations", [])
        if evaluations:
            last_eval = evaluations[-1]
            capability = last_eval.get("capability", "medium")
            
            if capability == "weak":
                return "fundamental_probing"
            elif capability == "medium":
                return "deepening"
            else:
                return "advanced"
        
        return "probing"
    
    def update_session(self, skill: str, question: str, answer: str, evaluation: dict):
        """Update session with new Q&A"""
        if skill in self.skill_sessions:
            session = self.skill_sessions[skill]
            session["questions"].append(question)
            session["answers"].append(answer)
            session["evaluations"].append(evaluation)
            
            # Update proficiency estimate based on evaluations
            capabilities = [e.get("capability", "medium") for e in session["evaluations"]]
            if capabilities:
                avg_score = sum({"weak": 1, "medium": 2, "strong": 3}.get(c, 2) for c in capabilities) / len(capabilities)
                if avg_score >= 2.5:
                    session["proficiency_estimate"] = "advanced"
                elif avg_score >= 1.5:
                    session["proficiency_estimate"] = "intermediate"
                else:
                    session["proficiency_estimate"] = "beginner"
    
    def get_next_skill(self) -> dict:
        """Get the next skill to interview"""
        pending_skills = [s for s, data in self.skill_sessions.items() if data["status"] == "pending"]
        
        if not pending_skills:
            return None
        
        # Return first pending skill
        next_skill = pending_skills[0]
        self.skill_sessions[next_skill]["status"] = "in_progress"
        
        return {
            "skill": next_skill,
            "data": self.skill_sessions[next_skill]["skill_data"]
        }
    
    def complete_skill(self, skill: str):
        """Mark skill as completed"""
        if skill in self.skill_sessions:
            self.skill_sessions[skill]["status"] = "completed"
            self.overall_context["skills_covered"].append(skill)
    
    def generate_summary(self) -> dict:
        """Generate overall interview summary"""
        summary = {
            "skills_assessed": [],
            "overall_proficiency": "intermediate",
            "strengths": [],
            "weaknesses": [],
            "recommendations": []
        }
        
        for skill, session in self.skill_sessions.items():
            if session["status"] == "completed":
                skill_summary = {
                    "skill": skill,
                    "proficiency": session.get("proficiency_estimate", "unknown"),
                    "questions_asked": len(session["questions"]),
                    "key_observations": []
                }
                
                # Extract observations from evaluations
                for eval_data in session["evaluations"]:
                    if "knowledge_gaps" in eval_data:
                        skill_summary["key_observations"].extend(eval_data.get("knowledge_gaps", []))
                
                summary["skills_assessed"].append(skill_summary)
        
        return summary