from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.utils.llm import generate_quiz_from_notes

router = APIRouter()

class QuizRequest(BaseModel):
    notes: str
    difficulty: str
    model: str

@router.post("/generate-quiz")
async def generate_quiz(request: QuizRequest):
    quiz = generate_quiz_from_notes(
        notes=request.notes,
        difficulty=request.difficulty,
        model_name=request.model
    )

    if not quiz:
        raise HTTPException(status_code=500, detail="Failed to generate quiz. Try again.")

    return {"quiz": quiz}
