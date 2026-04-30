export type AccountUser = {
  id: number
  username: string
  full_name?: string | null
  phone?: string | null
  avatar?: string | null
  admin_role?: string | null
  is_active?: boolean
}

export type LoginPayload = {
  username: string
  password: string
}

export type LoginResponse = {
  access: string
  refresh: string
}

export type RefreshPayload = {
  refresh: string
}

export type RefreshResponse = {
  access: string
  refresh?: string
}

export type LogoutPayload = {
  refresh: string
}

export type UpdateMePayload = {
  username: string
  full_name?: string
  phone?: string
  avatar?: File | null
}

export type ChangePasswordPayload = {
  old_password: string
  new_password: string
  new_password2: string
}

export type ChangePasswordResponse = Partial<ChangePasswordPayload> & {
  detail?: string
}

export type LogoutResponse = LogoutPayload & {
  detail?: string
}
