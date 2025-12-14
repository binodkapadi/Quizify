from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from app.utils.llm import generate_quiz_from_notes
from typing import List
from app.utils.file_extractor import extract_text_from_files
import random  #  added to generate random seed

app = FastAPI(
    title="Notes to Quiz Generator API",
    description="FastAPI backend powered by Google Gemini models",
    version="1.0.0"
)

origins = [
  "https://binodkapadiquizify.vercel.app",
  "http://localhost:3000",
]

#  Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Notes to Quiz Generator API is running 🚀"}


@app.post("/generate-quiz")
async def generate_quiz(request: Request):
    data = await request.json()
    notes = data.get("notes")
    difficulty = data.get("difficulty", "medium")
    model = data.get("model", "gemini-flash-latest")
    num_questions = int(data.get("numQuestions", 5))
    language = data.get("language", "English")

    # Add random seed to make every generation unique
    random_seed = random.randint(1000, 99999)

    try:
        quiz = generate_quiz_from_notes(notes, difficulty, model, num_questions, random_seed, language)  
        if not quiz:
            # Check if it's a quota error by examining the error logs
            # The llm.py function will print the error, but we need to return a user-friendly message
            return {"error": f"API limit for model '{model}' exceeds. Please try a different model or wait and try again later."}
        return {"quiz": quiz}
    except Exception as e:
        error_str = str(e).lower()
        if "429" in str(e) or "quota" in error_str or "rate limit" in error_str:
            return {"error": f"API limit for model '{model}' exceeds. Please try a different model or wait and try again later."}
        print("❌ Error generating quiz:", e)
        return {"error": str(e)}


@app.post("/extract-notes")
async def extract_notes(files: List[UploadFile] = File(...)):
    """
    Accepts one or more uploaded files (PDF, Word, PPT, TXT, images(JPG, JPEG, PNG)).
    Extracts text content and returns it so the frontend can populate the notes box.
    """
    try:
        if not files:
            return {"text": ""}
        text = await extract_text_from_files(files)
        if not text.strip():
            return {"text": "", "warning": "Could not extract text from uploaded files."}
        return {"text": text}
    except Exception as e:
        print("❌ Error extracting notes:", e)
        return {"text": "", "warning": str(e)}
