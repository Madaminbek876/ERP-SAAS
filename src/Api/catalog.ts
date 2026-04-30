import { api } from "@/lib/api"
import { unwrapResults } from "@/lib/unwrap"

export type Product = {
  id: number
  name: string
  category: number | null
  category_name: string | null
  uom: number
  uom_name: string
  default_selling_price: number | null
  currency: string
  nds_applies?: boolean
  nds_rate?: string
  nds_included?: boolean
  created_at?: string
}

export type Uom = {
  id: number
  code: string
  name: string
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeProduct(row: any): Product {
  return {
    id: Number(row?.id ?? 0),
    name: String(row?.name ?? ""),
    category: toNullableNumber(row?.category),
    category_name: row?.category_name ? String(row.category_name) : null,
    uom: Number(row?.uom ?? 0),
    uom_name: String(row?.uom_name ?? ""),
    default_selling_price: toNullableNumber(row?.default_selling_price ?? row?.selling_price),
    currency: String(row?.currency ?? "UZS"),
    nds_applies: row?.nds_applies === undefined ? undefined : Boolean(row.nds_applies),
    nds_rate: row?.nds_rate ? String(row.nds_rate) : undefined,
    nds_included: row?.nds_included === undefined ? undefined : Boolean(row.nds_included),
    created_at: row?.created_at ? String(row.created_at) : undefined,
  }
}

function normalizeUom(row: any): Uom {
  return {
    id: Number(row?.id ?? row?.value ?? 0),
    code: String(row?.code ?? ""),
    name: String(row?.name ?? row?.label ?? row?.title ?? ""),
  }
}

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await api.get("/api/v1/catalog/products/")
  return unwrapResults<any>(data).map(normalizeProduct)
}

export async function fetchUoms(): Promise<Uom[]> {
  const { data } = await api.get("/api/v1/dicts/uom/")
  return unwrapResults<any>(data).map(normalizeUom).filter((row) => row.id > 0)
}
