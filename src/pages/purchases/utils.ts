export function formatPurchaseNumber(value: string | null | undefined, fallbackId?: number | string) {
  const source = String(value ?? "").trim()
  const digits = source.replace(/\D+/g, "")
  const prefix = "\u2116"

  if (digits) return `${prefix}${String(Number(digits))}`
  if (fallbackId !== undefined && fallbackId !== null) return `${prefix}${fallbackId}`
  return `${prefix}-`
}
