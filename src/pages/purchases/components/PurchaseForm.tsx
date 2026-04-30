import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { PatchPurchasePayload } from "@/Api/purchases.api"
import type { PurchaseDetail } from "../types"
import type { LookupItem } from "@/pages/sklad/warehouse/api/types"
import { useI18n } from "@/i18n"

type FormValues = {
  supplier: string
  location: string
  received_date: string
  notes: string
}

export default function PurchaseForm({
  value,
  loading,
  saving,
  suppliers,
  locations,
  onSubmit,
}: {
  value?: PurchaseDetail
  loading: boolean
  saving: boolean
  suppliers: LookupItem[]
  locations: Array<LookupItem & { warehouse_id?: number }>
  onSubmit: (payload: PatchPurchasePayload) => void
}) {
  const { language } = useI18n()
  const dateInputClass = "mt-1 rounded-xl !border-blue-700 focus-visible:!border-blue-700 focus-visible:!ring-blue-200"
  const copy =
    language === "ru"
      ? {
          title: "Основные данные",
          supplier: "Поставщик *",
          supplierPlaceholder: "Выберите поставщика",
          location: "Локация *",
          locationPlaceholder: "Выберите локацию",
          receivedDate: "Дата приемки",
          producedDate: "Дата производства",
          deliveryCompany: "Компания доставки",
          notes: "Примечание",
          currency: "Валюта",
          save: "Сохранить",
          saving: "Сохранение...",
        }
      : language === "en"
        ? {
            title: "Main information",
            supplier: "Supplier *",
            supplierPlaceholder: "Select supplier",
            location: "Location *",
            locationPlaceholder: "Select location",
            receivedDate: "Received date",
            producedDate: "Produced date",
            deliveryCompany: "Delivery company",
            notes: "Notes",
            currency: "Currency",
            save: "Save",
            saving: "Saving...",
          }
        : {
            title: "Asosiy ma'lumotlar",
            supplier: "Yetkazib beruvchi *",
            supplierPlaceholder: "Yetkazib beruvchini tanlang",
            location: "Omborni tanlang *",
            locationPlaceholder: "Omborni tanlang",
            receivedDate: "Qabul sanasi",
            notes: "Izoh",
            currency: "Valyuta",
            save: "Saqlash",
            saving: "Saqlanmoqda...",
          }

  const { register, reset, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      supplier: "",
      location: "",
      received_date: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (!value) return
    const matchedSupplier =
      value.supplier && value.supplier > 0 ? value.supplier : suppliers.find((x) => x.name === value.supplier_name)?.id
    const matchedLocation =
      value.location && value.location > 0 ? value.location : locations.find((x) => x.name === value.location_name)?.id

    reset({
      supplier: matchedSupplier ? String(matchedSupplier) : "",
      location: matchedLocation ? String(matchedLocation) : "",
      received_date: value.received_date || "",
      notes: value.notes || "",
    })
  }, [value, reset, suppliers, locations])

  const isDraft = value?.status === "DRAFT"

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white p-4"
      onSubmit={handleSubmit((v) => {
        const supplierId = Number(v.supplier)
        const locationId = Number(v.location)
        if (!Number.isFinite(supplierId) || supplierId <= 0) return
        if (!Number.isFinite(locationId) || locationId <= 0) return
        onSubmit({
          supplier: supplierId,
          location: locationId,
          received_date: v.received_date || null,
          notes: v.notes.trim() || null,
        })
      })}
    >
      <div className="text-sm font-semibold text-slate-900">{copy.title}</div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500">{copy.supplier}</label>
          <select className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100" disabled={loading || !isDraft} {...register("supplier")}>
            <option value="">{copy.supplierPlaceholder}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500">{copy.location}</label>
          <select className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100" disabled={loading || !isDraft} {...register("location")}>
            <option value="">{copy.locationPlaceholder}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500">{copy.receivedDate}</label>
          <Input className={dateInputClass} type="date" disabled={loading || !isDraft} {...register("received_date")} />
        </div>

        <div>
          <label className="text-xs text-slate-500">{copy.currency}</label>
          <Input className="mt-1 rounded-xl" value={value?.currency || "UZS"} disabled />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-500">{copy.notes}</label>
          <Textarea className="mt-1 rounded-xl" rows={4} disabled={loading || !isDraft} {...register("notes")} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button type="submit" className="cursor-pointer rounded-xl" disabled={saving || loading || !isDraft}>
          {saving ? copy.saving : copy.save}
        </Button>
      </div>
    </form>
  )
}
