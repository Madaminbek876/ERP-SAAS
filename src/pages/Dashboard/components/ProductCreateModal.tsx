import { useEffect, useMemo, useState } from "react"
import Portal from "@/pages/documents/components/Portal"
import { formatIntegerInput, parseIntegerInput } from "@/lib/numberFormat"
import { sanitizeBarcodeInput } from "@/lib/barcode"
import { useI18n } from "@/i18n"
import { useDebounce } from "@/hooks/useDebounce"
import { barcodeApi } from "@/pages/catalog/api/barcodeApi"
import { dictsApi, type ProductCategoryRow, type UomRow } from "@/pages/Settings/Api/dictsApi"
import {
  extractProductApiErrorMessage,
  productsApi,
  type ProductCreatePayload,
} from "@/pages/catalog/api/ProductsApi"

function cx(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ")
}

function cleanCatalogLabel(value: string) {
  return value.replace(/\s*\(#\d+\)\s*$/u, "").replace(/\s+#\d+\s*$/u, "").trim()
}

function capitalizeLabel(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

type BarcodeStatusTone = "idle" | "loading" | "success" | "warning" | "error"

function formatBarcodeProductLabel(name: string, id: number) {
  return `${name} (#${id})`
}

function getBarcodeStatusClassName(tone: BarcodeStatusTone) {
  if (tone === "error") return "text-rose-700"
  if (tone === "warning") return "text-amber-700"
  if (tone === "success") return "text-emerald-700"
  return "text-slate-500"
}

export default function ProductCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}) {
  const { language } = useI18n()
  const [ui, setUi] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [err, setErr] = useState<string | null>(null)

  const [categories, setCategories] = useState<ProductCategoryRow[]>([])
  const [uoms, setUoms] = useState<UomRow[]>([])

  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState<number | "">("")
  const [uomId, setUomId] = useState<number | "">("")
  const [minPrice, setMinPrice] = useState("")
  const [sellingPrice, setSellingPrice] = useState("")
  const [barcode, setBarcode] = useState("")
  const [barcodeStatus, setBarcodeStatus] = useState<{ tone: BarcodeStatusTone; message: string }>({
    tone: "idle",
    message: "",
  })
  const [barcodeGenerating, setBarcodeGenerating] = useState(false)
  const debouncedBarcode = useDebounce(barcode, 450)
  const currency: "UZS" = "UZS"
  const copy =
    language === "ru"
      ? {
        metaLoadError: "Ошибка загрузки category/UoM",
        requiredName: "Название товара обязательно.",
        categoryMissing: "Категория не найдена.",
        categorySelect: "Выберите категорию.",
        uomMissing: "UoM не найден.",
        uomSelect: "Выберите единицу измерения.",
        invalidPrice: "Некорректная цена.",
        saveError: "Ошибка сохранения",
        title: "Добавить товар",
        name: "Название *",
        namePlaceholder: "Например: Товар",
        category: "Категория *",
        categoryEmpty: "Не выбрано",
        uom: "Единица измерения *",
        uomEmpty: "(UoM не найден)",
        price: "Цена продажи (необязательно)",
        pricePlaceholder: "19 000",
        currency: "Валюта",
        cancel: "Отмена",
        saving: "Сохранение...",
        save: "Сохранить",
      }
      : language === "en"
        ? {
          metaLoadError: "Failed to load category/UoM",
          requiredName: "Product name is required.",
          categoryMissing: "Category not found.",
          categorySelect: "Select a category.",
          uomMissing: "UoM not found.",
          uomSelect: "Select a unit of measure.",
          invalidPrice: "Invalid price.",
          saveError: "Save failed",
          title: "Add product",
          name: "Name *",
          namePlaceholder: "For example: Cup",
          category: "Category",
          categoryEmpty: "Not selected",
          uom: "Unit of measure *",
          uomEmpty: "(UoM not found)",
          price: "Selling price",
          pricePlaceholder: "19 000",
          currency: "Currency",
          cancel: "Cancel",
          saving: "Saving...",
          save: "Save",
        }
        : {
          metaLoadError: "Category/UoM yuklashda xatolik",
          requiredName: "Mahsulot nomi majburiy.",
          categoryMissing: "Kategoriya topilmadi.",
          categorySelect: "Kategoriya tanlang.",
          uomMissing: "UoM topilmadi.",
          uomSelect: "O'lchov birligini tanlang.",
          invalidPrice: "Narx noto'g'ri.",
          saveError: "Saqlashda xatolik",
          title: "Mahsulot",
          name: "Nomi *",
          namePlaceholder: "Masalan: Mahsulot",
          category: "Kategoriya",
          categoryEmpty: "Tanlanmagan",
          uom: "O'lchov birligi",
          uomEmpty: "(UoM topilmadi)",
          price: "Sotuv narxi",
          pricePlaceholder: "19 000",
          currency: "Valyuta",
          cancel: "Bekor qilish",
          saving: "Saqlanmoqda...",
          save: "Saqlash",
        }
  const minPriceLabel =
    language === "ru"
      ? "РњРёРЅ. С†РµРЅР° (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)"
      : language === "en"
        ? "Min price"
        : "Minimal narx"
  const barcodeCopy =
    language === "ru"
      ? {
        label: "Shtrikh-kod",
        placeholder: "Naprimer: 2001234567890",
        generate: "Sozdat",
        generating: "Sozdaetsya...",
        checking: "Proverka shtrikh-koda...",
        available: "Shtrikh-kod svoboden, mozhno ispolzovat.",
        duplicate: (label: string) => `Etot shtrikh-kod uzhe privyazan k tovaru ${label}.`,
        generateError: "Ne udalos sozdat shtrikh-kod.",
        scanError: "Ne udalos proverit shtrikh-kod.",
        conflictSave: "Uкажите drugoy shtrikh-kod. Etot kod uzhe ispolzuetsya.",
      }
      : language === "en"
        ? {
          label: "Barcode",
          placeholder: "For example: 2001234567890",
          generate: "Generate",
          generating: "Generating...",
          checking: "Checking barcode...",
          available: "Barcode is available and ready to use.",
          duplicate: (label: string) => `This barcode is already linked to ${label}.`,
          generateError: "Failed to generate barcode.",
          scanError: "Failed to verify barcode.",
          conflictSave: "Choose another barcode. This one is already used.",
        }
        : {
          label: "Shtrix kod",
          placeholder: "Masalan: 2001234567890",
          generate: "Yaratish",
          generating: "Yaratilmoqda...",
          checking: "Shtrix kod tekshirilmoqda...",
          available: "Shtrix kod bo'sh, ishlatish mumkin.",
          duplicate: (label: string) => `Bu shtrix kod allaqachon ${label} mahsulotiga biriktirilgan.`,
          generateError: "Shtrix kod yaratib bo'lmadi.",
          scanError: "Shtrix kodni tekshirib bo'lmadi.",
          conflictSave: "Boshqa shtrix kod kiriting. Bu kod allaqachon ishlatilgan.",
        }
  const resolvedMinPriceLabel = language === "ru" ? "Мин. цена (необязательно)" : minPriceLabel
  const resolvedBarcodeCopy =
    language === "ru"
      ? {
          label: "Штрих-код (необязательно)",
          placeholder: "Например: 2001234567890",
          generate: "Создать",
          generating: "Создается...",
          checking: "Проверка штрих-кода...",
          available: "Штрих-код свободен, можно использовать.",
          duplicate: (label: string) => `Этот штрих-код уже привязан к товару ${label}.`,
          generateError: "Не удалось создать штрих-код.",
          scanError: "Не удалось проверить штрих-код.",
          conflictSave: "Укажите другой штрих-код. Этот код уже используется.",
        }
      : barcodeCopy

  useEffect(() => {
    if (!open) return
    setErr(null)
    setUi("idle")
    setBarcodeStatus({ tone: "idle", message: "" })
    setBarcodeGenerating(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const canSave = useMemo(() => {
    if (!name.trim()) return false
    if (uomId === "") return false
    if (barcodeStatus.tone === "loading" || barcodeStatus.tone === "warning") return false
    if (minPrice.trim()) {
      const minParsed = parseIntegerInput(minPrice)
      if (minParsed === null || minParsed < 0) return false
    }
    if (sellingPrice.trim()) {
      const sellingParsed = parseIntegerInput(sellingPrice)
      if (sellingParsed === null || sellingParsed < 0) return false
    }
    return true
  }, [barcodeStatus.tone, minPrice, name, uomId, sellingPrice])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    async function loadMeta() {
      try {
        setUi("loading")
        setErr(null)

        const [cats, uu] = await Promise.all([
          dictsApi.listProductCategories().catch(() => []),
          dictsApi.listUom().catch(() => []),
        ])
        if (cancelled) return

        setCategories(cats)
        setUoms(uu)

        setUomId((prev) => (prev === "" && uu.length ? uu[0].id : prev))

        setUi("ready")
      } catch (e: any) {
        if (cancelled) return
        setUi("error")
        setErr(e?.message || copy.metaLoadError)
      }
    }

    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [open, copy.metaLoadError])

  useEffect(() => {
    if (!open) return

    const cleanBarcode = sanitizeBarcodeInput(debouncedBarcode)
    if (!cleanBarcode || cleanBarcode.length < 8) {
      setBarcodeStatus({ tone: "idle", message: "" })
      return
    }

    let cancelled = false
    setBarcodeStatus({ tone: "loading", message: resolvedBarcodeCopy.checking })

      ; (async () => {
        try {
          const found = await barcodeApi.scan(cleanBarcode)
          if (cancelled) return

          if (!found) {
            setBarcodeStatus({ tone: "success", message: resolvedBarcodeCopy.available })
            return
          }

          setBarcodeStatus({
            tone: "warning",
            message: resolvedBarcodeCopy.duplicate(formatBarcodeProductLabel(found.name, found.id)),
          })
        } catch (e: any) {
          if (cancelled) return
          setBarcodeStatus({ tone: "error", message: e?.message || resolvedBarcodeCopy.scanError })
        }
      })()

    return () => {
      cancelled = true
    }
  }, [open, debouncedBarcode, language])

  async function handleGenerateBarcode() {
    try {
      setBarcodeGenerating(true)
      setBarcodeStatus({ tone: "loading", message: resolvedBarcodeCopy.generating })
      const nextBarcode = await barcodeApi.generate(categoryId)
      setBarcode(nextBarcode)
    } catch (e: any) {
      setBarcodeStatus({ tone: "error", message: e?.message || resolvedBarcodeCopy.generateError })
    } finally {
      setBarcodeGenerating(false)
    }
  }

  async function save() {
    setErr(null)

    if (!name.trim()) return setErr(copy.requiredName)
    if (uoms.length === 0) return setErr(copy.uomMissing)
    if (uomId === "") return setErr(copy.uomSelect)
    if (barcodeStatus.tone === "loading") return setErr(resolvedBarcodeCopy.checking)
    if (barcodeStatus.tone === "warning") return setErr(resolvedBarcodeCopy.conflictSave)

    const payload: ProductCreatePayload = {
      name: name.trim(),
      category: categoryId === "" ? null : Number(categoryId),
      uom: Number(uomId),
      currency,
    }

    if (barcode.trim()) {
      payload.barcode = sanitizeBarcodeInput(barcode)
    }

    if (minPrice.trim()) {
      const p = parseIntegerInput(minPrice)
      if (p === null || p < 0) return setErr(copy.invalidPrice)
      payload.min_price = Math.trunc(p)
    }

    if (sellingPrice.trim()) {
      const p = parseIntegerInput(sellingPrice)
      if (p === null || p < 0) return setErr(copy.invalidPrice)
      payload.selling_price = Math.trunc(p)
    }

    try {
      setUi("loading")
      await productsApi.create(payload)

      onCreated?.()
      onClose()

      setName("")
      setCategoryId("")
      setUomId("")
      setMinPrice("")
      setSellingPrice("")
      setBarcode("")
      setBarcodeStatus({ tone: "idle", message: "" })
      setErr(null)
      setUi("idle")
    } catch (e: any) {
      setUi("ready")
      setErr(extractProductApiErrorMessage(e, copy.saveError))
    }
  }

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[1000] bg-black/40">
        <div className="hide-scrollbar min-h-full w-full overflow-y-auto p-4">
          <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
            <div className="w-full max-w-[620px] rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="p-5">
                <div className="text-lg font-extrabold text-slate-900">{copy.title}</div>

                {err && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div>
                )}

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Field label={copy.name}>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={copy.namePlaceholder}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                      disabled={ui === "loading"}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label={copy.category}>
                      <select
                        value={categoryId === "" ? "" : String(categoryId)}
                        onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                        disabled={ui === "loading"}
                      >
                        <option value="">{copy.categoryEmpty}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {cleanCatalogLabel(c.name)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={copy.uom}>
                      <select
                        value={uomId === "" ? "" : String(uomId)}
                        onChange={(e) => setUomId(e.target.value ? Number(e.target.value) : "")}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                        disabled={ui === "loading"}
                      >
                        {uoms.length === 0 ? (
                          <option value="">{copy.uomEmpty}</option>
                        ) : (
                          uoms.map((u) => (
                            <option key={u.id} value={String(u.id)}>
                              {capitalizeLabel(cleanCatalogLabel(u.name))}
                            </option>
                          ))
                        )}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label={resolvedBarcodeCopy.label}>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={barcode}
                            onChange={(e) => setBarcode(sanitizeBarcodeInput(e.target.value))}
                            inputMode="numeric"
                            maxLength={13}
                            placeholder={resolvedBarcodeCopy.placeholder}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                            disabled={ui === "loading"}
                          />
                          {/* <button
                            type="button"
                            onClick={handleGenerateBarcode}
                            className="h-10 shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-extrabold text-blue-700 hover:bg-blue-100"
                            disabled={ui === "loading" || barcodeGenerating}
                          >
                            {barcodeGenerating ? resolvedBarcodeCopy.generating : resolvedBarcodeCopy.generate}
                          </button> */}
                        </div>
                        {barcodeStatus.message ? (
                          <div className={cx("text-xs font-medium", getBarcodeStatusClassName(barcodeStatus.tone))}>
                            {barcodeStatus.message}
                          </div>
                        ) : null}
                      </div>
                    </Field>
                    
                    <Field label={resolvedMinPriceLabel}>
                      <input
                        value={minPrice}
                        onChange={(e) => setMinPrice(formatIntegerInput(e.target.value))}
                        inputMode="numeric"
                        placeholder={copy.pricePlaceholder}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                        disabled={ui === "loading"}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label={copy.price}>
                      <input
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(formatIntegerInput(e.target.value))}
                        inputMode="numeric"
                        placeholder={copy.pricePlaceholder}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                        disabled={ui === "loading"}
                      />
                    </Field>

                    <Field label={copy.currency}>
                      <input
                        value={currency}
                        readOnly
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                      />
                    </Field>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                    disabled={ui === "loading"}
                  >
                    {copy.cancel}
                  </button>

                  <button
                    type="button"
                    onClick={save}
                    disabled={!canSave || ui === "loading" || uoms.length === 0}
                    className={cx(
                      "h-10 rounded-xl border border-blue-800 px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:border-blue-300 disabled:opacity-60",
                      "!bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-950 hover:to-blue-800"
                    )}
                  >
                    {ui === "loading" ? copy.saving : copy.save}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}
