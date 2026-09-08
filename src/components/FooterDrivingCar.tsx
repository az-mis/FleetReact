import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export const CAR_ANIMATION_STORAGE_KEY = "fleet_footer_car_enabled";

export default function FooterDrivingCar() {
  const location = useLocation();
  const [enabled, setEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(CAR_ANIMATION_STORAGE_KEY);
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    const handleStorageOrCustom = () => {
      const saved = localStorage.getItem(CAR_ANIMATION_STORAGE_KEY);
      setEnabled(saved === null ? true : saved === "true");
    };

    window.addEventListener("fleet-car-toggle", handleStorageOrCustom);
    window.addEventListener("storage", handleStorageOrCustom);
    return () => {
      window.removeEventListener("fleet-car-toggle", handleStorageOrCustom);
      window.removeEventListener("storage", handleStorageOrCustom);
    };
  }, []);

  // Do not render on printable Trip Ticket page or if toggled off
  if (!enabled || location.pathname.startsWith("/trip-ticket")) {
    return null;
  }

  return (
    <div id="fleet-car-footer-wrapper" aria-hidden="true">
      <div className="fleet-road-line" />
      <div className="fleet-car-track">
        <svg
          viewBox="0 0 130 62"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Crisp Projector Headlight Beam */}
            <linearGradient id="headlightBeamTruck" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="40%" stopColor="#fef08a" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
            </linearGradient>

            {/* Automotive Window Privacy Tint */}
            <linearGradient id="windowGlassTint" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#334155" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
            </linearGradient>

            {/* Metallic Chrome & Alloy Rim Shading */}
            <linearGradient id="chromeShine" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>

            {/* DA Green Two-Tone Lower Section */}
            <linearGradient id="daGreenLivery" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#15803d" />
              <stop offset="50%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
          </defs>

          {/* Headlight Projector Light Beam */}
          <polygon
            className="fleet-headlight-glow"
            points="123,28 145,18 145,46 123,34"
            fill="url(#headlightBeamTruck)"
          />

          {/* Truck Body & Suspension Sway Group */}
          <g className="fleet-car-chassis-group">
            {/* Ground Shadow */}
            <ellipse cx="65" cy="54.5" rx="58" ry="3" fill="rgba(0,0,0,0.28)" />

            {/* --- UPPER BODY: Tall Pearl White Cab, Hood, and Truck Bed --- */}
            <path
              d="M 5 35
                 L 5 26
                 C 5 25, 6 24, 7.5 24
                 L 39 24
                 L 46 11.5
                 C 47.5 9, 50 8.5, 54 8.5
                 L 87 8.5
                 C 90 8.5, 92 10, 95 15
                 L 100 24
                 L 119 24
                 C 122 24, 124 25.5, 124 28
                 L 124 35
                 L 121 39
                 L 112 39
                 L 22 39
                 L 5 39
                 Z"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="0.6"
            />

            {/* Bed Top Rail Cap (Textured Black) */}
            <rect x="5" y="23.2" width="34.5" height="1.8" rx="0.5" fill="#1e293b" />
            <rect x="37" y="22.6" width="2.5" height="2.5" rx="0.5" fill="#334155" />

            {/* --- LOWER BODY: Two-Tone DA Forest Green Stripe --- */}
            <path
              d="M 5 35
                 L 124 35
                 L 124 41.5
                 L 119 41.5
                 L 116 41.5
                 A 13 13 0 0 0 90 41.5
                 L 46 41.5
                 A 13 13 0 0 0 20 41.5
                 L 5 41.5
                 Z"
              fill="url(#daGreenLivery)"
            />

            {/* Side Step / Rocker Running Board */}
            <rect x="44" y="42.8" width="48" height="2.2" rx="1.1" fill="#0f172a" stroke="#334155" strokeWidth="0.5" />

            {/* Chrome Front Bumper */}
            <path
              d="M 118 34 L 125 34 C 126 34 126.5 35 126.5 37 L 126 42.5 L 118 42.5 Z"
              fill="url(#chromeShine)"
              stroke="#64748b"
              strokeWidth="0.5"
            />
            {/* Chrome Rear Bumper */}
            <path
              d="M 4 34 L 7 34 L 7 42.5 L 3.5 42.5 C 2.8 42.5 2.5 41.5 2.5 40.5 L 2.5 36 C 2.5 35 3.2 34 4 34 Z"
              fill="url(#chromeShine)"
              stroke="#64748b"
              strokeWidth="0.5"
            />

            {/* Front Grille Bar (Black / Dark Chrome) */}
            <rect x="122.5" y="26.5" width="3.5" height="7.5" rx="0.8" fill="#1e293b" />
            <line x1="122.5" y1="28.8" x2="125.5" y2="28.8" stroke="#94a3b8" strokeWidth="0.7" />
            <line x1="122.5" y1="31.2" x2="125.5" y2="31.2" stroke="#94a3b8" strokeWidth="0.7" />

            {/* Headlights (F-150 C-Shape LED Projectors) */}
            <path
              d="M 118 25.5 L 122.5 25.5 L 122.5 33.5 L 118 33.5 Z"
              fill="#f8fafc"
              stroke="#64748b"
              strokeWidth="0.5"
            />
            <rect x="120" y="26.5" width="2.2" height="3" rx="0.4" fill="#f59e0b" />
            <path d="M 118.5 25.8 L 122 25.8 L 122 33 L 118.5 33" stroke="#fef08a" strokeWidth="1" fill="none" />

            {/* Red Taillight Assembly */}
            <path
              d="M 5 25 L 8 25 L 8 34.5 L 5 34.5 Z"
              fill="#dc2626"
              stroke="#991b1b"
              strokeWidth="0.5"
            />
            <rect x="5.5" y="27.5" width="2" height="3" fill="#ffffff" opacity="0.9" />

            {/* --- TALL TINTED WINDOWS (Proper Tall Cabin Profile) --- */}
            {/* Rear Passenger Window */}
            <path
              d="M 47.5 11 L 67 11 L 67 23 L 42 23 L 46.5 13 Z"
              fill="url(#windowGlassTint)"
            />
            {/* Front Driver Window with Signature Drop Notch */}
            <path
              d="M 69.5 11 L 86 11 C 88 11, 90 12.5, 92 16.5 L 94.5 23 L 78 23 L 69.5 23 Z"
              fill="url(#windowGlassTint)"
            />

            {/* Window Pillars */}
            <rect x="67" y="10" width="2.5" height="13.5" fill="#0f172a" />
            <path d="M 45 10.5 L 47.5 10.5 L 42.5 23 L 40 23 Z" fill="#0f172a" />

            {/* Side Mirror */}
            <path
              d="M 91 18.5 L 96 18.5 C 97 18.5, 97.5 19.5, 97 21.5 L 93 21.5 Z"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="0.5"
            />

            {/* Door Panel Seams */}
            <line x1="68" y1="10" x2="68" y2="39" stroke="#94a3b8" strokeWidth="0.7" />
            <line x1="40" y1="23.5" x2="40" y2="39" stroke="#94a3b8" strokeWidth="0.7" />
            <line x1="97" y1="23.5" x2="97" y2="39" stroke="#94a3b8" strokeWidth="0.7" />

            {/* Black Door Handles */}
            <rect x="44" y="25.5" width="5.5" height="1.6" rx="0.6" fill="#0f172a" />
            <rect x="71" y="25.5" width="5.5" height="1.6" rx="0.6" fill="#0f172a" />

            {/* Fuel Door */}
            <rect x="30" y="27" width="5" height="5" rx="0.9" fill="none" stroke="#cbd5e1" strokeWidth="0.6" />

            {/* Front Fender Vent Emblem */}
            <rect x="99" y="25" width="3.5" height="3.5" rx="0.5" fill="#0f172a" />
            <rect x="99.5" y="25.6" width="2.5" height="1.2" fill="#cbd5e1" />

            {/* F-150 Bed Decal */}
            <text
              x="10"
              y="28.5"
              fontSize="3.8"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              fontStyle="italic"
              fill="#dc2626"
              opacity="0.9"
            >
              F-150 <tspan fill="#475569" fontSize="3">4x4</tspan>
            </text>

            {/* ========================================================
                LIVERY: OFFICIAL DA LOGO + DA FLEET OFFICIAL TEXT
                ======================================================== */}
            <g transform="translate(46, 25)">
              {/* DA Emblem Seal */}
              <image
                href="/da-logo.png"
                x="0"
                y="0.5"
                width="11"
                height="11"
                preserveAspectRatio="xMidYMid meet"
              />

              {/* Bold DA FLEET Green Typography */}
              <text
                x="13"
                y="6"
                fontSize="5.5"
                fontWeight="900"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#15803d"
                letterSpacing="0.04em"
              >
                DA FLEET
              </text>

              {/* Sub-label OFFICIAL in Muted Charcoal */}
              <text
                x="13.2"
                y="10"
                fontSize="3.5"
                fontWeight="800"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#475569"
                letterSpacing="0.08em"
              >
                OFFICIAL
              </text>
            </g>
          </g>

          {/* ========================================================
              BIGGER, HIGH-CLEARANCE 4x4 ALLOY WHEELS
              ======================================================== */}
          {/* Rear Wheel Assembly */}
          <g transform="translate(33, 43)">
            {/* Outer Rugged Rubber Tire */}
            <circle cx="0" cy="0" r="11" fill="#0f172a" />
            <circle cx="0" cy="0" r="9.8" fill="#1e293b" />
            {/* Spinning Two-Tone Machined Alloy Rim */}
            <g className="fleet-car-wheel-rim">
              <circle cx="0" cy="0" r="6.8" fill="#0f172a" />
              <circle cx="0" cy="0" r="6.3" fill="#334155" />
              {/* 6 Machined Silver Spokes */}
              <line x1="-5.6" y1="0" x2="5.6" y2="0" stroke="#f1f5f9" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="-2.8" y1="-4.8" x2="2.8" y2="4.8" stroke="#f1f5f9" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="-2.8" y1="4.8" x2="2.8" y2="-4.8" stroke="#f1f5f9" strokeWidth="1.4" strokeLinecap="round" />
              {/* Ford Center Cap */}
              <circle cx="0" cy="0" r="2" fill="#0f172a" />
              <circle cx="0" cy="0" r="1.4" fill="#3b82f6" />
            </g>
          </g>

          {/* Front Wheel Assembly */}
          <g transform="translate(103, 43)">
            {/* Outer Rugged Rubber Tire */}
            <circle cx="0" cy="0" r="11" fill="#0f172a" />
            <circle cx="0" cy="0" r="9.8" fill="#1e293b" />
            {/* Spinning Two-Tone Machined Alloy Rim */}
            <g className="fleet-car-wheel-rim">
              <circle cx="0" cy="0" r="6.8" fill="#0f172a" />
              <circle cx="0" cy="0" r="6.3" fill="#334155" />
              {/* 6 Machined Silver Spokes */}
              <line x1="-5.6" y1="0" x2="5.6" y2="0" stroke="#f1f5f9" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="-2.8" y1="-4.8" x2="2.8" y2="4.8" stroke="#f1f5f9" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="-2.8" y1="4.8" x2="2.8" y2="-4.8" stroke="#f1f5f9" strokeWidth="1.4" strokeLinecap="round" />
              {/* Ford Center Cap */}
              <circle cx="0" cy="0" r="2" fill="#0f172a" />
              <circle cx="0" cy="0" r="1.4" fill="#3b82f6" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

/**
 * Utility helper to toggle car animation from anywhere in the app
 */
export function toggleCarAnimation(explicitState?: boolean): boolean {
  const current = localStorage.getItem(CAR_ANIMATION_STORAGE_KEY);
  const isEnabled = current === null ? true : current === "true";
  const next = explicitState !== undefined ? explicitState : !isEnabled;
  localStorage.setItem(CAR_ANIMATION_STORAGE_KEY, String(next));
  window.dispatchEvent(new Event("fleet-car-toggle"));
  return next;
}
