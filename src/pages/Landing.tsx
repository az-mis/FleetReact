import React from "react";
import { Link } from "react-router-dom";
import { useBranding } from "../contexts/BrandingContext";
import {
  Truck,
  ArrowRight,
  ShieldCheck,
  Search,
  LogIn,
  ClipboardList,
  Sparkles,
} from "lucide-react";

export default function Landing() {
  const { branding } = useBranding();

  return (
    <div className="portal-container landing-container">
      {/* Ambient background glow */}
      <div className="login-bg-glow" aria-hidden="true" />

      <main className="portal-wrapper landing-wrapper fade-in">
        {/* Top Quick Nav */}
        <nav className="portal-top-nav landing-top-nav">
          <div className="portal-nav-badge">
            <span className="login-hero-badge-dot" />
            <span>Official Portal</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link to="/check-status" className="portal-back-link" style={{ fontSize: "12px" }}>
              <Search size={13} />
              <span>Track Request</span>
            </Link>
            <Link to="/login" className="portal-back-link" style={{ fontSize: "12px" }}>
              <span>Staff Login</span>
              <LogIn size={13} />
            </Link>
          </div>
        </nav>

        {/* Center Content Section */}
        <div className="landing-content">
          {/* Logo Showcase */}
          <div className="landing-logos-wrapper">
            {/* DA MIMAROPA Official Logo */}
            <div className="landing-logo-circle" title="Department of Agriculture MIMAROPA">
              <img
                src="/da-logo.png"
                alt="DA MIMAROPA Official Logo"
                className="landing-da-logo-img"
              />
            </div>

            {/* Connecting Badge / Accent */}
            <div className="landing-logo-divider">
              <Sparkles size={14} />
            </div>

            {/* System Logo / Custom App Logo */}
            <div className="landing-logo-circle landing-app-logo" title="Fleet Management System">
              {branding?.logoURL ? (
                <img
                  src={branding.logoURL}
                  alt="Fleet Management System Logo"
                  className="landing-app-logo-img"
                />
              ) : (
                <div className="landing-logo-fallback">
                  <Truck size={30} />
                </div>
              )}
            </div>
          </div>

          {/* Titles & Headings */}
          <div className="landing-header-group">
            <span className="landing-tagline">Department of Agriculture • MIMAROPA Region</span>
            <h1 className="landing-title">
              Welcome to DA MIMAROPA<br />
              <span className="landing-title-highlight">Fleet Management System</span>
            </h1>

            {/* Shimmering Gold Animated Text */}
            <div className="landing-gold-shimmer-wrap">
              <p className="landing-gold-shimmer">
                powered by Management Information Systems
              </p>
            </div>
          </div>

          {/* Quick info feature pills */}
          <div className="landing-highlights-grid">
            <div className="landing-highlight-pill">
              <ClipboardList size={15} className="landing-highlight-icon" />
              <span>Official Travel Request</span>
            </div>
            <div className="landing-highlight-pill">
              <Truck size={15} className="landing-highlight-icon" />
              <span>Fleet Vehicle Allocation</span>
            </div>
            <div className="landing-highlight-pill">
              <Search size={15} className="landing-highlight-icon" />
              <span>Real-Time Status Tracking</span>
            </div>
          </div>

          {/* Main Call to Action Button */}
          <div className="landing-actions">
            <Link
              to="/request-vehicle"
              className="portal-submit-btn landing-primary-btn"
            >
              <span>Continue to Request Vehicle</span>
              <ArrowRight size={17} className="landing-btn-arrow" />
            </Link>

            <div className="landing-secondary-links">
              <Link to="/check-status" className="landing-sub-link">
                Already submitted a request? <u>Check status &amp; trip ticket</u>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="portal-card-footer" style={{ marginTop: "4px" }}>
          <div className="login-security-note">
            <ShieldCheck size={14} />
            <span>DA-RFO MIMAROPA Official Vehicle Dispatch Platform</span>
          </div>
          <p className="login-copyright">
            &copy; {new Date().getFullYear()} Management Information Systems Unit (MIS). All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
