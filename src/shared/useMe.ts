import { API_BASE_URL } from "@/lib/api"
import { getPersistedUserAvatarUrl, getStoredAvatarVersion, getStoredUser, getTemporaryUserAvatarUrl } from "@/lib/auth"
import type { AccountUser } from "@/types/auth"

function getDisplayName(user: AccountUser | null): string {
  return user?.full_name || user?.username || "Foydalanuvchi"
}

function toAbsoluteUrl(value: string): string {
  const apiBase = new URL(API_BASE_URL)

  if (/^https?:\/\//i.test(value)) {
    try {
      const absolute = new URL(value)
      if (absolute.hostname === apiBase.hostname && absolute.origin !== apiBase.origin) {
        return `${apiBase.origin}${absolute.pathname}${absolute.search}${absolute.hash}`
      }
      return absolute.toString()
    } catch {
      return value
    }
  }

  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`
}

function withCacheBuster(url: string): string {
  const version = getStoredAvatarVersion()
  if (!version) return url
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}v=${encodeURIComponent(version)}`
}

export function getUserName(): string {
  const me = getStoredUser()
  return getDisplayName(me)
}

export function getUserRoleLabel(): string {
  const role = getStoredUser()?.admin_role
  if (!role) return "Admin"

  const normalized = role.replaceAll("_", " ").trim().toLowerCase()
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function getUserAvatarUrl(user: AccountUser | null = getStoredUser()): string | null {
  const temporaryAvatarUrl = getTemporaryUserAvatarUrl()
  if (temporaryAvatarUrl) return temporaryAvatarUrl

  const avatar = user?.avatar?.trim()
  if (!avatar) return null
  return withCacheBuster(toAbsoluteUrl(avatar))
}

export function getUserAvatarFallbackUrl(user: AccountUser | null = getStoredUser()): string | null {
  return getPersistedUserAvatarUrl(user)
}

export function getUserInitials(user: AccountUser | null = getStoredUser()): string {
  const displayName = getDisplayName(user).trim()
  if (!displayName) return "U"

  const parts = displayName.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}
