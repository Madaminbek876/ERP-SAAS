export type EntryType = "INCOME" | "EXPENSE" | "ADJUSTMENT"
export type PaymentMethod = "BANK" | "CARD" | "CASH"
export type Currency = "UZS" | "USD" | "EUR" | "RUB"

export type FinanceEntry = {
  id: string
  date: string
  createdAt?: string
  updatedAt?: string
  entryType: EntryType
  category: string
  amount: number
  currency: Currency
  paymentMethod: PaymentMethod
  referenceType?: string
  referenceId?: string | null
  reference?: string | null
  notes?: string | null
}

export type Employee = {
  id: string
  fullName: string
  role: string
  phone?: string
  baseSalary: number
  currency: Currency
}

export type ExchangeRate = {
  id: string
  currency: Currency
  rate: number
  date: string
  source?: string
  status: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type ExchangeRateInput = {
  currency: Currency
  rate: number
  date: string
  source?: string
}
