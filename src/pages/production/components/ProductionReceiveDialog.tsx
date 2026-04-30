import Portal from "@/pages/documents/components/Portal"
import React from "react"
import { useI18n } from "@/i18n"

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (qty: number) => void
}

export default function ProductionReceiveDialog({ open, onClose, onSubmit }: Props) {
  const { language } = useI18n()
  const [qty, setQty] = React.useState<number>(1)
  const copy =
    language === "ru"
      ? {
          qtyError: "Количество должно быть положительным целым числом",
          title: "Приход готовой продукции",
          subtitle: "Демо: добавление на склад",
          receive: "Принять",
          close: "Закрыть",
          qty: "Количество",
        }
      : language === "en"
        ? {
            qtyError: "Quantity must be a positive integer",
            title: "Finished goods receipt",
            subtitle: "Demo: add to warehouse",
            receive: "Receive",
            close: "Close",
            qty: "Qty",
          }
        : {
            qtyError: "Miqdor musbat butun son bo'lsin",
            title: "Tayyor mahsulot kirimi",
            subtitle: "Demo: omborga plus",
            receive: "Qabul qilish",
            close: "Yopish",
            qty: "Miqdor",
          }
  React.useEffect(() => {
    if (!open) return
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
    if (!Number.isInteger(qty) || qty <= 0) return alert(copy.qtyError)
    onSubmit(Number(qty))
  }
  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="close" />
        <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(2,6,23,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><div className="text-base font-semibold text-slate-900">{copy.title}</div><div className="text-xs text-slate-500">{copy.subtitle}</div></div>
            <div className="flex items-center gap-2">
              <button onClick={submit} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95">{copy.receive}</button>
              <button onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">{copy.close}</button>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-1 text-xs text-slate-500">{copy.qty}</div>
            <input type="number" value={qty} onChange={(e) => setQty(Math.trunc(Number(e.target.value)))} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" min={1} step={1} />
          </div>
        </div>
      </div>
    </Portal>
  )
}
