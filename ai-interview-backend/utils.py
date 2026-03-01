from dotenv import load_dotenv
import os
from groq import Groq
import json
import re

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("❌ GROQ_API_KEY not found in .env file")

client = Groq(api_key=GROQ_API_KEY)

def call_llm(prompt: str, temperature: float = 0.3, max_tokens: int = 2000) -> str:
    """Call Groq LLM with parameters"""
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"LLM Error: {e}")
        return ""

def extract_json(text: str, default: dict = None) -> dict:
    """Extract JSON from text with multiple fallback strategies"""
    if default is None:
        default = {}
    
    # Try to find JSON in code blocks
    code_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    code_blocks = re.findall(code_block_pattern, text)
    
    for block in code_blocks:
        try:
            return json.loads(block.strip())
        except:
            continue
    
    # Try to find JSON between curly braces
    json_pattern = r'\{[\s\S]*\}'
    matches = re.findall(json_pattern, text)
    
    for match in matches:
        try:
            return json.loads(match)
        except:
            continue
    
    # Try to find array between square brackets
    array_pattern = r'\[[\s\S]*\]'
    matches = re.findall(array_pattern, text)
    
    for match in matches:
        try:
            result = json.loads(match)
            if isinstance(result, list):
                return {"data": result}
        except:
            continue
    
    return default

def clean_text(text: str) -> str:
    """Clean and normalize text"""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters but keep basic punctuation
    text = re.sub(r'[^\w\s\.\,\?\!\-]', '', text)
    return text.strip()

def truncate_text(text: str, max_length: int = 2000) -> str:
    """Truncate text to max length while keeping whole sentences"""
    if len(text) <= max_length:
        return text
    
    truncated = text[:max_length]
    # Try to cut at last sentence
    last_period = truncated.rfind('.')
    if last_period > max_length * 0.8:  # If we cut near the end
        return truncated[:last_period + 1]
    
    return truncated + "..."

def format_interview_context(history: list, current_skill: str) -> str:
    """Format interview history for context"""
    if not history:
        return "No previous questions."
    
    context = f"Interview so far for {current_skill}:\n"
    for i, item in enumerate(history[-3:]):  # Last 3 exchanges
        context += f"\nQ{i+1}: {item.get('question', '')}\n"
        context += f"A{i+1}: {item.get('answer', '')}\n"
        if item.get('evaluation'):
            eval_data = item['evaluation'].get('evaluation', {})
            context += f"Feedback: {eval_data.get('summary_feedback', '')}\n"
    
    return context