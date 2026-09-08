/* ───────────────────────── Roles & Users ───────────────────────── */

export type UserRole = "super_admin" | "admin" | "driver";

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  driver: "Driver",
};

export const USER_ROLE_COLOR: Record<UserRole, string> = {
  super_admin: "#7e57c2",
  admin: "#2b6cb0",
  driver: "#1a6b3c",
};

// Mirrors Modules/Admin/Enums/UserRole.php from the source Laravel app.
export interface AppUser {
  id: string; // Firestore doc id === Firebase Auth uid
  name: string;
  email: string;
  role: UserRole;
  // A Google Drive "anyone with link" thumbnail URL (see src/lib/googleDrive.ts)
  // — Firebase Cloud Storage requires the Blaze plan, so photos are uploaded
  // to a Drive folder from the browser instead, staying on the free tier.
  photoURL?: string | null;
  // The Drive file ID behind photoURL, kept so the old file can be deleted
  // when the photo is replaced or removed. Not used for display.
  photoDriveFileId?: string | null;
  birthDate?: string | null; // yyyy-mm-dd, drivers only
  address?: string | null; // drivers only
  licenseExpirationDate?: string | null; // yyyy-mm-dd, drivers only
  location?: string | null; // Office/Province assignment for admins & requests
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}

/* ───────────────────────── Feature Flags (CMS) ───────────────────────── */

// Lets a super_admin turn whole modules on/off for the "admin" and "driver"
// roles without touching code or Firestore rules. Super admins themselves
// are never gated by these flags (see FeatureFlagsContext / ProtectedRoute) —
// this only ever restricts admin/driver, so a super_admin can't accidentally
// lock themselves out of the very screen used to flip these switches back on.
export interface AdminModuleFlags {
  vehicles: boolean; // Vehicle Information page
  vehicleAssigning: boolean; // Vehicle Assigning page
  vehicleRequests: boolean; // Vehicle Requests page
  drivers: boolean; // Drivers management page
}

export interface DriverModuleFlags {
  // Drivers currently only see the Dashboard; this gates the one
  // driver-facing content block besides the announcement below.
  showAssignedVehicle: boolean; // "My Assigned Vehicle" card
}

// A single on/off + message banner. Kept separate per audience (rather than
// one shared banner with an audience picker) so a plain admin can be given
// write access to the driver-facing one without also being able to touch
// what other admins/super admins see.
export interface AnnouncementConfig {
  enabled: boolean;
  message: string;
}

export interface FeatureFlags {
  adminModules: AdminModuleFlags;
  driverModules: DriverModuleFlags;
  // Shown to admin + super_admin. Editable by super_admin only.
  adminAnnouncement: AnnouncementConfig;
  // Shown to driver + super_admin. Editable by admin AND super_admin.
  driverAnnouncement: AnnouncementConfig;
  updatedAt?: any;
  updatedByName?: string | null;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  adminModules: {
    vehicles: true,
    vehicleAssigning: true,
    vehicleRequests: true,
    drivers: true,
  },
  driverModules: {
    showAssignedVehicle: true,
  },
  adminAnnouncement: {
    enabled: false,
    message: "",
  },
  driverAnnouncement: {
    enabled: false,
    message: "",
  },
};

// Firestore doc that stores the flags above.
export const FEATURE_FLAGS_DOC_PATH = ["settings", "featureFlags"] as const;

// Google Drive photo storage config (see src/lib/googleDrive.ts and
// src/contexts/DriveConfigContext.tsx). Created once by a super_admin via
// Content Settings > "Connect Google Drive" — everyone else just reads it.
export interface DriveConfig {
  rootFolderId: string; // the "FMS Photos" folder itself
  adminFolderId: string;
  vehicleFolderId: string;
  driverFolderId: string;
  connectedByName: string;
  connectedByEmail?: string; // pins token requests to this Google account via login_hint
  connectedAt: any; // Firestore server timestamp
}
export const DRIVE_CONFIG_DOC_PATH = ["settings", "driveConfig"] as const;

// App-wide branding (currently just the logo shown in the sidebar/header).
// Stored the same way as DriveConfig — a single settings doc, read by
// everyone signed in, written only by a super_admin (see firestore.rules:
// settings/{id} already restricts writes to super_admin by default). Uses
// the same Google Drive upload flow as vehicle/driver/admin photos, saved
// straight into the "FMS Photos" root folder rather than a subfolder since
// there's only ever one of these.
export interface AppBranding {
  logoURL?: string | null;
  logoDriveFileId?: string | null;
  // Background image shown behind the marketing/brand panel on the Login
  // screen (left side on desktop). Optional — falls back to the built-in
  // green gradient + illustration when unset.
  loginBackgroundURL?: string | null;
  loginBackgroundDriveFileId?: string | null;
  updatedAt?: any; // Firestore server timestamp
  updatedByName?: string | null;
}
export const BRANDING_DOC_PATH = ["settings", "appBranding"] as const;

/* ───────────────────────── Vehicles ───────────────────────── */

// Mirrors Modules/Vehicle/Models/Vehicle.php, plus an optional photoURL — a
// Google Drive "anyone with link" thumbnail URL (see src/lib/googleDrive.ts).
// Firebase Cloud Storage requires the Blaze plan, so photos are uploaded to
// a Drive folder from the browser instead, staying on the free tier.
export interface Vehicle {
  id: string;
  plateNumber: string;
  chassisNumber: string;
  engineNumber: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  odometer: number;
  vehicleType?: string | null;
  fuelType?: string | null;
  photoURL?: string | null;
  // The Drive file ID behind photoURL — kept so the old file can be deleted
  // when the photo is replaced or removed. Not used for display.
  photoDriveFileId?: string | null;
  // Permanent driver assignment (Vehicle Assigning feature). A vehicle has at
  // most one permanently assigned driver, and a driver is assigned to at most
  // one vehicle at a time. This is the default driver for the vehicle — future
  // work will let an admin/super_admin override the driver on a per-request
  // basis (e.g. when the assigned driver is unavailable) without changing
  // this permanent assignment.
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

// A stripped-down public mirror of a VehicleRequest, kept in sync by the
// mirrorVehicleAvailability Cloud Function (see functions/src/index.ts).
// Same doc ID as the source vehicleRequests doc. Used by the public
// RequestVehicle form to show a selected vehicle's booked dates without
// exposing requester name/contact, destination, or purpose.
export interface VehicleAvailability {
  id: string;
  vehicleId: string;
  travelDate: string; // yyyy-mm-dd
  travelDateEnd?: string | null; // yyyy-mm-dd
  status: "pending" | "approved";
}

/* ───────────────────────── Vehicle Requests ───────────────────────── */

// Staff have no accounts, so a request is submitted anonymously (e.g. via a
// QR code that opens the public request form) and only becomes tied to a
// driver/vehicle/admin once an admin reviews and confirms it.
export type VehicleRequestStatus = "pending" | "approved" | "declined";

export interface VehicleRequest {
  id: string;
  requesterName: string;
  // One of the MIMAROPA-region locations in src/data — see LOCATIONS in
  // RequestVehicle.tsx. Plain string for now; not yet tied to `OFFICES`.
  location?: string | null;
  requesterOffice?: string | null;
  requesterContact?: string | null;
  vehicleId: string;
  vehiclePlateNumber: string;
  // The vehicle's permanent driver at the time of the request (from Vehicle
  // Assigning). Kept as a snapshot so it doesn't silently change if the
  // permanent assignment is edited after the request was submitted.
  defaultDriverId?: string | null;
  defaultDriverName?: string | null;
  // Set by the admin at confirmation time — equals defaultDriverId unless the
  // default driver is unavailable and a substitute is chosen. This is a
  // one-off override; it never modifies the vehicle's permanent assignment.
  confirmedDriverId?: string | null;
  confirmedDriverName?: string | null;
  purpose: string;
  destination: string;
  travelDate: string; // yyyy-mm-dd — start date (single-day trips use only this)
  travelDateEnd?: string | null; // yyyy-mm-dd — end date, only set for multi-day trips
  // Whether the requester themself is riding along on the trip (vs. just
  // submitting the request on someone else's behalf). Drives whether their
  // name appears as a passenger on the printed trip ticket.
  requesterIsPassenger?: boolean;
  passengers?: string[] | null;
  // Date of the requester's previous Driver's Trip Ticket, if any — carried
  // over onto the printed trip ticket (Appendix A, item 7).
  previousTripTicketDate?: string | null;
  status: VehicleRequestStatus;
  declineReason?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}
