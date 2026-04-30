import { Navigate, Outlet, useLocation } from "react-router-dom"
import { hasActiveSessionAuth, isAuthenticated, resolveAuthRedirect } from "@/lib/auth"

export default function PublicOnlyRoute() {
  const location = useLocation()

  if (isAuthenticated() && hasActiveSessionAuth()) {
    const redirect = new URLSearchParams(location.search).get("redirect")
    return <Navigate to={resolveAuthRedirect(redirect)} replace />
  }
  return <Outlet />
}
