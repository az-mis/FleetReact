import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import Drivers from "./pages/Drivers";
import Admins from "./pages/Admins";
import Unauthorized from "./pages/Unauthorized";

function LoginRoute() {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/" replace /> : <Login />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

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
                <ProtectedRoute allow={["admin", "super_admin"]}>
                  <Vehicles />
                </ProtectedRoute>
              }
            />

            {/* Drivers: admin + super_admin only */}
            <Route
              path="drivers"
              element={
                <ProtectedRoute allow={["admin", "super_admin"]}>
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
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
