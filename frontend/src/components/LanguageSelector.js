import { useState, useMemo } from "react";
import { QUIZ_LANGUAGES } from "../data/languages";

function LanguageSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredLanguages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return QUIZ_LANGUAGES;
    return QUIZ_LANGUAGES.filter((lang) =>
      lang.toLowerCase().includes(term)
    );
  }, [search]);

  const handleSelect = (lang) => {
    if (disabled) return;
    onChange(lang);
    setOpen(false);
  };

  const displayLabel = value || "Select language";

  return (
    <div className={`language-select ${disabled ? "language-select-disabled" : ""}`}>
      <button
        type="button"
        className="language-select-trigger"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span className="language-selected-text">{displayLabel}</span>
        <span className="language-arrow">▾</span>
      </button>

      {open && !disabled && (
        <div className="language-dropdown">
          <div className="language-search-wrapper">
            <span className="language-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search language..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="language-search"
            />
          </div>

          <div className="language-list">
            {filteredLanguages.map((lang) => (
              <div
                key={lang}
                className={`language-item ${
                  lang === value ? "language-item-selected" : ""
                }`}
                onClick={() => handleSelect(lang)}
              >
                {lang === value && <span className="language-check">✔</span>}
                <span className="language-name">{lang}</span>
              </div>
            ))}
            {filteredLanguages.length === 0 && (
              <div className="language-item language-item-empty">
                No languages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
