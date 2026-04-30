import { http } from "@/shared/http"
import { financeClient } from "../../shared/financeClient"
import { fetchAllFinanceDebtRows, type FinanceDebtPartyApiRow } from "../../shared/debtsApi"
import type { Employee, FinanceEntry } from "../../shared/types"

export type FinanceDashboardQuery = {
  range: string
  search?: string
}

export type FinanceDashboardSummary = {
  currency: string
  income_total: number
  expense_total: number
  net: number
  top_categories: Array<{ entry_type: string; category: string; total: number }>
  recent: Array<{
    id: number | string
    entry_type: string
    category: string
    amount: number
    currency: string
    method: string
    occurred_on: string
    ref_type?: string | null
    ref_id?: string | number | null
  }>
}

export type FinanceDebtRow = FinanceDebtPartyApiRow

export type FinanceActivity = {
  id: string
  source: "LEDGER" | "PAYMENT"
  direction: "INCOME" | "EXPENSE"
  amount: number
  signedAmount: number
  currency: string
  method: "BANK" | "CARD" | "CASH"
  category: string
  title: string
  date: string
  referenceType?: string
  referenceId?: string | null
  referenceLabel?: string
  notes?: string | null
}

export type FinanceDashboardResponse = {
  summary: FinanceDashboardSummary
  clientsDebts: FinanceDebtRow[]
  suppliersDebts: FinanceDebtRow[]
  activities: FinanceActivity[]
  employees: Employee[]
  period: {
    date_from: string
    date_to: string
    label: string
    days: number
  }
  sourceStatus: Array<{ key: string; label: string; ok: boolean }>
  warnings: string[]
}

const SUMMARY_ENDPOINTS = [
  "/api/v1/finance/dashboard/summary/",
  "/api/v1/finance/dashboard/summary",
  "/api/v1/dashboard/finance/summary/",
  "/api/v1/dashboard/finance/summary",
]
const CLIENT_DEBT_ENDPOINTS = [
  "/api/v1/finance/dashboard/debts/clients/",
  "/api/v1/finance/dashboard/debts/clients",
]
const SUPPLIER_DEBT_ENDPOINTS = [
  "/api/v1/finance/dashboard/debts/suppliers/",
  "/api/v1/finance/dashboard/debts/suppliers",
]

function n(v: unknown) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function s(v: unknown) {
  return String(v ?? "")
}

function errorText(e: any) {
  const data = e?.response?.data
  if (typeof data === "string") return data
  if (data?.detail) return String(data.detail)
  if (data && typeof data === "object") return JSON.stringify(data)
  return String(e?.message || "Error")
}

async function getFirst<T>(urls: string[], params?: Record<string, unknown>) {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      return await http.get<T>(url, params)
    } catch (e: any) {
      const status = Number(e?.response?.status || 0)
      if (status !== 404) throw e
      lastErr = e
    }
  }
  if (lastErr) throw lastErr
  return null
}

function fmtDate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function daysBetween(from: Date, to: Date) {
  const diff = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.max(1, Math.floor(diff / 86400000) + 1)
}

function buildRange(range: string) {
  const now = new Date()
  const date_to = fmtDate(now)
  const fromDate = new Date(now)
  const key = s(range).toUpperCase()

  if (key === "BUGUN") {
    return { date_from: date_to, date_to, label: "Today", days: 1 }
  }
  if (key === "HAFTA") {
    fromDate.setDate(now.getDate() - 6)
    return {
      date_from: fmtDate(fromDate),
      date_to,
      label: "Last 7 days",
      days: 7,
    }
  }
  if (key === "YIL") {
    fromDate.setFullYear(now.getFullYear() - 1)
    return {
      date_from: fmtDate(fromDate),
      date_to,
      label: "Last 12 months",
      days: daysBetween(fromDate, now),
    }
  }

  fromDate.setMonth(now.getMonth() - 1)
  return {
    date_from: fmtDate(fromDate),
    date_to,
    label: "Last 30 days",
    days: daysBetween(fromDate, now),
  }
}

function isWithinRange(dateValue: string, date_from: string, date_to: string) {
  const value = s(dateValue).slice(0, 10)
  if (!value) return false
  return value >= date_from && value <= date_to
}

function normalizeSearch(value?: string) {
  return s(value).trim().toLowerCase()
}

function includesSearch(parts: unknown[], search: string) {
  if (!search) return true
  return parts.some((part) => s(part).toLowerCase().includes(search))
}

function derivePostingDirection(entry: FinanceEntry): "INCOME" | "EXPENSE" {
  const refType = s(entry.referenceType).toUpperCase()
  const notes = s(entry.notes).toUpperCase()

  if (refType.includes("CLIENT") || refType.includes("ORDER") || refType.includes("SALE")) {
    return "INCOME"
  }
  if (
    refType.includes("SUPPLIER") ||
    refType.includes("PURCHASE") ||
    refType.includes("EMPLOYEE") ||
    refType.includes("SALARY")
  ) {
    return "EXPENSE"
  }
  if (notes.includes("AVANS") || notes.includes("OYLIK") || notes.includes("BONUS")) {
    return "EXPENSE"
  }
  return entry.entryType === "INCOME" ? "INCOME" : "EXPENSE"
}

function toActivity(entry: FinanceEntry, source: "LEDGER" | "PAYMENT"): FinanceActivity {
  const direction =
    source === "PAYMENT"
      ? derivePostingDirection(entry)
      : entry.entryType === "INCOME"
        ? "INCOME"
        : "EXPENSE"
  const referenceLabel = s(entry.reference || entry.referenceType).trim() || undefined
  const title =
    source === "PAYMENT"
      ? referenceLabel || "Bank operation"
      : s(entry.category).trim() || referenceLabel || "Cash entry"

  return {
    id: s(entry.id),
    source,
    direction,
    amount: n(entry.amount),
    signedAmount: direction === "EXPENSE" ? -n(entry.amount) : n(entry.amount),
    currency: s(entry.currency || "UZS"),
    method: entry.paymentMethod || "CASH",
    category: s(entry.category || "OTHER"),
    title,
    date: s(entry.date || entry.createdAt || new Date().toISOString()).slice(0, 10),
    referenceType: entry.referenceType || undefined,
    referenceId: entry.referenceId || null,
    referenceLabel,
    notes: entry.notes || null,
  }
}

function buildSummaryFromActivities(activities: FinanceActivity[], currency = "UZS"): FinanceDashboardSummary {
  const grouped = new Map<string, { entry_type: string; category: string; total: number }>()
  const income_total = activities
    .filter((item) => item.direction === "INCOME")
    .reduce((sum, item) => sum + item.amount, 0)
  const expense_total = activities
    .filter((item) => item.direction === "EXPENSE")
    .reduce((sum, item) => sum + item.amount, 0)

  activities.forEach((item) => {
    const key = `${item.direction}:${item.category}`
    const existing = grouped.get(key)
    if (existing) {
      existing.total += item.amount
      return
    }
    grouped.set(key, {
      entry_type: item.direction,
      category: item.category || "OTHER",
      total: item.amount,
    })
  })

  return {
    currency,
    income_total,
    expense_total,
    net: income_total - expense_total,
    top_categories: Array.from(grouped.values()).sort((a, b) => b.total - a.total).slice(0, 8),
    recent: activities.slice(0, 10).map((item) => ({
      id: item.id,
      entry_type: item.direction,
      category: item.category,
      amount: item.amount,
      currency: item.currency,
      method: item.method,
      occurred_on: item.date,
      ref_type: item.referenceType || null,
      ref_id: item.referenceId || null,
    })),
  }
}

function mergeSummary(rawSummary: FinanceDashboardSummary | null, activities: FinanceActivity[]): FinanceDashboardSummary {
  const fallback = buildSummaryFromActivities(activities, s(rawSummary?.currency || activities[0]?.currency || "UZS"))
  if (!rawSummary) return fallback

  const top_categories =
    Array.isArray(rawSummary.top_categories) && rawSummary.top_categories.length
      ? rawSummary.top_categories
      : fallback.top_categories

  return {
    currency: s(rawSummary.currency || fallback.currency),
    income_total: n(rawSummary.income_total),
    expense_total: n(rawSummary.expense_total),
    net: n(rawSummary.net || n(rawSummary.income_total) - n(rawSummary.expense_total)),
    top_categories,
    recent: fallback.recent,
  }
}

function matchesDebtRow(row: FinanceDebtRow, search: string) {
  return includesSearch(
    [row.client_name, row.supplier_name, row.client_id, row.supplier_id, row.total, row.paid, row.debt],
    search
  )
}

function matchesEmployee(row: Employee, search: string) {
  return includesSearch([row.id, row.fullName, row.role, row.phone], search)
}

function matchesActivity(item: FinanceActivity, search: string) {
  return includesSearch(
    [
      item.id,
      item.title,
      item.category,
      item.referenceLabel,
      item.referenceType,
      item.method,
      item.notes,
      item.source,
    ],
    search
  )
}

export const financeApi = {
  async getDashboard(query: FinanceDashboardQuery): Promise<FinanceDashboardResponse> {
    try {
      const period = buildRange(query.range)
      const search = normalizeSearch(query.search)

      const [summaryResult, clientsDebtResult, suppliersDebtResult, ledgerResult, paymentsResult, employeesResult] = await Promise.allSettled([
        getFirst<FinanceDashboardSummary>(SUMMARY_ENDPOINTS, {
          date_from: period.date_from,
          date_to: period.date_to,
          currency: "UZS",
        }),
        fetchAllFinanceDebtRows(CLIENT_DEBT_ENDPOINTS),
        fetchAllFinanceDebtRows(SUPPLIER_DEBT_ENDPOINTS),
        financeClient.listEntries(),
        financeClient.listPostings(),
        financeClient.listEmployees(),
      ])

      const rawSummary = summaryResult.status === "fulfilled" ? summaryResult.value : null
      const rawLedger = ledgerResult.status === "fulfilled" ? ledgerResult.value : []
      const rawPayments = paymentsResult.status === "fulfilled" ? paymentsResult.value : []
      const rawEmployees = employeesResult.status === "fulfilled" ? employeesResult.value : []
      const clientDebtRows = clientsDebtResult.status === "fulfilled" ? clientsDebtResult.value : []
      const supplierDebtRows = suppliersDebtResult.status === "fulfilled" ? suppliersDebtResult.value : []

      const activities = [...rawLedger.map((row) => toActivity(row, "LEDGER")), ...rawPayments.map((row) => toActivity(row, "PAYMENT"))]
        .filter((item) => isWithinRange(item.date, period.date_from, period.date_to))
        .filter((item) => matchesActivity(item, search))
        .sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`))

      const clientsDebts = clientDebtRows.filter((row) => matchesDebtRow(row, search))
      const suppliersDebts = supplierDebtRows.filter((row) => matchesDebtRow(row, search))
      const employees = rawEmployees.filter((row) => matchesEmployee(row, search))
      const summary = search
        ? buildSummaryFromActivities(activities, s(rawSummary?.currency || "UZS"))
        : mergeSummary(rawSummary, activities)
      const sourceStatus = [
        { key: "summary", label: "Summary", ok: summaryResult.status === "fulfilled" },
        { key: "clientsDebts", label: "Client debt", ok: clientsDebtResult.status === "fulfilled" },
        { key: "suppliersDebts", label: "Supplier debt", ok: suppliersDebtResult.status === "fulfilled" },
        { key: "ledger", label: "Cash", ok: ledgerResult.status === "fulfilled" },
        { key: "payments", label: "Bank", ok: paymentsResult.status === "fulfilled" },
        { key: "employees", label: "Employees", ok: employeesResult.status === "fulfilled" },
      ]
      const warnings = sourceStatus
        .filter((item) => !item.ok)
        .map((item) => `${item.label} endpoint did not respond`)

      if (!rawSummary && activities.length === 0 && employees.length === 0 && clientDebtRows.length === 0 && supplierDebtRows.length === 0) {
        throw new Error("No finance dashboard data was returned from the backend")
      }

      return {
        summary,
        clientsDebts,
        suppliersDebts,
        activities,
        employees,
        period,
        sourceStatus,
        warnings,
      }
    } catch (e: any) {
      throw new Error(errorText(e))
    }
  },
}
