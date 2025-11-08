from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.utils.llm import generate_quiz_from_notes
import random  #  added to generate random seed

app = FastAPI(
    title="Notes to Quiz Generator API",
    description="FastAPI backend powered by Google Gemini models",
    version="1.0.0"
)

#  Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://binodkapadiquizify.vercel.app"],  # Replace with your frontend URL in production
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
    model = data.get("model", "gemini-2.0-flash")
    num_questions = int(data.get("numQuestions", 5))

    # Add random seed to make every generation unique
    random_seed = random.randint(1000, 99999)

    try:
        quiz = generate_quiz_from_notes(notes, difficulty, model, num_questions, random_seed)  
        if not quiz:
            return {"error": "Quiz generation failed. Try again with clearer notes."}
        return {"quiz": quiz}
    except Exception as e:
        print("❌ Error generating quiz:", e)
        return {"error": str(e)}
