import React, { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Truck,
  ArrowRight,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Loader2,
} from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      {/* Ambient background decoration */}
      <div className="login-bg-glow" aria-hidden="true" />

      <main className="login-wrapper fade-in">
        {/* Left / Hero Branding Panel */}
        <section className="login-hero-panel">
          <div className="login-hero-content">
            <div className="login-hero-badge">
              <span className="login-hero-badge-dot" />
              <span>Fleet Management System</span>
            </div>

            <div className="login-hero-header">
              <div className="login-hero-logo">
                {branding?.logoURL ? (
                  <img src={branding.logoURL} alt="Logo" />
                ) : (
                  <div className="login-hero-logo-placeholder">
                    <Truck size={28} />
                  </div>
                )}
              </div>
              <h1 className="login-hero-title">
                Smart Fleet Operations &amp; Monitoring
              </h1>
            </div>

            <p className="login-hero-desc">
              A unified, secure platform for tracking vehicles, assigning drivers,
              and managing trip requests in real time.
            </p>

            <div className="login-hero-features">
              <div className="login-hero-feature-item">
                <div className="login-hero-feature-icon">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <span className="login-hero-feature-title">Role-Based Security</span>
                  <span className="login-hero-feature-sub">Super admin, admin &amp; driver workflows</span>
                </div>
              </div>

              <div className="login-hero-feature-item">
                <div className="login-hero-feature-icon">
                  <Truck size={18} />
                </div>
                <div>
                  <span className="login-hero-feature-title">Real-Time Allocation</span>
                  <span className="login-hero-feature-sub">Permanent assignments &amp; calendar availability</span>
                </div>
              </div>

              <div className="login-hero-feature-item">
                <div className="login-hero-feature-icon">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <span className="login-hero-feature-title">Trip Ticket Generation</span>
                  <span className="login-hero-feature-sub">Instant printable travel authorizations</span>
                </div>
              </div>
            </div>
          </div>

          <div className="login-hero-footer">
            <span>Authorized Agency Personnel Only</span>
            <span className="login-hero-footer-divider">•</span>
            <span>All activities logged</span>
          </div>
        </section>

        {/* Right / Login Form Panel */}
        <section className="login-form-panel">
          <div className="login-form-card">
            <div className="login-form-header">
              <div className="login-mobile-logo">
                {branding?.logoURL ? (
                  <img src={branding.logoURL} alt="Logo" />
                ) : (
                  <Truck size={24} />
                )}
              </div>
              <h2 className="login-title">Sign In</h2>
              <p className="login-subtitle">
                Enter your account credentials to access your dashboard
              </p>
            </div>

            {error && (
              <div className="login-alert" role="alert">
                <AlertTriangle size={17} className="login-alert-icon" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-input-group">
                <label htmlFor="login-email">Email address</label>
                <div className="login-input-wrapper">
                  <Mail size={17} className="login-input-icon" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="name@agency.gov.ph"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="login-input-group">
                <div className="login-label-row">
                  <label htmlFor="login-password">Password</label>
                </div>
                <div className="login-input-wrapper">
                  <Lock size={17} className="login-input-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="login-toggle-pw"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="login-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Dashboard</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Public Quick Actions Section */}
            <div className="login-public-section">
              <div className="login-divider-row">
                <span className="login-divider-line" />
                <span className="login-divider-text">Public Staff Portals</span>
                <span className="login-divider-line" />
              </div>

              <div className="login-public-links">
                <Link to="/request-vehicle" className="login-public-btn">
                  <Truck size={15} />
                  <span>Request a Vehicle</span>
                </Link>

                <Link to="/check-status" className="login-public-btn">
                  <Search size={15} />
                  <span>Check Request Status</span>
                </Link>
              </div>
            </div>

            <footer className="login-card-footer">
              <div className="login-security-note">
                <ShieldCheck size={14} />
                <span>Encrypted &amp; Protected Session</span>
              </div>
              <p className="login-copyright">
                &copy; {new Date().getFullYear()} Vehicle Monitoring &amp; Management System
              </p>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
