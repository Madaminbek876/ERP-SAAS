import { api } from "@/lib/api";

type Query = Record<string, any> | undefined;

export const http = {
  async get<T>(url: string, params?: Query): Promise<T> {
    const res = await api.get<T>(url, { params });
    return res.data;
  },
  async post<T>(url: string, data?: any, params?: Query): Promise<T> {
    const res = await api.post<T>(url, data, { params });
    return res.data;
  },
  async patch<T>(url: string, data?: any, params?: Query): Promise<T> {
    const res = await api.patch<T>(url, data, { params });
    return res.data;
  },
  async put<T>(url: string, data?: any, params?: Query): Promise<T> {
    const res = await api.put<T>(url, data, { params });
    return res.data;
  },
  async delete<T>(url: string, params?: Query): Promise<T> {
    const res = await api.delete<T>(url, { params });
    return res.data;
  },
};
