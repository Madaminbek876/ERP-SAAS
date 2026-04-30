import { generateBarcodeValue, sanitizeBarcodeInput } from "@/lib/barcode"
import { http } from "@/shared/http"

type BarcodeQueryValue = number | string | null | undefined

export type BarcodeLookupProduct = {
  id: number
  name: string
  barcode: string | null
}

const PRODUCTS_ENDPOINT = "/api/v1/catalog/products/"

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function pickNestedRow(data: any): any {
  if (!data) return null

  if (Array.isArray(data)) return data[0] ?? null
  if (Array.isArray(data?.results)) return data.results[0] ?? null
  if (Array.isArray(data?.items)) return data.items[0] ?? null
  if (Array.isArray(data?.data)) return data.data[0] ?? null
  if (data?.data && typeof data.data === "object") return pickNestedRow(data.data)
  if (data?.result && typeof data.result === "object") return pickNestedRow(data.result)
  if (typeof data === "object") return data

  return null
}

function normalizeLookupProduct(data: any, targetBarcode: string): BarcodeLookupProduct | null {
  const rows = [
    pickNestedRow(data),
    ...(Array.isArray(data?.results) ? data.results : []),
    ...(Array.isArray(data) ? data : []),
  ].filter(Boolean)

  const preferred =
    rows.find((row) => sanitizeBarcodeInput(String(row?.barcode ?? row?.code ?? "")) === targetBarcode) ?? rows[0]

  if (!preferred || typeof preferred !== "object") return null

  const id = Number(preferred?.id ?? preferred?.product_id ?? preferred?.product?.id ?? 0)
  const name = String(
    preferred?.name ??
      preferred?.product_name ??
      preferred?.product?.name ??
      preferred?.title ??
      ""
  ).trim()
  const barcode = sanitizeBarcodeInput(
    String(preferred?.barcode ?? preferred?.code ?? preferred?.product?.barcode ?? preferred?.product?.code ?? "")
  )

  if (!id && !name && !barcode) return null

  return {
    id,
    name: name || `Product #${id || "-"}`,
    barcode: barcode || null,
  }
}

export const barcodeApi = {
  async generate(category?: BarcodeQueryValue) {
    void toNullableNumber(category)
    return generateBarcodeValue()
  },

  async scan(input: string) {
    const barcode = sanitizeBarcodeInput(input)
    if (!barcode) return null

    const data = await http.get<any>(PRODUCTS_ENDPOINT, { search: barcode, page: 1, page_size: 20 })
    const product = normalizeLookupProduct(data, barcode)
    if (product?.barcode === barcode) return product

    return null
  },
}
