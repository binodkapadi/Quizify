import { useState } from "react";
import LanguageSelector from "./LanguageSelector";

function NotesInput({ onGenerate }) {
  const [notes, setNotes] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [model, setModel] = useState("gemini-flash-latest");
  const [numQuestions, setNumQuestions] = useState(5);
  const [language, setLanguage] = useState("English");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [manualMode, setManualMode] = useState(false); 
  const [fileNotes, setFileNotes] = useState(""); 

  const handleSubmit = (e) => {
    e.preventDefault();

    const effectiveNotes = manualMode ? notes : fileNotes;
    if (!effectiveNotes.trim()) {
      return alert("Please paste some notes or upload a readable document!");
    }

    onGenerate(effectiveNotes, difficulty, model, numQuestions, language);
  };

  const hasAnyNotes = manualMode ? !!notes.trim() : !!fileNotes.trim();
  const hasFiles = uploadedFiles.length > 0;

  const isDisabled = !hasAnyNotes; // quiz controls enabled only when notes text is present
  const uploadDisabled = manualMode; // user is typing notes -> disable upload box

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
  
    // Prevent selecting files when user is in manual typing mode
    if (manualMode) return;
  
    // 50 MB limit (in bytes)
    const MAX_SIZE = 50 * 1024 * 1024;
  
    // Check each file
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        setUploadError(
          `❌ You have uploaded file "${file.name}" more than 50 MB, so please upload a file less than 50 MB to proceed further.`
        );
        return; // Stop further processing
      }
    }
  
    setUploading(true);
    setUploadError("");
  
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
  
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/extract-notes`,
        {
          method: "POST",
          body: formData,
        }
      );
  
      const data = await response.json();
      if (data.text && data.text.trim()) {
        setFileNotes(data.text);
        setNotes("");
        setUploadedFiles(files);
        setManualMode(false);
      } else {
        setUploadedFiles(files);
        setManualMode(false);
        setUploadError(
          data.warning ||
            "Unable to read text from the uploaded files. Please try another file."
        );
      }
    } catch (err) {
      console.error("Upload failed", err);
      setUploadError("Failed to upload files. Please try again.");
    } finally {
      setUploading(false);
    }
  };  

  const handleClearFiles = () => {
    setUploadedFiles([]);
    setNotes("");
    setFileNotes("");
    setUploadError("");
    setManualMode(false);
  };

  return (
    <form onSubmit={handleSubmit} className="form-card">
      <label><strong>Paste your notes below:</strong></label>
      <textarea
        value={notes}
        onChange={(e) => {
          const value = e.target.value;
          setNotes(value);

          if (value.trim()) {
            // Switch to manual mode, clear any uploaded files
            setManualMode(true);
            if (uploadedFiles.length) {
              setUploadedFiles([]);
              setFileNotes("");
              setUploadError("");
            }
          } else {
            // Empty text -> no mode selected
            setManualMode(false);
          }
        }}
        placeholder={hasFiles
          ? "Notes loaded from uploaded files (Paste box disabled while files are selected)..."
          : "Enter your notes or study material here..."}
        rows="8"
        disabled={hasFiles}
      ></textarea>

      {/* Upload files section (mutually exclusive with manual notes) */}
      <div className={`upload-section ${uploadDisabled ? "upload-disabled" : ""}`}>
        <p className="upload-title">
          Or upload notes as PDF, Word, PPT, text, or images:
        </p>

        <label className="upload-dropzone">
          <div className="upload-cloud-icon">☁️</div>
          <div className="upload-texts">
            <span className="upload-main-text">Drag and drop files here</span>
            <span className="upload-sub-text">
              Limit 50MB per file · PDF, DOC, DOCX, PPT, PPTX, TXT, PNG, JPG, JPEG
            </span>
          </div>
          <button
            type="button"
            className="upload-browse-btn"
            disabled={uploadDisabled || uploading}
          >
            {uploading ? "Uploading..." : "Browse files"}
          </button>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            disabled={uploadDisabled || uploading}
          />
        </label>

        {uploadedFiles.length > 0 && (
          <div className="upload-selected">
            <p className="upload-selected-title">Selected files:</p>
            <ul>
              {uploadedFiles.map((file, idx) => (
                <li key={idx}>{file.name}</li>
              ))}
            </ul>
            <button
              type="button"
              className="upload-clear-btn"
              onClick={handleClearFiles}
            >
              Clear files
            </button>
          </div>
        )}

        {uploadError && (
          <p className="upload-error">
            {uploadError}
          </p>
        )}
      </div>

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
            <option value="gemini-flash-latest">Gemini Flash Latest</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.5-flash-lite-preview-09-2025">Gemini 2.5 Flash-Lite Preview</option>
            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
            <option value="gemini-flash-lite-latest">Gemini Flash-Lite Latest</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
            <option value="gemini-2.5-flash-preview-09-2025">Gemini 2.5 Flash Preview</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
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
            <option value="25">25</option>
            <option value="30">30</option>
          </select>
        </div>
      </div>

      {/* Quiz language dropdown box (with search inside) */}
      <div className="input-group" style={{ marginTop: "1rem" }}>
        <label><strong>Quiz language:</strong></label>
        <LanguageSelector
          value={language}
          onChange={setLanguage}
          disabled={isDisabled}
        />
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
