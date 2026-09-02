import React, { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";
import { Lock, Mail, Truck, Eye, EyeOff } from "lucide-react";

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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)",
        padding: "16px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="fade-in"
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "32px",
          width: "100%",
          maxWidth: "380px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          {branding?.logoURL ? (
            <img
              src={branding.logoURL}
              alt="Logo"
              style={{ width: 22, height: 22, borderRadius: "5px", objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <Truck size={22} color="var(--primary)" />
          )}
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--primary-dark)" }}>Fleet Management</h1>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px" }}>
          Sign in to manage vehicles, drivers, and admins.
        </p>

        {error && (
          <div
            style={{
              background: "#fff5f5",
              color: "var(--danger)",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Email</label>
        <div style={{ position: "relative", margin: "6px 0 16px" }}>
          <Mail size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px 10px 36px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "14px",
            }}
          />
        </div>

        <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Password</label>
        <div style={{ position: "relative", margin: "6px 0 24px" }}>
          <Lock size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 40px 10px 36px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "14px",
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
            style={{
              position: "absolute",
              right: 10,
              top: 8,
              padding: "4px",
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: "8px",
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
