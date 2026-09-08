import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { VehicleRequest } from "../types";
import { formatTravelDateRange } from "../utils/travelDate";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import HeaderSearchInput from "../components/HeaderSearchInput";
import Modal from "../components/Modal";
import {
  History,
  Navigation,
  CheckCircle2,
  CalendarDays,
  MapPin,
  Truck,
  User,
  Building2,
  Phone,
  FileText,
  Users,
  Printer,
  ChevronRight,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";

export default function TravelHistory() {
  const { currentUser, isDriver } = useAuth();
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "completed" | "upcoming">("upcoming");
  const [selectedTrip, setSelectedTrip] = useState<VehicleRequest | null>(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Fetch trips assigned to this driver
  useEffect(() => {
    if (!currentUser || !isDriver) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const qConfirmed = query(
      collection(db, "vehicleRequests"),
      where("confirmedDriverId", "==", currentUser.uid)
    );

    const unsubConfirmed = onSnapshot(
      qConfirmed,
      (snapConfirmed) => {
        const confirmedList = snapConfirmed.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) } as VehicleRequest)
        );

        const qDefault = query(
          collection(db, "vehicleRequests"),
          where("defaultDriverId", "==", currentUser.uid)
        );

        onSnapshot(
          qDefault,
          (snapDefault) => {
            const defaultList = snapDefault.docs.map(
              (d) => ({ id: d.id, ...(d.data() as any) } as VehicleRequest)
            );

            const map = new Map<string, VehicleRequest>();
            confirmedList.forEach((r) => map.set(r.id, r));
            defaultList.forEach((r) => {
              if (!r.confirmedDriverId || r.confirmedDriverId === currentUser.uid) {
                map.set(r.id, r);
              }
            });

            const combined = Array.from(map.values()).sort((a, b) =>
              (b.travelDate || "").localeCompare(a.travelDate || "")
            );
            setRequests(combined);
            setLoading(false);
          },
          (err) => {
            console.error("Error fetching default driver requests:", err);
            setRequests(confirmedList);
            setLoading(false);
          }
        );
      },
      (err) => {
        console.error("Error fetching confirmed driver requests:", err);
        setLoading(false);
      }
    );

    return unsubConfirmed;
  }, [currentUser, isDriver]);

  // Derived statistics
  const approvedTrips = useMemo(() => requests.filter((r) => r.status === "approved"), [requests]);

  const completedTrips = useMemo(() => {
    return approvedTrips.filter((r) => {
      const end = r.travelDateEnd || r.travelDate;
      return end < todayStr;
    });
  }, [approvedTrips, todayStr]);

  const upcomingTrips = useMemo(() => {
    return approvedTrips.filter((r) => {
      const end = r.travelDateEnd || r.travelDate;
      return r.travelDate > todayStr || end >= todayStr;
    });
  }, [approvedTrips, todayStr]);

  // Filtered trips list
  const filteredTrips = useMemo(() => {
    let list = approvedTrips;
    if (filterTab === "completed") {
      list = completedTrips;
    } else if (filterTab === "upcoming") {
      list = upcomingTrips;
    }

    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((r) => {
        const passList = [
          ...(r.requesterIsPassenger ? [r.requesterName] : []),
          ...(r.passengers || []),
        ];
        return [
          r.destination,
          r.requesterName,
          r.requesterOffice,
          r.vehiclePlateNumber,
          r.purpose,
          ...passList,
        ].some((f) => (f || "").toLowerCase().includes(s));
      });
    }

    return list;
  }, [approvedTrips, completedTrips, upcomingTrips, filterTab, search]);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <PageHeader
        icon={History}
        title="History of Travel"
        subtitle="Complete record and details of all your assigned and completed dispatch travels."
      />

      {/* Stats Overview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <StatCard
          icon={CalendarDays}
          label="Upcoming / Active"
          value={upcomingTrips.length}
          color="var(--info)"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed Travels"
          value={completedTrips.length}
          color="var(--success)"
        />
        <StatCard
          icon={Navigation}
          label="Total Travel Dispatches"
          value={approvedTrips.length}
          color="var(--primary)"
        />
      </div>

      {/* Main Table Card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Controls: Tabs & Search */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Tab Filter Pills */}
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "10px",
              gap: "2px",
            }}
          >
            <button
              onClick={() => setFilterTab("upcoming")}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                background: filterTab === "upcoming" ? "#fff" : "transparent",
                color: filterTab === "upcoming" ? "var(--primary-dark)" : "var(--text-muted)",
                fontWeight: filterTab === "upcoming" ? 700 : 500,
                fontSize: "12.5px",
                cursor: "pointer",
                boxShadow: filterTab === "upcoming" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Upcoming / Active ({upcomingTrips.length})
            </button>
            <button
              onClick={() => setFilterTab("completed")}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                background: filterTab === "completed" ? "#fff" : "transparent",
                color: filterTab === "completed" ? "var(--primary-dark)" : "var(--text-muted)",
                fontWeight: filterTab === "completed" ? 700 : 500,
                fontSize: "12.5px",
                cursor: "pointer",
                boxShadow: filterTab === "completed" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Completed ({completedTrips.length})
            </button>
            <button
              onClick={() => setFilterTab("all")}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                background: filterTab === "all" ? "#fff" : "transparent",
                color: filterTab === "all" ? "var(--primary-dark)" : "var(--text-muted)",
                fontWeight: filterTab === "all" ? 700 : 500,
                fontSize: "12.5px",
                cursor: "pointer",
                boxShadow: filterTab === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              All Travels ({approvedTrips.length})
            </button>
          </div>

          {/* Search Input */}
          <div style={{ width: "260px" }}>
            <HeaderSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search destination, passenger, vehicle..."
            />
          </div>
        </div>

        {/* Trips Table */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc", color: "var(--text-muted)", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, borderRadius: "8px 0 0 8px" }}>
                  Destination &amp; Purpose
                </th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                  Travel Date
                </th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                  Vehicle
                </th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                  Passengers
                </th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                  Status
                </th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, textAlign: "right", borderRadius: "0 8px 8px 0" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                    Loading your travel records...
                  </td>
                </tr>
              ) : filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <Navigation size={28} style={{ opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#4a5568" }}>
                        {search ? "No matching travel records found" : "No travels in this category yet"}
                      </div>
                      <div style={{ fontSize: "12px" }}>
                        {search ? "Try clearing your search query." : "When trips are assigned to you, they will appear here."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => {
                  const isEndPast = (trip.travelDateEnd || trip.travelDate) < todayStr;
                  const isCurrentActive = trip.travelDate <= todayStr && (trip.travelDateEnd || trip.travelDate) >= todayStr;

                  const passengersList = [
                    ...(trip.requesterIsPassenger ? [`${trip.requesterName} (Requester)`] : []),
                    ...(trip.passengers || []),
                  ];

                  return (
                    <tr
                      key={trip.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ fontWeight: 700, color: "#1a202c", fontSize: "13.5px" }}>
                          📍 {trip.destination}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {trip.purpose || "No specific purpose provided"}
                        </div>
                        {trip.requesterOffice && (
                          <div style={{ fontSize: "11px", color: "#718096", marginTop: "1px" }}>
                            Office: {trip.requesterOffice}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: "#2d3748" }}>
                          {formatTravelDateRange(trip.travelDate, trip.travelDateEnd)}
                        </div>
                        {isCurrentActive && (
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: "3px",
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#2563eb",
                              background: "#dbeafe",
                              padding: "1px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            Active Today
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Truck size={14} color="var(--primary)" />
                          <span style={{ fontWeight: 700, color: "#2d3748" }}>{trip.vehiclePlateNumber}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        <PassengersSummary passengers={passengersList} />
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        {isEndPast ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "#f1f5f9",
                              color: "#475569",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <CheckCircle2 size={12} /> Completed
                          </span>
                        ) : isCurrentActive ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "#dcfce7",
                              color: "#166534",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Sparkles size={12} /> Ongoing
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "#e0f2fe",
                              color: "#0369a1",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Clock size={12} /> Scheduled
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            onClick={() => setSelectedTrip(trip)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid var(--border)",
                              background: "#fff",
                              color: "#2d3748",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Info size={13} /> View Details
                          </button>
                          <Link
                            to={`/trip-ticket/${trip.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "none",
                              background: "rgba(26,107,60,0.1)",
                              color: "var(--primary)",
                              fontSize: "12px",
                              fontWeight: 600,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Printer size={13} /> Ticket
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trip Details Modal */}
      {selectedTrip && (
        <TripDetailModal trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
      )}
    </div>
  );
}

function PassengersSummary({ passengers }: { passengers: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!passengers || passengers.length === 0) {
    return <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>;
  }

  if (passengers.length === 1) {
    return <span style={{ fontSize: "12.5px", color: "#2d3748", fontWeight: 500 }}>{passengers[0]}</span>;
  }

  const first = passengers[0];
  const rest = passengers.slice(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px" }}>
      <span style={{ fontSize: "12.5px", color: "#2d3748", fontWeight: 500 }}>{first}</span>
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
          {rest.map((p, idx) => (
            <span key={idx} style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              • {p}
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          border: "none",
          background: "transparent",
          color: "var(--primary)",
          fontSize: "11px",
          fontWeight: 700,
          cursor: "pointer",
          padding: 0,
          textDecoration: "underline",
        }}
      >
        {expanded ? "Show less" : `+${rest.length} more`}
      </button>
    </div>
  );
}

function TripDetailModal({ trip, onClose }: { trip: VehicleRequest; onClose: () => void }) {
  return (
    <Modal title="Travel Dispatch Details" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div
          style={{
            padding: "12px 14px",
            background: "#f0fdf4",
            borderRadius: "10px",
            border: "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
              Destination
            </div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#166534" }}>
              📍 {trip.destination}
            </div>
          </div>
          <Link
            to={`/trip-ticket/${trip.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              background: "var(--primary)",
              color: "#fff",
              fontSize: "12.5px",
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Printer size={14} /> Printable Ticket
          </Link>
        </div>

        <DetailRow icon={CalendarDays} label="Date Range" value={formatTravelDateRange(trip.travelDate, trip.travelDateEnd)} />
        <DetailRow icon={Truck} label="Assigned Vehicle" value={trip.vehiclePlateNumber} />
        <DetailRow icon={User} label="Requester" value={`${trip.requesterName}${trip.requesterOffice ? ` (${trip.requesterOffice})` : ""}`} />
        {trip.requesterContact && <DetailRow icon={Phone} label="Contact" value={trip.requesterContact} />}
        {trip.location && <DetailRow icon={MapPin} label="Pick-up Location" value={trip.location} />}
        <DetailRow icon={FileText} label="Trip Purpose" value={trip.purpose || "—"} />

        {/* Passengers list */}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "6px",
              background: "#f7fafc",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Users size={13} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
              Authorized Passengers
            </div>
            <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "3px" }}>
              {trip.requesterIsPassenger && (
                <div style={{ fontSize: "12.5px", color: "#2d3748", fontWeight: 600 }}>
                  • {trip.requesterName} (Requester)
                </div>
              )}
              {trip.passengers && trip.passengers.length > 0 ? (
                trip.passengers.map((p, idx) => (
                  <div key={idx} style={{ fontSize: "12.5px", color: "#2d3748" }}>
                    • {p}
                  </div>
                ))
              ) : !trip.requesterIsPassenger ? (
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>None listed</span>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "#fff",
              color: "#2d3748",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "6px",
          background: "#f7fafc",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={13} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: "13px", color: "#2d3748", wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}
