import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

def test_groq():
    api_key = os.getenv("GROQ_API_KEY")
    print(f"API Key exists: {bool(api_key)}")
    if api_key:
        print(f"Key starts with: {api_key[:10]}...")
    
    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": "Hello",
                }
            ],
            model="llama-3.1-8b-instant",
        )
        print("Success!")
        print(f"Response: {chat_completion.choices[0].message.content}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_groq()
