import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LayoutDashboard, LogOut, Menu, X, Truck, Users, ShieldCheck, UserCog, AlertTriangle } from "lucide-react";
import { USER_ROLE_LABEL } from "../types";
import Modal from "./Modal";

function useBreakpoint() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
  };
}

export default function Layout() {
  const { currentUser, profile, role, isAdmin, isSuperAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isTablet) setSidebarOpen(false);
    if (isDesktop) setSidebarOpen(true);
  }, [isTablet, isDesktop]);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", show: true },
    { to: "/admins", icon: ShieldCheck, label: "Admins", show: isSuperAdmin },
    { to: "/drivers", icon: Users, label: "Drivers", show: isAdmin },
    { to: "/vehicles", icon: Truck, label: "Vehicles", show: isAdmin },
    { to: "/vehicle-assigning", icon: UserCog, label: "Vehicle Assigning", show: isAdmin },
  ].filter((i) => i.show);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingOut(false);
      setConfirmLogoutOpen(false);
    }
  }

  const initial = (profile?.name || currentUser?.email || "?")[0]?.toUpperCase();

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header
          style={{
            background: "linear-gradient(90deg, var(--primary-dark) 0%, var(--primary) 100%)",
            padding: "0 16px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>Fleet Mgmt</div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            {initial}
          </div>
        </header>
        <main style={{ flex: 1, padding: "14px", overflow: "auto", paddingBottom: "80px" }}>
          <Outlet />
        </main>
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "56px",
            background: "#fff",
            borderTop: "1px solid var(--border)",
            display: "flex",
            zIndex: 100,
          }}
        >
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                color: isActive ? "var(--primary)" : "var(--text-muted)",
                fontSize: "10px",
                textDecoration: "none",
              })}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setConfirmLogoutOpen(true)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
              background: "none",
              border: "none",
              color: "var(--danger)",
              fontSize: "10px",
              fontWeight: 600,
            }}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </nav>
        {confirmLogoutOpen && (
          <LogoutConfirmModal
            loggingOut={loggingOut}
            onCancel={() => setConfirmLogoutOpen(false)}
            onConfirm={handleLogout}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {isTablet && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 99 }}
        />
      )}

      <aside
        style={{
          width: sidebarOpen ? "var(--sidebar-width)" : "64px",
          background: "linear-gradient(180deg, var(--primary-dark) 0%, var(--primary) 100%)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
          overflow: "hidden",
          flexShrink: 0,
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 100,
          boxShadow: "3px 0 15px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          {sidebarOpen ? (
            <div>
              <div style={{ fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap" }}>Fleet Management</div>
              <div style={{ fontSize: "10px", opacity: 0.7 }}>Vehicles &amp; Drivers</div>
            </div>
          ) : (
            <Truck size={20} />
          )}
        </div>

        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => isTablet && setSidebarOpen(false)}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                marginBottom: "4px",
                background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                fontWeight: isActive ? 600 : 400,
                fontSize: "14px",
                borderLeft: isActive ? "3px solid var(--secondary)" : "3px solid transparent",
                textDecoration: "none",
              })}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {sidebarOpen && (
            <div style={{ padding: "8px 12px", marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "12px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profile?.name || currentUser?.email}
              </div>
              {role && (
                <div style={{ fontSize: "10px", opacity: 0.75, marginTop: 2 }}>{USER_ROLE_LABEL[role]}</div>
              )}
            </div>
          )}
          <button
            onClick={() => setConfirmLogoutOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "var(--danger)",
              border: "none",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {sidebarOpen && "Logout"}
          </button>
        </div>
      </aside>

      <div
        style={{
          flex: 1,
          marginLeft: isTablet ? "64px" : sidebarOpen ? "var(--sidebar-width)" : "64px",
          transition: isTablet ? "none" : "margin-left 0.25s ease",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            background: "#fff",
            padding: "0 24px",
            height: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            zIndex: 50,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", color: "var(--primary)", padding: "6px" }}
          >
            {sidebarOpen && !isTablet ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div style={{ display: "flex", alignItems: "center", flexDirection: "column" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--primary-dark)" }}>Fleet Management Dashboard</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Vehicles, drivers, and admin accounts.
            </p>
          </div>

          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            {initial}
          </div>
        </header>

        <main style={{ flex: 1, padding: isTablet ? "16px" : "24px", overflow: "auto" }}>
          <Outlet />
        </main>
      </div>

      {confirmLogoutOpen && (
        <LogoutConfirmModal
          loggingOut={loggingOut}
          onCancel={() => setConfirmLogoutOpen(false)}
          onConfirm={handleLogout}
        />
      )}
    </div>
  );
}

function LogoutConfirmModal({
  loggingOut,
  onCancel,
  onConfirm,
}: {
  loggingOut: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Log out?" onClose={onCancel}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "10px",
              background: "#fff5f5",
              color: "var(--danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <p style={{ fontSize: "13.5px", color: "#4a5568", lineHeight: 1.5, marginTop: "6px" }}>
            You'll be signed out and returned to the login screen. Any unsaved changes on this
            page will be lost.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onCancel}
            disabled={loggingOut}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "#fff",
              color: "#2d3748",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loggingOut}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: "var(--danger)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {loggingOut ? "Logging out..." : "Log Out"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
