import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  dictsApi,
  type MaterialTypeRow,
  type UomRow,
} from "@/pages/Settings/Api/dictsApi"
import type {
  Material,
  MaterialCreatePayload,
  MaterialUpdatePayload,
} from "@/pages/Materials/api/materialsApi"
import { useI18n } from "@/i18n"

type CreateProps = {
  open: boolean
  mode: "create"
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: MaterialCreatePayload) => Promise<void>
}

type EditProps = {
  open: boolean
  mode: "edit"
  initial: Material
  loading?: boolean
  onClose: () => void
  onSubmit: (payload: MaterialUpdatePayload) => Promise<void>
}

type Props = CreateProps | EditProps

function normalizeLookupName(value?: string | null) {
  return String(value ?? "").trim().toLocaleLowerCase()
}

function resolveLookupIdByName<T extends { id: number; name: string }>(
  options: T[],
  label?: string | null
) {
  const normalizedLabel = normalizeLookupName(label)
  if (!normalizedLabel) return ""
  return String(options.find((option) => normalizeLookupName(option.name) === normalizedLabel)?.id ?? "")
}

export function MaterialFormDialog(props: Props) {
  const { language } = useI18n()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [materialType, setMaterialType] = useState<string>("")
  const [uom, setUom] = useState<string>("")
  const [uomOptions, setUomOptions] = useState<UomRow[]>([])
  const [materialTypeOptions, setMaterialTypeOptions] = useState<MaterialTypeRow[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [PurchasePrice, setPurchasePrice] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const copy =
    language === "ru"
      ? {
        section: "Сырьё",
        create: "Добавить Сырьё",
        edit: "Редактировать Сырьё",
        name: "Название",
        namePlaceholder: "Например: Салафан",
        materialType: "Тип материала",
        materialTypePlaceholder: "Выберите тип материала",
        uom: "Единица измерения",
        uomPlaceholder: "Выберите единицу измерения",
        code: "Код",
        purchasePrice: "Цена закупки",
        pricePlaceholder: "Например: 1500",
        currency: "Валюта",
        cancel: "Отмена",
        save: "Сохранить",
        saving: "Сохранение...",
        errors: {
          name: "Название обязательно",
          materialType: "Material type ID обязателен",
          uom: "UOM обязателен",
          materialTypeInvalid: "Неверный Material type ID",
          uomInvalid: "Неверный UOM ID",
          price: "Неверная цена закупки",
        },
      }
      : language === "en"
        ? {
          section: "Materials",
          create: "Add material",
          edit: "Edit material",
          name: "Name *",
          namePlaceholder: "Example: Cellophane",
          materialType: "Material type *",
          materialTypePlaceholder: "Select material type",
          uom: "Unit of measure *",
          uomPlaceholder: "Select UOM",
          code: "Code",
          purchasePrice: "Purchase price",
          pricePlaceholder: "Example: 1500",
          currency: "Currency",
          cancel: "Cancel",
          save: "Save",
          saving: "Saving...",
          errors: {
            name: "Name is required",
            materialType: "Material type ID is required",
            uom: "UOM is required",
            materialTypeInvalid: "Invalid material type ID",
            uomInvalid: "Invalid UOM ID",
            price: "Invalid purchase price",
          },
        }
        : {
          section: "Materiallar",
          create: "Material qo'shish",
          edit: "Materialni tahrirlash",
          name: "Nomi *",
          namePlaceholder: "Masalan: Salafan",
          materialType: "Material turi *",
          materialTypePlaceholder: "Material turini tanlang",
          uom: "O'lchov birligi *",
          uomPlaceholder: "O'lchov birligini tanlang",
          code: "Kod",
          purchasePrice: "Xarid narxi",
          pricePlaceholder: "Masalan: 1500",
          currency: "Valyuta",
          cancel: "Bekor",
          save: "Saqlash",
          saving: "Saqlanmoqda...",
          errors: {
            name: "Nomi majburiy",
            materialType: "Material turi majburiy",
            uom: "O'lchov birligi majburiy",
            materialTypeInvalid: "Material turi noto'g'ri",
            uomInvalid: "O'lchov birligi noto'g'ri",
            price: "Xarid narxi noto'g'ri",
          },
        }

  const descriptionLabel =
    language === "ru"
      ? "Описание (description)"
      : language === "en"
        ? "Description"
        : "Tavsif"
  const descriptionPlaceholder =
    language === "ru" ? "Необязательно" : language === "en" ? "Optional" : "Ixtiyoriy"

  useEffect(() => {
    if (!props.open) return
    let cancelled = false
    async function loadLookups() {
      try {
        setLookupLoading(true)
        const [materialTypes, uoms] = await Promise.all([
          dictsApi.listMaterialTypes().catch(() => []),
          dictsApi.listUom().catch(() => []),
        ])
        if (cancelled) return
        setMaterialTypeOptions(materialTypes)
        setUomOptions(uoms)
        if (props.mode === "create") {
          setMaterialType((prev) => (prev ? prev : String(materialTypes[0]?.id ?? "")))
          setUom((prev) => (prev ? prev : String(uoms[0]?.id ?? "")))
        }
      } finally {
        if (!cancelled) setLookupLoading(false)
      }
    }
    void loadLookups()
    return () => {
      cancelled = true
    }
  }, [props.open, props.mode])

  useEffect(() => {
    if (!props.open) return
    setError(null)
    if (props.mode === "edit") {
      setName(props.initial.name ?? "")
      setDescription(props.initial.description ?? "")
      setMaterialType(props.initial.material_type ? String(props.initial.material_type) : "")
      setUom(String(props.initial.uom ?? ""))
      setPurchasePrice(
        props.initial.purchase_price === null || props.initial.purchase_price === undefined
          ? ""
          : String(props.initial.purchase_price)
      )

    } else {
      setName("")
      setDescription("")
      setMaterialType((prev) => prev || "")
      setUom((prev) => prev || "")
      setPurchasePrice("")
    }
  }, [props.open, props.mode, props.mode === "edit" ? props.initial : null])

  useEffect(() => {
    if (!props.open || props.mode !== "edit") return

    if (!materialType && materialTypeOptions.length > 0) {
      const resolvedMaterialType = resolveLookupIdByName(
        materialTypeOptions,
        props.initial.material_type_name
      )
      if (resolvedMaterialType) setMaterialType(resolvedMaterialType)
    }

    if (!uom && uomOptions.length > 0) {
      const resolvedUom = resolveLookupIdByName(uomOptions, props.initial.uom_name)
      if (resolvedUom) setUom(resolvedUom)
    }
  }, [
    props.open,
    props.mode,
    props.mode === "edit" ? props.initial.id : null,
    props.mode === "edit" ? props.initial.material_type_name : null,
    props.mode === "edit" ? props.initial.uom_name : null,
    materialType,
    uom,
    materialTypeOptions,
    uomOptions,
  ])

  const selectedUom = uomOptions.find((row) => String(row.id) === uom)

  async function submit() {
    setError(null)
    if (!name.trim()) return setError(copy.errors.name)
    if (!materialType.trim()) return setError(copy.errors.materialType)
    if (!uom.trim()) return setError(copy.errors.uom)
    const materialTypeId = Number(materialType)
    const uomId = Number(uom)
    if (!Number.isFinite(materialTypeId) || materialTypeId <= 0) return setError(copy.errors.materialTypeInvalid)
    if (!Number.isFinite(uomId) || uomId <= 0) return setError(copy.errors.uomInvalid)
    let price: number | undefined
    if (PurchasePrice.trim()) {
      const p = Number(PurchasePrice)
      if (!Number.isFinite(p) || p < 0) return setError(copy.errors.price)

      price = p
    }
    const trimmedDescription = description.trim()
    if (props.mode === "create") {
      const payload: MaterialCreatePayload = {
        name: name.trim(),
        material_type: materialTypeId,
        uom: uomId,
        currency: "UZS",
      }
      if (trimmedDescription) payload.description = trimmedDescription
      if (price !== undefined) payload.purchase_price = price
      await props.onSubmit(payload)
      return
    }

    const payload: MaterialUpdatePayload = {
      name: name.trim(),
      material_type: materialTypeId,
      uom: uomId,
      description: trimmedDescription || null,
      purchase_price: price ?? null,
      currency: "UZS",
    }

    await props.onSubmit(payload)
  }

  return (
    <Dialog open={props.open} onOpenChange={(v) => !v && props.onClose()}>
      <DialogContent className="w-[min(92vw,760px)] max-w-[760px] overflow-hidden rounded-[28px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-0 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)]">
        <DialogHeader className="border-b border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2f6fed]">{copy.section}</div>
          <DialogTitle className="mt-2 text-[30px] font-semibold text-[#16325c]">{props.mode === "create" ? copy.create : copy.edit}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-5 rounded-[22px] border border-[#d7e3f7] bg-white p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="mb-2 text-sm font-medium text-[#24406b]">{copy.name}</div>
              <Input className="h-12 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-base text-[#16325c]" value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.namePlaceholder} />
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 text-sm font-medium text-[#24406b]">{descriptionLabel}</div>
              <textarea
                className="min-h-[112px] w-full rounded-xl border border-[#c7d7ef] bg-[#f8fbff] px-4 py-3 text-base text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={descriptionPlaceholder}
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-[#24406b]">{copy.materialType}</div>
              <select className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f8fbff] px-4 text-base text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]" value={materialType} onChange={(e) => setMaterialType(e.target.value)} disabled={lookupLoading}>
                <option value="">{copy.materialTypePlaceholder}</option>
                {materialTypeOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-[#24406b]">{copy.uom}</div>
              <select className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f8fbff] px-4 text-base text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]" value={uom} onChange={(e) => setUom(e.target.value)} disabled={lookupLoading}>
                <option value="">{copy.uomPlaceholder}</option>
                {uomOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              {selectedUom?.code ? <div className="mt-2 text-xs font-medium text-[#6a7ea1]">{copy.code}: {selectedUom.code}</div> : null}
            </div>
          </div>

          <div className="grid gap-5 rounded-[22px] border border-[#d7e3f7] bg-white p-5 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-[#24406b]">{copy.purchasePrice}</div>
              <Input
                className="h-12 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-base text-[#16325c]"
                type="number"
                value={PurchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder={copy.pricePlaceholder}
              />
             </div>

            <div>
              <div className="mb-2 text-sm font-medium text-[#24406b]">{copy.currency}</div>
              <Input className="h-12 rounded-xl border-[#c7d7ef] bg-[#f1f6ff] text-base text-[#16325c]" value="UZS" disabled />
            </div>
          </div>

          {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        </div>

        <DialogFooter className="border-t border-[#e4ecf8] bg-white px-6 py-5">
          <DialogClose asChild>
            <Button variant="outline" className="h-11 rounded-xl border border-[#d7e3f7] bg-white px-5 text-sm font-medium text-[#24406b] shadow-sm hover:bg-[#f8fbff]" disabled={props.loading} onClick={props.onClose}>
              {copy.cancel}
            </Button>
          </DialogClose>

          <Button className="h-11 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(29,78,216,0.18)]" onClick={submit} disabled={props.loading}>
            {props.loading ? copy.saving : copy.save}
          </Button>
        </DialogFooter>
      </DialogContent >
    </Dialog >
  )
}
