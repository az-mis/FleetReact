import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Truck,
  Users,
  ShieldCheck,
  UserCog,
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  Settings2,
  Megaphone,
  Lock,
} from "lucide-react";
import { USER_ROLE_LABEL } from "../types";
import Modal from "./Modal";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";

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

// Live count of pending vehicle requests, for the sidebar notification badge.
// Admin-only (matches the Firestore rule restricting `list` on this
// collection), so it's skipped entirely for non-admins.
function usePendingRequestsCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    const q = query(collection(db, "vehicleRequests"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(0));
    return unsub;
  }, [enabled]);
  return count;
}

export default function Layout() {
  const { currentUser, profile, role, isAdmin, isSuperAdmin, isDriver, logout } = useAuth();
  const { flags } = useFeatureFlags();
  const navigate = useNavigate();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const pendingRequestsCount = usePendingRequestsCount(isAdmin);

  // Super admins are never gated by their own CMS toggles — the toggles only
  // ever restrict the plain "admin" role.
  const moduleEnabled = (key: keyof typeof flags.adminModules) =>
    isSuperAdmin || flags.adminModules[key];

  const showAnnouncementBanner =
    flags.announcement.enabled &&
    !!flags.announcement.message.trim() &&
    ((isDriver && flags.driverModules.showAnnouncement && flags.announcement.audience.includes("driver")) ||
      (isAdmin && flags.announcement.audience.includes("admin")));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isTablet) setSidebarOpen(false);
    if (isDesktop) setSidebarOpen(true);
  }, [isTablet, isDesktop]);

  const location = useLocation();

  // Flat items stay top-level; "group" items render as an expandable dropdown
  // whose children are real routes. The same structure drives both the
  // desktop sidebar and the mobile slide-out drawer (see NavList below).
  const navStructure: NavItem[] = [
    { type: "link", to: "/", icon: LayoutDashboard, label: "Dashboard", show: true, end: true },
    { type: "link", to: "/admins", icon: ShieldCheck, label: "Admins", show: isSuperAdmin },
    {
      type: "link",
      to: "/drivers",
      icon: Users,
      label: "Drivers",
      show: isAdmin,
      disabled: isAdmin && !isSuperAdmin && !moduleEnabled("drivers"),
    },
    {
      type: "group",
      label: "Vehicles",
      icon: Truck,
      show: isAdmin,
      badge: pendingRequestsCount,
      children: [
        {
          to: "/vehicles",
          icon: Truck,
          label: "Vehicle Information",
          show: true,
          disabled: isAdmin && !isSuperAdmin && !moduleEnabled("vehicles"),
        },
        {
          to: "/vehicle-assigning",
          icon: UserCog,
          label: "Vehicle Assigning",
          show: true,
          disabled: isAdmin && !isSuperAdmin && !moduleEnabled("vehicleAssigning"),
        },
        {
          to: "/vehicle-requests",
          icon: ClipboardList,
          label: "Vehicle Requests",
          show: true,
          badge: pendingRequestsCount,
          disabled: isAdmin && !isSuperAdmin && !moduleEnabled("vehicleRequests"),
        },
      ],
    },
    {
      type: "link",
      to: "/content-settings",
      icon: Settings2,
      label: "Content Settings",
      show: isSuperAdmin,
    },
  ];

  const isChildActive = (children: { to: string }[]) =>
    children.some((c) => location.pathname === c.to || location.pathname.startsWith(c.to + "/"));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navStructure.forEach((item) => {
      if (item.type === "group") initial[item.label] = isChildActive(item.children);
    });
    return initial;
  });

  // The group's open/closed state always mirrors whether the current route
  // is one of its children — collapsing automatically the moment navigation
  // leaves the group. Manual toggling below (clicking the group header) only
  // stays in effect until the next navigation, at which point this recompute
  // takes over again.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      navStructure.forEach((item) => {
        if (item.type === "group") next[item.label] = isChildActive(item.children);
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header
          style={{
            background: "linear-gradient(90deg, var(--primary-dark) 0%, var(--primary) 100%)",
            padding: "0 12px",
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
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            style={{ position: "relative", background: "none", border: "none", color: "#fff", padding: "8px" }}
          >
            <Menu size={22} />
            <Badge count={pendingRequestsCount} dot />
          </button>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>Fleet Management</div>
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

        <main style={{ flex: 1, padding: "14px", overflow: "auto" }}>
          {showAnnouncementBanner && <AnnouncementBanner message={flags.announcement.message} />}
          <Outlet />
        </main>

        {mobileNavOpen && (
          <div
            onClick={() => setMobileNavOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 199 }}
          />
        )}

        <aside
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            width: "78%",
            maxWidth: "300px",
            background: "linear-gradient(180deg, var(--primary-dark) 0%, var(--primary) 100%)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            zIndex: 200,
            transform: mobileNavOpen ? "translateX(0)" : "translateX(-105%)",
            transition: "transform 0.25s ease",
            boxShadow: "3px 0 15px rgba(0,0,0,0.25)",
          }}
        >
          <div
            style={{
              padding: "18px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "13px" }}>Fleet Management</div>
              <div style={{ fontSize: "10px", opacity: 0.7 }}>Vehicles &amp; Drivers</div>
            </div>
            <button
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              style={{ background: "none", border: "none", color: "#fff", padding: "6px" }}
            >
              <X size={20} />
            </button>
          </div>

          <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
            <NavList
              navStructure={navStructure}
              openGroups={openGroups}
              setOpenGroups={setOpenGroups}
              isChildActive={isChildActive}
              showLabels
              onNavigate={() => setMobileNavOpen(false)}
            />
          </nav>

          <div style={{ padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ padding: "8px 12px", marginBottom: "8px" }}>
              <div style={{ fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile?.name || currentUser?.email}
              </div>
              {role && <div style={{ fontSize: "10px", opacity: 0.75, marginTop: 2 }}>{USER_ROLE_LABEL[role]}</div>}
            </div>
            <button
              onClick={() => {
                setMobileNavOpen(false);
                setConfirmLogoutOpen(true);
              }}
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
              Logout
            </button>
          </div>
        </aside>

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

        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          <NavList
            navStructure={navStructure}
            openGroups={openGroups}
            setOpenGroups={setOpenGroups}
            isChildActive={isChildActive}
            showLabels={sidebarOpen}
            onNavigate={() => isTablet && setSidebarOpen(false)}
            onCollapsedGroupClick={() => setSidebarOpen(true)}
          />
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
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--primary-dark)" }}>Fleet Management System</h1>
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
          {showAnnouncementBanner && <AnnouncementBanner message={flags.announcement.message} />}
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

// Announcement banner controlled from the super_admin Content Settings
// (CMS) page. Shown above the page content, per-role, whenever enabled.
function AnnouncementBanner({ message }: { message: string }) {
  return (
    <div
      className="fade-in"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        background: "#fffbeb",
        border: "1px solid #fbd38d",
        color: "#7b5b0a",
        borderRadius: "12px",
        padding: "12px 14px",
        marginBottom: "16px",
        fontSize: "13px",
        lineHeight: 1.5,
      }}
    >
      <Megaphone size={17} style={{ flexShrink: 0, marginTop: "1px" }} />
      <span style={{ whiteSpace: "pre-wrap" }}>{message}</span>
    </div>
  );
}

// Small pill/dot notification badge. `dot` renders a minimal dot (used over
// a collapsed icon where there's no room for a number); otherwise it renders
// the count, capped at "9+" so it never stretches the layout.
function Badge({ count, dot }: { count: number; dot?: boolean }) {
  if (!count) return null;
  if (dot) {
    return (
      <span
        style={{
          position: "absolute",
          top: 2,
          right: 2,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "var(--danger, #e53e3e)",
          border: "1.5px solid var(--primary-dark, #14532d)",
        }}
      />
    );
  }
  return (
    <span
      style={{
        flexShrink: 0,
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: "9px",
        background: "var(--danger, #e53e3e)",
        color: "#fff",
        fontSize: "10.5px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
      }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

type NavItem =
  | { type: "link"; to: string; icon: any; label: string; show: boolean; end?: boolean; badge?: number; disabled?: boolean }
  | {
      type: "group";
      label: string;
      icon: any;
      show: boolean;
      badge?: number;
      children: Array<{ to: string; icon: any; label: string; show: boolean; badge?: number; disabled?: boolean }>;
    };

// Renders the nav links/groups. Shared by the desktop sidebar (where
// showLabels toggles with the collapse button) and the mobile drawer (where
// showLabels is always true, and onNavigate closes the drawer after a tap).
function NavList({
  navStructure,
  openGroups,
  setOpenGroups,
  isChildActive,
  showLabels,
  onNavigate,
  onCollapsedGroupClick,
}: {
  navStructure: NavItem[];
  openGroups: Record<string, boolean>;
  setOpenGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isChildActive: (children: { to: string }[]) => boolean;
  showLabels: boolean;
  onNavigate: () => void;
  onCollapsedGroupClick?: () => void;
}) {
  return (
    <>
      {navStructure.map((item) => {
        if (!item.show) return null;

        if (item.type === "link") {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                marginBottom: "4px",
                background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                color: item.disabled ? "rgba(255,255,255,0.4)" : isActive ? "#fff" : "rgba(255,255,255,0.75)",
                fontWeight: isActive ? 600 : 400,
                fontSize: "14px",
                borderLeft: isActive ? "3px solid var(--secondary)" : "3px solid transparent",
                textDecoration: "none",
              })}
            >
              <span style={{ position: "relative", flexShrink: 0, display: "flex" }}>
                <item.icon size={18} />
                {!showLabels && <Badge count={item.badge || 0} dot />}
              </span>
              {showLabels && (
                <>
                  <span style={{ whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>
                  {item.disabled ? <Lock size={13} style={{ flexShrink: 0, opacity: 0.7 }} /> : <Badge count={item.badge || 0} />}
                </>
              )}
            </NavLink>
          );
        }

        // Group (dropdown)
        const visibleChildren = item.children.filter((c) => c.show);
        if (visibleChildren.length === 0) return null;
        const active = isChildActive(visibleChildren);
        const open = !!openGroups[item.label];

        return (
          <div key={item.label} style={{ marginBottom: "4px" }}>
            <button
              onClick={() => {
                // Sidebar is icon-only (collapsed) — expand it and open this
                // group in one click, instead of leaving the click a no-op
                // that silently toggles state nobody can see.
                if (!showLabels) {
                  onCollapsedGroupClick?.();
                  setOpenGroups((prev) => ({ ...prev, [item.label]: true }));
                  return;
                }
                setOpenGroups((prev) => ({ ...prev, [item.label]: !prev[item.label] }));
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                background: active ? "rgba(255,255,255,0.1)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.75)",
                fontWeight: active ? 600 : 400,
                fontSize: "14px",
                border: "none",
                borderLeft: active ? "3px solid var(--secondary)" : "3px solid transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ position: "relative", flexShrink: 0, display: "flex" }}>
                <item.icon size={18} />
                {!showLabels && <Badge count={item.badge || 0} dot />}
              </span>
              {showLabels && (
                <>
                  <span style={{ whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>
                  <Badge count={item.badge || 0} />
                  <ChevronDown
                    size={15}
                    style={{
                      flexShrink: 0,
                      transform: open ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </>
              )}
            </button>

            {showLabels && open && (
              <div
                style={{
                  marginTop: "2px",
                  marginLeft: "14px",
                  paddingLeft: "16px",
                  borderLeft: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {visibleChildren.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    onClick={onNavigate}
                    style={({ isActive }) => ({
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      marginTop: "2px",
                      background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                      color: child.disabled ? "rgba(255,255,255,0.4)" : isActive ? "#fff" : "rgba(255,255,255,0.7)",
                      fontWeight: isActive ? 600 : 400,
                      fontSize: "13px",
                      textDecoration: "none",
                    })}
                  >
                    <child.icon size={15} style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: "nowrap", flex: 1 }}>{child.label}</span>
                    {child.disabled ? <Lock size={12} style={{ flexShrink: 0, opacity: 0.7 }} /> : <Badge count={child.badge || 0} />}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
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
