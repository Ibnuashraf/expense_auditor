import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-secondary">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  return <>{children}</>;
}

export function RoleRoute({
  roles,
  children,
}: {
  roles: ("employee" | "auditor")[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role as "employee" | "auditor")) {
    return <Navigate to={user?.role === "auditor" ? "/auditor" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}
