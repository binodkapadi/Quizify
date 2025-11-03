import React, { useState } from "react";

function NotesInput({ onGenerate }) {
  const [notes, setNotes] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [model, setModel] = useState("gemini-2.0-flash");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!notes.trim()) return alert("Please paste some notes!");
    onGenerate(notes, difficulty, model);
  };

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <label><strong>Paste your notes below:</strong></label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Enter your notes or study material here..."
        rows="8"
      ></textarea>

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <label><strong>Choose difficulty:</strong></label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label><strong>Choose Gemini model:</strong></label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
          </select>
        </div>
      </div>

      <button type="submit" style={{ marginTop: "1.5rem", width: "100%" }}>
        ✨ Generate Quiz
      </button>
    </form>
  );
}

export default NotesInput;
