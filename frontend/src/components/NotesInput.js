import React, { useState } from "react";

function NotesInput({ onGenerate }) {
  const [notes, setNotes] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [numQuestions, setNumQuestions] = useState(5);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!notes.trim()) return alert("Please paste some notes!");
    onGenerate(notes, difficulty, model, numQuestions);
  };

  const isDisabled = !notes.trim(); // check if notes box is empty

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <label><strong>Paste your notes below:</strong></label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Enter your notes or study material here..."
        rows="8"
      ></textarea>

      {/* Selection controls row */}
      <div className="input-row">
        <div className="input-group">
          <label><strong>Choose difficulty:</strong></label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            disabled={isDisabled}
          >
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>

        <div className="input-group">
          <label><strong>Choose Gemini model:</strong></label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isDisabled}
          >
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
          </select>
        </div>

        {/* No. of Questions dropdown */}
        <div className="input-group">
          <label><strong>No. of Questions:</strong></label>
          <select
            value={numQuestions}
            onChange={(e) => setNumQuestions(parseInt(e.target.value))}
            disabled={isDisabled}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        style={{ marginTop: "1.5rem", width: "100%" }}
        disabled={isDisabled}
      >
        ✨ Generate Quiz
      </button>
    </form>
  );
}

export default NotesInput;
