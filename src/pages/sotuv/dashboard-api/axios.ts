// pages/Dashboard/dashboard-api/axios.ts
import axios from "axios"
import { getAccessToken } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
