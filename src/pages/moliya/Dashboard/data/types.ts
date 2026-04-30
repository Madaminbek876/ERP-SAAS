export type RangeKey = "OXIRGI_OY" | "HAFTA" | "BUGUN" | "YIL"

export type Kpi = {
  title: string
  amount: number
  deltaPercent?: number | null
  spark: number[]
}

export type DissectionPoint = {
  label: string
  a: number
  b: number
}

export type ActiveCard = {
  name: string
  masked: string
  balance: number
  brand: "VISA" | "MASTERCARD" | "HUMO" | "UZCARD" | "CARD"
}

export type CategorySlice = { name: string; percent: number }

export type SpendingParam = { name: string; percent: number }

export type TxRow = { id: string; title: string; dateLabel: string; amount: number }

export type InvestmentRow = { title: string; amount: number; percent: number }

export type IncomeExpensePoint = { label: string; income: number; expense: number }

export type DashboardTone = "positive" | "warning" | "critical" | "neutral"

export type FinanceHeadlineMetric = {
  label: string
  amount: number
  change?: number | null
  tone: DashboardTone
  caption: string
}

export type FinanceTrendPoint = {
  label: string
  income: number
  expense: number
  net: number
}

export type FinanceChannel = {
  key: "BANK" | "CARD" | "CASH"
  label: string
  amount: number
  count: number
  share: number
}

export type FinanceDebtBucket = {
  label: string
  amount: number
  count: number
  hint: string
  tone: DashboardTone
}

export type FinanceCategoryRow = {
  name: string
  amount: number
  share: number
  direction: "INCOME" | "EXPENSE"
}

export type FinanceActivityRow = {
  id: string
  title: string
  subtitle: string
  amount: number
  direction: "INCOME" | "EXPENSE"
  method: string
  dateLabel: string
  source: "LEDGER" | "PAYMENT"
}

export type FinanceInsight = {
  title: string
  value: string
  description: string
  tone: DashboardTone
}

export type FinanceSourceStatus = {
  key: string
  label: string
  ok: boolean
}

export type FinanceDashboardModel = {
  helloName: string
  kpis: Kpi[]
  dissection: DissectionPoint[]
  activeCards: ActiveCard[]
  categories: CategorySlice[]
  spending: SpendingParam[]
  transactions: TxRow[]
  investments: InvestmentRow[]
  incomeExpense: IncomeExpensePoint[]
  currency: string
  rangeLabel: string
  periodLabel: string
  generatedAtLabel: string
  headlineMetrics: FinanceHeadlineMetric[]
  trend: FinanceTrendPoint[]
  channels: FinanceChannel[]
  debtBuckets: FinanceDebtBucket[]
  topCategoriesDetailed: FinanceCategoryRow[]
  recentActivity: FinanceActivityRow[]
  insights: FinanceInsight[]
  sourceStatus: FinanceSourceStatus[]
  warnings: string[]
  employeeCount: number
  collectionRatio: number
  totalReceivables: number
  totalPayables: number
  payrollDue: number
}
