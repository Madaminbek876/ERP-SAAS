import { getCurrentLanguage, getCurrentLocale, localizeText } from "@/i18n"
import { getUserName } from "@/shared/useMe"
import type { FinanceActivity, FinanceDashboardResponse, FinanceDebtRow } from "./financeApi"
import type {
  FinanceCategoryRow,
  FinanceDashboardModel,
  FinanceHeadlineMetric,
  FinanceInsight,
  FinanceTrendPoint,
} from "./types"

function n(v: unknown) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function s(v: unknown) {
  return String(v ?? "")
}

function pickText(uz: string, ru: string, en: string) {
  const language = getCurrentLanguage()
  if (language === "ru") return ru
  if (language === "en") return en
  return uz
}

function formatStamp(value: Date) {
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return s(value)
  return new Intl.DateTimeFormat(getCurrentLocale(), { day: "2-digit", month: "short" }).format(date)
}

function bucketDate(date: Date, days: number) {
  if (days > 180) {
    const keyDate = new Date(date.getFullYear(), date.getMonth(), 1)
    return {
      key: keyDate.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat(getCurrentLocale(), { month: "short" }).format(keyDate),
      order: keyDate.getTime(),
    }
  }

  if (days > 45) {
    const mondayShift = (date.getDay() + 6) % 7
    const keyDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayShift)
    return {
      key: keyDate.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat(getCurrentLocale(), { day: "2-digit", month: "short" }).format(keyDate),
      order: keyDate.getTime(),
    }
  }

  const keyDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return {
    key: keyDate.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat(getCurrentLocale(), { day: "2-digit", month: "short" }).format(keyDate),
    order: keyDate.getTime(),
  }
}

function buildTrend(activities: FinanceActivity[], days: number): FinanceTrendPoint[] {
  const grouped = new Map<string, { label: string; income: number; expense: number; order: number }>()

  activities.forEach((item) => {
    const date = new Date(item.date)
    if (Number.isNaN(date.getTime())) return
    const bucket = bucketDate(date, days)
    const existing = grouped.get(bucket.key)
    if (existing) {
      if (item.direction === "INCOME") existing.income += n(item.amount)
      else existing.expense += n(item.amount)
      return
    }

    grouped.set(bucket.key, {
      label: bucket.label,
      income: item.direction === "INCOME" ? n(item.amount) : 0,
      expense: item.direction === "EXPENSE" ? n(item.amount) : 0,
      order: bucket.order,
    })
  })

  return Array.from(grouped.values())
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      label: item.label,
      income: item.income,
      expense: item.expense,
      net: item.income - item.expense,
    }))
}

function calculateDelta(values: number[]) {
  const safe = values.filter((item) => Number.isFinite(item))
  if (safe.length < 2) return null
  const prev = safe[safe.length - 2]
  const last = safe[safe.length - 1]
  if (prev === 0) return last === 0 ? 0 : 100
  return Number((((last - prev) / Math.abs(prev)) * 100).toFixed(1))
}

function buildTopCategories(response: FinanceDashboardResponse): FinanceCategoryRow[] {
  const rows = Array.isArray(response.summary?.top_categories) ? response.summary.top_categories : []
  const total = rows.reduce((sum, row) => sum + n(row?.total), 0) || 1

  return rows
    .map((row) => ({
      name: s(row?.category || "OTHER"),
      amount: n(row?.total),
      share: Math.round((n(row?.total) / total) * 100),
      direction: (s(row?.entry_type).toUpperCase() === "INCOME" ? "INCOME" : "EXPENSE") as "INCOME" | "EXPENSE",
    }))
    .sort((a, b) => b.amount - a.amount)
}

function buildChannels(activities: FinanceActivity[]) {
  const base = [
    { key: "BANK" as const, label: localizeText("Bank") },
    { key: "CARD" as const, label: localizeText("Karta") },
    { key: "CASH" as const, label: localizeText("Naqd") },
  ]

  const total = activities.reduce((sum, item) => sum + Math.abs(n(item.amount)), 0) || 1

  return base.map((channel) => {
    const scoped = activities.filter((item) => item.method === channel.key)
    const amount = scoped.reduce((sum, item) => sum + Math.abs(n(item.amount)), 0)
    return {
      key: channel.key,
      label: channel.label,
      amount,
      count: scoped.length,
      share: Math.round((amount / total) * 100),
    }
  })
}

function buildRecentActivity(activities: FinanceActivity[]) {
  return activities.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: [item.source === "PAYMENT" ? "PAYMENT" : "LEDGER", item.method, item.referenceLabel || item.category]
      .filter(Boolean)
      .join(" | "),
    amount: n(item.amount),
    direction: item.direction,
    method: item.method,
    dateLabel: formatShortDate(item.date),
    source: item.source,
  }))
}

function sumDebt(rows: FinanceDebtRow[]) {
  return rows.reduce((sum, row) => sum + n(row.debt), 0)
}

function sumPaid(rows: FinanceDebtRow[]) {
  return rows.reduce((sum, row) => sum + n(row.paid), 0)
}

function sumTotal(rows: FinanceDebtRow[]) {
  return rows.reduce((sum, row) => sum + n(row.total), 0)
}

function buildPayrollDue(employees: FinanceDashboardResponse["employees"], activities: FinanceActivity[]) {
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const paidByEmployee = new Map<string, number>()

  activities.forEach((item) => {
    if (item.direction !== "EXPENSE") return
    if (!s(item.referenceType).toUpperCase().includes("EMPLOYEE")) return
    if (!s(item.date).startsWith(monthPrefix)) return
    const key = s(item.referenceId)
    if (!key) return
    paidByEmployee.set(key, (paidByEmployee.get(key) || 0) + n(item.amount))
  })

  let payrollDue = 0
  let pendingCount = 0

  employees.forEach((employee) => {
    const due = Math.max(n(employee.baseSalary) - (paidByEmployee.get(s(employee.id)) || 0), 0)
    payrollDue += due
    if (due > 0) pendingCount += 1
  })

  return { payrollDue, pendingCount }
}

function buildHeadlineMetrics(
  income: number,
  expense: number,
  net: number,
  totalReceivables: number,
  totalPayables: number,
  collectionRatio: number,
  trend: FinanceTrendPoint[]
): FinanceHeadlineMetric[] {
  return [
    {
      label: localizeText("Kirim"),
      amount: income,
      change: calculateDelta(trend.map((item) => item.income)),
      tone: "positive",
      caption: pickText("Konsolidatsiyalangan tushum", "Консолидированное поступление", "Consolidated income"),
    },
    {
      label: localizeText("Xarajat"),
      amount: expense,
      change: calculateDelta(trend.map((item) => item.expense)),
      tone: "warning",
      caption: pickText("Operatsion chiqimlar", "Операционные расходы", "Operating expenses"),
    },
    {
      label: localizeText("Sof oqim"),
      amount: net,
      change: calculateDelta(trend.map((item) => item.net)),
      tone: net >= 0 ? "positive" : "critical",
      caption: pickText("Kirim minus xarajat", "Поступления минус расходы", "Income minus expense"),
    },
    {
      label: localizeText("Qarz saldosi"),
      amount: totalReceivables - totalPayables,
      change: collectionRatio,
      tone: totalReceivables >= totalPayables ? "positive" : "critical",
      caption: pickText("Inkasso ko'rsatkichi", "Показатель инкассо", "Collection indicator"),
    },
  ]
}

function buildInsights(
  income: number,
  expense: number,
  net: number,
  collectionRatio: number,
  sourceStatus: FinanceDashboardResponse["sourceStatus"],
  employeeCount: number,
  payrollDue: number
): FinanceInsight[] {
  const sourceOk = sourceStatus.filter((item) => item.ok).length
  const sourceTotal = sourceStatus.length || 1
  const margin = income > 0 ? (net / income) * 100 : 0

  return [
    {
      title: pickText("Operatsion marja", "Операционная маржа", "Operating margin"),
      value: `${margin.toFixed(1)}%`,
      description: pickText("Sof oqimning kirimga nisbati", "Отношение чистого потока к поступлениям", "Net flow relative to income"),
      tone: margin >= 0 ? "positive" : "critical",
    },
    {
      title: pickText("Inkasso", "Инкассо", "Collections"),
      value: `${collectionRatio.toFixed(1)}%`,
      description: pickText("Klient qarzdorligi qoplanishi", "Покрытие клиентской задолженности", "Client debt coverage"),
      tone: collectionRatio >= 65 ? "positive" : collectionRatio >= 45 ? "warning" : "critical",
    },
    {
      title: pickText("Jamoa", "Команда", "Team"),
      value: pickText(`${employeeCount} ta`, `${employeeCount} чел.`, `${employeeCount} people`),
      description: pickText(
        `Payroll qoldig'i ${payrollDue.toLocaleString(getCurrentLocale())} so'm`,
        `Остаток payroll ${payrollDue.toLocaleString(getCurrentLocale())} сум`,
        `Payroll balance ${payrollDue.toLocaleString(getCurrentLocale())} UZS`
      ),
      tone: payrollDue > 0 ? "warning" : "neutral",
    },
    {
      title: pickText("Manba holati", "Статус источников", "Source status"),
      value: `${sourceOk}/${sourceTotal}`,
      description: pickText("Ulangan backend modullari", "Подключенные backend-модули", "Connected backend modules"),
      tone: sourceOk === sourceTotal ? "positive" : sourceOk >= sourceTotal / 2 ? "warning" : "critical",
    },
  ]
}

function emptySourceStatus() {
  return [
    { key: "summary", label: "Summary", ok: false },
    { key: "clientsDebts", label: "Client debt", ok: false },
    { key: "suppliersDebts", label: "Supplier debt", ok: false },
    { key: "ledger", label: pickText("Kassa", "Касса", "Cash"), ok: false },
    { key: "payments", label: pickText("Bank", "Банк", "Bank"), ok: false },
    { key: "employees", label: "Employees", ok: false },
  ]
}

function createEmptyFinanceDashboardModel(): FinanceDashboardModel {
  return {
    helloName: getUserName(),
    kpis: [
      { title: pickText("Jami kirim", "Общий приход", "Total income"), amount: 0, deltaPercent: null, spark: [] },
      { title: pickText("Jami xarajat", "Общий расход", "Total expense"), amount: 0, deltaPercent: null, spark: [] },
    ],
    dissection: [],
    activeCards: [],
    categories: [],
    spending: [],
    transactions: [],
    investments: [],
    incomeExpense: [],
    currency: "UZS",
    rangeLabel: "-",
    periodLabel: "-",
    generatedAtLabel: formatStamp(new Date()),
    headlineMetrics: [
      { label: localizeText("Kirim"), amount: 0, change: null, tone: "neutral", caption: pickText("Backend ma'lumoti kutilmoqda", "Ожидаются данные backend", "Waiting for backend data") },
      { label: localizeText("Xarajat"), amount: 0, change: null, tone: "neutral", caption: pickText("Backend ma'lumoti kutilmoqda", "Ожидаются данные backend", "Waiting for backend data") },
      { label: localizeText("Sof oqim"), amount: 0, change: null, tone: "neutral", caption: pickText("Backend ma'lumoti kutilmoqda", "Ожидаются данные backend", "Waiting for backend data") },
      { label: localizeText("Qarz saldosi"), amount: 0, change: null, tone: "neutral", caption: pickText("Backend ma'lumoti kutilmoqda", "Ожидаются данные backend", "Waiting for backend data") },
    ],
    trend: [],
    channels: [
      { key: "BANK", label: localizeText("Bank"), amount: 0, count: 0, share: 0 },
      { key: "CARD", label: localizeText("Karta"), amount: 0, count: 0, share: 0 },
      { key: "CASH", label: localizeText("Naqd"), amount: 0, count: 0, share: 0 },
    ],
    debtBuckets: [],
    topCategoriesDetailed: [],
    recentActivity: [],
    insights: [],
    sourceStatus: emptySourceStatus(),
    warnings: [],
    employeeCount: 0,
    collectionRatio: 0,
    totalReceivables: 0,
    totalPayables: 0,
    payrollDue: 0,
  }
}

export function adaptFinanceDashboard(response: FinanceDashboardResponse | undefined | null): FinanceDashboardModel | null {
  if (!response || !response.summary) return null

  try {
    const summary = response.summary
    const income = n(summary.income_total)
    const expense = n(summary.expense_total)
    const net = n(summary.net)
    const topCategoriesDetailed = buildTopCategories(response)
    const trend = buildTrend(response.activities, response.period.days)
    const channels = buildChannels(response.activities)
    const recentActivity = buildRecentActivity(response.activities)
    const totalReceivables = sumDebt(response.clientsDebts)
    const totalPayables = sumDebt(response.suppliersDebts)
    const clientTotal = sumTotal(response.clientsDebts)
    const collectionRatio = clientTotal > 0 ? (sumPaid(response.clientsDebts) / clientTotal) * 100 : 0
    const { payrollDue, pendingCount } = buildPayrollDue(response.employees, response.activities)
    const headlineMetrics = buildHeadlineMetrics(
      income,
      expense,
      net,
      totalReceivables,
      totalPayables,
      collectionRatio,
      trend
    )
    const insights = buildInsights(
      income,
      expense,
      net,
      collectionRatio,
      response.sourceStatus,
      response.employees.length,
      payrollDue
    )

    return {
      helloName: getUserName(),
      kpis: [
        {
          title: "Jami kirim",
          amount: income,
          deltaPercent: headlineMetrics[0]?.change ?? null,
          spark: trend.map((item) => item.income),
        },
        {
          title: "Jami xarajat",
          amount: expense,
          deltaPercent: headlineMetrics[1]?.change ?? null,
          spark: trend.map((item) => item.expense),
        },
      ],
      dissection: topCategoriesDetailed.slice(0, 8).map((item) => ({
        label: item.name,
        a: item.direction === "INCOME" ? item.amount : 0,
        b: item.direction === "EXPENSE" ? item.amount : 0,
      })),
      activeCards: [
        {
          name: "Sof oqim",
          masked: response.period.label,
          balance: net,
          brand: "CARD",
        },
        {
          name: "Mijozlar qarzi",
          masked: `${response.clientsDebts.length} ta`,
          balance: totalReceivables,
          brand: "CARD",
        },
      ],
      categories: topCategoriesDetailed.slice(0, 6).map((item) => ({
        name: item.name,
        percent: item.share,
      })),
      spending: response.suppliersDebts
        .slice()
        .sort((a, b) => n(b.debt) - n(a.debt))
        .slice(0, 5)
        .map((item) => ({
          name: s(item.supplier_name || `Supplier #${item.supplier_id ?? ""}`),
          percent:
            response.suppliersDebts.length > 0
              ? Math.round((n(item.debt) / Math.max(totalPayables, 1)) * 100)
              : 0,
        })),
      transactions: recentActivity.map((item) => ({
        id: item.id,
        title: item.title,
        dateLabel: item.dateLabel,
        amount: item.direction === "EXPENSE" ? -item.amount : item.amount,
      })),
      investments: response.clientsDebts
        .slice()
        .sort((a, b) => n(b.debt) - n(a.debt))
        .slice(0, 5)
        .map((item) => ({
          title: s(item.client_name || `Client #${item.client_id ?? ""}`),
          amount: n(item.debt),
          percent: n(item.total) > 0 ? Math.round((n(item.debt) / n(item.total)) * 100) : 0,
        })),
      incomeExpense: trend.map((item) => ({
        label: item.label,
        income: item.income,
        expense: item.expense,
      })),
      currency: s(summary.currency || "UZS"),
      rangeLabel: response.period.label,
      periodLabel: `${response.period.date_from} - ${response.period.date_to}`,
      generatedAtLabel: formatStamp(new Date()),
      headlineMetrics,
      trend,
      channels,
      debtBuckets: [
        {
          label: "Mijozlardan tushum",
          amount: totalReceivables,
          count: response.clientsDebts.filter((item) => n(item.debt) > 0).length,
          hint: "Undirilishi kutilayotgan summa",
          tone: "positive",
        },
        {
          label: "Supplier bosimi",
          amount: totalPayables,
          count: response.suppliersDebts.filter((item) => n(item.debt) > 0).length,
          hint: "To'lovga yaqin majburiyatlar",
          tone: "warning",
        },
        {
          label: "Payroll qoldig'i",
          amount: payrollDue,
          count: pendingCount,
          hint: "Joriy oy bo'yicha yopilmagan oyliklar",
          tone: payrollDue > 0 ? "critical" : "neutral",
        },
      ],
      topCategoriesDetailed,
      recentActivity,
      insights,
      sourceStatus: response.sourceStatus,
      warnings: response.warnings,
      employeeCount: response.employees.length,
      collectionRatio: Number(collectionRatio.toFixed(1)),
      totalReceivables,
      totalPayables,
      payrollDue,
    }
  } catch {
    return null
  }
}

export function ensureModel(m?: FinanceDashboardModel | null): FinanceDashboardModel {
  const empty = createEmptyFinanceDashboardModel()
  const x = m ?? ({} as FinanceDashboardModel)

  return {
    helloName: x.helloName ?? empty.helloName,
    kpis: Array.isArray(x.kpis) && x.kpis.length >= 2 ? x.kpis.slice(0, 2) : empty.kpis,
    dissection: Array.isArray(x.dissection) ? x.dissection : empty.dissection,
    activeCards: Array.isArray(x.activeCards) ? x.activeCards : empty.activeCards,
    categories: Array.isArray(x.categories) ? x.categories : empty.categories,
    spending: Array.isArray(x.spending) ? x.spending : empty.spending,
    transactions: Array.isArray(x.transactions) ? x.transactions : empty.transactions,
    investments: Array.isArray(x.investments) ? x.investments : empty.investments,
    incomeExpense: Array.isArray(x.incomeExpense) ? x.incomeExpense : empty.incomeExpense,
    currency: x.currency ?? empty.currency,
    rangeLabel: x.rangeLabel ?? empty.rangeLabel,
    periodLabel: x.periodLabel ?? empty.periodLabel,
    generatedAtLabel: x.generatedAtLabel ?? empty.generatedAtLabel,
    headlineMetrics:
      Array.isArray(x.headlineMetrics) && x.headlineMetrics.length ? x.headlineMetrics : empty.headlineMetrics,
    trend: Array.isArray(x.trend) && x.trend.length ? x.trend : empty.trend,
    channels: Array.isArray(x.channels) && x.channels.length ? x.channels : empty.channels,
    debtBuckets: Array.isArray(x.debtBuckets) && x.debtBuckets.length ? x.debtBuckets : empty.debtBuckets,
    topCategoriesDetailed:
      Array.isArray(x.topCategoriesDetailed) && x.topCategoriesDetailed.length
        ? x.topCategoriesDetailed
        : empty.topCategoriesDetailed,
    recentActivity:
      Array.isArray(x.recentActivity) && x.recentActivity.length ? x.recentActivity : empty.recentActivity,
    insights: Array.isArray(x.insights) && x.insights.length ? x.insights : empty.insights,
    sourceStatus:
      Array.isArray(x.sourceStatus) && x.sourceStatus.length ? x.sourceStatus : empty.sourceStatus,
    warnings: Array.isArray(x.warnings) ? x.warnings : empty.warnings,
    employeeCount: Number.isFinite(x.employeeCount) ? x.employeeCount : empty.employeeCount,
    collectionRatio: Number.isFinite(x.collectionRatio) ? x.collectionRatio : empty.collectionRatio,
    totalReceivables: Number.isFinite(x.totalReceivables) ? x.totalReceivables : empty.totalReceivables,
    totalPayables: Number.isFinite(x.totalPayables) ? x.totalPayables : empty.totalPayables,
    payrollDue: Number.isFinite(x.payrollDue) ? x.payrollDue : empty.payrollDue,
  }
}
