import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Boxes,
  Building2,
  CalendarDays,
  Package2,
  PackageOpen,
  RefreshCcw,
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

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import TablePagination from "@/components/common/TablePagination"
import { useClientPagination } from "@/components/common/useClientPagination"
import { useI18n } from "@/i18n"
import { warehouseEvents } from "@/pages/sklad/warehouse/api/events"
import { getUserName } from "@/shared/useMe"
import {
  buildChartWindow,
  buildFilterWindow,
  getWarehouseDashboardSnapshot,
  type WarehouseDashboardChartRange,
  type WarehouseDashboardFilter,
  type WarehouseDashboardSnapshot,
  type WarehouseMovementStageKey,
} from "./api/warehouseDashboardApi"

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

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(Math.round(value))
}

function formatDateLabel(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(date)
}

function formatDateTimeLabel(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatWindowLabel(dateFrom: string, dateTo: string, locale: string) {
  if (dateFrom === dateTo) return formatDateLabel(dateFrom, locale)
  return `${formatDateLabel(dateFrom, locale)} - ${formatDateLabel(dateTo, locale)}`
}

function movementTone(value: WarehouseMovementStageKey) {
  if (value === "IN") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "OUT") return "bg-blue-50 text-blue-700 border-blue-200"
  if (value === "TRANSFER") return "bg-cyan-50 text-cyan-700 border-cyan-200"
  if (value === "RETURN") return "bg-violet-50 text-violet-700 border-violet-200"
  if (value === "WASTE") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

function itemTypeLabel(value: string, copy: ReturnType<typeof buildCopy>) {
  if (value === "FINISHED_PRODUCT") return copy.itemTypeLabels.FINISHED_PRODUCT
  return copy.itemTypeLabels.RAW_MATERIAL
}

function MovementTooltip({
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

  const incoming = toNumber(payload.find((item) => item.dataKey === "incoming")?.value)
  const outgoing = toNumber(payload.find((item) => item.dataKey === "outgoing")?.value)
  const movements = toNumber(payload.find((item) => item.dataKey === "movements")?.value)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)] backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-500">{copy.incomingQty}</span>
          <span className="font-semibold text-slate-900">{formatCount(incoming, locale)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-500">{copy.outgoingQty}</span>
          <span className="font-semibold text-slate-900">{formatCount(outgoing, locale)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-500">{copy.movementCount}</span>
          <span className="font-semibold text-slate-900">{formatCount(movements, locale)}</span>
        </div>
      </div>
    </div>
  )
}

function buildCopy(language: string) {
  if (language === "ru") {
    return {
      liveTag: "Живая панель склада",
      title: "Складской дашборд",
      subtitle:
        "Экран работает на основе складских endpoint-ов, описанных в Swagger, поэтому KPI, движения и остатки в карточках связаны с реальными данными backend.",
      actionsRefresh: "Обновить",
      actionsMovements: "Движения",
      actionsStock: "Остатки",
      periodLabel: "Рабочий период",
      chartLabel: "Горизонт графика",
      anchorDate: "Опорная дата",
      today: "Сегодня",
      week: "7 дней",
      month: "30 дней",
      summaryWindow: "Окно KPI",
      trendWindow: "Окно графика",
      swaggerBacked: "Endpoint-ы, описанные в Swagger",
      heroWelcome: "Здравствуйте",
      heroHint: "Окно",
      lastSync: "Последняя синхронизация",
      ready: "Готово",
      summaryFoot: "Складской поток, остатки и риски на одном живом экране",
      stockValue: "Стоимость остатка",
      stockQty: "Текущий остаток",
      incomingQty: "Поступление",
      lowStock: "Низкий остаток",
      outgoingQty: "Расход",
      netFlow: "Чистый поток",
      movementCount: "Количество движений",
      inboundValue: "Стоимость поступлений",
      outboundValue: "Стоимость расхода",
      chartTitle: "Тренд движения склада",
      chartSubtitle: "График показывает фактический входящий и исходящий поток.",
      movementMixTitle: "Срез движений",
      movementMixSubtitle: "Типы операций за выбранное KPI-окно.",
      healthTitle: "Операционное здоровье",
      healthSubtitle: "Баланс поступлений, расходов и общего темпа движения.",
      stockLeadersTitle: "Крупнейшие позиции",
      stockLeadersSubtitle: "Товары и материалы с максимальной стоимостью остатка.",
      lowStockTitle: "Риск по остаткам",
      lowStockSubtitle: "Сначала показываются нулевые остатки, затем самые низкие.",
      locationsTitle: "Сильнейшие склады",
      locationsSubtitle: "Локации с наибольшей текущей стоимостью хранения.",
      recentTitle: "Последние движения",
      recentSubtitle: "Оперативная лента по складу.",
      tableDate: "Дата",
      tableItem: "Позиция",
      tableMovement: "Движение",
      tableLocation: "Локация",
      tableQty: "Кол-во",
      tableTotal: "Сумма",
      tableAction: "Открыть",
      open: "Открыть",
      emptyRecent: "За выбранный период движения не найдены.",
      emptyStock: "Нет данных по остаткам.",
      emptyLocations: "Нет данных по складам.",
      loadError: "Не удалось загрузить складской дашборд",
      retry: "Повторить",
      units: "ед.",
      skuUnits: "SKU",
      riskUnits: "позиции",
      movementLabels: {
        IN: "Приход",
        OUT: "Расход",
        RETURN: "Возврат",
        WASTE: "Списание",
        ADJUST: "Корректировка",
      },
      itemTypeLabels: {
        RAW_MATERIAL: "Сырье",
        FINISHED_PRODUCT: "Готовая продукция",
      },
      zeroBalance: "нулевой остаток",
      lowBalance: "минимальный остаток",
      warehouseSuffix: "позиций",
    }
  }

  if (language === "en") {
    return {
      liveTag: "Live warehouse cockpit",
      title: "Warehouse dashboard",
      subtitle:
        "This view is driven by Swagger-documented warehouse endpoints, so the KPIs, movement stream and stock blocks stay attached to backend data.",
      actionsRefresh: "Refresh",
      actionsMovements: "Movements",
      actionsStock: "Stock",
      periodLabel: "Work period",
      chartLabel: "Chart horizon",
      anchorDate: "Anchor date",
      today: "Today",
      week: "7 days",
      month: "30 days",
      summaryWindow: "KPI window",
      trendWindow: "Trend window",
      swaggerBacked: "Swagger-backed endpoints",
      heroWelcome: "Hello",
      heroHint: "Window",
      lastSync: "Last sync",
      ready: "Ready",
      summaryFoot: "Warehouse flow, stock and risk in one live screen",
      stockValue: "Stock value",
      stockQty: "On-hand quantity",
      incomingQty: "Incoming",
      lowStock: "Low stock",
      outgoingQty: "Outgoing",
      netFlow: "Net flow",
      movementCount: "Movements",
      inboundValue: "Inbound value",
      outboundValue: "Outbound value",
      chartTitle: "Warehouse movement trend",
      chartSubtitle: "The chart shows live inbound versus outbound flow.",
      movementMixTitle: "Movement mix",
      movementMixSubtitle: "Operation types for the selected KPI window.",
      healthTitle: "Operational health",
      healthSubtitle: "Balance between incoming, outgoing and overall warehouse tempo.",
      stockLeadersTitle: "Highest value items",
      stockLeadersSubtitle: "Products and materials with the largest on-hand value.",
      lowStockTitle: "Stock risk radar",
      lowStockSubtitle: "Zero balance items are shown first, then the lowest balances.",
      locationsTitle: "Top warehouse locations",
      locationsSubtitle: "Locations with the strongest current storage value.",
      recentTitle: "Recent movements",
      recentSubtitle: "Fast operational movement feed.",
      tableDate: "Date",
      tableItem: "Item",
      tableMovement: "Movement",
      tableLocation: "Location",
      tableQty: "Qty",
      tableTotal: "Total",
      tableAction: "Open",
      open: "Open",
      emptyRecent: "No movements found for the selected period.",
      emptyStock: "No stock data available.",
      emptyLocations: "No warehouse data available.",
      loadError: "Failed to load warehouse dashboard",
      retry: "Retry",
      units: "units",
      skuUnits: "SKU",
      riskUnits: "items",
      movementLabels: {
        IN: "Inbound",
        OUT: "Outbound",
        RETURN: "Return",
        WASTE: "Waste",
        ADJUST: "Adjust",
      },
      itemTypeLabels: {
        RAW_MATERIAL: "Raw material",
        FINISHED_PRODUCT: "Finished product",
      },
      zeroBalance: "zero balance",
      lowBalance: "lowest balance",
      warehouseSuffix: "items",
    }
  }

  return {
    liveTag: "Jonli ombor paneli",
    title: "Ombor paneli",
    subtitle:
      "Sahifa Swagger'dagi ombor endpointlari bilan ishlaydi, ya'ni KPI, harakatlar va qoldiq bloklari real tizim ma'lumotiga ulangan.",
    actionsRefresh: "Yangilash",
    actionsMovements: "Harakatlar",
    actionsStock: "Qoldiqlar",
    periodLabel: "Ishchi davr",
    chartLabel: "Grafik oralig'i",
    anchorDate: "Asosiy sana",
    today: "Bugun",
    week: "7 kun",
    month: "30 kun",
    summaryWindow: "KPI oynasi",
    trendWindow: "Grafik oynasi",
    swaggerBacked: "Swagger bilan hujjatlashtirilgan endpointlar",
    heroWelcome: "Salom",
    heroHint: "Oyna",
    lastSync: "Oxirgi sinxron",
    ready: "Tayyor",
    summaryFoot: "Ombor oqimi, qoldiq va risklar bitta jonli ekranda",
    stockValue: "Qoldiq qiymati",
    stockQty: "Joriy qoldiq",
    incomingQty: "Kirim",
    lowStock: "Kam qolganlar",
    outgoingQty: "Chiqim",
    netFlow: "Sof oqim",
    movementCount: "Harakatlar soni",
    inboundValue: "Kirim qiymati",
    outboundValue: "Chiqim qiymati",
    chartTitle: "Ombor harakatlari trendi",
    chartSubtitle: "Grafik real kirim-chiqim oqimini ko'rsatadi.",
    movementMixTitle: "Harakatlar kesimi",
    movementMixSubtitle: "Tanlangan KPI oynasi bo'yicha operatsiyalar turlari.",
    healthTitle: "Operatsion holat",
    healthSubtitle: "Kirim, chiqim va umumiy ombor tempi o'rtasidagi balans.",
    stockLeadersTitle: "Eng katta qoldiq pozitsiyalari",
    stockLeadersSubtitle: "Qoldiq qiymati eng yuqori bo'lgan mahsulot va materiallar.",
    lowStockTitle: "Qoldiq riski",
    lowStockSubtitle: "Avval nol qolganlar, keyin eng past balansdagilar ko'rsatiladi.",
    locationsTitle: "Kuchli omborlar",
    locationsSubtitle: "Joriy saqlash qiymati eng katta joylar.",
    recentTitle: "So'nggi harakatlar",
    recentSubtitle: "Harakatlar jurnalidan olingan tezkor operatsion lenta.",
    tableDate: "Sana",
    tableItem: "Pozitsiya",
    tableMovement: "Harakat",
    tableLocation: "Joylashuv",
    tableQty: "Miqdor",
    tableTotal: "Jami",
    tableAction: "Ochish",
    open: "Ochish",
    emptyRecent: "Tanlangan davr uchun harakatlar topilmadi.",
    emptyStock: "Qoldiq bo'yicha ma'lumot topilmadi.",
    emptyLocations: "Omborlar bo'yicha ma'lumot topilmadi.",
    loadError: "Ombor panelini yuklab bo'lmadi",
    retry: "Qayta urinish",
    units: "dona",
    skuUnits: "SKU",
    riskUnits: "pozitsiya",
    movementLabels: {
      IN: "Kirim",
      OUT: "Chiqim",
      RETURN: "Qaytarish",
      WASTE: "Hisobdan chiqarish",
      ADJUST: "Tuzatish",
    },
    itemTypeLabels: {
      RAW_MATERIAL: "Xomashyo",
      FINISHED_PRODUCT: "Tayyor mahsulot",
    },
    zeroBalance: "nol qoldiq",
    lowBalance: "eng past qoldiq",
    warehouseSuffix: "pozitsiya",
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
        "lux-motion-surface group relative overflow-hidden rounded-[28px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur transition-transform duration-300 hover:-translate-y-0.5",
        accent
      )}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.68)_0%,rgba(255,255,255,0)_100%)]" />
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
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-[250px] animate-pulse rounded-[28px] border border-slate-200 bg-white/80" />
        ))}
      </div>
      <div className="h-[360px] animate-pulse rounded-[28px] border border-slate-200 bg-white/80" />
    </div>
  )
}

export default function SkladDashboardPage() {
  const navigate = useNavigate()
  const { language, locale } = useI18n()
  const copy = useMemo(() => buildCopy(language), [language])
  const movementLabels = useMemo<Record<WarehouseMovementStageKey, string>>(
    () => ({
      IN: copy.movementLabels.IN,
      OUT: copy.movementLabels.OUT,
      TRANSFER: language === "ru" ? "РџРµСЂРµРјРµС‰РµРЅРёРµ" : language === "en" ? "Transfer" : "Ko'chirish",
      RETURN: copy.movementLabels.RETURN,
      WASTE: copy.movementLabels.WASTE,
      ADJUST: copy.movementLabels.ADJUST,
    }),
    [copy.movementLabels, language]
  )
  const userName = getUserName()

  const [filters, setFilters] = useState<WarehouseDashboardFilter>({
    range: "month",
    date: todayISO(),
  })
  const [chartRange, setChartRange] = useState<WarehouseDashboardChartRange>("1M")
  const [ui, setUi] = useState<UiState>("loading")
  const [error, setError] = useState("")
  const [data, setData] = useState<WarehouseDashboardSnapshot | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    setUi("loading")
    setError("")

    void getWarehouseDashboardSnapshot({
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

  useEffect(() => {
    const unsubscribe = warehouseEvents.subscribe(() => {
      setReloadKey((value) => value + 1)
    })
    return () => unsubscribe()
  }, [])

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
        title: copy.stockValue,
        value: formatMoney(data.totals.stockValue, locale),
        sub: summaryWindowLabel,
        icon: <Wallet className="h-5 w-5" />,
        accent: "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_42%)]",
      },
      {
        title: copy.stockQty,
        value: `${formatCount(data.totals.stockQty, locale)} ${copy.units}`,
        sub: `${formatCount(data.totals.skuCount, locale)} ${copy.skuUnits}`,
        icon: <Boxes className="h-5 w-5" />,
        accent: "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_42%)]",
      },
      {
        title: copy.incomingQty,
        value: `${formatCount(data.totals.incomingQty, locale)} ${copy.units}`,
        sub: `${copy.inboundValue}: ${formatMoney(data.totals.inboundValue, locale)}`,
        icon: <ArrowDownToLine className="h-5 w-5" />,
        accent: "bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_42%)]",
      },
      {
        title: copy.lowStock,
        value: `${formatCount(data.totals.lowStockCount, locale)} ${copy.riskUnits}`,
        sub: `${copy.netFlow}: ${formatCount(data.totals.netFlow, locale)} ${copy.units}`,
        icon: <AlertTriangle className="h-5 w-5" />,
        accent: "bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.16),transparent_42%)]",
      },
    ]
  }, [
    copy.inboundValue,
    copy.incomingQty,
    copy.lowStock,
    copy.netFlow,
    copy.riskUnits,
    copy.skuUnits,
    copy.stockQty,
    copy.stockValue,
    copy.units,
    data,
    locale,
    summaryWindowLabel,
  ])

  const recentMovements = data?.recentMovements ?? []
  const {
    page: recentMovementsPage,
    setPage: setRecentMovementsPage,
    totalPages: recentMovementsTotalPages,
    pagedItems: pagedRecentMovements,
  } = useClientPagination(recentMovements, 6, [recentMovements.length, filters.range, filters.date, chartRange, reloadKey])

  const orderedMovementMetrics = useMemo(() => {
    const source = data?.movementMetrics ?? []
    const map = new Map(source.map((item) => [item.key, item]))
    const order: WarehouseMovementStageKey[] = ["IN", "OUT", "TRANSFER", "RETURN", "WASTE", "ADJUST"]
    return order.map((key) => map.get(key) ?? { key, count: 0, qty: 0, value: 0 })
  }, [data?.movementMetrics])

  return (
    <div className="min-h-screen rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_30%),linear-gradient(180deg,#f7fbfd_0%,#edf3f8_100%)] px-4 py-5">
      <div className="motion-stagger mx-auto max-w-[1500px] space-y-5">
        <section className="relative overflow-hidden rounded-[34px] border border-white/15 bg-[linear-gradient(135deg,#2f5bea_0%,#2948c9_52%,#2a3fa7_100%)] px-6 py-6 text-white shadow-[0_36px_120px_-52px_rgba(37,65,168,0.56)]">
          <div className="absolute -left-16 top-0 h-44 w-44 rounded-full bg-white/12 blur-3xl" />
          <div className="absolute right-0 top-10 h-48 w-48 rounded-full bg-sky-200/18 blur-3xl" />
          <div className="absolute bottom-0 right-28 h-32 w-32 rounded-full bg-indigo-200/14 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <Building2 className="h-3.5 w-3.5" />
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
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">/dashboard/warehouse</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">/warehouse/overview</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">/warehouse/ledger</span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1">/warehouse/stock</span>
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
                onClick={() => navigate("/dashboard/sklad/warehouse/movements")}
                className={dashboardActionButtonClassName}
              >
                {copy.actionsMovements}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/dashboard/sklad/warehouse/balances-products")}
                className={dashboardActionButtonClassName}
              >
                <PackageOpen className="h-4 w-4" />
                {copy.actionsStock}
              </button>
            </div>
          </div>
        </section>

        <ScrollReveal delay={60}>
          <section className="lux-motion-surface rounded-[28px] border border-white/80 bg-white/78 p-4 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.3)] backdrop-blur">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.periodLabel}</div>
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
              <div className="text-sm text-slate-500">
                {copy.summaryWindow}: <span className="font-medium text-slate-900">{summaryWindowLabel}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.chartLabel}</div>
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
              <div className="text-sm text-slate-500">
                {copy.trendWindow}: <span className="font-medium text-slate-900">{chartWindowLabel}</span>
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.anchorDate}</span>
              <div className="inline-flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <input
                  type="date"
                  value={filters.date}
                  onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
                  className="bg-transparent text-sm font-medium text-slate-900 outline-none"
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

            <ScrollReveal delay={110}>
              <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div className="lux-motion-surface rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Activity className="h-3.5 w-3.5" />
                      {copy.chartTitle}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{copy.chartSubtitle}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0f766e]" />
                      {copy.incomingQty}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
                      {copy.outgoingQty}
                    </span>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
                      {copy.lastSync}: {formatDateTimeLabel(data.generatedAt, locale)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.chart}>
                      <defs>
                        <linearGradient id="warehouseIncoming" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.38} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="warehouseOutgoing" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.34} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 6" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} width={54} />
                      <Tooltip content={<MovementTooltip locale={locale} copy={copy} />} />
                      <Area
                        type="monotone"
                        dataKey="incoming"
                        stroke="#0f766e"
                        strokeWidth={2.5}
                        fill="url(#warehouseIncoming)"
                        name={copy.incomingQty}
                      />
                      <Area
                        type="monotone"
                        dataKey="outgoing"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill="url(#warehouseOutgoing)"
                        name={copy.outgoingQty}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-5">
                <section className="lux-motion-surface rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Package2 className="h-3.5 w-3.5" />
                    {copy.movementMixTitle}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{copy.movementMixSubtitle}</div>

                  <div className="mt-5 space-y-3">
                    {orderedMovementMetrics.map((item) => (
                      <div key={item.key} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className={joinClasses("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", movementTone(item.key))}>
                            {movementLabels[item.key]}
                          </span>
                          <span className="text-xs text-slate-500">{formatCount(item.count, locale)}</span>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-4">
                          <div className="text-lg font-semibold tracking-tight text-slate-950">
                            {formatCount(item.qty, locale)} {copy.units}
                          </div>
                          <div className="text-sm text-slate-500">{formatMoney(item.value, locale)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                    {copy.healthTitle}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{copy.healthSubtitle}</div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.outgoingQty}</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                        {formatCount(data.totals.outgoingQty, locale)} {copy.units}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.netFlow}</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                        {formatCount(data.totals.netFlow, locale)} {copy.units}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.inboundValue}</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                        {formatMoney(data.totals.inboundValue, locale)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.movementCount}</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                        {formatCount(data.totals.movementCount, locale)}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={140}>
              <section className="grid gap-5 xl:grid-cols-3">
              <div className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Wallet className="h-3.5 w-3.5" />
                  {copy.stockLeadersTitle}
                </div>
                <div className="mt-2 text-sm text-slate-500">{copy.stockLeadersSubtitle}</div>

                <div className="mt-5 space-y-3">
                  {data.stockLeaders.length ? (
                    data.stockLeaders.map((item, index) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-950">{item.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {itemTypeLabel(item.itemType, copy)} · {item.locationName}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-slate-400">#{index + 1}</div>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-4">
                          <div className="text-lg font-semibold tracking-tight text-slate-950">
                            {formatCount(item.qty, locale)} {copy.units}
                          </div>
                          <div className="text-sm text-slate-500">{formatMoney(item.value, locale)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                      {copy.emptyStock}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {copy.lowStockTitle}
                </div>
                <div className="mt-2 text-sm text-slate-500">{copy.lowStockSubtitle}</div>

                <div className="mt-5 space-y-3">
                  {data.lowStockItems.length ? (
                    data.lowStockItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-950">{item.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {itemTypeLabel(item.itemType, copy)} · {item.locationName}
                            </div>
                          </div>
                          <span
                            className={joinClasses(
                              "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              item.qty <= 0
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            )}
                          >
                            {item.qty <= 0 ? copy.zeroBalance : copy.lowBalance}
                          </span>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-4">
                          <div className="text-lg font-semibold tracking-tight text-slate-950">
                            {formatCount(item.qty, locale)} {copy.units}
                          </div>
                          <div className="text-sm text-slate-500">{formatMoney(item.value, locale)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                      {copy.emptyStock}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Building2 className="h-3.5 w-3.5" />
                  {copy.locationsTitle}
                </div>
                <div className="mt-2 text-sm text-slate-500">{copy.locationsSubtitle}</div>

                <div className="mt-5 space-y-3">
                  {data.locationInsights.length ? (
                    data.locationInsights.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-950">{item.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatCount(item.itemCount, locale)} {copy.warehouseSuffix}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-slate-400">#{index + 1}</div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-sm text-slate-600">
                            {copy.stockQty}: <span className="font-semibold text-slate-950">{formatCount(item.qty, locale)} {copy.units}</span>
                          </div>
                          <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-sm text-slate-600">
                            {copy.stockValue}: <span className="font-semibold text-slate-950">{formatMoney(item.value, locale)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                      {copy.emptyLocations}
                    </div>
                  )}
                </div>
              </div>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={170}>
              <section className="rounded-[30px] border border-white/80 bg-white/82 p-5 shadow-[0_24px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur">
              <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Activity className="h-3.5 w-3.5" />
                    {copy.recentTitle}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{copy.recentSubtitle}</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/sklad/warehouse/movements")}
                  className={dashboardActionButtonClassName}
                >
                  {copy.actionsMovements}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                      <TableHead>{copy.tableDate}</TableHead>
                      <TableHead>{copy.tableItem}</TableHead>
                      <TableHead>{copy.tableMovement}</TableHead>
                      <TableHead>{copy.tableLocation}</TableHead>
                      <TableHead className="text-right">{copy.tableQty}</TableHead>
                      <TableHead className="text-right">{copy.tableTotal}</TableHead>
                      <TableHead className="text-right">{copy.tableAction}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMovements.length ? (
                      pagedRecentMovements.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/80">
                          <TableCell className="text-sm text-slate-600">{formatDateTimeLabel(item.date, locale)}</TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-900">{item.itemName || "-"}</div>
                            <div className="mt-1 text-xs text-slate-500">{itemTypeLabel(String(item.item_type || "RAW_MATERIAL"), copy)}</div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={joinClasses(
                                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                movementTone(String(item.movement_type || item.type || "IN") as WarehouseMovementStageKey)
                              )}
                            >
                              {movementLabels[String(item.movement_type || item.type || "IN") as WarehouseMovementStageKey]}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{item.location_name || item.from_location_name || "-"}</TableCell>
                          <TableCell className="text-right font-medium text-slate-900">
                            {formatCount(item.qty, locale)} {copy.units}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">{formatMoney(item.total, locale)}</TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              onClick={() => navigate("/dashboard/sklad/warehouse/movements")}
                              className={dashboardTableActionButtonClassName}
                            >
                              {copy.open}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                          {copy.emptyRecent}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {recentMovements.length ? (
                <div className="mt-4 flex justify-end">
                  <TablePagination page={recentMovementsPage} totalPages={recentMovementsTotalPages} onPageChange={setRecentMovementsPage} size="sm" />
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
