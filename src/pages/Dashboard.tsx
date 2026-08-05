import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import StatCard from "../components/StatCard";
import { Truck, Users, ShieldCheck, UserCircle } from "lucide-react";
import { USER_ROLE_LABEL } from "../types";

export default function Dashboard() {
  const { profile, role, isAdmin, isSuperAdmin } = useAuth();
  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "vehicles"), (snap) => setVehicleCount(snap.size));
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(query(collection(db, "users"), where("role", "==", "driver")), (snap) =>
      setDriverCount(snap.size)
    );
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(
      query(collection(db, "users"), where("role", "in", ["admin", "super_admin"])),
      (snap) => setAdminCount(snap.size)
    );
    return unsub;
  }, [isSuperAdmin]);

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>
        Welcome{profile?.name ? `, ${profile.name}` : ""}
      </h2>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
        Signed in as {role ? USER_ROLE_LABEL[role] : "—"}.
      </p>

      {isAdmin ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          <StatCard icon={Truck} label="Registered Vehicles" value={vehicleCount} color="var(--primary)" />
          <StatCard icon={Users} label="Drivers" value={driverCount} color="var(--info)" />
          {isSuperAdmin && (
            <StatCard icon={ShieldCheck} label="Admin Accounts" value={adminCount} color="var(--secondary)" />
          )}
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "24px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <UserCircle size={32} color="var(--primary)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px" }}>{profile?.name}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Driver accounts don't have access to vehicle or admin management. Contact an admin for any changes to
              your profile.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
