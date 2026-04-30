import { api } from "@/lib/api"
import type { Client, Employee, EntityMap, Supplier, TabKey } from "./types"
import { partnerEvents } from "@/pages/xodimlar/events"

type CreatePayload<K extends TabKey> = Omit<EntityMap[K], "id" | "createdAt">
type UpdatePayload<K extends TabKey> = Partial<CreatePayload<K>>

type ApiRow = Record<string, unknown>
type ApiListEnvelope = { results?: unknown[]; items?: unknown[]; employees?: unknown[]; count?: unknown; next?: unknown; previous?: unknown }

function asArray(data: unknown): ApiRow[] {
  if (Array.isArray(data)) return data as ApiRow[]
  if (typeof data === "object" && data !== null) {
    const obj = data as ApiListEnvelope
    if (Array.isArray(obj.results)) return obj.results as ApiRow[]
    if (Array.isArray(obj.items)) return obj.items as ApiRow[]
    if (Array.isArray(obj.employees)) return obj.employees as ApiRow[]
  }
  return []
}

function asListMeta(data: unknown) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { count: 0, next: null as string | null, previous: null as string | null }
  }
  const obj = data as ApiListEnvelope
  const count = Number(obj.count)
  return {
    count: Number.isFinite(count) ? count : asArray(data).length,
    next: typeof obj.next === "string" ? obj.next : null,
    previous: typeof obj.previous === "string" ? obj.previous : null,
  }
}

function asNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function asString(v: unknown) {
  return String(v ?? "")
}

function normalizeEmail(v: unknown) {
  const x = asString(v).trim().toLowerCase()
  return x || undefined
}

function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")
  ) as T
}

function normalizeEmployee(x: ApiRow, idx: number): Employee {
  return {
    id: asString(x.id ?? `EMP-${idx}`),
    // Backend maydonlari (full_name/base_salary/currency/is_active/deleted_at) ni front modelga map qilamiz.
    name: asString(x.full_name ?? x.name ?? "-"),
    phone: asString(x.phone ?? x.phone_number ?? ""),
    email: asString(x.email ?? ""),
    address: asString(x.address ?? ""),
    position: asString(x.position ?? x.role ?? ""),
    salary: asNumber(x.base_salary ?? x.salary ?? x.wage ?? 0),
    currency: asString(x.currency ?? "UZS"),
    isActive: Boolean(x.is_active ?? true),
    salaryStatus: asString(x.salary_status ?? ""),
    thisMonthAdvance: asNumber(x.this_month_advance ?? 0),
    salaryRemaining: asNumber(x.salary_remaining ?? 0),
    deletedAt: (x.deleted_at as string | null | undefined) ?? null,
    createdAt: asString(x.created_at ?? x.createdAt ?? new Date().toISOString()),
    updatedAt: asString(x.updated_at ?? x.updatedAt ?? ""),
  }
}

function normalizeKontragentAsEmployee(x: ApiRow, idx: number): Employee {
  return {
    id: asString(x.id ?? `EMP-${idx}`),
    name: asString(x.name ?? "-"),
    phone: asString(x.phone ?? ""),
    email: asString(x.email ?? ""),
    address: asString(x.address ?? ""),
    position: asString(x.position ?? x.role ?? ""),
    salary: asNumber(x.salary ?? 0),
    createdAt: asString(x.created_at ?? x.createdAt ?? new Date().toISOString()),
  }
}

function normalizeKontragentAsClient(x: ApiRow, idx: number): Client {
  return {
    id: asString(x.id ?? `CLI-${idx}`),
    code: asString(x.code ?? ""),
    kind: asString(x.kind ?? x.type ?? "CLIENT"),
    name: asString(x.name ?? "-"),
    phone: asString(x.phone ?? ""),
    email: asString(x.email ?? ""),
    address: asString(x.address ?? ""),
    company: asString(x.company ?? x.organization ?? ""),
    taxId: asString(x.inn ?? x.tax_id ?? ""),
    notes: asString(x.notes ?? ""),
    isActive: Boolean(x.is_active ?? true),
    deletedAt: (x.deleted_at as string | null | undefined) ?? null,
    createdAt: asString(x.created_at ?? x.createdAt ?? new Date().toISOString()),
    updatedAt: asString(x.updated_at ?? x.updatedAt ?? ""),
  }
}

function normalizeKontragentAsSupplier(x: ApiRow, idx: number): Supplier {
  return {
    id: asString(x.id ?? `SUP-${idx}`),
    code: asString(x.code ?? ""),
    kind: asString(x.kind ?? x.type ?? "SUPPLIER"),
    name: asString(x.name ?? "-"),
    phone: asString(x.phone ?? ""),
    email: asString(x.email ?? ""),
    address: asString(x.address ?? ""),
    company: asString(x.company ?? x.organization ?? x.name ?? "-"),
    taxId: asString(x.inn ?? x.tax_id ?? ""),
    notes: asString(x.notes ?? ""),
    paymentTerms: asString(x.payment_terms ?? x.paymentTerms ?? ""),
    isActive: Boolean(x.is_active ?? true),
    deletedAt: (x.deleted_at as string | null | undefined) ?? null,
    createdAt: asString(x.created_at ?? x.createdAt ?? new Date().toISOString()),
    updatedAt: asString(x.updated_at ?? x.updatedAt ?? ""),
  }
}

async function postWithCandidates(urls: string[], payload: Record<string, unknown>) {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const { data } = await api.post(url, payload)
      return data
    } catch (e: any) {
      const status = Number(e?.response?.status || 0)
      if (status !== 404) throw e
      lastErr = e
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Create endpoint topilmadi")
}

async function postSupplierKontragent(payload: Record<string, unknown>) {
  const urls = ["/api/v1/partners/kontragents/"]
  const kinds = ["SUPPLIER"]
  let lastErr: unknown = null
  const base = {
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    inn: payload.inn,
    address: payload.address,
    notes: payload.notes,
  }

  const variants: Record<string, unknown>[] = []
  for (const kind of kinds) {
    variants.push({ ...base, kind, notes: base.notes })
  }

  for (const body of variants) {
    for (const url of urls) {
      try {
        const cleaned = cleanPayload(body)
        const { data } = await api.post(url, cleaned)
        return data
      } catch (e: any) {
        const status = Number(e?.response?.status || 0)
        if (status === 404) {
          lastErr = e
          continue
        }
        throw e
      }
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Supplier create endpoint topilmadi")
}

async function deleteWithCandidates(urls: string[]) {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      await api.delete(url)
      return
    } catch (e: any) {
      const status = Number(e?.response?.status || 0)
      if (status !== 404) throw e
      lastErr = e
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Delete endpoint topilmadi")
}

type KontragentKind = "CLIENT" | "SUPPLIER" | "BOTH"

const EMPLOYEE_ENDPOINTS = ["/api/v1/partners/employees/"]

function normalizeEmployeeOrdering(value?: string) {
  const order = asString(value).trim()
  if (!order) return undefined
  if (order === "name") return "full_name"
  if (order === "-name") return "-full_name"
  return order
}

function normalizeKontragentOrdering(value?: string) {
  const order = asString(value).trim()
  return order || undefined
}

async function listEmployees(params?: {
  is_active?: boolean
  search?: string
  ordering?: string
  page?: number
}) {
  const query = cleanPayload({
    is_active: typeof params?.is_active === "boolean" ? params.is_active : undefined,
    search: params?.search,
    ordering: normalizeEmployeeOrdering(params?.ordering),
    page: params?.page,
  })
  let lastErr: unknown = null
  for (const url of EMPLOYEE_ENDPOINTS) {
    try {
      const { data } = await api.get(url, { params: query })
      return { rows: asArray(data), ...asListMeta(data) }
    } catch (e: any) {
      const status = Number(e?.response?.status || 0)
      if (status !== 404) throw e
      lastErr = e
    }
  }
  if (lastErr) throw lastErr
  return { rows: [], count: 0, next: null as string | null, previous: null as string | null }
}

async function listAllEmployeeRows(params?: {
  is_active?: boolean
  search?: string
  ordering?: string
}) {
  const rows: ApiRow[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY

  while (page <= 100 && rows.length < totalCount) {
    const response = await listEmployees({
      is_active: params?.is_active,
      search: params?.search,
      ordering: params?.ordering,
      page,
    })

    totalCount = Math.max(Number(response.count || rows.length), rows.length)
    rows.push(...response.rows)

    if (!response.rows.length) break
    if (!response.next && rows.length >= totalCount) break
    if (response.rows.length > 0 && !response.next && response.count === 0) break

    page += 1
  }

  return rows
}

async function fetchEmployeeDetailRow(id: string) {
  const { data } = await api.get(`/api/v1/partners/employees/${id}/`)
  return (data as ApiRow) || {}
}

async function patchEmployee(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/api/v1/partners/employees/${id}/`, payload)
  return data
}

async function listKontragentRows(params?: {
  kind?: KontragentKind
  is_active?: boolean
  search?: string
  ordering?: string
  page?: number
  created_from?: string
  created_to?: string
}) {
  const query = cleanPayload({
    kind: params?.kind,
    is_active: typeof params?.is_active === "boolean" ? params.is_active : undefined,
    search: params?.search,
    ordering: normalizeKontragentOrdering(params?.ordering),
    page: params?.page,
    created_from: params?.created_from,
    created_to: params?.created_to,
  })
  const { data } = await api.get("/api/v1/partners/kontragents/", { params: query })
  return { rows: asArray(data), ...asListMeta(data) }
}

async function listAllKontragentRows(params?: {
  kind?: KontragentKind
  is_active?: boolean
  search?: string
  ordering?: string
  created_from?: string
  created_to?: string
}) {
  const rows: ApiRow[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY

  while (page <= 100 && rows.length < totalCount) {
    const response = await listKontragentRows({
      kind: params?.kind,
      is_active: params?.is_active,
      search: params?.search,
      ordering: params?.ordering,
      created_from: params?.created_from,
      created_to: params?.created_to,
      page,
    })

    totalCount = Math.max(Number(response.count || rows.length), rows.length)
    rows.push(...response.rows)

    if (!response.rows.length) break
    if (!response.next && rows.length >= totalCount) break
    if (response.rows.length > 0 && !response.next && response.count === 0) break

    page += 1
  }

  return rows
}

async function fetchKontragentDetailRow(id: string) {
  const { data } = await api.get(`/api/v1/partners/kontragents/${id}/`)
  return (data as ApiRow) || {}
}

function buildKontragentPatchPayload(
  detail: ApiRow,
  overrides: Partial<{
    kind: string
    name: string
    phone: string
    email: string
    inn: string
    address: string
    notes: string
    is_active: boolean
  }>,
  fallbackKind: KontragentKind
) {
  return cleanPayload({
    kind: overrides.kind ?? asString(detail.kind ?? detail.type ?? fallbackKind),
    name: overrides.name ?? asString(detail.name),
    phone: overrides.phone ?? (asString(detail.phone) || undefined),
    email:
      overrides.email !== undefined
        ? normalizeEmail(overrides.email)
        : normalizeEmail(detail.email),
    inn:
      overrides.inn !== undefined
        ? asString(overrides.inn) || undefined
        : asString(detail.inn ?? detail.tax_id) || undefined,
    address:
      overrides.address !== undefined
        ? asString(overrides.address) || undefined
        : asString(detail.address) || undefined,
    notes:
      overrides.notes !== undefined
        ? asString(overrides.notes) || undefined
        : asString(detail.notes) || undefined,
    is_active:
      overrides.is_active !== undefined
        ? overrides.is_active
        : detail.is_active === undefined
          ? true
          : Boolean(detail.is_active),
  })
}

async function patchKontragent(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/api/v1/partners/kontragents/${id}/`, payload)
  return data
}

export const apiAxios = {
  async listEmployeesPage(params?: {
    is_active?: boolean
    search?: string
    ordering?: string
    page?: number
    page_size?: number
  }) {
    const requestedPage = Math.max(1, Number(params?.page ?? 1))
    const requestedPageSize = Math.max(1, Number(params?.page_size ?? 10))
    const allRows = await listAllEmployeeRows({
      is_active: params?.is_active,
      search: params?.search,
      ordering: params?.ordering,
    })
    const start = (requestedPage - 1) * requestedPageSize
    const items = allRows.slice(start, start + requestedPageSize)
    const totalPages = Math.max(1, Math.ceil(allRows.length / requestedPageSize))
    return {
      items: items.map((x, i) => normalizeEmployee(x, start + i)),
      total: allRows.length,
      next: requestedPage < totalPages ? String(requestedPage + 1) : null,
      previous: requestedPage > 1 ? String(requestedPage - 1) : null,
    }
  },

  async listKontragentsPage(params: {
    kind?: "CLIENT" | "SUPPLIER" | "BOTH"
    is_active?: boolean
    search?: string
    ordering?: string
    page?: number
    page_size?: number
  }) {
    const requestedPage = Math.max(1, Number(params.page ?? 1))
    const requestedPageSize = Math.max(1, Number(params.page_size ?? 10))
    const allRows = await listAllKontragentRows({
      kind: params.kind,
      is_active: params.is_active,
      search: params.search,
      ordering: params.ordering,
    })
    const start = (requestedPage - 1) * requestedPageSize
    const rows = allRows.slice(start, start + requestedPageSize)
    const totalPages = Math.max(1, Math.ceil(allRows.length / requestedPageSize))
    return {
      rows,
      count: allRows.length,
      next: requestedPage < totalPages ? String(requestedPage + 1) : null,
      previous: requestedPage > 1 ? String(requestedPage - 1) : null,
    }
  },

  async detail<K extends TabKey>(key: K, id: string): Promise<EntityMap[K]> {
    if (key === "employee") {
      const data = await fetchEmployeeDetailRow(id)
      return normalizeEmployee(data, 0) as EntityMap[K]
    }
    const row = await fetchKontragentDetailRow(id)
    if (key === "client") return normalizeKontragentAsClient(row, 0) as EntityMap[K]
    return normalizeKontragentAsSupplier(row, 0) as EntityMap[K]
  },

  async listClientsPage(params: {
    is_active?: boolean
    search?: string
    ordering?: string
    page?: number
    page_size?: number
  }) {
    const res = await this.listKontragentsPage({
      kind: "CLIENT",
      is_active: params.is_active,
      search: params.search,
      ordering: params.ordering,
      page: params.page,
      page_size: params.page_size,
    })
    return {
      items: res.rows.map((x, i) => normalizeKontragentAsClient(x, i)),
      total: res.count,
      next: res.next,
      previous: res.previous,
    }
  },

  async listSuppliersPage(params: {
    is_active?: boolean
    search?: string
    ordering?: string
    page?: number
    page_size?: number
  }) {
    const res = await this.listKontragentsPage({
      kind: "SUPPLIER",
      is_active: params.is_active,
      search: params.search,
      ordering: params.ordering,
      page: params.page,
      page_size: params.page_size,
    })
    return {
      items: res.rows.map((x, i) => normalizeKontragentAsSupplier(x, i)),
      total: res.count,
      next: res.next,
      previous: res.previous,
    }
  },

  async list<K extends TabKey>(key: K): Promise<EntityMap[K][]> {
    if (key === "employee") {
      const rows = await listAllEmployeeRows({ ordering: "-created_at" }).catch(() => [] as ApiRow[])
      return rows.map((x, i) => normalizeEmployee(x, i)) as EntityMap[K][]
    }
    if (key === "client") {
      const rows = await listAllKontragentRows({ kind: "CLIENT", ordering: "-created_at" }).catch(() => [] as ApiRow[])
      return rows.map((x, i) => normalizeKontragentAsClient(x, i)) as EntityMap[K][]
    }
    const rows = await listAllKontragentRows({ kind: "SUPPLIER", ordering: "-created_at" }).catch(() => [] as ApiRow[])
    return rows.map((x, i) => normalizeKontragentAsSupplier(x, i)) as EntityMap[K][]
  },

  async create<K extends TabKey>(key: K, payload: CreatePayload<K>): Promise<EntityMap[K]> {
    if (key === "employee") {
      const salaryRaw = (payload as CreatePayload<"employee">).salary
      const body: Record<string, unknown> = {
        full_name: (payload as CreatePayload<"employee">).name,
        position: (payload as CreatePayload<"employee">).position,
        phone: (payload as CreatePayload<"employee">).phone,
        // Salary berilmagan bo'lsa backend defaultiga qoldiramiz, majburan 0 qilmaymiz.
        base_salary: salaryRaw == null ? undefined : Number(salaryRaw),
        currency: (payload as CreatePayload<"employee">).currency || "UZS",
      }
      const data = await postWithCandidates(EMPLOYEE_ENDPOINTS, cleanPayload(body))
      const created = normalizeEmployee((data as ApiRow) || body, 0) as EntityMap[K]
      partnerEvents.emit()
      return created
    }

    if (key === "client") {
      const body = {
        kind: "CLIENT",
        name: (payload as CreatePayload<"client">).name,
        phone: (payload as CreatePayload<"client">).phone,
        email: normalizeEmail((payload as CreatePayload<"client">).email),
        inn: (payload as CreatePayload<"client">).taxId || undefined,
        address: (payload as CreatePayload<"client">).address || undefined,
        notes: (payload as CreatePayload<"client">).notes || undefined,
      }
      const data = await postWithCandidates(["/api/v1/partners/kontragents/"], cleanPayload(body))
      const created = normalizeKontragentAsClient((data as ApiRow) || body, 0) as EntityMap[K]
      partnerEvents.emit()
      return created
    }

      const body = {
        kind: "SUPPLIER",
        name: (payload as CreatePayload<"supplier">).name,
        phone: (payload as CreatePayload<"supplier">).phone,
        email: normalizeEmail((payload as CreatePayload<"supplier">).email),
        inn: (payload as CreatePayload<"supplier">).taxId || undefined,
        address: (payload as CreatePayload<"supplier">).address || undefined,
        notes: (payload as CreatePayload<"supplier">).notes || undefined,
      }
      const data = await postSupplierKontragent(body)
      const created = normalizeKontragentAsSupplier((data as ApiRow) || body, 0) as EntityMap[K]
      partnerEvents.emit()
      return created
  },

  async update<K extends TabKey>(key: K, id: string, payload: UpdatePayload<K>): Promise<EntityMap[K]> {
    if (key === "employee") {
      const salaryRaw = (payload as UpdatePayload<"employee">).salary
      const body: Record<string, unknown> = {
        full_name: (payload as UpdatePayload<"employee">).name,
        position: (payload as UpdatePayload<"employee">).position,
        phone: (payload as UpdatePayload<"employee">).phone,
        base_salary: salaryRaw == null ? undefined : Number(salaryRaw),
        currency: (payload as UpdatePayload<"employee">).currency,
        is_active: (payload as UpdatePayload<"employee">).isActive,
      }
      const data = await patchEmployee(id, cleanPayload(body))
      const updated = normalizeEmployee((data as ApiRow) || body, 0) as EntityMap[K]
      partnerEvents.emit()
      return updated
    }

    if (key === "client") {
      const kontragent = payload as UpdatePayload<"client">
      const detail = await fetchKontragentDetailRow(id)
      const body = buildKontragentPatchPayload(
        detail,
        {
          ...(kontragent.kind !== undefined ? { kind: kontragent.kind } : {}),
          ...(kontragent.name !== undefined ? { name: kontragent.name } : {}),
          ...(kontragent.phone !== undefined ? { phone: kontragent.phone } : {}),
          ...(kontragent.email !== undefined ? { email: kontragent.email } : {}),
          ...(kontragent.taxId !== undefined ? { inn: kontragent.taxId } : {}),
          ...(kontragent.address !== undefined ? { address: kontragent.address } : {}),
          ...(kontragent.notes !== undefined ? { notes: kontragent.notes } : {}),
          ...(kontragent.isActive !== undefined ? { is_active: kontragent.isActive } : {}),
        },
        "CLIENT"
      )
      const data = await patchKontragent(id, body)
      const updated = normalizeKontragentAsClient((data as ApiRow) || body, 0) as EntityMap[K]
      partnerEvents.emit()
      return updated
    }

    const kontragent = payload as UpdatePayload<"supplier">
    const detail = await fetchKontragentDetailRow(id)
    const body = buildKontragentPatchPayload(
      detail,
      {
        ...(kontragent.kind !== undefined ? { kind: kontragent.kind } : {}),
        ...(kontragent.name !== undefined ? { name: kontragent.name } : {}),
        ...(kontragent.phone !== undefined ? { phone: kontragent.phone } : {}),
        ...(kontragent.email !== undefined ? { email: kontragent.email } : {}),
        ...(kontragent.taxId !== undefined ? { inn: kontragent.taxId } : {}),
        ...(kontragent.address !== undefined ? { address: kontragent.address } : {}),
        ...(kontragent.notes !== undefined ? { notes: kontragent.notes } : {}),
        ...(kontragent.isActive !== undefined ? { is_active: kontragent.isActive } : {}),
      },
      "SUPPLIER"
    )
    const data = await patchKontragent(id, body)
    const updated = normalizeKontragentAsSupplier((data as ApiRow) || body, 0) as EntityMap[K]
    partnerEvents.emit()
    return updated
  },

  async remove<K extends TabKey>(key: K, id: string): Promise<{ ok: true }> {
    if (key === "employee") {
      await deleteWithCandidates(EMPLOYEE_ENDPOINTS.map((x) => `${x}${id}/`))
      partnerEvents.emit()
      return { ok: true }
    }
    await deleteWithCandidates([`/api/v1/partners/kontragents/${id}/`])
    partnerEvents.emit()
    return { ok: true }
  },

  async restore<K extends TabKey>(key: K, id: string): Promise<{ ok: true }> {
    if (key === "employee") {
      throw new Error("Employees restore endpoint [4.1] Swagger bo'yicha mavjud emas.")
    }
    throw new Error("Kontragents restore endpoint [4.2] Swagger bo'yicha mavjud emas.")
  },

  async activate<K extends TabKey>(key: K, id: string): Promise<{ ok: true }> {
    if (key === "employee") {
      const detail = await fetchEmployeeDetailRow(id)
      await patchEmployee(
        id,
        cleanPayload({
          full_name: asString(detail.full_name),
          position: asString(detail.position || "") || undefined,
          phone: asString(detail.phone || "") || undefined,
          base_salary: detail.base_salary == null || detail.base_salary === "" ? undefined : Number(detail.base_salary),
          currency: asString(detail.currency || "UZS"),
          is_active: true,
        })
      )
      partnerEvents.emit()
      return { ok: true }
    }
    const detail = await fetchKontragentDetailRow(id)
    await patchKontragent(id, buildKontragentPatchPayload(detail, { is_active: true }, key === "client" ? "CLIENT" : "SUPPLIER"))
    partnerEvents.emit()
    return { ok: true }
  },

  async deactivate<K extends TabKey>(key: K, id: string): Promise<{ ok: true }> {
    if (key === "employee") {
      const detail = await fetchEmployeeDetailRow(id)
      await patchEmployee(
        id,
        cleanPayload({
          full_name: asString(detail.full_name),
          position: asString(detail.position || "") || undefined,
          phone: asString(detail.phone || "") || undefined,
          base_salary: detail.base_salary == null || detail.base_salary === "" ? undefined : Number(detail.base_salary),
          currency: asString(detail.currency || "UZS"),
          is_active: false,
        })
      )
      partnerEvents.emit()
      return { ok: true }
    }
    const detail = await fetchKontragentDetailRow(id)
    await patchKontragent(id, buildKontragentPatchPayload(detail, { is_active: false }, key === "client" ? "CLIENT" : "SUPPLIER"))
    partnerEvents.emit()
    return { ok: true }
  },

  async hardDelete<K extends TabKey>(key: K, id: string): Promise<{ ok: true }> {
    if (key === "employee") {
      throw new Error("Employees hard delete endpoint [4.1] Swagger bo'yicha mavjud emas.")
    }
    throw new Error("Kontragents hard delete endpoint [4.2] Swagger bo'yicha mavjud emas.")
  },

  async autocompleteEmployees(params: { q: string; limit?: number }) {
    const limit = Math.min(50, Math.max(1, Number(params.limit ?? 10)))
    const rows = await listAllEmployeeRows({
      search: params.q,
      ordering: "full_name",
      is_active: true,
    }).catch(() => [] as ApiRow[])
    return rows.slice(0, limit).map((x) => ({
      id: asString(x.id),
      full_name: asString(x.full_name ?? x.name),
      position: asString(x.position ?? x.role),
      phone: asString(x.phone),
    }))
  },

  async employeesMeta() {
    return {
      currency_choices: ["UZS", "USD", "EUR", "RUB"],
    }
  },

  async autocomplete(params: { q: string; limit?: number }) {
    const limit = Math.min(50, Math.max(1, Number(params.limit ?? 10)))
    const rows = await listAllKontragentRows({
      search: params.q,
      ordering: "name",
      is_active: true,
    }).catch(() => [] as ApiRow[])

    return rows.slice(0, limit).map((x) => ({
      id: asString(x.id),
      code: asString(x.code),
      name: asString(x.name),
      phone: asString(x.phone),
      inn: asString(x.inn ?? x.tax_id),
    }))
  },

  async checkDuplicate(params: { inn?: string; phone?: string; email?: string }) {
    const rows = await listAllKontragentRows({ ordering: "name" }).catch(() => [] as ApiRow[])
    const normalizedInn = asString(params.inn).trim()
    const normalizedPhone = asString(params.phone).trim()
    const normalizedEmail = normalizeEmail(params.email)
    const matches = rows.filter((row) => {
      const rowInn = asString(row.inn ?? row.tax_id).trim()
      const rowPhone = asString(row.phone).trim()
      const rowEmail = normalizeEmail(row.email)
      return Boolean(
        (normalizedInn && rowInn && rowInn === normalizedInn) ||
          (normalizedPhone && rowPhone && rowPhone === normalizedPhone) ||
          (normalizedEmail && rowEmail && rowEmail === normalizedEmail)
      )
    })
    return { duplicate: matches.length > 0, matches }
  },

  async meta() {
    return null
  },
}
