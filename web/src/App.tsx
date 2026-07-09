import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute, RoleRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AuditorPage } from "./pages/AuditorPage";
import { ExpenseDetailPage } from "./pages/ExpenseDetailPage";
import { LandingPage } from "./pages/LandingPage";

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <LandingPage />;
  return <Navigate to={user.role === "auditor" ? "/auditor" : "/dashboard"} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["employee"]}>
              <DashboardPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditor"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["auditor"]}>
              <AuditorPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/expense/:id"
        element={
          <ProtectedRoute>
            <ExpenseDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
