import React, { useState } from "react";
import NotesInput from "./components/NotesInput";
import QuizDisplay from "./components/QuizDisplay";
import Loader from "./components/Loader";

function App() {
  const [quiz, setQuiz] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState({});

  const generateQuiz = async (notes, difficulty, model, numQuestions) => {
    setLoading(true);
    setQuiz([]);
    setSubmitted(false);
    setScore(0);
    setAnswers({});

    try {
      const randomId = Math.floor(Math.random() * 100000);

      let baseUrl = process.env.REACT_APP_API_URL || "";
      if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

      const apiUrl = `${baseUrl}/generate-quiz?rand=${randomId}`.replace(/([^:]\/)\/+/g, "$1");

      const response = await fetch(apiUrl,
        `${process.env.REACT_APP_API_URL}/generate-quiz?rand=${randomId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, difficulty, model, numQuestions }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setQuiz(data.quiz || []);
    } catch (err) {
      alert("Failed to generate quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (qIndex, option) => {
    setAnswers((prev) => ({ ...prev, [qIndex]: option }));
  };

  const handleSubmit = () => {
    let correct = 0;
    quiz.forEach((q, i) => {
      if (answers[i] === q.answer) correct++;
    });
    setScore(correct);
    setSubmitted(true);
  };

  return (
    <div>
      <h1>🧠 Notes to Quiz Generator</h1>

      <NotesInput onGenerate={generateQuiz} />

      {loading && (
        <div className="loader-overlay">
          <div className="loader"></div>
          <p className="loading-text">Generating your quiz...</p>
        </div>
      )}

      {quiz.length > 0 && (
        <QuizDisplay
          quiz={quiz}
          answers={answers}
          onSelect={handleAnswerSelect}
          onSubmit={handleSubmit}
          submitted={submitted}
          score={score}
        />
      )}

      {/* Added Footer Section */}
      
      <footer className="footer">
        <p className="footer-text">
          Copyright © by <strong>Binod Kapadi</strong>
        </p>
        <p className="footer-subtext">All Rights Reserved — 2025</p>
      </footer>
    </div>
  );
}

export default App;
