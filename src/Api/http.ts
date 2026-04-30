import axios from "axios"
import { getAccessToken } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

http.interceptors.request.use((config) => {
  // agar siz JWT tokenni localStorage’da saqlasangiz:
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
