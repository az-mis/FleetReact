import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import {
  Settings2,
  Sparkles,
  Truck,
  Zap,
  Sliders,
} from "lucide-react";
import { CAR_ANIMATION_STORAGE_KEY, toggleCarAnimation } from "../components/FooterDrivingCar";

export const UI_EFFECTS_STORAGE_KEY = "fleet_ui_effects_enabled";

/**
 * Helper to get and set UI effects state across the application
 */
export function getUIEffectsState(): boolean {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(UI_EFFECTS_STORAGE_KEY);
  return saved === null ? true : saved === "true";
}

export function setUIEffectsState(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(UI_EFFECTS_STORAGE_KEY, String(enabled));
  if (enabled) {
    document.body.classList.remove("disable-ui-effects");
  } else {
    document.body.classList.add("disable-ui-effects");
  }
  window.dispatchEvent(new Event("fleet-ui-effects-toggle"));
}

export default function DriverSettings() {
  const { profile, isDriver } = useAuth();
  const { showSuccess } = useToast();

  const [carAnimation, setCarAnimation] = useState<boolean>(() => {
    const saved = localStorage.getItem(CAR_ANIMATION_STORAGE_KEY);
    return saved === null ? true : saved === "true";
  });

  const [uiEffects, setUiEffects] = useState<boolean>(() => getUIEffectsState());

  useEffect(() => {
    const handleCarToggle = () => {
      const saved = localStorage.getItem(CAR_ANIMATION_STORAGE_KEY);
      setCarAnimation(saved === null ? true : saved === "true");
    };

    const handleUiToggle = () => {
      setUiEffects(getUIEffectsState());
    };

    window.addEventListener("fleet-car-toggle", handleCarToggle);
    window.addEventListener("fleet-ui-effects-toggle", handleUiToggle);
    return () => {
      window.removeEventListener("fleet-car-toggle", handleCarToggle);
      window.removeEventListener("fleet-ui-effects-toggle", handleUiToggle);
    };
  }, []);

  function handleToggleCar() {
    const nextState = !carAnimation;
    toggleCarAnimation(nextState);
    setCarAnimation(nextState);
    showSuccess(
      nextState
        ? "Footer car animation enabled."
        : "Footer car animation disabled."
    );
  }

  function handleToggleUIEffects() {
    const nextState = !uiEffects;
    setUIEffectsState(nextState);
    setUiEffects(nextState);
    showSuccess(
      nextState
        ? "Visual & UI effects enabled."
        : "Visual & UI effects disabled (Reduced motion mode)."
    );
  }

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <PageHeader
        icon={Settings2}
        title="Settings"
        subtitle={
          isDriver
            ? `Driver Preferences for ${profile?.name || "Authenticated Driver"}`
            : "Display and visual preferences"
        }
      />

      <div style={{ maxWidth: "780px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Info Banner */}
        <div
          style={{
            background: "#edf7ee",
            border: "1px solid #c6e7cb",
            borderRadius: "12px",
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            color: "#134d2b",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "10px",
              background: "#dcf2e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "2px" }}>
              Visual & UI Effects Customization
            </div>
            <div style={{ fontSize: "12.5px", color: "#2d3748", lineHeight: 1.4 }}>
              Personalize your driving dashboard and application experience. Toggle interactive background animations and transition effects according to your preference.
            </div>
          </div>
        </div>

        {/* Visual & UI Effects Card */}
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sliders size={17} color="var(--primary)" />
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#1a202c", margin: 0 }}>
                Display & Animation Preferences
              </h2>
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--primary)",
                background: "#e6f4ea",
                padding: "3px 10px",
                borderRadius: "999px",
              }}
            >
              Driver Controls
            </span>
          </div>

          <div style={{ padding: "8px 20px", display: "flex", flexDirection: "column" }}>
            
            {/* Toggle 1: Footer Car Animation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 0",
                borderBottom: "1px solid var(--border)",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "9px",
                    background: carAnimation ? "#e6f4ea" : "#f1f5f9",
                    color: carAnimation ? "var(--primary)" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <Truck size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#1a202c", display: "flex", alignItems: "center", gap: "8px" }}>
                    Footer Driving Car & Patrol Officer
                    {carAnimation ? (
                      <span style={{ fontSize: "10.5px", color: "#0f7a44", background: "#d9f5e5", padding: "1px 6px", borderRadius: "6px", fontWeight: 700 }}>
                        Active
                      </span>
                    ) : (
                      <span style={{ fontSize: "10.5px", color: "#718096", background: "#edf2f7", padding: "1px 6px", borderRadius: "6px", fontWeight: 700 }}>
                        Off
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px", lineHeight: 1.45 }}>
                    Show the interactive animated DA 4x4 pickup truck and checkpoint officer patrol along the bottom road line.
                  </div>
                </div>
              </div>

              {/* Switch Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={carAnimation}
                onClick={handleToggleCar}
                style={{
                  width: "48px",
                  height: "26px",
                  borderRadius: "13px",
                  border: "none",
                  background: carAnimation ? "var(--primary)" : "#cbd5e1",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                  flexShrink: 0,
                  padding: "2px",
                }}
              >
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    transform: carAnimation ? "translateX(22px)" : "translateX(0px)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
            </div>

            {/* Toggle 2: UI Transitions & Visual Motion */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 0",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "9px",
                    background: uiEffects ? "#e6f4ea" : "#f1f5f9",
                    color: uiEffects ? "var(--primary)" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <Zap size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#1a202c", display: "flex", alignItems: "center", gap: "8px" }}>
                    UI Motion & Smooth Transitions
                    {uiEffects ? (
                      <span style={{ fontSize: "10.5px", color: "#0f7a44", background: "#d9f5e5", padding: "1px 6px", borderRadius: "6px", fontWeight: 700 }}>
                        Enabled
                      </span>
                    ) : (
                      <span style={{ fontSize: "10.5px", color: "#718096", background: "#edf2f7", padding: "1px 6px", borderRadius: "6px", fontWeight: 700 }}>
                        Reduced Motion
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px", lineHeight: 1.45 }}>
                    Enable smooth entrance animations, page transitions, and subtle interactive visual effects throughout the system.
                  </div>
                </div>
              </div>

              {/* Switch Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={uiEffects}
                onClick={handleToggleUIEffects}
                style={{
                  width: "48px",
                  height: "26px",
                  borderRadius: "13px",
                  border: "none",
                  background: uiEffects ? "var(--primary)" : "#cbd5e1",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                  flexShrink: 0,
                  padding: "2px",
                }}
              >
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    transform: uiEffects ? "translateX(22px)" : "translateX(0px)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
            </div>

          </div>
        </div>

        {/* Account summary note */}
        <div
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "var(--text-muted)",
            padding: "4px 0",
          }}
        >
          Preferences are saved automatically in your local browser and remain active for your authenticated session.
        </div>

      </div>
    </div>
  );
}
