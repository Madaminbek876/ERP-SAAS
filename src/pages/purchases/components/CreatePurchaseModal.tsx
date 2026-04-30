import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Search, Trash2 } from "lucide-react"
import { toast } from "react-toastify"
import type { CreatePurchasePayload, PurchaseMaterialOption } from "@/Api/purchases.api"
import type { LookupItem } from "@/pages/sklad/warehouse/api/types"
import { useI18n } from "@/i18n"

type FormValues = {
  supplier: string
  received_date: string
  produced_date: string
  delivery_company: string
  location: string
  currency: string
  notes: string
  raw_material: string
  qty: string
  unit_price: string
  table_search: string
}

type DraftLine = {
  raw_material: number
  name: string
  qty: number
  unit_price: number
}

function fmtMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(amount || 0)
}

function fmtQty(value: number) {
  return String(Number(value.toFixed(6))).replace(/\.0+$/, "")
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function CreatePurchaseModal({
  open,
  onOpenChange,
  onSubmit,
  loading,
  suppliers,
  locations,
  materials,
  currencyChoices,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (payload: CreatePurchasePayload) => void
  loading: boolean
  suppliers: LookupItem[]
  locations: Array<LookupItem & { warehouse_id?: number }>
  materials: PurchaseMaterialOption[]
  currencyChoices: string[]
}) {
  const { language } = useI18n()
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const copy =
    language === "ru"
      ? {
          title: "Новая закупка",
          eyebrow: "Поступления",
          supplier: "Контрагент *",
          supplierPlaceholder: "Выберите поставщика",
          receivedDate: "Дата приемки *",
          producedDate: "Дата производства",
          deliveryCompany: "Компания доставки",
          deliveryPlaceholder: "Например: Быстрая доставка",
          location: "Локация *",
          locationPlaceholder: "Выберите локацию",
          currency: "Валюта *",
          notes: "Примечание",
          notesPlaceholder: "Дополнительное примечание",
          rawItems: "Позиции сырья",
          rawPlaceholder: "Выберите сырье",
          qty: "Количество",
          price: "Цена",
          add: "Добавить",
          tableSearch: "Поиск по таблице",
          rawMaterial: "Сырье",
          total: "Итого",
          remove: "Удалить",
          empty: "Сырье не добавлено",
          footerTotal: "Общая сумма",
          cancel: "Отмена",
          save: "Сохранить закупку",
          saving: "Сохранение...",
          errors: {
            raw: "Выберите сырье",
            qty: "Количество должно быть положительным",
            price: "Неверная цена",
            rawNotFound: "Сырье не найдено",
            supplier: "Выберите контрагента",
            location: "Выберите локацию",
            currency: "Выберите валюту",
            items: "Добавьте хотя бы одну позицию сырья",
          },
        }
      : language === "en"
        ? {
            title: "New purchase",
            eyebrow: "Purchases",
            supplier: "Counterparty *",
            supplierPlaceholder: "Select counterparty",
            receivedDate: "Received date *",
            producedDate: "Produced date",
            deliveryCompany: "Delivery company",
            deliveryPlaceholder: "Example: Fast delivery",
            location: "Location *",
            locationPlaceholder: "Select location",
            currency: "Currency *",
            notes: "Notes",
            notesPlaceholder: "Additional note",
            rawItems: "Raw material items",
            rawPlaceholder: "Select raw material",
            qty: "Qty",
            price: "Price",
            add: "Add",
            tableSearch: "Search in table",
            rawMaterial: "Raw material",
            total: "Total",
            remove: "Remove",
            empty: "No raw materials added",
            footerTotal: "Grand total",
            cancel: "Cancel",
            save: "Save purchase",
            saving: "Saving...",
            errors: {
              raw: "Select raw material",
              qty: "Quantity must be positive",
              price: "Invalid price",
              rawNotFound: "Raw material not found",
              supplier: "Select counterparty",
              location: "Select location",
              currency: "Select currency",
              items: "Add at least one raw material item",
            },
          }
        : {
            title: "Yangi xarid",
            eyebrow: "Xarid tarkibi",
            supplier: "Yetkazib beruvchi *",
            supplierPlaceholder: "Yetkazib beruvchini tanlang",
            receivedDate: "Qabul sanasi *",
            producedDate: "Ishlab chiqarilgan sana",
            deliveryCompany: "Yetkazuvchi kompaniya",
            deliveryPlaceholder: "Masalan: Tez yetkazma",
            location: "Ombor *",
            locationPlaceholder: "Omborni tanlang",
            currency: "Valyuta *",
            notes: "Izoh",
            notesPlaceholder: "Qo'shimcha izoh",
            rawItems: "Xomashyo pozitsiyalari",
            rawPlaceholder: "Xomashyoni tanlang",
            qty: "Miqdor",
            price: "Narx",
            add: "Qo'shish",
            tableSearch: "Jadval bo'yicha qidiruv",
            rawMaterial: "Xomashyo",
            total: "Jami",
            remove: "O'chirish",
            empty: "Xomashyo qo'shilmagan",
            footerTotal: "Umumiy summa",
            cancel: "Bekor",
            save: "Xaridni saqlash",
            saving: "Saqlanmoqda...",
            errors: {
              raw: "Xomashyo tanlang",
              qty: "Miqdor musbat son bo'lishi kerak",
              price: "Narx noto'g'ri",
              rawNotFound: "Xomashyo topilmadi",
              supplier: "Yetkazib beruvchini tanlang",
              location: "Omborni tanlang",
              currency: "Valyuta tanlang",
              items: "Kamida bitta xomashyo qo'shing",
            },
          }

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      supplier: "",
      received_date: today(),
      produced_date: "",
      delivery_company: "",
      location: "",
      currency: currencyChoices[0] || "UZS",
      notes: "",
      raw_material: "",
      qty: "1",
      unit_price: "0",
      table_search: "",
    },
  })
  const rawMaterialValue = watch("raw_material")
  const qtyValue = watch("qty")
  const unitPriceValue = watch("unit_price")
  const tableSearch = watch("table_search")
  const supplierValue = watch("supplier")
  const locationValue = watch("location")
  const currencyValue = watch("currency")

  useEffect(() => {
    if (!open) return
    reset({
      supplier: "",
      received_date: today(),
      produced_date: "",
      delivery_company: "",
      location: "",
      currency: currencyChoices[0] || "UZS",
      notes: "",
      raw_material: materials[0]?.id ? String(materials[0].id) : "",
      qty: "1",
      unit_price: "0",
      table_search: "",
    })
    setDraftLines([])
  }, [open, reset, currencyChoices, materials])

  useEffect(() => {
    if (!rawMaterialValue && materials[0]?.id) setValue("raw_material", String(materials[0].id))
  }, [materials, rawMaterialValue, setValue])

  const filteredLines = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return draftLines
    return draftLines.filter((line) => line.name.toLowerCase().includes(q) || String(line.raw_material).includes(q))
  }, [draftLines, tableSearch])

  const total = draftLines.reduce((sum, line) => sum + line.qty * line.unit_price, 0)

  const addLine = () => {
    const rawMaterial = Number(rawMaterialValue)
    const qty = Number(qtyValue)
    const unitPrice = Number(unitPriceValue)
    if (!Number.isFinite(rawMaterial) || rawMaterial <= 0) return toast.error(copy.errors.raw)
    if (!Number.isFinite(qty) || qty <= 0) return toast.error(copy.errors.qty)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return toast.error(copy.errors.price)
    const selected = materials.find((row) => row.id === rawMaterial)
    if (!selected) return toast.error(copy.errors.rawNotFound)
    setDraftLines((prev) => {
      const index = prev.findIndex((x) => x.raw_material === rawMaterial)
      if (index >= 0) {
        const next = [...prev]
        next[index] = { ...next[index], qty: next[index].qty + qty, unit_price: unitPrice }
        return next
      }
      return [...prev, { raw_material: rawMaterial, name: selected.name, qty, unit_price: unitPrice }]
    })
  }

  const submit = handleSubmit((values) => {
    const supplier = Number(values.supplier)
    const location = Number(values.location)
    const currency = (values.currency || "UZS").trim()
    if (!Number.isFinite(supplier) || supplier <= 0) return toast.error(copy.errors.supplier)
    if (!Number.isFinite(location) || location <= 0) return toast.error(copy.errors.location)
    if (!currency) return toast.error(copy.errors.currency)
    if (draftLines.length === 0) return toast.error(copy.errors.items)
    onSubmit({
      supplier,
      received_date: values.received_date || today(),
      produced_date: values.produced_date || null,
      delivery_company: values.delivery_company.trim() || null,
      location,
      currency: currency as CreatePurchasePayload["currency"],
      notes: values.notes.trim() || null,
      items: draftLines.map((line) => ({
        raw_material: line.raw_material,
        qty: line.qty.toFixed(6),
        unit_price: line.unit_price,
      })),
    })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[calc(100vw-24px)] !max-w-[1840px] !h-[96vh] overflow-hidden rounded-[32px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f6faff_100%)] p-0 shadow-[0_35px_120px_-45px_rgba(15,23,42,0.42)] sm:w-[97vw]">
        <DialogHeader className="border-b border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5 sm:px-8">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.38em] text-[#2f62ff]">
              {copy.eyebrow ?? copy.title}
            </div>
            <DialogTitle className="bg-transparent px-0 text-[30px] font-semibold leading-tight text-slate-900">
              {copy.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form className="flex h-[calc(96vh-97px)] flex-col overflow-hidden" onSubmit={submit}>
          <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid gap-5 rounded-[28px] border border-[#d7e3f7] bg-white/95 p-5 shadow-[0_20px_50px_-40px_rgba(37,99,235,0.35)] md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <div>
              <label className="text-sm font-medium text-slate-700">{copy.supplier}</label>
              <Select value={supplierValue || "NONE"} onValueChange={(value) => setValue("supplier", value === "NONE" ? "" : value)}>
                <SelectTrigger className="mt-2 h-12 rounded-xl border-[#c9d8f2] bg-white text-sm shadow-sm">
                  <SelectValue placeholder={copy.supplierPlaceholder} />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg">
                  <SelectItem value="NONE">{copy.supplierPlaceholder}</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">{copy.receivedDate}</label>
              <Input type="date" className="mt-2 h-12 rounded-xl border-[#c9d8f2] bg-white shadow-sm" {...register("received_date")} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">{copy.producedDate}</label>
              <Input type="date" className="mt-2 h-12 rounded-xl border-[#c9d8f2] bg-white shadow-sm" {...register("produced_date")} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">{copy.deliveryCompany}</label>
              <Input className="mt-2 h-12 rounded-xl border-[#c9d8f2] bg-white shadow-sm" placeholder={copy.deliveryPlaceholder} {...register("delivery_company")} />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">{copy.location}</label>
              <Select value={locationValue || "NONE"} onValueChange={(value) => setValue("location", value === "NONE" ? "" : value)}>
                <SelectTrigger className="mt-2 h-12 rounded-xl border-[#c9d8f2] bg-white text-sm shadow-sm">
                  <SelectValue placeholder={copy.locationPlaceholder} />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg">
                  <SelectItem value="NONE">{copy.locationPlaceholder}</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">{copy.currency}</label>
              <Select value={currencyValue || "UZS"} onValueChange={(value) => setValue("currency", value)}>
                <SelectTrigger className="mt-2 h-12 rounded-xl border-[#c9d8f2] bg-white text-sm shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg">
                  {(currencyChoices.length ? currencyChoices : ["UZS", "USD"]).map((currency) => (
                    <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d7e3f7] bg-white/95 p-5 shadow-[0_20px_50px_-42px_rgba(37,99,235,0.3)]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#5f769b]">
              {copy.notes}
            </div>
            <Textarea className="min-h-[112px] rounded-2xl border-[#c9d8f2] bg-white shadow-sm" {...register("notes")} placeholder={copy.notesPlaceholder} />
          </div>

          <div className="rounded-[28px] border border-[#d7e3f7] bg-white/95 p-5 shadow-[0_24px_60px_-44px_rgba(37,99,235,0.35)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#2f62ff]">
                  {language === "ru" ? "Список закупок" : language === "en" ? "Purchase list" : "Xarid tarkibi"}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{copy.rawItems}</div>
              </div>
              <div className="rounded-full border border-[#d7e3f7] bg-[#f7faff] px-4 py-2 text-sm font-medium text-[#24406b]">
                {draftLines.length} {language === "ru" ? "позиций" : language === "en" ? "items" : "ta pozitsiya"}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-12 2xl:gap-5">
              <div className="min-w-0 xl:col-span-5 2xl:col-span-6">
              <Select value={rawMaterialValue || "NONE"} onValueChange={(value) => setValue("raw_material", value === "NONE" ? "" : value)}>
                <SelectTrigger className="h-12 w-full rounded-xl border-[#c9d8f2] bg-white text-sm shadow-sm">
                  <SelectValue placeholder={copy.rawPlaceholder} />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg">
                  <SelectItem value="NONE">{copy.rawPlaceholder}</SelectItem>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={String(material.id)}>{material.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <Input type="number" min="0.000001" step="0.000001" className="h-12 w-full rounded-xl border-[#c9d8f2] bg-white shadow-sm" value={qtyValue} onChange={(e) => setValue("qty", e.target.value)} placeholder={copy.qty} />
              </div>
              <div className="min-w-0 xl:col-span-3 2xl:col-span-2">
                <Input type="number" min="0" step="0.01" className="h-12 w-full rounded-xl border-[#c9d8f2] bg-white shadow-sm" value={unitPriceValue} onChange={(e) => setValue("unit_price", e.target.value)} placeholder={copy.price} />
              </div>
              <div className="xl:col-span-2 2xl:col-span-2">
                <Button type="button" className="h-12 w-full rounded-xl !bg-gradient-to-r from-blue-900 to-blue-700 px-6 text-base font-semibold text-white shadow-[0_14px_28px_rgba(29,78,216,0.18)]" onClick={addLine}>{copy.add}</Button>
              </div>
            </div>

            <div className="relative mt-3 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="h-12 rounded-xl border-[#c9d8f2] bg-[#fbfdff] pl-10 shadow-sm" placeholder={copy.tableSearch} {...register("table_search")} />
            </div>

            <div className="mt-4 overflow-hidden rounded-[20px] border border-[#d7e3f7] bg-white">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[linear-gradient(180deg,#2d5bff_0%,#1d43b8_100%)] text-white">
                    <tr className="[&>th]:border-r [&>th]:border-r-white/10 [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:text-sm [&>th]:font-semibold [&>th:last-child]:border-r-0">
                      <th>{copy.rawMaterial}</th>
                      <th className="text-right">{copy.qty}</th>
                      <th className="text-right">{copy.price}</th>
                      <th className="text-right">{copy.total}</th>
                      <th className="w-16 text-center">{copy.remove}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredLines.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-500">{copy.empty}</td>
                      </tr>
                    )}
                    {filteredLines.map((line) => (
                      <tr key={line.raw_material} className="transition-colors hover:bg-[#f8fbff]">
                        <td className="px-4 py-3 font-medium text-slate-800">{line.name}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmtQty(line.qty)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(line.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(line.qty * line.unit_price)}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 transition-colors hover:bg-rose-50" onClick={() => setDraftLines((prev) => prev.filter((x) => x.raw_material !== line.raw_material))}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </div>

          <div className="border-t border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 rounded-[28px] border border-[#d7e3f7] bg-white/95 px-5 py-5 shadow-[0_20px_50px_-42px_rgba(37,99,235,0.28)] md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5f769b]">{copy.footerTotal}</div>
              <div className="text-2xl font-semibold text-slate-900">{fmtMoney(total)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="h-12 rounded-xl border border-[#d7e3f7] bg-white px-5 text-[#24406b]" onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
              <Button type="submit" className="h-12 rounded-xl !bg-gradient-to-r from-blue-900 to-blue-700 px-5 text-base font-semibold text-white shadow-[0_14px_28px_rgba(29,78,216,0.2)]" disabled={loading}>{loading ? copy.saving : copy.save}</Button>
            </div>
          </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
