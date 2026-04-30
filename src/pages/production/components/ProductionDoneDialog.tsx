import React from "react"
import { toast } from "react-toastify"
import { useI18n } from "@/i18n"
import Portal from "@/pages/documents/components/Portal"
import type { LookupOption } from "../types/production.types"
import { toNumber } from "../utils/production.utils"

type SubmitPayload = {
  qty_actual?: string
  qty_waste?: string
  waste_location?: number
}

type Props = {
  open: boolean
  producedQty: string
  locations: LookupOption[]
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: SubmitPayload) => void | Promise<void>
}

export default function ProductionDoneDialog({ open, producedQty, locations, loading = false, onClose, onSubmit }: Props) {
  const { t } = useI18n()
  const [qtyActual, setQtyActual] = React.useState("")
  const [qtyWaste, setQtyWaste] = React.useState("")
  const [wasteLocation, setWasteLocation] = React.useState<number | "">("")

  React.useEffect(() => {
    if (!open) return
    setQtyActual(producedQty || "")
    setQtyWaste("0")
    setWasteLocation("")
  }, [open, producedQty])

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
    const nextActual = qtyActual.trim()
    const nextWaste = qtyWaste.trim()
    const actual = nextActual ? toNumber(nextActual, -1) : 0
    const waste = nextWaste ? toNumber(nextWaste, -1) : 0

    if ((nextActual && actual < 0) || (nextWaste && waste < 0)) {
      return toast.error(t("production.done.validation.nonNegative"))
    }

    await onSubmit({
      qty_actual: nextActual || undefined,
      qty_waste: nextWaste || undefined,
      waste_location: wasteLocation ? Number(wasteLocation) : undefined,
    })
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="close" disabled={loading} />

        <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(2,6,23,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="text-base font-semibold text-slate-900">{t("production.done.title")}</div>
              <div className="text-xs text-slate-500">{t("production.done.plan", undefined, { qty: producedQty })}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {loading ? t("production.dialog.saveLoading") : t("production.done.finish")}
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

          <div className="space-y-3 p-5">
            <div>
              <div className="mb-1 text-xs text-slate-500">{t("production.done.actualProduced")}</div>
              <input
                type="number"
                value={qtyActual}
                onChange={(e) => setQtyActual(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                min="0"
                step="0.000001"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-slate-500">{t("production.done.wasteQty")}</div>
              <input
                type="number"
                value={qtyWaste}
                onChange={(e) => setQtyWaste(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                min="0"
                step="0.000001"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-slate-500">{t("production.done.wasteLocation")}</div>
              <select
                value={String(wasteLocation)}
                onChange={(e) => setWasteLocation(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">{t("production.done.select")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
