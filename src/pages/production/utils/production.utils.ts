import { getCurrentLocale, translate } from "@/i18n"
import type { ChoiceOption, ProductionPreviewMissing, ProductionStatus } from "../types/production.types"

export function normalizeProductionStatus(value: unknown, fallback: ProductionStatus = "DRAFT"): ProductionStatus {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")

  if (raw === "DRAFT") return "DRAFT"
  if (raw === "CONFIRMED") return "CONFIRMED"
  if (raw === "IN_PROGRESS" || raw === "INPROGRESS" || raw === "STARTED") return "IN_PROGRESS"
  if (raw === "DONE" || raw === "COMPLETED" || raw === "FINISHED" || raw === "CLOSED") return "DONE"
  if (raw === "CANCELLED" || raw === "CANCELED") return "CANCELLED"
  return fallback
}

export function getFallbackStatusChoices(): ChoiceOption[] {
  return [
    { value: "DRAFT", label: translate("production.status.DRAFT", "Draft") },
    { value: "CONFIRMED", label: translate("production.status.CONFIRMED", "Tasdiqlangan") },
    { value: "IN_PROGRESS", label: translate("production.status.IN_PROGRESS", "Jarayonda") },
    { value: "DONE", label: translate("production.status.DONE", "Yakunlangan") },
    { value: "CANCELLED", label: translate("production.status.CANCELLED", "Bekor qilingan") },
  ]
}

const PRODUCTION_STATUS_SET = new Set<ProductionStatus>(["DRAFT", "CONFIRMED", "IN_PROGRESS", "DONE", "CANCELLED"])

export function normalizeStatusChoices(choices: ChoiceOption[]) {
  return choices.map((choice) => {
    const value = String(choice.value ?? "").trim().toUpperCase()
    if (!PRODUCTION_STATUS_SET.has(value as ProductionStatus)) return choice

    return {
      ...choice,
      value,
      label: translate(`production.status.${value}`, choice.label || value),
    }
  })
}

export const FALLBACK_CURRENCY_CHOICES: ChoiceOption[] = [{ value: "UZS", label: "UZS" }]

export function getStatusLabel(status: ProductionStatus) {
  return translate(`production.status.${status}`, status)
}

export function statusChipClass(status: ProductionStatus) {
  switch (status) {
    case "CONFIRMED":
      return "bg-slate-100 text-slate-700 border border-slate-200"
    case "IN_PROGRESS":
      return "bg-blue-50 text-blue-700 border border-blue-200"
    case "DONE":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200"
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border border-rose-200"
    default:
      return "bg-amber-50 text-amber-700 border border-amber-200"
  }
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function toDecimalString(value: unknown, fractionDigits = 6) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(fractionDigits) : Number(0).toFixed(fractionDigits)
}

export function formatQty(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return String(value ?? "0")
  return parsed.toLocaleString(getCurrentLocale(), { maximumFractionDigits: 6 })
}

export function formatMoney(value: unknown, currency = "UZS") {
  const parsed = Number(value)
  const amount = Number.isFinite(parsed) ? parsed : 0
  return `${amount.toLocaleString(getCurrentLocale())} ${currency}`
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(getCurrentLocale())
}

export function formatBatchNumber(value?: string | null, fallbackId?: number | string) {
  const source = String(value ?? "").trim()
  const digits = source.replace(/\D+/g, "")
  const prefix = "\u2116"

  if (digits) return `${prefix}${String(Number(digits))}`
  if (fallbackId !== undefined && fallbackId !== null) return `${prefix}${fallbackId}`
  return `${prefix}-`
}

export function extractApiErrorMessage(error: any, fallback: string) {
  const missingRows = Array.isArray(error?.response?.data?.missing) ? error.response.data.missing : []
  const missingMessage =
    missingRows.length > 0
      ? missingRows
          .map((item: any) => {
            const name = String(
              item?.raw_material_name ??
                item?.material_name ??
                `${translate("production.view.rawMaterial", "Xomashyo")} #${item?.raw_material_id ?? item?.raw_material ?? "-"}`
            )
            const required = item?.qty_required ?? item?.required_qty ?? item?.required ?? item?.qty_needed ?? item?.need ?? 0
            const available = item?.qty_available ?? item?.available_qty ?? item?.available ?? item?.have ?? 0
            const shortfall = item?.shortfall ?? item?.shortage ?? item?.missing_qty ?? Number(required) - Number(available)
            return translate("production.error.missingItem", undefined, {
              name,
              required: formatQty(required),
              available: formatQty(available),
              shortfall: formatQty(shortfall),
            })
          })
          .join(" | ")
      : ""

  const detail = error?.response?.data?.detail
  if (typeof detail === "string" && detail.trim()) {
    return missingMessage ? `${detail} | ${missingMessage}` : detail
  }

  const data = error?.response?.data
  if (data && typeof data === "object") {
    const chunks: string[] = []
    for (const [field, value] of Object.entries(data)) {
      if (field === "detail") continue
      if (Array.isArray(value) && value.length > 0) {
        chunks.push(`${field}: ${value.map((item) => String(item)).join(", ")}`)
        continue
      }
      if (typeof value === "string" && value.trim()) {
        chunks.push(`${field}: ${value}`)
      }
    }
    if (chunks.length > 0) return chunks.join(" | ")
  }

  return String(error?.message || fallback)
}

export function describeMissingItem(item: ProductionPreviewMissing) {
  const name = item.raw_material_name || `${translate("production.view.rawMaterial", "Xomashyo")} #${item.raw_material ?? "-"}`
  return translate("production.error.missingItem", undefined, {
    name,
    required: formatQty(item.qty_required),
    available: formatQty(item.qty_available),
    shortfall: formatQty(item.shortfall),
  })
}
