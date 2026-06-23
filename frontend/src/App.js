import { useEffect, useRef, useState } from "react";
import NotesInput from "./components/NotesInput";
import QuizDisplay from "./components/QuizDisplay";
import AuthModal from "./components/AuthModal";
import { apiFetch } from "./utils/api";

function App() {
  const [quiz, setQuiz] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState({});
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [notesInputKey, setNotesInputKey] = useState(0);
  const profileMenuRef = useRef(null);

  const authToken = localStorage.getItem("auth_token");
  const isAuthenticated = !!authToken;

  const authedFetch = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    const token = localStorage.getItem("auth_token");
    if (token) headers.Authorization = `Bearer ${token}`;
    return apiFetch(path, { ...options, headers });
  };

  const fetchProfile = async () => {
    if (!localStorage.getItem("auth_token")) return;
    try {
      const response = await authedFetch("/auth/me");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user || null);
        setHistory(data.history || []);
      } else {
        localStorage.removeItem("auth_token");
        setUser(null);
        setHistory([]);
      }
    } catch (_err) {
      localStorage.removeItem("auth_token");
      setUser(null);
      setHistory([]);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await apiFetch("/stats/leaderboard");
      const data = await response.json();
      if (response.ok) setLeaders(data.leaders || []);
    } catch (_err) {
      setLeaders([]);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchLeaderboard();
  }, []);

  // OAuth redirect support: backend redirects back with ?auth_token=...
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("auth_token");
    if (!token) return;
    localStorage.setItem("auth_token", token);
    url.searchParams.delete("auth_token");
    window.history.replaceState({}, "", url.toString());
    fetchProfile();
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (!showProfile) return;
    const onPointerDown = (e) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(e.target)) {
        setShowProfile(false);
        setShowLeaderboard(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [showProfile]);

  const generateQuiz = async (notes, difficulty, model, numQuestions, language) => {
    setLoading(true);
    setQuiz([]);
    setSubmitted(false);
    setScore(0);
    setAnswers({});

    try {
      const randomId = Math.floor(Math.random() * 100000);

      const response = await authedFetch(`/generate-quiz?rand=${randomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, difficulty, model, numQuestions, language }),
      });

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
        fetchProfile();
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
    authedFetch("/stats/quiz-submitted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_questions: quiz.length, correct_answers: correct }),
    })
      .then(() => {
        fetchProfile();
        fetchLeaderboard();
      })
      .catch(() => {});
  };

  const handleDownloaded = () => {
    authedFetch("/stats/quiz-downloaded", { method: "POST" })
      .then(() => fetchProfile())
      .catch(() => {});
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await authedFetch("/auth/profile-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_data: String(reader.result || "") }),
        });
        const data = await response.json();
        if (response.ok) setUser(data.user);
      } catch (_err) {}
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setHistory([]);
    setShowProfile(false);
    setShowLeaderboard(false);
    // Clear any quiz-related state and reset the form back to homepage defaults
    setQuiz([]);
    setLoading(false);
    setSubmitted(false);
    setScore(0);
    setAnswers({});
    setNotesInputKey((k) => k + 1);
    window.history.replaceState({}, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      {isAuthenticated && user ? (
        <div className="profile-top-right">
          <div className="profile-menu" ref={profileMenuRef}>
            <button
              className="profile-icon-btn"
              onClick={() => {
                setShowProfile((prev) => !prev);
                setShowLeaderboard(false);
              }}
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={showProfile ? "true" : "false"}
            >
              {user.profile_photo ? (
                <img src={user.profile_photo} alt="profile" className="profile-icon-img" />
              ) : (
                (user.full_name || "U").charAt(0).toUpperCase()
              )}
            </button>

            {showProfile ? (
              <div className="profile-dropdown" role="menu">
                <div className="profile-user-row">
                  {user.profile_photo ? (
                    <img src={user.profile_photo} alt="profile" className="profile-avatar-lg" />
                  ) : (
                    <div className="profile-avatar-lg">{(user.full_name || "U").charAt(0).toUpperCase()}</div>
                  )}
                  <div>
                    <strong className="profile-name">{user.full_name}</strong>
                    <p className="profile-email">{user.email}</p>
                  </div>
                </div>

                <div className="profile-actions-row">
                  <label className="photo-upload-label">
                    Upload photo
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} />
                  </label>
                  <button
                    type="button"
                    className="profile-chip-btn"
                    onClick={() => setShowLeaderboard((prev) => !prev)}
                  >
                    {showLeaderboard ? "Overview" : "Leaderboard"}
                  </button>
                </div>

                {!showLeaderboard ? (
                  <>
                    <div className="profile-stats-grid">
                      <div className="profile-stat">
                        <div className="profile-stat-label">Quizzes Generated</div>
                        <div className="profile-stat-value">{user.quizzes_generated}</div>
                      </div>
                      <div className="profile-stat">
                        <div className="profile-stat-label">Submitted</div>
                        <div className="profile-stat-value">{user.quizzes_submitted}</div>
                      </div>
                      <div className="profile-stat">
                        <div className="profile-stat-label">Downloaded</div>
                        <div className="profile-stat-value">{user.quizzes_downloaded}</div>
                      </div>
                      <div className="profile-stat">
                        <div className="profile-stat-label">Total Points</div>
                        <div className="profile-stat-value">{user.total_points}</div>
                      </div>
                    </div>

                    <div className="profile-history">
                      <strong>Activity</strong>
                      {history.length === 0 ? (
                        <p className="profile-muted">No activity yet.</p>
                      ) : (
                        history.map((item, index) => (
                          <div className="profile-history-item" key={`${item.created_at}-${index}`}>
                            <div className="profile-history-top">
                              <span className="profile-history-score">
                                {item.correct_answers}/{item.total_questions}
                              </span>
                              <span className="profile-history-points">{item.points_earned} pts</span>
                            </div>
                            <div className="profile-history-date">
                              {new Date(item.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <button type="button" className="profile-logout-btn" onClick={handleLogout}>
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="profile-leaderboard">
                    <div className="profile-section-title">Leaderboard</div>
                    {leaders.length === 0 ? (
                      <p className="profile-muted">No rankings yet.</p>
                    ) : (
                      <div className="profile-leaderboard-list">
                        {leaders.map((item) => (
                          <div className="profile-leaderboard-row" key={`${item.rank}-${item.username}`}>
                          <div className="profile-leaderboard-rank">{item.rank}</div>
                          <div className="profile-leaderboard-avatar">
                            {item.profile_photo ? (
                              <img src={item.profile_photo} alt="" />
                            ) : (
                              <span>{String(item.username || "U").charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="profile-leaderboard-user">{item.username}</div>
                            <div className="profile-leaderboard-score">{item.score}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <h1>🧠 Notes to Quiz Generator</h1>

      <NotesInput
        key={notesInputKey}
        onGenerate={generateQuiz}
        isAuthenticated={isAuthenticated}
        onRequireAuth={() => setAuthOpen(true)}
      />

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
          onDownloaded={handleDownloaded}
        />
      )}

      {/* Leaderboard moved into profile menu for a cleaner UX */}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(data) => {
          localStorage.setItem("auth_token", data.token);
          setUser(data.user);
          setAuthOpen(false);
          fetchProfile();
          fetchLeaderboard();
        }}
      />

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
