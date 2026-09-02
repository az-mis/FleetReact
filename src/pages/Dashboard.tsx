import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import StatCard from "../components/StatCard";
import { Avatar } from "../components/Avatar";
import { Truck, Users, ShieldCheck, UserCircle, Sparkles, ClipboardList, Car } from "lucide-react";
import { USER_ROLE_LABEL, Vehicle } from "../types";

export default function Dashboard() {
  const { currentUser, profile, role, isAdmin, isSuperAdmin, isDriver } = useAuth();
  const { flags } = useFeatureFlags();
  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);

  // Driver-only: the vehicle currently permanently assigned to this driver
  // (Vehicle Assigning), shown as a card below — gated by the CMS toggle
  // "My Assigned Vehicle card".
  useEffect(() => {
    if (!isDriver || !currentUser || !flags.driverModules.showAssignedVehicle) {
      setAssignedVehicle(null);
      return;
    }
    const q = query(collection(db, "vehicles"), where("assignedDriverId", "==", currentUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => setAssignedVehicle(snap.empty ? null : ({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) } as Vehicle)),
      () => setAssignedVehicle(null)
    );
    return unsub;
  }, [isDriver, currentUser, flags.driverModules.showAssignedVehicle]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(
      query(collection(db, "users"), where("role", "in", ["admin"])),
      (snap) => setAdminCount(snap.size),
    );
    return unsub;
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      query(collection(db, "users"), where("role", "==", "driver")),
      (snap) => setDriverCount(snap.size),
    );
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "vehicles"), (snap) =>
      setVehicleCount(snap.size),
    );
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "vehicleRequests"), (snap) =>
      setRequestCount(snap.size),
    );
    return unsub;
  }, [isAdmin]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-in">
      {/* Hero banner */}
      <div
        style={{
          position: "relative",
          borderRadius: "20px",
          padding: "28px 32px",
          marginBottom: "24px",
          background:
            "linear-gradient(120deg, var(--primary-dark) 0%, var(--primary) 55%, var(--primary-light) 100%)",
          boxShadow: "0 14px 30px -12px rgba(19,77,43,0.45)",
          overflow: "hidden",
        }}
      >
        {/* decorative pattern */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-60px",
            right: "-40px",
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "-70px",
            right: "80px",
            width: "160px",
            height: "160px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "10px",
            right: "220px",
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            background: "rgba(246,166,35,0.18)",
          }}
        />

        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255,255,255,0.14)",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "999px",
              marginBottom: "12px",
              letterSpacing: "0.02em",
            }}
          >
            <Sparkles size={12} />
            {timeGreeting}
          </div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "#fff",
              marginBottom: "6px",
              letterSpacing: "-0.01em",
            }}
          >
            Welcome{profile?.name ? `, ${profile.name}` : ""}
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.85)",
              marginBottom: "2px",
            }}
          >
            Signed in as{" "}
            <b style={{ color: "#fff" }}>{role ? USER_ROLE_LABEL[role] : "—"}</b>
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)" }}>
            {today}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#2d3748",
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Overview
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}
          >
            {isSuperAdmin && (
              <StatCard
                icon={ShieldCheck}
                label="Admin Accounts"
                value={adminCount}
                color="var(--secondary)"
              />
            )}
            <StatCard
              icon={Users}
              label="Drivers"
              value={driverCount}
              color="var(--info)"
            />
            <StatCard
              icon={Truck}
              label="Registered Vehicles"
              value={vehicleCount}
              color="var(--primary)"
            />
            <StatCard
              icon={ClipboardList}
              label="Total Requests"
              value={requestCount}
              color="#4a5568"
            />
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              background: "linear-gradient(180deg, #ffffff, #fafcfb)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "26px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
                boxShadow: "0 6px 14px -4px rgba(26,107,60,0.5)",
              }}
            >
              <UserCircle size={30} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#1a202c" }}>
                {profile?.name}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Driver accounts don't have access to vehicle or admin management.
                Contact an admin for any changes to your profile.
              </div>
            </div>
          </div>

          {flags.driverModules.showAssignedVehicle && assignedVehicle && (
            <div
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              }}
            >
              <Avatar
                photoURL={assignedVehicle.photoURL}
                fallback="icon"
                icon={Car}
                size={46}
                name={assignedVehicle.plateNumber}
              />
              <div>
                <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  My Assigned Vehicle
                </div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "#1a202c", marginTop: "2px" }}>
                  {assignedVehicle.brand} {assignedVehicle.model} — {assignedVehicle.plateNumber}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {assignedVehicle.color} · {assignedVehicle.year}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
