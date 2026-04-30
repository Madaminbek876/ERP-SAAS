import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  HandCoins,
  PackageCheck,
  Plus,
  RefreshCcw,
  ShoppingBag,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import TablePagination from "@/components/common/TablePagination"
import { useClientPagination } from "@/components/common/useClientPagination"
import { getUserName } from "@/shared/useMe"
import { useI18n } from "@/i18n"
import { isOrderStatus, normalizeOrderStatus, ORDER_STATUS_VALUES } from "@/pages/orders/api/ordersApi"
import {
  buildChartWindow,
  buildFilterWindow,
  getSalesDashboardSnapshot,
  type SalesDashboardChartRange,
  type SalesDashboardFilter,
  type SalesDashboardSnapshot,
  type SalesStageKey,
} from "./api/salesDashboardApi"

type UiState = "loading" | "ready" | "error"

function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
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
  const [visible, setVisible] = useState(false)
  const [node, setNode] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
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
  }, [node])

  return (
    <div
      ref={setNode}
      className={`scroll-reveal-right${visible ? " is-visible" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

const dashboardActionButtonClassName =
  "inline-flex items-center justify-center gap-2 !rounded-2xl !border !border-[#5e7bff] !bg-[linear-gradient(135deg,#4b6bff_0%,#3658df_45%,#2a46b8_100%)] px-4 py-3 !text-sm !font-semibold !text-white !shadow-[0_16px_28px_rgba(70,96,233,0.28)] transition hover:!border-[#7d94ff] hover:!bg-[linear-gradient(135deg,#5a78ff_0%,#4264eb_45%,#314fc6_100%)] hover:!text-white hover:brightness-110"

const dashboardFilterButtonClassName =
  "!rounded-2xl !border px-3.5 py-2 !text-sm !font-semibold transition"

function dashboardFilterTone(active: boolean) {
  return active
    ? "!border-[#6d86ff] !bg-[linear-gradient(135deg,#4f70ff_0%,#3c63ea_50%,#3153cd_100%)] !text-white !shadow-[0_12px_24px_rgba(79,112,255,0.26)]"
    : "!border-[#5874e7] !bg-[linear-gradient(135deg,#3b5ed8_0%,#2f53c8_55%,#2747b0_100%)] !text-white hover:!border-[#7b93ff] hover:!bg-[linear-gradient(135deg,#4a6ae6_0%,#3d61d9_55%,#3155c0_100%)] hover:!text-white"
}

const dashboardTableActionButtonClassName =
  "inline-flex items-center gap-2 !rounded-xl !border !border-[#5e7bff] !bg-[linear-gradient(135deg,#4b6bff_0%,#3658df_45%,#2a46b8_100%)] px-3 py-2 !text-sm !font-semibold !text-white !shadow-[0_10px_20px_rgba(70,96,233,0.24)] transition hover:!border-[#7d94ff] hover:!bg-[linear-gradient(135deg,#5a78ff_0%,#4264eb_45%,#314fc6_100%)] hover:!text-white hover:brightness-110"

function extractApiErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  if (typeof detail === "string" && detail.trim()) return detail

  if (error?.response?.data && typeof error.response.data === "object" && !Array.isArray(error.response.data)) {
    const chunks = Object.entries(error.response.data)
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.map((item) => String(item)).join(", ")}`
        if (value && typeof value === "object") return `${key}: ${JSON.stringify(value)}`
        return `${key}: ${String(value)}`
      })
      .filter(Boolean)

    if (chunks.length > 0) return chunks.join(" | ")
  }

  return String(error?.message || fallback)
}

function formatMoney(value: number, locale: string, currency = "UZS") {
  return `${Math.round(value).toLocaleString(locale)} ${currency}`
}

function formatCompactMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value))
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value)
}

function formatOrderNumber(value?: string | null, fallbackId?: string | number | null) {
  const source = String(value ?? "").trim()
  const digits = source.replace(/\D+/g, "")
  const orderPrefix = "\u2116"

  if (digits) return `${orderPrefix}${Number(digits)}`
  if (fallbackId !== undefined && fallbackId !== null && String(fallbackId).trim()) return `${orderPrefix}${fallbackId}`
  return `${orderPrefix}-`
}

function formatDateLabel(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatDateTimeLabel(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatWindowLabel(dateFrom: string, dateTo: string, locale: string) {
  if (dateFrom === dateTo) return formatDateLabel(dateFrom, locale)
  return `${formatDateLabel(dateFrom, locale)} - ${formatDateLabel(dateTo, locale)}`
}

function buildVisibleAreaSeries<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  let firstPositive = -1
  let lastPositive = -1

  rows.forEach((row, index) => {
    const value = toNumber(row[key], 0)
    if (value > 0) {
      if (firstPositive === -1) firstPositive = index
      lastPositive = index
    }
  })

  return rows.map((row, index) => {
    const value = toNumber(row[key], 0)
    if (firstPositive === -1 || index < firstPositive || index > lastPositive || value <= 0) return null
    return value
  })
}

function normalizeStatus(value: unknown): SalesStageKey {
  const status = normalizeOrderStatus(value)
  return isOrderStatus(status) ? status : "NEW"
}

function normalizePaymentStatus(value: unknown) {
  const status = String(value ?? "").trim().toUpperCase()
  if (status === "PAID") return "PAID"
  if (status === "PARTIAL" || status === "PARTIALLY_PAID") return "PARTIAL"
  return "UNPAID"
}

function statusTone(status: SalesStageKey) {
  if (status === "DELIVERED") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (status === "CANCELLED") return "bg-rose-50 text-rose-700 border-rose-200"
  if (status === "IN_PROGRESS") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

function paymentTone(status: string) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (status === "PARTIAL") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

function stageAccent(status: SalesStageKey) {
  if (status === "DELIVERED") return "from-emerald-500/15 to-emerald-400/0"
  if (status === "CANCELLED") return "from-rose-500/15 to-rose-400/0"
  if (status === "IN_PROGRESS") return "from-amber-500/15 to-amber-400/0"
  return "from-slate-500/15 to-slate-400/0"
}

function TrendTooltip({
  active,
  payload,
  label,
  locale,
  copy,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number }>
  label?: string
  locale: string
  copy: ReturnType<typeof buildCopy>
}) {
  if (!active || !payload || payload.length === 0) return null

  const revenue = toNumber(payload.find((item) => item.dataKey === "revenue")?.value)
  const paid = toNumber(payload.find((item) => item.dataKey === "paid")?.value)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)] backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-500">{copy.revenue}</span>
          <span className="font-semibold text-slate-900">{formatMoney(revenue, locale)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-500">{copy.collected}</span>
          <span className="font-semibold text-slate-900">{formatMoney(paid, locale)}</span>
        </div>
      </div>
    </div>
  )
}

function buildCopy(language: string) {
  if (language === "ru") {
    return {
      liveTag: "Live sales cockpit",
      title: "Панель продаж",
      subtitle:
        "Новый dashboard собран поверх реальных order и profitability endpoint-ов из Swagger, чтобы цифры и оперативная лента были связаны с backend.",
      actionsRefresh: "Обновить",
      actionsOrders: "Все заказы",
      actionsNewOrder: "Новый заказ",
      periodLabel: "Рабочий период",
      chartLabel: "Горизонт графика",
      anchorDate: "Опорная дата",
      today: "Сегодня",
      week: "7 дней",
      month: "30 дней",
      summaryWindow: "Окно KPI",
      trendWindow: "Окно графика",
      swaggerBacked: "Swagger-backed endpoints",
      revenue: "Выручка",
      collected: "Оплачено",
      grossProfit: "Валовая прибыль",
      averageCheck: "Средний чек",
      collectionRate: "Собираемость",
      cogs: "COGS",
      ordersWord: "заказов",
      chartTitle: "Тренд выручки и оплат",
      chartSubtitle: "График строится по реальным заказам и обновляется вместе с выбранным окном.",
      stageTitle: "Статусы заказов",
      stageSubtitle: "Снимок pipeline по текущему периоду KPI.",
      topClientsTitle: "Топ клиенты",
      topClientsSubtitle: "Кто приносит больше всего выручки в выбранном окне.",
      largestOrder: "Крупнейший заказ",
      noClientData: "Нет клиентских данных за выбранный период.",
      healthTitle: "Платежная дисциплина",
      healthSubtitle: "Контроль оплаты без перехода в orders list.",
      outstanding: "Остаток",
      unpaidOrders: "Неоплаченные",
      partialOrders: "Частично оплаченные",
      paidOrders: "Полностью оплаченные",
      recentTitle: "Последние заказы",
      recentSubtitle: "Быстрый доступ к свежим продажам и их payment status.",
      tableOrder: "Заказ",
      tableClient: "Клиент",
      tableStatus: "Статус",
      tablePayment: "Оплата",
      tableTotal: "Сумма",
      tableDate: "Дата",
      tableAction: "Открыть",
      open: "Открыть",
      emptyRecent: "За выбранный период заказы не найдены.",
      loadError: "Не удалось загрузить панель продаж",
      retry: "Повторить",
      profitabilityFallback: "Profitability endpoint сейчас недоступен, поэтому валовая прибыль показана как 0.",
      ready: "Готово",
      stageLabels: {
        NEW: "Новые",
        IN_PROGRESS: "В работе",
        DELIVERED: "Доставленные",
        CANCELLED: "Отмененные",
      },
      paymentLabels: {
        PAID: "Оплачено",
        PARTIAL: "Частично",
        UNPAID: "Не оплачено",
      },
      heroWelcome: "Здравствуйте",
      heroHint: "Окно",
      lastSync: "Последняя синхронизация",
      summaryFoot: "Сумма и сбор денег в одном экране",
      topClientOrders: "заказа",
    }
  }

  if (language === "en") {
    return {
      liveTag: "Live sales cockpit",
      title: "Sales dashboard",
      subtitle:
        "This view now runs on real Swagger-documented order and profitability endpoints, so the layout and the numbers stay tied to backend data.",
      actionsRefresh: "Refresh",
      actionsOrders: "All orders",
      actionsNewOrder: "New order",
      periodLabel: "Work period",
      chartLabel: "Chart horizon",
      anchorDate: "Anchor date",
      today: "Today",
      week: "7 days",
      month: "30 days",
      summaryWindow: "KPI window",
      trendWindow: "Trend window",
      swaggerBacked: "Swagger-backed endpoints",
      revenue: "Revenue",
      collected: "Collected",
      grossProfit: "Gross profit",
      averageCheck: "Average check",
      collectionRate: "Collection rate",
      cogs: "COGS",
      ordersWord: "orders",
      chartTitle: "Revenue and collection trend",
      chartSubtitle: "The chart is aggregated from live orders and updates with the selected horizon.",
      stageTitle: "Order pipeline",
      stageSubtitle: "Current KPI period snapshot across order statuses.",
      topClientsTitle: "Top clients",
      topClientsSubtitle: "Who is generating the most revenue in the selected window.",
      largestOrder: "Largest order",
      noClientData: "No client activity for the selected period.",
      healthTitle: "Payment health",
      healthSubtitle: "Outstanding and payment discipline without opening the full orders page.",
      outstanding: "Outstanding",
      unpaidOrders: "Unpaid",
      partialOrders: "Partial",
      paidOrders: "Paid",
      recentTitle: "Recent orders",
      recentSubtitle: "Fast access to the latest sales records and payment status.",
      tableOrder: "Order",
      tableClient: "Client",
      tableStatus: "Status",
      tablePayment: "Payment",
      tableTotal: "Total",
      tableDate: "Date",
      tableAction: "Open",
      open: "Open",
      emptyRecent: "No orders found for the selected period.",
      loadError: "Failed to load sales dashboard",
      retry: "Retry",
      profitabilityFallback: "The profitability endpoint is currently unavailable, so gross profit is shown as 0.",
      ready: "Ready",
      stageLabels: {
        NEW: "New",
        IN_PROGRESS: "In progress",
        DELIVERED: "Delivered",
        CANCELLED: "Cancelled",
      },
      paymentLabels: {
        PAID: "Paid",
        PARTIAL: "Partial",
        UNPAID: "Unpaid",
      },
      heroWelcome: "Hello",
      heroHint: "Window",
      lastSync: "Last sync",
      summaryFoot: "Revenue and cash collection in one live screen",
      topClientOrders: "orders",
    }
  }

  return {
    liveTag: "Live sales cockpit",
    title: "Sotuv dashboard",
    subtitle:
      "Sahifa endi Swagger'dagi haqiqiy order va profitability endpointlari bilan ishlaydi, ya'ni bu yerda ko'rinayotgan KPI, trend va recent bloklar backend bilan bog'langan.",
    actionsRefresh: "Yangilash",
    actionsOrders: "Barcha orderlar",
    actionsNewOrder: "Yangi order",
    periodLabel: "Ishchi davr",
    chartLabel: "Grafik oralig'i",
    anchorDate: "Asosiy sana",
    today: "Bugun",
    week: "7 kun",
    month: "30 kun",
    summaryWindow: "KPI oynasi",
    trendWindow: "Grafik oynasi",
    swaggerBacked: "Swagger-backed endpointlar",
    revenue: "Tushum",
    collected: "Undirilgan",
    grossProfit: "Yalpi foyda",
    averageCheck: "O'rtacha chek",
    collectionRate: "Undirish darajasi",
    cogs: "COGS",
    ordersWord: "ta order",
    chartTitle: "Tushum va to'lov trendi",
    chartSubtitle: "Grafik real orderlar asosida yig'iladi va tanlangan oraliq bo'yicha yangilanadi.",
    stageTitle: "Order pipeline",
    stageSubtitle: "Joriy KPI davri bo'yicha statuslar kesimi.",
    topClientsTitle: "Top mijozlar",
    topClientsSubtitle: "Tanlangan oynada eng ko'p tushum bergan klientlar.",
    largestOrder: "Eng katta order",
    noClientData: "Tanlangan davrda klient faolligi topilmadi.",
    healthTitle: "To'lov intizomi",
    healthSubtitle: "Orders listga kirmasdan qoldiq va payment holatini ko'rish uchun.",
    outstanding: "Qoldiq",
    unpaidOrders: "To'lanmagan",
    partialOrders: "Qisman to'langan",
    paidOrders: "To'liq to'langan",
    recentTitle: "So'nggi orderlar",
    recentSubtitle: "Oxirgi sotuvlar va ularning payment holatiga tezkor kirish.",
    tableOrder: "Order",
    tableClient: "Mijoz",
    tableStatus: "Status",
    tablePayment: "To'lov",
    tableTotal: "Jami",
    tableDate: "Sana",
    tableAction: "Ochish",
    open: "Ochish",
    emptyRecent: "Tanlangan davr uchun order topilmadi.",
    loadError: "Sotuv dashboardini yuklab bo'lmadi",
    retry: "Qayta urinish",
    profitabilityFallback: "Profitability endpoint hozir javob bermadi, shuning uchun yalpi foyda 0 ko'rsatildi.",
    ready: "Tayyor",
    stageLabels: {
      NEW: "Yangi",
      IN_PROGRESS: "Jarayonda",
      DELIVERED: "Yetkazildi",
      CANCELLED: "Bekor qilingan",
    },
    paymentLabels: {
      PAID: "To'langan",
      PARTIAL: "Qisman",
      UNPAID: "To'lanmagan",
    },
    heroWelcome: "Salom",
    heroHint: "Oyna",
    lastSync: "Oxirgi sinxron",
    summaryFoot: "Tushum va pul yig'imi bitta jonli ekranda",
    topClientOrders: "ta order",
  }
}

function KpiCard({
  title,
  value,
  sub,
  icon,
  accent,
}: {
  title: string
  value: string
  sub: string
  icon: ReactNode
  accent: string
}) {
  return (
    <div
      className={joinClasses(
        "group relative overflow-hidden rounded-[28px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur transition-transform duration-300 hover:-translate-y-0.5",
        accent
      )}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.65)_0%,rgba(255,255,255,0)_100%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
          <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">{value}</div>
          <div className="mt-2 text-sm text-slate-500">{sub}</div>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/90 p-3 text-slate-800 shadow-sm">{icon}</div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-[28px] border border-slate-200 bg-white/80" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="h-[390px] animate-pulse rounded-[28px] border border-slate-200 bg-white/80" />
        <div className="grid gap-5">
          <div className="h-[190px] animate-pulse rounded-[28px] border border-slate-200 bg-white/80" />
          <div className="h-[190px] animate-pulse rounded-[28px] border border-slate-200 bg-white/80" />
        </div>
      </div>
      <div className="h-[360px] animate-pulse rounded-[28px] border border-slate-200 bg-white/80" />
    </div>
  )
}

export default function SotuvDashboardPage() {
  const navigate = useNavigate()
  const { language, locale } = useI18n()
  const copy = useMemo(() => buildCopy(language), [language])
  const userName = getUserName()

  const [filters, setFilters] = useState<SalesDashboardFilter>({
    range: "month",
    date: todayISO(),
  })
  const [chartRange, setChartRange] = useState<SalesDashboardChartRange>("1M")
  const [ui, setUi] = useState<UiState>("loading")
  const [error, setError] = useState("")
  const [data, setData] = useState<SalesDashboardSnapshot | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    setUi("loading")
    setError("")

    void getSalesDashboardSnapshot({
      filters,
      chartRange,
      locale,
    })
      .then((snapshot) => {
        if (cancelled) return
        setData(snapshot)
        setUi("ready")
      })
      .catch((err) => {
        if (cancelled) return
        setError(extractApiErrorMessage(err, copy.loadError))
        setUi("error")
      })

    return () => {
      cancelled = true
    }
  }, [chartRange, copy.loadError, filters.date, filters.range, locale, reloadKey])

  const summaryWindow = useMemo(() => buildFilterWindow(filters.range, filters.date), [filters.date, filters.range])
  const chartWindow = useMemo(() => buildChartWindow(chartRange, filters.date), [chartRange, filters.date])
  const summaryWindowLabel = useMemo(
    () => formatWindowLabel(summaryWindow.date_from, summaryWindow.date_to, locale),
    [locale, summaryWindow.date_from, summaryWindow.date_to]
  )
  const chartWindowLabel = useMemo(
    () => formatWindowLabel(chartWindow.date_from, chartWindow.date_to, locale),
    [chartWindow.date_from, chartWindow.date_to, locale]
  )

  const kpiCards = useMemo(() => {
    if (!data) return []

    return [
      {
        title: copy.revenue,
        value: formatMoney(data.totals.revenue, locale),
        sub: summaryWindowLabel,
        icon: <CircleDollarSign className="h-5 w-5" />,
        accent: "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_42%)]",
      },
      {
        title: copy.collected,
        value: formatMoney(data.totals.paid, locale),
        sub: `${copy.collectionRate}: ${formatPercent(data.totals.collectionRate, locale)}%`,
        icon: <HandCoins className="h-5 w-5" />,
        accent: "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_42%)]",
      },
      {
        title: copy.grossProfit,
        value: formatMoney(data.totals.grossProfit, locale),
        sub: `${copy.cogs}: ${formatMoney(data.totals.cogs, locale)}`,
        icon: <Wallet className="h-5 w-5" />,
        accent: "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_42%)]",
      },
      {
        title: copy.averageCheck,
        value: formatMoney(data.totals.averageCheck, locale),
        sub: `${data.totals.orderCount} ${copy.ordersWord}`,
        icon: <ShoppingBag className="h-5 w-5" />,
        accent: "bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_42%)]",
      },
    ]
  }, [copy.averageCheck, copy.cogs, copy.collectionRate, copy.collected, copy.grossProfit, copy.ordersWord, copy.revenue, data, locale, summaryWindowLabel])

  const orderedStageMetrics = useMemo(() => {
    const source = data?.stageMetrics ?? []
    const map = new Map(source.map((item) => [item.key, item]))
    const order: SalesStageKey[] = [...ORDER_STATUS_VALUES]
    return order.map((key) => map.get(key) ?? { key, count: 0, amount: 0 })
  }, [data?.stageMetrics])

  const paidMix = useMemo(() => {
    if (!data) return []

    return [
      { label: copy.paidOrders, value: data.totals.paidCount },
      { label: copy.partialOrders, value: data.totals.partialCount },
      { label: copy.unpaidOrders, value: data.totals.unpaidCount },
    ]
  }, [copy.paidOrders, copy.partialOrders, copy.unpaidOrders, data])

  const recentOrders = data?.recentOrders ?? []
  const chartData = useMemo(() => {
    if (!data) return []

    const revenueArea = buildVisibleAreaSeries(data.chart, "revenue")
    const paidArea = buildVisibleAreaSeries(data.chart, "paid")

    return data.chart.map((point, index) => ({
      ...point,
      revenueArea: revenueArea[index],
      paidArea: paidArea[index],
    }))
  }, [data])
  const {
    page: recentOrdersPage,
    setPage: setRecentOrdersPage,
    totalPages: recentOrdersTotalPages,
    pagedItems: pagedRecentOrders,
  } = useClientPagination(recentOrders, 6, [recentOrders.length, filters.range, filters.date, chartRange, reloadKey])

  return (
    <div className="min-h-screen rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.06),transparent_30%),radial-gradient(circle_at_top_right,rgba(29,78,216,0.08),transparent_32%),linear-gradient(180deg,#f7f8fc_0%,#eef2f7_100%)] px-4 py-5">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="relative overflow-hidden rounded-[34px] border border-white/15 bg-[linear-gradient(135deg,#2f5bea_0%,#2948c9_52%,#2a3fa7_100%)] px-6 py-6 text-white shadow-[0_36px_120px_-52px_rgba(37,65,168,0.56)]">
          <div className="absolute -left-16 top-0 h-44 w-44 rounded-full bg-white/12 blur-3xl" />
          <div className="absolute right-0 top-10 h-48 w-48 rounded-full bg-sky-200/18 blur-3xl" />
          <div className="absolute bottom-0 right-28 h-32 w-32 rounded-full bg-indigo-200/14 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <BarChart3 className="h-3.5 w-3.5" />
                {copy.liveTag}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-[32px] font-semibold tracking-tight !text-white sm:text-[40px]">
                  {copy.heroWelcome}, {userName || copy.title}
                </h1>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm !text-white">
                  {copy.heroHint}: {summaryWindowLabel}
                </span>
              </div>

              <p className="mt-4 max-w-3xl text-sm leading-6 !text-white/90 sm:text-[15px]">{copy.subtitle}</p>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/80">
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">{copy.swaggerBacked}</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">{copy.summaryFoot}</span>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1">{copy.ready}</span>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className={dashboardActionButtonClassName}
              >
                <RefreshCcw className="h-4 w-4" />
                {copy.actionsRefresh}
              </button>
              <button
                type="button"
                onClick={() => navigate("/sotuv/orders")}
                className={dashboardActionButtonClassName}
              >
                {copy.actionsOrders}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/sotuv/orders/new")}
                className={dashboardActionButtonClassName}
              >
                <Plus className="h-4 w-4" />
                {copy.actionsNewOrder}
              </button>
            </div>
          </div>
        </section>

        <ScrollReveal delay={60}>
          <section className="rounded-[28px] border border-white/80 bg-white/78 p-4 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.3)] backdrop-blur">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] !text-[#5a74a3]">{copy.periodLabel}</div>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "today", label: copy.today },
                  { key: "week", label: copy.week },
                  { key: "month", label: copy.month },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, range: item.key }))}
                    className={joinClasses(
                      dashboardFilterButtonClassName,
                      dashboardFilterTone(filters.range === item.key)
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="text-sm !text-[#5f7294]">
                {copy.summaryWindow}: <span className="font-semibold !text-[#1e2c46]">{summaryWindowLabel}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] !text-[#5a74a3]">{copy.chartLabel}</div>
              <div className="flex flex-wrap gap-2">
                {(["1W", "1M", "3M", "1Y"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setChartRange(item)}
                    className={joinClasses(
                      dashboardFilterButtonClassName,
                      dashboardFilterTone(chartRange === item)
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="text-sm !text-[#5f7294]">
                {copy.trendWindow}: <span className="font-semibold !text-[#1e2c46]">{chartWindowLabel}</span>
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] !text-[#5a74a3]">{copy.anchorDate}</span>
              <div className="inline-flex h-12 items-center gap-3 rounded-2xl !border !border-[#d6e3f7] !bg-[#f8fbff] px-4">
                <CalendarDays className="h-4 w-4 !text-[#5f7294]" />
                <input
                  type="date"
                  value={filters.date}
                  onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
                  className="bg-transparent text-sm font-semibold !text-[#1e2c46] outline-none"
                />
              </div>
            </label>
          </div>
          </section>
        </ScrollReveal>

        {ui === "loading" ? (
          <ScrollReveal delay={80}>
            <DashboardSkeleton />
          </ScrollReveal>
        ) : ui === "error" ? (
          <ScrollReveal delay={80}>
            <section className="rounded-[30px] border border-rose-200 bg-white/85 p-8 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.28)]">
            <div className="text-2xl font-semibold tracking-tight text-slate-950">{copy.loadError}</div>
            <div className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{error}</div>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              <RefreshCcw className="h-4 w-4" />
              {copy.retry}
            </button>
            </section>
          </ScrollReveal>
        ) : data ? (
          <>
            <section className="motion-stagger-right-slow grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((item) => (
                <KpiCard key={item.title} title={item.title} value={item.value} sub={item.sub} icon={item.icon} accent={item.accent} />
              ))}
            </section>

            {!data.profitabilityAvailable ? (
              <ScrollReveal delay={90}>
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
                  {copy.profitabilityFallback}
                </div>
              </ScrollReveal>
            ) : null}

            <ScrollReveal delay={110}>
              <section className="grid items-stretch gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div className="flex h-full flex-col overflow-hidden rounded-[30px] border border-[#294d9b] bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.08),transparent_22%),linear-gradient(180deg,#18367f_0%,#17357c_32%,#16316f_100%)] p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.42)] backdrop-blur">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8c8ea]">
                      <Activity className="h-3.5 w-3.5" />
                      {copy.chartTitle}
                    </div>
                    <div className="mt-2 text-sm text-[#d9e5ff]/78">{copy.chartSubtitle}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#d9e5ff]/80">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#5f8fff]" />
                      {copy.revenue}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#33d6c2]" />
                      {copy.collected}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,47,116,0.94)_0%,rgba(22,53,124,0.88)_55%,rgba(28,64,144,0.82)_100%)] px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="h-full min-h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="salesRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.38} />
                          <stop offset="68%" stopColor="#2563eb" stopOpacity={0.14} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="salesPaidFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
                          <stop offset="68%" stopColor="#0f766e" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="rgba(191,214,255,0.18)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "rgba(226,238,255,0.82)", fontSize: 12 }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "rgba(226,238,255,0.78)", fontSize: 12 }}
                        tickFormatter={(value: number) => formatCompactMoney(value, locale)}
                      />
                      <Tooltip content={<TrendTooltip locale={locale} copy={copy} />} />
                      <Area
                        type="monotone"
                        dataKey="paidArea"
                        stroke="none"
                        fill="url(#salesPaidFill)"
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenueArea"
                        stroke="none"
                        fill="url(#salesRevenueFill)"
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#5f8fff"
                        strokeWidth={3}
                        fill="transparent"
                        activeDot={{ r: 5, strokeWidth: 0, fill: "#5f8fff" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="paid"
                        stroke="#33d6c2"
                        strokeWidth={3}
                        fill="transparent"
                        activeDot={{ r: 5, strokeWidth: 0, fill: "#33d6c2" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.06)_100%)] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8c8ea]">{copy.collectionRate}</div>
                    <div className="mt-2 text-xl font-semibold tracking-tight text-white">
                      {formatPercent(data.totals.collectionRate, locale)}%
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.06)_100%)] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8c8ea]">{copy.outstanding}</div>
                    <div className="mt-2 text-xl font-semibold tracking-tight text-white">
                      {formatMoney(data.totals.remaining, locale)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.06)_100%)] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8c8ea]">{copy.lastSync}</div>
                    <div className="mt-2 text-xl font-semibold tracking-tight text-white">
                      {formatDateTimeLabel(data.generatedAt, locale)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <PackageCheck className="h-3.5 w-3.5" />
                    {copy.stageTitle}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{copy.stageSubtitle}</div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {orderedStageMetrics.map((item) => (
                      <div
                        key={item.key}
                        className={joinClasses(
                          "rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.98)_100%)] p-4",
                          "bg-[radial-gradient(circle_at_top_left,var(--tw-gradient-stops))]",
                          stageAccent(item.key)
                        )}
                      >
                        <div className={joinClasses("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", statusTone(item.key))}>
                          {copy.stageLabels[item.key]}
                        </div>
                        <div className="mt-4 text-[26px] font-semibold tracking-tight text-slate-950">{item.count}</div>
                        <div className="mt-1 text-sm text-slate-500">{formatMoney(item.amount, locale)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <UserRound className="h-3.5 w-3.5" />
                    {copy.topClientsTitle}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{copy.topClientsSubtitle}</div>

                  <div className="mt-4 space-y-3">
                    {data.topClients.length > 0 ? (
                      data.topClients.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900">{item.name}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.orderCount} {copy.topClientOrders}
                              </div>
                            </div>
                            <div className="text-right text-sm font-semibold text-slate-900">{formatMoney(item.totalRevenue, locale)}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                        {copy.noClientData}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef5ff_100%)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.largestOrder}</div>
                    {data.largestOrder ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-slate-950">{formatOrderNumber(data.largestOrder.order_no, data.largestOrder.id)}</div>
                          <div className="mt-1 text-sm text-slate-500">{data.largestOrder.client_name || "-"}</div>
                        </div>
                        <div className="text-right text-base font-semibold text-slate-950">
                          {formatMoney(data.largestOrder.total, locale, data.largestOrder.currency || "UZS")}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-500">{copy.emptyRecent}</div>
                    )}
                  </div>
                </div>
              </div>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={140}>
              <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
              <div className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <HandCoins className="h-3.5 w-3.5" />
                  {copy.healthTitle}
                </div>
                <div className="mt-2 text-sm text-slate-500">{copy.healthSubtitle}</div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.collectionRate}</div>
                      <div className="mt-2 text-[30px] font-semibold tracking-tight text-slate-950">
                        {formatPercent(data.totals.collectionRate, locale)}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm">
                      {formatMoney(data.totals.paid, locale)}
                    </div>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e_0%,#10b981_100%)]"
                      style={{ width: `${Math.max(0, Math.min(100, data.totals.collectionRate))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {paidMix.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Truck className="h-3.5 w-3.5" />
                  {copy.recentTitle}
                </div>
                <div className="mt-2 text-sm text-slate-500">{copy.recentSubtitle}</div>

                <div className="mt-4 space-y-3">
                  {data.recentOrders.length > 0 ? (
                    data.recentOrders.slice(0, 3).map((row) => {
                      const paymentStatus = normalizePaymentStatus(row.payment_status)
                      const percent = toNumber(row.total) > 0 ? (toNumber(row.paid_amount) / toNumber(row.total)) * 100 : 0

                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => navigate(`/sotuv/orders/${row.id}`)}
                          className="w-full rounded-2xl border border-[#2c67b7] bg-[linear-gradient(135deg,#17498f_0%,#1d4f96_100%)] p-4 text-left transition hover:border-[#3b82f6] hover:brightness-110"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold !text-white">{formatOrderNumber(row.order_no, row.id)}</div>
                              <div className="mt-1 truncate text-sm !text-white/70">{row.client_name || "-"}</div>
                            </div>
                            <span className={joinClasses("rounded-full border px-2.5 py-1 text-[11px] font-semibold", paymentTone(paymentStatus))}>
                              {copy.paymentLabels[paymentStatus]}
                            </span>
                          </div>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#0f766e_100%)]"
                              style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                            />
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold !text-white">{formatMoney(row.total, locale, row.currency || "UZS")}</span>
                            <span className="!text-white/55">{formatDateLabel(row.order_date, locale)}</span>
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
                      {copy.emptyRecent}
                    </div>
                  )}
                </div>
              </div>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={170}>
              <section className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
              <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {copy.recentTitle}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{copy.recentSubtitle}</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/sotuv/orders")}
                  className={dashboardActionButtonClassName}
                >
                  {copy.actionsOrders}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[980px] w-full text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-3 py-3 font-semibold">{copy.tableOrder}</th>
                      <th className="px-3 py-3 font-semibold">{copy.tableClient}</th>
                      <th className="px-3 py-3 font-semibold">{copy.tableStatus}</th>
                      <th className="px-3 py-3 font-semibold">{copy.tablePayment}</th>
                      <th className="px-3 py-3 font-semibold">{copy.tableTotal}</th>
                      <th className="px-3 py-3 font-semibold">{copy.tableDate}</th>
                      <th className="px-3 py-3 font-semibold text-right">{copy.tableAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {recentOrders.length > 0 ? (
                      pagedRecentOrders.map((row) => {
                        const status = normalizeStatus(row.status)
                        const paymentStatus = normalizePaymentStatus(row.payment_status)
                        const progress = toNumber(row.total) > 0 ? (toNumber(row.paid_amount) / toNumber(row.total)) * 100 : 0

                        return (
                          <tr key={row.id} className="transition hover:bg-slate-50/80">
                            <td className="px-3 py-4">
                              <div className="font-semibold text-slate-950">{formatOrderNumber(row.order_no, row.id)}</div>
                              <div className="mt-1 text-xs text-slate-500">{"\u2116"}{row.id}</div>
                            </td>
                            <td className="px-3 py-4 text-sm text-slate-700">{row.client_name || "-"}</td>
                            <td className="px-3 py-4">
                              <span className={joinClasses("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", statusTone(status))}>
                                {copy.stageLabels[status]}
                              </span>
                            </td>
                            <td className="px-3 py-4">
                              <div className="max-w-[220px]">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className={joinClasses("rounded-full border px-2.5 py-1 font-semibold", paymentTone(paymentStatus))}>
                                    {copy.paymentLabels[paymentStatus]}
                                  </span>
                                  <span className="font-medium text-slate-500">{formatPercent(progress, locale)}%</span>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#0f766e_100%)]"
                                    style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-4 text-sm font-semibold text-slate-950">
                              {formatMoney(row.total, locale, row.currency || "UZS")}
                            </td>
                            <td className="px-3 py-4 text-sm text-slate-500">{formatDateLabel(row.order_date, locale)}</td>
                            <td className="px-3 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => navigate(`/sotuv/orders/${row.id}`)}
                                className={dashboardTableActionButtonClassName}
                              >
                                {copy.open}
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-14 text-center text-sm text-slate-500">
                          {copy.emptyRecent}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {recentOrders.length > 0 ? (
                <div className="mt-4 flex justify-end">
                  <TablePagination page={recentOrdersPage} totalPages={recentOrdersTotalPages} onPageChange={setRecentOrdersPage} size="sm" />
                </div>
              ) : null}
              </section>
            </ScrollReveal>
          </>
        ) : null}
      </div>
    </div>
  )
}




