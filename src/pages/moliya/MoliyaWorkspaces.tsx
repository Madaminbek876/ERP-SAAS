import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Download, Landmark, Plus, Receipt, TrendingUp, Users } from "lucide-react"
import { toast } from "react-toastify"
import TablePagination from "@/components/common/TablePagination"
import { useClientPagination } from "@/components/common/useClientPagination"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n, type LanguageCode } from "@/i18n"
import { fetchAllFinanceDebtRows, type FinanceDebtPartyApiRow } from "./shared/debtsApi"
import { financeClient, type FinanceLookupOption } from "./shared/financeClient"
import type { ExchangeRate, ExchangeRateInput, FinanceEntry } from "./shared/types"
import { http } from "@/shared/http"
import MoliyaClientDebtsPage from "./Debts/MoliyaClientDebtsPage"

type StatItem = {
  label: string
  value: string
  tone?: "blue" | "emerald" | "amber"
}

type CashFormState = {
  entryType: FinanceEntry["entryType"]
  amount: string
  currency: FinanceEntry["currency"]
  paymentMethod: FinanceEntry["paymentMethod"]
  date: string
  targetKind: "CLIENT" | "SUPPLIER" | "EMPLOYEE"
  targetId: string
  employeePaymentType: "AVANS" | "OYLIK" | "BONUS"
  notes: string
  category: string
  referenceType: string
  referenceId: string
}

type PostingFormState = {
  referenceType: string
  referenceId: string
  targetKind: "CLIENT" | "SUPPLIER" | "EMPLOYEE" | "ORDER" | "PURCHASE" | "SALARY"
  targetId: string
  employeePaymentType: "AVANS" | "OYLIK" | "BONUS"
  paymentMethod: FinanceEntry["paymentMethod"]
  amount: string
  currency: FinanceEntry["currency"]
  date: string
  notes: string
  category: string
}

type ExchangeRateFormState = {
  currency: ExchangeRateInput["currency"]
  rate: string
  date: string
  source: string
}

type PayrollPaymentFormState = {
  employeeId: string
  paymentType: "AVANS" | "OYLIK" | "BONUS"
  paymentMethod: FinanceEntry["paymentMethod"]
  amount: string
  currency: FinanceEntry["currency"]
  date: string
  note: string
}

type DebtCheckRow = FinanceDebtPartyApiRow

type OrderDebtCheckRow = {
  id?: number | string
  order_no?: string
  client_id?: number | string
  client_code?: string
  client_name?: string
  total?: number
  paid_amount?: number
  remaining?: number
}

type PurchaseLookupRow = {
  id?: number | string
  purchase_no?: string
  supplier_name?: string
}

type DebtPreviewRow = {
  id: string
  name: string
  paidSum: number
  debtSum: number
}

function extractDebtPartyId(row: DebtCheckRow, kind: "CLIENT" | "SUPPLIER") {
  const nestedValue = kind === "CLIENT" ? row.client : row.supplier
  const nestedId =
    typeof nestedValue === "object" && nestedValue !== null ? (nestedValue as { id?: number | string }).id : nestedValue
  return String((kind === "CLIENT" ? row.client_id : row.supplier_id) ?? row.id ?? nestedId ?? "").trim()
}

function normalizeMatchText(value: unknown) {
  return String(value || "")
    .replace(/[^0-9a-zA-Z\u0400-\u04FF]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function getPartyNameTokens(value: string) {
  const skip = new Set(["mchj", "ooo", "llc", "inc", "corp", "co", "ip"])
  return normalizeMatchText(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && !skip.has(item))
}

function getComparablePartyName(value: string) {
  const tokens = getPartyNameTokens(value)
  return tokens.length ? tokens.join(" ") : normalizeMatchText(value)
}

function isLoosePartyNameMatch(left: string, right: string) {
  const a = getComparablePartyName(left)
  const b = getComparablePartyName(right)
  if (!a || !b) return false
  return a === b
}

function sumMatchedPreviewDebt(rows: DebtPreviewRow[], refId: string, refName: string) {
  const comparableName = getComparablePartyName(refName)
  if (comparableName) {
    const exactNameMatches = rows.filter((row) => getComparablePartyName(row.name) === comparableName)
    if (exactNameMatches.length > 0) {
      return exactNameMatches.reduce((sum, row) => sum + toNum(row.debtSum), 0)
    }
  }

  const normalizedRefId = String(refId || "").trim()
  const exactIdMatches = normalizedRefId ? rows.filter((row) => String(row.id || "").trim() === normalizedRefId) : []
  if (exactIdMatches.length > 0) {
    return exactIdMatches.reduce((sum, row) => sum + toNum(row.debtSum), 0)
  }

  return 0
}

function extractDebtPartyName(row: DebtCheckRow, kind: "CLIENT" | "SUPPLIER") {
  return normalizeMatchText(kind === "CLIENT" ? row.client_name : row.supplier_name)
}

function toNum(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function mapDebtPreviewRows(rows: DebtCheckRow[], kind: "CLIENT" | "SUPPLIER") {
  return rows.map((row, idx) => {
    const id = extractDebtPartyId(row, kind) || `${kind}-${idx + 1}`
    const rawName = kind === "CLIENT" ? row.client_name : row.supplier_name
    return {
      id,
      name: String(rawName || `${kind === "CLIENT" ? "Client" : "Supplier"} #${idx + 1}`),
      paidSum: toNum(row.paid),
      debtSum: toNum(row.debt ?? Math.max(toNum(row.total) - toNum(row.paid), 0)),
    }
  })
}

function aggregateOrderPreviewRows(rows: OrderDebtCheckRow[]) {
  const map = new Map<string, DebtPreviewRow>()

  rows.forEach((row, idx) => {
    const id = String(row.client_id ?? row.client_code ?? row.client_name ?? `CLIENT-${idx + 1}`).trim()
    const name = String(row.client_name || `Client #${idx + 1}`)
    const existing = map.get(id)
    const nextPaid = toNum(row.paid_amount)
    const nextDebt = toNum(row.remaining ?? Math.max(toNum(row.total) - toNum(row.paid_amount), 0))

    if (existing) {
      existing.paidSum += nextPaid
      existing.debtSum += nextDebt
      if (existing.name.length < name.length) existing.name = name
      return
    }

    map.set(id, {
      id,
      name,
      paidSum: nextPaid,
      debtSum: nextDebt,
    })
  })

  return Array.from(map.values())
}

function mergeDebtPreviewRows(baseRows: DebtPreviewRow[], extraRows: DebtPreviewRow[]) {
  const map = new Map<string, DebtPreviewRow>()

  baseRows.forEach((row) => {
    map.set(row.id, { ...row })
  })

  extraRows.forEach((row) => {
    const existing = map.get(row.id)
    if (!existing) {
      map.set(row.id, { ...row })
      return
    }

    map.set(row.id, {
      ...existing,
      name: row.name || existing.name,
      paidSum: Math.max(toNum(existing.paidSum), toNum(row.paidSum)),
      debtSum: Math.max(toNum(existing.debtSum), toNum(row.debtSum)),
    })
  })

  return Array.from(map.values())
}

function dedupePreviewRows(rows: DebtPreviewRow[]) {
  const map = new Map<string, DebtPreviewRow>()

  rows.forEach((row, idx) => {
    const idKey = String(row.id || "").trim()
    const nameKey = normalizeMatchText(row.name)
    const key = idKey || nameKey || `row-${idx}`
    const existing = map.get(key)

    if (existing) {
      existing.paidSum += toNum(row.paidSum)
      existing.debtSum += toNum(row.debtSum)
      if (existing.name.length < row.name.length) existing.name = row.name
      return
    }

    const sameName = nameKey ? Array.from(map.values()).find((value) => normalizeMatchText(value.name) === nameKey) : null
    if (sameName) {
      sameName.paidSum += toNum(row.paidSum)
      sameName.debtSum += toNum(row.debtSum)
      if (sameName.name.length < row.name.length) sameName.name = row.name
      return
    }

    map.set(key, { ...row })
  })

  return Array.from(map.values())
}

function applyPreviewPayments(
  rows: DebtPreviewRow[],
  payments: FinanceEntry[],
  kind: "CLIENT" | "SUPPLIER",
  requiredEntryType?: FinanceEntry["entryType"]
) {
  const paymentMap = new Map<string, number>()
  const partyKey = kind === "CLIENT" ? "CLIENT" : "SUPPLIER"

  payments.forEach((entry) => {
    const refType = String(entry.referenceType || "").toUpperCase()
    if (refType !== partyKey) return
    if (requiredEntryType && entry.entryType !== requiredEntryType) return
    const refId = String(entry.referenceId || "").trim()
    if (!refId) return
    paymentMap.set(refId, (paymentMap.get(refId) || 0) + toNum(entry.amount))
  })

  return rows.map((row) => {
    const extraPaid = paymentMap.get(String(row.id)) || 0
    if (!extraPaid) return row
    return {
      ...row,
      paidSum: row.paidSum + extraPaid,
      debtSum: Math.max(row.debtSum - extraPaid, 0),
    }
  })
}

function toneClass(tone: StatItem["tone"]) {
  if (tone === "emerald") return "from-emerald-500/10 to-emerald-50 text-emerald-700 border-emerald-100"
  if (tone === "amber") return "from-amber-500/10 to-amber-50 text-amber-700 border-amber-100"
  return "from-blue-500/10 to-blue-50 text-blue-700 border-blue-100"
}

function fmtMoney(amount: number, currency = "UZS") {
  return `${new Intl.NumberFormat("en-US").format(Math.trunc(Number(amount || 0)))} ${currency}`
}

function formatWholeNumberInput(value: string) {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return ""
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function parseWholeNumberInput(value: string) {
  const digits = String(value || "").replace(/\D/g, "")
  const num = Number(digits)
  return Number.isFinite(num) ? num : 0
}

function emptyExchangeRateForm(): ExchangeRateFormState {
  return {
    currency: "USD",
    rate: "",
    date: new Date().toISOString().slice(0, 10),
    source: "Manual",
  }
}

function fmtRate(value: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.trunc(Number(value || 0)))
}

function fmtDate(value: string) {
  if (!value) return "-"
  const raw = String(value).slice(0, 10)
  const parts = raw.split("-")
  if (parts.length !== 3) return raw
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function fmtDateTime(value: string) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`
}

function toDateInputValue(value: string) {
  const raw = String(value || "").trim()
  if (!raw) return new Date().toISOString().slice(0, 10)
  return raw.slice(0, 10)
}

function formatReferenceNumber(value: string) {
  const raw = String(value || "").trim()
  const match = raw.match(/^[A-Z_]+\s*#\s*(\d+)$/i)
  if (!match) return raw || "-"
  return `\u2116${String(Number(match[1]))}`
}

function resolveEntryReferenceName(row: FinanceEntry, lookupNameMap: Map<string, string>) {
  const refType = String(row.referenceType || "").toUpperCase()
  const refId = String(row.referenceId || "").trim()
  if (!refType || !refId) return formatReferenceNumber(row.reference || row.category || row.notes || "-")
  return formatReferenceNumber(lookupNameMap.get(`${refType}:${refId}`) || row.reference || row.category || row.notes || "-")
}

function normalizeApiList<T>(res: { rows?: T[]; results?: T[] } | T[]) {
  if (Array.isArray(res)) return res
  if (Array.isArray(res?.rows)) return res.rows
  if (Array.isArray((res as { results?: T[] })?.results)) return (res as { results?: T[] }).results || []
  return []
}

async function fetchAllOrdersForDebt() {
  const rows: OrderDebtCheckRow[] = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const res = await http.get<{ count?: number; next?: unknown; results?: OrderDebtCheckRow[] } | OrderDebtCheckRow[]>(
      "/api/v1/orders/",
      { page, page_size: 200 }
    )
    const list = normalizeApiList<OrderDebtCheckRow>(res)
    rows.push(...list)

    if (Array.isArray(res)) {
      hasNext = false
      continue
    }

    const next = (res as { next?: unknown }).next
    const count = Number((res as { count?: unknown }).count)
    if (typeof next === "string" && next) {
      page += 1
      continue
    }
    if (Number.isFinite(count) && rows.length < count) {
      page += 1
      continue
    }
    hasNext = false
  }

  return rows
}

async function fetchOrderLookupOptions() {
  const rows = await fetchAllOrdersForDebt()
  return rows
    .map((row, idx) => {
      const id = String(row.id ?? "").trim()
      if (!id) return null
      const orderNo = String(row.order_no || "").trim() || `ORD-${id}`
      const clientName = String(row.client_name || "").trim()
      return {
        id,
        name: clientName ? `${orderNo} - ${clientName}` : orderNo,
      }
    })
    .filter((item): item is FinanceLookupOption => Boolean(item))
}

async function fetchAllPurchasesForLookup() {
  const rows: PurchaseLookupRow[] = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const res = await http.get<{ count?: number; next?: unknown; results?: PurchaseLookupRow[] } | PurchaseLookupRow[]>(
      "/api/v1/purchases/",
      { page, page_size: 200 }
    )
    const list = normalizeApiList<PurchaseLookupRow>(res)
    rows.push(...list)

    if (Array.isArray(res)) {
      hasNext = false
      continue
    }

    const next = (res as { next?: unknown }).next
    const count = Number((res as { count?: unknown }).count)
    if (typeof next === "string" && next) {
      page += 1
      continue
    }
    if (Number.isFinite(count) && rows.length < count) {
      page += 1
      continue
    }
    hasNext = false
  }

  return rows
}

async function fetchPurchaseLookupOptions() {
  const rows = await fetchAllPurchasesForLookup()
  return rows
    .map((row, idx) => {
      const id = String(row.id ?? "").trim()
      if (!id) return null
      const purchaseNo = String(row.purchase_no || "").trim() || `PRC-${id}`
      const supplierName = String(row.supplier_name || "").trim()
      return {
        id,
        name: supplierName ? `${purchaseNo} - ${supplierName}` : purchaseNo,
      }
    })
    .filter((item): item is FinanceLookupOption => Boolean(item))
}

async function getAvailableDebtForPosting(
  kind: "CLIENT" | "SUPPLIER",
  refId: string,
  refName: string,
  entries: FinanceEntry[],
  postings: FinanceEntry[]
) {
  const normalizedRefId = String(refId || "").trim()

  if (kind === "CLIENT") {
    const [debtRes, orders] = await Promise.all([
      fetchAllFinanceDebtRows("/api/v1/finance/dashboard/debts/clients"),
      fetchAllOrdersForDebt(),
    ])
    const backendRows = mapDebtPreviewRows(debtRes, "CLIENT")
    const orderRows = aggregateOrderPreviewRows(orders)
    const mergedRows = dedupePreviewRows(mergeDebtPreviewRows(orderRows, backendRows))
    const withCash = applyPreviewPayments(mergedRows, entries, "CLIENT", "INCOME")
    const finalRows = dedupePreviewRows(applyPreviewPayments(withCash, postings, "CLIENT"))
    const matchedDebt = sumMatchedPreviewDebt(finalRows, normalizedRefId, refName)
    return Math.max(matchedDebt, 0)
  }

  const debtRes = await fetchAllFinanceDebtRows("/api/v1/finance/dashboard/debts/suppliers")
  const backendRows = mapDebtPreviewRows(debtRes, "SUPPLIER")
  const withCash = applyPreviewPayments(dedupePreviewRows(backendRows), entries, "SUPPLIER", "EXPENSE")
  const finalRows = dedupePreviewRows(applyPreviewPayments(withCash, postings, "SUPPLIER"))
  const matchedDebt = sumMatchedPreviewDebt(finalRows, normalizedRefId, refName)
  return Math.max(matchedDebt, 0)
}

function emptyCashForm(): CashFormState {
  return {
    entryType: "INCOME",
    amount: "",
    currency: "UZS",
    paymentMethod: "CASH",
    date: new Date().toISOString().slice(0, 10),
    targetKind: "CLIENT",
    targetId: "",
    employeePaymentType: "AVANS",
    notes: "",
    category: "",
    referenceType: "",
    referenceId: "",
  }
}

function getCashCategoryLabel(form: CashFormState) {
  if (form.targetKind === "EMPLOYEE") return form.employeePaymentType
  return form.targetKind === "SUPPLIER" ? "Yetkazib beruvchi" : "Mijoz"
}

function getCashTargetPlaceholder(targetKind: CashFormState["targetKind"], language: LanguageCode) {
  if (language === "ru") {
    if (targetKind === "SUPPLIER") return "выберите поставщика"
    if (targetKind === "EMPLOYEE") return "выберите сотрудника"
    return "выберите контрагента"
  }
  if (language === "en") {
    if (targetKind === "SUPPLIER") return "select supplier"
    if (targetKind === "EMPLOYEE") return "select employee"
    return "select client"
  }
  if (targetKind === "SUPPLIER") return "yetkazib beruvchini tanlang"
  if (targetKind === "EMPLOYEE") return "xodimni tanlang"
  return "mijozni tanlang"
}

function getSuggestedCashEntryType(targetKind: CashFormState["targetKind"]): FinanceEntry["entryType"] {
  return targetKind === "CLIENT" ? "INCOME" : "EXPENSE"
}

function toCashCreatePayload(form: CashFormState, options: FinanceLookupOption[]): Omit<FinanceEntry, "id"> {
  const selected = options.find((item) => item.id === form.targetId)

  return {
    entryType: form.entryType,
    category: getCashCategoryLabel(form),
    amount: parseWholeNumberInput(form.amount),
    currency: form.currency,
    paymentMethod: form.paymentMethod,
    date: form.date,
    referenceType: form.targetKind,
    referenceId: form.targetId || undefined,
    reference: selected ? `${form.targetKind} #${selected.name}` : form.targetKind,
    notes: form.notes.trim() || undefined,
  }
}

function toCashEditForm(entry: FinanceEntry): CashFormState {
  const refType = String(entry.referenceType || "").toUpperCase()
  const isEmployee = refType === "EMPLOYEE"
  const category = String(entry.category || "").toUpperCase()
  return {
    entryType: entry.entryType,
    category: entry.category || "",
    amount: formatWholeNumberInput(String(Math.trunc(Number(entry.amount || 0)))),
    currency: entry.currency,
    paymentMethod: entry.paymentMethod,
    date: entry.date,
    targetKind: isEmployee ? "EMPLOYEE" : refType === "SUPPLIER" ? "SUPPLIER" : "CLIENT",
    targetId: entry.referenceId ? String(entry.referenceId) : "",
    employeePaymentType:
      category.includes("BONUS") ? "BONUS" : category.includes("OYLIK") ? "OYLIK" : "AVANS",
    referenceType: entry.referenceType || "",
    referenceId: entry.referenceId ? String(entry.referenceId) : "",
    notes: entry.notes ? String(entry.notes) : "",
  }
}

function emptyPostingForm(): PostingFormState {
  return {
    referenceType: "",
    referenceId: "",
    targetKind: "CLIENT",
    targetId: "",
    employeePaymentType: "AVANS",
    paymentMethod: "BANK",
    amount: "",
    currency: "UZS",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    category: "",
  }
}

function emptyPostingCreateForm(): PostingFormState {
  return { ...emptyPostingForm() }
}

function getPostingCategoryLabel(form: PostingFormState) {
  if (form.targetKind === "EMPLOYEE") return form.employeePaymentType
  return form.targetKind === "SUPPLIER" ? "Поставщик" : "Контрагент"
}

function getPostingTargetPlaceholder(targetKind: PostingFormState["targetKind"], language: LanguageCode) {
  if (language === "ru") {
    if (targetKind === "SUPPLIER") return "выберите поставщика"
    if (targetKind === "EMPLOYEE" || targetKind === "SALARY") return "выберите сотрудника"
    return "выберите контрагента"
  }
  if (language === "en") {
    if (targetKind === "SUPPLIER") return "select supplier"
    if (targetKind === "EMPLOYEE" || targetKind === "SALARY") return "select employee"
    return "select client"
  }
  if (targetKind === "SUPPLIER") return "yetkazib beruvchini tanlang"
  if (targetKind === "EMPLOYEE" || targetKind === "SALARY") return "xodimni tanlang"
  return "mijozni tanlang"
}

function getSuggestedPostingEntryType(targetKind: PostingFormState["targetKind"]): FinanceEntry["entryType"] {
  return targetKind === "CLIENT" ? "INCOME" : "EXPENSE"
}

function toBankCreatePayload(form: PostingFormState, options: FinanceLookupOption[]): Omit<FinanceEntry, "id"> {
  const selected = options.find((item) => item.id === form.targetId)

  return {
    entryType: getSuggestedPostingEntryType(form.targetKind),
    category: getPostingCategoryLabel(form),
    amount: parseWholeNumberInput(form.amount),
    currency: form.currency,
    paymentMethod: "BANK",
    date: form.date,
    referenceType: form.targetKind,
    referenceId: form.targetId || undefined,
    reference: selected ? `${form.targetKind} #${selected.name}` : form.targetKind,
    notes: form.notes.trim() || undefined,
  }
}

function isBankDocumentRow(row: FinanceEntry) {
  const refType = String(row.referenceType || "").toUpperCase()
  return row.paymentMethod === "BANK" && (refType === "CLIENT" || refType === "SUPPLIER" || refType === "EMPLOYEE")
}

function toPostingEditForm(entry: FinanceEntry): PostingFormState {
  const refType = String(entry.referenceType || "").toUpperCase()
  const notes = String(entry.notes || "")
  const categoryUpper = String(entry.category || "").toUpperCase()
  const noteUpper = notes.toUpperCase()
  return {
    referenceType: entry.referenceType || "",
    referenceId: entry.referenceId ? String(entry.referenceId) : "",
    targetKind:
      refType === "PURCHASE"
        ? "PURCHASE"
        : refType === "SALARY" || refType === "EMPLOYEE"
          ? "EMPLOYEE"
          : refType === "SUPPLIER"
            ? "SUPPLIER"
            : refType === "ORDER"
              ? "ORDER"
              : "CLIENT",
    targetId: entry.referenceId ? String(entry.referenceId) : "",
    employeePaymentType:
      categoryUpper.includes("BONUS") || noteUpper.includes("BONUS")
        ? "BONUS"
        : categoryUpper.includes("OYLIK") || noteUpper.includes("OYLIK")
          ? "OYLIK"
          : "AVANS",
    paymentMethod: entry.paymentMethod,
    amount: formatWholeNumberInput(String(Math.trunc(Number(entry.amount || 0)))),
    currency: entry.currency,
    date: toDateInputValue(entry.date),
    notes,
    category: String(entry.category || ""),
  }
}

function emptyPayrollPaymentForm(): PayrollPaymentFormState {
  return {
    employeeId: "",
    paymentType: "OYLIK",
    paymentMethod: "CASH",
    amount: "",
    currency: "UZS",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  }
}

function WorkspaceFrame({
  icon,
  title,
  description,
  stats,
  primary,
  secondary,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  stats: StatItem[]
  primary: string
  secondary: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                {icon}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {stats.map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl border bg-gradient-to-br p-4 ${toneClass(item.tone)}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
              <div className="mt-2 text-lg font-extrabold text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {children}
    </div>
  )
}

function InfoPanel({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionToolbar({
  title,
  description,
  buttonLabel,
  onClick,
  disabled = false,
}: {
  title: string
  description: string
  buttonLabel: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl !bg-gradient-to-r from-blue-900 to-blue-700 p-4 text-white transition hover:bg-slate-800"
      >
        <Plus size={16} />
        {buttonLabel}
      </button>
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "Approved" || value === "Completed" || value === "Paid" || value === "Ready" || value === "Active"
      ? "bg-emerald-50 text-emerald-700"
      : value === "In progress" || value === "Pending review" || value === "Due soon" || value === "Pending" || value === "Partially paid"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700"

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{value}</span>
}

function getEntryTypeLabel(language: LanguageCode, value: FinanceEntry["entryType"]) {
  if (language === "ru") {
    return value === "INCOME" ? "Поступление" : value === "EXPENSE" ? "Расход" : "Корректировка"
  }
  if (language === "en") {
    return value === "INCOME" ? "Income" : value === "EXPENSE" ? "Expense" : "Adjustment"
  }
  return value === "INCOME" ? "Kirim" : value === "EXPENSE" ? "Chiqim" : "Tuzatish"
}

function getPaymentMethodLabel(language: LanguageCode, value: FinanceEntry["paymentMethod"]) {
  if (language === "ru") {
    return value === "CASH" ? "Наличный" : value === "CARD" ? "Карта" : "Банк"
  }
  if (language === "en") {
    return value === "CASH" ? "Cash" : value === "CARD" ? "Card" : "Bank"
  }
  return value === "CASH" ? "Naqd" : value === "CARD" ? "Karta" : "Bank"
}

function EntryTypeBadge({
  value,
  language,
}: {
  value: FinanceEntry["entryType"]
  language: LanguageCode
}) {
  const label = getEntryTypeLabel(language, value)

  const tone =
    value === "INCOME"
      ? "bg-emerald-50 text-emerald-700"
      : value === "EXPENSE"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-700"

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>
}

function MethodBadge({
  value,
  language,
}: {
  value: FinanceEntry["paymentMethod"]
  language: LanguageCode
}) {
  const tone =
    value === "CASH"
      ? "bg-emerald-50 text-emerald-700"
      : value === "BANK"
        ? "bg-blue-50 text-blue-700"
        : "bg-amber-50 text-amber-700"

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {getPaymentMethodLabel(language, value)}
    </span>
  )
}

export function MoliyaCashDocumentsPage() {
  const { language } = useI18n()
  const [rows, setRows] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [filters, setFilters] = useState({
    search: "",
    entryType: "ALL" as FinanceEntry["entryType"] | "ALL",
    paymentMethod: "ALL" as FinanceEntry["paymentMethod"] | "ALL",
    dateFrom: "",
    dateTo: "",
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<CashFormState>(() => emptyCashForm())
  const [editForm, setEditForm] = useState<CashFormState>(() => emptyCashForm())
  const [clientOptions, setClientOptions] = useState<FinanceLookupOption[]>([])
  const [supplierOptions, setSupplierOptions] = useState<FinanceLookupOption[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<FinanceLookupOption[]>([])
  const [orderOptions, setOrderOptions] = useState<FinanceLookupOption[]>([])
  const [lookupsLoading, setLookupsLoading] = useState(false)

  const copy =
    language === "ru"
      ? {
          workspaceTitle: "Кассовые документы",
          workspaceDescription: "Рабочее пространство для ведения кассовых документов по приходу и расходу в одном месте.",
          statsIncome: "Общий приход",
          statsExpense: "Общий расход",
          statsBalance: "Остаток кассы",
          sectionTitle: "Кассовые документы",
          sectionDescription: "Здесь вы вносите любые поступления и расходы по кассе.",
          export: "Экспорт",
          newPayment: "Новый платёж",
          search: "Поиск",
          searchPlaceholder: "Название, комментарий, категория...",
          type: "Тип",
          paymentMethod: "Способ оплаты",
          dateFrom: "Дата от",
          dateTo: "Дата до",
          all: "Все",
          name: "Название",
          amount: "Сумма",
          currency: "Валюта",
          notes: "Комментарий",
          createdAt: "Дата создания",
          actions: "Действия",
          edit: "Редактировать",
          remove: "Удалить",
          empty: "Данные не найдены",
          loading: "Загрузка...",
          createTitle: "Новый кассовый документ",
          editTitle: "Редактирование кассового документа",
          category: "Категория",
          salaryPaymentType: "Тип выплаты сотруднику",
          method: "Метод",
          date: "Дата",
          notesPlaceholder: "Комментарий",
          cancel: "Отмена",
          save: "Сохранить",
          update: "Обновить",
          client: "Контрагент",
          supplier: "Поставщик",
          employee: "Сотрудник",
          selectClient: "выберите контрагента",
          selectSupplier: "выберите поставщика",
          selectEmployee: "выберите сотрудника",
          lookupLoading: "Загрузка...",
          amountInvalid: "Некорректная сумма",
          pickDate: "Выберите дату",
          pickRecord: "Выберите запись из списка",
          createSuccess: "Кассовый документ создан",
          createError: "Ошибка при создании",
          openError: "Не удалось открыть запись",
          editCategoryRequired: "Категория обязательна",
          updateSuccess: "Кассовый документ обновлён",
          updateError: "Ошибка при обновлении",
          removeConfirm: "Удалить кассовый документ?",
          removeSuccess: "Кассовый документ удалён",
          removeError: "Ошибка при удалении",
          exportError: "Ошибка при экспорте",
          loadError: "Кассовые документы не загрузились",
          lookupError: "Справочные данные не загрузились",
          editNotice: "По PATCH endpoint здесь редактируются только поля `category`, `occurred_on`, `note`.",
          employeeAdvance: "Аванс",
          employeeSalary: "Зарплата",
          employeeBonus: "Бонус",
        }
      : language === "en"
        ? {
            workspaceTitle: "Cash Documents",
            workspaceDescription: "Workspace for keeping all cash income and expense documents in one place.",
            statsIncome: "Total income",
            statsExpense: "Total expense",
            statsBalance: "Cash balance",
            sectionTitle: "Cash Documents",
            sectionDescription: "Record all cash income and expense transactions here.",
            export: "Export",
            newPayment: "New payment",
            search: "Search",
            searchPlaceholder: "Name, comment, category...",
            type: "Type",
            paymentMethod: "Payment method",
            dateFrom: "Date from",
            dateTo: "Date to",
            all: "All",
            name: "Name",
            amount: "Amount",
            currency: "Currency",
            notes: "Comment",
            createdAt: "Created at",
            actions: "Actions",
            edit: "Edit",
            remove: "Delete",
            empty: "No data found",
            loading: "Loading...",
            createTitle: "New cash document",
            editTitle: "Edit cash document",
            category: "Category",
            salaryPaymentType: "Employee payment type",
            method: "Method",
            date: "Date",
            notesPlaceholder: "Comment",
            cancel: "Cancel",
            save: "Save",
            update: "Update",
            client: "Client",
            supplier: "Supplier",
            employee: "Employee",
            selectClient: "select client",
            selectSupplier: "select supplier",
            selectEmployee: "select employee",
            lookupLoading: "Loading...",
            amountInvalid: "Invalid amount",
            pickDate: "Select a date",
            pickRecord: "Select an item from the list",
            createSuccess: "Cash document created",
            createError: "Create failed",
            openError: "Could not open the record",
            editCategoryRequired: "Category is required",
            updateSuccess: "Cash document updated",
            updateError: "Update failed",
            removeConfirm: "Delete this cash document?",
            removeSuccess: "Cash document deleted",
            removeError: "Delete failed",
            exportError: "Export failed",
            loadError: "Cash documents failed to load",
            lookupError: "Lookup data failed to load",
            editNotice: "Per PATCH endpoint, only `category`, `occurred_on`, and `note` are editable here.",
            employeeAdvance: "Advance",
            employeeSalary: "Salary",
            employeeBonus: "Bonus",
          }
        : {
            workspaceTitle: "Kassa hujjatlari",
            workspaceDescription: "Kirim va chiqim bo'yicha kassoviy hujjatlarni bitta joyda yuritish uchun ish maydoni.",
            statsIncome: "Umumiy kirim",
            statsExpense: "Umumiy chiqim",
            statsBalance: "Kassa qoldig'i",
            sectionTitle: "Kassa hujjatlari",
            sectionDescription: "Kassa bo'yicha har qanday kirim yoki chiqimni shu yerga kiritasiz.",
            export: "Eksport",
            newPayment: "Yangi to'lov",
            search: "Qidiruv",
            searchPlaceholder: "Nomi, izoh, kategoriya...",
            type: "Turi",
            paymentMethod: "To'lov usuli",
            dateFrom: "Sana dan",
            dateTo: "Sana gacha",
            all: "Barchasi",
            name: "Nomi",
            amount: "Summa",
            currency: "Valyuta",
            notes: "Izoh",
            createdAt: "Yaratilgan sana",
            actions: "Amallar",
            edit: "Tahrirlash",
            remove: "O'chirish",
            empty: "Ma'lumot topilmadi",
            loading: "Yuklanmoqda...",
            createTitle: "Yangi kassoviy hujjat",
            editTitle: "Kassoviy hujjatni tahrirlash",
            category: "Kategoriya",
            salaryPaymentType: "Xodimga to'lov turi",
            method: "Metod",
            date: "Sana",
            notesPlaceholder: "Izoh",
            cancel: "Bekor",
            save: "Saqlash",
            update: "Yangilash",
            client: "Mijoz",
            supplier: "Yetkazib beruvchi",
            employee: "Xodim",
            selectClient: "mijozni tanlang",
            selectSupplier: "yetkazib beruvchini tanlang",
            selectEmployee: "xodimni tanlang",
            lookupLoading: "Yuklanmoqda...",
            amountInvalid: "Summa noto'g'ri",
            pickDate: "Sana tanlang",
            pickRecord: "Ro'yxatdan birini tanlang",
            createSuccess: "Kassoviy hujjat yaratildi",
            createError: "Yaratishda xatolik",
            openError: "Yozuvni ochib bo'lmadi",
            editCategoryRequired: "Kategoriya kiritilishi kerak",
            updateSuccess: "Kassoviy hujjat yangilandi",
            updateError: "Yangilashda xatolik",
            removeConfirm: "Kassoviy hujjat o'chirilsinmi?",
            removeSuccess: "Kassoviy hujjat o'chirildi",
            removeError: "O'chirishda xatolik",
            exportError: "Eksportda xatolik",
            loadError: "Kassoviy hujjatlar yuklanmadi",
            lookupError: "Lookup ma'lumotlari yuklanmadi",
            editNotice: "PATCH endpoint bo'yicha bu yerda faqat `category`, `occurred_on`, `note` tahrirlanadi.",
            employeeAdvance: "Avans",
            employeeSalary: "Oylik",
            employeeBonus: "Bonus",
          }

  const readOnlyNotice =
    language === "ru"
      ? "Раздел работает только в режиме чтения: backend contract для Finance / Entries документирует только чтение."
      : language === "en"
        ? "This section is read-only because the Finance / Entries backend contract documents only read operations."
        : "Bu bo'lim faqat o'qish rejimida: Finance / Entries backend contractida faqat o'qish amallari documented qilingan."

  const loadRows = async () => {
    try {
      setLoading(true)
      setError("")
      // Ledger endpointni aynan shu yerga uladik: Cash document jadvali financeClient.listEntries() orqali o'qiladi.
      const data = await financeClient.listEntries()
      setRows(data)
    } catch (e: any) {
      setRows([])
      setError(String(e?.message || copy.loadError))

    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError("")
        const data = await financeClient.listEntries()
        if (!active) return
        setRows(data)
      } catch (e: any) {
        if (!active) return
        setRows([])
        setError(String(e?.message || copy.loadError))

      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadLookups() {
      try {
        setLookupsLoading(true)
        const [clients, suppliers, employees, orders] = await Promise.all([
          financeClient.listClientOptions(),
          financeClient.listSupplierOptions(),
          financeClient.listEmployeeOptions(),
          fetchOrderLookupOptions(),
        ])
        if (!active) return
        setClientOptions(clients)
        setSupplierOptions(suppliers)
        setEmployeeOptions(employees)
        setOrderOptions(orders)
      } catch (e: any) {
        if (!active) return
        setClientOptions([])
        setSupplierOptions([])
        setEmployeeOptions([])
        setOrderOptions([])
        setError(String(e?.message || copy.lookupError))

      } finally {
        if (active) setLookupsLoading(false)
      }
    }

    loadLookups()
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const income = rows
      .filter((row) => row.entryType === "INCOME")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const expense = rows
      .filter((row) => row.entryType === "EXPENSE")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)

    return [
      { label: copy.statsIncome, value: fmtMoney(income) },
      { label: copy.statsExpense, value: fmtMoney(expense), tone: "amber" as const },
      { label: copy.statsBalance, value: fmtMoney(income - expense), tone: "emerald" as const },

    ]
  }, [rows, copy.statsBalance, copy.statsExpense, copy.statsIncome])

  const activeLookupOptions = useMemo(() => {
    if (createForm.targetKind === "SUPPLIER") return supplierOptions
    if (createForm.targetKind === "EMPLOYEE") return employeeOptions
    return clientOptions
  }, [clientOptions, supplierOptions, employeeOptions, createForm.targetKind])

  const lookupNameMap = useMemo(() => {
    const map = new Map<string, string>()
    clientOptions.forEach((item) => map.set(`CLIENT:${item.id}`, item.name))
    supplierOptions.forEach((item) => map.set(`SUPPLIER:${item.id}`, item.name))
    employeeOptions.forEach((item) => map.set(`EMPLOYEE:${item.id}`, item.name))
    orderOptions.forEach((item) => map.set(`ORDER:${item.id}`, item.name))
    return map
  }, [clientOptions, supplierOptions, employeeOptions, orderOptions])

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return rows.filter((row) => {
      const refType = String(row.referenceType || "").toUpperCase()
      if (refType === "SALARY") return false

      const rowDate = String(row.createdAt || row.date || "").slice(0, 10)
      const referenceName = resolveEntryReferenceName(row, lookupNameMap)
      const matchesSearch =
        !search ||
        [
          referenceName,
          row.notes || "",
          row.category || "",
          row.reference || "",
          row.referenceType || "",
          row.currency || "",
          row.paymentMethod || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)

      const matchesEntryType = filters.entryType === "ALL" || row.entryType === filters.entryType
      const matchesPaymentMethod = filters.paymentMethod === "ALL" || row.paymentMethod === filters.paymentMethod
      const matchesDateFrom = !filters.dateFrom || (rowDate && rowDate >= filters.dateFrom)
      const matchesDateTo = !filters.dateTo || (rowDate && rowDate <= filters.dateTo)

      return matchesSearch && matchesEntryType && matchesPaymentMethod && matchesDateFrom && matchesDateTo
    })
  }, [rows, filters, lookupNameMap])

  const openCreateModal = () => {
    setCreateForm(emptyCashForm())
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!createForm.targetId) {
      toast.error(copy.pickRecord)
      return
    }
    if (parseWholeNumberInput(createForm.amount) <= 0) {
      toast.error(copy.amountInvalid)
      return
    }
    if (!createForm.date) {
      toast.error(copy.pickDate)

      return
    }

    try {
      setSubmitting(true)
      // finance_ledger_create -> api/v1/finance/ledger/ shu create modalga ulangan.
      await financeClient.createEntry(toCashCreatePayload(createForm, activeLookupOptions))
      setCreateOpen(false)
      setCreateForm(emptyCashForm())
      await loadRows()
      toast.success(copy.createSuccess)
    } catch (e: any) {
      toast.error(String(e?.message || copy.createError))

    } finally {
      setSubmitting(false)
    }
  }

  const openEditModal = async (id: string) => {
    try {
      setSubmitting(true)
      // finance_ledger_read -> api/v1/finance/ledger/{id}/ edit oldidan aynan shu yerda o'qiladi.
      const row = await financeClient.readEntry(id)
      setEditingId(id)
      setEditForm(toCashEditForm(row))
      setEditOpen(true)
    } catch (e: any) {
      toast.error(String(e?.message || copy.openError))

    } finally {
      setSubmitting(false)
    }
  }

  const submitEdit = async () => {
    if (!editingId) return
    if (!editForm.category.trim()) {
      toast.error(copy.editCategoryRequired)
      return
    }
    if (!editForm.date) {
      toast.error(copy.pickDate)

      return
    }

    try {
      setSubmitting(true)
      // finance_ledger_partial_upDate -> PATCH faqat category, Date, note qabul qiladi; shuning uchun shu fieldlar yuboriladi.
      await financeClient.updateEntry(editingId, {
        category: editForm.category.trim(),
        date: editForm.date,
        notes: editForm.notes.trim() || undefined,
      })
      setEditOpen(false)
      setEditingId(null)
      await loadRows()
      toast.success(copy.updateSuccess)
    } catch (e: any) {
      toast.error(String(e?.message || copy.updateError))

    } finally {
      setSubmitting(false)
    }
  }

  const removeRow = async (id: string) => {
    if (!window.confirm(copy.removeConfirm)) return

    try {
      setSubmitting(true)
      // finance_ledger_delete -> api/v1/finance/ledger/{id}/ delete shu actionga ulangan.
      await financeClient.deleteEntry(id)
      await loadRows()
      toast.success(copy.removeSuccess)
    } catch (e: any) {
      toast.error(String(e?.message || copy.removeError))
    } finally {
      setSubmitting(false)
    }
  }

  const exportRows = async () => {
    try {
      setSubmitting(true)
      // finance_ledger_export -> api/v1/finance/ledger/export/ export tugmasi shu methodga ulangan.
      await financeClient.exportEntries()
    } catch (e: any) {
      toast.error(String(e?.message || copy.exportError))

    } finally {
      setSubmitting(false)
    }
  }

  const {
    page: cashPage,
    setPage: setCashPage,
    totalPages: cashTotalPages,
    pagedItems: pagedCashRows,
  } = useClientPagination(filteredRows, 10, [filteredRows.length])

  useEffect(() => {
    setCashPage(1)
  }, [filters.search, filters.entryType, filters.paymentMethod, filters.dateFrom, filters.dateTo, setCashPage])

  return (
    <WorkspaceFrame
      icon={<Receipt size={22} />}
      title={copy.workspaceTitle}
      description={copy.workspaceDescription}

      stats={stats}
      primary="Create cash orders"
      secondary="Close daily cash movements"
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{copy.sectionTitle}</h3>
            <p className="mt-1 text-sm text-slate-600">{copy.sectionDescription}</p>

          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={exportRows}
              disabled={submitting}
            >
              <Download size={16} className="mr-2" />
              {copy.export}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={openCreateModal}
              disabled
              title={readOnlyNotice}
            >
              <Plus size={16} className="mr-2" />
              {copy.newPayment}

            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {readOnlyNotice}
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_180px_180px_180px_180px]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.search}</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={copy.searchPlaceholder}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.type}</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.entryType}
              onChange={(e) => setFilters((prev) => ({ ...prev, entryType: e.target.value as FinanceEntry["entryType"] | "ALL" }))}
            >
              <option value="ALL">{copy.all}</option>
              <option value="INCOME">{getEntryTypeLabel(language, "INCOME")}</option>
              <option value="EXPENSE">{getEntryTypeLabel(language, "EXPENSE")}</option>
              <option value="ADJUSTMENT">{getEntryTypeLabel(language, "ADJUSTMENT")}</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.paymentMethod}</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.paymentMethod}
              onChange={(e) => setFilters((prev) => ({ ...prev, paymentMethod: e.target.value as FinanceEntry["paymentMethod"] | "ALL" }))}
            >
              <option value="ALL">{copy.all}</option>
              <option value="CASH">{getPaymentMethodLabel(language, "CASH")}</option>
              <option value="CARD">{getPaymentMethodLabel(language, "CARD")}</option>
              <option value="BANK">{getPaymentMethodLabel(language, "BANK")}</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.dateFrom}</span>
            <input
              type="date"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.dateFrom}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.dateTo}</span>
            <input
              type="date"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.dateTo}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold">
                <th>{copy.name}</th>
                <th className="text-left">{copy.type}</th>
                <th className="text-center">{copy.amount}</th>
                <th className="text-left">{copy.currency}</th>
                <th>{copy.notes}</th>
                <th>{copy.createdAt}</th>
                <th className="text-right">{language === "ru" ? "Действия" : language === "en" ? "Actions" : "Amallar"}</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedCashRows.map((row) => (
                <tr key={row.id} className="bg-white hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{resolveEntryReferenceName(row, lookupNameMap)}</td>
                  <td className="px-2 py-3 text-left"><EntryTypeBadge value={row.entryType} language={language} /></td>
                  <td className="px-4 py-3 text-left font-medium text-slate-900">{fmtMoney(row.amount, row.currency)}</td>
                  <td className="px-6 py-3 text-slate-700 text-left">{row.currency}</td>
                  <td className="px-6 py-3 text-slate-700">{row.notes || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtDate(row.createdAt || row.date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => openEditModal(row.id)}
                        disabled
                        title={readOnlyNotice}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="rounded-xl"
                        onClick={() => removeRow(row.id)}
                        disabled
                        title={readOnlyNotice}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {copy.empty}

                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {copy.loading}

                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!loading && filteredRows.length > 0 ? (
          <div className="mt-4 flex justify-end">
            <TablePagination page={cashPage} totalPages={cashTotalPages} onPageChange={setCashPage} size="sm" />
          </div>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>{copy.createTitle}</DialogTitle>

          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.type}</span>

              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={createForm.entryType}
                onChange={(e) => setCreateForm((p) => ({ ...p, entryType: e.target.value as FinanceEntry["entryType"] }))}
              >
                <option value="INCOME">{getEntryTypeLabel(language, "INCOME")}</option>
                <option value="EXPENSE">{getEntryTypeLabel(language, "EXPENSE")}</option>
                <option value="ADJUSTMENT">{getEntryTypeLabel(language, "ADJUSTMENT")}</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.category}</span>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  value={createForm.targetKind}
                  onChange={(e) =>
                    setCreateForm((p) => {
                      const nextTargetKind = e.target.value as CashFormState["targetKind"]
                      return {
                      ...p,
                      targetKind: nextTargetKind,
                      entryType: getSuggestedCashEntryType(nextTargetKind),
                      targetId: "",
                      }
                    })
                  }
                >
                  <option value="CLIENT">{copy.client}</option>
                  <option value="SUPPLIER">{copy.supplier}</option>
                  <option value="EMPLOYEE">{copy.employee}</option>
                </select>

                <select
                  key={`cash-target-${language}-${createForm.targetKind}`}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  value={createForm.targetId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, targetId: e.target.value }))}
                >
                  <option value="">
                    {lookupsLoading ? copy.lookupLoading : getCashTargetPlaceholder(createForm.targetKind, language)}

                  </option>
                  {activeLookupOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {createForm.targetKind === "EMPLOYEE" ? (
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">{copy.salaryPaymentType}</span>

                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  value={createForm.employeePaymentType}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      employeePaymentType: e.target.value as CashFormState["employeePaymentType"],
                    }))
                  }
                >
                  <option value="AVANS">{copy.employeeAdvance}</option>
                  <option value="OYLIK">{copy.employeeSalary}</option>
                  <option value="BONUS">{copy.employeeBonus}</option>

                </select>
              </label>
            ) : null}

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.amount}</span>

              <input
                type="text"
                inputMode="numeric"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={createForm.amount}
                onChange={(e) => setCreateForm((p) => ({ ...p, amount: formatWholeNumberInput(e.target.value) }))}
                placeholder="100000"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.currency}</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={createForm.currency}
                onChange={(e) => setCreateForm((p) => ({ ...p, currency: e.target.value as FinanceEntry["currency"] }))}
              >
                <option value="UZS">UZS</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.method}</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={createForm.paymentMethod}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, paymentMethod: e.target.value as FinanceEntry["paymentMethod"] }))
                }
              >
                <option value="CASH">{getPaymentMethodLabel(language, "CASH")}</option>
                <option value="CARD">{getPaymentMethodLabel(language, "CARD")}</option>
                <option value="BANK">{getPaymentMethodLabel(language, "BANK")}</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.date}</span>

              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={createForm.date}
                onChange={(e) => setCreateForm((p) => ({ ...p, date: e.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">{copy.notes}</span>

              <textarea
                className="min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2"
                value={createForm.notes}
                onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={copy.notesPlaceholder}

              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              {copy.cancel}
            </Button>
            <Button type="button" onClick={submitCreate} disabled={submitting}>
              {copy.save}

            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{copy.editTitle}</DialogTitle>

          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              {copy.editNotice}

            </div>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.category}</span>
              <input
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={editForm.category}
                onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.date}</span>

              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={editForm.date}
                onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.notes}</span>

              <textarea
                className="min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2"
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setEditingId(null)
              }}
              disabled={submitting}
            >
              {copy.cancel}
            </Button>
            <Button type="button" onClick={submitEdit} disabled={submitting}>
              {copy.update}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceFrame>
  )
}

export function MoliyaBankDocumentsPage() {
  const { language } = useI18n()
  const [rows, setRows] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [filters, setFilters] = useState({
    search: "",
    entryType: "ALL" as FinanceEntry["entryType"] | "ALL",
    paymentMethod: "ALL" as FinanceEntry["paymentMethod"] | "ALL",
    dateFrom: "",
    dateTo: "",
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<PostingFormState>(() => emptyPostingCreateForm())
  const [editForm, setEditForm] = useState<PostingFormState>(() => emptyPostingForm())
  const [clientOptions, setClientOptions] = useState<FinanceLookupOption[]>([])
  const [supplierOptions, setSupplierOptions] = useState<FinanceLookupOption[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<FinanceLookupOption[]>([])
  const [orderOptions, setOrderOptions] = useState<FinanceLookupOption[]>([])
  const [purchaseOptions, setPurchaseOptions] = useState<FinanceLookupOption[]>([])
  const [lookupsLoading, setLookupsLoading] = useState(false)

  const copy =
    language === "ru"
      ? {
          title: "Банковские документы",
          description: "Центральный раздел для платёжных поручений и переводов через банк.",
          statsIncome: "Поступления",
          statsExpense: "Расход",
          sectionTitle: "Банковские документы",
          sectionDescription: "Здесь вы можете контролировать платежи, проведённые через банк.",
          newButton: "Новый документ",
          search: "Поиск",
          searchPlaceholder: "Название, комментарий, категория...",
          filterType: "Тип",
          filterMethod: "Способ оплаты",
          dateFrom: "Дата от",
          dateTo: "Дата до",
          all: "Все",
          name: "Название",
          type: "Тип",
          amount: "Сумма",
          currency: "Валюта",
          note: "Комментарий",
          createdAt: "Дата создания",
          actions: "Действия",
          edit: "Редактировать",
          remove: "Удалить",
          empty: "Данные не найдены",
          loading: "Загрузка...",
          createTitle: "Новый банковский документ",
          editTitle: "Редактирование банковского документа",
          category: "Категория",
          client: "Контрагент",
          supplier: "Поставщик",
          employee: "Сотрудник",
          employeePaymentType: "Тип выплаты сотруднику",
          amountPlaceholder: "100000",
          method: "Метод",
          date: "Дата",
          cancel: "Отмена",
          save: "Сохранить",
          update: "Обновить",
          notesPlaceholder: "Комментарий",
          loadError: "Банковские документы не загрузились",
          lookupError: "Справочные данные не загрузились",
          pickRecord: "Выберите запись из списка",
          amountInvalid: "Некорректная сумма",
          pickDate: "Выберите дату",
          createSuccess: "Банковский документ создан",
          createError: "Ошибка при создании",
          openError: "Не удалось открыть запись",
          editCategoryRequired: "Категория обязательна",
          updateSuccess: "Банковский документ обновлён",
          updateError: "Ошибка при обновлении",
          removeConfirm: "Удалить банковский документ?",
          removeSuccess: "Банковский документ удалён",
          removeError: "Ошибка при удалении",
          lookupLoading: "Загрузка...",
          employeeAdvance: "Аванс",
          employeeSalary: "Зарплата",
          employeeBonus: "Бонус",
        }
      : language === "en"
        ? {
            title: "Bank Documents",
            description: "Central section for bank payment orders and transfers.",
            statsIncome: "Bank income",
            statsExpense: "Bank expenses",
            sectionTitle: "Bank Documents",
            sectionDescription: "Here you can monitor payments processed through the bank.",
            newButton: "New document",
            search: "Search",
            searchPlaceholder: "Name, comment, category...",
            filterType: "Type",
            filterMethod: "Payment method",
            dateFrom: "Date from",
            dateTo: "Date to",
            all: "All",
            name: "Name",
            type: "Type",
            amount: "Amount",
            currency: "Currency",
            note: "Comment",
            createdAt: "Created at",
            actions: "Actions",
            edit: "Edit",
            remove: "Delete",
            empty: "No data found",
            loading: "Loading...",
            createTitle: "New bank document",
            editTitle: "Edit bank document",
            category: "Category",
            client: "Client",
            supplier: "Supplier",
            employee: "Employee",
            employeePaymentType: "Employee payment type",
            amountPlaceholder: "100000",
            method: "Method",
            date: "Date",
            cancel: "Cancel",
            save: "Save",
            update: "Update",
            notesPlaceholder: "Comment",
            loadError: "Bank documents failed to load",
            lookupError: "Lookup data failed to load",
            pickRecord: "Select an item from the list",
            amountInvalid: "Invalid amount",
            pickDate: "Select a date",
            createSuccess: "Bank document created",
            createError: "Create failed",
            openError: "Could not open the record",
            editCategoryRequired: "Category is required",
            updateSuccess: "Bank document updated",
            updateError: "Update failed",
            removeConfirm: "Delete this bank document?",
            removeSuccess: "Bank document deleted",
            removeError: "Delete failed",
            lookupLoading: "Loading...",
            employeeAdvance: "Advance",
            employeeSalary: "Salary",
            employeeBonus: "Bonus",
          }
        : {
            title: "Bank hujjatlari",
            description: "Bank orqali o'tadigan to'lov topshiriqlari va o'tkazmalar uchun markaziy bo'lim.",
            statsIncome: "Bank kirimlari",
            statsExpense: "Bank chiqimlari",
            sectionTitle: "Bank hujjatlari",
            sectionDescription: "Bu yerda siz bank orqali o'tkazilgan to'lovlarni nazorat qilasiz.",
            newButton: "Yangi hujjat",
            search: "Qidiruv",
            searchPlaceholder: "Nomi, izoh, kategoriya...",
            filterType: "Turi",
            filterMethod: "To'lov usuli",
            dateFrom: "Sana dan",
            dateTo: "Sana gacha",
            all: "Barchasi",
            name: "Nomi",
            type: "Turi",
            amount: "Summa",
            currency: "Valyuta",
            note: "Izoh",
            createdAt: "Yaratilgan sana",
            actions: "Amallar",
            edit: "Tahrirlash",
            remove: "O'chirish",
            empty: "Ma'lumot topilmadi",
            loading: "Yuklanmoqda...",
            createTitle: "Yangi bank hujjati",
            editTitle: "Bank hujjatini tahrirlash",
            category: "Kategoriya",
            client: "Mijoz",
            supplier: "Yetkazib beruvchi",
            employee: "Xodim",
            employeePaymentType: "Xodimga to'lov turi",
            amountPlaceholder: "100000",
            method: "Metod",
            date: "Sana",
            cancel: "Bekor",
            save: "Saqlash",
            update: "Yangilash",
            notesPlaceholder: "Izoh",
            loadError: "Bank hujjatlari yuklanmadi",
            lookupError: "Lookup ma'lumotlari yuklanmadi",
            pickRecord: "Ro'yxatdan birini tanlang",
            amountInvalid: "Summa noto'g'ri",
            pickDate: "Sana tanlang",
            createSuccess: "Bank hujjati yaratildi",
            createError: "Yaratishda xatolik",
            openError: "Yozuvni ochib bo'lmadi",
            editCategoryRequired: "Kategoriya kiritilishi kerak",
            updateSuccess: "Bank hujjati yangilandi",
            updateError: "Yangilashda xatolik",
            removeConfirm: "Bank hujjati o'chirilsinmi?",
            removeSuccess: "Bank hujjati o'chirildi",
            removeError: "O'chirishda xatolik",
            lookupLoading: "Yuklanmoqda...",
            employeeAdvance: "Avans",
            employeeSalary: "Oylik",
            employeeBonus: "Bonus",
          }

  const readOnlyNotice =
    language === "ru"
      ? "Раздел работает только в режиме чтения: backend contract для Finance / Entries документирует только чтение."
      : language === "en"
        ? "This section is read-only because the Finance / Entries backend contract documents only read operations."
        : "Bu bo'lim faqat o'qish rejimida: Finance / Entries backend contractida faqat o'qish amallari documented qilingan."

  const loadRows = async () => {
    try {
      setLoading(true)
      setError("")
      // finance_ledger_list -> api/v1/finance/ledger/ o'qiladi va partnerga bog'langan BANK yozuvlar shu bo'limga tushadi.
      const data = await financeClient.listEntries()
      setRows(
        data
          .filter(isBankDocumentRow)
          .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))
      )
    } catch (e: any) {
      setRows([])
      setError(String(e?.message || copy.loadError))

    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError("")
        // Bank documentlar ledger ichidagi partnerga bog'langan BANK yozuvlaridan yig'iladi.
        const data = await financeClient.listEntries()
        if (!active) return
        setRows(
          data
            .filter(isBankDocumentRow)
            .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))
        )
      } catch (e: any) {
        if (!active) return
        setRows([])
        setError(String(e?.message || copy.loadError))

      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadLookups() {
      try {
        setLookupsLoading(true)
        const [clients, suppliers, employees, orders, purchases] = await Promise.all([
          financeClient.listClientOptions(),
          financeClient.listSupplierOptions(),
          financeClient.listEmployeeOptions(),
          fetchOrderLookupOptions(),
          fetchPurchaseLookupOptions(),
        ])
        if (!active) return
        setClientOptions(clients)
        setSupplierOptions(suppliers)
        setEmployeeOptions(employees)
        setOrderOptions(orders)
        setPurchaseOptions(purchases)
      } catch (e: any) {
        if (!active) return
        setClientOptions([])
        setSupplierOptions([])
        setEmployeeOptions([])
        setOrderOptions([])
        setPurchaseOptions([])
        setError(String(e?.message || copy.lookupError))

      } finally {
        if (active) setLookupsLoading(false)
      }
    }

    loadLookups()
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const income = rows
      .filter((row) => row.entryType === "INCOME")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const expense = rows
      .filter((row) => row.entryType === "EXPENSE")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)
    return [
      { label: copy.statsIncome, value: fmtMoney(income) },
      { label: copy.statsExpense, value: fmtMoney(expense), tone: "amber" as const },

    ]
  }, [rows, copy.statsIncome, copy.statsExpense])

  const activeLookupOptions = useMemo(() => {
    if (createForm.targetKind === "SUPPLIER") return supplierOptions
    if (createForm.targetKind === "EMPLOYEE" || createForm.targetKind === "SALARY") return employeeOptions
    return clientOptions
  }, [clientOptions, supplierOptions, employeeOptions, createForm.targetKind])

  const lookupNameMap = useMemo(() => {
    const map = new Map<string, string>()
    clientOptions.forEach((item) => map.set(`CLIENT:${item.id}`, item.name))
    supplierOptions.forEach((item) => map.set(`SUPPLIER:${item.id}`, item.name))
    employeeOptions.forEach((item) => map.set(`EMPLOYEE:${item.id}`, item.name))
    employeeOptions.forEach((item) => map.set(`SALARY:${item.id}`, item.name))
    orderOptions.forEach((item) => map.set(`ORDER:${item.id}`, item.name))
    purchaseOptions.forEach((item) => map.set(`PURCHASE:${item.id}`, item.name))
    return map
  }, [clientOptions, supplierOptions, employeeOptions, orderOptions, purchaseOptions])

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return rows.filter((row) => {
      const rowDate = String(row.createdAt || row.date || "").slice(0, 10)
      const referenceName = resolveEntryReferenceName(row, lookupNameMap)
      const matchesSearch =
        !search ||
        [
          referenceName,
          row.notes || "",
          row.category || "",
          row.reference || "",
          row.referenceType || "",
          row.currency || "",
          row.paymentMethod || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)

      const matchesEntryType = filters.entryType === "ALL" || row.entryType === filters.entryType
      const matchesPaymentMethod = filters.paymentMethod === "ALL" || row.paymentMethod === filters.paymentMethod
      const matchesDateFrom = !filters.dateFrom || (rowDate && rowDate >= filters.dateFrom)
      const matchesDateTo = !filters.dateTo || (rowDate && rowDate <= filters.dateTo)

      return matchesSearch && matchesEntryType && matchesPaymentMethod && matchesDateFrom && matchesDateTo
    })
  }, [rows, filters, lookupNameMap])

  const openCreateModal = () => {
    setCreateForm(emptyPostingCreateForm())
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!createForm.targetId) {
      toast.error(copy.pickRecord)
      return
    }
    if (parseWholeNumberInput(createForm.amount) <= 0) {
      toast.error(copy.amountInvalid)
      return
    }
    if (!createForm.date) {
      toast.error(copy.pickDate)

      return
    }

    try {
      setSubmitting(true)
      // finance_ledger_create -> partnerga bog'langan bank dokumentlar shu documented endpoint orqali yoziladi.
      await financeClient.createEntry(toBankCreatePayload(createForm, activeLookupOptions))
      setCreateOpen(false)
      setCreateForm(emptyPostingCreateForm())
      await loadRows()
      toast.success(copy.createSuccess)
    } catch (e: any) {
      toast.error(String(e?.message || copy.createError))

    } finally {
      setSubmitting(false)
    }
  }

  const openEditModal = async (id: string) => {
    try {
      setSubmitting(true)
      // finance_ledger_read -> BANK methodli ledger yozuvi shu modalda o'qiladi.
      const row = await financeClient.readEntry(id)
      setEditingId(id)
      setEditForm(toPostingEditForm(row))
      setEditOpen(true)
    } catch (e: any) {
      toast.error(String(e?.message || copy.openError))

    } finally {
      setSubmitting(false)
    }
  }

  const submitEdit = async () => {
    if (!editingId) return
    if (!editForm.category.trim()) {
      toast.error(copy.editCategoryRequired)
      return
    }
    if (!editForm.date) {
      toast.error(copy.pickDate)

      return
    }

    try {
      setSubmitting(true)
      // finance_ledger_partial_upDate -> BANK dokument editida backend faqat category, Date, note ni yangilaydi.
      await financeClient.updateEntry(editingId, {
        category: editForm.category.trim(),
        date: editForm.date,
        notes: editForm.notes.trim() || undefined,
      })
      setEditOpen(false)
      setEditingId(null)
      await loadRows()
      toast.success(copy.updateSuccess)
    } catch (e: any) {
      toast.error(String(e?.message || copy.updateError))

    } finally {
      setSubmitting(false)
    }
  }

  const removeRow = async (id: string) => {
    if (!window.confirm(copy.removeConfirm)) return

    try {
      setSubmitting(true)
      // finance_ledger_delete -> BANK methodli ledger yozuvi shu actiondan o'chiriladi.
      await financeClient.deleteEntry(id)
      await loadRows()
      toast.success(copy.removeSuccess)
    } catch (e: any) {
      toast.error(String(e?.message || copy.removeError))

    } finally {
      setSubmitting(false)
    }
  }

  const {
    page: bankPage,
    setPage: setBankPage,
    totalPages: bankTotalPages,
    pagedItems: pagedBankRows,
  } = useClientPagination(filteredRows, 10, [filteredRows.length])

  useEffect(() => {
    setBankPage(1)
  }, [filters.search, filters.entryType, filters.paymentMethod, filters.dateFrom, filters.dateTo, setBankPage])

  return (
    <WorkspaceFrame
      icon={<Landmark size={22} />}
      title={copy.title}
      description={copy.description}

      stats={stats}
      primary="Manage bank payment documents"
      secondary="Control by account"
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{copy.sectionTitle}</h3>
            <p className="mt-1 text-sm text-slate-600">{copy.sectionDescription}</p>

          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={openCreateModal}
            disabled
            title={readOnlyNotice}
          >
            <Plus size={16} className="mr-2" />
            {copy.newButton}

          </Button>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {readOnlyNotice}
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_180px_180px_180px_180px]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.search}</span>
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={copy.searchPlaceholder}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.filterType}</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.entryType}
              onChange={(e) => setFilters((prev) => ({ ...prev, entryType: e.target.value as FinanceEntry["entryType"] | "ALL" }))}
            >
              <option value="ALL">{copy.all}</option>
              <option value="INCOME">{getEntryTypeLabel(language, "INCOME")}</option>
              <option value="EXPENSE">{getEntryTypeLabel(language, "EXPENSE")}</option>
              <option value="ADJUSTMENT">{getEntryTypeLabel(language, "ADJUSTMENT")}</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.filterMethod}</span>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.paymentMethod}
              onChange={(e) => setFilters((prev) => ({ ...prev, paymentMethod: e.target.value as FinanceEntry["paymentMethod"] | "ALL" }))}
            >
              <option value="ALL">{copy.all}</option>
              <option value="CASH">{getPaymentMethodLabel(language, "CASH")}</option>
              <option value="CARD">{getPaymentMethodLabel(language, "CARD")}</option>
              <option value="BANK">{getPaymentMethodLabel(language, "BANK")}</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.dateFrom}</span>
            <input
              type="date"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.dateFrom}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-600">{copy.dateTo}</span>
            <input
              type="date"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={filters.dateTo}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold">
                <th>{copy.name}</th>
                <th className="text-left">{copy.type}</th>
                <th className="text-center">{copy.amount}</th>
                <th className="text-left">{copy.currency}</th>
                <th>{copy.note}</th>
                <th>{copy.createdAt}</th>
                <th className="text-right">{copy.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedBankRows.map((row) => (
                <tr key={row.id} className="bg-white hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{resolveEntryReferenceName(row, lookupNameMap)}</td>
                  <td className="px-4 py-3"><EntryTypeBadge value={row.entryType} language={language} /></td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtMoney(row.amount, row.currency)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.currency}</td>
                  <td className="px-4 py-3 text-slate-700">{row.notes || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtDateTime(row.createdAt || row.date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => openEditModal(row.id)}
                        disabled
                        title={readOnlyNotice}
                      >

                        {copy.edit}

                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="rounded-xl"
                        onClick={() => removeRow(row.id)}
                        disabled
                        title={readOnlyNotice}
                      >
                        {copy.remove}

                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {copy.empty}
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {copy.loading}

                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!loading && filteredRows.length > 0 ? (
          <div className="mt-4 flex justify-end">
            <TablePagination page={bankPage} totalPages={bankTotalPages} onPageChange={setBankPage} size="sm" />
          </div>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{copy.createTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.category}</span>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  value={createForm.targetKind}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      targetKind: e.target.value as PostingFormState["targetKind"],
                      targetId: "",
                    }))
                  }
                >
                  <option value="CLIENT">{copy.client}</option>
                  <option value="SUPPLIER">{copy.supplier}</option>
                  <option value="EMPLOYEE">{copy.employee}</option>
                </select>

                <select
                  key={`bank-target-${language}-${createForm.targetKind}`}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  value={createForm.targetId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, targetId: e.target.value }))}
                >
                  <option value="">
                    {lookupsLoading ? copy.lookupLoading : getPostingTargetPlaceholder(createForm.targetKind, language)}
                  </option>
                  {activeLookupOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {createForm.targetKind === "EMPLOYEE" ? (
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">{copy.employeePaymentType}</span>

                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                  value={createForm.employeePaymentType}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      employeePaymentType: e.target.value as PostingFormState["employeePaymentType"],
                    }))
                  }
                >
                  <option value="AVANS">{copy.employeeAdvance}</option>
                  <option value="OYLIK">{copy.employeeSalary}</option>
                  <option value="BONUS">{copy.employeeBonus}</option>

                </select>
              </label>
            ) : null}

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.amount}</span>
              <input
                type="text"
                inputMode="numeric"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={createForm.amount}
                onChange={(e) => setCreateForm((p) => ({ ...p, amount: formatWholeNumberInput(e.target.value) }))}
                placeholder={copy.amountPlaceholder}
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.currency}</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={createForm.currency}
                onChange={(e) => setCreateForm((p) => ({ ...p, currency: e.target.value as FinanceEntry["currency"] }))}
              >
                <option value="UZS">UZS</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.date}</span>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={createForm.date}
                onChange={(e) => setCreateForm((p) => ({ ...p, date: e.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">{copy.note}</span>
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2"
                value={createForm.notes}
                onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={copy.notesPlaceholder}
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              {copy.cancel}
            </Button>
            <Button type="button" onClick={submitCreate} disabled={submitting}>
              {copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{copy.editTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.category}</span>
              <input
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={editForm.category}
                onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.date}</span>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={editForm.date}
                onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.note}</span>
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2"
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setEditingId(null)
              }}
              disabled={submitting}
            >
              {copy.cancel}
            </Button>
            <Button type="button" onClick={submitEdit} disabled={submitting}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceFrame>
  )
}

export function MoliyaExchangeRatePage() {
  const { language } = useI18n()
  const [rows, setRows] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<ExchangeRateFormState>(() => emptyExchangeRateForm())
  const [submitting, setSubmitting] = useState(false)

  const copy =
    language === "ru"
      ? { cancel: "Отмена", save: "Сохранить" }
      : language === "en"
        ? { cancel: "Cancel", save: "Save" }
        : { cancel: "Bekor", save: "Saqlash" }

  const load = async () => {
    try {
      setLoading(true)
      setError("")
      const data = await financeClient.listExchangeRates()
      setRows(data)
    } catch (e: any) {
      setRows([])
      setError(String(e?.message || "Failed to load exchange Rates"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const currentRate = useMemo(() => rows.find((row) => row.isActive) || rows[0] || null, [rows])
  const previousRate = useMemo(() => {
    if (!currentRate) return null
    return rows.find((row) => row.id !== currentRate.id) || null
  }, [currentRate, rows])

  const stats = useMemo(() => {
    const delta = currentRate && previousRate ? currentRate.rate - previousRate.rate : 0
    return [
      { label: "Current rate", value: currentRate ? `${fmtRate(currentRate.rate)} UZS` : "-" },
      {
        label: "Latest change",
        value:
          currentRate && previousRate
            ? `${delta >= 0 ? "+" : "-"}${fmtRate(Math.abs(delta))} UZS`
            : "-",
        tone: delta >= 0 ? "amber" as const : "emerald" as const,
      },
      {
        label: "Latest update",
        value: currentRate ? fmtDate(currentRate.date) : "-",
        tone: "emerald" as const,
      },
    ]
  }, [currentRate, previousRate])

  const latestItems = useMemo(() => {
    if (!rows.length) return ["No exchange-rate data was returned from the backend."]
    return rows.slice(0, 3).map((row) => `${fmtDate(row.date)} - ${fmtRate(row.rate)} ${row.currency}`)
  }, [rows])

  const {
    page: exchangeRatePage,
    setPage: setExchangeRatePage,
    totalPages: exchangeRateTotalPages,
    pagedItems: pagedExchangeRateRows,
  } = useClientPagination(rows, 10, [rows.length])

  async function submitCreate() {
    const rate = parseWholeNumberInput(createForm.rate)
    if (rate <= 0) {
      toast.error("Invalid rate")
      return
    }
    if (!createForm.date) {
      toast.error("Select a date")
      return
    }

    try {
      setSubmitting(true)
      await financeClient.createExchangeRate({
        currency: createForm.currency,
        rate,
        date: createForm.date,
        source: createForm.source.trim() || "Manual",
      })
      toast.success("Exchange rate saved")
      setCreateForm(emptyExchangeRateForm())
      setCreateOpen(false)
      await load()
    } catch (e: any) {
      toast.error(String(e?.message || "Failed to save the exchange rate"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WorkspaceFrame
      icon={<TrendingUp size={22} />}
      title="Exchange Rates"
      description="Manage exchange rates, updates, and recent history in one place."
      stats={stats}
      primary="Add daily rate"
      secondary="Track rate changes"
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionToolbar
          title="Rate table"
          description="Control panel for rate history and new entries."
          buttonLabel="Create new"
          onClick={() => setCreateOpen(true)}
          disabled={submitting}
        />

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold">
                <th>Date</th>
                <th>Currency</th>
                <th className="text-right">Rate</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedExchangeRateRows.map((row) => (
                <tr key={row.id} className="bg-white hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{fmtDate(row.date)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.currency}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtRate(row.rate)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.source || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={row.status} />
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No data found
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 ? (
          <div className="mt-4 flex justify-end">
            <TablePagination
              page={exchangeRatePage}
              totalPages={exchangeRateTotalPages}
              onPageChange={setExchangeRatePage}
              size="sm"
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Joriy aktiv kurs</h3>
        <div className={`mt-4 grid gap-3 ${stats.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">Currency</div>
              <div className="mt-1 font-semibold text-slate-900">{currentRate?.currency || "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">Rate</div>
              <div className="mt-1 font-semibold text-slate-900">{currentRate ? fmtRate(currentRate.rate) : "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">Date</div>
              <div className="mt-1 font-semibold text-slate-900">{currentRate ? fmtDate(currentRate.date) : "-"}</div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            Rates are read from the backend endpoint and saved back through this modal.
          </div>
        </div>
        <InfoPanel title="Recent rates" items={latestItems} />
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Add new rate</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Currency</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={createForm.currency}
                onChange={(e) => setCreateForm((p) => ({ ...p, currency: e.target.value as ExchangeRateInput["currency"] }))}
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Rate</span>
              <input
                type="text"
                inputMode="numeric"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={createForm.rate}
                onChange={(e) => setCreateForm((p) => ({ ...p, rate: formatWholeNumberInput(e.target.value) }))}
                placeholder="12780"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Date</span>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={createForm.date}
                onChange={(e) => setCreateForm((p) => ({ ...p, date: e.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Source</span>
              <input
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={createForm.source}
                onChange={(e) => setCreateForm((p) => ({ ...p, source: e.target.value }))}
                placeholder="Manual"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false)
                setCreateForm(emptyExchangeRateForm())
              }}
              disabled={submitting}
            >
              {copy.cancel}
            </Button>
            <Button type="button" onClick={submitCreate} disabled={submitting}>
              {copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceFrame>
  )
}

export function MoliyaPayrollPage() {
  const { language } = useI18n()
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string; role: string; baseSalary: number; currency: string }>>([])
  const [ledgerRows, setLedgerRows] = useState<FinanceEntry[]>([])
  const [postingRows, setPostingRows] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PayrollPaymentFormState>(() => emptyPayrollPaymentForm())

  const copy =
    language === "ru"
      ? {
          pageTitle: "Зарплата сотрудников",
          pageDescription: "Отдел зарплат сотрудников",
          pagePrimary: "Формирование реестра зарплаты",
          pageSecondary: "Аналитика по подразделениям",
          statsEmployees: "Список сотрудников",
          statsFund: "Фонд зарплаты",
          statsPaid: "Заработанная плата",
          countSuffix: "шт",
          registryTitle: "Реестр зарплаты",
          registryDescription: "",
          newButton: "Новый платёж",
          tableEmployee: "Сотрудник",
          tableDepartment: "Отдел",
          tableSalary: "Зарплата",
          tablePaid: "Оплачено",
          tableDebt: "Остаток",
          tableStatus: "Статус",
          tableAction: "Действие",
          pay: "Оплатить",
          empty: "Данные не найдены",
          loading: "Загрузка...",
          loadError: "Зарплата сотрудников не загрузилась",
          pickEmployee: "Выберите сотрудника",
          amountInvalid: "Некорректная сумма",
          pickDate: "Выберите дату",
          paymentSuccess: "Выплата зарплаты создана",
          paymentError: "Ошибка при выплате зарплаты",
          statusPaid: "Оплачено",
          statusPartial: "Частично оплачено",
          statusPending: "Ожидает оплаты",
          paymentTitle: "Создать выплату зарплаты",
          employee: "Сотрудник",
          selectEmployee: "выберите сотрудника",
          paymentType: "Тип выплаты",
          method: "Метод",
          amount: "Сумма",
          currency: "Валюта",
          date: "Дата",
          note: "Комментарий",
          notePlaceholder: "Зарплата за февраль",
          cancel: "Отмена",
          save: "Сохранить",
          advance: "Аванс",
          salary: "Зарплата",
          bonus: "Бонус",
        }
      : language === "en"
        ? {
            pageTitle: "Payroll",
            pageDescription: "Employee payroll department",
            pagePrimary: "Build payroll register",
            pageSecondary: "Department analytics",
            statsEmployees: "Employee list",
            statsFund: "Payroll fund",
            statsPaid: "Paid salary",
            countSuffix: "pcs",
            registryTitle: "Payroll register",
            registryDescription: "",
            newButton: "New payment",
            tableEmployee: "Employee",
            tableDepartment: "Department",
            tableSalary: "Salary",
            tablePaid: "Paid",
            tableDebt: "Balance",
            tableStatus: "Status",
            tableAction: "Action",
            pay: "Pay",
            empty: "No data found",
            loading: "Loading...",
            loadError: "Payroll failed to load",
            pickEmployee: "Select employee",
            amountInvalid: "Invalid amount",
            pickDate: "Select a date",
            paymentSuccess: "Salary payment created",
            paymentError: "Salary payment failed",
            statusPaid: "Paid",
            statusPartial: "Partially paid",
            statusPending: "Pending",
            paymentTitle: "Create salary payment",
            employee: "Employee",
            selectEmployee: "select employee",
            paymentType: "Payment type",
            method: "Method",
            amount: "Amount",
            currency: "Currency",
            date: "Date",
            note: "Comment",
            notePlaceholder: "February salary",
            cancel: "Cancel",
            save: "Save",
            advance: "Advance",
            salary: "Salary",
            bonus: "Bonus",
          }
        : {
            pageTitle: "Xodimlar oyligi",
            pageDescription: "Xodimlar ish haqi bo'limi",
            pagePrimary: "Oylik reyestrini shakllantirish",
            pageSecondary: "Bo'limlar kesimida tahlil",
            statsEmployees: "Xodimlar ro'yxati",
            statsFund: "Ish haqi fondi",
            statsPaid: "To'langan ish haqi",
            countSuffix: "ta",
            registryTitle: "Oylik reyestri",
            registryDescription: "",
            newButton: "Yangi to'lov",
            tableEmployee: "Xodim",
            tableDepartment: "Bo'lim",
            tableSalary: "Oylik",
            tablePaid: "To'langan",
            tableDebt: "Qoldiq",
            tableStatus: "Status",
            tableAction: "Amal",
            pay: "To'lash",
            empty: "Ma'lumot topilmadi",
            loading: "Yuklanmoqda...",
            loadError: "Xodimlar oyligi yuklanmadi",
            pickEmployee: "Xodimni tanlang",
            amountInvalid: "Summa noto'g'ri",
            pickDate: "Sana tanlang",
            paymentSuccess: "Ish haqi to'lovi yaratildi",
            paymentError: "Ish haqi to'lovida xatolik",
            statusPaid: "To'langan",
            statusPartial: "Qisman to'langan",
            statusPending: "Kutilmoqda",
            paymentTitle: "Ish haqi to'lovini yaratish",
            employee: "Xodim",
            selectEmployee: "xodimni tanlang",
            paymentType: "To'lov turi",
            method: "Metod",
            amount: "Summa",
            currency: "Valyuta",
            date: "Sana",
            note: "Izoh",
            notePlaceholder: "Fevral oyligi",
            cancel: "Bekor",
            save: "Saqlash",
            advance: "Avans",
            salary: "Oylik",
            bonus: "Bonus",
          }

  const loadRows = async () => {
    try {
      setLoading(true)
      setError("")
      const [employeeRows, entries, postings] = await Promise.all([
        financeClient.listEmployees(),
        financeClient.listEntries(),
        financeClient.listPostings(),
      ])
      setEmployees(employeeRows)
      setLedgerRows(entries)
      setPostingRows(postings)
    } catch (e: any) {
      setEmployees([])
      setLedgerRows([])
      setPostingRows([])
      setError(String(e?.message || copy.loadError))

    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void loadRows()
  }, [])

  const payrollRows = useMemo(() => {
    const paidMap = new Map<string, number>()

      ;[...ledgerRows, ...postingRows].forEach((entry) => {
        const refType = String(entry.referenceType || "").toUpperCase()
        if (refType !== "EMPLOYEE" && refType !== "SALARY") return
        if (entry.entryType !== "EXPENSE") return
        const refId = String(entry.referenceId || "").trim()
        if (!refId) return
        paidMap.set(refId, (paidMap.get(refId) || 0) + Number(entry.amount || 0))
      })

    return employees.map((employee) => {
      const paid = paidMap.get(String(employee.id)) || 0
      const debt = Math.max(Number(employee.baseSalary || 0) - paid, 0)
      return {
        id: employee.id,
        employee: employee.fullName,
        department: employee.role,
        amount: Number(employee.baseSalary || 0),
        paid,
        debt,
        currency: employee.currency || "UZS",
        status: debt <= 0 ? copy.statusPaid : paid > 0 ? copy.statusPartial : copy.statusPending,
      }
    })
  }, [employees, ledgerRows, postingRows, copy.statusPaid, copy.statusPartial, copy.statusPending])

  const stats = useMemo(() => {
    const totalFund = payrollRows.reduce((sum, row) => sum + row.amount, 0)
    const totalPaid = payrollRows.reduce((sum, row) => sum + row.paid, 0)
    return [
      { label: copy.statsEmployees, value: `${payrollRows.length} ${copy.countSuffix}` },
      { label: copy.statsFund, value: fmtMoney(totalFund), tone: "blue" as const },
      { label: copy.statsPaid, value: fmtMoney(totalPaid), tone: "emerald" as const },
    ]
  }, [payrollRows, copy.statsEmployees, copy.countSuffix, copy.statsFund, copy.statsPaid])

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        id: String(employee.id),
        name: employee.fullName,
      })),
    [employees]
  )

  const {
    page: payrollPage,
    setPage: setPayrollPage,
    totalPages: payrollTotalPages,
    pagedItems: pagedPayrollRows,
  } = useClientPagination(payrollRows, 10, [payrollRows.length])

  const openPaymentModal = (employeeId?: string) => {
    const next = emptyPayrollPaymentForm()
    const targetRow = employeeId
      ? payrollRows.find((row) => String(row.id) === String(employeeId))
      : payrollRows.find((row) => row.debt > 0) || payrollRows[0]

    if (targetRow) {
      next.employeeId = String(targetRow.id)
      next.amount = targetRow.debt > 0 ? formatWholeNumberInput(String(Math.trunc(targetRow.debt))) : ""
      next.currency = targetRow.currency as FinanceEntry["currency"]
    }

    setPaymentForm(next)
    setPaymentOpen(true)
  }

  const submitPayment = async () => {
    if (!paymentForm.employeeId) {
      toast.error(copy.pickEmployee)
      return
    }
    if (parseWholeNumberInput(paymentForm.amount) <= 0) {
      toast.error(copy.amountInvalid)
      return
    }
    if (!paymentForm.date) {
      toast.error(copy.pickDate)
      return
    }
    try {
      setSubmitting(true)
      const notePrefix = `[${paymentForm.paymentType}] `
      await financeClient.paySalary({
        employeeId: Number(paymentForm.employeeId),
        method: paymentForm.paymentMethod,
        amount: parseWholeNumberInput(paymentForm.amount),
        currency: paymentForm.currency,
        occurredOn: paymentForm.date,
        note: `${notePrefix}${paymentForm.note.trim()}`.trim() || undefined,
        paymentType: paymentForm.paymentType,
      })
      setPaymentOpen(false)
      setPaymentForm(emptyPayrollPaymentForm())
      await loadRows()
      toast.success(copy.paymentSuccess)
    } catch (e: any) {
      toast.error(String(e?.message || copy.paymentError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WorkspaceFrame
      icon={<Users size={22} />}
      title={copy.pageTitle}
      description={copy.pageDescription}
      stats={stats}
      primary={copy.pagePrimary}
      secondary={copy.pageSecondary}
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionToolbar
          title={copy.registryTitle}
          description={copy.registryDescription}
          buttonLabel={copy.newButton}
          onClick={() => openPaymentModal()}
          disabled={submitting || employees.length === 0}
        />

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold">
                <th>{copy.tableEmployee}</th>
                <th>{copy.tableDepartment}</th>
                <th className="text-right">{copy.tableSalary}</th>
                <th className="text-right">{copy.tablePaid}</th>
                <th className="text-right">{copy.tableDebt}</th>
                <th>{copy.tableStatus}</th>
                <th className="text-right">{copy.tableAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedPayrollRows.map((row) => (
                <tr key={row.id} className="bg-white hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{row.employee}</td>
                  <td className="px-4 py-3 text-slate-700">{row.department}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtMoney(row.amount, row.currency)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(row.paid, row.currency)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(row.debt, row.currency)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => openPaymentModal(String(row.id))}
                        disabled={submitting || row.debt <= 0}
                      >
                        {copy.pay}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && payrollRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {copy.empty}
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {copy.loading}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!loading && payrollRows.length > 0 ? (
          <div className="mt-4 flex justify-end">
            <TablePagination page={payrollPage} totalPages={payrollTotalPages} onPageChange={setPayrollPage} size="sm" />
          </div>
        ) : null}
      </div>
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{copy.paymentTitle}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">{copy.employee}</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={paymentForm.employeeId}
                onChange={(e) => {
                  const employeeId = e.target.value
                  const targetRow = payrollRows.find((row) => String(row.id) === employeeId)
                  setPaymentForm((prev) => ({
                    ...prev,
                    employeeId,
                    amount: targetRow ? formatWholeNumberInput(String(Math.trunc(targetRow.debt || targetRow.amount))) : prev.amount,
                    currency: (targetRow?.currency || prev.currency) as FinanceEntry["currency"],
                  }))
                }}
              >
                <option value="">{copy.selectEmployee}</option>
                {employeeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.paymentType}</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={paymentForm.paymentType}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentType: e.target.value as PayrollPaymentFormState["paymentType"],
                  }))
                }
              >
                <option value="AVANS">{copy.advance}</option>
                <option value="OYLIK">{copy.salary}</option>
                <option value="BONUS">{copy.bonus}</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.method}</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={paymentForm.paymentMethod}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentMethod: e.target.value as FinanceEntry["paymentMethod"],
                  }))
                }
              >
                <option value="CASH">{getPaymentMethodLabel(language, "CASH")}</option>
                <option value="CARD">{getPaymentMethodLabel(language, "CARD")}</option>
                <option value="BANK">{getPaymentMethodLabel(language, "BANK")}</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.amount}</span>
              <input
                type="text"
                inputMode="numeric"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: formatWholeNumberInput(e.target.value) }))}
                placeholder="1500000"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.currency}</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3"
                value={paymentForm.currency}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    currency: e.target.value as FinanceEntry["currency"],
                  }))
                }
              >
                <option value="UZS">UZS</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">{copy.date}</span>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-slate-200 px-3"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </label>

            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">{copy.note}</span>
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder={copy.notePlaceholder}
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPaymentOpen(false)
                setPaymentForm(emptyPayrollPaymentForm())
              }}
              disabled={submitting}
            >
              {copy.cancel}
            </Button>
            <Button type="button" onClick={submitPayment} disabled={submitting}>
              {copy.save}

            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceFrame>
  )
}
export function MoliyaDebtsPage() {
  return <MoliyaClientDebtsPage />
}
