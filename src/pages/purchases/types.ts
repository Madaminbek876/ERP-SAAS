export type CurrencyCode = "UZS" | "USD" | string
export type PurchaseStatus = "DRAFT" | "CONFIRMED" | "CANCELLED"
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | string

export type PurchaseBase = {
  id: number
  purchase_no: string
  supplier?: number | null
  supplier_name: string | null
  received_date: string | null
  produced_date: string | null
  delivery_company: string | null
  location?: number | null
  location_name: string | null
  notes: string | null
  status: PurchaseStatus
  currency: CurrencyCode
  subtotal: number
  total: number
  remaining_amount: number
  payment_status: PaymentStatus
  paid_amount: number
  confirmed_at: string | null
  cancelled_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type PurchaseListItem = PurchaseBase

export type PurchaseItem = {
  id: number
  raw_material?: number | null
  raw_material_name: string
  qty: string
  unit_price: number
  line_subtotal: number
  line_total: number
}

export type PurchasePayment = {
  id: number
  method: string
  amount: number
  currency: CurrencyCode
  paid_at: string
  note: string | null
}

export type PurchaseDetail = PurchaseBase & {
  items: PurchaseItem[]
  payments: PurchasePayment[]
}

export type ChoiceValue = string | { value: string; label?: string } | [string, string]

export type PurchasesMeta = {
  currency_choices: ChoiceValue[]
  payment_method_choices: ChoiceValue[]
  purchase_status_choices: ChoiceValue[]
}

export type PageResponse<T> = {
  results: T[]
  count: number
  next: string | null
  previous: string | null
}
