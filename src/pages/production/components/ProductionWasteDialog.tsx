import Portal from "@/pages/documents/components/Portal"
import React from "react"
import { useI18n } from "@/i18n"

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (line: { reason: string; qty: number }) => void
}

export default function ProductionWasteDialog({ open, onClose, onSubmit }: Props) {
  const { language } = useI18n()
  const [reason, setReason] = React.useState("")
  const [qty, setQty] = React.useState<number>(1)
  const copy =
    language === "ru"
      ? {
          reasonError: "Введите причину",
          qtyError: "Количество должно быть положительным целым числом",
          title: "Брак / Потери",
          subtitle: "Демо: записывается в статистику",
          add: "Добавить",
          close: "Закрыть",
          reason: "Причина",
          reasonPlaceholder: "Например: Брак (швейный)",
          qty: "Количество",
        }
      : language === "en"
        ? {
            reasonError: "Enter a reason",
            qtyError: "Quantity must be a positive integer",
            title: "Waste / Loss",
            subtitle: "Demo: written to statistics",
            add: "Add",
            close: "Close",
            reason: "Reason",
            reasonPlaceholder: "For example: Defect (sewing)",
            qty: "Qty",
          }
        : {
            reasonError: "Sabab kiriting",
            qtyError: "Miqdor musbat butun son bo'lsin",
            title: "Brak / Yo'qotish",
            subtitle: "Demo: statistikaga yoziladi",
            add: "Qo'shish",
            close: "Yopish",
            reason: "Sabab",
            reasonPlaceholder: "Masalan: Brak (tikuv)",
            qty: "Miqdor",
          }
  React.useEffect(() => {
    if (!open) return
    setReason("")
    setQty(1)
  }, [open])
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  const submit = () => {
    if (!reason.trim()) return alert(copy.reasonError)
    if (!Number.isInteger(qty) || qty <= 0) return alert(copy.qtyError)
    onSubmit({ reason: reason.trim(), qty: Number(qty) })
  }
  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="close" />
        <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(2,6,23,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><div className="text-base font-semibold text-slate-900">{copy.title}</div><div className="text-xs text-slate-500">{copy.subtitle}</div></div>
            <div className="flex items-center gap-2">
              <button onClick={submit} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95">{copy.add}</button>
              <button onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">{copy.close}</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5">
            <div>
              <div className="mb-1 text-xs text-slate-500">{copy.reason}</div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder={copy.reasonPlaceholder} />
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-500">{copy.qty}</div>
              <input type="number" value={qty} onChange={(e) => setQty(Math.trunc(Number(e.target.value)))} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" min={1} step={1} />
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
