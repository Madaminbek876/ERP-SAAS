import type { AccountUser } from "@/types/auth"

const ACCESS_KEY = "access_token"
const REFRESH_KEY = "refresh_token"
const LEGACY_ACCESS_KEY = "access"
const LEGACY_REFRESH_KEY = "refresh"
const AUTH_KEY = "erp_auth"
const SESSION_AUTH_KEY = "erp_session_auth"
const USER_KEY = "erp_user"
const USER_AVATAR_VERSION_KEY = "erp_user_avatar_version"
const USER_AVATAR_CACHE_KEY = "erp_user_avatar_cache"
let temporaryUserAvatarUrl: string | null = null

function notifyUserChange() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("erp-user-change"))
}

function clearTemporaryAvatarState() {
  temporaryUserAvatarUrl = null
}

function getAvatarCacheEntryKey(user: Pick<AccountUser, "id" | "username"> | null | undefined) {
  if (!user) return ""
  const id = typeof user.id === "number" ? String(user.id) : ""
  const username = String(user.username ?? "").trim().toLowerCase()
  if (!id && !username) return ""
  return `${id}:${username}`
}

function readAvatarCache() {
  if (typeof window === "undefined") return {} as Record<string, string>

  try {
    const raw = localStorage.getItem(USER_AVATAR_CACHE_KEY)
    if (!raw) return {} as Record<string, string>
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : ({} as Record<string, string>)
  } catch {
    return {} as Record<string, string>
  }
}

function writeAvatarCache(nextCache: Record<string, string>) {
  if (typeof window === "undefined") return

  try {
    if (Object.keys(nextCache).length === 0) {
      localStorage.removeItem(USER_AVATAR_CACHE_KEY)
      return
    }

    localStorage.setItem(USER_AVATAR_CACHE_KEY, JSON.stringify(nextCache))
  } catch {
    // Avatar fallback cache is best-effort only.
  }
}

function hasToken(value: string | null): value is string {
  return Boolean(value && value !== "undefined" && value !== "null")
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4)
  return atob(`${normalized}${padding}`)
}

function isExpiredJwt(token: string): boolean {
  const parts = token.split(".")
  if (parts.length !== 3) return false

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: number }
    if (typeof payload.exp !== "number") return false
    return payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

function normalizeRedirectPath(targetPath?: string | null): string | null {
  if (!targetPath) return null

  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost"
    const url = new URL(targetPath, origin)

    if (typeof window !== "undefined" && url.origin !== window.location.origin) {
      return null
    }

    const normalized = `${url.pathname}${url.search}${url.hash}`
    return normalized.startsWith("/") ? normalized : null
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  const accessToken = getAccessToken()
  if (!hasToken(accessToken)) return false

  if (!isExpiredJwt(accessToken)) return true

  const refreshToken = getRefreshToken()
  if (hasToken(refreshToken) && !isExpiredJwt(refreshToken)) return true

  clearAuth()
  return false
}

export function buildLoginRedirectPath(targetPath?: string | null): string {
  const normalized = normalizeRedirectPath(targetPath)
  if (!normalized || normalized === "/login") {
    return "/login"
  }

  return `/login?redirect=${encodeURIComponent(normalized)}`
}

export function resolveAuthRedirect(targetPath?: string | null, fallback = "/dashboard"): string {
  const normalized = normalizeRedirectPath(targetPath)
  if (!normalized || normalized === "/login") {
    return fallback
  }

  return normalized
}

export function hasActiveSessionAuth(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(SESSION_AUTH_KEY) === "true"
}

export function markSessionAuth() {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SESSION_AUTH_KEY, "true")
}

export function setTokens(access: string, refresh?: string) {
  if (!access) throw new Error("Access token bo‘sh keldi")
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(LEGACY_ACCESS_KEY, access)
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh)
    localStorage.setItem(LEGACY_REFRESH_KEY, refresh)
  }
  localStorage.setItem(AUTH_KEY, "true")
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(LEGACY_ACCESS_KEY)
  localStorage.removeItem(LEGACY_REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(USER_AVATAR_VERSION_KEY)
  clearTemporaryAvatarState()
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_AUTH_KEY)
  }
  notifyUserChange()
}

// ✅ alias — clearTokens ishlatilgan joylar sinmasin
export const clearTokens = clearAuth

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY) || localStorage.getItem(LEGACY_ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY) || localStorage.getItem(LEGACY_REFRESH_KEY)
}

export function getStoredUser(): AccountUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AccountUser) : null
  } catch {
    return null
  }
}

export function getStoredAvatarVersion(): string | null {
  try {
    return localStorage.getItem(USER_AVATAR_VERSION_KEY)
  } catch {
    return null
  }
}

export function getTemporaryUserAvatarUrl(): string | null {
  return temporaryUserAvatarUrl
}

export function getPersistedUserAvatarUrl(user: Pick<AccountUser, "id" | "username"> | null = getStoredUser()): string | null {
  const key = getAvatarCacheEntryKey(user)
  if (!key) return null

  const cache = readAvatarCache()
  const value = cache[key]
  return typeof value === "string" && value.trim() ? value : null
}

export function setPersistedUserAvatarUrl(user: Pick<AccountUser, "id" | "username"> | null, url: string | null) {
  const key = getAvatarCacheEntryKey(user)
  if (!key) return

  const cache = readAvatarCache()
  if (url && url.trim()) {
    cache[key] = url
  } else {
    delete cache[key]
  }

  writeAvatarCache(cache)
  notifyUserChange()
}

export function clearPersistedUserAvatarUrl(user: Pick<AccountUser, "id" | "username"> | null = getStoredUser()) {
  setPersistedUserAvatarUrl(user, null)
}

export function setTemporaryUserAvatarUrl(url: string | null) {
  temporaryUserAvatarUrl = url
  notifyUserChange()
}

export function clearTemporaryUserAvatarUrl() {
  if (!temporaryUserAvatarUrl) return
  clearTemporaryAvatarState()
  notifyUserChange()
}

export function setStoredUser(user: AccountUser) {
  const previousAvatar = getStoredUser()?.avatar?.trim() || ""
  const nextAvatar = user.avatar?.trim() || ""

  localStorage.setItem(USER_KEY, JSON.stringify(user))

  if (!nextAvatar) {
    localStorage.removeItem(USER_AVATAR_VERSION_KEY)
  } else if (nextAvatar !== previousAvatar || !localStorage.getItem(USER_AVATAR_VERSION_KEY)) {
    localStorage.setItem(USER_AVATAR_VERSION_KEY, String(Date.now()))
  }

  notifyUserChange()
}
