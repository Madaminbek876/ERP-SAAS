import { useEffect, useRef, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { buildLoginRedirectPath, clearAuth, hasActiveSessionAuth, isAuthenticated } from "@/lib/auth"

const IDLE_TIMEOUT_MS = 5 * 60 * 1000
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "click",
  "keydown",
  "mousedown",
  "mousemove",
  "scroll",
  "touchstart",
]

export default function ProtectedRoute() {
  const [sessionExpired, setSessionExpired] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const location = useLocation()
  const authenticated = isAuthenticated()
  const sessionAuthorized = hasActiveSessionAuth()
  const currentPath = `${location.pathname}${location.search}${location.hash}`

  useEffect(() => {
    if (authenticated && !sessionAuthorized) {
      clearAuth()
    }
  }, [authenticated, sessionAuthorized])

  useEffect(() => {
    if (!authenticated || !sessionAuthorized) return

    function clearIdleTimer() {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    function expireSession() {
      clearIdleTimer()
      clearAuth()
      setSessionExpired(true)
    }

    function resetIdleTimer() {
      clearIdleTimer()
      timeoutRef.current = window.setTimeout(expireSession, IDLE_TIMEOUT_MS)
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer)
    })

    resetIdleTimer()

    return () => {
      clearIdleTimer()
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer)
      })
    }
  }, [authenticated, sessionAuthorized])

  if (sessionExpired || !authenticated || !sessionAuthorized) {
    return <Navigate to={buildLoginRedirectPath(currentPath)} replace />
  }

  return <Outlet />
}
