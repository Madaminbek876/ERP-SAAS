import { api } from "@/lib/api"
import type {
  AccountUser,
  ChangePasswordPayload,
  ChangePasswordResponse,
  LoginPayload,
  LoginResponse,
  LogoutPayload,
  LogoutResponse,
  RefreshPayload,
  RefreshResponse,
  UpdateMePayload,
} from "@/types/auth"

function loadMe() {
  return api.get<AccountUser>("/api/v1/accounts/me/").then((r) => r.data)
}

export function getAccountSuccessMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) return payload
  if (!payload || typeof payload !== "object") return ""

  const detail = (payload as { detail?: unknown }).detail
  if (typeof detail === "string" && detail.trim()) return detail

  return ""
}

export const accountsApi = {
  login(payload: LoginPayload) {
    return api.post<LoginResponse>("/api/v1/accounts/login/", payload).then((r) => r.data)
  },

  refresh(payload: RefreshPayload) {
    return api.post<RefreshResponse>("/api/v1/accounts/token/refresh/", payload).then((r) => r.data)
  },

  logout(payload: LogoutPayload) {
    return api.post<LogoutResponse>("/api/v1/accounts/logout/", payload).then((r) => r.data)
  },

  me() {
    return loadMe()
  },

  async patchMe(payload: UpdateMePayload) {
    if (payload.avatar instanceof File) {
      await api.patchForm("/api/v1/accounts/me/", payload)
      return loadMe()
    }

    const updated = await api.patch<AccountUser>("/api/v1/accounts/me/", payload).then((r) => r.data)

    // Avatar o'chirilganda backend ba'zan bo'sh body yoki eski qiymat qaytaradi, shuning uchun qayta yuklaymiz.
    if ("avatar" in payload) {
      return loadMe()
    }

    return updated
  },

  changePassword(payload: ChangePasswordPayload) {
    return api.post<ChangePasswordResponse>("/api/v1/accounts/change-password/", payload).then((r) => r.data)
  },
}
