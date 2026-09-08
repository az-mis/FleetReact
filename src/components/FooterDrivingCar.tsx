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

      {/* ========================================================
          CENTER CHECKPOINT: OFFICER PATROL & CHAT BUBBLE
          ======================================================== */}
      <div className="fleet-checkpoint-officer-wrap">
        {/* Officer Speech Bubble: "Approved ba TO mo?" */}
        <div className="fleet-speech-bubble fleet-bubble-officer">
          <span>Approved ba TO mo?</span>
          <div className="fleet-bubble-tail-officer" />
        </div>

        {/* Animated Walking/Waiting Officer SVG */}
        <div className="fleet-officer-body">
          <svg
            viewBox="-25 0 85 90"
            width="100%"
            height="100%"
            fill="none"
            style={{ overflow: "visible" }}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Ground Contact Shadow */}
            <ellipse cx="27" cy="86" rx="20" ry="2.8" fill="rgba(0,0,0,0.3)" />

            {/* Dark Navy Uniform Trousers / Legs (Standing Stance) */}
            <path
              d="M 18 56
                 L 12 80
                 L 8 82
                 L 8 85
                 L 22 85
                 L 25 58
                 Z"
              fill="#2c3e50"
            />
            {/* Left Leg */}
            <path
              d="M 28 56
                 L 33 80
                 L 40 82
                 L 40 85
                 L 26 85
                 L 25 58
                 Z"
              fill="#243342"
            />
            {/* Black Uniform Service Boots */}
            <path d="M 8 82 C 7 83, 7 85.5, 9 86 L 22 86 L 22 81 Z" fill="#0f172a" />
            <path d="M 40 82 C 41 83, 41 85.5, 39 86 L 26 86 L 26 81 Z" fill="#0f172a" />

            {/* Duty Belt, Holster, Pouch, Handcuffs & Baton */}
            {/* Police Duty Baton / Nightstick hanging behind */}
            <line x1="36" y1="56" x2="43" y2="76" stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" />
            {/* Main Black Leather Duty Belt */}
            <rect x="15" y="52" width="22" height="4.5" rx="1" fill="#1e293b" />
            {/* Heavy Duty Chrome Belt Buckle */}
            <rect x="23" y="51.5" width="6" height="5.5" rx="0.8" fill="#94a3b8" stroke="#334155" strokeWidth="0.6" />
            <rect x="24.8" y="53" width="2.4" height="2.5" fill="#1e293b" />
            {/* Holster on side */}
            <rect x="14" y="52" width="3.5" height="9" rx="1" fill="#0f172a" />

            {/* Light Blue Police Shirt Torso */}
            <path
              d="M 16 33
                 L 35 33
                 C 37 33, 38 35, 37.5 38
                 L 36 53
                 L 15 53
                 L 14 38
                 C 14 35, 15 33, 16 33
                 Z"
              fill="#5dade2"
            />

            {/* Dark Blue Necktie */}
            <polygon points="23,34 28,34 26.5,41 27.5,51 25.5,53 23.5,51 24.5,41" fill="#1e293b" />

            {/* Crisp Shirt Collar */}
            <polygon points="17,33 24,33 22,37" fill="#85c1e9" stroke="#3498db" strokeWidth="0.4" />
            <polygon points="34,33 27,33 29,37" fill="#85c1e9" stroke="#3498db" strokeWidth="0.4" />

            {/* Dark Navy Shoulder Epaulets */}
            <polygon points="15,33 20,33 19,35 14,35" fill="#1e293b" />
            <polygon points="36,33 31,33 32,35 37,35" fill="#1e293b" />

            {/* Shirt Pockets */}
            <rect x="16.5" y="41" width="5.5" height="5" rx="0.6" fill="#4fa7db" stroke="#3498db" strokeWidth="0.4" />
            <rect x="29" y="41" width="5.5" height="5" rx="0.6" fill="#4fa7db" stroke="#3498db" strokeWidth="0.4" />

            {/* Gold Police Shield Badge on Chest */}
            <path
              d="M 17.5 37
                 L 21 37
                 L 21.5 40
                 L 19.2 42.5
                 L 17 40
                 Z"
              fill="#f1c40f"
              stroke="#d4ac0d"
              strokeWidth="0.4"
            />

            {/* Left Arm: Resting on Hip/Belt */}
            <g>
              <path
                d="M 36 34
                   L 44 43
                   C 45 44.5, 45 47, 43 49
                   L 37 53
                   L 33 49
                   L 37 45
                   L 33 36
                   Z"
                fill="#5dade2"
              />
              {/* Police Star Shoulder Patch */}
              <ellipse cx="40" cy="41" rx="3.5" ry="4" fill="#1e293b" stroke="#f1c40f" strokeWidth="0.5" />
              <polygon points="40,38 41,40.5 43.5,41 41.5,42.5 42,45 40,43.5 38,45 38.5,42.5 36.5,41 39,40.5" fill="#f1c40f" />
              {/* Fist on Hip */}
              <circle cx="34" cy="53" r="3.2" fill="#f5b041" />
            </g>

            {/* Right Arm: Hanging straight down naturally at side, lifts up to flag down/stop car when near */}
            <g className="fleet-officer-waving-hand">
              {/* Sleeve hanging straight down from shoulder (pivot point ~15, 34) */}
              <path
                d="M 16 34
                   L 10 37
                   L 8 48
                   L 7 53
                   L 13 53
                   L 14 47
                   L 17 38
                   Z"
                fill="#5dade2"
                stroke="#3498db"
                strokeWidth="0.3"
              />
              {/* Officer White Duty Glove / Hand with clearly visible Open Palm STOP sign */}
              {/* Hand Palm */}
              <ellipse cx="9.5" cy="57" rx="3.8" ry="4" fill="#f8fafc" stroke="#64748b" strokeWidth="0.5" />
              {/* 4 Extended STOP Fingers */}
              <rect x="6.2" y="56" width="1.8" height="6.5" rx="0.9" fill="#f8fafc" stroke="#64748b" strokeWidth="0.4" />
              <rect x="8.3" y="56" width="1.8" height="7.2" rx="0.9" fill="#f8fafc" stroke="#64748b" strokeWidth="0.4" />
              <rect x="10.4" y="56" width="1.8" height="6.8" rx="0.9" fill="#f8fafc" stroke="#64748b" strokeWidth="0.4" />
              <rect x="12.3" y="56.5" width="1.6" height="5.5" rx="0.8" fill="#f8fafc" stroke="#64748b" strokeWidth="0.4" />
              {/* Thumb */}
              <path d="M 6.8 55.5 C 5 56.5, 4.8 59, 6.5 60 Z" fill="#f8fafc" stroke="#64748b" strokeWidth="0.4" />
              {/* Palm inner crease line for 3D depth */}
              <line x1="7.5" y1="57" x2="12.5" y2="57" stroke="#cbd5e1" strokeWidth="0.6" />
            </g>

            {/* Friendly Face, Cheerful Smile & Hair */}
            {/* Neck */}
            <rect x="22" y="30" width="6.5" height="4.5" fill="#f5b041" />
            {/* Head Shape */}
            <path
              d="M 16 19
                 C 16 14, 21 11, 26 11
                 C 31 11, 35 14, 35 19
                 C 35 27, 30 32, 26 32
                 C 21 32, 16 27, 16 19
                 Z"
              fill="#f5b041"
            />
            {/* Brown Hair & Sideburns */}
            <path d="M 16 17 L 34 17 C 35 18, 36 21, 34 23 L 33 19 L 17 19 L 16 23 Z" fill="#873600" />
            {/* Big Friendly Eyes */}
            <ellipse cx="20.5" cy="21" rx="2" ry="2.5" fill="#ffffff" />
            <circle cx="21" cy="21.5" r="1.3" fill="#6e2c00" />
            <circle cx="21.5" cy="20.8" r="0.5" fill="#ffffff" />

            <ellipse cx="29.5" cy="21" rx="2" ry="2.5" fill="#ffffff" />
            <circle cx="29" cy="21.5" r="1.3" fill="#6e2c00" />
            <circle cx="28.5" cy="20.8" r="0.5" fill="#ffffff" />

            {/* Cheerful Open Smile */}
            <path
              d="M 22 26
                 Q 25.5 30 29 26
                 Z"
              fill="#c0392b"
            />
            <path d="M 23.5 26.2 Q 25.5 27.5 27.5 26.2 Z" fill="#ffffff" />

            {/* Cute Nose */}
            <path d="M 25 21 L 24 23.5 L 26 23.5" stroke="#d35400" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            {/* Cute Police Visor Cap with Gold Star Shield Badge */}
            {/* Cap Crown (Navy Blue) */}
            <path
              d="M 14 14
                 C 14 7, 20 4, 26 4
                 C 32 4, 38 7, 38 14
                 Z"
              fill="#1b4f72"
            />
            {/* Cap Band */}
            <rect x="13.5" y="13" width="24" height="3" rx="0.5" fill="#154360" />
            <line x1="14" y1="15.5" x2="37" y2="15.5" stroke="#f1c40f" strokeWidth="0.8" />
            {/* Glossy Black Visor / Bill */}
            <path
              d="M 13.5 15.5
                 C 18 19, 33 19, 37.5 15.5
                 L 35 13.5
                 L 16 13.5
                 Z"
              fill="#0f172a"
            />
            {/* Large Gold Police Badge on Cap Crown */}
            <path
              d="M 22.5 5.5
                 L 28.5 5.5
                 L 29.5 9
                 L 25.5 12
                 L 21.5 9
                 Z"
              fill="#f1c40f"
              stroke="#d4ac0d"
              strokeWidth="0.5"
            />
            <polygon points="25.5,6.5 26.5,8.5 28.5,8.5 27,9.8 27.5,11.5 25.5,10.5 23.5,11.5 24,9.8 22.5,8.5 24.5,8.5" fill="#d4ac0d" />
          </svg>
        </div>
      </div>

      {/* ========================================================
          MOVING 4x4 TRUCK + CHAT BUBBLE
          ======================================================== */}
      <div className="fleet-car-track">
        {/* Car Speech Bubble: "Opo." */}
        <div className="fleet-speech-bubble fleet-bubble-car">
          <span>Opo.</span>
          <div className="fleet-bubble-tail-car" />
        </div>

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
