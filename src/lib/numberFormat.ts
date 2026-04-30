export function formatNumberWithSpaces(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return ""
    const [integerPart, decimalPart] = String(value).split(".")
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }

  const normalized = String(value).trim().replace(/\u00A0/g, " ").replace(/\s+/g, "")
  if (!normalized) return ""

  const sign = normalized.startsWith("-") ? "-" : ""
  const unsigned = sign ? normalized.slice(1) : normalized
  const [integerRaw, decimalRaw = ""] = unsigned.split(/[.,]/, 2)
  const integerDigits = integerRaw.replace(/\D/g, "")
  const decimalDigits = decimalRaw.replace(/\D/g, "")
  if (!integerDigits && !decimalDigits) return ""

  const formattedInteger = (integerDigits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${sign}${formattedInteger}${decimalDigits ? `.${decimalDigits}` : ""}`
}

export function formatIntegerInput(value: string): string {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return ""
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

export function parseIntegerInput(value: string): number | null {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return null
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : null
}
