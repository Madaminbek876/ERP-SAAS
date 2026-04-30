import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  PackageSearch,
  RefreshCcw,
  Sparkles,
  Users2,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react"
import TablePagination from "@/components/common/TablePagination"
import { useClientPagination } from "@/components/common/useClientPagination"
import { cn } from "@/lib/utils"
import { http } from "@/shared/http"
import { useI18n, type LanguageCode } from "@/i18n"
import { fetchAllFinanceDebtRows, type FinanceDebtPartyApiRow } from "../shared/debtsApi"
import { financeClient } from "../shared/financeClient"
import type { Employee, FinanceEntry } from "../shared/types"
import { fetchPurchases, fetchPurchase } from "@/Api/purchases.api"
import type { PurchaseDetail, PurchaseListItem } from "@/pages/purchases/types"
import { fetchOrderDetail, fetchOrders } from "@/pages/orders/api/ordersApi"

type DebtApiRow = FinanceDebtPartyApiRow

type OrderApiRow = {
  id?: number
  client_id?: number | string
  client_code?: string
  client_name?: string
  total?: number
  paid_amount?: number
  remaining?: number
}

type DebtViewRow = {
  id: number | string
  counterpartyName: string
  totalOrderSum: number
  prePaidSum: number
  newOrderTotalSum: number
  paidSum: number
  debtSum: number
}

type OrderDocumentListRow = {
  id: number
  client_id?: number | string
  client_name?: string
  order_no?: string
  order_date?: string
  status?: string
  payment_status?: string
  currency?: string
  total?: number
  paid_amount?: number
  remaining?: number
  delivery_date?: string | null
}

type OrderDocumentDetail = {
  id: number
  order_no?: string
  client?: { name?: string | null; code?: string | null } | null
  order_date?: string
  status?: string
  payment_status?: string
  currency?: string
  total?: number
  paid_amount?: number
  remaining?: number
  delivery_date?: string | null
  delivery_address?: string | null
  items?: Array<{
    id: number
    product_name?: string | null
    raw_material_name?: string | null
    qty?: string | number
    unit_price?: number
    line_total?: number
  }>
}

type PartyDocumentItem = {
  id: string
  name: string
  qtyLabel: string
  unitPrice: number
  lineTotal: number
}

type StatusTone = "success" | "warning" | "info" | "danger" | "default"

type PartyDocument = {
  id: number
  code: string
  documentLabel: string
  date: string
  total: number
  paidAmount: number
  remaining: number
  currency: string
  statusLabel: string
  paymentLabel: string
  statusTone: StatusTone
  paymentTone: StatusTone
  metaLabel: string
  routePath: string
  items: PartyDocumentItem[]
}

type PartyDocumentsState = {
  key: string
  kind: "clients" | "suppliers"
  partyName: string
  documents: PartyDocument[]
}

type EmployeeSalaryRow = {
  id: string
  fullName: string
  role: string
  baseSalary: number
  advancePaid: number
  salaryPaid: number
  bonusPaid: number
  remainingSalary: number
  currency: string
}

type DebtKind = "clients" | "suppliers" | "employees"

type SummaryTone = "sky" | "emerald" | "amber" | "slate"

type SummaryCardItem = {
  label: string
  value: string
  hint: string
  tone: SummaryTone
  icon: LucideIcon
}

type SpotlightCard = {
  label: string
  name: string
  value: string
  caption: string
}

type DebtTabMeta = {
  tabLabel: string
  tabDescription: string
  eyebrow: string
  heroTitle: string
  description: string
  spotlightLabel: string
  icon: LucideIcon
  gradientClass: string
}

const DEBT_TAB_VISUALS: Record<DebtKind, Pick<DebtTabMeta, "icon" | "gradientClass">> = {
  clients: {
    icon: Users2,
    gradientClass: "bg-[linear-gradient(135deg,#052f52_0%,#0f4c81_48%,#0ea5a3_120%)]",
  },
  suppliers: {
    icon: Building2,
    gradientClass: "bg-[linear-gradient(135deg,#172554_0%,#0f4c81_52%,#0f766e_120%)]",
  },
  employees: {
    icon: WalletCards,
    gradientClass: "bg-[linear-gradient(135deg,#082f49_0%,#155e75_48%,#0f766e_120%)]",
  },
}

function toNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function getDebtTabMeta(language: LanguageCode): Record<DebtKind, DebtTabMeta> {
  if (language === "ru") {
    return {
      clients: {
        tabLabel: "Клиенты",
        tabDescription: "Срез дебиторки",
        eyebrow: "Контроль задолженности клиентов",
        heroTitle: "Следите за задолженностью клиентов в понятном срезе",
        description: "Заказы, оплаты и авансы собраны в одной панели.",
        spotlightLabel: "Наибольший баланс",
        ...DEBT_TAB_VISUALS.clients,
      },
      suppliers: {
        tabLabel: "Поставщики",
        tabDescription: "Поток кредиторки",
        eyebrow: "Расчеты с поставщиками",
        heroTitle: "Централизуйте расчеты с поставщиками",
        description: "Остаток к оплате, авансы и нагрузка на портфель видны в одном месте.",
        spotlightLabel: "Наибольший баланс",
        ...DEBT_TAB_VISUALS.suppliers,
      },
      employees: {
        tabLabel: "Сотрудники",
        tabDescription: "Фокус на зарплате",
        eyebrow: "Отчет по зарплате сотрудников",
        heroTitle: "Управляйте зарплатой сотрудников по месяцам без ошибок",
        description: "Авансы, зарплата и бонусы за этот месяц собраны в одном окне.",
        spotlightLabel: "Наибольший остаток",
        ...DEBT_TAB_VISUALS.employees,
      },
    }
  }
  if (language === "en") {
    return {
      clients: {
        tabLabel: "Clients",
        tabDescription: "Receivables snapshot",
        eyebrow: "Monitor client receivables",
        heroTitle: "Track client receivables with a clear snapshot",
        description: "Orders, payments, and advances are combined in one panel.",
        spotlightLabel: "Largest balance",
        ...DEBT_TAB_VISUALS.clients,
      },
      suppliers: {
        tabLabel: "Suppliers",
        tabDescription: "Payables flow",
        eyebrow: "Supplier settlement overview",
        heroTitle: "Centralize supplier settlements",
        description: "Outstanding payables, advances, and portfolio pressure appear in one place.",
        spotlightLabel: "Largest balance",
        ...DEBT_TAB_VISUALS.suppliers,
      },
      employees: {
        tabLabel: "Employees",
        tabDescription: "Payroll focus",
        eyebrow: "Employee payroll overview",
        heroTitle: "Manage employee payroll accurately by month",
        description: "Advances, salaries, and bonuses for this month appear in one view.",
        spotlightLabel: "Largest balance",
        ...DEBT_TAB_VISUALS.employees,
      },
    }
  }
  return {
    clients: {
      tabLabel: "Mijozlar",
      tabDescription: "Debitorlik ko'rinishi",
      eyebrow: "Mijozlar qarzini nazorat qilish",
      heroTitle: "Mijozlar qarzdorligini aniq ko'rinishda kuzating",
      description: "Buyurtma, to'lov va avans oqimlari bitta panelda jamlandi.",
      spotlightLabel: "Eng katta balans",
      ...DEBT_TAB_VISUALS.clients,
    },
    suppliers: {
      tabLabel: "Yetkazib beruvchilar",
      tabDescription: "Kreditorlik oqimi",
      eyebrow: "Yetkazib beruvchilar bilan hisob-kitoblar",
      heroTitle: "Yetkazib beruvchilar bilan hisob-kitobni markazlashtiring",
      description: "To'lanadigan qoldiq, avans va portfel bosimi bir joyda ko'rinadi.",
      spotlightLabel: "Eng katta balans",
      ...DEBT_TAB_VISUALS.suppliers,
    },
    employees: {
      tabLabel: "Xodimlar",
      tabDescription: "Ish haqi nazorati",
      eyebrow: "Xodimlar ish haqi hisobotlari",
      heroTitle: "Xodimlar ish haqini oy kesimida aniq boshqaring",
      description: "Avans, oylik va bonus oqimlari shu oy uchun bir joyda ko'rinadi.",
      spotlightLabel: "Eng katta qoldiq",
      ...DEBT_TAB_VISUALS.employees,
    },
  }
}

function moneyLabel(language: LanguageCode, currency?: string) {
  if (currency) return currency
  if (language === "ru") return "сум"
  if (language === "en") return "UZS"
  return "so'm"
}

function fmtMoney(v: number, locale: string, language: LanguageCode, currency?: string) {
  return `${new Intl.NumberFormat(locale).format(toNum(v))} ${moneyLabel(language, currency)}`
}

const PARTY_DOCUMENTS_PAGE_SIZE = 100

function fmtDate(v: string | null | undefined, locale: string) {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return new Intl.DateTimeFormat(locale).format(d)
}

function fmtQty(v: string | number | null | undefined, locale: string) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v ?? "-")
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)
}

function toPositiveId(v: unknown) {
  const n = Number(String(v ?? "").trim())
  return Number.isInteger(n) && n > 0 ? n : null
}

function buildPartyKey(kind: "clients" | "suppliers", row: DebtViewRow) {
  return `${kind}:${String(row.id || "").trim() || comparablePartyName(row.counterpartyName)}`
}

function getNoStatusLabel(language: LanguageCode) {
  if (language === "ru") return "Без статуса"
  if (language === "en") return "No status"
  return "Statussiz"
}

function formatOrderStatusLabel(status: string | undefined, language: LanguageCode) {
  const value = String(status || "").toUpperCase()
  if (language === "ru") {
    if (value === "NEW") return "Новый"
    if (value === "IN_PROGRESS") return "В процессе"
    if (value === "READY") return "Готов"
    if (value === "ON_DELIVERY") return "Доставляется"
    if (value === "DELIVERED") return "Доставлен"
    if (value === "CANCELLED") return "Отменен"
  } else if (language === "en") {
    if (value === "NEW") return "New"
    if (value === "IN_PROGRESS") return "In progress"
    if (value === "READY") return "Ready"
    if (value === "ON_DELIVERY") return "On delivery"
    if (value === "DELIVERED") return "Delivered"
    if (value === "CANCELLED") return "Cancelled"
  } else {
    if (value === "NEW") return "Yangi"
    if (value === "IN_PROGRESS") return "Jarayonda"
    if (value === "READY") return "Tayyor"
    if (value === "ON_DELIVERY") return "Yetkazilmoqda"
    if (value === "DELIVERED") return "Yetkazilgan"
    if (value === "CANCELLED") return "Bekor qilingan"
  }
  return value || getNoStatusLabel(language)
}

function formatPurchaseStatusLabel(status: string | undefined, language: LanguageCode) {
  const value = String(status || "").toUpperCase()
  if (language === "ru") {
    if (value === "DRAFT") return "Черновик"
    if (value === "CONFIRMED") return "Подтвержден"
    if (value === "CANCELLED") return "Отменен"
  } else if (language === "en") {
    if (value === "DRAFT") return "Draft"
    if (value === "CONFIRMED") return "Confirmed"
    if (value === "CANCELLED") return "Cancelled"
  } else {
    if (value === "DRAFT") return "Qoralama"
    if (value === "CONFIRMED") return "Tasdiqlangan"
    if (value === "CANCELLED") return "Bekor qilingan"
  }
  return value || getNoStatusLabel(language)
}

function formatPaymentStatusLabel(status: string | undefined, paidAmount: number | undefined, total: number | undefined, language: LanguageCode) {
  const paid = toNum(paidAmount)
  const totalAmount = toNum(total)
  const normalized = String(status || "").toUpperCase()
  if (language === "ru") {
    if (normalized === "PAID" || (totalAmount > 0 && paid >= totalAmount)) return "Оплачено"
    if (normalized === "PARTIAL" || normalized === "PARTIALLY_PAID" || paid > 0) return "Частично оплачено"
    return "Не оплачено"
  }
  if (language === "en") {
    if (normalized === "PAID" || (totalAmount > 0 && paid >= totalAmount)) return "Paid"
    if (normalized === "PARTIAL" || normalized === "PARTIALLY_PAID" || paid > 0) return "Partially paid"
    return "Unpaid"
  }
  if (normalized === "PAID" || (totalAmount > 0 && paid >= totalAmount)) return "To'langan"
  if (normalized === "PARTIAL" || normalized === "PARTIALLY_PAID" || paid > 0) return "Qisman to'langan"
  return "To'lanmagan"
}

function orderStatusTone(status?: string): StatusTone {
  const value = String(status || "").toUpperCase()
  if (value === "DELIVERED") return "success"
  if (value === "IN_PROGRESS" || value === "ON_DELIVERY") return "warning"
  if (value === "NEW" || value === "READY") return "info"
  if (value === "CANCELLED") return "danger"
  return "default"
}

function purchaseStatusTone(status?: string): StatusTone {
  const value = String(status || "").toUpperCase()
  if (value === "CONFIRMED") return "success"
  if (value === "DRAFT") return "info"
  if (value === "CANCELLED") return "danger"
  return "default"
}

function paymentStatusTone(status?: string, paidAmount?: number, total?: number): StatusTone {
  const paid = toNum(paidAmount)
  const totalAmount = toNum(total)
  const normalized = String(status || "").toUpperCase()
  if (normalized === "PAID" || (totalAmount > 0 && paid >= totalAmount)) return "success"
  if (normalized === "PARTIAL" || normalized === "PARTIALLY_PAID" || paid > 0) return "warning"
  return "default"
}

function documentStatusToneClass(tone: StatusTone) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700"
  if (tone === "info") return "border-sky-200 bg-sky-50 text-sky-700"
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700"
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function mapOrderDocument(row: OrderDocumentListRow, detail: OrderDocumentDetail, language: LanguageCode, locale: string): PartyDocument {
  const documentId = Number(detail.id ?? row.id ?? 0)
  const items = Array.isArray(detail.items) ? detail.items : []
  const status = detail.status ?? row.status
  const paymentStatus = detail.payment_status ?? row.payment_status

  return {
    id: documentId,
    code: String(detail.order_no ?? row.order_no ?? `#${documentId}`),
    documentLabel: language === "ru" ? "Заказ" : language === "en" ? "Order" : "Buyurtma",
    date: String(detail.order_date ?? row.order_date ?? ""),
    total: toNum(detail.total ?? row.total),
    paidAmount: toNum(detail.paid_amount ?? row.paid_amount),
    remaining: toNum(detail.remaining ?? row.remaining),
    currency: String(detail.currency ?? row.currency ?? "UZS"),
    statusLabel: formatOrderStatusLabel(status, language),
    paymentLabel: formatPaymentStatusLabel(paymentStatus, detail.paid_amount ?? row.paid_amount, detail.total ?? row.total, language),
    statusTone: orderStatusTone(status),
    paymentTone: paymentStatusTone(paymentStatus, detail.paid_amount ?? row.paid_amount, detail.total ?? row.total),
    metaLabel: detail.delivery_date
      ? `${language === "ru" ? "Доставка" : language === "en" ? "Delivery" : "Yetkazish"}: ${fmtDate(detail.delivery_date, locale)}`
      : language === "ru"
        ? "Заказ на продажу"
        : language === "en"
          ? "Sales order"
          : "Sotuv buyurtmasi",
    routePath: `/sotuv/orders/${documentId}`,
    items: items.map((item, index) => ({
      id: String(item.id ?? `${documentId}-${index}`),
      name: String(
        item.product_name ??
        item.raw_material_name ??
        `${language === "ru" ? "Позиция" : language === "en" ? "Position" : "Pozitsiya"} #${index + 1}`
      ),
      qtyLabel: fmtQty(item.qty, locale),
      unitPrice: toNum(item.unit_price),
      lineTotal: toNum(item.line_total),
    })),
  }
}

function mapPurchaseDocument(row: PurchaseListItem, detail: PurchaseDetail, language: LanguageCode, locale: string): PartyDocument {
  const documentId = Number(detail.id ?? row.id ?? 0)
  const items = Array.isArray(detail.items) ? detail.items : []
  const status = detail.status ?? row.status
  const paymentStatus = detail.payment_status ?? row.payment_status

  return {
    id: documentId,
    code: String(detail.purchase_no ?? row.purchase_no ?? `#${documentId}`),
    documentLabel: language === "ru" ? "Закупка" : language === "en" ? "Purchase" : "Xarid",
    date: String(detail.received_date ?? row.received_date ?? detail.created_at ?? row.created_at ?? ""),
    total: toNum(detail.total ?? row.total),
    paidAmount: toNum(detail.paid_amount ?? row.paid_amount),
    remaining: Math.max(toNum(detail.total ?? row.total) - toNum(detail.paid_amount ?? row.paid_amount), 0),
    currency: String(detail.currency ?? row.currency ?? "UZS"),
    statusLabel: formatPurchaseStatusLabel(status, language),
    paymentLabel: formatPaymentStatusLabel(paymentStatus, detail.paid_amount ?? row.paid_amount, detail.total ?? row.total, language),
    statusTone: purchaseStatusTone(status),
    paymentTone: paymentStatusTone(paymentStatus, detail.paid_amount ?? row.paid_amount, detail.total ?? row.total),
    metaLabel: detail.location_name
      ? `${language === "ru" ? "Локация" : language === "en" ? "Location" : "Joylashuv"}: ${detail.location_name}`
      : language === "ru"
        ? "Документ поставки"
        : language === "en"
          ? "Supply document"
          : "Ta'minot hujjati",
    routePath: `/dashboard/sklad/warehouse/purchases/${documentId}`,
    items: items.map((item, index) => ({
      id: String(item.id ?? `${documentId}-${index}`),
      name: String(item.raw_material_name ?? `${language === "ru" ? "Материал" : language === "en" ? "Material" : "Material"} #${index + 1}`),
      qtyLabel: fmtQty(item.qty, locale),
      unitPrice: toNum(item.unit_price),
      lineTotal: toNum(item.line_total),
    })),
  }
}

async function fetchClientDocuments(row: DebtViewRow, dateTo: string, language: LanguageCode, locale: string) {
  const documents: OrderDocumentListRow[] = []
  let page = 1
  let hasNext = true
  const clientId = toPositiveId(row.id)

  while (hasNext) {
    const res = await fetchOrders({
      page,
      page_size: PARTY_DOCUMENTS_PAGE_SIZE,
      client: clientId || undefined,
      search: clientId ? undefined : row.counterpartyName,
      date_to: dateTo,
      ordering: "-order_date",
    })
    const list = normalizeListResponse<OrderDocumentListRow>(res.results || [])
    const filtered = list.filter((item) =>
      clientId
        ? toPositiveId(item.client_id) === clientId
        : isLoosePartyNameMatch(String(item.client_name || ""), row.counterpartyName)
    )
    documents.push(...filtered)

    const pageFull = list.length === PARTY_DOCUMENTS_PAGE_SIZE
    hasNext = Boolean(res.next) || pageFull
    page += 1

    if (list.length === 0) hasNext = false
  }

  const details = await Promise.all(
    documents.map(async (item) => mapOrderDocument(item, (await fetchOrderDetail(item.id)) as OrderDocumentDetail, language, locale))
  )

  return details.sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`))
}

async function fetchSupplierDocuments(row: DebtViewRow, dateTo: string, language: LanguageCode, locale: string) {
  const documents: PurchaseListItem[] = []
  let page = 1
  let hasNext = true
  const supplierId = toPositiveId(row.id)

  while (hasNext) {
    const res = await fetchPurchases({
      page,
      page_size: PARTY_DOCUMENTS_PAGE_SIZE,
      supplier: supplierId || undefined,
      search: supplierId ? undefined : row.counterpartyName,
      date_to: dateTo,
      ordering: "-created_at",
    })
    const list = normalizeListResponse<PurchaseListItem>(res.results || [])
    const filtered = list.filter((item) =>
      supplierId
        ? toPositiveId(item.supplier) === supplierId
        : isLoosePartyNameMatch(String(item.supplier_name || ""), row.counterpartyName)
    )
    documents.push(...filtered)

    const pageFull = list.length === PARTY_DOCUMENTS_PAGE_SIZE
    hasNext = Boolean(res.next) || pageFull
    page += 1

    if (list.length === 0) hasNext = false
  }

  const details = await Promise.all(documents.map(async (item) => mapPurchaseDocument(item, await fetchPurchase(item.id), language, locale)))
  return details.sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`))
}

function extractDebtPartyId(row: DebtApiRow, kind: "clients" | "suppliers") {
  const nestedValue = kind === "clients" ? row.client : row.supplier
  const nestedId =
    typeof nestedValue === "object" && nestedValue !== null ? (nestedValue as { id?: number | string }).id : nestedValue
  return String((kind === "clients" ? row.client_id : row.supplier_id) ?? row.id ?? nestedId ?? "").trim()
}

function normalizeListResponse<T>(res: { rows?: T[]; results?: T[] } | T[]) {
  if (Array.isArray(res)) return res
  if (Array.isArray(res?.rows)) return res.rows
  if (Array.isArray((res as { results?: T[] })?.results)) return (res as { results?: T[] }).results || []
  return []
}

async function fetchAllOrders() {
  const rows: OrderApiRow[] = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const res = await http.get<{ count?: number; next?: unknown; results?: OrderApiRow[] } | OrderApiRow[]>(
      "/api/v1/orders/",
      { page, page_size: 200 }
    )
    const list = normalizeListResponse<OrderApiRow>(res)
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

function mapDebtRow(x: DebtApiRow, idx: number, kind: DebtKind, language: LanguageCode): DebtViewRow {
  const prePaidSum = toNum(x.prepayment_total ?? x.prepayment ?? x.pre_paid ?? x.advance_paid ?? 0)
  const totalOrderSum = toNum(x.total)
  const paidSum = toNum(x.paid)
  const isClient = kind === "clients"
  const rowId = extractDebtPartyId(x, isClient ? "clients" : "suppliers")
  const rowName = isClient ? x.client_name : x.supplier_name
  const fallbackName =
    isClient
      ? language === "ru"
        ? "Клиент"
        : language === "en"
          ? "Client"
          : "Mijoz"
      : language === "ru"
        ? "Поставщик"
        : language === "en"
          ? "Supplier"
          : "Yetkazib beruvchi"
  return {
    id: rowId || idx,
    counterpartyName: String(rowName ?? `${fallbackName} #${rowId || idx + 1}`),
    totalOrderSum,
    prePaidSum,
    newOrderTotalSum: toNum(x.new_order_total ?? x.new_orders_total ?? x.current_order_total ?? totalOrderSum),
    paidSum,
    debtSum: toNum(x.debt ?? Math.max(totalOrderSum - paidSum, 0)),
  }
}

function aggregateOrdersByClient(rows: OrderApiRow[], language: LanguageCode): DebtViewRow[] {
  const map = new Map<string, DebtViewRow>()

  rows.forEach((row, idx) => {
    const fallbackClient = language === "ru" ? "Клиент" : language === "en" ? "Client" : "Mijoz"
    const clientName = String(row.client_name ?? `${fallbackClient} #${idx + 1}`)
    const clientFallbackId = comparablePartyName(clientName) || String(row.client_code || "").trim() || String(idx)
    const clientId = String(row.client_id ?? clientFallbackId).trim()
    const key = `${clientId}:${clientName}`
    const total = toNum(row.total)
    const paid = toNum(row.paid_amount)
    const debt = toNum(row.remaining ?? Math.max(total - paid, 0))

    const existing = map.get(key)
    if (existing) {
      existing.totalOrderSum += total
      existing.newOrderTotalSum += total
      existing.paidSum += paid
      existing.debtSum += debt
      return
    }

    map.set(key, {
      id: clientId,
      counterpartyName: clientName,
      totalOrderSum: total,
      prePaidSum: 0,
      newOrderTotalSum: total,
      paidSum: paid,
      debtSum: debt,
    })
  })

  return Array.from(map.values())
}

function findMatchingDebtRowKey(map: Map<string, DebtViewRow>, row: DebtViewRow) {
  const idKey = String(row.id || "").trim()
  if (idKey && map.has(idKey)) return idKey

  const nameKey = comparablePartyName(row.counterpartyName)
  if (!nameKey) return null

  return (
    Array.from(map.entries()).find(([, value]) => comparablePartyName(value.counterpartyName) === nameKey)?.[0] || null
  )
}

function mergeClientRows(orderRows: DebtViewRow[], backendRows: DebtViewRow[]) {
  const map = new Map<string, DebtViewRow>()

  orderRows.forEach((row) => {
    map.set(String(row.id), { ...row })
  })

  backendRows.forEach((row) => {
    const key = findMatchingDebtRowKey(map, row) || String(row.id)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...row })
      return
    }

    map.set(key, {
      ...existing,
      id: String(row.id || "").trim() || existing.id,
      counterpartyName: row.counterpartyName || existing.counterpartyName,
      totalOrderSum: Math.max(toNum(existing.totalOrderSum), toNum(row.totalOrderSum)),
      prePaidSum: Math.max(toNum(existing.prePaidSum), toNum(row.prePaidSum)),
      newOrderTotalSum: Math.max(toNum(existing.newOrderTotalSum), toNum(row.newOrderTotalSum)),
      paidSum: Math.max(toNum(existing.paidSum), toNum(row.paidSum)),
      debtSum: Math.max(toNum(existing.debtSum), toNum(row.debtSum)),
    })
  })

  return Array.from(map.values())
}

function normalizePartyName(value: string) {
  return String(value || "")
    .replace(/[^0-9a-zA-Z\u0400-\u04FF]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function partyNameTokens(value: string) {
  const skip = new Set(["mchj", "ooo", "llc", "inc", "corp", "co", "ip"])
  return normalizePartyName(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && !skip.has(item))
}

function comparablePartyName(value: string) {
  const tokens = partyNameTokens(value)
  return tokens.length ? tokens.join(" ") : normalizePartyName(value)
}

function isLoosePartyNameMatch(left: string, right: string) {
  const a = comparablePartyName(left)
  const b = comparablePartyName(right)
  if (!a || !b) return false
  return a === b
}

function dedupeDebtRows(rows: DebtViewRow[]) {
  const map = new Map<string, DebtViewRow>()

  rows.forEach((row, idx) => {
    const idKey = String(row.id || "").trim()
    const nameKey = comparablePartyName(row.counterpartyName)
    const key = idKey || nameKey || `row-${idx}`
    const existing = map.get(key)

    if (existing) {
      existing.counterpartyName =
        existing.counterpartyName.length >= row.counterpartyName.length ? existing.counterpartyName : row.counterpartyName
      existing.totalOrderSum += toNum(row.totalOrderSum)
      existing.prePaidSum += toNum(row.prePaidSum)
      existing.newOrderTotalSum += toNum(row.newOrderTotalSum)
      existing.paidSum += toNum(row.paidSum)
      existing.debtSum += toNum(row.debtSum)
      return
    }

    const sameName = nameKey
      ? Array.from(map.entries()).find(([, value]) => comparablePartyName(value.counterpartyName) === nameKey)
      : null

    if (sameName) {
      const [, target] = sameName
      target.counterpartyName =
        target.counterpartyName.length >= row.counterpartyName.length ? target.counterpartyName : row.counterpartyName
      target.totalOrderSum += toNum(row.totalOrderSum)
      target.prePaidSum += toNum(row.prePaidSum)
      target.newOrderTotalSum += toNum(row.newOrderTotalSum)
      target.paidSum += toNum(row.paidSum)
      target.debtSum += toNum(row.debtSum)
      return
    }

    map.set(key, { ...row })
  })

  return Array.from(map.values())
}

function applyPartyPayments(
  rows: DebtViewRow[],
  payments: FinanceEntry[],
  refType: "CLIENT" | "SUPPLIER",
  requiredEntryType?: FinanceEntry["entryType"],
  lookupNameMap?: Map<string, string>
) {
  const paymentById = new Map<string, number>()
  const paymentByName = new Map<string, number>()

  payments.forEach((entry) => {
    const entryRefType = String(entry.referenceType || "").toUpperCase()
    if (entryRefType !== refType) return
    if (requiredEntryType && entry.entryType !== requiredEntryType) return
    const refId = String(entry.referenceId || "").trim()
    if (!refId) return

    const amount = toNum(entry.amount)
    paymentById.set(refId, (paymentById.get(refId) || 0) + amount)

    const linkedName = lookupNameMap?.get(refId)
    if (linkedName) {
      paymentByName.set(linkedName, (paymentByName.get(linkedName) || 0) + amount)
    }
  })

  return rows.map((row) => {
    const idKey = String(row.id || "").trim()
    const nameKey = comparablePartyName(row.counterpartyName)
    const paidById = paymentById.get(idKey) || 0
    const paidByName =
      paymentByName.get(nameKey) ||
      Array.from(paymentByName.entries()).find(([savedName]) => isLoosePartyNameMatch(savedName, nameKey))?.[1] ||
      0
    const extraPaid = paidByName || paidById
    if (!extraPaid) return row

    return {
      ...row,
      paidSum: row.paidSum + extraPaid,
      // O'sha kontragent joriy qarzidan oshiq to'langan summa manfiy qoldiq sifatida saqlanadi.
      debtSum: row.debtSum - extraPaid,
    }
  })
}

function isCurrentMonth(dateValue: string) {
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function buildEmployeeSalaryRows(employees: Employee[], entries: FinanceEntry[], postings: FinanceEntry[]): EmployeeSalaryRow[] {
  return employees.map((employee) => {
    let advancePaid = 0
    let salaryPaid = 0
    let bonusPaid = 0

      ;[...entries, ...postings].forEach((entry) => {
        const refType = String(entry.referenceType || "").toUpperCase()
        if (refType !== "EMPLOYEE") return
        if (String(entry.referenceId || "") !== String(employee.id)) return
        if (entry.entryType !== "EXPENSE") return
        if (!isCurrentMonth(entry.date)) return

        const amount = toNum(entry.amount)
        const category = String(entry.category || "").toUpperCase()
        const notes = String(entry.notes || "").toUpperCase()

        if (category.includes("BONUS") || notes.includes("BONUS")) {
          bonusPaid += amount
          return
        }
        if (category.includes("OYLIK") || notes.includes("OYLIK")) {
          salaryPaid += amount
          return
        }
        // EMPLOYEE uchun oddiy kassoviy to'lov default bo'yicha avans deb olinadi.
        advancePaid += amount
      })

    const totalSalary = toNum(employee.baseSalary)
    const remainingSalary = Math.max(totalSalary - advancePaid - salaryPaid - bonusPaid, 0)

    return {
      id: employee.id,
      fullName: employee.fullName,
      role: employee.role,
      baseSalary: toNum(employee.baseSalary),
      advancePaid,
      salaryPaid,
      bonusPaid,
      remainingSalary,
      currency: employee.currency || "UZS",
    }
  })
}

export default function MoliyaClientDebtsPage() {
  const navigate = useNavigate()
  const { language, locale } = useI18n()
  const [clientRows, setClientRows] = useState<DebtViewRow[]>([])
  const [supplierRows, setSupplierRows] = useState<DebtViewRow[]>([])
  const [employeeRows, setEmployeeRows] = useState<EmployeeSalaryRow[]>([])
  const [activeTab, setActiveTab] = useState<DebtKind>("clients")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedParty, setSelectedParty] = useState<PartyDocumentsState | null>(null)
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState("")
  const [expandedDocumentId, setExpandedDocumentId] = useState<number | null>(null)
  const [documentsAsOfDate, setDocumentsAsOfDate] = useState(() => new Date().toISOString().slice(0, 10))
  const tabMeta = useMemo(() => getDebtTabMeta(language), [language])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const [clientsRes, suppliersRes, ordersRes, ledgerEntries, postingEntries, employees, clientOptions, supplierOptions] =
        await Promise.all([
          fetchAllFinanceDebtRows("/api/v1/finance/dashboard/debts/clients"),
          fetchAllFinanceDebtRows("/api/v1/finance/dashboard/debts/suppliers"),
          fetchAllOrders(),
          financeClient.listEntries(),
          financeClient.listPostings(),
          financeClient.listEmployees(),
          financeClient.listClientOptions(),
          financeClient.listSupplierOptions(),
        ])
      const clientLookupNameMap = new Map(
        clientOptions.map((item) => [String(item.id).trim(), comparablePartyName(item.name)])
      )
      const supplierLookupNameMap = new Map(
        supplierOptions.map((item) => [String(item.id).trim(), comparablePartyName(item.name)])
      )
      const backendClientRows = clientsRes.map((row, idx) => mapDebtRow(row, idx, "clients", language))
      const backendSupplierRows = suppliersRes.map((row, idx) => mapDebtRow(row, idx, "suppliers", language))
      const aggregatedOrderRows = aggregateOrdersByClient(ordersRes, language)
      const mergedClientRows = mergeClientRows(aggregatedOrderRows, backendClientRows)

      // Kassoviy dokumentdagi CLIENT + INCOME yozuvlari qarzdorlikda to'lov sifatida hisoblanadi.
      setClientRows(
        dedupeDebtRows(
          applyPartyPayments(
            applyPartyPayments(mergedClientRows, ledgerEntries, "CLIENT", "INCOME", clientLookupNameMap),
            postingEntries,
            "CLIENT",
            undefined,
            clientLookupNameMap
          )
        )
      )
      // Kassoviy dokumentdagi SUPPLIER + EXPENSE yozuvlari supplier qarzida to'lov sifatida hisoblanadi.
      setSupplierRows(
        dedupeDebtRows(
          applyPartyPayments(
            applyPartyPayments(backendSupplierRows, ledgerEntries, "SUPPLIER", "EXPENSE", supplierLookupNameMap),
            postingEntries,
            "SUPPLIER",
            undefined,
            supplierLookupNameMap
          )
        )
      )
      // EMPLOYEE tab uchun shu oydagi kassoviy to'lovlar (EXPENSE + EMPLOYEE) asosida payroll ko'rinishi hisoblanadi.
      setEmployeeRows(buildEmployeeSalaryRows(employees, ledgerEntries, postingEntries))
    } catch (e: unknown) {
      const msg =
        typeof e === "object" &&
          e !== null &&
          "response" in e &&
          typeof (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail !== "undefined"
          ? String((e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail)
          : language === "ru"
            ? "Не удалось загрузить данные по задолженности"
            : language === "en"
              ? "Failed to load debt data"
              : "Qarzdorlik ma'lumotini yuklab bo'lmadi"
      setClientRows([])
      setSupplierRows([])
      setEmployeeRows([])
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [language])

  const closePartyDocuments = useCallback(() => {
    setSelectedParty(null)
    setDocumentsError("")
    setExpandedDocumentId(null)
  }, [])

  const openPartyDocuments = useCallback(
    async (row: DebtViewRow) => {
      if (activeTab !== "clients" && activeTab !== "suppliers") return

      const nextKey = buildPartyKey(activeTab, row)
      if (selectedParty?.key === nextKey) {
        closePartyDocuments()
        return
      }

      const asOfDate = new Date().toISOString().slice(0, 10)
      setDocumentsAsOfDate(asOfDate)
      setSelectedParty({
        key: nextKey,
        kind: activeTab,
        partyName: row.counterpartyName,
        documents: [],
      })
      setDocumentsLoading(true)
      setDocumentsError("")
      setExpandedDocumentId(null)

      try {
        const documents =
          activeTab === "clients"
            ? await fetchClientDocuments(row, asOfDate, language, locale)
            : await fetchSupplierDocuments(row, asOfDate, language, locale)

        setSelectedParty({
          key: nextKey,
          kind: activeTab,
          partyName: row.counterpartyName,
          documents,
        })
        setExpandedDocumentId(documents[0]?.id ?? null)
      } catch (e: unknown) {
        const msg =
          typeof e === "object" &&
            e !== null &&
            "response" in e &&
            typeof (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail !== "undefined"
            ? String((e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail)
            : language === "ru"
              ? "Не удалось загрузить документы контрагента"
              : language === "en"
                ? "Failed to load counterparty documents"
                : "Kontragent hujjatlari yuklanmadi"

        setSelectedParty({
          key: nextKey,
          kind: activeTab,
          partyName: row.counterpartyName,
          documents: [],
        })
        setDocumentsError(msg)
      } finally {
        setDocumentsLoading(false)
      }
    },
    [activeTab, closePartyDocuments, language, locale, selectedParty?.key]
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    closePartyDocuments()
  }, [closePartyDocuments, language])

  useEffect(() => {
    if (activeTab === "employees") {
      closePartyDocuments()
      return
    }
    if (selectedParty && selectedParty.kind !== activeTab) {
      closePartyDocuments()
    }
  }, [activeTab, closePartyDocuments, selectedParty])

  const rows = activeTab === "clients" ? clientRows : supplierRows
  const {
    page: debtPage,
    setPage: setDebtPage,
    totalPages: debtTotalPages,
    pagedItems: pagedDebtRows,
  } = useClientPagination(rows, 10, [activeTab, rows.length])
  const {
    page: employeePage,
    setPage: setEmployeePage,
    totalPages: employeeTotalPages,
    pagedItems: pagedEmployeeRows,
  } = useClientPagination(employeeRows, 10, [employeeRows.length])
  const totalDebt = useMemo(() => rows.reduce((acc, r) => acc + r.debtSum, 0), [rows])
  const totalPaid = useMemo(() => rows.reduce((acc, r) => acc + r.paidSum, 0), [rows])
  const totalPrePaid = useMemo(() => rows.reduce((acc, r) => acc + r.prePaidSum, 0), [rows])
  const totalOrderVolume = useMemo(() => rows.reduce((acc, r) => acc + r.newOrderTotalSum, 0), [rows])
  const totalEmployeePayout = useMemo(
    () => employeeRows.reduce((acc, r) => acc + r.advancePaid + r.salaryPaid + r.bonusPaid, 0),
    [employeeRows]
  )
  const totalBaseSalary = useMemo(() => employeeRows.reduce((acc, r) => acc + r.baseSalary, 0), [employeeRows])
  const totalRemainingSalary = useMemo(() => employeeRows.reduce((acc, r) => acc + r.remainingSalary, 0), [employeeRows])
  const title =
    activeTab === "clients"
      ? language === "ru"
        ? "Задолженность клиентов"
        : language === "en"
          ? "Client receivables"
          : "Mijozlar qarzdorligi"
      : activeTab === "suppliers"
        ? language === "ru"
          ? "Задолженность перед поставщиками"
          : language === "en"
            ? "Supplier payables"
            : "Yetkazib beruvchilarga qarzdorlik"
        : language === "ru"
          ? "Зарплата сотрудников"
          : language === "en"
            ? "Employee payroll"
            : "Xodimlar oyligi"
  const subtitle =
    activeTab === "clients"
      ? language === "ru"
        ? "Долг клиентов за полученные товары"
        : language === "en"
          ? "Debt of customers who received goods"
          : "Mahsulot olgan mijozlar qarzi"
      : activeTab === "suppliers"
        ? language === "ru"
          ? "Расчеты с поставщиками"
          : language === "en"
            ? "Settlements with suppliers"
            : "Yetkazib beruvchilar bilan hisob-kitoblar"
        : language === "ru"
          ? "Зарплата, авансы и бонусы сотрудников за текущий месяц"
          : language === "en"
            ? "This month's salary, advance, and bonus overview by employee"
            : "Xodimlar bo'yicha shu oydagi oylik, avans va bonus hisobotlari"
  const nameColumn =
    activeTab === "clients"
      ? language === "ru"
        ? "Клиент"
        : language === "en"
          ? "Client"
          : "Mijoz"
      : language === "ru"
        ? "Поставщик"
        : language === "en"
          ? "Supplier"
          : "Yetkazib beruvchi"
  const activeMeta = tabMeta[activeTab]
  const HeroIcon = activeMeta.icon
  const activeCount = activeTab === "employees" ? employeeRows.length : rows.length
  const attentionCount =
    activeTab === "employees"
      ? employeeRows.filter((row) => row.remainingSalary > 0).length
      : rows.filter((row) => row.debtSum > 0).length
  const headlineValue = activeTab === "employees" ? totalRemainingSalary : totalDebt
  const coverageRate = totalOrderVolume > 0 ? Math.round((totalPaid / totalOrderVolume) * 100) : 0
  const quickHint =
    activeTab === "employees"
      ? language === "ru"
        ? `У ${attentionCount} сотрудников есть остаток`
        : language === "en"
          ? `Outstanding balance for ${attentionCount} employees`
          : `${attentionCount} nafar xodimda qoldiq mavjud`
      : language === "ru"
        ? `У ${attentionCount} контрагентов открыт баланс`
        : language === "en"
          ? `Open balances for ${attentionCount} counterparties`
          : `${attentionCount} ta kontragentda ochiq balans bor`

  const summaryCards: SummaryCardItem[] =
    activeTab === "employees"
      ? [
        {
          label: language === "ru" ? "Фонд оплаты" : language === "en" ? "Payroll fund" : "Oylik fondi",
          value: fmtMoney(totalBaseSalary, locale, language),
          hint:
            language === "ru"
              ? "Базовый фонд заработной платы за текущий месяц."
              : language === "en"
                ? "Base payroll fund for the current month."
                : "Joriy oy uchun bazaviy ish haqi fondi.",
          tone: "sky",
          icon: WalletCards,
        },
        {
          label: language === "ru" ? "Выплачено" : language === "en" ? "Paid" : "To'langan",
          value: fmtMoney(totalEmployeePayout, locale, language),
          hint:
            language === "ru"
              ? "Сумма авансов, зарплат и бонусов."
              : language === "en"
                ? "Combined advances, salaries, and bonuses."
                : "Avans, oylik va bonuslar jamlanmasi.",
          tone: "emerald",
          icon: ArrowUpRight,
        },
        {
          label: language === "ru" ? "Остаток" : language === "en" ? "Outstanding" : "Qoldiq",
          value: fmtMoney(totalRemainingSalary, locale, language),
          hint:
            language === "ru"
              ? `У ${attentionCount} сотрудников есть ожидающий платеж.`
              : language === "en"
                ? `${attentionCount} employees are awaiting payment.`
                : `${attentionCount} nafar xodimda kutilayotgan to'lov bor.`,
          tone: attentionCount > 0 ? "amber" : "emerald",
          icon: CircleAlert,
        },
        {
          label: language === "ru" ? "Команда" : language === "en" ? "Team" : "Jamoa",
          value:
            language === "ru"
              ? `${employeeRows.length} чел.`
              : language === "en"
                ? `${employeeRows.length} employees`
                : `${employeeRows.length} ta`,
          hint:
            language === "ru"
              ? "Количество сотрудников в payroll-мониторинге."
              : language === "en"
                ? "Employees tracked in payroll."
                : "Ish haqi kuzatuvidagi xodimlar soni.",
          tone: "slate",
          icon: BriefcaseBusiness,
        },
      ]
      : [
        {
          label:
            activeTab === "clients"
              ? language === "ru"
                ? "Общая дебиторка"
                : language === "en"
                  ? "Total receivables"
                  : "Jami qarzdorlik"
              : language === "ru"
                ? "Всего к оплате"
                : language === "en"
                  ? "Total payables"
                  : "Jami to'lanadigan",
          value: fmtMoney(totalDebt, locale, language),
          hint:
            language === "ru"
              ? `Активный баланс сохраняется у ${attentionCount} контрагентов.`
              : language === "en"
                ? `Active balances are kept for ${attentionCount} counterparties.`
                : `${attentionCount} ta kontragentda faol balans saqlanmoqda.`,
          tone: totalDebt > 0 ? (activeTab === "clients" ? "sky" : "amber") : "emerald",
          icon: activeMeta.icon,
        },
        {
          label: language === "ru" ? "Оплаченная сумма" : language === "en" ? "Paid amount" : "To'langan summa",
          value: fmtMoney(totalPaid, locale, language),
          hint:
            language === "ru"
              ? "Сопоставлено с кассовыми записями и проводками."
              : language === "en"
                ? "Matched with cash entries and postings."
                : "Kassoviy yozuvlar va postinglar bilan uyg'unlashtirilgan.",
          tone: "emerald",
          icon: ArrowUpRight,
        },
        {
          label: language === "ru" ? "Авансы" : language === "en" ? "Advance payments" : "Oldindan to'lov",
          value: fmtMoney(totalPrePaid, locale, language),
          hint:
            language === "ru"
              ? "Авансовые показатели, полученные с backend."
              : language === "en"
                ? "Advance indicators received from the backend."
                : "Backenddan kelgan avans ko'rsatkichlari.",
          tone: "slate",
          icon: Sparkles,
        },
        {
          label: language === "ru" ? "Уровень покрытия" : language === "en" ? "Coverage rate" : "Qoplash darajasi",
          value: `${coverageRate}%`,
          hint:
            language === "ru"
              ? `Общий показатель по портфелю из ${rows.length} контрагентов.`
              : language === "en"
                ? `Overall metric across ${rows.length} counterparties.`
                : `${rows.length} ta kontragent portfeli bo'yicha umumiy ko'rsatkich.`,
          tone: "sky",
          icon: WalletCards,
        },
      ]

  const spotlight: SpotlightCard =
    activeTab === "employees"
      ? (() => {
        const highlight = employeeRows.reduce<EmployeeSalaryRow | null>(
          (best, row) => (!best || row.remainingSalary > best.remainingSalary ? row : best),
          null
        )

        return highlight
          ? {
            label: activeMeta.spotlightLabel,
            name: highlight.fullName,
            value: fmtMoney(highlight.remainingSalary, locale, language, highlight.currency),
            caption:
              language === "ru"
                ? `${highlight.role}: ожидаемый остаток.`
                : language === "en"
                  ? `Outstanding amount for the ${highlight.role} role.`
                  : `${highlight.role} bo'yicha kutilayotgan qoldiq.`,
          }
          : {
            label: activeMeta.spotlightLabel,
            name: language === "ru" ? "Ожидаются данные" : language === "en" ? "Waiting for data" : "Ma'lumot kutilmoqda",
            value: fmtMoney(0, locale, language),
            caption:
              language === "ru"
                ? "За этот месяц записи payroll не найдены."
                : language === "en"
                  ? "No payroll records were found for this month."
                  : "Shu oy uchun ish haqi yozuvlari topilmadi.",
          }
      })()
      : (() => {
        const highlight = rows.reduce<DebtViewRow | null>(
          (best, row) => (!best || Math.abs(row.debtSum) > Math.abs(best.debtSum) ? row : best),
          null
        )

        return highlight
          ? {
            label: activeMeta.spotlightLabel,
            name: highlight.counterpartyName,
            value: fmtMoney(highlight.debtSum, locale, language),
            caption: `${
              highlight.debtSum < 0
                ? language === "ru"
                  ? "Переплата"
                  : language === "en"
                    ? "Overpayment"
                    : "Ortiqcha to'lov"
                : language === "ru"
                  ? "Открытый долг"
                  : language === "en"
                    ? "Open debt"
                    : "Ochiq qarz"
            } | ${
              language === "ru" ? "Заказ" : language === "en" ? "Order" : "Buyurtma"
            } ${fmtMoney(highlight.newOrderTotalSum, locale, language)}`,
          }
          : {
            label: activeMeta.spotlightLabel,
            name: language === "ru" ? "Ожидаются данные" : language === "en" ? "Waiting for data" : "Ma'lumot kutilmoqda",
            value: fmtMoney(0, locale, language),
            caption:
              language === "ru"
                ? `Строки для раздела ${title} пока не поступили.`
                : language === "en"
                  ? `Rows for ${title} have not arrived yet.`
                  : `${title} bo'yicha satrlar hali kelmadi.`,
          }
      })()

  const selectedPartyDocuments = selectedParty?.documents || []
  const selectedDocumentItems = selectedPartyDocuments.reduce((sum, document) => sum + document.items.length, 0)
  const selectedPartyVolume = selectedPartyDocuments.reduce((sum, document) => sum + document.total, 0)

  return (
    <div className="space-y-5 text-slate-900">
      <section
        className={cn(
          "relative overflow-hidden rounded-[34px] border border-slate-900/5 text-white shadow-[0_34px_120px_-54px_rgba(2,6,23,0.6)]",
          activeMeta.gradientClass
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,164,0.24),transparent_30%)]" />
        <div className="absolute right-[-70px] top-[-70px] h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-[-90px] left-[-60px] h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />

        <div className="relative p-6 md:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-white/80">
                <Sparkles className="h-3.5 w-3.5" />
                {activeMeta.eyebrow}
              </div>

              <div className="mt-5 flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-[20px] border border-white/12 bg-white/10 backdrop-blur-md">
                  <HeroIcon className="h-7 w-7" />
                </div>

                <div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl !text-white">{activeMeta.heroTitle}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-[15px]">
                    {subtitle}. {activeMeta.description}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-sm text-white/80">
                    <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1">
                      {language === "ru" ? `${activeCount} профилей` : language === "en" ? `${activeCount} profiles` : `${activeCount} ta profil`}
                    </span>
                    <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1">{quickHint}</span>
                    <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1">
                      {language === "ru" ? "Текущий остаток" : language === "en" ? "Current outstanding balance" : "Joriy qoldiq balans"}:{" "}
                      {fmtMoney(headlineValue, locale, language)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full max-w-xl rounded-[28px] border border-white/12 bg-white/10 p-4 backdrop-blur-xl xl:ml-auto">
              <div className="rounded-[24px] border border-white/10 bg-slate-950/18 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                      <span
                        className={cn(
                          "inline-flex h-2.5 w-2.5 rounded-full",
                          error ? "bg-rose-300" : loading ? "animate-pulse bg-amber-300" : "bg-emerald-300"
                        )}
                      />
                      {error
                        ? language === "ru"
                          ? "Проблема соединения"
                          : language === "en"
                            ? "Connection issue"
                            : "Ulanishda muammo"
                        : loading
                          ? language === "ru"
                            ? "Данные обновляются"
                            : language === "en"
                              ? "Refreshing data"
                              : "Ma'lumot yangilanmoqda"
                          : language === "ru"
                            ? "Обновлено"
                            : language === "en"
                              ? "Updated"
                              : "Yangilandi"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/12 px-4 text-sm font-bold text-white transition hover:bg-white/18 disabled:cursor-wait disabled:opacity-70"
                  >
                    <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                    {loading
                      ? language === "ru"
                        ? "Обновляется"
                        : language === "en"
                          ? "Refreshing"
                          : "Yangilanmoqda"
                      : language === "ru"
                        ? "Обновить"
                        : language === "en"
                          ? "Refresh"
                          : "Yangilash"}
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {(["clients", "suppliers", "employees"] as DebtKind[]).map((tab) => (
                    <DebtTabButton
                      key={tab}
                      kind={tab}
                      isActive={tab === activeTab}
                      onClick={() => setActiveTab(tab)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-[24px] border border-white/10 bg-slate-950/22 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/55">{spotlight.label}</div>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-black text-white">{spotlight.name}</div>
                    <div className="mt-1 text-sm leading-6 text-white/68">{spotlight.caption}</div>
                  </div>
                  <div className="text-right">
                    <div className="mt-1 text-lg font-black text-white">{spotlight.value}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-[0_18px_50px_-40px_rgba(225,29,72,0.45)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <CircleAlert className="h-4 w-4" />
            </div>
            <div>
              <div className="font-black">
                {language === "ru"
                  ? "Модуль задолженности не удалось загрузить с backend"
                  : language === "en"
                    ? "The debt module could not be loaded from the backend"
                    : "Qarzdorlik moduli backenddan o'qilmadi"}
              </div>
              <div className="mt-1 leading-6">{error}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {summaryCards.map((item) => (
          <DebtSummaryCard key={item.label} item={item} />
        ))}
      </div>

      <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_26px_90px_-58px_rgba(15,23,42,0.35)] backdrop-blur-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{activeMeta.eyebrow}</div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
              {language === "ru" ? `${activeCount} строк` : language === "en" ? `${activeCount} rows` : `${activeCount} ta satr`}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
              {activeTab === "employees"
                ? language === "ru"
                  ? "Оплачено"
                  : language === "en"
                    ? "Paid"
                    : "To'langan"
                : language === "ru"
                  ? "Текущий баланс"
                  : language === "en"
                    ? "Current balance"
                    : "Joriy balans"}
              :{" "}
              <span className="text-slate-950">
                {fmtMoney(activeTab === "employees" ? totalEmployeePayout : totalDebt, locale, language)}
              </span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === "employees" ? (
            <table className="min-w-[1040px] w-full text-sm">
              <thead className="bg-slate-50/90">
                <tr className="border-b border-slate-200/80">
                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Сотрудник" : language === "en" ? "Employee" : "Xodim"}
                  </th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Должность" : language === "en" ? "Role" : "Lavozim"}
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Фонд оплаты" : language === "en" ? "Payroll fund" : "Oylik fondi"}
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Зарплата" : language === "en" ? "Salary" : "Oylik"}
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Аванс" : language === "en" ? "Advance" : "Avans"}
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Бонус" : language === "en" ? "Bonus" : "Bonus"}
                  </th>
                  <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Остаток" : language === "en" ? "Outstanding" : "Qoldiq"}
                  </th>
                </tr>
              </thead>

              <tbody>
                {pagedEmployeeRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-slate-200/80 transition hover:bg-slate-50/80",
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/35"
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-700">
                          {getInitials(row.fullName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-950">{row.fullName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {language === "ru" ? "Зарплатный профиль" : language === "en" ? "Payroll profile" : "Ish haqi profili"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        {row.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                      {fmtMoney(row.baseSalary, locale, language, row.currency)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                      {fmtMoney(row.salaryPaid, locale, language, row.currency)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                      {fmtMoney(row.advancePaid, locale, language, row.currency)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                      {fmtMoney(row.bonusPaid, locale, language, row.currency)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                          row.remainingSalary > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {row.remainingSalary > 0
                          ? language === "ru"
                            ? "Остаток"
                            : language === "en"
                              ? "Outstanding"
                              : "Qoldiq"
                          : language === "ru"
                            ? "Закрыто"
                            : language === "en"
                              ? "Settled"
                              : "Yopilgan"}
                      </span>
                      <div className="mt-2 font-semibold tabular-nums text-slate-950">
                        {fmtMoney(row.remainingSalary, locale, language, row.currency)}
                      </div>
                    </td>
                  </tr>
                ))}

                {loading && employeeRows.length === 0 ? (
                  <TableStatusRow
                    colSpan={7}
                    title={
                      language === "ru"
                        ? "Готовим payroll-срез"
                        : language === "en"
                          ? "Preparing payroll snapshot"
                          : "Ish haqi ko'rinishi tayyorlanmoqda"
                    }
                    description={
                      language === "ru"
                        ? "Загружается новое представление на основе кассовых записей и списка сотрудников."
                        : language === "en"
                          ? "A fresh view is loading based on cash entries and employee records."
                          : "Kassoviy yozuvlar va xodimlar ro'yxati asosida yangi ko'rinish yuklanmoqda."
                    }
                    loading
                  />
                ) : null}

                {!loading && employeeRows.length === 0 ? (
                  <TableStatusRow
                    colSpan={7}
                    title={
                      language === "ru"
                        ? `Данные для раздела ${title} не найдены`
                        : language === "en"
                          ? `No data found for ${title}`
                          : `${title} bo'yicha ma'lumot topilmadi`
                    }
                    description={
                      language === "ru"
                        ? "За этот месяц записи payroll пока отсутствуют."
                        : language === "en"
                          ? "No payroll records exist for this month."
                          : "Shu oy uchun ish haqi yozuvlari hali mavjud emas."
                    }
                  />
                ) : null}
              </tbody>
            </table>
          ) : (
            <table className="min-w-[1160px] w-full text-sm">
              <thead className="bg-slate-50/90">
                <tr className="border-b border-slate-200/80">
                  <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {nameColumn}
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Общая сумма заказов" : language === "en" ? "Total order amount" : "Umumiy buyurtma summasi"}
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Аванс" : language === "en" ? "Advance payment" : "Oldindan to'lov"}
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Объем новых заказов" : language === "en" ? "New order volume" : "Yangi buyurtma hajmi"}
                  </th>
                  <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Оплаченная сумма" : language === "en" ? "Paid amount" : "To'langan summa"}
                  </th>
                  <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    {language === "ru" ? "Задолженность" : language === "en" ? "Debt" : "Qarzdorlik"}
                  </th>
                </tr>
              </thead>

              <tbody>
                {pagedDebtRows.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => void openPartyDocuments(row)}
                    className={cn(
                      "cursor-pointer border-b border-slate-200/80 transition hover:bg-slate-50/80",
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/35",
                      selectedParty?.key === buildPartyKey(activeTab === "clients" ? "clients" : "suppliers", row) &&
                      "bg-sky-50/80"
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-700">
                          {getInitials(row.counterpartyName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="block truncate font-semibold text-black">
                              {row.counterpartyName}
                            </span>
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {selectedParty?.key === buildPartyKey(activeTab === "clients" ? "clients" : "suppliers", row)
                                ? language === "ru"
                                  ? "Список открыт"
                                  : language === "en"
                                    ? "List open"
                                    : "Ro'yxat ochiq"
                                : language === "ru"
                                  ? "Список товаров"
                                  : language === "en"
                                    ? "Item list"
                                    : "Tovarlar ro'yxati"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {activeTab === "clients"
                              ? language === "ru"
                                ? "Профиль дебиторки"
                                : language === "en"
                                  ? "Receivables profile"
                                  : "Debitorlik profili"
                              : language === "ru"
                                ? "Профиль поставщика"
                                : language === "en"
                                  ? "Supplier profile"
                                  : "Yetkazib beruvchi profili"}{" "}
                            | ID {row.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                      {fmtMoney(row.totalOrderSum, locale, language)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                      {fmtMoney(row.prePaidSum, locale, language)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                      {fmtMoney(row.newOrderTotalSum, locale, language)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-700">
                      {fmtMoney(row.paidSum, locale, language)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                          row.debtSum < 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        )}
                      >
                        {row.debtSum < 0
                          ? language === "ru"
                            ? "Аванс"
                            : language === "en"
                              ? "Advance"
                              : "Avans"
                          : language === "ru"
                            ? "Долг"
                            : language === "en"
                              ? "Debt"
                              : "Qarz"}
                      </span>
                      <div
                        className={cn(
                          "mt-2 font-semibold tabular-nums",
                          row.debtSum < 0 ? "text-emerald-700" : "text-rose-700"
                        )}
                      >
                        {fmtMoney(row.debtSum, locale, language)}
                      </div>
                    </td>
                  </tr>
                ))}

                {loading && rows.length === 0 ? (
                  <TableStatusRow
                    colSpan={6}
                    title={
                      language === "ru"
                        ? `${title}: обновляем данные`
                        : language === "en"
                          ? `${title} is updating`
                          : `${title} yangilanmoqda`
                    }
                    description={
                      language === "ru"
                        ? "Новый срез собирается на основе заказов, кассы и проводок."
                        : language === "en"
                          ? "A new snapshot is being assembled from orders, cash, and posting records."
                          : "Buyurtma, kassa va posting yozuvlari asosida yangi ko'rinish yig'ilmoqda."
                    }
                    loading
                  />
                ) : null}

                {!loading && rows.length === 0 ? (
                  <TableStatusRow
                    colSpan={6}
                    title={
                      language === "ru"
                        ? `Данные для раздела ${title} не найдены`
                        : language === "en"
                          ? `No data found for ${title}`
                          : `${title} bo'yicha ma'lumot topilmadi`
                    }
                    description={
                      language === "ru"
                        ? "Для этого сегмента backend пока не вернул строки."
                        : language === "en"
                          ? "The backend has not returned any rows for this segment yet."
                          : "Backenddan bu segment uchun hozircha satr kelmadi."
                    }
                  />
                ) : null}
              </tbody>
            </table>
          )}
        </div>
        {activeTab === "employees" && !loading && employeeRows.length > 0 ? (
          <div className="mt-4 flex justify-end pr-4 sm:pr-6">
            <TablePagination page={employeePage} totalPages={employeeTotalPages} onPageChange={setEmployeePage} size="sm" />
          </div>
        ) : null}
        {activeTab !== "employees" && !loading && rows.length > 0 ? (
          <div className="mt-4 flex justify-end pr-4 sm:pr-6">
            <TablePagination page={debtPage} totalPages={debtTotalPages} onPageChange={setDebtPage} size="sm" />
          </div>
        ) : null}
      </section>

      {selectedParty ? (
        <PartyDocumentsPanel
          partyName={selectedParty.partyName}
          partyKind={selectedParty.kind}
          asOfDate={documentsAsOfDate}
          documents={selectedPartyDocuments}
          loading={documentsLoading}
          error={documentsError}
          expandedDocumentId={expandedDocumentId}
          totalItems={selectedDocumentItems}
          totalVolume={selectedPartyVolume}
          onClose={closePartyDocuments}
          onToggleDocument={(documentId) =>
            setExpandedDocumentId((current) => (current === documentId ? null : documentId))
          }
          onOpenDocument={(document) => navigate(document.routePath)}
        />
      ) : null}
    </div>
  )
}

function PartyDocumentsPanel({
  partyName,
  partyKind,
  asOfDate,
  documents,
  loading,
  error,
  expandedDocumentId,
  totalItems,
  totalVolume,
  onClose,
  onToggleDocument,
  onOpenDocument,
}: {
  partyName: string
  partyKind: "clients" | "suppliers"
  asOfDate: string
  documents: PartyDocument[]
  loading: boolean
  error: string
  expandedDocumentId: number | null
  totalItems: number
  totalVolume: number
  onClose: () => void
  onToggleDocument: (documentId: number) => void
  onOpenDocument: (document: PartyDocument) => void
}) {
  const { language, locale } = useI18n()

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/95 shadow-[0_22px_80px_-52px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-5 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
            {partyKind === "clients"
              ? language === "ru"
                ? "Документы клиента"
                : language === "en"
                  ? "Client documents"
                  : "Mijoz hujjatlari"
              : language === "ru"
                ? "Документы поставщика"
                : language === "en"
                  ? "Supplier documents"
                  : "Yetkazib beruvchi hujjatlari"}
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{partyName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {language === "ru"
              ? `По состоянию на ${fmtDate(asOfDate, locale)}: документы и товарные позиции этого контрагента.`
              : language === "en"
                ? `Documents and item positions for this counterparty as of ${fmtDate(asOfDate, locale)}.`
                : `${fmtDate(asOfDate, locale)} holatiga ko'ra shu kontragent bo'yicha hujjatlar va tovar pozitsiyalari.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
            {language === "ru" ? `${documents.length} документов` : language === "en" ? `${documents.length} documents` : `${documents.length} ta hujjat`}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
            {language === "ru" ? `${totalItems} позиций` : language === "en" ? `${totalItems} positions` : `${totalItems} ta pozitsiya`}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
            {language === "ru" ? "Итого" : language === "en" ? "Total" : "Jami"} {fmtMoney(totalVolume, locale, language)}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
            {language === "ru" ? "Закрыть" : language === "en" ? "Close" : "Yopish"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mx-5 mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-6">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center px-6 py-10">
          <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            {language === "ru" ? "Загружаем документы..." : language === "en" ? "Loading documents..." : "Hujjatlar yuklanmoqda..."}
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-[20px] border border-slate-200 bg-slate-50 text-slate-400">
            <PackageSearch className="h-5 w-5" />
          </div>
          <div className="text-base font-black text-slate-950">
            {language === "ru" ? "Документы не найдены" : language === "en" ? "No documents found" : "Hujjat topilmadi"}
          </div>
          <div className="max-w-md text-sm leading-6 text-slate-500">
            {language === "ru"
              ? "Для этого контрагента на выбранную дату не найдены документы заказа или закупки."
              : language === "en"
                ? "No order or purchase documents were found for the selected date for this counterparty."
                : "Shu kontragent uchun tanlangan sanadagi buyurtma yoki xarid hujjatlari topilmadi."}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 px-5 py-5 md:px-6">
          {documents.map((document) => {
            const isExpanded = expandedDocumentId === document.id

            return (
              <article
                key={`${document.documentLabel}-${document.id}`}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/70"
              >
                <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:justify-between">
                  <button type="button" onClick={() => onToggleDocument(document.id)} className="min-w-0 text-left">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-black text-slate-950">
                            {document.documentLabel} {document.code}
                          </span>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              documentStatusToneClass(document.statusTone)
                            )}
                          >
                            {document.statusLabel}
                          </span>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              documentStatusToneClass(document.paymentTone)
                            )}
                          >
                            {document.paymentLabel}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {fmtDate(document.date, locale)} | {document.metaLabel}
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                      {language === "ru" ? `${document.items.length} позиций` : language === "en" ? `${document.items.length} positions` : `${document.items.length} ta pozitsiya`}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                      {language === "ru" ? "Итого" : language === "en" ? "Total" : "Jami"} {fmtMoney(document.total, locale, language, document.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenDocument(document)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {language === "ru" ? "Открыть" : language === "en" ? "Open" : "Ko'rish"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-slate-200 bg-white/90 px-4 py-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {language === "ru" ? "Оплачено" : language === "en" ? "Paid" : "To'langan"}
                    </div>
                    <div className="mt-2 text-lg font-black text-emerald-700">
                      {fmtMoney(document.paidAmount, locale, language, document.currency)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {language === "ru" ? "Остаток" : language === "en" ? "Outstanding" : "Qoldiq"}
                    </div>
                    <div className="mt-2 text-lg font-black text-rose-700">
                      {fmtMoney(document.remaining, locale, language, document.currency)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {language === "ru" ? "Валюта" : language === "en" ? "Currency" : "Valyuta"}
                    </div>
                    <div className="mt-2 text-lg font-black text-slate-950">{document.currency}</div>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-slate-200 bg-white">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="text-sm font-black text-slate-950">
                        {language === "ru" ? "Товарные позиции" : language === "en" ? "Item positions" : "Tovar pozitsiyalari"}
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {language === "ru" ? `${document.items.length} строк` : language === "en" ? `${document.items.length} rows` : `${document.items.length} ta satr`}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr className="border-y border-slate-200/80">
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">
                              {language === "ru" ? "Наименование" : language === "en" ? "Name" : "Nomi"}
                            </th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.22em]">
                              {language === "ru" ? "Количество" : language === "en" ? "Quantity" : "Miqdor"}
                            </th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.22em]">
                              {language === "ru" ? "Цена" : language === "en" ? "Price" : "Narx"}
                            </th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.22em]">
                              {language === "ru" ? "Итого" : language === "en" ? "Total" : "Jami"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {document.items.map((item, index) => (
                            <tr
                              key={item.id}
                              className={cn(
                                "border-b border-slate-200/80",
                                index % 2 === 0 ? "bg-white" : "bg-slate-50/35"
                              )}
                            >
                              <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-700">
                                {item.qtyLabel}
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-700">
                                {fmtMoney(item.unitPrice, locale, language, document.currency)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-950">
                                {fmtMoney(item.lineTotal, locale, language, document.currency)}
                              </td>
                            </tr>
                          ))}

                          {document.items.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                                {language === "ru"
                                  ? "В этом документе позиции не найдены."
                                  : language === "en"
                                    ? "No items were found in this document."
                                    : "Bu hujjat ichida pozitsiyalar topilmadi."}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function DebtSummaryCard({ item }: { item: SummaryCardItem }) {
  const Icon = item.icon

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[28px] border p-5 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.28)]",
        summarySurfaceClass(item.tone)
      )}
    >
      <div className="absolute right-[-28px] top-[-28px] h-24 w-24 rounded-full bg-white/60 blur-2xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{item.label}</div>
          <div className="mt-3 text-[clamp(1.35rem,2.4vw,2rem)] font-black leading-tight tracking-tight text-slate-950">
            {item.value}
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600">{item.hint}</div>
        </div>

        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-sm",
            summaryIconClass(item.tone)
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  )
}

function DebtTabButton({
  kind,
  isActive,
  onClick,
}: {
  kind: DebtKind
  isActive: boolean
  onClick: () => void
}) {
  const { language } = useI18n()
  const meta = getDebtTabMeta(language)[kind]
  const Icon = meta.icon

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "rounded-[20px] border p-3 text-left transition",
        isActive
          ? "border-white/24 bg-white text-slate-950 shadow-[0_18px_50px_-30px_rgba(255,255,255,0.75)]"
          : "border-white/10 bg-white/8 text-white hover:bg-white/12"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
            isActive ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/12 bg-white/10 text-white"
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0">
          <div className={cn("text-sm font-black", isActive ? "text-white font-bold" : "text-white font-semibold")}>{meta.tabLabel}</div>
          <div className={cn("mt-1 text-xs leading-5", isActive ? "text-slate-500" : "text-white/65")}>
            {meta.tabDescription}
          </div>
        </div>
      </div>
    </button>
  )
}

function TableStatusRow({
  colSpan,
  title,
  description,
  loading = false,
}: {
  colSpan: number
  title: string
  description: string
  loading?: boolean
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-[20px] border",
              loading ? "border-sky-200 bg-sky-50 text-sky-600" : "border-slate-200 bg-slate-50 text-slate-400"
            )}
          >
            {loading ? <RefreshCcw className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div className="mt-4 text-base font-black text-slate-950">{title}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">{description}</div>
        </div>
      </td>
    </tr>
  )
}

function summarySurfaceClass(tone: SummaryTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#ecfdf5_100%)]"
    case "amber":
      return "border-amber-100 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)]"
    case "sky":
      return "border-sky-100 bg-[linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)]"
    default:
      return "border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]"
  }
}

function summaryIconClass(tone: SummaryTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function getInitials(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return "NA"

  return parts
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || "")
    .join("")
}
