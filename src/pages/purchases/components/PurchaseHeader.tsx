import { Button } from "@/components/ui/button"
import type { PaymentStatus, PurchaseStatus } from "../types"
import { useI18n } from "@/i18n"

function fmtMoney(amount: number) {
  const raw = String(Math.trunc(Number(amount || 0)))
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

function badgeClass(type: "status" | "payment", value?: string) {
  if (type === "status") {
    if (value === "CONFIRMED") return "bg-emerald-50 text-emerald-700 border-emerald-200"
    if (value === "CANCELLED") return "bg-rose-50 text-rose-700 border-rose-200"
    return "bg-slate-50 text-slate-700 border-slate-200"
  }
  if (value === "PAID") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "PARTIAL") return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

export default function PurchaseHeader({
  title,
  loading,
  status,
  paymentStatus,
  updatedAt,
  total,
  paidAmount,
  remainingAmount,
  currency,
  canConfirm,
  onClose,
  onRefresh,
  onConfirm,
  onCancel,
  onExport,
  onDelete,
  exportLoading = false,
  deleteLoading = false,
  canDelete = false,
}: {
  title: string
  loading: boolean
  status?: PurchaseStatus
  paymentStatus?: PaymentStatus
  updatedAt?: string
  total: number
  paidAmount: number
  remainingAmount: number
  currency?: string
  canConfirm: boolean
  onClose: () => void
  onRefresh: () => void
  onConfirm: () => void
  onCancel: () => void
  onExport?: () => void
  onDelete?: () => void
  exportLoading?: boolean
  deleteLoading?: boolean
  canDelete?: boolean
}) {
  const { language } = useI18n()
  const isDraft = status === "DRAFT"
  const isConfirmed = status === "CONFIRMED"
  const copy =
    language === "ru"
      ? {
          loading: "Загрузка...",
          total: "Итого",
          paid: "Оплачено",
          remaining: "Остаток",
          updated: "Последнее изменение",
          refresh: "Обновить",
          confirm: "Подтвердить",
          cancel: "Отменить",
          close: "Закрыть",
          confirmHint: "Для подтверждения нужны локация и позиции",
        }
      : language === "en"
        ? {
            loading: "Loading...",
            total: "Total",
            paid: "Paid",
            remaining: "Remaining",
            updated: "Last updated",
            refresh: "Refresh",
            confirm: "Confirm",
            cancel: "Cancel",
            close: "Close",
            confirmHint: "Location and items are required for confirmation",
          }
        : {
            loading: "Yuklanmoqda...",
            total: "Umumiy",
            paid: "To'langan",
            remaining: "Qoldiq",
            updated: "Oxirgi o'zgarish",
            refresh: "Yangilash",
            confirm: "Tasdiqlash",
            cancel: "Bekor qilish",
            close: "Yopish",
            confirmHint: "Tasdiqlash uchun ombor va nomenklaturalar kerak",
          }
  const exportLabel = language === "ru" ? "Excel eksport" : language === "en" ? "Export Excel" : "Excel eksport"
  const deleteLabel = language === "ru" ? "O'chirish" : language === "en" ? "Delete" : "O'chirish"
  const statusLabel =
    status === "CONFIRMED"
      ? language === "ru"
        ? "Подтверждено"
        : language === "uz"
          ? "Tasdiqlangan"
          : "CONFIRMED"
      : status === "CANCELLED"
        ? language === "ru"
          ? "Отменено"
          : language === "uz"
            ? "Bekor qilingan"
            : "CANCELLED"
        : status === "DRAFT"
          ? language === "ru"
            ? "Черновик"
            : language === "uz"
              ? "Qoralama"
              : "DRAFT"
          : status ?? "-"
  const paymentLabel =
    paymentStatus === "PAID"
      ? language === "ru"
        ? "Оплачено"
        : language === "uz"
          ? "To'langan"
          : "PAID"
      : paymentStatus === "PARTIAL"
        ? language === "ru"
          ? "Частично оплачено"
          : language === "uz"
            ? "Qisman to'langan"
            : "PARTIAL"
        : paymentStatus === "UNPAID"
          ? language === "ru"
            ? "Не оплачено"
            : language === "uz"
              ? "To'lanmagan"
              : "UNPAID"
          : paymentStatus ?? "-"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass("status", status)].join(" ")}>
              {statusLabel}
            </span>
            <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass("payment", paymentStatus)].join(" ")}>
              {paymentLabel}
            </span>
            {loading && <span className="text-xs text-slate-500">{copy.loading}</span>}
          </div>

          <div className="mt-2 text-xs text-slate-500">
            {copy.total}: <b>{fmtMoney(total)} {currency || "UZS"}</b> | {copy.paid}: <b>{fmtMoney(paidAmount)} {currency || "UZS"}</b> | {copy.remaining}: <b>{fmtMoney(remainingAmount)} {currency || "UZS"}</b>
          </div>
          {updatedAt && <div className="mt-1 text-xs text-slate-500">{copy.updated}: {new Date(updatedAt).toLocaleString("ru-RU")}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="!bg-gradient-to-r from-blue-900 to-blue-700 text-white cursor-pointer rounded-2xl" onClick={onRefresh}>
            {copy.refresh}
          </Button>
          {onExport ? (
            <Button
              variant="outline"
              className="rounded-2xl border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
              onClick={onExport}
              disabled={exportLoading}
            >
              {exportLoading ? copy.loading : exportLabel}
            </Button>
          ) : null}
          <Button className="bg-gradient-to-r from-blue-900 to-blue-700 text-white cursor-pointer rounded-2xl" onClick={onConfirm} disabled={!isDraft || !canConfirm} title={!canConfirm ? copy.confirmHint : ""}>
            {copy.confirm}
          </Button>
          <Button variant="secondary" className="!bg-gradient-to-r from-blue-900 to-blue-700 text-white cursor-pointer rounded-2xl" onClick={onCancel} disabled={!isDraft && !isConfirmed}>
            {copy.cancel}
          </Button>
          {onDelete ? (
            <Button variant="destructive" className="cursor-pointer rounded-2xl" onClick={onDelete} disabled={!canDelete || deleteLoading}>
              {deleteLoading ? copy.loading : deleteLabel}
            </Button>
          ) : null}
          <Button variant="outline" className="rounded-2xl !bg-gradient-to-r from-blue-900 to-blue-700 text-white cursor-pointer" onClick={onClose}>
            {copy.close}
          </Button>
        </div>
      </div>
      <div className="h-px bg-slate-200" />
    </div>
  )
}
