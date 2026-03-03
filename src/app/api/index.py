from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Enable CORS for Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import your existing routes/functions
# You'll need to copy or import your existing code here
# For now, let's add a test endpoint

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "env": os.getenv("GROQ_API_KEY", "not set")}

# Add your existing endpoints here
# For example:
# from your_existing_file import router
# app.include_router(router)