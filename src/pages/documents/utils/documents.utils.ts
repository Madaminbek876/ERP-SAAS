import { localizeText } from "@/i18n"
import type { DocumentStatus, DocumentType, RefType } from "../types/documents.types"

const docTypeBase: Record<DocumentType, string> = {
  INVOICE: "Hisob-faktura",
  CONTRACT: "Shartnoma",
  ACT: "Dalolatnoma (Akt)",
  PAYMENT_ORDER: "To'lov topshirig'i",
  DELIVERY_NOTE: "Yuk xati",
  INVENTORY_ACT: "Inventarizatsiya akti",
  PRODUCTION_REPORT: "Ishlab chiqarish hisobot",
  OTHER: "Boshqa",
}

const docStatusBase: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  SIGNED: "Imzolangan",
  PAID: "To'langan",
  CANCELED: "Bekor qilingan",
  ARCHIVED: "Arxiv",
}

const refTypeBase: Record<RefType, string> = {
  ORDER: "Buyurtma",
  PURCHASE: "Xarid",
  PRODUCTION: "Ishlab chiqarish",
  WAREHOUSE: "Ombor",
  FINANCE: "Moliya",
  MANUAL: "Manual",
}

export const docTypeLabel = new Proxy(docTypeBase, {
  get(target, prop: string) {
    return localizeText(target[prop as DocumentType] ?? prop)
  },
}) as Record<DocumentType, string>

export const docStatusLabel = new Proxy(docStatusBase, {
  get(target, prop: string) {
    return localizeText(target[prop as DocumentStatus] ?? prop)
  },
}) as Record<DocumentStatus, string>

export const refTypeLabel = new Proxy(refTypeBase, {
  get(target, prop: string) {
    return localizeText(target[prop as RefType] ?? prop)
  },
}) as Record<RefType, string>

export function statusChipClass(status: DocumentStatus) {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700 border border-slate-200"
    case "SIGNED":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200"
    case "PAID":
      return "bg-indigo-50 text-indigo-700 border border-indigo-200"
    case "CANCELED":
      return "bg-rose-50 text-rose-700 border border-rose-200"
    case "ARCHIVED":
      return "bg-amber-50 text-amber-800 border border-amber-200"
  }
}
