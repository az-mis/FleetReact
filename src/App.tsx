import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
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
import Drivers from "./pages/Drivers";
import Admins from "./pages/Admins";
import ContentSettings from "./pages/ContentSettings";
import Unauthorized from "./pages/Unauthorized";

function LoginRoute() {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/" replace /> : <Login />;
}

function App() {
  return (
    <AuthProvider>
      <FeatureFlagsProvider>
      <ToastProvider>
      <Router>
        <Routes>
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

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />

            {/* Vehicles: admin + super_admin only (drivers have no access) */}
            <Route
              path="vehicles"
              element={
                <ProtectedRoute allow={["admin", "super_admin"]} adminModule="vehicles" adminModuleLabel="Vehicle Information">
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

            {/* Content Settings (CMS): super_admin only — toggles which
                modules are enabled for admins and which content shows on
                the driver dashboard, plus the announcement banner. */}
            <Route
              path="content-settings"
              element={
                <ProtectedRoute allow={["super_admin"]}>
                  <ContentSettings />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </ToastProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}

export default App;
