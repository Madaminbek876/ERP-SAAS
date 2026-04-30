import { api } from "@/lib/api"
import { apiAxios } from "@/Api/api.axios"
import type { Currency, Employee, ExchangeRate, ExchangeRateInput, FinanceEntry } from "./types"
import { financeEvents } from "./events"

const EXCHANGE_RATE_ENDPOINTS: string[] = []

const EXCHANGE_RATE_RETRY_DELAY_MS = 10 * 60 * 1000

let cachedExchangeRateReadEndpoint: string | null = null
let cachedExchangeRateWriteEndpoint: string | null = null
let exchangeRateEndpointUnavailableUntil = 0

const EP = {
  ledger: ["/api/v1/finance/ledger/"],
  payments: ["/api/v1/finance/payments/"],
  paymentsAdvance: ["/api/v1/finance/payments/advance/", "/api/v1/finance/payments/advance"],
  paymentsExpense: ["/api/v1/finance/payments/expense/", "/api/v1/finance/payments/expense"],
  paymentsOrder: ["/api/v1/finance/payments/order/", "/api/v1/finance/payments/order"],
  paymentsPurchase: ["/api/v1/finance/payments/purchase/", "/api/v1/finance/payments/purchase"],
  paymentsSalary: ["/api/v1/finance/payments/salary/", "/api/v1/finance/payments/salary"],
  employees: ["/api/v1/partners/employees/"],
  exchangeRates: EXCHANGE_RATE_ENDPOINTS,
}

type ApiRow = Record<string, unknown>
type PaginatedEnvelope = {
  results?: unknown[]
  items?: unknown[]
  rows?: unknown[]
  data?: unknown[]
  count?: unknown
  next?: unknown
}

export type FinanceLookupOption = {
  id: string
  name: string
}

function asArray(data: unknown): ApiRow[] {
  if (Array.isArray(data)) return data as ApiRow[]
  if (typeof data === "object" && data !== null) {
    const x = data as { results?: unknown[]; items?: unknown[]; rows?: unknown[]; data?: unknown[] }
    if (Array.isArray(x.results)) return x.results as ApiRow[]
    if (Array.isArray(x.items)) return x.items as ApiRow[]
    if (Array.isArray(x.rows)) return x.rows as ApiRow[]
    if (Array.isArray(x.data)) return x.data as ApiRow[]
  }
  return []
}

function n(v: unknown) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function s(v: unknown) {
  return String(v ?? "")
}

function mapEntryType(v: unknown): FinanceEntry["entryType"] {
  const t = s(v).toUpperCase()
  if (t === "INCOME") return "INCOME"
  if (t === "EXPENSE") return "EXPENSE"
  return "ADJUSTMENT"
}

function mapPayment(v: unknown): FinanceEntry["paymentMethod"] {
  const t = s(v).toUpperCase()
  if (t.includes("BANK")) return "BANK"
  if (t.includes("CARD")) return "CARD"
  return "CASH"
}

function mapCurrency(v: unknown): FinanceEntry["currency"] {
  const t = s(v).toUpperCase()
  if (t === "UZS" || t === "USD" || t === "EUR" || t === "RUB") return t as FinanceEntry["currency"]
  return "UZS"
}

function toIsoDate(v: unknown) {
  const raw = s(v)
  if (!raw) return new Date().toISOString().slice(0, 10)
  return raw.slice(0, 10)
}

function toBackendDateTime(v: unknown) {
  const raw = s(v).trim()
  if (!raw) return new Date().toISOString()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00`
  return raw
}

function unwrapPaymentResponse(data: unknown) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const row = (data as { payment?: unknown }).payment
    if (row && typeof row === "object" && !Array.isArray(row)) return row as ApiRow
  }
  return (data as ApiRow) || {}
}

function toRefString(refType: unknown, refId: unknown) {
  const t = s(refType)
  const id = s(refId)
  if (!t && !id) return undefined
  if (!id) return t
  if (!t) return `#${id}`
  return `${t} #${id}`
}

function normalizeLedgerRow(x: ApiRow, idx: number): FinanceEntry {
  const refType = x.ref_type ?? x.reference_type
  const refId = x.ref_id ?? x.reference_id
  return {
    id: s(x.id ?? `LEDGER-${idx}`),
    date: toIsoDate(x.occurred_on ?? x.date ?? x.created_at),
    createdAt: s(x.created_at ?? x.occurred_on ?? x.date ?? ""),
    updatedAt: s(x.updated_at ?? ""),
    entryType: mapEntryType(x.entry_type),
    category: s(x.category ?? "OTHER"),
    amount: n(x.amount),
    currency: mapCurrency(x.currency),
    paymentMethod: mapPayment(x.method),
    referenceType: refType ? s(refType) : undefined,
    referenceId: refId ? s(refId) : undefined,
    reference: toRefString(refType, refId),
    notes: x.note ? s(x.note) : undefined,
  }
}

function normalizePaymentRow(x: ApiRow, idx: number): FinanceEntry {
  const refType = x.ref_type
  const refId = x.ref_id
  return {
    id: s(x.id ?? `PAY-${idx}`),
    date: s(x.paid_at ?? x.occurred_on ?? x.created_at ?? new Date().toISOString()),
    createdAt: s(x.created_at ?? x.paid_at ?? x.occurred_on ?? ""),
    updatedAt: s(x.updated_at ?? ""),
    entryType: "EXPENSE",
    category: "PAYMENT",
    amount: n(x.amount),
    currency: mapCurrency(x.currency),
    paymentMethod: mapPayment(x.method),
    referenceType: refType ? s(refType) : undefined,
    referenceId: refId ? s(refId) : undefined,
    reference: toRefString(refType, refId),
    notes: x.note ? s(x.note) : undefined,
  }
}

function normalizeEmployee(x: ApiRow, idx: number): Employee {
  return {
    id: s(x.id ?? `EMP-${idx}`),
    fullName: s(x.full_name ?? x.name ?? "-"),
    role: s(x.position ?? x.role ?? "-"),
    phone: x.phone ? s(x.phone) : undefined,
    baseSalary: n(x.base_salary ?? x.salary ?? 0),
    currency: mapCurrency(x.currency),
  }
}

function normalizeExchangeRateRow(x: ApiRow, idx: number): ExchangeRate {
  const rate = n(x.rate ?? x.exchange_rate ?? x.value ?? x.amount ?? x.sell_rate ?? x.buy_rate)
  const date = toIsoDate(x.date ?? x.rate_date ?? x.effective_date ?? x.occurred_on ?? x.created_at)
  const activeFromStatus = s(x.status).toUpperCase()
  const isActive =
    typeof x.is_active === "boolean"
      ? Boolean(x.is_active)
      : activeFromStatus === "ACTIVE" ||
        activeFromStatus === "FAOL" ||
        activeFromStatus === "CURRENT" ||
        idx === 0

  return {
    id: s(x.id ?? `RATE-${idx}`),
    currency: mapCurrency(x.currency ?? x.base_currency ?? "USD"),
    rate,
    date,
    source: s(x.source ?? x.provider ?? x.note ?? "Manual") || "Manual",
    status: s(x.status ?? (isActive ? "Faol" : "Arxiv")) || (isActive ? "Faol" : "Arxiv"),
    isActive,
    createdAt: s(x.created_at ?? ""),
    updatedAt: s(x.updated_at ?? ""),
  }
}

function errorText(e: any) {
  const data = e?.response?.data
  if (typeof data === "string") return data
  if (data?.detail) return String(data.detail)
  if (data && typeof data === "object") return JSON.stringify(data)
  return String(e?.message || "Xatolik")
}

function createEntriesReadOnlyError() {
  return new Error("Finance / Entries backend contract is read-only. Create, update, and delete are not supported.")
}

function createPostingUpdateUnsupportedError() {
  return new Error("Finance / Postings backend contract does not support posting updates.")
}

function createPostingCreateUnsupportedError() {
  return new Error("Finance / Postings supports only documented order, purchase, salary, advance, and expense create endpoints.")
}

function isHtmlDocumentPayload(data: unknown, contentType?: unknown) {
  const type = String(contentType || "").toLowerCase()
  if (type.includes("text/html")) return true

  if (typeof data !== "string") return false
  const normalized = data.trim().toLowerCase()
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html")
}

function isNotFoundError(error: any) {
  return Number(error?.response?.status || 0) === 404
}

function markExchangeRateEndpointsUnavailable() {
  exchangeRateEndpointUnavailableUntil = Date.now() + EXCHANGE_RATE_RETRY_DELAY_MS
  cachedExchangeRateReadEndpoint = null
  cachedExchangeRateWriteEndpoint = null
}

function canRetryExchangeRateDiscovery() {
  return Date.now() >= exchangeRateEndpointUnavailableUntil
}

async function getExchangeRateData(params?: Record<string, unknown>) {
  if (cachedExchangeRateReadEndpoint) {
    try {
      const response = await api.get(cachedExchangeRateReadEndpoint, params ? { params } : undefined)
      const data = response.data
      if (isHtmlDocumentPayload(data, response.headers?.["content-type"])) {
        cachedExchangeRateReadEndpoint = null
      } else {
        return data
      }
    } catch (e: any) {
      if (!isNotFoundError(e)) throw e
      cachedExchangeRateReadEndpoint = null
    }
  }

  if (!canRetryExchangeRateDiscovery()) {
    return []
  }

  let lastErr: unknown = null
  for (const url of EP.exchangeRates) {
    try {
      const response = await api.get(url, params ? { params } : undefined)
      const data = response.data
      if (isHtmlDocumentPayload(data, response.headers?.["content-type"])) {
        lastErr = new Error(`Invalid HTML response from ${url}`)
        continue
      }
      cachedExchangeRateReadEndpoint = url
      cachedExchangeRateWriteEndpoint = url
      exchangeRateEndpointUnavailableUntil = 0
      return data
    } catch (e: any) {
      if (!isNotFoundError(e)) throw e
      lastErr = e
    }
  }

  markExchangeRateEndpointsUnavailable()
  if (lastErr) throw lastErr
  return []
}

function asCount(data: unknown) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null
  const count = Number((data as PaginatedEnvelope).count)
  return Number.isFinite(count) ? count : null
}

function asNext(data: unknown) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null
  const next = (data as PaginatedEnvelope).next
  return typeof next === "string" && next ? next : null
}

async function getFirst(urls: string[], params?: Record<string, unknown>) {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const response = await api.get(url, params ? { params } : undefined)
      const data = response.data
      if (isHtmlDocumentPayload(data, response.headers?.["content-type"])) {
        lastErr = new Error(`Invalid HTML response from ${url}`)
        continue
      }
      return data
    } catch (e: any) {
      const status = Number(e?.response?.status || 0)
      if (status !== 404) throw e
      lastErr = e
    }
  }
  if (lastErr) throw lastErr
  return null
}

async function getAllPages(urls: string[], params?: Record<string, unknown>, options?: { includePageSize?: boolean }) {
  let lastErr: unknown = null
  const includePageSize = options?.includePageSize !== false

  for (const url of urls) {
    try {
      const rows: ApiRow[] = []
      let page = 1
      let hasNext = true

      while (hasNext) {
        const response = await api.get(url, {
          params: {
            ...(params || {}),
            page,
            ...(includePageSize ? { page_size: 200 } : {}),
          },
        })
        const data = response.data
        if (isHtmlDocumentPayload(data, response.headers?.["content-type"])) {
          throw new Error(`Invalid HTML response from ${url}`)
        }

        const chunk = asArray(data)
        rows.push(...chunk)

        const next = asNext(data)
        const count = asCount(data)

        if (next) {
          page += 1
          continue
        }
        if (count !== null && rows.length < count) {
          page += 1
          continue
        }
        if (!chunk.length && page === 1) {
          return []
        }
        hasNext = false
      }

      return rows
    } catch (e: any) {
      const status = Number(e?.response?.status || 0)
      if (status !== 404) throw e
      lastErr = e
    }
  }

  if (lastErr) throw lastErr
  return []
}

async function postFirst(urls: string[], payload: Record<string, unknown>) {
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

async function exchangeRatePost(payload: ExchangeRateInput) {
  const body = {
    currency: payload.currency,
    rate: Math.trunc(n(payload.rate)),
    date: payload.date,
    source: payload.source ?? "Manual",
  }

  if (cachedExchangeRateWriteEndpoint) {
    try {
      const { data } = await api.post(cachedExchangeRateWriteEndpoint, body)
      return data
    } catch (e: any) {
      if (!isNotFoundError(e)) throw e
      cachedExchangeRateWriteEndpoint = null
    }
  }

  if (!canRetryExchangeRateDiscovery()) {
    throw new Error("Exchange rate endpoint topilmadi")
  }

  let lastErr: unknown = null
  for (const url of EP.exchangeRates) {
    try {
      const { data } = await api.post(url, body)
      cachedExchangeRateReadEndpoint = url
      cachedExchangeRateWriteEndpoint = url
      exchangeRateEndpointUnavailableUntil = 0
      return data
    } catch (e: any) {
      if (!isNotFoundError(e)) throw e
      lastErr = e
    }
  }

  markExchangeRateEndpointsUnavailable()
  if (lastErr) throw lastErr
  throw new Error("Exchange rate endpoint topilmadi")
}

async function patchFirst(urls: string[], payload: Record<string, unknown>) {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const { data } = await api.patch(url, payload)
      return data
    } catch (e: any) {
      const status = Number(e?.response?.status || 0)
      if (status !== 404 && status !== 405) throw e
      try {
        const { data } = await api.put(url, payload)
        return data
      } catch (e2: any) {
        const status2 = Number(e2?.response?.status || 0)
        if (status2 !== 404) throw e2
        lastErr = e2
      }
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Update endpoint topilmadi")
}

async function deleteFirst(urls: string[]) {
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
}

function toBackendMethod(v: FinanceEntry["paymentMethod"] | undefined) {
  if (v === "BANK") return "BANK_TRANSFER"
  if (v === "CARD") return "CARD"
  return "CASH"
}

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function downloadBlobFile(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export const financeClient = {
  async listPostings(): Promise<FinanceEntry[]> {
    const data = await getAllPages(EP.payments, undefined, { includePageSize: false })
    return asArray(data).map(normalizePaymentRow).filter((x) => x.amount > 0)
  },

  async readPosting(id: string): Promise<FinanceEntry> {
    try {
      const fallback = (await this.listPostings()).find((row) => String(row.id) === String(id))
      if (fallback) return fallback
      throw new Error("Posting not found")
    } catch (e: any) {
      throw new Error(errorText(e))
    }
  },

  async createPosting(payload: {
    referenceType?: string
    referenceId?: string | number | null
    paymentMethod?: FinanceEntry["paymentMethod"]
    amount: number
    currency: FinanceEntry["currency"]
    notes?: string | null
    date?: string
  }) {
    try {
      const refType = s(payload.referenceType).toUpperCase()
      const canonicalDate = payload.date ? toIsoDate(payload.date) : undefined
      if (refType === "ORDER") {
        const data = await postFirst(EP.paymentsOrder, {
          order_id: Number(payload.referenceId),
          method: toBackendMethod(payload.paymentMethod),
          amount: Math.trunc(n(payload.amount)),
          occurred_on: canonicalDate,
          note: payload.notes ?? "",
        })
        const created = normalizePaymentRow(unwrapPaymentResponse(data), 0)
        financeEvents.emit()
        return created
      }
      if (refType === "PURCHASE") {
        const data = await postFirst(EP.paymentsPurchase, {
          purchase_id: Number(payload.referenceId),
          method: toBackendMethod(payload.paymentMethod),
          amount: Math.trunc(n(payload.amount)),
          occurred_on: canonicalDate,
          note: payload.notes ?? "",
        })
        const created = normalizePaymentRow(unwrapPaymentResponse(data), 0)
        financeEvents.emit()
        return created
      }
      if (refType === "SALARY") {
        const data = await postFirst(EP.paymentsSalary, {
          employee_id: Number(payload.referenceId),
          method: toBackendMethod(payload.paymentMethod),
          amount: Math.trunc(n(payload.amount)),
          occurred_on: canonicalDate,
          note: payload.notes ?? "",
        })
        const created = normalizePaymentRow(unwrapPaymentResponse(data), 0)
        financeEvents.emit()
        return created
      }
      if (refType === "EMPLOYEE") {
        return await this.payAdvance({
          employeeId: Number(payload.referenceId),
          method: payload.paymentMethod ?? "CASH",
          amount: payload.amount,
          currency: payload.currency,
          occurredOn: canonicalDate,
          note: payload.notes ?? "",
        })
      }
      throw createPostingCreateUnsupportedError()
    } catch (e: any) {
      throw new Error(errorText(e))
    }
  },

  async listEntries(): Promise<FinanceEntry[]> {
    const data = await getAllPages(EP.ledger, undefined, { includePageSize: false })
    return asArray(data).map(normalizeLedgerRow).filter((x) => x.amount >= 0)
  },

  async createEntry(payload: Omit<FinanceEntry, "id">): Promise<FinanceEntry> {
    void payload
    throw createEntriesReadOnlyError()
  },

  async updateEntry(id: string, payload: Partial<Omit<FinanceEntry, "id">>): Promise<FinanceEntry> {
    void id
    void payload
    throw createEntriesReadOnlyError()
  },

  async deleteEntry(id: string): Promise<void> {
    void id
    throw createEntriesReadOnlyError()
  },

  async readEntry(id: string): Promise<FinanceEntry> {
    try {
      const data = await getFirst(EP.ledger.map((x) => `${x}${id}/`))
      return normalizeLedgerRow((data as ApiRow) || { id }, 0)
    } catch (e: any) {
      const status = Number(e?.response?.status || 0)
      if (status === 404 || status === 405) {
        const fallback = (await this.listEntries()).find((row) => String(row.id) === String(id))
        if (fallback) return fallback
      }
      throw new Error(errorText(e))
    }
  },

  async exportEntries(): Promise<void> {
    const filename = `finance_ledger_${new Date().toISOString().slice(0, 10)}.csv`
    const rows = await this.listEntries()
    const lines = [
      ["ID", "Date", "Type", "Category", "Amount", "Currency", "Method", "Reference Type", "Reference ID", "Reference", "Notes"].join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.date,
          row.entryType,
          row.category,
          row.amount,
          row.currency,
          row.paymentMethod,
          row.referenceType ?? "",
          row.referenceId ?? "",
          row.reference ?? "",
          row.notes ?? "",
        ]
          .map(escapeCsvValue)
          .join(",")
      ),
    ]
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" })
    downloadBlobFile(blob, filename)
  },

  async updatePosting(id: string, payload: {
    paymentMethod?: FinanceEntry["paymentMethod"]
    amount?: number
    currency?: FinanceEntry["currency"]
    notes?: string | null
    date?: string
  }) {
    void id
    void payload
    throw createPostingUpdateUnsupportedError()
  },

  async deletePosting(id: string): Promise<void> {
    try {
      await deleteFirst(EP.payments.map((x) => `${x}${id}/`))
      financeEvents.emit()
    } catch (e: any) {
      throw new Error(errorText(e))
    }
  },

  async listEmployees(): Promise<Employee[]> {
    const { data } = await api.get("/api/v1/partners/employees/", {
      params: { page_size: 500, ordering: "full_name" },
    })
    return asArray(data).map(normalizeEmployee)
  },

  async listClientOptions(): Promise<FinanceLookupOption[]> {
    try {
      const clients = await apiAxios.listClientsPage({
        page: 1,
        page_size: 500,
        ordering: "name",
        is_active: true,
      })
      return clients.items.map((row, idx) => ({
        id: String(row.id || `Client-${idx}`),
        name: String(row.name || row.code || `Client #${idx + 1}`),
      }))
    } catch (e: any) {
      throw new Error(errorText(e))
    }
  },

  async listSupplierOptions(): Promise<FinanceLookupOption[]> {
    try {
      const suppliers = await apiAxios.listSuppliersPage({
        page: 1,
        page_size: 500,
        ordering: "name",
        is_active: true,
      })
      return suppliers.items.map((row, idx) => ({
        id: String(row.id || `Supplier-${idx}`),
        name: String(row.name || row.company || `Supplier #${idx + 1}`),
      }))
    } catch (e: any) {
      throw new Error(errorText(e))
    }
  },

  async listEmployeeOptions(): Promise<FinanceLookupOption[]> {
    const rows = await this.listEmployees()
    return rows.map((row, idx) => ({
      id: row.id || `Employee-${idx}`,
      name: row.fullName || `Employee #${idx + 1}`,
    }))
  },

  async createEmployee(payload: Omit<Employee, "id">): Promise<Employee> {
    const body = {
      full_name: payload.fullName,
      position: payload.role,
      phone: payload.phone,
      base_salary: payload.baseSalary,
      currency: payload.currency,
    }
    const data = await postFirst(EP.employees, body)
    return normalizeEmployee((data as ApiRow) || body, 0)
  },

  async listExchangeRates(): Promise<ExchangeRate[]> {
    return []
  },

  async createExchangeRate(payload: ExchangeRateInput): Promise<ExchangeRate> {
    void payload
    throw new Error("Exchange rate endpoint backendda mavjud emas.")
  },

  async payOrder(payload: {
    orderId: number
    amount: number
    currency: Currency
    method: FinanceEntry["paymentMethod"]
    occurredOn?: string
    note?: string
  }) {
      const body = {
        order_id: payload.orderId,
        method: toBackendMethod(payload.method),
        amount: Math.trunc(n(payload.amount)),
        occurred_on: payload.occurredOn ? toIsoDate(payload.occurredOn) : undefined,
        note: payload.note ?? "",
      }
      const result = await postFirst(EP.paymentsOrder, body)
      financeEvents.emit()
      return result
  },

  async payPurchase(payload: {
    purchaseId: number
    amount: number
    currency: Currency
    method: FinanceEntry["paymentMethod"]
    occurredOn?: string
    note?: string
  }) {
      const body = {
        purchase_id: payload.purchaseId,
        method: toBackendMethod(payload.method),
        amount: Math.trunc(n(payload.amount)),
        occurred_on: payload.occurredOn ? toIsoDate(payload.occurredOn) : undefined,
        note: payload.note ?? "",
      }
      const result = await postFirst(EP.paymentsPurchase, body)
      financeEvents.emit()
      return result
  },

  async paySalary(payload: {
    employeeId: number
    amount: number
    currency: Currency
    method: FinanceEntry["paymentMethod"]
    occurredOn?: string
    note?: string
    paymentType?: "AVANS" | "OYLIK" | "BONUS"
  }) {
      if (payload.paymentType === "AVANS") {
        const body = {
          employee_id: payload.employeeId,
          method: toBackendMethod(payload.method),
          amount: Math.trunc(n(payload.amount)),
          occurred_on: payload.occurredOn ? toIsoDate(payload.occurredOn) : undefined,
          note: payload.note ?? "",
        }
        const result = await postFirst(EP.paymentsAdvance, body)
        financeEvents.emit()
        return result
      }
      const body = {
        employee_id: payload.employeeId,
        method: toBackendMethod(payload.method),
        amount: Math.trunc(n(payload.amount)),
        occurred_on: payload.occurredOn ? toIsoDate(payload.occurredOn) : undefined,
        note: payload.note ?? "",
      }
      const result = await postFirst(EP.paymentsSalary, body)
      financeEvents.emit()
      return result
  },

  async payAdvance(payload: {
    employeeId: number
    amount: number
    currency: Currency
    method: FinanceEntry["paymentMethod"]
    occurredOn?: string
    note?: string
  }) {
      const body = {
        employee_id: payload.employeeId,
        method: toBackendMethod(payload.method),
        amount: Math.trunc(n(payload.amount)),
        occurred_on: payload.occurredOn ? toIsoDate(payload.occurredOn) : undefined,
        note: payload.note ?? "",
      }
      const result = await postFirst(EP.paymentsAdvance, body)
      financeEvents.emit()
      return result
  },

  async payExpense(payload: {
    category: "SALARY" | "RAW_MATERIAL" | "UTILITIES" | "RENT" | "TRANSPORT" | "REPAIR" | "TAX" | "MARKETING" | "OFFICE" | "OTHER"
    amount: number
    currency: Currency
    method: FinanceEntry["paymentMethod"]
    occurredOn?: string
    note?: string
  }) {
      const body = {
        category: payload.category,
        method: toBackendMethod(payload.method),
        amount: Math.trunc(n(payload.amount)),
        occurred_on: payload.occurredOn ? toIsoDate(payload.occurredOn) : undefined,
        note: payload.note ?? "",
      }
      const result = await postFirst(EP.paymentsExpense, body)
      financeEvents.emit()
      return result
  },
}
