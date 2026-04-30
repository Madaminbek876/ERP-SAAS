import React from "react"
import { useI18n } from "@/i18n"
import Portal from "@/pages/documents/components/Portal"

type Props = {
  open: boolean
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: { reason?: string }) => void | Promise<void>
}

export default function ProductionCancelDialog({ open, loading = false, onClose, onSubmit }: Props) {
  const { t } = useI18n()
  const [reason, setReason] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setReason("")
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose, loading])

  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const submit = async () => {
    const nextReason = reason.trim()
    await onSubmit(nextReason ? { reason: nextReason } : {})
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="close" disabled={loading} />

        <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(2,6,23,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="text-base font-semibold text-slate-900">{t("production.cancel.title")}</div>
              <div className="text-xs text-slate-500">{t("production.cancel.subtitle")}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {loading ? t("production.dialog.saveLoading") : t("production.cancel.confirm")}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-60 hover:bg-slate-50"
              >
                {t("production.dialog.close")}
              </button>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-1 text-xs text-slate-500">{t("production.cancel.reason")}</div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              placeholder={t("production.cancel.placeholder")}
            />
          </div>
        </div>
      </div>
    </Portal>
  )
}
