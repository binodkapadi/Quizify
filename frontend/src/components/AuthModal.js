import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/api";
import { getApiBaseUrl } from "../utils/api";

// Validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

const isPasswordValid = (rules) => {
  return rules.length && rules.uppercase && rules.lowercase && rules.number && rules.special;
};

function AuthModal({ open, onClose, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetStep, setResetStep] = useState("request"); // "request" | "verify"
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // OTP Verification states
  const [otpStep, setOtpStep] = useState("signup"); // "signup" | "otp_sent" | "verifying"
  const [otpCode, setOtpCode] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [debugOtp, setDebugOtp] = useState(""); // For development only

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Validation states
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
    confirmNewPassword: false,
  });

  const [emailError, setEmailError] = useState("");

  // Allow spaces in full name, but trim only at submit
  const setField = (key, value) => {
    if (key === "fullName") {
      setForm((prev) => ({ ...prev, [key]: value })); 
    } else {
      setForm((prev) => ({ ...prev, [key]: value.trim() }));
    }
  };

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const allowDebugOtp = useMemo(() => {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }, []);

  // Password strength rules
  const passwordRules = useMemo(() => validatePassword(form.password), [form.password]);
  const newPasswordRules = useMemo(() => validatePassword(newPassword), [newPassword]);

  // Check if all signup fields are valid
  const isSignupValid = useMemo(() => {
    // Only validate in signup mode
    if (mode !== "signup") return true;
    return (
      form.fullName.trim() !== "" &&
      validateEmail(form.email) &&
      isPasswordValid(passwordRules) &&
      form.confirmPassword.trim() !== "" &&
      form.password === form.confirmPassword
    );
  }, [form, passwordRules, mode]);

  useEffect(() => {
    // Prefill remembered email
    const remembered = localStorage.getItem("remember_email") || "";
    if (remembered) setForm((prev) => ({ ...prev, email: remembered }));
  }, []);

  useEffect(() => {
    // Email validation on blur
    if (mode !== "login" && touched.email && form.email && !validateEmail(form.email)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  }, [touched.email, form.email, mode]);

  // Resend OTP timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const continueWithProvider = (provider) => {
    setError("");
    setSuccess("");
    // Backend handles OAuth + redirects back with auth_token
    window.location.assign(`${apiBaseUrl}/auth/oauth/${provider}/start`);
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
    setError("");
    setSuccess("");
    setTouched({ fullName: false, email: false, password: false, confirmPassword: false });
    setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    setEmailError("");
    setResetStep("request");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    // Reset OTP states
    setOtpStep("signup");
    setOtpCode("");
    setDebugOtp("");
    setResendTimer(0);
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const getFieldError = (field) => {
    if (!touched[field]) return "";
    switch (field) {
      case "fullName":
        return form.fullName.trim() === "" ? "Please enter your full name" : "";
      case "email":
        if (mode === "login") return "";
        if (form.email.trim() === "") return "Please enter a valid email address";
        if (!validateEmail(form.email)) return "Please enter a valid email address";
        return "";
      case "password":
        // Only show password required error in signup mode
        return mode === "signup" && form.password === "" ? "Password is required" : "";
      case "confirmPassword":
        if (form.confirmPassword === "") return "Please confirm your password";
        if (mode === "signup" && form.password !== form.confirmPassword) return "Password does not match";
        return "";
      case "confirmNewPassword":
        if (confirmNewPassword === "") return "Please confirm your password";
        if (newPassword !== confirmNewPassword) return "Password does not match";
        return "";
      default:
        return "";
    }
  };

  const handleSignup = async () => {
    // Mark all fields as touched
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true, confirmNewPassword: false });

    // Validate all fields
    if (!form.fullName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!validateEmail(form.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!isPasswordValid(passwordRules)) {
      setError("Please meet all password requirements");
      return;
    }
    if (!form.confirmPassword) {
      setError("Please confirm your password");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Password does not match");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // Step 1: Send OTP to email
      const response = await apiFetch("/auth/signup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          confirm_password: form.confirmPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to send OTP");
      
      // Store debug OTP for development (remove in production!)
      if (allowDebugOtp && data.debug_otp) {
        setDebugOtp(data.debug_otp);
        console.log("🔐 Development OTP:", data.debug_otp);
      }
      
      // Move to OTP verification step
      setOtpStep("otp_sent");
      setSuccess(`OTP sent to ${form.email}. Check your email.`);
      setResendTimer(60); // 60 seconds cooldown
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot connect to server. Please check backend is running." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setError("Please enter the OTP code");
      return;
    }
    if (otpCode.length !== 6) {
      setError("Please enter a 6-digit OTP code");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // Step 2: Verify OTP and create user
      const response = await apiFetch("/auth/signup/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          otp_code: otpCode.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "OTP verification failed");
      
      setSuccess("User successfully registered. Please sign in using your credentials.");
      setMode("login");
      setOtpStep("signup");
      setOtpCode("");
      setDebugOtp("");
      setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot connect to server. Please check backend is running." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch("/auth/signup/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to resend OTP");
      
      if (allowDebugOtp && data.debug_otp) {
        setDebugOtp(data.debug_otp);
        console.log("🔐 New Development OTP:", data.debug_otp);
      }
      
      setSuccess("New OTP sent to your email");
      setResendTimer(60);
      setOtpCode("");
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot connect to server. Please check backend is running." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignup = () => {
    setOtpStep("signup");
    setOtpCode("");
    setDebugOtp("");
    setError("");
    setSuccess("");
  };

  const handleLogin = async () => {
    // Mark fields as touched for validation
    setTouched({ fullName: false, email: true, password: true, confirmPassword: false });

    if (!form.email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!form.password) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Login failed");
      if (rememberMe) localStorage.setItem("remember_email", form.email || "");
      else localStorage.removeItem("remember_email");
      onAuthenticated(data);
      onClose();
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot connect to server. Please check backend is running." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    if (!form.email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!validateEmail(form.email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch("/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to request reset");
      if (allowDebugOtp && data.debug_otp) {
        setDebugOtp(data.debug_otp);
      }
      setSuccess("Verification code sent to your email.");
      setResetStep("verify");
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot connect to server. Please check backend is running." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetCode.trim()) {
      setError("Please enter the reset code");
      return;
    }
    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }
    if (!isPasswordValid(newPasswordRules)) {
      setError("Please meet all password requirements");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Password does not match");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch("/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetCode.trim(), new_password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to reset password");
      setSuccess("Password reset successful.");
      setMode("login");
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetStep("request");
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot connect to server. Please check backend is running." : err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render password input with visibility toggle
  const renderPasswordInput = (value, onChange, placeholder, show, setShow, fieldName, isConfirm = false, showStrengthPanel = false) => {
    const activePasswordRules = fieldName === "newPassword" ? newPasswordRules : passwordRules;
    const showPanel = showStrengthPanel && value.length > 0;
    const isResetConfirmField = fieldName === "confirmNewPassword";
    const basePassword = isResetConfirmField ? newPassword : form.password;
    const confirmValue = isResetConfirmField ? confirmNewPassword : form.confirmPassword;
    const showConfirmPanel = isConfirm && confirmValue.length > 0;

    return (
      <div className="password-input-container">
        <div className="password-input-wrapper">
          <input
            className={`auth-input ${getFieldError(fieldName) ? "auth-input-error" : ""}`}
            type={show ? "text" : "password"}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => handleBlur(fieldName)}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShow(!show)}
            tabIndex={-1}
          >
            {show ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        </div>

        {/* Password strength validation panel */}
        {showPanel && (
          <div className="password-validation-panel">
            <div className={`validation-item ${activePasswordRules.length ? "valid" : "invalid"}`}>
              <span className="validation-icon">{activePasswordRules.length ? "✓" : "✗"}</span>
              <span>At least 8 characters</span>
            </div>
            <div className={`validation-item ${activePasswordRules.uppercase ? "valid" : "invalid"}`}>
              <span className="validation-icon">{activePasswordRules.uppercase ? "✓" : "✗"}</span>
              <span>One uppercase letter</span>
            </div>
            <div className={`validation-item ${activePasswordRules.lowercase ? "valid" : "invalid"}`}>
              <span className="validation-icon">{activePasswordRules.lowercase ? "✓" : "✗"}</span>
              <span>One lowercase letter</span>
            </div>
            <div className={`validation-item ${activePasswordRules.number ? "valid" : "invalid"}`}>
              <span className="validation-icon">{activePasswordRules.number ? "✓" : "✗"}</span>
              <span>One number</span>
            </div>
            <div className={`validation-item ${activePasswordRules.special ? "valid" : "invalid"}`}>
              <span className="validation-icon">{activePasswordRules.special ? "✓" : "✗"}</span>
              <span>One special character</span>
            </div>
          </div>
        )}

        {/* Confirm password validation panel */}
        {showConfirmPanel && (
          <div className="password-validation-panel">
            <div className={`validation-item ${basePassword === confirmValue && confirmValue ? "valid" : "invalid"}`}>
              <span className="validation-icon">{basePassword === confirmValue && confirmValue ? "✓" : "✗"}</span>
              <span>{basePassword === confirmValue && confirmValue ? "Passwords match" : "Password does not match"}</span>
            </div>
          </div>
        )}

        {/* Inline error message */}
        {getFieldError(fieldName) && (
          <span className="field-error">{getFieldError(fieldName)}</span>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-shell" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="auth-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>

        <div className="auth-form-panel">
          <h3 className="auth-title">
            {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
          </h3>

          {error ? <p className="upload-error">{error}</p> : null}
          {success ? <p className="auth-success">{success}</p> : null}

          {mode === "signup" && otpStep === "signup" ? (
            <>
              <div className="input-field-container">
                <input
                  className={`auth-input ${getFieldError("fullName") ? "auth-input-error" : ""}`}
                  placeholder="Full name *"
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  onBlur={() => handleBlur("fullName")}
                />
                {getFieldError("fullName") && <span className="field-error">{getFieldError("fullName")}</span>}
              </div>

              <div className="input-field-container">
                <input
                  className={`auth-input ${getFieldError("email") || emailError ? "auth-input-error" : ""}`}
                  placeholder="Email *"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                />
                {(getFieldError("email") || emailError) && <span className="field-error">{getFieldError("email") || emailError}</span>}
              </div>

              {renderPasswordInput(form.password, (v) => setField("password", v), "Password *", showPassword, setShowPassword, "password", false, true)}

              {renderPasswordInput(form.confirmPassword, (v) => setField("confirmPassword", v), "Confirm Password *", showConfirmPassword, setShowConfirmPassword, "confirmPassword", true, false)}

              <button
                type="button"
                className="auth-primary-btn"
                onClick={handleSignup}
                disabled={loading || !isSignupValid}
              >
                {loading ? "Sending OTP..." : "Send Verification Code"}
              </button>
            </>
          ) : mode === "signup" && otpStep === "otp_sent" ? (
            <>
              <div className="otp-verification-container">
                <div className="otp-info">
                  <p>We've sent a 6-digit verification code to:</p>
                  <p className="otp-email">{form.email}</p>
                </div>

                <div className="input-field-container">
                  <input
                    className={`auth-input ${error ? "auth-input-error" : ""}`}
                    placeholder="Enter 6-digit OTP code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    autoFocus
                  />
                </div>

                {/* Show debug OTP in development */}
                {debugOtp && (
                  <div className="debug-otp-info">
                    <p>Dev OTP: <strong>{debugOtp}</strong></p>
                  </div>
                )}

                <button
                  type="button"
                  className="auth-primary-btn"
                  onClick={handleVerifyOtp}
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading ? "Verifying..." : "Verify & Create Account"}
                </button>

                <div className="resend-otp-section">
                  <p>Didn't receive the code?</p>
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || loading}
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                  </button>
                </div>

                <button
                  type="button"
                  className="auth-back-btn"
                  onClick={handleBackToSignup}
                >
                  ← Back to Sign Up
                </button>
              </div>
            </>
          ) : mode === "login" ? (
            <>
              <div className="input-field-container">
                <input
                  className="auth-input"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  onBlur={() => handleBlur("email")}
                />
              </div>

              {renderPasswordInput(form.password, (v) => setField("password", v), "Password", showPassword, setShowPassword, "password", false, false)}

              <button
                type="button"
                className="auth-primary-btn"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? "Please wait..." : "LOGIN"}
              </button>

              <div className="auth-row">
                <label className="auth-check">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span>Remember Me</span>
                </label>
                <button type="button" className="auth-link-btn auth-link-right" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}>
                  Forgot password?
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="input-field-container">
                <input
                  className="auth-input"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </div>
              <button type="button" className="auth-primary-btn" onClick={handleRequestReset} disabled={loading || resetStep !== "request"}>
                {loading ? "Please wait..." : "Send verification code"}
              </button>

              {resetStep === "verify" && (
                <>
                  <div className="auth-divider auth-divider-labeled">
                    <span>Enter verification code</span>
                  </div>

                  <div className="input-field-container">
                    <input
                      className="auth-input"
                      placeholder="Verification code"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                    />
                  </div>

                  {debugOtp && (
                    <div className="debug-otp-info">
                      <p>Dev OTP: <strong>{debugOtp}</strong></p>
                    </div>
                  )}

                  {renderPasswordInput(newPassword, setNewPassword, "New password", showNewPassword, setShowNewPassword, "newPassword", false, true)}
                  {renderPasswordInput(confirmNewPassword, setConfirmNewPassword, "Confirm new password", showConfirmNewPassword, setShowConfirmNewPassword, "confirmNewPassword", true, false)}

                  <button type="button" className="auth-primary-btn" onClick={handleConfirmReset} disabled={loading}>
                    {loading ? "Please wait..." : "Update password"}
                  </button>
                </>
              )}
              <button type="button" className="auth-link-btn" onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>
                Back to Sign In
              </button>
            </>
          )}

          <div className="auth-oauth-compact">
            <div className="auth-divider auth-divider-labeled">
              <span>{mode === "signup" ? "or Login using:" : "or Login using:"}</span>
            </div>
            <div className="auth-oauth">
              <button type="button" className="oauth-btn google" onClick={() => continueWithProvider("google")} disabled={loading}>
                <i className="fa-brands fa-google"></i>
                Google
              </button>
              <button type="button" className="oauth-btn github" onClick={() => continueWithProvider("github")} disabled={loading}>
                <i className="fa-brands fa-github"></i>
                GitHub
              </button>
              <button type="button" className="oauth-btn linkedin" onClick={() => continueWithProvider("linkedin")} disabled={loading}>
                <i className="fa-brands fa-linkedin"></i>
                LinkedIn
              </button>
            </div>
          </div>
        </div>

        <div className="auth-side-panel">
          <div className="auth-side-content">
            <div className="auth-side-hello">Hello, Friend!</div>
            <div className="auth-side-sub">
              {mode === "login"
                ? "Register with your personal details to use all of the features."
                : "Already have an account? Sign in to continue."}
            </div>
            <button type="button" className="auth-side-btn" onClick={toggleMode} disabled={loading}>
              {mode === "login" ? "SIGN UP" : "LOGIN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
