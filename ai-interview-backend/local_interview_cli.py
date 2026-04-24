import os
import sys
import json
from utils import call_llm, extract_json

def print_separator():
    print("\n" + "="*60 + "\n")

def start_interview_cli(skill_name, experience_level="intermediate"):
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
    
    print("AI is thinking...")
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
    except Exception as e:
        print(f"Error starting interview: {e}")
        question_data = {
            "question": f"Let's start with {skill_name}. Could you walk me through a project where you used it? I'm interested in the challenges you faced.",
            "context": "Opening question",
            "skill": skill_name
        }
    return question_data

def submit_answer_cli(skill, question, answer, history, current_level=1, attempt_count=1):
    skill_history = [h.get("question") for h in history if h.get("skill") == skill]
    
    prompt = f"""
    You are an expert technical interviewer conducting a skill-based adaptive interview.
    Your goal is to evaluate the FULL depth of the skill "{skill}".

    LEVEL-BASED MODEL:
    Level 1: Basic understanding / definitions.
    Level 2: Conceptual depth / internal mechanics.
    Level 3: Practical application / real-world trade-offs / architecture.
    Level 4: Advanced mastery / edge cases / complex optimization.

    ADAPTIVE LOGIC:
    - START at Level {current_level}.
    - MAX QUESTIONS PER SKILL: 4. Total questions answered for "{skill}": {len(skill_history)}. 
      *RULE*: If {len(skill_history)} >= 4, you MUST set action to "move_next".
    
    - If Answer is HIGH quality:
      * ACTION: "level_up" or "move_next". Move to a SIGNIFICANTLY deeper or different area.
      * YOU MUST NOT REPEAT any of {skill_history}.
    
    - If Answer is MEDIUM quality (Correct but lacks detail):
      * ACTION: "probe" or "level_up". 
      * **CRITICAL**: DO NOT repeat "{question}". Move directly to a DIFFERENT TOPIC within "{skill}" to assess breadth.
    
    - If Answer is LOW quality: 
      * Attempt 1 for this question: Action: "retry". Rephrase and explain what was missing.
      * Attempt 2 for this question: Action: "hint". Provide a technical hint for "{question}".
      * Attempt 3 or if Answer is detailed (>40 words): Action: "probe" or "move_next". **FORCE A CHANGE**. Move to a COMPLETELY DIFFERENT topic within "{skill}" or the next skill.

    - **PROGRESSION RULE**: The interview MUST NOT get stuck. If a user is struggling with one specific concept, move to a different one to see if they understand other parts of the skill.

    CONTEXT:
    - Current Skill: {skill}
    - Current Level: {current_level}/4
    - Current Question: {question}
    - Candidate Answer: "{answer}"
    - Attempt Count for THIS specific question: {attempt_count}
    
    OUTPUT FORMAT (JSON ONLY):
    {{
      "action": "retry | hint | probe | level_up | level_down | move_next",
      "skill": "{skill}",
      "level": 1-4,
      "feedback_to_user": "Short, natural transition or correction based on the candidate's last answer.",
      "next_question": "The actual technical question to be displayed (only one).",
      "evaluation": {{
        "quality": "low | medium | high",
        "understanding": "incorrect | partial | correct",
        "confidence": "low | medium | high",
        "scores": {{
          "technical": 0-10,
          "overall_score": 0-10
        }},
        "technical_accuracy": {{
          "correct": ["List specific technical keywords/patterns mentioned correctly by the candidate."],
          "missed": ["List specific technical details or nuances that were missing but expected."],
          "incorrect": ["List any technical inaccuracies or misstatements."]
        }},
        "improvement_tips": ["Actionable advice for the candidate"]
      }}
    }}

    SYNC RULE: 
    - The "feedback_to_user" should be purely conversational and ONLY provide a transition.
    - **CRITICAL**: DO NOT include the next technical question or any part of it in "feedback_to_user".
    - "next_question" is the core technical prompt that will be shown on screen and should NOT contain conversational filler.
    """

    print("AI is evaluating your answer and thinking of the next step...")
    try:
        ai_response = call_llm(prompt, max_tokens=3000)
        result = extract_json(ai_response)
        
        if "level" not in result:
            result["level"] = current_level

        # Force move action if max questions reached (max 3 questions -> len(skill_history) >= 2)
        if len(skill_history) >= 2 and result.get("action") != "move_next":
            result["action"] = "move_next"
            if "feedback_to_user" not in result or len(str(result.get("feedback_to_user", ""))) < 5:
                result["feedback_to_user"] = "You've provided enough detail on this topic. Let's move on to the next skill."
            result["next_question"] = ""

        # Guarantee evaluation block is never missing
        if "evaluation" not in result or not isinstance(result["evaluation"], dict):
            result["evaluation"] = {}
            
        eval_dict = result["evaluation"]
        eval_dict["quality"] = eval_dict.get("quality", "medium")
        eval_dict["understanding"] = eval_dict.get("understanding", "partial")
        eval_dict["confidence"] = eval_dict.get("confidence", "medium")
        
        if "scores" not in eval_dict or not isinstance(eval_dict["scores"], dict):
            eval_dict["scores"] = {"overall_score": 5, "technical": 5}
        if "technical_accuracy" not in eval_dict or not isinstance(eval_dict["technical_accuracy"], dict):
            eval_dict["technical_accuracy"] = {"correct": ["(System: LLM skipped technical extraction)"], "missed": [], "incorrect": []}

        # Ensure scores are clamped between 0 and 10 and format is clean
        for k, v in list(eval_dict["scores"].items()):
            if isinstance(v, (int, float)):
                eval_dict["scores"][k] = max(0, min(10, int(v)))
            elif isinstance(v, str):
                try:
                    num = float(v.split('/')[0].strip())
                    eval_dict["scores"][k] = max(0, min(10, int(num)))
                except (ValueError, TypeError):
                    eval_dict["scores"][k] = 5

        return result
    except Exception as e:
        print(f"Error evaluating answer: {e}")
        return None

def main():
    print("==================================================")
    print("      LOCALLY RUNNING AI INTERVIEW LOGIC          ")
    print("==================================================")
    
    skill = input("Enter a skill to be interviewed on (e.g. Python, React): ").strip()
    if not skill:
        skill = "Python"
        
    level = input("Enter difficulty level (beginner, intermediate, advanced, expert) [default: intermediate]: ").strip()
    if not level:
        level = "intermediate"

    print_separator()
    print(f"Starting interview for {skill} ({level}). Type 'quit' or 'exit' to end early.")

    first_q = start_interview_cli(skill, level)
    
    current_question = first_q.get("question", "Could you tell me about your experience?")
    skill_active = skill
    current_level = 1
    
    if level == "intermediate": current_level = 2
    elif level == "advanced": current_level = 3
    elif level == "expert": current_level = 4
    
    history = []
    
    while True:
        print_separator()
        print(f"\nInterviewer: {current_question}")
        
        answer = input("\nYou: ")
        if answer.lower() in ("quit", "exit"):
            print("Interview ended by user.")
            break
            
        history.append({
            "skill": skill_active,
            "question": current_question,
            "answer": answer
        })
        
        attempt_count = 1
        for h in reversed(history[:-1]):
            if h.get("skill") == skill_active and h.get("question") == current_question:
                attempt_count += 1
            else:
                if h.get("skill") == skill_active: break
                
        evaluation_result = submit_answer_cli(skill_active, current_question, answer, history, current_level, attempt_count)
        
        if evaluation_result:
            print("\n----- EVALUATION -----")
            eval_data = evaluation_result.get("evaluation", {})
            print(f"Action: {evaluation_result.get('action')}")
            print(f"Quality: {eval_data.get('quality')}")
            print(f"Technical Score: {eval_data.get('scores', {}).get('technical', 'N/A')}/10")
            print(f"Correct points: {eval_data.get('technical_accuracy', {}).get('correct', [])}")
            print(f"Missed points: {eval_data.get('technical_accuracy', {}).get('missed', [])}")
            print(f"Feedback To You: {evaluation_result.get('feedback_to_user', '')}")
            print("----------------------")
            
            if evaluation_result.get("action") == "move_next":
                print("\nInterviewer decided to move to the next topic. Since we are testing a single skill locally, we will end the interview segment here.")
                break
                
            current_level = evaluation_result.get("level", current_level)
            next_q = evaluation_result.get("next_question")
            if next_q:
                current_question = next_q
            else:
                current_question = "Let's continue on that point. Could you elaborate further?"
        else:
            print("Failed to get evaluation.")
            break
            
    print("\nThank you for trying out the local interview logic tester!")

if __name__ == "__main__":
    main()
