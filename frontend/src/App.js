import { useState } from "react";
import NotesInput from "./components/NotesInput";
import QuizDisplay from "./components/QuizDisplay";

function App() {
  const [quiz, setQuiz] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState({});

  const generateQuiz = async (notes, difficulty, model, numQuestions, language) => {
    setLoading(true);
    setQuiz([]);
    setSubmitted(false);
    setScore(0);
    setAnswers({});

    try {
      const randomId = Math.floor(Math.random() * 100000);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/generate-quiz?rand=${randomId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, difficulty, model, numQuestions, language }),
        }
      );

      const data = await response.json();
      
      if (data.error) {
        // Show specific error message, especially for quota errors
        if (data.error.includes("API limit") || data.error.includes("exceeds")) {
          alert(`⚠️ ${data.error}\n\nPlease select a different model from the dropdown and try again.`);
        } else {
          alert(`Failed to generate quiz: ${data.error}`);
        }
        setQuiz([]);
      } else {
        setQuiz(data.quiz || []);
        if (!data.quiz || data.quiz.length === 0) {
          alert("Quiz generation returned empty results. Please try again with different notes or a different model.");
        }
      }
    } catch (err) {
      console.error("Quiz generation error:", err);
      alert(`Failed to generate quiz: ${err.message}\n\nPlease check your connection and try again.`);
      setQuiz([]);
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
        <div className="footer-socials">
          <a href="https://www.facebook.com/royalbinod.kapadi" target="_blank" rel="noreferrer"  aria-label="Facebook"   className="facebook" >
            <i className="fa-brands fa-facebook-f"></i>
          </a>

          <a href="https://www.instagram.com/binodbhatt9865"  target="_blank"  rel="noreferrer"  aria-label="Instagram"  className="instagram" >
            <i className="fa-brands fa-instagram"></i>
          </a>

          <a  href="https://x.com/KapadiBinod"  target="_blank"  rel="noreferrer" aria-label="X (Twitter)"  className="x"  >
            <i className="fa-brands fa-x-twitter"></i>
          </a>

          <a  href="https://www.linkedin.com/in/binodkapadi"  target="_blank"  rel="noreferrer"  aria-label="LinkedIn"  className="linkedin" >
            <i className="fa-brands fa-linkedin-in"></i>
          </a>

          <a  href="https://github.com/binodkapadi"  target="_blank"  rel="noreferrer"  aria-label="GitHub"  className="github"  >
            <i className="fa-brands fa-github"></i>
          </a>

          <a  href="https://discord.com/users/1020520872206938153"  target="_blank"  rel="noreferrer"  aria-label="Discord"  className="discord"  >
            <i className="fa-brands fa-discord"></i>
          </a>

          <a
            href="https://chat.whatsapp.com/FRxtbuA6wxb2aXcadW9inx"  target="_blank"  rel="noreferrer"  aria-label="WhatsApp"  className="whatsapp"  >
            <i className="fa-brands fa-whatsapp"></i>
          </a>

          <a  href="https://t.me/errevolution1"  target="_blank"  rel="noreferrer"  aria-label="Telegram"  className="telegram"  >
            <i className="fa-brands fa-telegram"></i>
          </a>

          <a  href="https://www.youtube.com/@errevolution1"  target="_blank"  rel="noreferrer"  aria-label="YouTube"  className="youtube"  >
            <i className="fa-brands fa-youtube"></i>
          </a>
        </div>

        <p className="footer-text">
          Copyright © by <strong>Binod Kapadi</strong>
        </p>
        <p className="footer-subtext">All Rights Reserved — 2025</p>
      </footer>
    </div>
  );
}

export default App;
