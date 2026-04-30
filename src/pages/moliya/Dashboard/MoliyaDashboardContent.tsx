import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleCheckBig,
  CreditCard,
  Landmark,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getCurrentLanguage, getCurrentLocale, useI18n } from "@/i18n"
import type {
  DashboardTone,
  FinanceActivityRow,
  FinanceCategoryRow,
  FinanceChannel,
  FinanceDashboardModel,
  FinanceDebtBucket,
  FinanceHeadlineMetric,
  FinanceInsight,
  FinanceTrendPoint,
  RangeKey,
} from "./data/types"
import { useFinanceDashboard } from "./data/useFinanceDashboard"
import type { FinanceActivity, FinanceDashboardResponse } from "./data/financeApi"

function getRangeOptions(language: "uz" | "ru" | "en"): Array<{ value: RangeKey; label: string }> {
  if (language === "ru") {
    return [
      { value: "BUGUN", label: "Сегодня" },
      { value: "HAFTA", label: "7 дней" },
      { value: "OXIRGI_OY", label: "30 дней" },
      { value: "YIL", label: "12 месяцев" },
    ]
  }
  if (language === "en") {
    return [
      { value: "BUGUN", label: "Today" },
      { value: "HAFTA", label: "7 days" },
      { value: "OXIRGI_OY", label: "30 days" },
      { value: "YIL", label: "12 months" },
    ]
  }
  return [
    { value: "BUGUN", label: "Bugun" },
    { value: "HAFTA", label: "7 kun" },
    { value: "OXIRGI_OY", label: "30 kun" },
    { value: "YIL", label: "12 oy" },
  ]
}

const toneStyles: Record<DashboardTone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-blue-200 bg-blue-50 text-blue-700",
}

function cx(...values: Array<string | false | undefined | null>) {
  return values.filter(Boolean).join(" ")
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

function formatMoney(value: number, currency = "UZS", compact = false) {
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  const moneySuffix = currency === "UZS" ? (getCurrentLanguage() === "ru" ? "сум" : getCurrentLanguage() === "en" ? "UZS" : "so'm") : currency

  if (compact) {
    if (abs >= 1_000_000_000) {
      return `${sign}${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2)} ${getCurrentLanguage() === "en" ? "bn" : "mlrd"} ${moneySuffix}`
    }
    if (abs >= 1_000_000) {
      return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)} ${getCurrentLanguage() === "en" ? "m" : "mln"} ${moneySuffix}`
    }
  }

  return `${sign}${new Intl.NumberFormat(getCurrentLocale()).format(Math.round(abs))} ${moneySuffix}`
}

function formatChange(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return getCurrentLanguage() === "ru" ? "Нет сигнала" : getCurrentLanguage() === "en" ? "No signal" : "Signal yo'q"
  }
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function methodMeta(method: FinanceChannel["key"] | FinanceActivityRow["method"]) {
  if (method === "BANK") {
    return {
      label: getCurrentLanguage() === "ru" ? "Банк" : "Bank",
      icon: Landmark,
      bar: "from-sky-500 to-cyan-400",
      badge: "bg-sky-50 text-sky-700 border-sky-200",
    }
  }
  if (method === "CARD") {
    return {
      label: getCurrentLanguage() === "ru" ? "Карта" : getCurrentLanguage() === "en" ? "Card" : "Karta",
      icon: CreditCard,
      bar: "from-violet-500 to-fuchsia-400",
      badge: "bg-violet-50 text-violet-700 border-violet-200",
    }
  }
  return {
    label: getCurrentLanguage() === "ru" ? "Наличные" : getCurrentLanguage() === "en" ? "Cash" : "Naqd",
    icon: Banknote,
    bar: "from-emerald-500 to-lime-400",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  }
}

function toneChip(tone: DashboardTone) {
  if (tone === "positive") return "text-emerald-600"
  if (tone === "warning") return "text-amber-600"
  if (tone === "critical") return "text-rose-600"
  return "text-slate-500"
}

function localizeFinanceLabel(value: string, language: "uz" | "ru" | "en") {
  if (language === "ru") {
    if (value === "Bank") return "Банк"
    if (value === "Karta") return "Карта"
    if (value === "Naqd") return "Наличные"
    if (value === "Operatsion marja") return "Операционная маржа"
    if (value === "Inkasso") return "Инкассо"
    if (value === "Jamoa") return "Команда"
    if (value === "Manba holati") return "Состояние источников"
    return value
  }
  if (language === "uz") {
    if (value === "Bank") return "Bank"
    if (value === "Karta") return "Karta"
    if (value === "Naqd") return "Naqd"
    if (value === "Operatsion marja") return "Operatsion marja"
    if (value === "Inkasso") return "Inkasso"
    if (value === "Jamoa") return "Jamoa"
    if (value === "Manba holati") return "Manba holati"
    if (value === "Client") return "Mijoz"
    if (value === "Receivables") return "Debitorlik"
    if (value === "Payables") return "Kreditorlik"
    if (value === "Payroll due") return "Oylik qarzdorligi"
  }
  return value
}

function localizeFinanceDescription(value: string, language: "uz" | "ru" | "en") {
  if (language !== "ru") return value
  if (value === "Sof oqimning kirimga nisbati") return "Отношение чистого потока к приходу"
  if (value === "Klient qarzdorligi qoplanishi") return "Покрытие клиентской задолженности"
  if (value.startsWith("Payroll qoldig'i ")) return value.replace("Payroll qoldig'i ", "Остаток задолженности ").replace(" so'm", " сум")
  if (value === "Ulangan backend modullari") return "Подключенные backend-модули"
  return value
}

function localizeActivityText(value: string, language: "uz" | "ru" | "en") {
  if (language === "ru") {
    return value
      .replaceAll("Zakaz", "Заказ")
      .replaceAll("SALARY", "ЗАРПЛАТА")
      .replaceAll("Salary", "Зарплата")
      .replaceAll("AVANS", "АВАНС")
      .replaceAll("PAYMENT", "ПЛАТЕЖ")
      .replaceAll("LEDGER", "КАССА")
      .replaceAll("CASH", "НАЛИЧНЫЕ")
      .replaceAll("EMPLOYEE", "СОТРУДНИК")
      .replaceAll("ORDER", "ЗАКАЗ")
  }
  if (language === "uz") {
    return value
      .replaceAll("Bank operation", "Bank amaliyoti")
      .replaceAll("Cash entry", "Kassa kiritmasi")
      .replaceAll("RAW_MATERIAL_PURCHASE", "XOMASHYO XARIDI")
      .replaceAll("FINISHED_GOODS_INVENTORY", "TAYYOR MAHSULOT OMBORI")
      .replaceAll("PRODUCTION_MATERIALS", "ISHLAB CHIQARISH MATERIALLARI")
      .replaceAll("RAW_MATERIAL", "XOMASHYO")
      .replaceAll("PURCHASE", "XARID")
      .replaceAll("PAYMENT", "TO'LOV")
      .replaceAll("LEDGER", "KASSA")
      .replaceAll("CASH", "NAQD")
      .replaceAll("EMPLOYEE", "XODIM")
      .replaceAll("ORDER", "BUYURTMA")
      .replaceAll("_", " ")
  }
  return value
}

function localizeCategoryName(value: string, language: "uz" | "ru" | "en") {
  if (language !== "uz") return value
  return value
    .replaceAll("SALARY", "OYLIK")
    .replaceAll("Client", "Mijoz")
    .replaceAll("CLIENT", "MIJOZ")
    .replaceAll("RAW_MATERIAL_PURCHASE", "XOMASHYO XARIDI")
    .replaceAll("FINISHED_GOODS_INVENTORY", "TAYYOR MAHSULOT OMBORI")
    .replaceAll("PRODUCTION_MATERIALS", "ISHLAB CHIQARISH MATERIALLARI")
    .replaceAll("RAW_MATERIAL", "XOMASHYO")
    .replaceAll("PURCHASE", "XARID")
    .replaceAll("_", " ")
}

type ChannelBreakdownRow = {
  key: string
  label: string
  operations: number
  bank: number
  card: number
  cash: number
  total: number
}

function normalizeMethodKey(value: string | undefined | null): FinanceChannel["key"] {
  const key = String(value || "").toUpperCase()
  if (key === "BANK") return "BANK"
  if (key === "CARD") return "CARD"
  return "CASH"
}

function resolveActivityPartyLabel(
  item: FinanceActivity,
  raw: FinanceDashboardResponse | null | undefined
) {
  const refType = String(item.referenceType || "").toUpperCase()
  const refId = String(item.referenceId || "").trim()

  if (refType.includes("CLIENT") && refId) {
    const name = raw?.clientsDebts?.find((row) => String(row.client_id || "") === refId)?.client_name
    if (name) return name
  }

  if (refType.includes("SUPPLIER") && refId) {
    const name = raw?.suppliersDebts?.find((row) => String(row.supplier_id || "") === refId)?.supplier_name
    if (name) return name
  }

  if (refType.includes("EMPLOYEE") && refId) {
    const name = raw?.employees?.find((row) => String(row.id || "") === refId)?.fullName
    if (name) return name
  }

  if (item.referenceLabel && !["CLIENT", "SUPPLIER", "EMPLOYEE"].includes(String(item.referenceLabel).toUpperCase())) {
    return item.referenceLabel
  }

  if (refType && refId) return `${refType} #${refId}`
  if (refType) return refType
  if (item.title) return item.title
  return item.category || "-"
}

function buildChannelBreakdownRows(
  raw: FinanceDashboardResponse | null | undefined,
  channelKey: FinanceChannel["key"] | null
) {
  if (!raw || !channelKey) return []

  const grouped = new Map<string, ChannelBreakdownRow>()
  raw.activities
    .forEach((item) => {
      const method = normalizeMethodKey(item.method)
      const label = resolveActivityPartyLabel(item, raw)
      const refType = String(item.referenceType || "").toUpperCase()
      const refId = String(item.referenceId || "").trim()
      const key = `${refType || "UNKNOWN"}:${refId || label}`
      const current = grouped.get(key) ?? {
        key,
        label,
        operations: 0,
        bank: 0,
        card: 0,
        cash: 0,
        total: 0,
      }

      const amount = Math.abs(Number(item.amount || 0))
      current.operations += 1
      current.total += amount
      if (method === "BANK") current.bank += amount
      else if (method === "CARD") current.card += amount
      else current.cash += amount
      grouped.set(key, current)
    })

  const rows = Array.from(grouped.values()).filter((row) => {
    if (channelKey === "BANK") return row.bank > 0
    if (channelKey === "CARD") return row.card > 0
    return row.cash > 0
  })

  return rows.sort((a, b) => {
    const aFocused = channelKey === "BANK" ? a.bank : channelKey === "CARD" ? a.card : a.cash
    const bFocused = channelKey === "BANK" ? b.bank : channelKey === "CARD" ? b.card : b.cash
    if (bFocused !== aFocused) return bFocused - aFocused
    return b.total - a.total
  })
}

function SectionCard({
  title,
  subtitle,
  aside,
  children,
  className,
}: {
  title: string
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cx(
        "lux-motion-surface rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_22px_70px_-48px_rgba(15,23,42,0.22)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-black tracking-tight text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function HeroMetricCard({ metric, currency }: { metric: FinanceHeadlineMetric; currency: string }) {
  const { language } = useI18n()
  const isPositive = (metric.change ?? 0) >= 0
  const label =
    language === "ru"
      ? metric.label === "Kirim"
        ? "Приход"
        : metric.label === "Sof oqim"
          ? "Прибыль"
          : metric.label === "Qarz saldosi"
            ? "Кредиторская задолженность"
            : metric.label
      : metric.label
  const caption =
    language === "ru"
      ? metric.caption === "Konsolidatsiyalangan tushum"
        ? "Приход от продаж"
        : metric.caption === "Operatsion chiqimlar"
          ? "Расходы"
          : metric.caption === "Kirim minus xarajat"
            ? ""
            : metric.caption === "Inkasso ko'rsatkichi"
              ? ""
          : metric.caption
      : metric.caption

  return (
    <div className="lux-motion-surface relative overflow-hidden rounded-[26px] border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,255,0.92)_100%)] p-4 shadow-[0_24px_44px_-30px_rgba(4,14,40,0.46)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.95),transparent)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
        <div className={cx("text-xs font-bold", toneChip(metric.tone))}>
          {isPositive ? <ArrowUpRight className="inline h-3.5 w-3.5" /> : <ArrowDownRight className="inline h-3.5 w-3.5" />}{" "}
          {formatChange(metric.change)}
        </div>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">
        {formatMoney(metric.amount, currency, true)}
      </div>
      <div className="mt-2 text-sm leading-5 text-slate-500">{caption}</div>
    </div>
  )
}

function TrendCard({
  points,
  currency,
  rangeLabel,
}: {
  points: FinanceTrendPoint[]
  currency: string
  rangeLabel: string
}) {
  const { language } = useI18n()
  const totalIncome = points.reduce((sum, item) => sum + item.income, 0)
  const totalExpense = points.reduce((sum, item) => sum + item.expense, 0)
  const localizedRangeLabel =
    language === "ru"
      ? rangeLabel === "Bugun"
        ? "Сегодня"
        : rangeLabel === "Oxirgi 7 kun"
          ? "Последние 7 дней"
          : rangeLabel === "Oxirgi 30 kun"
            ? "Последние 30 дней"
            : rangeLabel === "Oxirgi 12 oy"
              ? "Последние 12 месяцев"
              : rangeLabel
      : rangeLabel

  const uzRangeLabel =
    rangeLabel === "Today"
      ? "Bugun"
      : rangeLabel === "Last 7 days"
        ? "Oxirgi 7 kun"
        : rangeLabel === "Last 30 days"
          ? "Oxirgi 30 kun"
          : rangeLabel === "Last 12 months"
            ? "Oxirgi 12 oy"
            : rangeLabel
  const trendTitle = language === "uz" ? "Pul oqimi trendi" : "Cashflow trend"
  const trendSubtitle =
    language === "uz"
      ? `${uzRangeLabel} bo'yicha kirim va xarajat oqimi`
      : `${localizedRangeLabel} for income and expense flow`
  const netLabel = language === "uz" ? "Sof oqim:" : "Net:"

  return (
    <SectionCard
      title={trendTitle}
      subtitle={trendSubtitle}
      aside={
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {netLabel} {formatMoney(totalIncome - totalExpense, currency, true)}
        </div>
      }
    >
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points}>
            <defs>
              <linearGradient id="financeIncomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.34} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="financeExpenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
              contentStyle={{
                borderRadius: 18,
                border: "1px solid #e2e8f0",
                background: "rgba(255,255,255,0.96)",
                boxShadow: "0 24px 60px -36px rgba(15,23,42,0.35)",
              }}
              formatter={(value, name) => [
                formatMoney(Number(value || 0), currency),
                name === "income" ? (language === "ru" ? "Поступление" : language === "en" ? "Income" : "Kirim") : language === "ru" ? "Расход" : language === "en" ? "Expense" : "Xarajat",
              ]}
            />
            <Area type="monotone" dataKey="income" stroke="#0f766e" fill="url(#financeIncomeFill)" strokeWidth={3} />
            <Area type="monotone" dataKey="expense" stroke="#e11d48" fill="url(#financeExpenseFill)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          {language === "ru" ? "Поступление" : language === "en" ? "Income" : "Kirim"}: {formatMoney(totalIncome, currency, true)}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          {language === "ru" ? "Расход" : language === "en" ? "Expense" : "Xarajat"}: {formatMoney(totalExpense, currency, true)}
        </div>
      </div>
    </SectionCard>
  )
}

function DebtPressureCard({
  items,
  currency,
  collectionRatio,
}: {
  items: FinanceDebtBucket[]
  currency: string
  collectionRatio: number
}) {
  const maxAmount = Math.max(...items.map((item) => item.amount), 1)

  return (
    <SectionCard
      title="Majburiyatlar paneli"
      subtitle="Debitor, kreditor va oylik bosimi"
      aside={
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          Inkasso: {collectionRatio.toFixed(1)}%
        </div>
      }
    >
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="lux-motion-surface rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">{item.label}</div>
                <div className="mt-1 text-sm text-slate-500">{item.hint}</div>
              </div>
              <div
                className={cx(
                  "rounded-full px-3 py-1 text-xs font-bold",
                  item.tone === "positive"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.tone === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : item.tone === "critical"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-700"
                )}
              >
                {item.count} ta
              </div>
            </div>
            <div className="mt-4 text-xl font-black tracking-tight text-slate-900">
              {formatMoney(item.amount, currency, true)}
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-200">
              <div
                className={cx(
                  "h-2 rounded-full",
                  item.tone === "positive"
                    ? "bg-emerald-500"
                    : item.tone === "warning"
                      ? "bg-amber-500"
                      : item.tone === "critical"
                        ? "bg-rose-500"
                        : "bg-slate-500"
                )}
                style={{ width: `${Math.max(10, Math.round((item.amount / maxAmount) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function ChannelMixCard({
  channels,
  currency,
  onChannelClick,
}: {
  channels: FinanceChannel[]
  currency: string
  onChannelClick?: (channel: FinanceChannel) => void
}) {
  const { language } = useI18n()
  return (
    <SectionCard
      title={language === "ru" ? "Структура платежей" : language === "uz" ? "To'lovlar tarkibi" : "Payment mix"}
      subtitle={language === "ru" ? "По объему банка, карты и наличных" : language === "en" ? "Volume split across bank, card, and cash" : "Bank, karta va naqd bo'yicha hajm"}
    >
      <div className="space-y-4">
        {channels.map((channel) => {
          const meta = methodMeta(channel.key)
          const Icon = meta.icon
          const channelLabel = localizeFinanceLabel(channel.label, language)

          return (
            <button
              key={channel.key}
              type="button"
              data-slot="button"
              onClick={() => onChannelClick?.(channel)}
              className="lux-motion-surface w-full cursor-pointer rounded-[24px] border border-slate-200 bg-white p-4 text-left shadow-[0_16px_36px_-28px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-slate-50/80 hover:shadow-[0_24px_48px_-30px_rgba(37,99,235,0.16)]"
            >
              <div className="flex items-center gap-3">
                <div className={cx("rounded-2xl border p-3 shadow-sm", meta.badge)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-black text-slate-900">{channelLabel}</div>
                    <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">{channel.share}%</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {language === "ru" ? `${channel.count} операций` : language === "en" ? `${channel.count} operations` : `${channel.count} ta operatsiya`} | {formatMoney(channel.amount, currency, true)}
                  </div>
                </div>
              </div>
              <div className="mt-4 h-2.5 rounded-full bg-slate-200">
                <div className={cx("h-2.5 rounded-full bg-gradient-to-r shadow-[0_6px_12px_-6px_rgba(37,99,235,0.45)]", meta.bar)} style={{ width: `${Math.max(8, channel.share)}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}

function ChannelBreakdownDialog({
  channel,
  rows,
  currency,
  open,
  onOpenChange,
  model,
}: {
  channel: FinanceChannel | null
  rows: ChannelBreakdownRow[]
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
  model: FinanceDashboardModel
}) {
  const { language } = useI18n()

  if (!channel) return null

  const title =
    language === "ru"
      ? `${localizeFinanceLabel(channel.label, language)}: детализация поступлений`
      : language === "en"
        ? `${channel.label}: operation details`
        : `${channel.label}: amallar tafsilotlari`

  const summaryLabel =
    language === "ru"
      ? "Поступления по клиенту/reference. В столбцах показаны Банк, Карта, Наличные и итоговая сумма."
      : language === "en"
        ? "Operations are grouped by client/reference with Bank, Card, Cash, and Total amounts."
        : "Amallar mijoz yoki havola bo'yicha guruhlangan. Ustunlarda bank, karta, naqd va jami summalar ko'rsatilgan."

  const focusedTotal = rows.reduce((sum, row) => {
    if (channel.key === "BANK") return sum + row.bank
    if (channel.key === "CARD") return sum + row.card
    return sum + row.cash
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-0 shadow-[0_40px_120px_-52px_rgba(15,23,42,0.35)]">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle className="text-left text-2xl font-black tracking-tight text-slate-900">{title}</DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>{summaryLabel}</span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
              {model.periodLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
              {language === "ru" ? "По выбранному способу" : language === "en" ? "Selected method total" : "Tanlangan usul jami"}: {formatMoney(focusedTotal, currency, true)}
            </span>
          </div>
        </DialogHeader>

        <div className="overflow-auto p-6">
          {rows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {language === "ru"
                ? "Для этого способа оплаты поступления пока не найдены."
                : language === "en"
                  ? "No operations found for this method."
                  : "Bu usul bo'yicha amallar topilmadi."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              <table className="w-full min-w-[860px] table-fixed">
                <thead className="bg-[linear-gradient(90deg,#1d4ed8_0%,#1e40af_100%)] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold">
                      {language === "ru" ? "Клиент / reference" : language === "en" ? "Client / reference" : "Mijoz / havola"}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-bold">
                      {language === "ru" ? "Операции" : language === "en" ? "Ops" : "Operatsiya"}
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-bold">{language === "ru" ? "Банк" : "Bank"}</th>
                    <th className="px-4 py-3 text-right text-sm font-bold">{language === "ru" ? "Карта" : language === "en" ? "Card" : "Karta"}</th>
                    <th className="px-4 py-3 text-right text-sm font-bold">{language === "ru" ? "Наличные" : language === "en" ? "Cash" : "Naqd"}</th>
                    <th className="px-4 py-3 text-right text-sm font-bold">
                      {language === "ru" ? "Итого" : language === "en" ? "Total" : "Jami"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.label}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">{row.operations}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{formatMoney(row.bank, currency, true)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{formatMoney(row.card, currency, true)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{formatMoney(row.cash, currency, true)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{formatMoney(row.total, currency, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CategoryBreakdownCard({
  rows,
  currency,
}: {
  rows: FinanceCategoryRow[]
  currency: string
}) {
  const { language } = useI18n()
  return (
    <SectionCard
      title={language === "ru" ? "Срез по категориям" : "Kategoriya kesimi"}
      subtitle={language === "ru" ? "Крупнейшие финансовые драйверы" : "Eng katta moliyaviy omillar"}
    >
      <div className="space-y-3">
        {rows.slice(0, 6).map((row) => (
          <div key={`${row.direction}-${row.name}`} className="lux-motion-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-900">{localizeCategoryName(row.name, language)}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {language === "ru" ? (row.direction === "INCOME" ? "Поступление" : "Расход") : language === "uz" ? (row.direction === "INCOME" ? "Kirim" : "Xarajat") : row.direction === "INCOME" ? "Income" : "Expense"}
                </div>
              </div>
              <div className={cx("text-sm font-black", row.direction === "INCOME" ? "text-emerald-700" : "text-rose-700")}>
                {formatMoney(row.amount, currency, true)}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-200">
                <div
                  className={cx("h-2 rounded-full", row.direction === "INCOME" ? "bg-emerald-500" : "bg-rose-500")}
                  style={{ width: `${Math.max(8, row.share)}%` }}
                />
              </div>
              <div className="text-xs font-bold text-slate-500">{row.share}%</div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function InsightsCard({ items }: { items: FinanceInsight[] }) {
  const { language } = useI18n()
  return (
    <SectionCard
      title={language === "ru" ? "Сигналы контроля" : "Nazorat signallari"}
      subtitle={language === "ru" ? "Краткие KPI и индикаторы состояния" : "Qisqa KPI va sog'liq indikatorlari"}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {items.map((item) => (
          <div key={item.title} className="lux-motion-surface rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className={cx("text-xs font-bold uppercase tracking-[0.18em]", item.tone === "positive"
              ? "text-emerald-600"
              : item.tone === "warning"
                ? "text-amber-600"
                : item.tone === "critical"
                  ? "text-rose-600"
                  : "text-slate-500")}>
              {localizeFinanceLabel(item.title, language)}
            </div>
            <div className="mt-3 text-2xl font-black tracking-tight text-slate-900">{item.value}</div>
            <div className="mt-2 text-sm leading-5 text-slate-500">{localizeFinanceDescription(item.description, language)}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function ActivityFeedCard({
  rows,
  currency,
}: {
  rows: FinanceActivityRow[]
  currency: string
}) {
  const { language } = useI18n()
  return (
    <SectionCard
      title={language === "ru" ? "Последняя активность" : language === "uz" ? "So'nggi faollik" : "Recent activity"}
      subtitle={language === "ru" ? "Последние банковские и кассовые операции" : language === "uz" ? "So'nggi bank va kassaviy harakatlar" : "Latest bank and cash operations"}
      aside={
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          <ShieldCheck className="h-4 w-4" />
          {language === "ru" ? "Живая лента" : language === "uz" ? "Jonli lenta" : "Live feed"}
        </div>
      }
    >
      <div className="space-y-3">
        {rows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            {language === "ru" ? "По этому фильтру активность не найдена." : language === "uz" ? "Bu filtr bo'yicha faollik topilmadi." : "No activity found for this filter."}
          </div>
        ) : (
          rows.map((row) => {
            const meta = methodMeta(row.method)
            const Icon = row.direction === "INCOME" ? ArrowUpRight : ArrowDownRight

            return (
              <div key={row.id} className="lux-motion-surface flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:flex-row sm:items-center">
                <div className={cx("flex h-12 w-12 items-center justify-center rounded-2xl border", meta.badge)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-slate-900">{localizeActivityText(row.title, language)}</div>
                  <div className="mt-1 text-sm text-slate-500">{localizeActivityText(row.subtitle, language)}</div>
                </div>
                <div className="sm:text-right">
                  <div className={cx("text-sm font-black", row.direction === "INCOME" ? "text-emerald-700" : "text-rose-700")}>
                    {row.direction === "INCOME" ? "+" : "-"}
                    {formatMoney(row.amount, currency, true)}
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{row.dateLabel}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </SectionCard>
  )
}

export default function MoliyaDashboardContent() {
  const { language } = useI18n()
  const [range, setRange] = useState<RangeKey>("OXIRGI_OY")
  const [search, setSearch] = useState("")
  const [selectedChannel, setSelectedChannel] = useState<FinanceChannel | null>(null)
  const deferredSearch = useDeferredValue(search)
  const rangeOptions = useMemo(() => getRangeOptions(language), [language])
  const currentRangeLabel = useMemo(
    () => rangeOptions.find((item) => item.value === range)?.label ?? model.rangeLabel,
    [range, rangeOptions]
  )

  const query = useMemo(() => {
    const value = deferredSearch.trim()
    return { range, search: value || undefined }
  }, [deferredSearch, range])

  const { ui, error, model, retry, hasBackend, raw } = useFinanceDashboard(query)
  const channelBreakdownRows = useMemo(
    () => buildChannelBreakdownRows(raw, selectedChannel?.key ?? null),
    [raw, selectedChannel]
  )

  return (
    <div className="motion-stagger space-y-5 text-slate-900">
      <section className="relative overflow-hidden rounded-[34px] border border-[#c7d2fe]/12 bg-[linear-gradient(135deg,#081a46_0%,#0d2f78_24%,#123f95_48%,#1b4db8_70%,#214fcb_100%)] text-white shadow-[0_42px_140px_-58px_rgba(8,26,70,0.82)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.24),transparent_22%),radial-gradient(circle_at_72%_78%,rgba(129,140,248,0.18),transparent_24%)]" />
        <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-[-30px] top-[-20px] h-64 w-64 rounded-full bg-sky-300/16 blur-3xl" />
        <div className="absolute bottom-[-36px] left-[42%] h-56 w-56 rounded-full bg-indigo-300/16 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent_0%,rgba(3,10,30,0.18)_100%)]" />

        <div className="relative p-6 md:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <div className="max-w-3xl">
              <h1 className="mt-2 text-3xl font-black tracking-tight !text-white sm:text-4xl">
                {language === "ru" ? "Центр управления финансами" : language === "en" ? "Finance control center" : "Moliya boshqaruv markazi"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white sm:text-[15px]">
                {language === "ru"
                  ? "Приход, расход, кредиторскую задолженность вы можете контролировать здесь. Вся информация, связанная с финансами, обновляется в реальном времени."
                  : language === "en"
                    ? "Track income, expenses, and debts here, and keep your financial status under control with real-time updates."
                    : "Kirim, xarajat, qarzdorliklarni shu yerda ko'rib va shu yerda boshqaring, real vaqt rejimida yangilangan ma'lumotlar bilan moliyaviy holatingizni doimo nazorat ostida tuting."}
              </p>
            </div>

            <div className="motion-enter-side-slow w-full max-w-xl rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.14)] xl:ml-auto">
              <div className="grid gap-3 md:grid-cols-[1fr_170px_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={language === "ru" ? "Клиент, поставщик, комментарий..." : language === "en" ? "Client, supplier, note, or method..." : "Mijoz, ta'minotchi, izoh yoki usul..."}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.35)] outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100/80"
                  />
                </label>

                <Select value={range} onValueChange={(value) => setRange(value as RangeKey)}>
                  <SelectTrigger className="h-11 w-full rounded-2xl border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.35)] focus-visible:border-blue-300 focus-visible:ring-[3px] focus-visible:ring-blue-100">
                    <SelectValue placeholder={language === "ru" ? "Выберите период" : language === "en" ? "Select period" : "Davrni tanlang"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.22)]">
                    {rangeOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value} className="rounded-xl text-slate-900">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#60a5fa]/20 bg-[linear-gradient(135deg,#1d4ed8,#1e40af)] px-4 text-sm font-bold text-white shadow-[0_12px_26px_rgba(15,23,42,0.22)] transition hover:brightness-110"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {language === "ru" ? "Обновить" : language === "en" ? "Refresh" : "Yangilash"}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">{currentRangeLabel}</span>
                <span>{model.periodLabel}</span>
                <span>{language === "ru" ? "Обновлено" : language === "en" ? "Updated" : "Yangilandi"}: {model.generatedAtLabel}</span>
              </div>
            </div>
          </div>

          <div className="motion-stagger-right-slow mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {model.headlineMetrics.map((metric) => (
              <HeroMetricCard key={metric.label} metric={metric} currency={model.currency} />
            ))}
          </div>

          <div className="motion-stagger-right-slow mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="relative overflow-hidden rounded-[30px] border border-white/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(242,247,255,0.94)_100%)] p-5 shadow-[0_28px_56px_-34px_rgba(4,14,40,0.46)] backdrop-blur-xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.96),transparent)]" />
              <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-blue-200/20 blur-3xl" />
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                {language === "ru" ? "Снимок чистого потока" : language === "en" ? "Net flow snapshot" : "Sof oqim ko'rinishi"}
              </div>
              <div className="mt-3 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                {formatMoney(model.headlineMetrics[2]?.amount || 0, model.currency, true)}
              </div>
              <div className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {language === "ru"
                  ? "Дебиторская и кредиторская задолженность рассчитаны вместе, чтобы отдельно показать точки финансового давления."
                  : language === "en"
                    ? "Receivables and payables are calculated together to highlight the points of financial pressure."
                    : "Debitorlar, kreditorlar va oylik qarzdorligi birga hisoblanib, moliyaviy bosim nuqtalari ajratib ko'rsatildi."}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-slate-200/80 bg-white/82 p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.28)] backdrop-blur">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {language === "ru" ? "Дебиторка" : language === "en" ? "Receivables" : "Debitorlik"}
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-900">{formatMoney(model.totalReceivables, model.currency, true)}</div>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-white/82 p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.28)] backdrop-blur">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {language === "ru" ? "Кредиторка" : language === "en" ? "Payables" : "Kreditorlik"}
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-900">{formatMoney(model.totalPayables, model.currency, true)}</div>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-white/82 p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.28)] backdrop-blur">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {language === "ru" ? "Задолженность по контрагентам" : language === "en" ? "Payroll due" : "Oylik qarzdorligi"}
                  </div>
                  <div className="mt-2 text-lg font-black text-slate-900">{formatMoney(model.payrollDue, model.currency, true)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {ui === "error" ? (
        <ScrollReveal delay={80}>
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            <div className="font-black">Dashboard backenddan o'qilmadi</div>
            <div className="mt-1">{error}</div>
          </div>
        </ScrollReveal>
      ) : null}

      <ScrollReveal delay={110}>
        <div className="grid gap-5">
          <TrendCard points={model.trend} currency={model.currency} rangeLabel={model.rangeLabel} />
        </div>
      </ScrollReveal>

      <ScrollReveal delay={150}>
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <ChannelMixCard channels={model.channels} currency={model.currency} onChannelClick={setSelectedChannel} />
          <CategoryBreakdownCard rows={model.topCategoriesDetailed} currency={model.currency} />
        </div>
      </ScrollReveal>

      <ScrollReveal delay={190}>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ActivityFeedCard rows={model.recentActivity} currency={model.currency} />

        <SectionCard
          title={language === "ru" ? "Команда и контроль" : language === "uz" ? "Jamoa va nazorat" : "Team + control"}
          subtitle={language === "ru" ? "Быстрый обзор payroll и контроля" : language === "uz" ? "Oylik va nazorat uchun tezkor ko'rinish" : "Quick view for payroll and compliance"}
          aside={
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              <Users className="h-4 w-4" />
              {language === "ru" ? `${model.employeeCount} сотрудник` : language === "en" ? `${model.employeeCount} employees` : `${model.employeeCount} xodim`}
            </div>
          }
        >
          <div className="motion-stagger-right-slow space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_100%)] p-5">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{language === "ru" ? "Задолженность по payroll" : language === "uz" ? "Oylik qarzdorligi" : "Payroll backlog"}</div>
              <div className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                {formatMoney(model.payrollDue, model.currency, true)}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                {language === "ru"
                  ? "Сумма по сотрудникам, которая еще не закрыта в текущем месяце. Уровень нагрузки можно увидеть, не открывая payroll-раздел."
                  : language === "uz"
                    ? "Xodimlar bo'yicha joriy oyda hali yopilmagan summa. Oylik bo'limiga o'tmasdan ham bosim darajasini ko'rish mumkin."
                    : "The amount still unsettled for employees this month. You can see the pressure level without opening the payroll section."}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <CircleCheckBig className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">{language === "ru" ? "Коэффициент инкассации" : language === "uz" ? "Undirish darajasi" : "Collection ratio"}</div>
                  <div className="mt-1 text-sm text-slate-500">{language === "ru" ? "Уровень возврата денег от клиентов" : language === "uz" ? "Mijozlardan pul qaytishi darajasi" : "Client collection rate"}</div>
                  <div className="mt-3 text-2xl font-black text-slate-900">{model.collectionRatio.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">{language === "ru" ? "Покрытие источников" : language === "uz" ? "Manbalar qamrovi" : "Source coverage"}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {language === "ru"
                      ? `${model.sourceStatus.filter((item) => item.ok).length}/${model.sourceStatus.length} модулей отвечают`
                      : language === "uz"
                        ? `${model.sourceStatus.filter((item) => item.ok).length}/${model.sourceStatus.length} modul javob beryapti`
                        : `${model.sourceStatus.filter((item) => item.ok).length}/${model.sourceStatus.length} modules responding`}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-600">
                    {language === "ru"
                      ? "Потоки summary, debt, ledger, payments и employees собираются в представление, близкое к реальному времени."
                      : language === "uz"
                        ? "Hisobot, qarzdorlik, kassa, to'lovlar va xodim oqimlari real vaqtga yaqin ko'rinishda yig'iladi."
                        : "Summary, debt, ledger, payments, and employee flows are aggregated in near real time."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
        </div>
      </ScrollReveal>

      <ChannelBreakdownDialog
        channel={selectedChannel}
        rows={channelBreakdownRows}
        currency={model.currency}
        open={!!selectedChannel}
        onOpenChange={(open) => {
          if (!open) setSelectedChannel(null)
        }}
        model={model}
      />
    </div>
  )
}
