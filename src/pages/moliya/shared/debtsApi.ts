import { http } from "@/shared/http"

type FinanceDebtPartyRef = { id?: number | string } | number | string

type FinanceDebtRowInput = {
  id?: number | string
  client_id?: number | string
  client_name?: string
  supplier_id?: number | string
  supplier_name?: string
  client?: FinanceDebtPartyRef
  supplier?: FinanceDebtPartyRef
  total?: number
  paid?: number
  debt?: number
  prepayment_total?: number
  prepayment?: number
  pre_paid?: number
  advance_paid?: number
  new_order_total?: number
  new_orders_total?: number
  current_order_total?: number
}

type FinanceDebtListResponse = {
  count?: number
  next?: string | null
  previous?: string | null
  rows?: FinanceDebtRowInput[]
  results?: FinanceDebtRowInput[]
}

export type FinanceDebtPartyApiRow = {
  id?: number | string
  client_id?: number | string
  client_name?: string
  supplier_id?: number | string
  supplier_name?: string
  client?: FinanceDebtPartyRef
  supplier?: FinanceDebtPartyRef
  total: number
  paid: number
  debt: number
  prepayment_total?: number
  prepayment?: number
  pre_paid?: number
  advance_paid?: number
  new_order_total?: number
  new_orders_total?: number
  current_order_total?: number
}

function toNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function normalizeFinanceDebtRow(row: FinanceDebtRowInput | null | undefined): FinanceDebtPartyApiRow {
  const total = toNumber(row?.total)
  const paid = toNumber(row?.paid)
  const normalizedDebt = row?.debt === undefined ? Math.max(total - paid, 0) : toNumber(row.debt)

  return {
    id: row?.id,
    client_id: row?.client_id,
    client_name: typeof row?.client_name === "string" ? row.client_name : undefined,
    supplier_id: row?.supplier_id,
    supplier_name: typeof row?.supplier_name === "string" ? row.supplier_name : undefined,
    client: row?.client,
    supplier: row?.supplier,
    total,
    paid,
    debt: normalizedDebt,
    prepayment_total: row?.prepayment_total === undefined ? undefined : toNumber(row.prepayment_total),
    prepayment: row?.prepayment === undefined ? undefined : toNumber(row.prepayment),
    pre_paid: row?.pre_paid === undefined ? undefined : toNumber(row.pre_paid),
    advance_paid: row?.advance_paid === undefined ? undefined : toNumber(row.advance_paid),
    new_order_total: row?.new_order_total === undefined ? undefined : toNumber(row.new_order_total),
    new_orders_total: row?.new_orders_total === undefined ? undefined : toNumber(row.new_orders_total),
    current_order_total: row?.current_order_total === undefined ? undefined : toNumber(row.current_order_total),
  }
}

function ensureDebtEndpointVariants(input: string | string[]) {
  const source = Array.isArray(input) ? input : [input]
  const variants: string[] = []

  source.forEach((rawValue) => {
    const value = String(rawValue || "").trim()
    if (!value) return
    if (value.endsWith("/")) {
      variants.push(value, value.slice(0, -1))
      return
    }
    variants.push(`${value}/`, value)
  })

  return Array.from(new Set(variants))
}

export function normalizeFinanceDebtRows(value: FinanceDebtListResponse | FinanceDebtRowInput[] | null | undefined) {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(value?.rows)
      ? value.rows
      : Array.isArray(value?.results)
        ? value.results
        : []

  return rows.map((row) => normalizeFinanceDebtRow(row))
}

async function fetchFinanceDebtPages(endpoint: string) {
  const rows: FinanceDebtPartyApiRow[] = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const response = await http.get<FinanceDebtListResponse | FinanceDebtRowInput[]>(endpoint, { page })
    const pageRows = normalizeFinanceDebtRows(response)
    rows.push(...pageRows)

    if (Array.isArray(response) || !response?.next || pageRows.length === 0) {
      hasNext = false
      continue
    }

    page += 1
  }

  return rows
}

export async function fetchAllFinanceDebtRows(input: string | string[]) {
  const endpoints = ensureDebtEndpointVariants(input)
  let lastNotFoundError: unknown = null

  for (const endpoint of endpoints) {
    try {
      return await fetchFinanceDebtPages(endpoint)
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error !== null && "response" in error
          ? Number((error as { response?: { status?: unknown } }).response?.status || 0)
          : 0

      if (status && status !== 404) throw error
      lastNotFoundError = error
    }
  }

  if (lastNotFoundError) throw lastNotFoundError
  return []
}
