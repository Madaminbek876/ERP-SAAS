import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Activity,
  BarChart3,
  Boxes,
  CheckCheck,
  ChevronDown,
  DollarSign,
  MoreHorizontal,
  Package,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import DashboardShell from "../components/DashboardShell"
import { dashboardApi } from "../api/dashboardApi"
import { catalogApi, type ProductRow } from "../api/catalogApi"
import type { ChartRange, DashboardFilter, OverviewSummaryResponse, RecentQuery, RecentRow } from "../api/types"
import { warehouseEvents } from "@/pages/sklad/warehouse/api/events"
import { useI18n, type LanguageCode } from "@/i18n"
import { formatNumberWithSpaces } from "@/lib/numberFormat"
import { apiAxios } from "@/Api/api.axios"
import { http } from "@/shared/http"
import { fetchPurchases } from "@/Api/purchases.api"
import { warehouseApi } from "@/pages/sklad/warehouse/api/warehouseApi"
import type { MovementItem } from "@/pages/sklad/warehouse/api/types"
import { fetchAllOrders, fetchOrderDetail, type OrderDetailResponse, type OrderSummary } from "@/pages/orders/api/ordersApi"
import { salesEvents } from "@/pages/orders/api/events"
import { financeClient } from "@/pages/moliya/shared/financeClient"
import type { FinanceEntry } from "@/pages/moliya/shared/types"
import { financeEvents } from "@/pages/moliya/shared/events"
import { partnerEvents } from "@/pages/xodimlar/events"
import type { Client } from "@/Api/types"
import type { PurchaseListItem } from "@/pages/purchases/types"

type UiState = "loading" | "error" | "content"
type TrendPoint = { label: string; incoming: number; outgoing: number }
type WarehouseRange = "today" | "month"
type SalesRange = "today" | "month"
type OverviewCounts = {
  newCustomers: number
  totalCustomers: number
  returningCustomers: number
  completedOrders: number
  activeOrders: number
}
type CustomerSectionRow = {
  id: string
  name: string
  phone?: string
  company?: string
  createdAt?: string
  ordersCount?: number
}
type PurchaseStats = {
  count: number
  amount: number
  paidAmount: number
  remainingAmount: number
  totalSeries: Array<{ label: string; value: number }>
  paidSeries: Array<{ label: string; value: number }>
}
type SalesStats = {
  total: number
  deltaAmount: number
  deltaPercent: number
}
type OrderStatusStat = {
  key: string
  label: string
  count: number
  tone: string
}
type OrderTrendStats = {
  completedSeries: Array<{ label: string; value: number }>
  deliverySeries: Array<{ label: string; value: number }>
}
type WarehouseStats = {
  incomingCount: number
  outgoingCount: number
  incomingAmount: number
  outgoingAmount: number
  incomingSeries: Array<{ label: string; value: number }>
  outgoingSeries: Array<{ label: string; value: number }>
}
type WarehouseDetailRow = {
  id: string
  name: string
  qty: number
  amount: number
  location: string
  date: string
  note?: string
}
type MetricKey = "sales" | "expenses" | "newCustomers" | "completedOrders" | "activeOrders"

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getLocalizedMonthShort(date: Date, language: LanguageCode) {
  const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ"
  return date.toLocaleString(locale, { month: "short" }).toLowerCase().replace(".", "")
}

function getLocalizedWeekLabels(language: LanguageCode) {
  if (language === "ru") return ["1-я неделя", "2-я неделя", "3-я неделя", "4-я неделя", "5-я неделя"]
  if (language === "en") return ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"]
  return ["1-hafta", "2-hafta", "3-hafta", "4-hafta", "5-hafta"]
}

function getLocalizedDayShortLabels(language: LanguageCode) {
  if (language === "ru") return ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  if (language === "en") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
}

function getOrderStatusLabel(key: string, language: LanguageCode) {
  const normalized = String(key || "").trim().toUpperCase()
  const labels: Record<string, Record<LanguageCode, string>> = {
    NEW: { uz: "Yangi", ru: "Новые", en: "New" },
    IN_PROGRESS: { uz: "Jarayonda", ru: "В процессе", en: "In progress" },
    READY: { uz: "Yakunlangan", ru: "Завершённые", en: "Completed" },
    ON_DELIVERY: { uz: "Yetkazilmoqda", ru: "Доставляется", en: "On delivery" },
    DELIVERED: { uz: "Yetkazildi", ru: "Доставлено", en: "Delivered" },
    CANCELLED: { uz: "Bekor qilingan", ru: "Отменённые", en: "Cancelled" },
    NO_STATUS: { uz: "Statussiz", ru: "Без статуса", en: "No status" },
  }

  return labels[normalized]?.[language] ?? normalized
}

function formatOrderNumber(value?: string | null, fallbackId?: string | number | null) {
  const source = String(value ?? "").trim()
  const digits = source.replace(/\D+/g, "")
  const orderPrefix = "\u2116"

  if (digits) return `${orderPrefix}${Number(digits)}`
  if (fallbackId !== undefined && fallbackId !== null && String(fallbackId).trim()) return `${orderPrefix}${fallbackId}`
  return `${orderPrefix}-`
}

function getMetricModalText(language: LanguageCode) {
  if (language === "ru") {
    return {
      title: "Детали показателя",
      salesSubtitle: "Показатели продаж за выбранный период",
      expensesSubtitle: "Показатели расходов и закупок",
      customersSubtitle: "Новые клиенты за выбранный период",
      completedSubtitle: "Список завершённых заказов",
      activeSubtitle: "Список активных заказов",
      noRows: "Данные не найдены",
      customerName: "Клиент",
      phone: "Телефон",
      company: "Компания",
      createdAt: "Создан",
      orderNo: "Заказ",
      total: "Итого",
      date: "Дата",
      value: "Значение",
      status: "Статус",
      note: "Примечание",
      close: "Закрыть",
    }
  }

  if (language === "en") {
    return {
      title: "Metric details",
      salesSubtitle: "Sales metrics for the selected period",
      expensesSubtitle: "Expense and purchase metrics",
      customersSubtitle: "New customers in the selected period",
      completedSubtitle: "Completed orders list",
      activeSubtitle: "Active orders list",
      noRows: "No data found",
      customerName: "Customer",
      phone: "Phone",
      company: "Company",
      createdAt: "Created",
      orderNo: "Order",
      purchaseNo: "Purchase",
      supplier: "Supplier",
      total: "Total",
      date: "Date",
      value: "Value",
      status: "Status",
      note: "Note",
      close: "Close",
    }
  }

  return {
    title: "Ko'rsatkich tafsiloti",
    salesSubtitle: "Tanlangan davr uchun sotuv ko'rsatkichlari",
    expensesSubtitle: "Xarajat va xarid ko'rsatkichlari",
    customersSubtitle: "Tanlangan davrdagi yangi mijozlar",
    completedSubtitle: "Tugallangan buyurtmalar ro'yxati",
    activeSubtitle: "Jarayondagi buyurtmalar ro'yxati",
    noRows: "Ma'lumot topilmadi",
    customerName: "Mijoz",
    phone: "Telefon",
    company: "Kompaniya",
    createdAt: "Yaratilgan",
    orderNo: "Buyurtma",
    purchaseNo: "Xarid",
    supplier: "Yetkazib beruvchi",
    total: "Jami",
    date: "Sana",
    value: "Qiymat",
    status: "Holat",
    note: "Izoh",
    close: "Yopish",
  }
}

function createDashboardText(language: LanguageCode) {
  if (language === "ru") {
    return {
      pageTitle: "Главная панель",
      subtitle: "Панель управления ERP",
      loading: "Загрузка...",
      error: "Не удалось загрузить данные дашборда.",
      errorSubtitle: "Возможно, backend endpoint временно недоступен.",
      metricTitles: {
        sales: "Продажи за этот месяц",
        expenses: "Расходы за этот месяц",
        newCustomers: "Новые клиенты",
        completedOrders: "Завершённые заказы",
        activeOrders: "Активные заказы",
      },
      common: {
        pieces: "шт",
        customer: "клиент",
        amountSuffix: "сум",
        refresh: "Обновить данные",
        daily: "Дневной",
        monthly: "Месячный",
        oneMonth: "1 месяц",
        realBackend: "Реальный backend",
      },
      sales: {
        title: "Продажи",
        currentPeriod: "Текущий период",
        chartTitle: "График продаж",
        latestShare: "Последняя доля",
        latestShareFallback: "Доля реальных продаж",
        strongestPeriod: "Сильнейший период",
        latestGrowth: "Последний рост",
        share: "доля",
        noData: "За выбранный период реальные данные по продажам не найдены",
      },
      customers: {
        title: "Аналитика клиентов",
        totalBase: "Общая база",
        newBuyers: "Новые покупатели",
        existingCustomers: "Текущие клиенты",
        returningCustomers: "Повторные покупатели",
      },
      purchase: {
        title: "Закупки",
        currentPeriod: "Текущий период закупок",
        acceptedReceipts: "принятые поступления",
        total: "Всего",
        paid: "Оплачено",
        remaining: "Остаток",
        chartTitle: "Дневная динамика закупок",
        chartSubtitle: "По дням",
        totalPurchases: "Общий объём закупок",
        paymentProgress: "Прогресс оплаты",
        paymentShare: "Доля оплаты",
        remainingShare: "остаток",
        noData: "Месячная статистика закупок не найдена",
      },
      orders: {
        title: "Заказы",
        currentFlow: "Текущий поток заказов",
        overallState: "Общее состояние заказов",
        completedShare: "завершено",
        activeShare: "активно",
        completedRatio: "Доля завершённых",
        completedRatioHint: "Доля завершённых заказов в общем числе",
        peakStatus: "Самый крупный статус",
        cancelled: "Отменённые",
        currentRange: "Текущий период",
        analysisTitle: "Анализ статусов заказов",
        analysisSubtitle: "Все реальные статусы собраны прямо в дашборде",
        activeOrders: "активных",
        weekly: "7 дней",
        loadingOrders: "Загрузка заказов...",
        noTrend: "7-дневный тренд заказов не найден",
        noStatuses: "Статусы заказов не найдены",
        noItems: "Товары не найдены",
        orderDate: "Дата заказа",
        deliveryDate: "Дата доставки",
        client: "Клиент",
        total: "Итого",
        products: "Товары",
        quantity: "Количество",
        price: "Цена",
      },
      warehouse: {
        title: "Склад",
        dailyStats: "Дневная статистика склада",
        monthlyStats: "Месячная статистика склада",
        dailyIndicator: "Дневной показатель",
        monthlyIndicator: "Показатель за месяц",
        noData: "Реальная складская статистика не найдена",
        incoming: "Поступление",
        outgoing: "Списание",
      },
    }
  }

  if (language === "en") {
    return {
      pageTitle: "Main dashboard",
      subtitle: "ERP control panel",
      loading: "Loading...",
      error: "Dashboard data could not be loaded.",
      errorSubtitle: "The backend endpoint may be temporarily unavailable.",
      metricTitles: {
        sales: "Sales this month",
        expenses: "Expenses this month",
        newCustomers: "New customers",
        completedOrders: "Completed orders",
        activeOrders: "Active orders",
      },
      common: {
        pieces: "pcs",
        customer: "customer",
        amountSuffix: "UZS",
        refresh: "Refresh data",
        daily: "Daily",
        monthly: "Monthly",
        oneMonth: "1 month",
        realBackend: "Real backend",
      },
      sales: {
        title: "Sales",
        currentPeriod: "Current period",
        chartTitle: "Sales chart",
        latestShare: "Latest share",
        latestShareFallback: "Real sales share",
        strongestPeriod: "Strongest period",
        latestGrowth: "Latest growth",
        share: "share",
        noData: "No real sales data found for the selected period",
      },
      customers: {
        title: "Customer analysis",
        totalBase: "Customer base",
        newBuyers: "New buyers",
        existingCustomers: "Existing customers",
        returningCustomers: "Returning buyers",
        tableName: "Customer",
        tablePhone: "Phone",
        tableCompany: "Company",
        tableDate: "Created",
        ordersSuffix: "orders",
        noRows: "No customers found in this section",
      },
      purchase: {
        title: "Purchases",
        currentPeriod: "Current purchase period",
        acceptedReceipts: "accepted receipts",
        total: "Total",
        paid: "Paid",
        remaining: "Remaining",
        chartTitle: "Daily purchase dynamics",
        chartSubtitle: "By day",
        totalPurchases: "Total purchases",
        paymentProgress: "Payment progress",
        paymentShare: "Payment share",
        remainingShare: "remaining",
        noData: "Monthly purchase statistics were not found",
      },
      orders: {
        title: "Orders",
        currentFlow: "Current order flow",
        overallState: "Overall order state",
        completedShare: "completed",
        activeShare: "active",
        completedRatio: "Completed share",
        completedRatioHint: "Share of completed orders in total",
        peakStatus: "Top status",
        cancelled: "Cancelled",
        currentRange: "Current period",
        analysisTitle: "Order status analysis",
        analysisSubtitle: "All real statuses are collected right in the dashboard",
        activeOrders: "active",
        weekly: "7 days",
        loadingOrders: "Loading orders...",
        noTrend: "7-day order trend not found",
        noStatuses: "Order statuses not found",
        noItems: "No items found",
        orderDate: "Order date",
        deliveryDate: "Delivery date",
        client: "Client",
        total: "Total",
        products: "Products",
        quantity: "Quantity",
        price: "Price",
      },
      warehouse: {
        title: "Warehouse",
        dailyStats: "Daily warehouse statistics",
        monthlyStats: "Monthly warehouse statistics",
        dailyIndicator: "Daily indicator",
        monthlyIndicator: "Monthly indicator",
        noData: "No real warehouse statistics found",
        incoming: "Incoming",
        outgoing: "Outgoing",
        tableName: "Item",
        tableQty: "Qty",
        tableAmount: "Amount",
        tableLocation: "Location",
        tableDate: "Date",
        noRows: "No warehouse movements found",
      },
    }
  }

  return {
    pageTitle: "Asosiy boshqaruv paneli",
    subtitle: "ERP boshqaruv paneli",
    loading: "Yuklanmoqda...",
    error: "Dashboard ma'lumotlari yuklanmadi.",
    errorSubtitle: "Backend endpoint vaqtincha javob bermayotgan bo'lishi mumkin.",
    metricTitles: {
      sales: "Ushbu oydagi sotuvlar",
      expenses: "Ushbu oydagi xarajatlar",
      newCustomers: "Yangi mijozlar",
      completedOrders: "Tugallangan buyurtmalar",
      activeOrders: "Jarayon buyurtmalari",
    },
    common: {
      pieces: "ta",
      customer: "mijoz",
      amountSuffix: "so'm",
      refresh: "Ma'lumotlarni yangilash",
      daily: "Kunlik",
      monthly: "Oylik",
      oneMonth: "1 oylik",
      realBackend: "Real backend",
    },
    sales: {
      title: "Sotuv",
      currentPeriod: "Joriy davr",
      chartTitle: "Sotuv grafigi",
      latestShare: "So'nggi ulush",
      latestShareFallback: "Real sotuv ulushi",
      strongestPeriod: "Eng kuchli davr",
      latestGrowth: "So'nggi o'sish",
      share: "ulush",
      noData: "Tanlangan davr uchun real sotuv ma'lumoti topilmadi",
    },
    customers: {
      title: "Mijozlar tahlili",
      totalBase: "Jami bazasi",
      newBuyers: "Yangi xaridorlar",
      existingCustomers: "Mavjud mijozlar",
      returningCustomers: "Qayta xarid qilganlar",
      tableName: "Mijoz",
      tablePhone: "Telefon",
      tableCompany: "Kompaniya",
      tableDate: "Yaratilgan",
      ordersSuffix: "ta buyurtma",
      noRows: "Bu bo'limda mijoz topilmadi",
    },
    purchase: {
      title: "Xarid",
      currentPeriod: "Joriy xarid davri",
      acceptedReceipts: "qabul qilingan kirim",
      total: "Jami",
      paid: "To'langan",
      remaining: "Qoldiq",
      chartTitle: "Kunlik xarid dinamikasi",
      chartSubtitle: "Har kun bo'yicha",
      totalPurchases: "Jami xarid",
      paymentProgress: "To'lov progressi",
      paymentShare: "To'lov ulushi",
      remainingShare: "qoldiq",
      noData: "1 oylik xarid statistikasi topilmadi",
    },
    orders: {
      title: "Buyurtmalar",
      currentFlow: "Joriy buyurtma oqimi",
      overallState: "Umumiy buyurtma holati",
      completedShare: "yakunlangan",
      activeShare: "faol",
      completedRatio: "Yakunlangan ulush",
      completedRatioHint: "Jami buyurtmalar ichida tugallangan buyurtmalar hissasi",
      peakStatus: "Eng katta status",
      cancelled: "Bekor qilinganlar",
      currentRange: "Hozirgi davr",
      analysisTitle: "Buyurtma statuslari tahlili",
      analysisSubtitle: "Barcha real statuslar dashboard ichida jamlangan",
      activeOrders: "ta faol",
      weekly: "7 kunlik",
      loadingOrders: "Buyurtmalar yuklanmoqda...",
      noTrend: "7 kunlik buyurtma trendi topilmadi",
      noStatuses: "Buyurtma statuslari topilmadi",
      noItems: "Mahsulotlar topilmadi",
      orderDate: "Buyurtma sanasi",
      deliveryDate: "Yetkazib berish sanasi",
      client: "Mijoz",
      total: "Jami",
      products: "Mahsulotlar",
      quantity: "Miqdor",
      price: "Narx",
    },
    warehouse: {
      title: "Ombor",
      dailyStats: "Kunlik ombor statistikasi",
      monthlyStats: "1 oylik ombor statistikasi",
      dailyIndicator: "Kunlik ko'rsatkich",
      monthlyIndicator: "1 oylik ko'rsatkich",
      noData: "Real ombor statistikasi topilmadi",
      incoming: "Kirim",
      outgoing: "Chiqim",
      tableName: "Nomi",
      tableQty: "Miqdor",
      tableAmount: "Summa",
      tableLocation: "Joylashuv",
      tableDate: "Sana",
      noRows: "Ombor harakati topilmadi",
    },
  }
}

function cardClassName(extra = "") {
  return [
    "lux-motion-surface rounded-[32px] border border-[#d8e1f1] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(247,250,255,0.96)_100%)]",
    "shadow-[0_28px_80px_-52px_rgba(22,54,124,0.28)]",
    extra,
  ]
    .filter(Boolean)
    .join(" ")
}

function dashboardPanelClass() {
  return "motion-enter-side-slow rounded-[40px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98)_0%,rgba(245,249,255,0.98)_42%,rgba(236,243,255,0.96)_100%)] p-3 sm:p-4"
}

function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -8% 0px",
      }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`scroll-reveal-right${visible ? " is-visible" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function numFromValue(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function compactAmount(value: string | number | null | undefined, currency = "UZS") {
  const amount = numFromValue(value)
  if (!amount) return `0 ${currency}`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M ${currency}`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K ${currency}`
  return `${formatNumberWithSpaces(amount)} ${currency}`
}

function compactCount(value: string | number | null | undefined) {
  return `${formatNumberWithSpaces(numFromValue(value) || 0)} ta`
}

async function fetchAllOrdersPages(params: {
  page?: number
  page_size?: number
  ordering?: string
  date_from?: string
  date_to?: string
}) {
  return fetchAllOrders({
    ordering: params.ordering,
    date_from: params.date_from,
    date_to: params.date_to,
  })
}

async function fetchAllClientsPages() {
  const rows: Array<Awaited<ReturnType<typeof apiAxios.listClientsPage>>["items"][number]> = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const response = await apiAxios.listClientsPage({
      page,
      page_size: 200,
      ordering: "-created_at",
    })
    rows.push(...response.items)

    if (typeof response.next === "string" && response.next) {
      page += 1
      continue
    }
    if (Number.isFinite(response.total) && rows.length < response.total) {
      page += 1
      continue
    }
    hasNext = false
  }

  return rows
}

async function fetchAllPurchasesPages(params: {
  ordering?: string
  date_from?: string
  date_to?: string
}) {
  const rows: Awaited<ReturnType<typeof fetchPurchases>>["results"] = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const response = await fetchPurchases({
      ...params,
      page,
      page_size: 200,
    })
    rows.push(...response.results)

    if (typeof response.next === "string" && response.next) {
      page += 1
      continue
    }
    if (Number.isFinite(response.count) && rows.length < response.count) {
      page += 1
      continue
    }
    hasNext = false
  }

  return rows
}

function formatCurrencyValue(value: string | number | null | undefined) {
  return formatNumberWithSpaces(numFromValue(value) || 0)
}

function formatDashboardDate(value: string | null | undefined, language: LanguageCode) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ"
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })
}

function mapMovementDetailRow(row: MovementItem): WarehouseDetailRow {
  return {
    id: String(row.id),
    name: row.itemName || "-",
    qty: numFromValue(row.qty),
    amount: numFromValue(row.total),
    location: row.to_location_name || row.from_location_name || row.location_name || "-",
    date: String(row.date || "").slice(0, 10),
    note: row.note || "",
  }
}

function formatSignedAmountFull(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : ""
  return `${sign}${formatNumberWithSpaces(Math.abs(value))} so'm`
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}%`
  if (rounded < 0) return `${rounded}%`
  return "0%"
}

function formatPercentLabel(value: number) {
  return `${Math.round(Math.max(0, value))}%`
}

function normalizeDateOnly(value: unknown) {
  const raw = String(value ?? "").trim()
  return raw ? raw.slice(0, 10) : ""
}

function getDateWindow(range: DashboardFilter["range"], date: string) {
  const anchor = normalizeDateOnly(date) || todayISO()
  const base = new Date(`${anchor}T00:00:00`)

  if (Number.isNaN(base.getTime())) {
    return { from: anchor, to: anchor }
  }

  const fromDate = new Date(base)
  if (range === "week") fromDate.setDate(fromDate.getDate() - 6)
  else if (range === "year") fromDate.setDate(fromDate.getDate() - 365)
  else if (range !== "today") fromDate.setDate(fromDate.getDate() - 30)

  return {
    from: fromDate.toISOString().slice(0, 10),
    to: anchor,
  }
}

function isDateInWindow(value: unknown, window: { from: string; to: string }) {
  const date = normalizeDateOnly(value)
  return Boolean(date) && date >= window.from && date <= window.to
}

function buildMonthlyPurchaseSeries(
  rows: Array<{ received_date?: string | null; created_at?: string | null; total?: number | null }>,
  window: { from: string; to: string },
  language: LanguageCode
) {
  const labels = getLocalizedWeekLabels(language)
  const start = new Date(`${window.from}T00:00:00`)
  const buckets = labels.map((label) => ({ label, value: 0 }))

  rows.forEach((row) => {
    const sourceDate = normalizeDateOnly(row.received_date || row.created_at)
    if (!sourceDate || sourceDate < window.from || sourceDate > window.to) return

    const current = new Date(`${sourceDate}T00:00:00`)
    const diffDays = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
    const weekIndex = Math.min(buckets.length - 1, Math.floor(diffDays / 7))
    buckets[weekIndex].value += numFromValue(row.total)
  })

  return buckets
}

function buildPurchaseSeries(
  rows: Array<{ received_date?: string | null; created_at?: string | null; total?: number | null; paid_amount?: number | null }>,
  window: { from: string; to: string },
  language: LanguageCode
) {
  const labels = getLocalizedWeekLabels(language)
  const start = new Date(`${window.from}T00:00:00`)
  const buckets = labels.map((label) => ({ label, total: 0, paid: 0 }))

  rows.forEach((row) => {
    const sourceDate = normalizeDateOnly(row.received_date || row.created_at)
    if (!sourceDate || sourceDate < window.from || sourceDate > window.to) return

    const current = new Date(`${sourceDate}T00:00:00`)
    const diffDays = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
    const weekIndex = Math.min(buckets.length - 1, Math.floor(diffDays / 7))
    buckets[weekIndex].total += numFromValue(row.total)
    buckets[weekIndex].paid += numFromValue(row.paid_amount)
  })

  return {
    totalSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.total })),
    paidSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.paid })),
  }
}

function getPreviousDateWindow(window: { from: string; to: string }) {
  const start = new Date(`${window.from}T00:00:00`)
  const end = new Date(`${window.to}T00:00:00`)
  const spanDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1)
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (spanDays - 1))

  return {
    from: prevStart.toISOString().slice(0, 10),
    to: prevEnd.toISOString().slice(0, 10),
  }
}

function buildDailyPurchaseSeries(
  rows: Array<{ received_date?: string | null; created_at?: string | null; total?: number | null; paid_amount?: number | null }>,
  window: { from: string; to: string },
  language: LanguageCode
) {
  const start = new Date(`${window.from}T00:00:00`)
  const end = new Date(`${window.to}T00:00:00`)
  const buckets: Array<{ label: string; key: string; total: number; paid: number }> = []

  for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const key = current.toISOString().slice(0, 10)
    buckets.push({
      key,
      label: `${current.getDate()}-${getLocalizedMonthShort(current, language)}`,
      total: 0,
      paid: 0,
    })
  }

  rows.forEach((row) => {
    const sourceDate = normalizeDateOnly(row.received_date || row.created_at)
    if (!sourceDate) return
    const bucket = buckets.find((item) => item.key === sourceDate)
    if (!bucket) return
    bucket.total += numFromValue(row.total)
    bucket.paid += numFromValue(row.paid_amount)
  })

  return {
    totalSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.total })),
    paidSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.paid })),
  }
}

function mergePurchasePayments<
  T extends {
    id: number
    total?: number | null
    paid_amount?: number | null
    remaining_amount?: number | null
  },
>(rows: T[], payments: FinanceEntry[]) {
  const paymentById = new Map<string, number>()

  payments.forEach((entry) => {
    if (String(entry.referenceType || "").toUpperCase() !== "PURCHASE") return
    const refId = String(entry.referenceId || "").trim()
    if (!refId) return
    paymentById.set(refId, (paymentById.get(refId) || 0) + numFromValue(entry.amount))
  })

  return rows.map((row) => {
    const idKey = String(row.id || "").trim()
    const financePaid = paymentById.get(idKey) || 0
    const paidAmount = Math.max(numFromValue(row.paid_amount), financePaid)
    const total = numFromValue(row.total)
    return {
      ...row,
      paid_amount: paidAmount,
      remaining_amount: Math.max(total - paidAmount, 0),
    }
  })
}

function buildPurchaseInsights(stats: PurchaseStats) {
  const coverage = stats.amount > 0 ? (stats.paidAmount / stats.amount) * 100 : 0
  const remainingShare = stats.amount > 0 ? (stats.remainingAmount / stats.amount) * 100 : 0
  const peakPoint = stats.totalSeries.reduce<{ label: string; value: number } | null>(
    (best, point) => (!best || point.value > best.value ? point : best),
    null
  )

  return {
    coverage,
    remainingShare,
    peakPoint,
  }
}

function buildOrderInsights(stats: OrderStatusStat[]) {
  const total = stats.reduce((sum, item) => sum + item.count, 0)
  const completed = stats
    .filter((item) => ["READY", "DELIVERED"].includes(item.key))
    .reduce((sum, item) => sum + item.count, 0)
  const active = stats
    .filter((item) => ["NEW", "IN_PROGRESS", "ON_DELIVERY"].includes(item.key))
    .reduce((sum, item) => sum + item.count, 0)
  const cancelled = stats
    .filter((item) => item.key === "CANCELLED")
    .reduce((sum, item) => sum + item.count, 0)
  const completedShare = total > 0 ? (completed / total) * 100 : 0
  const activeShare = total > 0 ? (active / total) * 100 : 0
  const peakStatus = stats.reduce<OrderStatusStat | null>((best, item) => (!best || item.count > best.count ? item : best), null)

  return {
    total,
    active,
    cancelled,
    completedShare,
    activeShare,
    peakStatus,
  }
}

function pickOrderShowcaseStats(stats: OrderStatusStat[], language: LanguageCode) {
  const findByKey = (key: string, fallbackTone: string) =>
    stats.find((item) => item.key === key) ?? { key, label: getOrderStatusLabel(key, language), count: 0, tone: fallbackTone }
  const activeCount = stats
    .filter((item) => ["NEW", "IN_PROGRESS", "CONFIRMED", "ON_DELIVERY"].includes(item.key))
    .reduce((sum, item) => sum + item.count, 0)

  return [
    findByKey("READY", "bg-violet-50 text-violet-700 border border-violet-200"),
    {
      key: "ACTIVE",
      label: language === "ru" ? "Заказы" : language === "en" ? "Orders" : "Buyurtmalar",
      count: activeCount,
      tone: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    },
    findByKey("DELIVERED", "bg-emerald-50 text-emerald-700 border border-emerald-200"),
  ]
}

function buildOrderTrendSeries(
  rows: Array<{ status?: string; order_date?: string; created_at?: string }>,
  anchorDate: string,
  language: LanguageCode
) {
  const anchor = normalizeDateOnly(anchorDate) || todayISO()
  const end = new Date(`${anchor}T00:00:00`)
  const start = new Date(end)
  start.setDate(end.getDate() - 6)
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    return {
      date: current.toISOString().slice(0, 10),
      label: `${current.getDate()}-${getLocalizedMonthShort(current, language)}`,
      completed: 0,
      delivery: 0,
    }
  })

  rows.forEach((row) => {
    const sourceDate = normalizeDateOnly(row.order_date || row.created_at)
    if (!sourceDate) return
    const bucket = buckets.find((item) => item.date === sourceDate)
    if (!bucket) return
    const status = normalizeOrderStatusForDashboard(row.status)
    if (status === "READY" || status === "DELIVERED") bucket.completed += 1
    if (status === "ON_DELIVERY") bucket.delivery += 1
  })

  return {
    completedSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.completed })),
    deliverySeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.delivery })),
  }
}

function buildSalesTrendSeries(
  rows: Array<{ order_date?: string; created_at?: string; total?: number }>,
  window: { from: string; to: string },
  range: DashboardFilter["range"],
  language: LanguageCode
) {
  if (range === "today") {
    return [{ label: language === "ru" ? "Сегодня" : language === "en" ? "Today" : "Bugun", value: rows.reduce((sum, row) => sum + numFromValue(row.total), 0) }]
  }

  if (range === "week") {
    const start = new Date(`${window.from}T00:00:00`)
    const dayLabels = getLocalizedDayShortLabels(language)
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const current = new Date(start)
      current.setDate(start.getDate() + index)
      return {
        label: dayLabels[(current.getDay() + 6) % 7],
        value: 0,
      }
    })

    rows.forEach((row) => {
      const sourceDate = normalizeDateOnly(row.order_date || row.created_at)
      if (!sourceDate || sourceDate < window.from || sourceDate > window.to) return
      const current = new Date(`${sourceDate}T00:00:00`)
      const diffDays = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
      if (diffDays < buckets.length) buckets[diffDays].value += numFromValue(row.total)
    })

    return buckets
  }

  const labels = getLocalizedWeekLabels(language)
  const start = new Date(`${window.from}T00:00:00`)
  const buckets = labels.map((label) => ({ label, value: 0 }))

  rows.forEach((row) => {
    const sourceDate = normalizeDateOnly(row.order_date || row.created_at)
    if (!sourceDate || sourceDate < window.from || sourceDate > window.to) return
    const current = new Date(`${sourceDate}T00:00:00`)
    const diffDays = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
    const weekIndex = Math.min(buckets.length - 1, Math.floor(diffDays / 7))
    buckets[weekIndex].value += numFromValue(row.total)
  })

  return buckets
}

function buildSalesInsights(series: Array<{ label: string; value: number }>) {
  const totalValue = series.reduce((sum, point) => sum + point.value, 0)
  const latestPoint = series.at(-1) ?? null
  const previousPoint = series.length > 1 ? series[series.length - 2] : null
  const peakPoint = series.reduce<{ label: string; value: number } | null>(
    (best, point) => (!best || point.value > best.value ? point : best),
    null
  )
  const normalizedTotal = peakPoint ? Math.max(totalValue, peakPoint.value * Math.max(series.length, 1)) : totalValue
  const latestShare = normalizedTotal > 0 && latestPoint ? (latestPoint.value / normalizedTotal) * 100 : 0
  const peakShare = normalizedTotal > 0 && peakPoint ? (peakPoint.value / normalizedTotal) * 100 : 0
  const growth =
    latestPoint && previousPoint
      ? previousPoint.value > 0
        ? ((latestPoint.value - previousPoint.value) / previousPoint.value) * 100
        : latestPoint.value > 0
          ? 100
          : 0
      : latestPoint?.value
        ? 100
        : 0

  return {
    totalValue,
    latestPoint,
    peakPoint,
    latestShare,
    peakShare,
    growth,
  }
}

function normalizeOrderStatusForDashboard(value: unknown) {
  const status = String(value || "").trim().toUpperCase()
  if (status === "COMPLETED" || status === "DONE" || status === "CLOSED") return "READY"
  if (!status || status === "NONE" || status === "NULL") return "NO_STATUS"
  return status
}

function getOrderClientId(value: unknown) {
  if (typeof value === "number" || typeof value === "string") return String(value).trim()
  if (typeof value === "object" && value !== null) {
    const row = value as { id?: unknown; client_id?: unknown; clientId?: unknown }
    return String(row.id ?? row.client_id ?? row.clientId ?? "").trim()
  }
  return ""
}

function isOutgoingMovement(value: unknown) {
  const type = String(value || "").trim().toUpperCase()
  return type === "OUT" || type === "WASTE" || type.includes("ISSUE") || type.includes("WRITE_OFF") || type.includes("SPIS")
}

function isOrderAutoIssue(row: Pick<MovementItem, "movement_type" | "type" | "note">) {
  const note = String(row.note || "").toLowerCase()
  return isOutgoingMovement(row.movement_type ?? row.type) && note.includes("avtomatik buyurtma chiqimi")
}

function buildWarehouseRangeWindow(range: WarehouseRange, anchorDate: string) {
  return getDateWindow(range === "today" ? "today" : "month", anchorDate)
}

function buildWarehouseChartSeries(rows: MovementItem[], range: WarehouseRange, anchorDate: string, language: LanguageCode) {
  if (range === "today") {
    const buckets = [
      { label: "00-06", incoming: 0, outgoing: 0 },
      { label: "06-12", incoming: 0, outgoing: 0 },
      { label: "12-18", incoming: 0, outgoing: 0 },
      { label: "18-24", incoming: 0, outgoing: 0 },
    ]

    rows.forEach((row) => {
      const date = new Date(String(row.date || anchorDate))
      const hour = Number.isNaN(date.getTime()) ? 0 : date.getHours()
      const bucketIndex = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3
      if (isOutgoingMovement(row.movement_type ?? row.type)) buckets[bucketIndex].outgoing += numFromValue(row.qty)
      else buckets[bucketIndex].incoming += numFromValue(row.qty)
    })

    return {
      incomingSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.incoming })),
      outgoingSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.outgoing })),
    }
  }

  const window = buildWarehouseRangeWindow("month", anchorDate)
  const start = new Date(`${window.from}T00:00:00`)
  const buckets = getLocalizedWeekLabels(language).map((label) => ({
    label,
    incoming: 0,
    outgoing: 0,
  }))

  rows.forEach((row) => {
    const sourceDate = normalizeDateOnly(row.date)
    if (!sourceDate || sourceDate < window.from || sourceDate > window.to) return
    const current = new Date(`${sourceDate}T00:00:00`)
    const diffDays = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
    const weekIndex = Math.min(buckets.length - 1, Math.floor(diffDays / 7))
    if (isOutgoingMovement(row.movement_type ?? row.type)) buckets[weekIndex].outgoing += numFromValue(row.qty)
    else buckets[weekIndex].incoming += numFromValue(row.qty)
  })

  return {
    incomingSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.incoming })),
    outgoingSeries: buckets.map((bucket) => ({ label: bucket.label, value: bucket.outgoing })),
  }
}

function buildTrendPoints(
  salesSeries: Array<{ label: string; value: number }>,
  skladSeries: Array<{ label: string; value: number }>
): TrendPoint[] {
  const size = Math.max(salesSeries.length, skladSeries.length, 6)
  const fallbackLabels = ["Fev", "Fev", "May", "Apr", "May", "May", "Iyn", "Iyl"]

  return Array.from({ length: size }, (_, index) => {
    const salesPoint = salesSeries[index]
    const warehousePoint = skladSeries[index]
    const incoming = Math.max(0, salesPoint?.value ?? (index + 2) * 1200)
    const outgoingBase = warehousePoint?.value ?? incoming * 0.62
    return {
      label: salesPoint?.label || warehousePoint?.label || fallbackLabels[index] || `${index + 1}`,
      incoming,
      outgoing: Math.max(0, Math.round(outgoingBase)),
    }
  })
}

function softTrendSeries(points: TrendPoint[], field: "incoming" | "outgoing", ratio = 1) {
  return points.map((point) => ({
    label: point.label,
    value: Math.max(0, Math.round(point[field] * ratio)),
  }))
}

function MetricTile({
  icon,
  title,
  value,
  suffix,
  accent,
  onClick,
}: {
  icon: ReactNode
  title: string
  value: string
  suffix?: string
  accent: "blue" | "amber" | "emerald" | "violet" | "rose"
  onClick?: () => void
}) {
  const accents = {
    blue: {
      card: "border-[#d7e6ff] bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_60%,#edf4ff_100%)]",
      icon: "bg-[linear-gradient(180deg,#eef4ff_0%,#dde9ff_100%)] text-[#4268b4]",
      title: "text-[#48607f]",
      value: "text-[#1f2f4d]",
    },
    amber: {
      card: "border-[#f2e0bf] bg-[linear-gradient(135deg,#fffdfa_0%,#fff7eb_58%,#fff2dc_100%)]",
      icon: "bg-[linear-gradient(180deg,#fff1da_0%,#ffe3b6_100%)] text-[#b36b11]",
      title: "text-[#7f6443]",
      value: "text-[#4f3510]",
    },
    emerald: {
      card: "border-[#d4efdf] bg-[linear-gradient(135deg,#fbfffd_0%,#effbf4_58%,#e7f8ef_100%)]",
      icon: "bg-[linear-gradient(180deg,#e3f9ec_0%,#c7f0d8_100%)] text-[#0f8b5e]",
      title: "text-[#486b5d]",
      value: "text-[#154737]",
    },
    violet: {
      card: "border-[#e2dcfa] bg-[linear-gradient(135deg,#fdfcff_0%,#f5f1ff_58%,#efebff_100%)]",
      icon: "bg-[linear-gradient(180deg,#f0ebff_0%,#ddd2ff_100%)] text-[#6750c4]",
      title: "text-[#625487]",
      value: "text-[#32266b]",
    },
    rose: {
      card: "border-[#f0d7df] bg-[linear-gradient(135deg,#fffdfd_0%,#fff2f5_58%,#ffebf0_100%)]",
      icon: "bg-[linear-gradient(180deg,#ffe8ee_0%,#ffd5df_100%)] text-[#c44367]",
      title: "text-[#855164]",
      value: "text-[#6c233f]",
    },
  }[accent]

  return (
    <button
      type="button"
      data-slot="button"
      onClick={onClick}
      className={`${cardClassName(`min-h-[188px] cursor-pointer px-5 py-6 ${accents.card}`)} w-full text-left transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-[0_28px_80px_-42px_rgba(22,54,124,0.32)]`}
    >
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${accents.icon}`}>
          {icon}
        </div>
        <div className="mt-5 flex min-w-0 max-w-full flex-col items-center">
          <div className={`max-w-[16ch] text-[16px] font-bold leading-[1.45] ${accents.title}`}>{title}</div>
          <div className="mt-4 flex w-full max-w-full flex-wrap items-end justify-center gap-2 overflow-hidden">
            <div className={`max-w-full break-words text-center text-[clamp(1.8rem,2.4vw,2.35rem)] font-black leading-none tracking-[-0.03em] ${accents.value}`}>
              {value}
            </div>
            {suffix ? <div className={`pb-0.5 text-[16px] font-semibold ${accents.title}`}>{suffix}</div> : null}
          </div>
        </div>
      </div>
    </button>
  )
}

function ChartCanvas({
  lines,
  height = 210,
  labels = true,
  areaId,
  theme = "light",
}: {
  lines: Array<{
    data: Array<{ label: string; value: number }>
    color: string
    name?: string
    width?: number
    areaColor?: string
    point?: boolean
    strokeDasharray?: string
    pointRadius?: number
  }>
  height?: number
  labels?: boolean
  areaId: string
  theme?: "light" | "dark"
}) {
  const width = 760
  const padX = 30
  const padY = 18
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const allValues = lines.flatMap((line) => line.data.map((item) => item.value))
  const maxValue = Math.max(1, ...allValues)
  const size = Math.max(...lines.map((line) => line.data.length), 1)
  const labelsSource = lines[0]?.data ?? []

  const x = (index: number) => {
    if (size <= 1) return padX
    return padX + (index * (width - padX * 2)) / (size - 1)
  }

  const y = (value: number) => {
    const ratio = value / maxValue
    return height - padY - ratio * (height - padY * 2)
  }

  const buildPath = (data: Array<{ label: string; value: number }>) =>
    data
      .map((item, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(item.value).toFixed(2)}`)
      .join(" ")

  const primarySeries = lines[0]?.data ?? []
  const primaryPeak = primarySeries.reduce<{ label: string; value: number; index: number } | null>((best, item, index) => {
    if (!best || item.value >= best.value) return { ...item, index }
    return best
  }, null)
  const activeIndex = hoveredIndex ?? primaryPeak?.index ?? null
  const activeLabel = activeIndex !== null ? labelsSource[activeIndex]?.label ?? primarySeries[activeIndex]?.label ?? "" : ""
  const activeValues = activeIndex !== null ? lines.map((line) => line.data[activeIndex]?.value ?? 0) : []
  const activeMaxValue = activeValues.length ? Math.max(...activeValues) : 0
  const activeAlign = activeIndex === null ? "center" : activeIndex >= Math.max(size - 2, 1) ? "right" : activeIndex <= 0 ? "left" : "center"
  const gridStroke = theme === "dark" ? "rgba(148,163,184,0.14)" : "rgba(148,163,184,0.15)"
  const labelFill = theme === "dark" ? "rgba(214,225,255,0.72)" : "#8896ad"
  const pointFill = theme === "dark" ? "#091321" : "#ffffff"
  const activeValueText =
    activeIndex !== null
      ? lines
          .map((line, index) => {
            const currentValue = activeValues[index] ?? 0
            return line.name ? `${line.name}: ${formatNumberWithSpaces(currentValue)}` : formatNumberWithSpaces(currentValue)
          })
          .join(" / ")
      : ""

  const handlePointerMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width
    const clampedX = Math.max(padX, Math.min(width - padX, relativeX))

    let nextIndex = 0
    let minDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < size; index += 1) {
      const distance = Math.abs(x(index) - clampedX)
      if (distance < minDistance) {
        minDistance = distance
        nextIndex = index
      }
    }

    setHoveredIndex(nextIndex)
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full ${height > 170 ? "h-[210px]" : "h-[150px]"}`}
      onMouseMove={handlePointerMove}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <defs>
        <filter id={`${areaId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={theme === "dark" ? "5" : "2.5"} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {lines.map((line, index) =>
          line.areaColor ? (
            <linearGradient key={`${areaId}-${index}`} id={`${areaId}-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={line.areaColor} stopOpacity={theme === "dark" ? "0.34" : "0.22"} />
              <stop offset="100%" stopColor={line.areaColor} stopOpacity={theme === "dark" ? "0.01" : "0.02"} />
            </linearGradient>
          ) : null
        )}
      </defs>

      {Array.from({ length: 4 }, (_, index) => {
        const yPos = padY + (index * (height - padY * 2)) / 3
        return <line key={index} x1={padX} x2={width - padX} y1={yPos} y2={yPos} stroke={gridStroke} strokeDasharray={theme === "dark" ? "5 7" : undefined} />
      })}

      {activeIndex !== null ? (
        <line
          x1={x(activeIndex)}
          x2={x(activeIndex)}
          y1={padY}
          y2={height - padY}
          stroke={theme === "dark" ? "rgba(164,180,255,0.28)" : "rgba(148,163,184,0.2)"}
          strokeDasharray="5 6"
        />
      ) : null}

      {lines.map((line, index) => {
        const path = buildPath(line.data)
        const areaPath = `${path} L ${x(line.data.length - 1).toFixed(2)} ${(height - padY).toFixed(2)} L ${x(0).toFixed(2)} ${(height - padY).toFixed(2)} Z`

        return (
          <g key={index}>
            {line.areaColor ? <path d={areaPath} fill={`url(#${areaId}-${index})`} /> : null}
            {theme === "dark" ? (
              <path
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth={(line.width ?? 2.5) + 5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.18"
                filter={`url(#${areaId}-glow)`}
              />
            ) : null}
            <path
              d={path}
              fill="none"
              stroke={line.color}
              strokeWidth={line.width ?? 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={line.strokeDasharray}
            />
            {line.point
              ? line.data.map((item, pointIndex) => (
                  <circle
                    key={`${index}-${pointIndex}`}
                    cx={x(pointIndex)}
                    cy={y(item.value)}
                    r={pointIndex === activeIndex ? (line.pointRadius ?? 4.5) + 1.5 : line.pointRadius ?? 4.5}
                    fill={pointFill}
                    stroke={pointIndex === activeIndex ? "#ffd166" : line.color}
                    strokeWidth={pointIndex === activeIndex ? "3" : "2"}
                  />
                ))
              : null}
          </g>
        )
      })}

      {activeIndex !== null ? (
        <ChartBubble
          x={x(activeIndex)}
          y={Math.max(10, y(activeMaxValue) - 56)}
          label={activeLabel}
          value={activeValueText}
          align={activeAlign}
          width={Math.min(260, Math.max(120, activeValueText.length * 6.4))}
        />
      ) : null}

      {labels
        ? labelsSource.map((item, index) => (
            <text key={`${item.label}-${index}`} x={x(index)} y={height - 3} textAnchor="middle" fontSize="11" fill={labelFill}>
              {item.label}
            </text>
          ))
        : null}
    </svg>
  )
}

function buildSmoothSvgPath(points: Array<{ x: number; y: number }>) {
  if (points.length <= 1) {
    const point = points[0]
    return point ? `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}` : ""
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const controlX = (current.x + next.x) / 2
    path += ` C ${controlX.toFixed(2)} ${current.y.toFixed(2)}, ${controlX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`
  }

  return path
}

function compactChartValue(value: number) {
  const absValue = Math.abs(value)
  if (absValue >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (absValue >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (absValue >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return formatNumberWithSpaces(Math.round(value))
}

function ChartBubble({
  x,
  y,
  label,
  value,
  align = "center",
  width = 120,
}: {
  x: number
  y: number
  label: string
  value: string
  align?: "left" | "center" | "right"
  width?: number
}) {
  const height = 44
  const xPos = align === "left" ? x : align === "right" ? x - width : x - width / 2

  return (
    <g transform={`translate(${xPos}, ${y})`}>
      <rect width={width} height={height} rx="16" fill="rgba(9,19,33,0.88)" stroke="rgba(141,167,211,0.24)" />
      <text x={14} y={17} fontSize="10.5" fontWeight="600" fill="rgba(224,235,255,0.72)">
        {label}
      </text>
      <text x={14} y={31} fontSize="13" fontWeight="800" fill="#f4f8ff">
        {value}
      </text>
    </g>
  )
}

function OrdersTrendChart({
  completedSeries,
  deliverySeries,
  height = 290,
}: {
  completedSeries: Array<{ label: string; value: number }>
  deliverySeries: Array<{ label: string; value: number }>
  height?: number
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = 820
  const padLeft = 48
  const padRight = 18
  const padTop = 20
  const padBottom = 34
  const values = [...completedSeries, ...deliverySeries].map((item) => item.value)
  const rawMax = Math.max(1, ...values)
  const maxValue = Math.max(4, Math.ceil(rawMax))
  const size = Math.max(completedSeries.length, deliverySeries.length, 1)

  const x = (index: number) => {
    if (size <= 1) return padLeft
    return padLeft + (index * (width - padLeft - padRight)) / (size - 1)
  }

  const y = (value: number) => {
    const ratio = value / maxValue
    return height - padBottom - ratio * (height - padTop - padBottom)
  }

  const toPoints = (series: Array<{ label: string; value: number }>) => series.map((item, index) => ({ x: x(index), y: y(item.value), label: item.label }))
  const completedPoints = toPoints(completedSeries)
  const deliveryPoints = toPoints(deliverySeries)
  const completedPath = buildSmoothSvgPath(completedPoints)
  const deliveryPath = buildSmoothSvgPath(deliveryPoints)
  const completedArea = completedPoints.length
    ? `${completedPath} L ${completedPoints[completedPoints.length - 1].x.toFixed(2)} ${(height - padBottom).toFixed(2)} L ${completedPoints[0].x.toFixed(2)} ${(height - padBottom).toFixed(2)} Z`
    : ""
  const deliveryArea = deliveryPoints.length
    ? `${deliveryPath} L ${deliveryPoints[deliveryPoints.length - 1].x.toFixed(2)} ${(height - padBottom).toFixed(2)} L ${deliveryPoints[0].x.toFixed(2)} ${(height - padBottom).toFixed(2)} Z`
    : ""
  const yTicks = Array.from({ length: 5 }, (_, index) => Math.round((maxValue * (4 - index)) / 4))
  const completedPeak = completedSeries.reduce<{ label: string; value: number; index: number } | null>((best, item, index) => {
    if (!best || item.value >= best.value) return { ...item, index }
    return best
  }, null)
  const activeIndex = hoveredIndex ?? completedPeak?.index ?? null
  const activeCompleted = activeIndex !== null ? completedSeries[activeIndex] ?? null : null
  const activeDelivery = activeIndex !== null ? deliverySeries[activeIndex] ?? null : null
  const activeAlign = activeIndex === null ? "center" : activeIndex >= Math.max(size - 2, 1) ? "right" : activeIndex <= 0 ? "left" : "center"

  const handlePointerMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width
    const clampedX = Math.max(padLeft, Math.min(width - padRight, relativeX))

    let nextIndex = 0
    let minDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < size; index += 1) {
      const distance = Math.abs(x(index) - clampedX)
      if (distance < minDistance) {
        minDistance = distance
        nextIndex = index
      }
    }

    setHoveredIndex(nextIndex)
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[290px] w-full"
      onMouseMove={handlePointerMove}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <defs>
        <filter id="orders-line-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="orders-completed-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4be7ff" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#4be7ff" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="orders-delivery-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#dc6cff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#dc6cff" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => {
        const yPos = y(tick)
        return (
          <g key={tick}>
            <line x1={padLeft} x2={width - padRight} y1={yPos} y2={yPos} stroke="rgba(144,164,202,0.16)" strokeDasharray="4 6" />
            <text x={padLeft - 14} y={yPos + 4} textAnchor="end" fontSize="11" fill="rgba(219,232,255,0.6)">
              {tick}
            </text>
          </g>
        )
      })}

      {activeIndex !== null ? (
        <line
          x1={x(activeIndex)}
          x2={x(activeIndex)}
          y1={padTop}
          y2={height - padBottom}
          stroke="rgba(188,205,255,0.32)"
          strokeDasharray="4 7"
        />
      ) : null}

      {deliveryArea ? <path d={deliveryArea} fill="url(#orders-delivery-gradient)" /> : null}
      {completedArea ? <path d={completedArea} fill="url(#orders-completed-gradient)" /> : null}

      {completedPath ? (
        <path d={completedPath} fill="none" stroke="#4be7ff" strokeWidth="9" strokeOpacity="0.16" strokeLinecap="round" strokeLinejoin="round" filter="url(#orders-line-glow)" />
      ) : null}
      {deliveryPath ? (
        <path d={deliveryPath} fill="none" stroke="#dc6cff" strokeWidth="8" strokeOpacity="0.12" strokeLinecap="round" strokeLinejoin="round" filter="url(#orders-line-glow)" />
      ) : null}
      {completedPath ? <path d={completedPath} fill="none" stroke="#4be7ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {deliveryPath ? <path d={deliveryPath} fill="none" stroke="#dc6cff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /> : null}

      {completedPoints.map((point, index) => (
        <g key={`completed-${index}`}>
          <circle cx={point.x} cy={point.y} r={index === activeIndex ? 7 : 5.5} fill="#08121e" stroke={index === activeIndex ? "#ffd166" : "#4be7ff"} strokeWidth={index === activeIndex ? 3 : 2.5} />
        </g>
      ))}
      {deliveryPoints.map((point, index) => (
        <g key={`delivery-${index}`}>
          <circle cx={point.x} cy={point.y} r={index === activeIndex ? 6.5 : 5} fill="#08121e" stroke={index === activeIndex ? "#ffd166" : "#dc6cff"} strokeWidth={index === activeIndex ? 3 : 2.5} />
        </g>
      ))}

      {activeIndex !== null ? (
        <ChartBubble
          x={x(activeIndex)}
          y={Math.max(10, y(Math.max(activeCompleted?.value ?? 0, activeDelivery?.value ?? 0)) - 56)}
          label={activeCompleted?.label ?? activeDelivery?.label ?? ""}
          value={`${formatNumberWithSpaces(activeCompleted?.value ?? 0)} / ${formatNumberWithSpaces(activeDelivery?.value ?? 0)} ta`}
          align={activeAlign}
          width={180}
        />
      ) : null}

      {completedSeries.map((item, index) => (
        <text key={`${item.label}-${index}`} x={x(index)} y={height - 10} textAnchor="middle" fontSize="12" fill="rgba(219,232,255,0.68)">
          {item.label}
        </text>
      ))}
    </svg>
  )
}

function SalesTrendChart({
  series,
  height = 330,
}: {
  series: Array<{ label: string; value: number }>
  height?: number
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = 920
  const padLeft = 20
  const padRight = 18
  const padTop = 18
  const padBottom = 36
  const maxValue = Math.max(1, ...series.map((item) => item.value))
  const size = Math.max(series.length, 1)

  const x = (index: number) => {
    if (size <= 1) return padLeft
    return padLeft + (index * (width - padLeft - padRight)) / (size - 1)
  }

  const y = (value: number) => {
    const ratio = value / maxValue
    return height - padBottom - ratio * (height - padTop - padBottom)
  }

  const points = series.map((item, index) => ({ x: x(index), y: y(item.value) }))
  const linePath = buildSmoothSvgPath(points)
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padBottom).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padBottom).toFixed(2)} Z`
    : ""
  const peakPoint = series.reduce<{ label: string; value: number; index: number } | null>((best, item, index) => {
    if (!best || item.value >= best.value) return { ...item, index }
    return best
  }, null)
  const activeIndex = hoveredIndex ?? peakPoint?.index ?? null
  const activePoint = activeIndex !== null ? series[activeIndex] ?? null : null
  const activeAlign = activeIndex === null ? "center" : activeIndex >= Math.max(series.length - 2, 1) ? "right" : activeIndex <= 0 ? "left" : "center"

  const handlePointerMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width
    const clampedX = Math.max(padLeft, Math.min(width - padRight, relativeX))

    let nextIndex = 0
    let minDistance = Number.POSITIVE_INFINITY

    points.forEach((point, index) => {
      const distance = Math.abs(point.x - clampedX)
      if (distance < minDistance) {
        minDistance = distance
        nextIndex = index
      }
    })

    setHoveredIndex(nextIndex)
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[330px] w-full"
      onMouseMove={handlePointerMove}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <defs>
        <filter id="sales-line-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="sales-line-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#74f9ff" />
          <stop offset="52%" stopColor="#b388ff" />
          <stop offset="100%" stopColor="#ffd166" />
        </linearGradient>
        <linearGradient id="sales-wave-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#74f9ff" stopOpacity="0.28" />
          <stop offset="50%" stopColor="#8f7cff" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#ffd166" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {Array.from({ length: 4 }, (_, index) => {
        const yPos = padTop + (index * (height - padTop - padBottom)) / 3
        return <line key={index} x1={padLeft} x2={width - padRight} y1={yPos} y2={yPos} stroke="rgba(156,196,255,0.16)" strokeDasharray="4 7" />
      })}

      {activeIndex !== null ? (
        <line
          x1={x(activeIndex)}
          x2={x(activeIndex)}
          y1={padTop}
          y2={height - padBottom}
          stroke="rgba(168,214,255,0.26)"
          strokeDasharray="4 7"
        />
      ) : null}

      {areaPath ? <path d={areaPath} fill="url(#sales-wave-gradient)" /> : null}
      {linePath ? <path d={linePath} fill="none" stroke="#74f9ff" strokeWidth="10" strokeOpacity="0.16" strokeLinecap="round" strokeLinejoin="round" filter="url(#sales-line-glow)" /> : null}
      {linePath ? <path d={linePath} fill="none" stroke="url(#sales-line-stroke)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" /> : null}

      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={index === activeIndex ? 7 : 5.2}
          fill="#07142f"
          stroke={index === activeIndex ? "#ffd166" : "#74f9ff"}
          strokeWidth={index === activeIndex ? 3 : 2.2}
        />
      ))}

      {activePoint && activeIndex !== null ? (
        <ChartBubble
          x={x(activeIndex)}
          y={Math.max(10, y(activePoint.value) - 56)}
          label={activePoint.label}
          value={`${formatNumberWithSpaces(activePoint.value)} so'm`}
          align={activeAlign}
        />
      ) : null}

      {series.map((item, index) => (
        <text key={`${item.label}-${index}`} x={x(index)} y={height - 10} textAnchor="middle" fontSize="12" fill="rgba(226,238,255,0.74)">
          {item.label}
        </text>
      ))}
    </svg>
  )
}

function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="text-[21px] font-black tracking-tight text-[#1f2f4d]">{title}</div>
      {action}
    </div>
  )
}

function CircularProgress({
  value,
  label,
  sublabel,
}: {
  value: number
  label: string
  sublabel: string
}) {
  const size = 172
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const safeValue = Math.max(0, Math.min(100, value))
  const dashOffset = circumference - (safeValue / 100) * circumference
  const hasSublabel = Boolean(String(sublabel || "").trim())

  return (
    <div className="relative flex h-[172px] w-[172px] items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[172px] w-[172px] -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(203,213,225,0.35)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#20b072"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[34px] font-black leading-none tracking-[-0.05em] text-[#1e2c46]">{formatPercentLabel(safeValue)}</div>
        <div className={`max-w-[6.6rem] font-semibold uppercase tracking-[0.14em] text-[#7b90b1] ${hasSublabel ? "mt-2 text-[10px] leading-4" : "mt-3 text-[12px]"}`}>{label}</div>
        {hasSublabel ? <div className="mt-1 max-w-[6.2rem] text-[9px] leading-[1.45] text-[#7c8ca8]">{sublabel}</div> : null}
      </div>
    </div>
  )
}

function SalesCard({
  total,
  incomeDelta,
  percentDelta,
  series,
  onRefresh,
  periodLabel,
  range,
  onRangeChange,
  copy,
}: {
  total: string
  incomeDelta: string
  percentDelta: string
  series: Array<{ label: string; value: number }>
  onRefresh: () => void
  periodLabel: string
  range: SalesRange
  onRangeChange: (next: SalesRange) => void
  copy: ReturnType<typeof createDashboardText>
}) {
  const insights = buildSalesInsights(series)
  const recentPoints = series.slice(-2)
  const latestPoint = recentPoints.at(-1) ?? insights.latestPoint
  const previousPoint = recentPoints.at(0) ?? null

  return (
    <div className={cardClassName("border-[#d7e6ff] bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_56%,#edf4ff_100%)] p-5 sm:p-6")}>
      <SectionHeader
        title={copy.sales.title}
        action={
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex !h-11 cursor-pointer items-center rounded-[16px] !bg-[linear-gradient(90deg,#1f57a4_0%,#184a8c_100%)] px-5 text-sm font-semibold !text-white shadow-[0_16px_28px_rgba(24,74,140,0.24)]"
          >
            {copy.common.refresh}
          </button>
        }
      />
      <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,250,255,0.98)_100%)] p-4 shadow-[0_20px_52px_-44px_rgba(37,99,235,0.24)]">
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_38px_-34px_rgba(15,23,42,0.14)]">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#7c90b2]">{copy.sales.currentPeriod}</div>
              <div className="rounded-full border border-[#dbe5f7] bg-[#f8fbff] px-4 py-2 text-sm font-semibold text-[#607392]">{periodLabel}</div>
            </div>
            <div className="mt-4 break-words text-[clamp(2rem,3vw,3.25rem)] font-black leading-[1.02] tracking-[-0.05em] text-[#1e2c46]">
              {total}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${incomeDelta.startsWith("-") ? "bg-[#fff1f4] text-[#c64762]" : "bg-[#ebf8f2] text-[#0f8b5e]"}`}>
                {incomeDelta}
              </span>
              <span className="rounded-full bg-[#eef4ff] px-3 py-1.5 text-sm font-semibold text-[#235fcf]">{percentDelta}</span>
            </div>
            <div className="mt-5 flex items-center justify-center">
              <CircularProgress
                value={insights.latestShare}
                label={copy.sales.latestShare}
                sublabel={insights.latestPoint ? `${insights.latestPoint.label} ${copy.sales.latestShare.toLowerCase()}` : copy.sales.latestShareFallback}
              />
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[20px] bg-[#f8fbff] px-4 py-3.5">
                <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#7b8daa]">{copy.sales.strongestPeriod}</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold text-[#425675]">{insights.peakPoint?.label ?? "-"}</span>
                  <span className="text-[20px] font-black leading-none text-[#1e2c46]">{formatPercentLabel(insights.peakShare)}</span>
                </div>
              </div>
              <div className="rounded-[20px] bg-[#f8fbff] px-4 py-3.5">
                <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#7b8daa]">{copy.sales.latestGrowth}</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold text-[#425675]">{latestPoint?.label ?? "-"}</span>
                  <span className={`text-[20px] font-black leading-none ${insights.growth >= 0 ? "text-[#169b66]" : "text-[#d23f5b]"}`}>{formatSignedPercent(insights.growth)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[30px] border border-[#294a9e] bg-[linear-gradient(135deg,#081a47_0%,#0a2462_42%,#12378c_100%)] p-5 shadow-[0_30px_72px_-40px_rgba(7,24,74,0.72)]">
            <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 left-6 h-36 w-36 rounded-full bg-blue-300/12 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-10 top-10 h-24 rounded-full bg-violet-300/8 blur-3xl" />
            <div className="relative">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[17px] font-semibold text-[#eef6ff]">{copy.sales.chartTitle}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-2xl border border-white/20 bg-[linear-gradient(180deg,rgba(111,143,255,0.22)_0%,rgba(73,103,225,0.16)_100%)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_14px_30px_-18px_rgba(63,98,224,0.34)] backdrop-blur">
                  <button
                    type="button"
                    onClick={() => onRangeChange("today")}
                    className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-bold transition ${range === "today" ? "!border-white/26 !bg-[linear-gradient(180deg,#6485ff_0%,#4969e6_100%)] !text-white shadow-[0_12px_24px_rgba(63,98,224,0.34)]" : "!border-transparent !bg-transparent !text-white/86 hover:!bg-white/10"}`}

                  >
                    {copy.common.daily}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRangeChange("month")}
                    className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-bold transition ${range === "month" ? "!border-white/26 !bg-[linear-gradient(180deg,#6485ff_0%,#4969e6_100%)] !text-white shadow-[0_12px_24px_rgba(63,98,224,0.34)]" : "!border-transparent !bg-transparent !text-white/86 hover:!bg-white/10"}`}

                  >
                    {copy.common.monthly}
                  </button>
                </div>
              </div>
            </div>
            {series.length ? (
              <>
                <SalesTrendChart series={series} height={330} />
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[22px] border border-cyan-200/12 bg-white/8 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#8fa5c9]">{previousPoint?.label ?? latestPoint?.label ?? "-"}</div>
                    <div className="mt-2 text-[22px] font-black leading-none text-[#f4f8ff]">
                      {formatNumberWithSpaces(previousPoint?.value ?? latestPoint?.value ?? 0)} {copy.common.amountSuffix}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[#79f3ff]">
                      {formatPercentLabel(insights.totalValue > 0 ? ((previousPoint?.value ?? latestPoint?.value ?? 0) / insights.totalValue) * 100 : 0)} {copy.sales.share}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-cyan-200/12 bg-white/8 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">

                    <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#8fa5c9]">{latestPoint?.label ?? "-"}</div>
                    <div className="mt-2 text-[22px] font-black leading-none text-[#f4f8ff]">{formatNumberWithSpaces(latestPoint?.value ?? 0)} {copy.common.amountSuffix}</div>
                    <div className="mt-2 text-sm font-semibold text-[#79f3ff]">
                      {formatPercentLabel(insights.totalValue > 0 ? ((latestPoint?.value ?? 0) / insights.totalValue) * 100 : 0)} {copy.sales.share}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-[330px] items-center justify-center rounded-[22px] border border-dashed border-[#31425d] bg-white/5 text-sm font-medium text-[#9eb2d0]">
                {copy.sales.noData}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalysisCard({
  total,
  sections,
  copy,
  language,
}: {
  total: string
  sections: Array<{ key: string; label: string; value: number; color: string; rows: CustomerSectionRow[] }>
  copy: ReturnType<typeof createDashboardText>
  language: LanguageCode
}) {
  const peakValue = Math.max(1, ...sections.map((row) => row.value))
  const [openKey, setOpenKey] = useState<string | null>(null)
  const customerCopy = (copy.customers as any) || {}
  const customerTableLabels =
    language === "ru"
      ? {
          name: customerCopy.tableName ?? "Клиент",
          phone: customerCopy.tablePhone ?? "Телефон",
          company: customerCopy.tableCompany ?? "Компания",
          date: customerCopy.tableDate ?? "Создан",
          ordersSuffix: customerCopy.ordersSuffix ?? "заказов",
          noRows: customerCopy.noRows ?? "В этом разделе клиенты не найдены",
        }
      : language === "en"
        ? {
            name: customerCopy.tableName ?? "Customer",
            phone: customerCopy.tablePhone ?? "Phone",
            company: customerCopy.tableCompany ?? "Company",
            date: customerCopy.tableDate ?? "Created",
            ordersSuffix: customerCopy.ordersSuffix ?? "orders",
            noRows: customerCopy.noRows ?? "No customers found in this section",
          }
        : {
            name: customerCopy.tableName ?? "Mijoz",
            phone: customerCopy.tablePhone ?? "Telefon",
            company: customerCopy.tableCompany ?? "Kompaniya",
            date: customerCopy.tableDate ?? "Yaratilgan",
            ordersSuffix: customerCopy.ordersSuffix ?? "ta buyurtma",
            noRows: customerCopy.noRows ?? "Bu bo'limda mijoz topilmadi",
          }

  return (
    <div className={cardClassName("border-[#d9e4f6] bg-[linear-gradient(135deg,#ffffff_0%,#f7faff_62%,#eef4ff_100%)] p-6 sm:p-7")}>
      <SectionHeader title={copy.customers.title} />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[30px] border border-white/70 bg-white/75 p-7 shadow-[0_20px_50px_-42px_rgba(37,99,235,0.2)]">
          <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#7c90b2]">{copy.customers.totalBase}</div>
          <div className="mt-5 flex items-end gap-3">
            <div className="text-[64px] font-black leading-none tracking-[-0.05em] text-[#1e2c46]">{total}</div>
            <div className="pb-2 text-[24px] text-[#64748b]">{copy.common.customer}</div>
          </div>
        </div>
        <div className="grid gap-5">
          {sections.map((section) => {
            const isOpen = openKey === section.key
            return (
              <div key={section.key} className="overflow-hidden rounded-[28px] bg-white/78 px-6 py-6 shadow-[0_16px_40px_-38px_rgba(15,23,42,0.22)]">
                <button
                  type="button"
                  onClick={() => setOpenKey((current) => (current === section.key ? null : section.key))}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-[24px] border border-[#dfe8f8] !bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] px-5 py-5 text-left shadow-[0_14px_34px_-30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.2)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span className="text-[20px] font-semibold !text-[#2d4164]">{section.label}</span>
                      <span className="text-[22px] font-black !text-[#1e2c46]">{formatNumberWithSpaces(section.value)} {copy.common.pieces}</span>
                    </div>
                    <div className="h-4 rounded-full bg-[#e7edf7]">
                      <div
                        className="h-4 rounded-full"
                        style={{ width: `${Math.max(10, Math.min(100, (section.value / peakValue) * 100))}%`, background: section.color }}
                      />
                    </div>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#dbe5f7] bg-[linear-gradient(180deg,#ffffff_0%,#f3f7ff_100%)] text-[#48648f] transition ${isOpen ? "rotate-180" : ""}`}>
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </button>

                {isOpen ? (
                  <div className="mt-5 overflow-hidden rounded-[24px] border border-[#e4ecf8] bg-[linear-gradient(180deg,#fbfdff_0%,#f5f8ff_100%)]">
                    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_140px] gap-3 border-b border-[#e6edf9] px-5 py-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#7890b3]">
                      <div>{customerTableLabels.name}</div>
                      <div>{customerTableLabels.phone}</div>
                      <div>{customerTableLabels.company}</div>
                      <div>{customerTableLabels.date}</div>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto">
                      {section.rows.length ? (
                        section.rows.map((row, index) => (
                          <div
                            key={`${section.key}-${row.id}`}
                            className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_140px] gap-3 px-5 py-4 text-sm text-[#314766] ${index !== section.rows.length - 1 ? "border-b border-[#ecf1fa]" : ""}`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[15px] font-bold text-[#1f2f4d]">{row.name || "-"}</div>
                              {typeof row.ordersCount === "number" && row.ordersCount > 0 ? (
                                <div className="mt-1 text-xs text-[#7d8eaa]">{formatNumberWithSpaces(row.ordersCount)} {customerTableLabels.ordersSuffix}</div>
                              ) : null}
                            </div>
                            <div className="truncate">{row.phone || "-"}</div>
                            <div className="truncate">{row.company || "-"}</div>
                            <div className="text-[#607392]">{formatDashboardDate(row.createdAt, language)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="px-5 py-8 text-center text-sm font-medium text-[#7387a7]">{customerTableLabels.noRows}</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PurchaseCard({
  count,
  amount,
  paidAmount,
  remainingAmount,
  totalSeries,
  paidSeries,
  copy,
}: {
  count: number
  amount: number
  paidAmount: number
  remainingAmount: number
  totalSeries: Array<{ label: string; value: number }>
  paidSeries: Array<{ label: string; value: number }>
  copy: ReturnType<typeof createDashboardText>
}) {
  const insights = buildPurchaseInsights({ count, amount, paidAmount, remainingAmount, totalSeries, paidSeries })

  return (
    <div className={cardClassName("border-[#d7ebdf] bg-[linear-gradient(135deg,#ffffff_0%,#f6fbff_20%,#f6fcf8_58%,#edf8f2_100%)] p-6 sm:p-7")}>
      <SectionHeader title={copy.purchase.title} action={<Activity className="h-5 w-5 text-[#6b7a92]" />} />
      <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.26fr)_minmax(0,1fr)_minmax(250px,0.3fr)]">
        <div className="rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-[0_22px_60px_-44px_rgba(16,185,129,0.24)] backdrop-blur">
          <div className="text-[13px] font-semibold uppercase tracking-[0.24em] text-[#7c90b2]">{copy.purchase.currentPeriod}</div>
          <div className="mt-4 text-[clamp(2rem,2.8vw,3rem)] font-black leading-[1.02] tracking-[-0.05em] text-[#1e2c46]">
            {formatNumberWithSpaces(count)} {copy.common.pieces}
          </div>
          <div className="mt-2 text-[17px] font-medium text-[#51637f]">{copy.purchase.acceptedReceipts}</div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#ebf8f2] px-3 py-1.5 text-sm font-semibold text-[#0f8b5e]">
              {copy.purchase.total} {formatNumberWithSpaces(amount)} {copy.common.amountSuffix}
            </span>
            <span className="rounded-full bg-[#eef4ff] px-3 py-1.5 text-sm font-semibold text-[#235fcf]">
              {formatPercentLabel(insights.coverage)} {copy.purchase.paid.toLowerCase()}
            </span>
          </div>
          <div className="mt-6 rounded-[24px] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#7b8daa]">{copy.purchase.paid}</div>
                <div className="mt-2 text-[20px] font-black leading-none text-[#169b66]">{formatNumberWithSpaces(paidAmount)} {copy.common.amountSuffix}</div>
              </div>
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#7b8daa]">{copy.purchase.remaining}</div>
                <div className="mt-2 text-[20px] font-black leading-none text-[#d23f5b]">{formatNumberWithSpaces(remainingAmount)} {copy.common.amountSuffix}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-[#294a9e] bg-[linear-gradient(135deg,#081a47_0%,#0a2462_42%,#12378c_100%)] p-5 shadow-[0_30px_72px_-40px_rgba(7,24,74,0.72)]">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 left-6 h-36 w-36 rounded-full bg-blue-300/12 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-10 top-10 h-24 rounded-full bg-violet-300/8 blur-3xl" />
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-[#eef6ff]">{copy.purchase.chartTitle}</div>
              <div className="mt-1 text-sm text-[#9eb2d0]">{copy.purchase.chartSubtitle}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-bold text-[#dbe7ff]">{formatPercentLabel(insights.remainingShare)} {copy.purchase.remainingShare}</div>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#dff7ff]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#4be7ff]" />
              {copy.purchase.totalPurchases}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#f0ddff]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#dc6cff]" />
              {copy.purchase.paid}
            </div>
          </div>
          {totalSeries.some((point) => point.value > 0) || paidSeries.some((point) => point.value > 0) ? (
            <>
              <ChartCanvas
                lines={[
                  { data: totalSeries, color: "#74f9ff", name: copy.purchase.totalPurchases, width: 4, point: true, areaColor: "#74f9ff", pointRadius: 5 },
                  { data: paidSeries, color: "#dc6cff", name: copy.purchase.paid, width: 3, point: true, areaColor: "#dc6cff", pointRadius: 4.6 },
                ]}
                height={220}
                areaId="purchase-card"
                theme="dark"
              />
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[24px] border border-white/14 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#8fa5c9]">{copy.purchase.totalPurchases}</div>
                    <div className="mt-2 text-[22px] font-black leading-none text-[#f4f8ff]">{formatNumberWithSpaces(amount)} {copy.common.amountSuffix}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/14 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#8fa5c9]">{copy.purchase.paid}</div>
                    <div className="mt-2 text-[22px] font-black leading-none text-[#d58dff]">{formatNumberWithSpaces(paidAmount)} {copy.common.amountSuffix}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/14 bg-white/10 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#8fa5c9]">{copy.purchase.remaining}</div>
                    <div className="mt-2 text-[22px] font-black leading-none text-[#ff97c7]">{formatNumberWithSpaces(remainingAmount)} {copy.common.amountSuffix}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-[260px] items-center justify-center rounded-[24px] border border-dashed border-white/16 bg-white/10 text-sm font-medium text-white/72">
                {copy.purchase.noData}
              </div>
            )}
          </div>

        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,251,255,0.98)_100%)] p-5 shadow-[0_22px_60px_-44px_rgba(37,99,235,0.14)]">
          <div className="text-[14px] font-semibold text-[#6f83a7]">{copy.purchase.paymentProgress}</div>
          <div className="mt-4 flex items-center justify-center">
            <CircularProgress
              value={insights.coverage}
              label={copy.purchase.paymentShare}
              sublabel=""
            />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-[24px] bg-[#f8fbff] px-5 py-4">
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#7b8daa]">{copy.purchase.paid}</div>
              <div className="mt-2 flex flex-nowrap items-baseline gap-2 overflow-hidden text-[18px] font-semibold text-[#4b5f7d]">
                <span className="shrink-0 text-[#1e2c46]">{formatPercentLabel(insights.coverage)}</span>
                <span className="truncate whitespace-nowrap font-black text-[#169b66]">{formatNumberWithSpaces(paidAmount)} {copy.common.amountSuffix}</span>
              </div>
            </div>
            <div className="rounded-[24px] bg-[#fff8f2] px-5 py-4">
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#7b8daa]">{copy.purchase.remaining}</div>
              <div className="mt-2 flex flex-nowrap items-baseline gap-2 overflow-hidden text-[18px] font-semibold text-[#4b5f7d]">
                <span className="shrink-0 text-[#1e2c46]">{formatPercentLabel(insights.remainingShare)}</span>
                <span className="truncate whitespace-nowrap font-black text-[#d23f5b]">{formatNumberWithSpaces(remainingAmount)} {copy.common.amountSuffix}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OrdersCard({
  stats,
  trend,
  orders,
  copy,
  language,
}: {
  stats: OrderStatusStat[]
  trend: OrderTrendStats
  orders: OrderSummary[]
  copy: ReturnType<typeof createDashboardText>
  language: LanguageCode
}) {
  const insights = buildOrderInsights(stats)
  const showcaseStats = pickOrderShowcaseStats(stats, language)
  const [selectedStatusKey, setSelectedStatusKey] = useState<string | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<OrderDetailResponse[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  const selectedStatusOrders = useMemo(() => {
    if (!selectedStatusKey) return []
    if (selectedStatusKey === "ACTIVE") {
      return orders.filter((order) => ["NEW", "IN_PROGRESS", "CONFIRMED", "ON_DELIVERY"].includes(normalizeOrderStatusForDashboard(order.status)))
    }
    return orders.filter((order) => normalizeOrderStatusForDashboard(order.status) === selectedStatusKey)
  }, [orders, selectedStatusKey])

  useEffect(() => {
    let cancelled = false

    if (!selectedStatusKey) {
      setSelectedDetails([])
      setDetailsLoading(false)
      return
    }

    const targetIds = selectedStatusOrders.map((order) => order.id).slice(0, 12)
    if (!targetIds.length) {
      setSelectedDetails([])
      setDetailsLoading(false)
      return
    }

    ;(async () => {
      try {
        setDetailsLoading(true)
        const rows = await Promise.all(
          targetIds.map(async (id) => {
            try {
              return await fetchOrderDetail(Number(id))
            } catch {
              return null
            }
          })
        )
        if (cancelled) return
        setSelectedDetails(rows.filter(Boolean) as OrderDetailResponse[])
      } finally {
        if (!cancelled) setDetailsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedStatusKey, selectedStatusOrders])

  return (
    <div className={cardClassName("border-[#dfe5f4] bg-[linear-gradient(135deg,#ffffff_0%,#f8faff_65%,#f1f6ff_100%)] p-5 sm:p-6")}>
      <SectionHeader title={copy.orders.title} />
      {stats.length ? (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[36px] border border-[#dce6fb] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,249,255,0.98)_100%)] px-6 py-7 shadow-[0_30px_72px_-52px_rgba(37,99,235,0.22)]">
            <div className="text-[13px] font-semibold uppercase tracking-[0.24em] text-[#89a0c4]">{copy.orders.currentFlow}</div>
            <div className="mt-4 text-[58px] font-black leading-none tracking-[-0.06em] text-[#223251]">
              {formatNumberWithSpaces(insights.total)} {copy.common.pieces}
            </div>
            <div className="mt-3 text-[17px] font-medium text-[#5c6f8f]">{copy.orders.overallState}</div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#edf4ff] px-4 py-2 text-sm font-semibold text-[#3f7cff]">
                {formatPercentLabel(insights.completedShare)} {copy.orders.completedShare}
              </span>
              <span className="rounded-full bg-[#fff3e8] px-4 py-2 text-sm font-semibold text-[#d1902e]">
                {formatPercentLabel(insights.activeShare)} {copy.orders.activeShare}
              </span>
            </div>
            <div className="mt-7 flex items-center justify-center">
              <CircularProgress
                value={insights.completedShare}
                label={copy.orders.completedRatio}
                sublabel={copy.orders.completedRatioHint}
              />
            </div>
            <div className="mt-6 grid gap-3">
              <div className="rounded-[24px] border border-[#e8eef8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#5a7be8]">
                    <CheckCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[#8aa0c2]">{copy.orders.peakStatus}</div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-[15px] text-[#425675]">
                      <span className="truncate">{insights.peakStatus?.label ?? "-"}</span>
                      <span className="font-black text-[#1e2c46]">{formatNumberWithSpaces(insights.peakStatus?.count ?? 0)} {copy.common.pieces}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] border border-[#f7e2e7] bg-[linear-gradient(180deg,#ffffff_0%,#fff8fa_100%)] px-4 py-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.14)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff1f4] text-[#ec5b73]">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[#8aa0c2]">{copy.orders.cancelled}</div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-[15px] text-[#425675]">
                      <span>{copy.orders.currentRange}</span>
                      <span className="font-black text-[#d23f5b]">{formatNumberWithSpaces(insights.cancelled)} {copy.common.pieces}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[36px] border border-[#294a9e] bg-[linear-gradient(135deg,#081a47_0%,#0a2462_42%,#12378c_100%)] p-6 shadow-[0_30px_72px_-40px_rgba(7,24,74,0.72)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 left-8 h-40 w-40 rounded-full bg-blue-300/12 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-12 top-12 h-24 rounded-full bg-violet-300/8 blur-3xl" />
            <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[17px] font-black text-[#eef6ff]">{copy.orders.analysisTitle}</div>
                <div className="mt-1 text-[15px] text-[#9eb2d0]">{copy.orders.analysisSubtitle}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-white/14 bg-white/10 px-4 py-2 text-sm font-bold text-[#7ff0bf]">
                  {formatNumberWithSpaces(insights.active)} {copy.orders.activeOrders}
                </div>
              </div>
            </div>
            <div className="relative grid grid-cols-1 gap-4 xl:grid-cols-3">
              {showcaseStats.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setSelectedStatusKey(item.key)}
                  className="cursor-pointer appearance-none rounded-[28px] border border-white/14 !bg-white/10 px-5 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-0.5 hover:bg-white/12"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-semibold !text-[#dfe9ff]">{item.label}</div>
                      <div className="mt-4 text-[32px] font-black leading-none tracking-[-0.05em] !text-[#f4f8ff]">
                        {formatNumberWithSpaces(item.count)} {copy.common.pieces}
                      </div>
                    </div>
                    <div className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-3 py-2 text-sm font-bold ${item.tone}`}>
                      {insights.total > 0 ? formatPercentLabel((item.count / insights.total) * 100) : "0%"}
                    </div>
                  </div>
                  <div className="mt-5 h-3.5 rounded-full bg-[#e7edf7]">
                    <div
                      className="h-3.5 rounded-full"
                      style={{
                        width: `${insights.total > 0 ? Math.max(10, Math.min(100, (item.count / insights.total) * 100)) : 10}%`,
                        background:
                          item.key === "CANCELLED"
                            ? "linear-gradient(90deg,#ffb5c2,#ef4768)"
                            : item.key === "READY" || item.key === "DELIVERED"
                              ? "linear-gradient(90deg,#9ce7c4,#23b26d)"
                              : "linear-gradient(90deg,#a7c4ff,#5f84ea)",
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-[30px] border border-[#294a9e] bg-[linear-gradient(135deg,#081a47_0%,#0a2462_42%,#12378c_100%)] p-6 shadow-[0_30px_72px_-40px_rgba(7,24,74,0.72)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-5">
                  <div className="inline-flex items-center gap-2 text-[15px] font-medium text-[#dfe9ff]">
                    <span className="h-3 w-3 rounded-full bg-[#4be7ff]" />
                    {getOrderStatusLabel("READY", language)}
                  </div>
                  <div className="inline-flex items-center gap-2 text-[15px] font-medium text-[#dfe9ff]">
                    <span className="h-3 w-3 rounded-full bg-[#dc6cff]" />
                    {getOrderStatusLabel("ON_DELIVERY", language)}
                  </div>
                </div>
                <div className="rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-semibold text-white/88">{copy.orders.weekly}</div>
              </div>
              {trend.completedSeries.some((point) => point.value > 0) || trend.deliverySeries.some((point) => point.value > 0) ? (
                <OrdersTrendChart
                  completedSeries={trend.completedSeries}
                  deliverySeries={trend.deliverySeries}
                  height={290}
                />
              ) : (
                <div className="flex h-[270px] items-center justify-center rounded-[24px] border border-dashed border-white/16 bg-white/10 text-sm font-medium text-white/72">
                  {copy.orders.noTrend}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-[#d7e1f2] bg-white/50 text-sm font-medium text-[#7c8ca8]">
          {copy.orders.noStatuses}
        </div>
      )}

      <Dialog open={Boolean(selectedStatusKey)} onOpenChange={(open) => !open && setSelectedStatusKey(null)}>
        <DialogContent className="max-w-[1100px]">
          <DialogHeader>
            <DialogTitle className="text-[28px] font-semibold text-[#16325c]">
              {showcaseStats.find((item) => item.key === selectedStatusKey)?.label ?? copy.orders.title}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-10 text-center text-sm font-medium text-[#6f83a7]">{copy.orders.loadingOrders}</div>
          ) : selectedDetails.length ? (
            <div className="grid gap-4">
              {selectedDetails.map((order) => (
                <div key={order.id} className="rounded-[24px] border border-[#e4ecf8] bg-white px-5 py-5 shadow-[0_16px_36px_-32px_rgba(15,23,42,0.18)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[18px] font-black text-[#1e2c46]">{formatOrderNumber(order.order_no, order.id)}</div>
                      <div className="mt-1 text-sm text-[#6d809f]">{order.client?.name ?? "-"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#6d809f]">{order.delivery_date || order.order_date}</div>
                      <div className="mt-1 text-[18px] font-black text-[#1e2c46]">{formatNumberWithSpaces(order.total ?? 0)} {copy.common.amountSuffix}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {(order.items ?? []).length ? (
                      order.items?.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-[18px] bg-[#f8fbff] px-4 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-semibold text-[#314766]">
                              {item.product_name || item.raw_material_name || copy.orders.products}
                            </div>
                            <div className="mt-1 text-xs text-[#7a8daa]">{formatNumberWithSpaces(item.line_total ?? 0)} {copy.common.amountSuffix}</div>
                          </div>
                          <div className="text-sm font-bold text-[#1e2c46]">{item.qty}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] bg-[#f8fbff] px-4 py-3 text-sm text-[#7a8daa]">{copy.orders.noItems}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm font-medium text-[#6f83a7]">{copy.orders.noStatuses}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WarehouseCard({
  range,
  onRangeChange,
  stats,
  copy,
  language,
  details,
}: {
  range: WarehouseRange
  onRangeChange: (next: WarehouseRange) => void
  stats: WarehouseStats
  copy: ReturnType<typeof createDashboardText>
  language: LanguageCode
  details: {
    incoming: WarehouseDetailRow[]
    outgoing: WarehouseDetailRow[]
  }
}) {
  const [openKey, setOpenKey] = useState<"incoming" | "outgoing" | null>(null)
  const warehouseCopy = (copy.warehouse as any) || {}
  const tableCopy =
    language === "ru"
      ? {
          name: warehouseCopy.tableName ?? "Наименование",
          qty: warehouseCopy.tableQty ?? "Количество",
          amount: warehouseCopy.tableAmount ?? "Сумма",
          location: warehouseCopy.tableLocation ?? "Локация",
          date: warehouseCopy.tableDate ?? "Дата",
          noRows: warehouseCopy.noRows ?? "Складские движения не найдены",
        }
      : language === "en"
        ? {
            name: warehouseCopy.tableName ?? "Item",
            qty: warehouseCopy.tableQty ?? "Qty",
            amount: warehouseCopy.tableAmount ?? "Amount",
            location: warehouseCopy.tableLocation ?? "Location",
            date: warehouseCopy.tableDate ?? "Date",
            noRows: warehouseCopy.noRows ?? "No warehouse movements found",
          }
        : {
            name: warehouseCopy.tableName ?? "Nomi",
            qty: warehouseCopy.tableQty ?? "Miqdor",
            amount: warehouseCopy.tableAmount ?? "Summa",
            location: warehouseCopy.tableLocation ?? "Joylashuv",
            date: warehouseCopy.tableDate ?? "Sana",
            noRows: warehouseCopy.noRows ?? "Ombor harakati topilmadi",
          }

  const incomingOpen = openKey === "incoming"
  const outgoingOpen = openKey === "outgoing"

  return (
    <div className={cardClassName("border-[#d7ebdf] bg-[linear-gradient(135deg,#ffffff_0%,#f3fbf7_56%,#ebf7f0_100%)] p-6 sm:p-7")}>
      <SectionHeader
        title={copy.warehouse.title}
        action={
          <div className="flex items-center gap-3 text-[#6f7f99]">
            <div className="inline-flex rounded-2xl border border-[#cfdcff] bg-[linear-gradient(180deg,rgba(111,143,255,0.2)_0%,rgba(73,103,225,0.12)_100%)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_28px_-18px_rgba(63,98,224,0.28)]">
              <button
                type="button"
                onClick={() => onRangeChange("today")}
                className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-bold transition ${range === "today" ? "!border-white/26 !bg-[linear-gradient(180deg,#6485ff_0%,#4969e6_100%)] !text-white shadow-[0_12px_24px_rgba(63,98,224,0.3)]" : "!border-transparent !bg-white/36 !text-[#48608d] hover:!bg-white/58"}`}
              >
                {copy.common.daily}
              </button>
              <button
                type="button"
                onClick={() => onRangeChange("month")}
                className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-bold transition ${range === "month" ? "!border-white/26 !bg-[linear-gradient(180deg,#6485ff_0%,#4969e6_100%)] !text-white shadow-[0_12px_24px_rgba(63,98,224,0.3)]" : "!border-transparent !bg-white/36 !text-[#48608d] hover:!bg-white/58"}`}
              >
                {copy.common.monthly}
              </button>
            </div>
            <button type="button" className="cursor-pointer rounded-xl !bg-[#1f57a4] p-2 !text-white shadow-[0_10px_18px_rgba(24,74,140,0.24)]"><MoreHorizontal className="h-4 w-4" /></button>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(420px,0.54fr)_minmax(0,1fr)]">
        <div className="rounded-[30px] border border-[#d7e7dd] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,251,248,0.98)_100%)] p-5 shadow-[0_22px_60px_-44px_rgba(16,185,129,0.18)] backdrop-blur">
          <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#7a8ea8]">{copy.warehouse.title}</div>
          <div className="mt-5 space-y-4">
            <div className="overflow-hidden rounded-[26px] border border-[#ddefe5] bg-[linear-gradient(180deg,#fbfffd_0%,#f3fbf7_100%)] shadow-[0_18px_36px_-30px_rgba(22,170,110,0.16)]">
              <button
                type="button"
                onClick={() => setOpenKey((current) => (current === "incoming" ? null : "incoming"))}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-[#54728e]">{copy.warehouse.incoming}</div>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div className="text-[clamp(2rem,2.7vw,3rem)] font-black leading-none tracking-[-0.04em] text-[#16aa6e]">
                      {formatNumberWithSpaces(stats.incomingCount)} {copy.common.pieces}
                    </div>
                    <div className="text-right text-[15px] font-semibold text-[#56708f]">{formatNumberWithSpaces(stats.incomingAmount)} {copy.common.amountSuffix}</div>
                  </div>
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d5eadf] bg-white text-[#159160] transition ${incomingOpen ? "rotate-180" : ""}`}>
                  <ChevronDown className="h-5 w-5" />
                </div>
              </button>
              {incomingOpen ? (
                <div className="border-t border-[#e3f1e8] bg-white/90">
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[minmax(220px,1.35fr)_120px_180px_minmax(160px,1fr)_140px] gap-4 bg-[linear-gradient(180deg,#f3faf6_0%,#edf7f1_100%)] px-5 py-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#6e87a6]">
                        <div>{tableCopy.name}</div>
                        <div>{tableCopy.qty}</div>
                        <div>{tableCopy.amount}</div>
                        <div>{tableCopy.location}</div>
                        <div>{tableCopy.date}</div>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[320px] overflow-auto">
                    {details.incoming.length ? (
                      details.incoming.map((row, index) => (
                        <div key={row.id} className="overflow-x-auto">
                          <div className={`grid min-w-[760px] grid-cols-[minmax(220px,1.35fr)_120px_180px_minmax(160px,1fr)_140px] gap-4 px-5 py-4 text-[15px] text-[#31516b] ${index !== details.incoming.length - 1 ? "border-t border-[#edf5f1]" : ""}`}>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-[#244861]">{row.name}</div>
                              {row.note ? <div className="mt-1 truncate text-xs text-[#7c90ab]">{row.note}</div> : null}
                            </div>
                            <div className="font-semibold">{formatNumberWithSpaces(row.qty)}</div>
                            <div className="font-semibold text-[#1a8d60]">{formatNumberWithSpaces(row.amount)} {copy.common.amountSuffix}</div>
                            <div className="truncate">{row.location}</div>
                            <div className="font-medium text-[#607392]">{formatDashboardDate(row.date, language)}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-7 text-center text-sm text-[#7387a7]">{tableCopy.noRows}</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-[26px] border border-[#f3dde4] bg-[linear-gradient(180deg,#fffdfd_0%,#fff5f7_100%)] shadow-[0_18px_36px_-30px_rgba(225,67,97,0.14)]">
              <button
                type="button"
                onClick={() => setOpenKey((current) => (current === "outgoing" ? null : "outgoing"))}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-[#54728e]">{copy.warehouse.outgoing}</div>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <div className="text-[clamp(2rem,2.7vw,3rem)] font-black leading-none tracking-[-0.04em] text-[#db3150]">
                      {formatNumberWithSpaces(stats.outgoingCount)} {copy.common.pieces}
                    </div>
                    <div className="text-right text-[15px] font-semibold text-[#56708f]">{formatNumberWithSpaces(stats.outgoingAmount)} {copy.common.amountSuffix}</div>
                  </div>
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#f0d9df] bg-white text-[#d13a57] transition ${outgoingOpen ? "rotate-180" : ""}`}>
                  <ChevronDown className="h-5 w-5" />
                </div>
              </button>
              {outgoingOpen ? (
                <div className="border-t border-[#f4e5e9] bg-white/90">
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[minmax(220px,1.35fr)_120px_180px_minmax(160px,1fr)_140px] gap-4 bg-[linear-gradient(180deg,#fff7f9_0%,#fff1f4_100%)] px-5 py-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[#6e87a6]">
                        <div>{tableCopy.name}</div>
                        <div>{tableCopy.qty}</div>
                        <div>{tableCopy.amount}</div>
                        <div>{tableCopy.location}</div>
                        <div>{tableCopy.date}</div>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[320px] overflow-auto">
                    {details.outgoing.length ? (
                      details.outgoing.map((row, index) => (
                        <div key={row.id} className="overflow-x-auto">
                          <div className={`grid min-w-[760px] grid-cols-[minmax(220px,1.35fr)_120px_180px_minmax(160px,1fr)_140px] gap-4 px-5 py-4 text-[15px] text-[#31516b] ${index !== details.outgoing.length - 1 ? "border-t border-[#f7eef1]" : ""}`}>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-[#244861]">{row.name}</div>
                              {row.note ? <div className="mt-1 truncate text-xs text-[#7c90ab]">{row.note}</div> : null}
                            </div>
                            <div className="font-semibold">{formatNumberWithSpaces(row.qty)}</div>
                            <div className="font-semibold text-[#d13a57]">{formatNumberWithSpaces(row.amount)} {copy.common.amountSuffix}</div>
                            <div className="truncate">{row.location}</div>
                            <div className="font-medium text-[#607392]">{formatDashboardDate(row.date, language)}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-7 text-center text-sm text-[#7387a7]">{tableCopy.noRows}</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-[#294a9e] bg-[linear-gradient(135deg,#081a47_0%,#0a2462_42%,#12378c_100%)] p-6 shadow-[0_30px_72px_-40px_rgba(7,24,74,0.72)]">
          <div className="pointer-events-none absolute -right-10 -top-8 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-blue-300/12 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-10 top-10 h-24 rounded-full bg-violet-300/8 blur-3xl" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold text-[#eef6ff]">{range === "today" ? copy.warehouse.dailyStats : copy.warehouse.monthlyStats}</div>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#dff7ff]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#74f9ff]" />
              {copy.warehouse.incoming}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#f6d7ff]">
              <span className="h-[3px] w-4 rounded-full bg-[#dc6cff]" />
              {copy.warehouse.outgoing}
            </div>
          </div>
          {stats.incomingSeries.some((point) => point.value > 0) || stats.outgoingSeries.some((point) => point.value > 0) ? (
            <ChartCanvas
              lines={[
                { data: stats.outgoingSeries, color: "#dc6cff", name: copy.warehouse.outgoing, width: 3, point: true, areaColor: "#dc6cff", strokeDasharray: "9 7", pointRadius: 4 },
                { data: stats.incomingSeries, color: "#74f9ff", name: copy.warehouse.incoming, width: 3.8, point: true, areaColor: "#74f9ff", pointRadius: 4.8 },
              ]}
              height={250}
              areaId="warehouse-card"
              theme="dark"
            />
          ) : (
            <div className="flex h-[250px] items-center justify-center rounded-[24px] border border-dashed border-white/16 bg-white/10 text-sm font-medium text-white/72">
              {copy.warehouse.noData}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <div className="rounded-xl border border-white/14 bg-white/10 px-4 py-2 text-sm text-[#d9e7ff]">{range === "today" ? copy.warehouse.dailyIndicator : copy.warehouse.monthlyIndicator}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OverviewDashboardPage() {
  const { language } = useI18n()
  const metricModalText = useMemo(() => getMetricModalText(language), [language])
  const [ui, setUi] = useState<UiState>("loading")
  const [filters] = useState<DashboardFilter>({ range: "month", date: todayISO(), currency: "UZS" })
  const rangeSales: ChartRange = "1M"
  const rangeSmall: ChartRange = "1M"
  const [summary, setSummary] = useState<OverviewSummaryResponse | null>(null)
  const [rows, setRows] = useState<RecentRow[]>([])
  const [salesRange, setSalesRange] = useState<SalesRange>("month")
  const [salesSeries, setSalesSeries] = useState<Array<{ label: string; value: number }>>([])
  const [salesStats, setSalesStats] = useState<SalesStats>({ total: 0, deltaAmount: 0, deltaPercent: 0 })
  const [skladSeries, setSkladSeries] = useState<Array<{ label: string; value: number }>>([])
  const [counts, setCounts] = useState<OverviewCounts>({
    newCustomers: 0,
    totalCustomers: 0,
    returningCustomers: 0,
    completedOrders: 0,
    activeOrders: 0,
  })
  const [customerSections, setCustomerSections] = useState<{
    newCustomers: CustomerSectionRow[]
    existingCustomers: CustomerSectionRow[]
    returningCustomers: CustomerSectionRow[]
  }>({
    newCustomers: [],
    existingCustomers: [],
    returningCustomers: [],
  })
  const [purchaseStats, setPurchaseStats] = useState<PurchaseStats>({
    count: 0,
    amount: 0,
    paidAmount: 0,
    remainingAmount: 0,
    totalSeries: [],
    paidSeries: [],
  })
  const [purchaseRows, setPurchaseRows] = useState<PurchaseListItem[]>([])
  const [orderStatusStats, setOrderStatusStats] = useState<OrderStatusStat[]>([])
  const [orderRows, setOrderRows] = useState<OrderSummary[]>([])
  const [orderTotalsById, setOrderTotalsById] = useState<Record<number, number>>({})
  const [orderTrend, setOrderTrend] = useState<OrderTrendStats>({
    completedSeries: [],
    deliverySeries: [],
  })
  const [warehouseRange, setWarehouseRange] = useState<WarehouseRange>("month")
  const [warehouseStats, setWarehouseStats] = useState<WarehouseStats>({
    incomingCount: 0,
    outgoingCount: 0,
    incomingAmount: 0,
    outgoingAmount: 0,
    incomingSeries: [],
    outgoingSeries: [],
  })
  const [warehouseDetails, setWarehouseDetails] = useState<{
    incoming: WarehouseDetailRow[]
    outgoing: WarehouseDetailRow[]
  }>({
    incoming: [],
    outgoing: [],
  })
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const refreshTimerRef = useRef<number | null>(null)
  const requestRefreshRef = useRef<() => void>(() => {})

  const copy = useMemo(() => createDashboardText(language), [language])

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  const requestRefresh = () => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = window.setTimeout(() => {
      setReloadKey((key) => key + 1)
      refreshTimerRef.current = null
    }, 180)
  }

  requestRefreshRef.current = requestRefresh

  useEffect(() => {
    const unsub = warehouseEvents.subscribe(() => requestRefreshRef.current())
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = salesEvents.subscribe(() => requestRefreshRef.current())
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = financeEvents.subscribe(() => requestRefreshRef.current())
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = partnerEvents.subscribe(() => requestRefreshRef.current())
    return () => unsub()
  }, [])

  useEffect(() => {
    const syncDashboard = () => requestRefresh()
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncDashboard()
    }

    window.addEventListener("focus", syncDashboard)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("focus", syncDashboard)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setUi("loading")
        const res = await dashboardApi.getOverviewSummary(filters)
        if (cancelled) return
        setSummary(res)
        setUi("content")
      } catch {
        if (cancelled) return
        setUi("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filters, reloadKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const salesFilterRange: DashboardFilter["range"] = salesRange === "today" ? "week" : "month"
        const salesWindow = getDateWindow(salesFilterRange, filters.date || todayISO())
        const previousSalesWindow = getPreviousDateWindow(salesWindow)
        const [salesOrdersRes, previousSalesOrdersRes, skladRes] = await Promise.all([
          fetchAllOrdersPages({
            ordering: "-order_date",
            date_from: salesWindow.from,
            date_to: salesWindow.to,
          }),
          fetchAllOrdersPages({
            ordering: "-order_date",
            date_from: previousSalesWindow.from,
            date_to: previousSalesWindow.to,
          }),
          dashboardApi.getOverviewSeries("sklad", rangeSmall, filters),
        ])
        if (cancelled) return
        const currentOrders = salesOrdersRes
        const previousOrders = previousSalesOrdersRes
        const nextSeries = buildSalesTrendSeries(currentOrders, salesWindow, salesFilterRange, language)
        const currentTotal = currentOrders.reduce((sum, row) => sum + numFromValue(row.total), 0)
        const previousTotal = previousOrders.reduce((sum, row) => sum + numFromValue(row.total), 0)
        const deltaAmount = currentTotal - previousTotal
        const deltaPercent = previousTotal > 0 ? (deltaAmount / previousTotal) * 100 : currentTotal > 0 ? 100 : 0
        setSalesSeries(nextSeries)
        setSalesStats({
          total: currentTotal,
          deltaAmount,
          deltaPercent,
        })
        setSkladSeries(skladRes.series)
      } catch {
        if (cancelled) return
        setSalesSeries([])
        setSalesStats({ total: 0, deltaAmount: 0, deltaPercent: 0 })
        setSkladSeries([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [salesRange, rangeSales, rangeSmall, filters, reloadKey, language])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const params: RecentQuery = {
          page: 1,
          pageSize: 6,
          sortKey: "date",
          sortDir: "desc",
          range: filters.range,
          date: filters.date,
          currency: filters.currency,
        }
        const res = await dashboardApi.getOverviewRecent(params)
        if (!cancelled) setRows(res.rows)
      } catch {
        if (!cancelled) setRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filters, reloadKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const window = getDateWindow(filters.range, filters.date || todayISO())

      try {
        const [clientsRes, ordersRes] = await Promise.allSettled([
          fetchAllClientsPages(),
          (async () => {
            return fetchAllOrdersPages({ ordering: "-order_date" })
          })(),
        ])

        if (cancelled) return

        const clientItems: Client[] = clientsRes.status === "fulfilled" ? clientsRes.value : []
        const newCustomers = clientItems.filter((client) => isDateInWindow(client.createdAt, window)).length

        const orderItems = ordersRes.status === "fulfilled" ? ordersRes.value : []
        const ordersInRange = orderItems.filter((order) => isDateInWindow(order.order_date || order.created_at, window))
        const repeatBuyerMap = new Map<string, number>()
        ordersInRange.forEach((order) => {
          const clientId = getOrderClientId(order.client_code || order.client_name)
          if (!clientId) return
          repeatBuyerMap.set(clientId, (repeatBuyerMap.get(clientId) ?? 0) + 1)
        })
        const completedOrders = ordersInRange.filter((order) => {
          const status = String(order.status || "").toUpperCase()
          return ["READY", "COMPLETED", "DONE", "CLOSED", "DELIVERED"].includes(status)
        }).length
        const activeOrders = ordersInRange.filter((order) => {
          const status = String(order.status || "").toUpperCase()
          return ["NEW", "IN_PROGRESS", "CONFIRMED", "ON_DELIVERY"].includes(status)
        }).length

        const statusMeta = [
          { key: "NEW", label: getOrderStatusLabel("NEW", language), tone: "bg-sky-50 text-sky-700 border border-sky-200" },
          { key: "IN_PROGRESS", label: getOrderStatusLabel("IN_PROGRESS", language), tone: "bg-amber-50 text-amber-700 border border-amber-200" },
          { key: "READY", label: getOrderStatusLabel("READY", language), tone: "bg-violet-50 text-violet-700 border border-violet-200" },
          { key: "ON_DELIVERY", label: getOrderStatusLabel("ON_DELIVERY", language), tone: "bg-indigo-50 text-indigo-700 border border-indigo-200" },
          { key: "DELIVERED", label: getOrderStatusLabel("DELIVERED", language), tone: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
          { key: "CANCELLED", label: getOrderStatusLabel("CANCELLED", language), tone: "bg-orange-50 text-orange-700 border border-orange-200" },
        ] as const

        const groupedCounts = new Map<string, number>()
        ordersInRange.forEach((order) => {
          const key = normalizeOrderStatusForDashboard(order.status)
          groupedCounts.set(key, (groupedCounts.get(key) ?? 0) + 1)
        })

        const newCustomerRows: CustomerSectionRow[] = clientItems
          .filter((client) => isDateInWindow(client.createdAt, window))
          .map((client) => ({
            id: String(client.id),
            name: client.name,
            phone: client.phone,
            company: client.company,
            createdAt: client.createdAt,
          }))

        const existingCustomerRows: CustomerSectionRow[] = clientItems
          .filter((client) => !isDateInWindow(client.createdAt, window))
          .map((client) => ({
            id: String(client.id),
            name: client.name,
            phone: client.phone,
            company: client.company,
            createdAt: client.createdAt,
          }))

        const returningCustomerRows: CustomerSectionRow[] = clientItems
          .filter((client) => (repeatBuyerMap.get(String(client.id)) ?? 0) >= 2)
          .map((client) => ({
            id: String(client.id),
            name: client.name,
            phone: client.phone,
            company: client.company,
            createdAt: client.createdAt,
            ordersCount: repeatBuyerMap.get(String(client.id)) ?? 0,
          }))
        const returningCustomers = returningCustomerRows.length

        setCounts({
          newCustomers,
          totalCustomers: clientItems.length,
          returningCustomers,
          completedOrders,
          activeOrders,
        })
        setCustomerSections({
          newCustomers: newCustomerRows,
          existingCustomers: existingCustomerRows,
          returningCustomers: returningCustomerRows,
        })
        setOrderRows(ordersInRange)
        setOrderStatusStats(
          statusMeta
            .map((status) => ({
              ...status,
              count: groupedCounts.get(status.key) ?? 0,
            }))
            .filter((status) => status.count > 0)
        )
        setOrderTrend(buildOrderTrendSeries(orderItems, filters.date || todayISO(), language))
      } catch {
        if (!cancelled) {
          setCounts({
            newCustomers: 0,
            totalCustomers: 0,
            returningCustomers: 0,
            completedOrders: 0,
            activeOrders: 0,
          })
          setCustomerSections({
            newCustomers: [],
            existingCustomers: [],
            returningCustomers: [],
          })
          setOrderRows([])
          setOrderStatusStats([])
          setOrderTrend({
            completedSeries: [],
            deliverySeries: [],
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filters.date, filters.range, reloadKey, language])

  useEffect(() => {
    let cancelled = false

    const rowsNeedingDetails = orderRows.filter((order) => numFromValue(order.total) <= 0)
    if (!rowsNeedingDetails.length) {
      setOrderTotalsById({})
      return () => {
        cancelled = true
      }
    }

    ;(async () => {
      const detailResults = await Promise.all(
        rowsNeedingDetails.map(async (order) => {
          try {
            const detail = await fetchOrderDetail(order.id)
            return [order.id, numFromValue(detail.total)] as const
          } catch {
            return [order.id, 0] as const
          }
        })
      )

      if (cancelled) return

      setOrderTotalsById(
        detailResults.reduce<Record<number, number>>((acc, [id, total]) => {
          acc[id] = total
          return acc
        }, {})
      )
    })()

    return () => {
      cancelled = true
    }
  }, [orderRows])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const anchorDate = filters.date || todayISO()
      const window = buildWarehouseRangeWindow(warehouseRange, anchorDate)

      try {
        const rows: MovementItem[] = []
        let page = 1
        let hasNext = true

        while (hasNext) {
          const response = await warehouseApi.listMovementsPage({
            page,
            page_size: 200,
            date_from: window.from,
            date_to: window.to,
          })
          rows.push(...response.results)

          if (typeof response.next === "string" && response.next) {
            page += 1
            continue
          }
          if (rows.length < Number(response.count || 0)) {
            page += 1
            continue
          }
          hasNext = false
        }

        if (cancelled) return

        const dashboardRows = rows.filter((row) => !isOrderAutoIssue(row))
        const incomingRows = dashboardRows.filter((row) => !isOutgoingMovement(row.movement_type ?? row.type))
        const outgoingRows = dashboardRows.filter((row) => isOutgoingMovement(row.movement_type ?? row.type))
        const chartSeries = buildWarehouseChartSeries(dashboardRows, warehouseRange, anchorDate, language)

        setWarehouseStats({
          incomingCount: incomingRows.reduce((sum, row) => sum + numFromValue(row.qty), 0),
          outgoingCount: outgoingRows.reduce((sum, row) => sum + numFromValue(row.qty), 0),
          incomingAmount: incomingRows.reduce((sum, row) => sum + numFromValue(row.total), 0),
          outgoingAmount: outgoingRows.reduce((sum, row) => sum + numFromValue(row.total), 0),
          incomingSeries: chartSeries.incomingSeries,
          outgoingSeries: chartSeries.outgoingSeries,
        })
        setWarehouseDetails({
          incoming: incomingRows
            .slice()
            .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
            .map(mapMovementDetailRow),
          outgoing: outgoingRows
            .slice()
            .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
            .map(mapMovementDetailRow),
        })
      } catch {
        if (!cancelled) {
          setWarehouseStats({
            incomingCount: 0,
            outgoingCount: 0,
            incomingAmount: 0,
            outgoingAmount: 0,
            incomingSeries: [],
            outgoingSeries: [],
          })
          setWarehouseDetails({
            incoming: [],
            outgoing: [],
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filters.date, reloadKey, warehouseRange, language])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const chartWindow = getDateWindow("week", filters.date || todayISO())
      const summaryWindow = getDateWindow("month", filters.date || todayISO())

      try {
        const [response, financePayments] = await Promise.all([
          fetchAllPurchasesPages({
            date_from: summaryWindow.from,
            date_to: summaryWindow.to,
            ordering: "-received_date",
          }),
          financeClient.listPostings().catch(() => [] as FinanceEntry[]),
        ])

        if (cancelled) return

        const rows = mergePurchasePayments(response.filter((row) => String(row.status || "").toUpperCase() !== "CANCELLED"), financePayments)
        const amount = rows.reduce((sum, row) => sum + numFromValue(row.total), 0)
        const paidAmount = rows.reduce((sum, row) => sum + numFromValue(row.paid_amount), 0)
        const remainingAmount = rows.reduce((sum, row) => sum + numFromValue(row.remaining_amount), 0)
        const chartRows = rows.filter((row) => isDateInWindow(row.received_date || row.created_at, chartWindow))
        const series = buildDailyPurchaseSeries(chartRows, chartWindow, language)

        setPurchaseStats({
          count: rows.length,
          amount,
          paidAmount,
          remainingAmount,
          totalSeries: series.totalSeries,
          paidSeries: series.paidSeries,
        })
        setPurchaseRows(rows)
      } catch {
        if (!cancelled) {
          setPurchaseStats({
            count: 0,
            amount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            totalSeries: [],
            paidSeries: [],
          })
          setPurchaseRows([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filters.date, reloadKey, language])

  const salesPaid = summary?.salesKpis?.[1]
  const movementStat = summary?.skladKpis?.[1]
  const movementCount = numFromValue(movementStat?.value)

  const customerCount = counts.newCustomers
  const completedOrders = counts.completedOrders
  const activeOrders = counts.activeOrders
  const salesDeltaAmount = salesStats.deltaAmount
  const salesDeltaPercent = salesStats.deltaPercent

  const periodLabel =
    salesRange === "today" ? copy.common.daily : copy.common.oneMonth
  const existingCustomers = Math.max(counts.totalCustomers - counts.newCustomers, 0)

  const analysisSections = [
    {
      key: "new",
      label: copy.customers.newBuyers,
      value: customerCount,
      color: "linear-gradient(90deg,#ffbe6d,#ff972f)",
      rows: customerSections.newCustomers,
    },
    {
      key: "existing",
      label: copy.customers.existingCustomers,
      value: existingCustomers,
      color: "linear-gradient(90deg,#96b4ff,#6c8ef4)",
      rows: customerSections.existingCustomers,
    },
    {
      key: "returning",
      label: copy.customers.returningCustomers,
      value: counts.returningCustomers,
      color: "linear-gradient(90deg,#7bd8b2,#23b26d)",
      rows: customerSections.returningCustomers,
    },
  ]

  const completedOrderRows = orderRows.filter((order) => {
    const status = String(order.status || "").toUpperCase()
    return ["READY", "COMPLETED", "DONE", "CLOSED", "DELIVERED"].includes(status)
  })
  const activeOrderRows = orderRows.filter((order) => {
    const status = String(order.status || "").toUpperCase()
    return ["NEW", "IN_PROGRESS", "CONFIRMED", "ON_DELIVERY"].includes(status)
  })
  const getResolvedOrderTotal = (order: OrderSummary) => {
    const directTotal = numFromValue(order.total)
    if (directTotal > 0) return directTotal
    return numFromValue(orderTotalsById[order.id])
  }
  const salesOrderRows = orderRows
    .filter((order) => String(order.status || "").toUpperCase() !== "CANCELLED")
    .slice()
    .sort((a, b) => String(b.order_date || b.created_at || "").localeCompare(String(a.order_date || a.created_at || "")))
  const resolvedSalesTotal = salesOrderRows.reduce((sum, order) => sum + getResolvedOrderTotal(order), 0)
  const metricTiles = [
    { key: "sales" as const, title: copy.metricTitles.sales, value: formatNumberWithSpaces(resolvedSalesTotal), suffix: copy.common.amountSuffix, icon: <BarChart3 className="h-4 w-4" />, accent: "blue" as const },
    { key: "expenses" as const, title: copy.metricTitles.expenses, value: formatNumberWithSpaces(purchaseStats.amount), suffix: copy.common.amountSuffix, icon: <DollarSign className="h-4 w-4" />, accent: "amber" as const },
    { key: "newCustomers" as const, title: copy.metricTitles.newCustomers, value: formatNumberWithSpaces(customerCount), suffix: copy.common.pieces, icon: <Users className="h-4 w-4" />, accent: "emerald" as const },
    { key: "completedOrders" as const, title: copy.metricTitles.completedOrders, value: formatNumberWithSpaces(completedOrders), suffix: copy.common.pieces, icon: <ShoppingBag className="h-4 w-4" />, accent: "violet" as const },
    { key: "activeOrders" as const, title: copy.metricTitles.activeOrders, value: formatNumberWithSpaces(activeOrders), suffix: copy.common.pieces, icon: <Activity className="h-4 w-4" />, accent: "rose" as const },
  ]

  return (
    <DashboardShell title={copy.pageTitle} subtitle={copy.subtitle}>
      {ui === "loading" ? <div className={`${cardClassName("p-6 text-[#617799]")} motion-enter-side-slow`}>{copy.loading}</div> : null}

      {ui === "error" ? (
        <div className={`${cardClassName("p-6")} motion-enter-side-slow`}>
          <div className="text-lg font-bold text-[#1c2f52]">{copy.error}</div>
          <div className="mt-2 text-sm text-[#617799]">{copy.errorSubtitle}</div>
        </div>
      ) : null}

      {ui === "content" && summary ? (
        <div className={`${dashboardPanelClass()} space-y-5`}>
          <div className="motion-stagger-right-slow grid gap-5 xl:grid-cols-5">
            {metricTiles.map((tile) => (
              <MetricTile
                key={tile.key}
                icon={tile.icon}
                title={tile.title}
                value={tile.value}
                suffix={tile.suffix}
                accent={tile.accent}
                onClick={() => setSelectedMetric(tile.key)}
              />
            ))}
          </div>

          <div className="space-y-5">
            <ScrollReveal delay={80}>
              <SalesCard
                total={`${formatNumberWithSpaces(salesStats.total)} ${copy.common.amountSuffix}`}
                incomeDelta={formatSignedAmountFull(salesDeltaAmount)}
                percentDelta={formatSignedPercent(salesDeltaPercent)}
                series={salesSeries}
                onRefresh={requestRefresh}
                periodLabel={periodLabel}
                range={salesRange}
                onRangeChange={setSalesRange}
                copy={copy}
              />
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <AnalysisCard total={formatNumberWithSpaces(counts.totalCustomers)} sections={analysisSections} copy={copy} language={language} />
            </ScrollReveal>

            <ScrollReveal delay={140}>
              <PurchaseCard
                count={purchaseStats.count}
                amount={purchaseStats.amount}
                paidAmount={purchaseStats.paidAmount}
                remainingAmount={purchaseStats.remainingAmount}
                totalSeries={purchaseStats.totalSeries}
                paidSeries={purchaseStats.paidSeries}
                copy={copy}
              />
            </ScrollReveal>

            <ScrollReveal delay={160}>
              <OrdersCard stats={orderStatusStats} trend={orderTrend} orders={orderRows} copy={copy} language={language} />
            </ScrollReveal>

            <ScrollReveal delay={180}>
              <WarehouseCard
                range={warehouseRange}
                onRangeChange={setWarehouseRange}
                stats={warehouseStats}
                copy={copy}
                language={language}
                details={warehouseDetails}
              />
            </ScrollReveal>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(selectedMetric)} onOpenChange={(open) => !open && setSelectedMetric(null)}>
        <DialogContent className="max-w-[980px]">
          <DialogHeader>
            <DialogTitle className="text-[28px] font-semibold text-[#16325c]">
              {selectedMetric ? metricTiles.find((tile) => tile.key === selectedMetric)?.title : metricModalText.title}
            </DialogTitle>
          </DialogHeader>

          {selectedMetric === "sales" ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">{metricModalText.salesSubtitle}</div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metricModalText.total}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{formatNumberWithSpaces(resolvedSalesTotal)} {copy.common.amountSuffix}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.sales.latestGrowth}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{formatSignedAmountFull(salesStats.deltaAmount)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.sales.latestShare}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{formatSignedPercent(salesStats.deltaPercent)}</div>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">{metricModalText.orderNo}</th>
                      <th className="px-4 py-3 text-left">{copy.orders.client}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.date}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.total}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesOrderRows.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{metricModalText.noRows}</td></tr>
                    ) : (
                      salesOrderRows.map((order) => (
                        <tr key={String(order.id)} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium">{formatOrderNumber(order.order_no, order.id)}</td>
                          <td className="px-4 py-3">{order.client_name || order.client_code || "-"}</td>
                          <td className="px-4 py-3">{formatDashboardDate(order.order_date || order.created_at, language)}</td>
                          <td className="px-4 py-3 font-medium">{formatNumberWithSpaces(getResolvedOrderTotal(order))} {copy.common.amountSuffix}</td>
                          <td className="px-4 py-3">{getOrderStatusLabel(String(order.status || ""), language)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {selectedMetric === "expenses" ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">{metricModalText.expensesSubtitle}</div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.purchase.total}</div><div className="mt-2 text-2xl font-bold text-slate-900">{formatNumberWithSpaces(purchaseStats.amount)} {copy.common.amountSuffix}</div></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.purchase.paid}</div><div className="mt-2 text-2xl font-bold text-slate-900">{formatNumberWithSpaces(purchaseStats.paidAmount)} {copy.common.amountSuffix}</div></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.purchase.remaining}</div><div className="mt-2 text-2xl font-bold text-slate-900">{formatNumberWithSpaces(purchaseStats.remainingAmount)} {copy.common.amountSuffix}</div></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.purchase.acceptedReceipts}</div><div className="mt-2 text-2xl font-bold text-slate-900">{formatNumberWithSpaces(purchaseStats.count)}</div></div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">{metricModalText.purchaseNo}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.supplier}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.date}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.total}</th>
                      <th className="px-4 py-3 text-left">{copy.purchase.paid}</th>
                      <th className="px-4 py-3 text-left">{copy.purchase.remaining}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.note}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseRows.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">{metricModalText.noRows}</td></tr>
                    ) : (
                      purchaseRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium">{row.purchase_no || `#${row.id}`}</td>
                          <td className="px-4 py-3">{row.supplier_name || "-"}</td>
                          <td className="px-4 py-3">{formatDashboardDate(row.received_date || row.created_at, language)}</td>
                          <td className="px-4 py-3 font-medium">{formatNumberWithSpaces(numFromValue(row.total))} {row.currency || copy.common.amountSuffix}</td>
                          <td className="px-4 py-3">{formatNumberWithSpaces(numFromValue(row.paid_amount))} {row.currency || copy.common.amountSuffix}</td>
                          <td className="px-4 py-3">{formatNumberWithSpaces(numFromValue(row.remaining_amount))} {row.currency || copy.common.amountSuffix}</td>
                          <td className="px-4 py-3">{row.notes || row.delivery_company || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {selectedMetric === "newCustomers" ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">{metricModalText.customersSubtitle}</div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">{metricModalText.customerName}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.phone}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.company}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.createdAt}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerSections.newCustomers.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">{metricModalText.noRows}</td></tr>
                    ) : (
                      customerSections.newCustomers.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium">{row.name}</td>
                          <td className="px-4 py-3">{row.phone || "-"}</td>
                          <td className="px-4 py-3">{row.company || "-"}</td>
                          <td className="px-4 py-3">{formatDashboardDate(row.createdAt, language)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {selectedMetric === "completedOrders" || selectedMetric === "activeOrders" ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">
                {selectedMetric === "completedOrders" ? metricModalText.completedSubtitle : metricModalText.activeSubtitle}
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">{metricModalText.orderNo}</th>
                      <th className="px-4 py-3 text-left">{copy.orders.client}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.date}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.total}</th>
                      <th className="px-4 py-3 text-left">{metricModalText.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedMetric === "completedOrders" ? completedOrderRows : activeOrderRows).length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{metricModalText.noRows}</td></tr>
                    ) : (
                      (selectedMetric === "completedOrders" ? completedOrderRows : activeOrderRows).map((order) => (
                        <tr key={String(order.id)} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium">{formatOrderNumber(order.order_no, order.id)}</td>
                          <td className="px-4 py-3">{order.client_name || order.client_code || "-"}</td>
                          <td className="px-4 py-3">{formatDashboardDate(order.order_date || order.created_at, language)}</td>
                          <td className="px-4 py-3">{formatNumberWithSpaces(numFromValue(order.total))} {copy.common.amountSuffix}</td>
                          <td className="px-4 py-3">{getOrderStatusLabel(String(order.status || ""), language)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}

