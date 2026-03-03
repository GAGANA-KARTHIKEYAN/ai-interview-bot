from typing import List, Dict, Any, Optional
import json
import uuid
from datetime import datetime

class InterviewSession:
    """Manages a complete interview session with dynamic flow"""
    
    def __init__(self, user_id: str = None):
        self.session_id = str(uuid.uuid4())
        self.user_id = user_id
        self.created_at = datetime.now().isoformat()
        self.updated_at = self.created_at
        
        # Interview state
        self.skills = []
        self.current_skill_index = 0
        self.current_skill = None
        
        # History storage
        self.questions_asked = {}  # skill -> list of questions
        self.answers_received = {}  # skill -> list of answers
        self.evaluations = {}  # skill -> list of evaluations
        self.skill_summaries = {}  # skill -> summary
        
        # Context tracking
        self.qa_history = []  # flat list of all Q&A in order
        self.conversation_flow = []  # detailed flow with timestamps
        self.skill_progress = {}  # skill -> status
        
        # Overall assessment
        self.user_level_estimate = "intermediate"
        self.overall_notes = []
        self.final_report = None
        
    def add_skill(self, skill: dict):
        """Add a skill to assess"""
        skill_name = skill["skill"]
        self.skills.append(skill)
        self.questions_asked[skill_name] = []
        self.answers_received[skill_name] = []
        self.evaluations[skill_name] = []
        self.skill_progress[skill_name] = {
            "status": "pending",
            "questions_asked": 0,
            "last_question_time": None,
            "proficiency_estimate": None
        }
        
        if not self.current_skill:
            self.current_skill = skill_name
            self.skill_progress[skill_name]["status"] = "in_progress"
    
    def get_next_skill(self) -> Optional[dict]:
        """Get the next skill to assess"""
        for skill in self.skills:
            if self.skill_progress[skill["skill"]]["status"] == "pending":
                self.current_skill = skill["skill"]
                self.current_skill_index = self.skills.index(skill)
                self.skill_progress[skill["skill"]]["status"] = "in_progress"
                return skill
        return None
    
    def add_qa(self, skill: str, question: dict, answer: str, evaluation: dict):
        """Add a question-answer pair to history"""
        timestamp = datetime.now().isoformat()
        
        # Add to skill-specific lists
        self.questions_asked[skill].append(question)
        self.answers_received[skill].append(answer)
        self.evaluations[skill].append(evaluation)
        
        # Update progress
        self.skill_progress[skill]["questions_asked"] += 1
        self.skill_progress[skill]["last_question_time"] = timestamp
        
        # Update proficiency estimate based on evaluations
        if evaluation and "capability" in evaluation:
            cap_scores = {"weak": 1, "medium": 2, "strong": 3, "expert": 4}
            evaluations_so_far = self.evaluations[skill]
            if evaluations_so_far:
                avg_score = sum(cap_scores.get(e.get("capability", "medium"), 2) 
                               for e in evaluations_so_far) / len(evaluations_so_far)
                if avg_score >= 3.5:
                    self.skill_progress[skill]["proficiency_estimate"] = "expert"
                elif avg_score >= 2.5:
                    self.skill_progress[skill]["proficiency_estimate"] = "advanced"
                elif avg_score >= 1.5:
                    self.skill_progress[skill]["proficiency_estimate"] = "intermediate"
                else:
                    self.skill_progress[skill]["proficiency_estimate"] = "beginner"
        
        # Add to conversation flow
        self.conversation_flow.append({
            "timestamp": timestamp,
            "type": "question",
            "skill": skill,
            "content": question
        })
        self.conversation_flow.append({
            "timestamp": timestamp,
            "type": "answer",
            "skill": skill,
            "content": answer,
            "evaluation": evaluation
        })
        
        # Add to flat history
        self.qa_history.append({
            "timestamp": timestamp,
            "skill": skill,
            "question": question,
            "answer": answer,
            "evaluation": evaluation
        })
        
        self.updated_at = timestamp
    
    def complete_skill(self, skill: str):
        """Mark a skill as completed"""
        if skill in self.skill_progress:
            self.skill_progress[skill]["status"] = "completed"
    
    def is_complete(self) -> bool:
        """Check if all skills have been assessed"""
        return all(p["status"] == "completed" for p in self.skill_progress.values())
    
    def get_current_skill_data(self) -> Optional[dict]:
        """Get data for current skill"""
        for skill in self.skills:
            if skill["skill"] == self.current_skill:
                return skill
        return None
    
    def get_skill_history(self, skill: str) -> List[dict]:
        """Get Q&A history for a specific skill"""
        history = []
        for i in range(len(self.questions_asked.get(skill, []))):
            history.append({
                "question": self.questions_asked[skill][i],
                "answer": self.answers_received[skill][i],
                "evaluation": self.evaluations[skill][i] if i < len(self.evaluations[skill]) else None
            })
        return history
    
    def get_questions_count_for_skill(self, skill: str) -> int:
        """Get number of questions asked for a skill"""
        return len(self.questions_asked.get(skill, []))
    
    def should_continue_skill(self, skill: str) -> dict:
        """Determine if we should continue asking questions for this skill"""
        questions_asked = self.get_questions_count_for_skill(skill)
        evaluations = self.evaluations.get(skill, [])
        
        # If no questions asked yet
        if questions_asked == 0:
            return {"continue": True, "reason": "Start assessment"}
        
        # If less than 2 questions, continue
        if questions_asked < 2:
            return {"continue": True, "reason": "Need more data"}
        
        # If we have evaluations, analyze them
        if evaluations:
            last_eval = evaluations[-1]
            capability = last_eval.get("evaluation", {}).get("capability", "medium")
            
            # If last answer was weak and we haven't asked many questions
            if capability == "weak" and questions_asked < 4:
                return {"continue": True, "reason": "Probe weak areas"}
            
            # If last answer was strong and we want to confirm depth
            if capability in ["strong", "expert"] and questions_asked < 3:
                return {"continue": True, "reason": "Test advanced knowledge"}
            
            # Check overall pattern
            capabilities = [e.get("evaluation", {}).get("capability", "medium") for e in evaluations]
            strong_count = sum(1 for c in capabilities if c in ["strong", "expert"])
            weak_count = sum(1 for c in capabilities if c == "weak")
            
            # If they've shown strong understanding multiple times
            if strong_count >= 2 and questions_asked >= 3:
                return {"continue": False, "reason": "Strong understanding confirmed"}
            
            # If they're consistently weak
            if weak_count >= 2 and questions_asked >= 4:
                return {"continue": False, "reason": "Fundamental gaps identified"}
        
        # Default: continue up to 5 questions
        if questions_asked >= 5:
            return {"continue": False, "reason": "Sufficient coverage"}
        
        return {"continue": True, "reason": "Continue assessment"}
    
    def get_skill_summary_data(self) -> List[dict]:
        """Get data for skill summaries"""
        summaries = []
        for skill in self.skills:
            skill_name = skill["skill"]
            evaluations = self.evaluations.get(skill_name, [])
            
            if evaluations:
                capabilities = [e.get("evaluation", {}).get("capability", "medium") for e in evaluations]
                scores = [e.get("evaluation", {}).get("overall_score", 5) for e in evaluations if e.get("evaluation", {}).get("overall_score")]
                
                avg_score = sum(scores) / len(scores) if scores else None
                
                summary = {
                    "skill": skill_name,
                    "questions_asked": len(evaluations),
                    "proficiency": self.skill_progress.get(skill_name, {}).get("proficiency_estimate", "unknown"),
                    "average_score": avg_score,
                    "capabilities": capabilities,
                    "has_summary": skill_name in self.skill_summaries
                }
                summaries.append(summary)
        
        return summaries
    
    def to_dict(self) -> dict:
        """Convert session to dictionary for storage/transmission"""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "skills": self.skills,
            "current_skill": self.current_skill,
            "current_skill_index": self.current_skill_index,
            "qa_history": self.qa_history,
            "skill_progress": self.skill_progress,
            "user_level_estimate": self.user_level_estimate,
            "is_complete": self.is_complete()
        }
    
    @classmethod
    def from_dict(cls, data: dict):
        """Create session from dictionary"""
        session = cls(data.get("user_id"))
        session.session_id = data.get("session_id", session.session_id)
        session.created_at = data.get("created_at", session.created_at)
        session.updated_at = data.get("updated_at", session.updated_at)
        
        # Restore skills
        for skill in data.get("skills", []):
            session.add_skill(skill)
        
        session.current_skill = data.get("current_skill")
        session.current_skill_index = data.get("current_skill_index", 0)
        session.user_level_estimate = data.get("user_level_estimate", "intermediate")
        
        # Restore Q&A history
        for qa in data.get("qa_history", []):
            session.qa_history.append(qa)
            skill = qa["skill"]
            if skill not in session.questions_asked:
                session.questions_asked[skill] = []
                session.answers_received[skill] = []
                session.evaluations[skill] = []
            
            session.questions_asked[skill].append(qa["question"])
            session.answers_received[skill].append(qa["answer"])
            if qa.get("evaluation"):
                session.evaluations[skill].append(qa["evaluation"])
        
        return session