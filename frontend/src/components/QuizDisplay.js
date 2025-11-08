import React from "react";
import jsPDF from "jspdf";

const QuizDisplay = ({ quiz, answers, onSelect, onSubmit, submitted, score }) => {
  const totalQuestions = quiz.length;
  const attempted = Object.keys(answers).length;
  const notAttempted = totalQuestions - attempted;
  const correct = quiz.filter((q, i) => answers[i] === q.answer).length;
  const incorrect = attempted - correct;

  // PDF generation with wrapping + new page handling
  const downloadPDF = () => {
    const doc = new jsPDF();
    const maxWidth = 180;
    const pageHeight = doc.internal.pageSize.height;
    let y = 25;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Generated Quiz", 105, y, { align: "center" });

    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    quiz.forEach((q, i) => {
      const questionLines = doc.splitTextToSize(`${i + 1}. ${q.question}`, maxWidth);
      const validOptions = (q.options || []).filter(opt => opt && opt.trim() !== "");
      const optionLines = validOptions.map((opt, j) => {
        const cleanOpt = opt.replace(/^[A-Da-d][\.\)]\s*/, "").trim();
        const formatted = `${String.fromCharCode(65 + j)}) ${cleanOpt}`;
        return doc.splitTextToSize(formatted, maxWidth - 10);
      });

      const questionHeight = questionLines.length * 7;
      const optionsHeight = optionLines.reduce((sum, arr) => sum + arr.length * 7, 0);
      const blockHeight = questionHeight + optionsHeight + 15;

      if (y + blockHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      doc.text(questionLines, 15, y);
      y += questionHeight;

      optionLines.forEach(lines => {
        doc.text(lines, 20, y);
        y += lines.length * 7;
      });

      y += 10;
    });

    doc.save("quiz.pdf");
  };

  return (
    <div className="quiz-card">
      <div className="quiz-header">
        <h2>📝 Generated Quiz</h2>
        <button onClick={downloadPDF} className="download-btn">⬇️ Download PDF</button>
      </div>

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
                .sort((a, b) => a.localeCompare(b)) // ensures options appear as A, B, C, D
                .map((opt, j) => {

                const isSelected = selectedAnswer === opt;

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
                    {opt}
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