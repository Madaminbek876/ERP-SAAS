import Portal from "@/pages/documents/components/Portal"
import React from "react"
import { useI18n } from "@/i18n"

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (line: { name: string; uom: string; qty: number; unitCostUZS: number }) => void
}

export default function ProductionConsumeDialog({ open, onClose, onSubmit }: Props) {
  const { language } = useI18n()
  const [name, setName] = React.useState("")
  const [uom, setUom] = React.useState("kg")
  const [qty, setQty] = React.useState<number>(1)
  const [unitCostUZS, setUnitCostUZS] = React.useState<number>(1000)
  const copy =
    language === "ru"
      ? {
          nameError: "Введите название материала",
          qtyError: "Количество должно быть положительным целым числом",
          priceError: "Цена не может быть меньше 0",
          title: "Списание материала",
          subtitle: "Демо: списание со склада",
          add: "Добавить",
          close: "Закрыть",
          material: "Материал",
          materialPlaceholder: "Например: Ткань (серая)",
          uom: "Ед. изм.",
          uomPlaceholder: "кг/м/шт",
          qty: "Количество",
          price: "Цена (UZS)",
        }
      : language === "en"
        ? {
            nameError: "Enter material name",
            qtyError: "Quantity must be a positive integer",
            priceError: "Price cannot be below 0",
            title: "Material consumption",
            subtitle: "Demo: subtract from warehouse",
            add: "Add",
            close: "Close",
            material: "Material",
            materialPlaceholder: "For example: Fabric (gray)",
            uom: "UOM",
            uomPlaceholder: "kg/m/pcs",
            qty: "Qty",
            price: "Price (UZS)",
          }
        : {
            nameError: "Material nomini kiriting",
            qtyError: "Miqdor musbat butun son bo'lsin",
            priceError: "Narx 0 dan kichik bo'lmasin",
            title: "Material sarfi",
            subtitle: "Demo: ombordan minus sifatida",
            add: "Qo'shish",
            close: "Yopish",
            material: "Material",
            materialPlaceholder: "Masalan: Mato (kulrang)",
            uom: "O'lchov",
            uomPlaceholder: "kg/m/dona",
            qty: "Miqdor",
            price: "Narx (UZS)",
          }

  React.useEffect(() => {
    if (!open) return
    setName("")
    setUom("kg")
    setQty(1)
    setUnitCostUZS(1000)
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
    if (!name.trim()) return alert(copy.nameError)
    if (!Number.isInteger(qty) || qty <= 0) return alert(copy.qtyError)
    if (!unitCostUZS || unitCostUZS < 0) return alert(copy.priceError)
    onSubmit({ name: name.trim(), uom, qty: Number(qty), unitCostUZS: Number(unitCostUZS) })
  }
  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="close" />
        <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(2,6,23,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="text-base font-semibold text-slate-900">{copy.title}</div>
              <div className="text-xs text-slate-500">{copy.subtitle}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={submit} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95">{copy.add}</button>
              <button onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">{copy.close}</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5">
            <div>
              <div className="mb-1 text-xs text-slate-500">{copy.material}</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder={copy.materialPlaceholder} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="mb-1 text-xs text-slate-500">{copy.uom}</div>
                <input value={uom} onChange={(e) => setUom(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" placeholder={copy.uomPlaceholder} />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-500">{copy.qty}</div>
                <input type="number" value={qty} onChange={(e) => setQty(Math.trunc(Number(e.target.value)))} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" min={1} step={1} />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-500">{copy.price}</div>
                <input type="number" value={unitCostUZS} onChange={(e) => setUnitCostUZS(Number(e.target.value))} className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" min={0} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
