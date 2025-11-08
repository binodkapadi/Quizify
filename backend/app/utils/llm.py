import os
import re
import json
import random  
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("❌ GOOGLE_API_KEY not found in .env file")

# Configure Gemini
genai.configure(api_key=GOOGLE_API_KEY)


# added `seed` parameter for random variation
def generate_quiz_from_notes(notes: str, difficulty: str, model: str, num_questions: int = 5, seed: int = None):
    """
    Uses Google Gemini models to generate MCQs from notes.
    Now supports custom number of questions.
    """

    seed_text = f"(Random context ID: {seed or random.randint(1, 100000)})"

    prompt = f"""
    You are a professional quiz generator.
    Based on the following notes, create exactly {num_questions} multiple-choice questions.
    Use this random context {seed_text} to ensure each generation is unique.
    
    Each question must include:
    - "question": the question text
    - "options": a list of 4 clear choices (A, B, C, D)
    - "answer": the correct choice text
    - "explanation": a short 2-3 line summary explaining why the correct answer is correct

    Difficulty: {difficulty}
    Notes: {notes}

    Return only valid JSON in this format:
    [
      {{
        "question": "string",
        "options": ["A", "B", "C", "D"],
        "answer": "string"
        "explanation": "string"
      }}
    ]
    """


    try:
        model_instance = genai.GenerativeModel(model)
        response = model_instance.generate_content(prompt)

        text = response.text.strip()
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            text = match.group(0)

        quiz = json.loads(text)

        # shuffle questions and options for randomness
        random.shuffle(quiz)
        for q in quiz:
            random.shuffle(q["options"])

        return quiz

    except json.JSONDecodeError:
        fixed = text.replace("'", '"')
        fixed = re.sub(r',\s*}', '}', fixed)
        fixed = re.sub(r',\s*]', ']', fixed)
        try:
            quiz = json.loads(fixed)
            random.shuffle(quiz)  
            for q in quiz:
                random.shuffle(q["options"])
            return quiz
        except Exception as inner_e:
            print("❌ JSON Fix Failed:", inner_e)
            return []

    except Exception as e:
        print("❌ Gemini generation error:", e)
        return []
