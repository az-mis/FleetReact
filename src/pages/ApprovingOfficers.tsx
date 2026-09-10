import React, { useEffect, useMemo, useState, FormEvent } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { ApprovingOfficer } from "../types";
import PageHeader from "../components/PageHeader";
import HeaderSearchInput from "../components/HeaderSearchInput";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  UserCheck,
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  FileSignature,
  Users,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export const OFFICE_LOCATIONS = [
  "Oriental Mindoro",
  "Occidental Mindoro",
  "Marinduque",
  "Palawan",
  "Romblon",
  "Quezon City Satellite Office",
  "Regional Office (Default)",
];

const DEFAULT_APPROVING_OFFICERS: Omit<ApprovingOfficer, "id">[] = [
  {
    location: "Regional Office (Default)",
    signee1Name: "ARJAY D. BURGOS",
    signee1Title: "OIC - APCO-Oriental Mindoro",
    signee2Name: "EDGARDO F. LEIDO, Jr.",
    signee2Title: "GSS Regional Office Calapan City",
  },
  {
    location: "Quezon City Satellite Office",
    signee1Name: "Alvin Zoleta",
    signee1Title: "Information System Analyst I",
    signee2Name: "LLoyd Ramirez",
    signee2Title: "Computer Programmer",
  },
  {
    location: "Oriental Mindoro",
    signee1Name: "ARJAY D. BURGOS",
    signee1Title: "OIC - APCO-Oriental Mindoro",
    signee2Name: "EDGARDO F. LEIDO, Jr.",
    signee2Title: "GSS Regional Office Calapan City",
  },
  {
    location: "Occidental Mindoro",
    signee1Name: "ARJAY D. BURGOS",
    signee1Title: "OIC - APCO-Occidental Mindoro",
    signee2Name: "EDGARDO F. LEIDO, Jr.",
    signee2Title: "GSS Regional Office Calapan City",
  },
  {
    location: "Marinduque",
    signee1Name: "ARJAY D. BURGOS",
    signee1Title: "OIC - APCO-Marinduque",
    signee2Name: "EDGARDO F. LEIDO, Jr.",
    signee2Title: "GSS Regional Office Calapan City",
  },
  {
    location: "Palawan",
    signee1Name: "ARJAY D. BURGOS",
    signee1Title: "OIC - APCO-Palawan",
    signee2Name: "EDGARDO F. LEIDO, Jr.",
    signee2Title: "GSS Regional Office Calapan City",
  },
  {
    location: "Romblon",
    signee1Name: "ARJAY D. BURGOS",
    signee1Title: "OIC - APCO-Romblon",
    signee2Name: "EDGARDO F. LEIDO, Jr.",
    signee2Title: "GSS Regional Office Calapan City",
  },
];

const emptyForm = {
  location: "",
  signee1Name: "",
  signee1Title: "",
  signee2Name: "",
  signee2Title: "",
};

export default function ApprovingOfficers() {
  const { profile, isSuperAdmin, isAdmin } = useAuth();
  const { showSuccess, showError } = useToast();
  const [officers, setOfficers] = useState<ApprovingOfficer[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovingOfficer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApprovingOfficer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Regular admins (non-super) are restricted to their own assigned location
  const adminLocation = !isSuperAdmin ? (profile?.location || "") : "";

  useEffect(() => {
    const q = query(collection(db, "approvingOfficers"), orderBy("location", "asc"));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) {
          // Auto-seed defaults if collection is completely empty
          try {
            for (const def of DEFAULT_APPROVING_OFFICERS) {
              const docId = def.location.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              await setDoc(doc(db, "approvingOfficers", docId), {
                ...def,
                updatedAt: serverTimestamp(),
                updatedByName: "System Default",
              });
            }
          } catch (e) {
            console.error("Auto-seed approving officers error:", e);
          }
          return;
        }
        setOfficers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApprovingOfficer, "id">) })));
      },
      (err) => console.error("Error loading approving officers:", err)
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    // Regular admin: only show their own assigned location
    let list = officers;
    if (!isSuperAdmin) {
      list = adminLocation
        ? officers.filter((o) => o.location === adminLocation)
        : [];
    }

    // Super admin: apply text search across all locations
    if (isSuperAdmin) {
      const s = search.trim().toLowerCase();
      if (s) {
        list = list.filter((o) =>
          [o.location, o.signee1Name, o.signee1Title, o.signee2Name, o.signee2Title].some((f) =>
            (f || "").toLowerCase().includes(s)
          )
        );
      }
    }

    return list;
  }, [officers, search, isSuperAdmin, adminLocation]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(o: ApprovingOfficer) {
    setEditing(o);
    setForm({
      location: o.location,
      signee1Name: o.signee1Name || "",
      signee1Title: o.signee1Title || "",
      signee2Name: o.signee2Name || "",
      signee2Title: o.signee2Title || "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.location) {
      showError("Please select or enter a Location / Office Province.");
      return;
    }
    setConfirmSaveOpen(true);
  }

  async function executeSave() {
    setConfirmSaveOpen(false);
    setSaving(true);
    try {
      const docId = editing ? editing.id : form.location.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await setDoc(
        doc(db, "approvingOfficers", docId),
        {
          location: form.location,
          signee1Name: form.signee1Name || "",
          signee1Title: form.signee1Title || "",
          signee2Name: form.signee2Name || "",
          signee2Title: form.signee2Title || "",
          updatedAt: serverTimestamp(),
          updatedByName: profile?.name || "Administrator",
        },
        { merge: true }
      );
      showSuccess(`Approving officers for ${form.location} updated.`);
      closeModal();
    } catch (err: any) {
      showError(err.message || "Failed to save approving officers.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "approvingOfficers", deleteTarget.id));
      showSuccess(`Approving officers for ${deleteTarget.location} removed.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showError(err.message || "Failed to delete approving officers.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        icon={UserCheck}
        title="Approving Officers"
        subtitle={
          isSuperAdmin
            ? "Manage the official signatories (Approved By) printed on Driver's Trip Tickets for each Office Location."
            : `Manage the official signatories for your office: ${adminLocation || "—"}`
        }
        actions={
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {isSuperAdmin ? (
              <>
                <HeaderSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search location or officer..."
                />
                <button
                  type="button"
                  onClick={openCreate}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "38px",
                    padding: "0 16px",
                    borderRadius: "9px",
                    border: "none",
                    background: "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0, 179, 119, 0.28)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Plus size={16} />
                  <span>Add Office</span>
                </button>
              </>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                <MapPin size={14} />
                {adminLocation || "No location assigned"}
              </div>
            )}
          </div>
        }
      />

      {/* Info notice for regular admins */}
      {!isSuperAdmin && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "10px",
            padding: "12px 16px",
            fontSize: "13px",
            color: "#1e40af",
            marginBottom: "4px",
          }}
        >
          <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>
            You can only view and edit the Approving Officers for your assigned office:{" "}
            <strong>{adminLocation || "None"}</strong>. Contact the Super Admin to update other locations.
          </span>
        </div>
      )}

      {/* Empty state when regular admin has no assigned location */}
      {!isSuperAdmin && !adminLocation && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-muted)",
            fontSize: "14px",
          }}
        >
          <MapPin size={40} style={{ marginBottom: "12px", opacity: 0.35 }} />
          <div style={{ fontWeight: 600 }}>No office location assigned to your account.</div>
          <div style={{ marginTop: "4px", fontSize: "13px" }}>
            Ask your Super Admin to assign a location to your profile.
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: "16px",
        }}
      >
        {filtered.map((o) => (
          <div
            key={o.id}
            style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    background: "rgba(0, 179, 119, 0.12)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "14px",
                      color: "#1a202c",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {o.location}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Trip Ticket Signatories
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => openEdit(o)}
                  className="admin-icon-btn"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--info)",
                    padding: "6px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                  title="Edit Approving Officers"
                >
                  <Pencil size={15} />
                </button>
                {isSuperAdmin && o.location !== "Regional Office (Default)" && (
                  <button
                    onClick={() => setDeleteTarget(o)}
                    className="admin-icon-btn"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--danger)",
                      padding: "6px",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    title="Delete Office Configuration"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Body: Signatory 1 & 2 */}
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
              {/* Signatory 1 */}
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "#166534",
                    letterSpacing: "0.03em",
                    marginBottom: "3px",
                  }}
                >
                  Signatory 1 (Approved By)
                </div>
                <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#1a202c" }}>
                  {o.signee1Name || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Not set</span>}
                </div>
                <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "1px" }}>
                  {o.signee1Title || "—"}
                </div>
              </div>

              {/* Signatory 2 */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "#4a5568",
                    letterSpacing: "0.03em",
                    marginBottom: "3px",
                  }}
                >
                  Signatory 2 (Approved By)
                </div>
                <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#1a202c" }}>
                  {o.signee2Name || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Not set</span>}
                </div>
                <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "1px" }}>
                  {o.signee2Title || "—"}
                </div>
              </div>

              {o.updatedByName && (
                <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right", marginTop: "auto" }}>
                  Updated by: <strong>{o.updatedByName}</strong>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {modalOpen && (
        <Modal title={editing ? `Edit Approving Officers — ${editing.location}` : "Add Approving Officers"} onClose={closeModal}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#4a5568", display: "block", marginBottom: "4px" }}>
                Location / Office Province <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              {editing ? (
                <input
                  disabled
                  value={form.location}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "#edf2f7",
                    color: "#4a5568",
                    fontSize: "13px",
                    cursor: "not-allowed",
                  }}
                />
              ) : (
                <select
                  required
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                  }}
                >
                  <option value="">— Select Office Location —</option>
                  {OFFICE_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Signatory 1 Section */}
            <div
              style={{
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                borderRadius: "9px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#166534" }}>
                Signatory 1 (First Approving Officer)
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                  Full Name
                </label>
                <input
                  value={form.signee1Name}
                  onChange={(e) => setForm({ ...form, signee1Name: e.target.value })}
                  placeholder="Name"
                  style={{
                    width: "100%",
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    background: "#fff",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                  Official Title / Office Designation
                </label>
                <input
                  value={form.signee1Title}
                  onChange={(e) => setForm({ ...form, signee1Title: e.target.value })}
                  placeholder="Designation"
                  style={{
                    width: "100%",
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    background: "#fff",
                  }}
                />
              </div>
            </div>

            {/* Signatory 2 Section */}
            <div
              style={{
                border: "1px solid var(--border)",
                background: "#f8fafc",
                borderRadius: "9px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#1f2937" }}>
                Signatory 2 (Second Approving Officer)
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                  Full Name
                </label>
                <input
                  value={form.signee2Name}
                  onChange={(e) => setForm({ ...form, signee2Name: e.target.value })}
                  placeholder="Name"
                  style={{
                    width: "100%",
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    background: "#fff",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "4px" }}>
                  Official Title / Office Designation
                </label>
                <input
                  value={form.signee2Title}
                  onChange={(e) => setForm({ ...form, signee2Title: e.target.value })}
                  placeholder="Designation"
                  style={{
                    width: "100%",
                    padding: "8px 11px",
                    borderRadius: "7px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    background: "#fff",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: "6px",
                height: "38px",
                borderRadius: "9px",
                border: "none",
                background: "linear-gradient(135deg, #00b377 0%, #008f58 100%)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(0, 179, 119, 0.28)",
              }}
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Save Approving Officers"}
            </button>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog before updating Approving Officers */}
      <ConfirmDialog
        open={confirmSaveOpen}
        title="Confirm Approving Officers Update?"
        danger={false}
        confirmLabel="Yes, Save Changes"
        confirmingLabel="Saving..."
        message={
          <div>
            Save official signatories for <strong>{form.location}</strong>?
            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
              • Signatory 1: <strong>{form.signee1Name || "None"}</strong> ({form.signee1Title || "No Title"})
              <br />
              • Signatory 2: <strong>{form.signee2Name || "None"}</strong> ({form.signee2Title || "No Title"})
            </div>
          </div>
        }
        loading={saving}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={executeSave}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Approving Officers?"
        message={
          deleteTarget && (
            <>
              Delete approving officers configuration for <strong>{deleteTarget.location}</strong>? Trip tickets
              for this office will fall back to system defaults.
            </>
          )
        }
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
