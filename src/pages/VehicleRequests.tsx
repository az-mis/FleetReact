import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { AppUser, Vehicle, VehicleRequest, VehicleRequestStatus } from "../types";
import { formatTravelDateRange, dateRangesOverlap } from "../utils/travelDate";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Modal from "../components/Modal";
import HeaderSearchInput from "../components/HeaderSearchInput";
import {
  ClipboardList,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  MapPin,
  CalendarDays,
  FileText,
  Phone,
  Building2,
  Users,
  AlertTriangle,
} from "lucide-react";

const STATUS_COLOR: Record<VehicleRequestStatus, string> = {
  pending: "var(--warning)",
  approved: "var(--primary)",
  declined: "var(--danger)",
};

export default function VehicleRequests() {
  const { profile, currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleRequestStatus | "all">("pending");
  const [reviewing, setReviewing] = useState<VehicleRequest | null>(null);

  useEffect(() => {
    const q = query(collection(db, "vehicleRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleRequest, "id">) })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) }));
      setDrivers(all.filter((u) => u.role === "driver"));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "vehicles"), orderBy("plateNumber"));
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })));
    });
    return unsub;
  }, []);

  const counts = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      declined: requests.filter((r) => r.status === "declined").length,
    }),
    [requests]
  );

  const filtered = useMemo(() => {
    let list = requests;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((r) =>
        [r.requesterName, r.vehiclePlateNumber, r.destination, r.defaultDriverName].some((f) =>
          (f || "").toLowerCase().includes(s)
        )
      );
    }
    return list;
  }, [requests, statusFilter, search]);

  // Drivers already committed to an *approved* request whose date range
  // overlaps this one are flagged as busy — a basic conflict check for
  // substitution. Uses range overlap (not exact-date match) so multi-day
  // trips are caught too.
  function busyDriverIds(travelDate: string, travelDateEnd: string | null | undefined, excludeRequestId: string) {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.id === excludeRequestId) return;
      if (r.status !== "approved") return;
      if (!dateRangesOverlap(travelDate, travelDateEnd, r.travelDate, r.travelDateEnd)) return;
      if (r.confirmedDriverId) set.add(r.confirmedDriverId);
    });
    return set;
  }

  async function handleDecline(request: VehicleRequest, reason: string) {
    try {
      await updateDoc(doc(db, "vehicleRequests", request.id), {
        status: "declined",
        declineReason: reason || null,
        approvedBy: currentUser?.uid || null,
        approvedByName: profile?.name || null,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showSuccess(`Request from ${request.requesterName} declined.`);
      setReviewing(null);
    } catch (err: any) {
      showError(err.message || "Couldn't decline this request.");
    }
  }

  async function handleApprove(request: VehicleRequest, driverId: string, driverName: string) {
    try {
      await updateDoc(doc(db, "vehicleRequests", request.id), {
        status: "approved",
        confirmedDriverId: driverId || null,
        confirmedDriverName: driverName || null,
        approvedBy: currentUser?.uid || null,
        approvedByName: profile?.name || null,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showSuccess(`Request from ${request.requesterName} approved.`);
      setReviewing(null);
    } catch (err: any) {
      showError(err.message || "Couldn't approve this request.");
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={ClipboardList}
        title="Vehicle Requests"
        subtitle="Review and confirm staff requests submitted via QR code."
        actions={
          <div className="header-search-wrap">
            <HeaderSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search requester, plate, destination..."
            />
          </div>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <StatCard icon={ClipboardList} label="Total Requests" value={counts.total} color="#4a5568" />
        <StatCard icon={Clock} label="Pending" value={counts.pending} color="var(--warning)" />
        <StatCard icon={CheckCircle2} label="Approved" value={counts.approved} color="var(--primary)" />
        <StatCard icon={XCircle} label="Declined" value={counts.declined} color="var(--danger)" />
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(["pending", "approved", "declined", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              background: statusFilter === s ? "var(--primary)" : "#fff",
              color: statusFilter === s ? "#fff" : "#2d3748",
              fontSize: "12.5px",
              fontWeight: 600,
              textTransform: "capitalize",
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            padding: "40px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <ClipboardList size={22} style={{ marginBottom: 6 }} />
          <div>No requests found.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((r) => (
            <RequestRow key={r.id} request={r} onReview={() => setReviewing(r)} />
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewModal
          request={reviewing}
          drivers={drivers}
          busyDriverIds={busyDriverIds(reviewing.travelDate, reviewing.travelDateEnd, reviewing.id)}
          onClose={() => setReviewing(null)}
          onApprove={handleApprove}
          onDecline={handleDecline}
        />
      )}
    </div>
  );
}

function RequestRow({ request, onReview }: { request: VehicleRequest; onReview: () => void }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "10px",
          background: "var(--accent)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Truck size={18} />
      </div>

      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: "14px" }}>{request.requesterName}</span>
          <span
            style={{
              fontSize: "10.5px",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "999px",
              background: STATUS_COLOR[request.status] + "1a",
              color: STATUS_COLOR[request.status],
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {request.status}
          </span>
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>
          {request.vehiclePlateNumber} · {request.destination} · {formatTravelDateRange(request.travelDate, request.travelDateEnd)}
        </div>
      </div>

      <div style={{ fontSize: "12.5px", color: "var(--text-muted)", flex: "1 1 160px" }}>
        Driver:{" "}
        <b style={{ color: "#2d3748" }}>
          {request.status === "approved"
            ? request.confirmedDriverName || "Unassigned"
            : request.defaultDriverName || "Not yet assigned"}
        </b>
      </div>

      <button
        onClick={onReview}
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: request.status === "pending" ? "var(--primary)" : "#fff",
          color: request.status === "pending" ? "#fff" : "#2d3748",
          fontSize: "12.5px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {request.status === "pending" ? "Review" : "View"}
      </button>
    </div>
  );
}

function ReviewModal({
  request,
  drivers,
  busyDriverIds,
  onClose,
  onApprove,
  onDecline,
}: {
  request: VehicleRequest;
  drivers: AppUser[];
  busyDriverIds: Set<string>;
  onClose: () => void;
  onApprove: (request: VehicleRequest, driverId: string, driverName: string) => Promise<void>;
  onDecline: (request: VehicleRequest, reason: string) => Promise<void>;
}) {
  const [driverAvailable, setDriverAvailable] = useState<boolean | null>(
    request.status !== "pending" ? true : null
  );
  const [substituteId, setSubstituteId] = useState("");
  const [declineReason, setDeclineReason] = useState(request.declineReason || "");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const isPending = request.status === "pending";

  async function submitApprove() {
    setSaving(true);
    try {
      if (driverAvailable) {
        await onApprove(request, request.defaultDriverId || "", request.defaultDriverName || "");
      } else {
        const sub = drivers.find((d) => d.id === substituteId);
        if (!sub) return;
        await onApprove(request, sub.id, sub.name);
      }
    } finally {
      setSaving(false);
    }
  }

  async function submitDecline() {
    setSaving(true);
    try {
      await onDecline(request, declineReason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isPending ? "Review Request" : "Request Details"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <InfoRow icon={User} label="Requester" value={request.requesterName} />
        {request.requesterOffice && <InfoRow icon={Building2} label="Office" value={request.requesterOffice} />}
        {request.requesterContact && <InfoRow icon={Phone} label="Contact" value={request.requesterContact} />}
        <InfoRow icon={Truck} label="Vehicle" value={request.vehiclePlateNumber} />
        <InfoRow icon={MapPin} label="Destination" value={request.destination} />
        <InfoRow icon={CalendarDays} label="Travel Date" value={formatTravelDateRange(request.travelDate, request.travelDateEnd)} />
        <InfoRow icon={FileText} label="Purpose" value={request.purpose} />
        {request.passengers && <InfoRow icon={Users} label="Passengers" value={request.passengers} />}

        {!isPending && (
          <div
            style={{
              background: request.status === "approved" ? "#e6f7ee" : "#fff5f5",
              color: request.status === "approved" ? "var(--primary)" : "var(--danger)",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "12.5px",
              fontWeight: 600,
            }}
          >
            {request.status === "approved"
              ? `Approved · Driver: ${request.confirmedDriverName || "Unassigned"}`
              : `Declined${request.declineReason ? ` · ${request.declineReason}` : ""}`}
          </div>
        )}

        {isPending && !showDeclineForm && (
          <>
            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#2d3748" }}>
                Is {request.defaultDriverName || "the assigned driver"} available for this trip?
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setDriverAvailable(true)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: driverAvailable === true ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: driverAvailable === true ? "#e6f7ee" : "#fff",
                    color: driverAvailable === true ? "var(--primary)" : "#2d3748",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  Yes, available
                </button>
                <button
                  type="button"
                  onClick={() => setDriverAvailable(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: driverAvailable === false ? "2px solid var(--warning)" : "1px solid var(--border)",
                    background: driverAvailable === false ? "#fff8e6" : "#fff",
                    color: driverAvailable === false ? "var(--warning)" : "#2d3748",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  Not available
                </button>
              </div>

              {driverAvailable === false && (
                <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                    Choose a substitute driver
                  </span>
                  <select
                    value={substituteId}
                    onChange={(e) => setSubstituteId(e.target.value)}
                    style={{ padding: "9px 11px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "13.5px" }}
                  >
                    <option value="">— Select a driver —</option>
                    {drivers
                      .filter((d) => d.id !== request.defaultDriverId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {busyDriverIds.has(d.id) ? "(busy that day)" : ""}
                        </option>
                      ))}
                  </select>
                  {substituteId && busyDriverIds.has(substituteId) && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "6px",
                        fontSize: "12px",
                        color: "var(--warning)",
                        background: "#fff8e6",
                        padding: "8px 10px",
                        borderRadius: "8px",
                      }}
                    >
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      This driver is already confirmed on another approved request for the same
                      date. You can still proceed, but double check for a scheduling conflict.
                    </div>
                  )}
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setShowDeclineForm(true)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "var(--danger)",
                  fontWeight: 600,
                  fontSize: "13.5px",
                }}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={submitApprove}
                disabled={
                  saving ||
                  driverAvailable === null ||
                  (driverAvailable === false && !substituteId)
                }
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--primary)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  opacity: driverAvailable === null || (driverAvailable === false && !substituteId) ? 0.6 : 1,
                }}
              >
                {saving ? "Approving..." : "Approve Request"}
              </button>
            </div>
          </>
        )}

        {isPending && showDeclineForm && (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Reason (optional)
              </span>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                style={{
                  padding: "9px 11px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "13.5px",
                  minHeight: "70px",
                  resize: "vertical",
                }}
                placeholder="e.g. Vehicle already booked that day"
              />
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowDeclineForm(false)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "#2d3748",
                  fontWeight: 600,
                  fontSize: "13.5px",
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitDecline}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "13.5px",
                }}
              >
                {saving ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "8px",
          background: "#f7fafc",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: "13.5px", color: "#2d3748", wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}
