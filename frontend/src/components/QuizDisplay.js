import { useRef } from "react";
import html2pdf from "html2pdf.js";

const QuizDisplay = ({ quiz, answers, onSelect, onSubmit, submitted, score }) => {
  const pdfRef = useRef(null);
  const totalQuestions = quiz.length;
  const attempted = Object.keys(answers).length;
  const notAttempted = totalQuestions - attempted;
  const correct = quiz.filter((q, i) => answers[i] === q.answer).length;
  const incorrect = attempted - correct;

  // PDF generation using html2pdf.js to fully support all languages
  const downloadPDF = () => {
    if (!pdfRef.current) return;

    const opt = {
      margin: 10,
      filename: "quiz.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().set(opt).from(pdfRef.current).save();
  };

  return (
    <div className="quiz-card">
      <div className="quiz-header">
        <h2>📝 Generated Quiz</h2>
        <button onClick={downloadPDF} className="download-btn">⬇️ Download PDF</button>
      </div>

      {/* Only this section is included in the PDF (no buttons / summary) */}
      <div ref={pdfRef}>
      {quiz.map((q, i) => {
        const selectedAnswer = answers[i];
        const isCorrect = selectedAnswer === q.answer;

        return (
          <div key={i} className="quiz-question">
            <p>
              <strong>{i + 1}. {q.question}</strong>
            </p>

            <ul className="quiz-options">
              {[...(q.options || [])]
                .filter(opt => opt && opt.trim() !== "")
                .map((opt, j) => {

                const isSelected = selectedAnswer === opt;
                const label = String.fromCharCode(65 + j); // A, B, C, D
                const cleanOpt = opt.replace(/^[A-Za-z][\.\)]\s*/, "").trim();
                const displayText = `${label}) ${cleanOpt || opt}`;

                // Only highlight selected option as correct/incorrect
                let optionClass = "";
                if (submitted) {
                  if (opt === q.answer && isSelected) optionClass = "correct"; // green if selected correct
                  else if (isSelected && opt !== q.answer) optionClass = "incorrect"; // red if wrong
                  else if (opt === q.answer) optionClass = "highlight-correct"; // soft green for actual correct answer
                } else if (isSelected) {
                  optionClass = "selected"; // brown highlight before submit
                }

                return (
                  <li
                    key={j}
                    className={optionClass}
                    onClick={() => !submitted && onSelect(i, opt)}
                  >
                    {displayText}
                  </li>
                );
              })}
            </ul>

            {submitted && (
              <div className="answer-feedback">
                <p>
                  🧍 You selected:{" "}
                  <span style={{ color: isCorrect ? "green" : "red", fontWeight: "550" }}>
                    {selectedAnswer || "Not attempted"}
                  </span>
                </p>
                <p>
                  ✅ Correct answer:{" "}
                  <span style={{ color: "green", fontWeight: "550" }}>{q.answer}</span>
                </p>
                {q.explanation && (
                  <p>
                    💡 <strong>Explanation:</strong>{" "}
                    <span style={{ color: "#374151", fontWeight: "550" }}>{q.explanation}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>

      {!submitted ? (
        <button onClick={onSubmit}>Submit Quiz</button>
      ) : (
        <div className="score-box">
          <h3>📊 Quiz Summary</h3>
          <p><span className="label">Total Questions:</span> <span className="value">{totalQuestions}</span></p>
          <p><span className="label">Attempted:</span> <span className="value">{attempted}</span></p>
          <p><span className="label">Not Attempted:</span> <span className="value">{notAttempted}</span></p>
          <p><span className="label">Correct:</span> <span className="value">{correct}</span></p>
          <p><span className="label">Incorrect:</span> <span className="value">{incorrect}</span></p>
          <h4>✅ Final Score: <span className="value">{correct} / {totalQuestions}</span></h4>
        </div>
      )}
    </div>
  );
};

export default QuizDisplay;