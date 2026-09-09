import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { DriveConfigProvider } from "./contexts/DriveConfigContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { ToastProvider } from "./contexts/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import VehicleAssigning from "./pages/VehicleAssigning";
import VehicleRequests from "./pages/VehicleRequests";
import RequestVehicle from "./pages/RequestVehicle";
import CheckStatus from "./pages/CheckStatus";
import TripTicket from "./pages/TripTicket";
import Landing from "./pages/Landing";
import Drivers from "./pages/Drivers";
import Admins from "./pages/Admins";
import ApprovingOfficers from "./pages/ApprovingOfficers";
import MyProfile from "./pages/MyProfile";
import TravelHistory from "./pages/TravelHistory";
import ContentSettings from "./pages/ContentSettings";
import Unauthorized from "./pages/Unauthorized";
import FooterDrivingCar from "./components/FooterDrivingCar";

function LoginRoute() {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/" replace /> : <Login />;
}

function RootRoute() {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/dashboard" replace /> : <Landing />;
}

function App() {
  return (
    <AuthProvider>
      <FeatureFlagsProvider>
      <DriveConfigProvider>
      <BrandingProvider>
      <ToastProvider>
      <Router>
        <FooterDrivingCar />
        <Routes>
          {/* Public Landing Page for starter / QR visits */}
          <Route path="/" element={<RootRoute />} />
          <Route path="/landing" element={<Landing />} />

          <Route path="/login" element={<LoginRoute />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Public, unauthenticated form — the QR code staff scan to
              request a vehicle. Lives outside the protected Layout entirely
              since requesters have no accounts. */}
          <Route path="/request-vehicle" element={<RequestVehicle />} />

          {/* Public status lookup — staff enter the reference code they got
              after submitting to see if their request was approved/declined.
              No auth, since requesters have no accounts. */}
          <Route path="/check-status" element={<CheckStatus />} />

          {/* Public printable trip ticket — only renders once a request is
              approved; the requester reaches it from the status page. */}
          <Route path="/trip-ticket/:id" element={<TripTicket />} />

          {/* Authenticated Dashboard and Management Pages */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />

            {/* My Profile: every authenticated role (super_admin, admin,
                driver) can view and update their own personal info here. */}
            <Route path="my-profile" element={<MyProfile />} />

            {/* Travel History: driver only */}
            <Route
              path="travel-history"
              element={
                <ProtectedRoute allow={["driver"]}>
                  <TravelHistory />
                </ProtectedRoute>
              }
            />

            {/* Vehicles: admin + super_admin only (drivers have no access) */}
            <Route
              path="vehicles"
              element={
                <ProtectedRoute allow={["admin", "super_admin"]} adminModule="vehicles" adminModuleLabel="Vehicles List">
                  <Vehicles />
                </ProtectedRoute>
              }
            />

            {/* Vehicle Assigning: admin + super_admin only — assigns a permanent
                driver to each vehicle */}
            <Route
              path="vehicle-assigning"
              element={
                <ProtectedRoute allow={["admin", "super_admin"]} adminModule="vehicleAssigning" adminModuleLabel="Vehicle Assigning">
                  <VehicleAssigning />
                </ProtectedRoute>
              }
            />

            {/* Vehicle Requests: admin + super_admin only — review/confirm
                requests submitted through the public QR-code form */}
            <Route
              path="vehicle-requests"
              element={
                <ProtectedRoute allow={["admin", "super_admin"]} adminModule="vehicleRequests" adminModuleLabel="Vehicle Requests">
                  <VehicleRequests />
                </ProtectedRoute>
              }
            />

            {/* Drivers: admin + super_admin only */}
            <Route
              path="drivers"
              element={
                <ProtectedRoute allow={["admin", "super_admin"]} adminModule="drivers" adminModuleLabel="Drivers">
                  <Drivers />
                </ProtectedRoute>
              }
            />

            {/* Admins: super_admin only — manages admin & super_admin accounts */}
            <Route
              path="admins"
              element={
                <ProtectedRoute allow={["super_admin"]}>
                  <Admins />
                </ProtectedRoute>
              }
            />

            {/* Approving Officers: admin + super_admin — manages trip ticket signatories */}
            <Route
              path="approving-officers"
              element={
                <ProtectedRoute allow={["admin", "super_admin"]}>
                  <ApprovingOfficers />
                </ProtectedRoute>
              }
            />

            {/* Content Settings (CMS): super_admin only — toggles which
                modules are enabled for admins and which content shows on
                the driver dashboard, plus the announcement banner. */}
            <Route
              path="content-settings"
              element={
                <ProtectedRoute allow={["admin", "super_admin"]}>
                  <ContentSettings />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </ToastProvider>
      </BrandingProvider>
      </DriveConfigProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}

export default App;
