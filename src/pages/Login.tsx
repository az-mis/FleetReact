import React, { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  MapPin,
  ClipboardList,
  Car,
  LogIn,
  AlertTriangle,
} from "lucide-react";

/**
 * Visual redesign (green government-portal look, two-column layout with a
 * branding panel + sign-in card) adapted from a static HTML/CSS mockup into
 * this page's real React/Firebase auth flow. Two things are still fully
 * live/dynamic, same as before the redesign:
 *  - the "seal" logo and the small app icon both fall back to a generic
 *    mark until a super admin uploads a real logo in Content Settings
 *    (BrandingContext -> branding.logoURL);
 *  - the branding panel's background image is the built-in CSS
 *    illustration by default, but switches to a super admin's uploaded
 *    photo the moment branding.loginBackgroundURL is set (see the new
 *    "Login Background" section added to Content Settings).
 * The mockup's "Forgot password?" link went nowhere (`onclick="return
 * false"`) and there's no such flow wired up yet, so it's left out rather
 * than shipping a dead link -- easy to add back once that flow exists.
 */
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
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  const hasCustomBg = !!branding?.loginBackgroundURL;

  return (
    <main className="login-page">
      <section
        className={`login-visual${hasCustomBg ? " login-visual--custom-bg" : ""}`}
        style={hasCustomBg ? ({ "--login-bg-image": `url(${branding!.loginBackgroundURL})` } as React.CSSProperties) : undefined}
      >
        <div className="login-brand">
          <div className="login-seal">
            {branding?.logoURL ? (
              <img src={branding.logoURL} alt="Logo" />
            ) : (
              <>
                FLEET
                <br />
                MGMT
              </>
            )}
          </div>
          <div className="login-brand-title">
            VEHICLE MONITORING &amp;
            <br />
            MANAGEMENT SYSTEM
          </div>
        </div>

        <div className="login-intro">
          <div className="login-green-line" />
          <p>
            A secure and efficient system for monitoring, managing, and maintaining your fleet's vehicles, drivers,
            and requests in one place.
          </p>
        </div>

        <div className="login-fleet" aria-hidden="true">
          <div className="login-car login-car1" />
          <div className="login-car login-car2" />
          <div className="login-car login-car3" />
        </div>

        <div className="login-features">
          <div className="login-feature">
            <div className="login-feature-icon">
              <ShieldCheck size={22} strokeWidth={1.8} />
            </div>
            <h3>SECURE</h3>
            <p>Your data is protected with role-based access and secure sign-in.</p>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon">
              <MapPin size={22} strokeWidth={1.8} />
            </div>
            <h3>MONITOR</h3>
            <p>Keep track of every vehicle's status and assignment at a glance.</p>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon">
              <ClipboardList size={22} strokeWidth={1.8} />
            </div>
            <h3>MANAGE</h3>
            <p>Manage vehicles, drivers, and requests efficiently in one system.</p>
          </div>
        </div>
      </section>

      <section className="login-area">
        <div className="login-dots" aria-hidden="true" />

        <form className="login-card fade-in" onSubmit={handleSubmit}>
          <div className="login-app-icon">
            {branding?.logoURL ? (
              <img src={branding.logoURL} alt="Logo" />
            ) : (
              <Car size={44} strokeWidth={1.65} />
            )}
            <span className="login-badge">
              <ShieldCheck size={14} strokeWidth={2} />
            </span>
          </div>

          <h2>Welcome Back!</h2>
          <p className="login-subtitle">Please sign in to continue to the system</p>

          {error && (
            <div className="login-error">
              <AlertTriangle size={18} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="login-field">
            <label htmlFor="login-email">Email Address</label>
            <div className="login-input">
              <Mail size={18} strokeWidth={1.7} />
              <input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-input">
              <Lock size={18} strokeWidth={1.7} />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button className="login-signin" type="submit" disabled={loading}>
            <LogIn size={19} strokeWidth={2} />
            <span>{loading ? "Signing in..." : "Sign In"}</span>
          </button>

          <div className="login-divider">
            <span />
            <ShieldCheck size={19} strokeWidth={1.7} />
            <span />
          </div>

          <div className="login-notice">
            <ShieldCheck size={26} strokeWidth={1.8} />
            <p>
              This system is for authorized personnel only.
              <br />
              All activities are monitored and recorded.
            </p>
          </div>

          <div className="login-footer">
            © {new Date().getFullYear()} Vehicle Monitoring &amp; Management System
            <br />
            All rights reserved.
          </div>
        </form>
      </section>
    </main>
  );
}
