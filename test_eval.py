import asyncio
import sys
import os

# Set up path to import api
sys.path.append(r'c:\Users\gagan\Downloads\ai-interview-bot')
from api.index import evaluate

async def main():
    payload = {
        "question": "What is FastAPI?",
        "answer": "FastAPI is a modern web framework.",
        "skill": "FastAPI",
        "video_frames": []
    }
    try:
        res = await evaluate(payload)
        print("SUCCESS:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
