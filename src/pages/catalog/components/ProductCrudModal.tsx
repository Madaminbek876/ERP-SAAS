import { useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import type { Product, ProductPatchPayload } from "../api/ProductsApi"
import { extractProductApiErrorMessage, productsApi } from "../api/ProductsApi"
import Portal from "@/pages/documents/components/Portal"
import { warehouseApi } from "@/pages/sklad/warehouse/api/warehouseApi"
import type { MovementItem } from "@/pages/sklad/warehouse/api/types"
import { formatIntegerInput, parseIntegerInput } from "@/lib/numberFormat"
import { printBarcodeLabel, sanitizeBarcodeInput } from "@/lib/barcode"
import { useI18n } from "@/i18n"
import { useDebounce } from "@/hooks/useDebounce"
import { barcodeApi } from "../api/barcodeApi"
import { dictsApi, type ProductCategoryRow, type UomRow } from "@/pages/Settings/Api/dictsApi"

function cx(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ")
}

function normalizeLookupName(value?: string | null) {
  return String(value ?? "").trim().toLocaleLowerCase()
}

function resolveLookupIdByName<T extends { id: number; name: string }>(
  options: T[],
  label?: string | null
) {
  const normalizedLabel = normalizeLookupName(label)
  if (!normalizedLabel) return ""
  return options.find((option) => normalizeLookupName(option.name) === normalizedLabel)?.id ?? ""
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

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function guessProductFileName(filename: string | null, fallbackBase: string, contentType: string) {
  if (filename) return filename

  const normalizedType = String(contentType || "").toLowerCase()
  if (normalizedType.includes("pdf")) return `${fallbackBase}.pdf`
  if (normalizedType.includes("spreadsheetml") || normalizedType.includes("excel")) return `${fallbackBase}.xlsx`
  if (normalizedType.includes("csv")) return `${fallbackBase}.csv`
  return `${fallbackBase}.bin`
}

type Mode = "view" | "edit" | "delete"
type MovementTab = "ALL" | "IN" | "OUT" | "TRANSFER" | "RETURN" | "WASTE"

function fmtDate(v?: string, locale = "uz-UZ") {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtQty(v: number, locale = "uz-UZ") {
  return new Intl.NumberFormat(locale).format(Number(v || 0))
}

function formatMovementType(value?: string, language: "uz" | "ru" | "en" = "uz") {
  const t = String(value || "").toUpperCase()
  if (t.includes("IN") || t.includes("RECEIPT")) return language === "ru" ? "Приход" : language === "en" ? "Receipt" : "Kirim"
  if (t.includes("OUT") || t.includes("ISSUE")) return language === "ru" ? "Расход" : language === "en" ? "Issue" : "Chiqim"
  if (t.includes("TRANSFER")) return language === "ru" ? "Перемещение" : language === "en" ? "Transfer" : "Ko'chirish"
  if (t.includes("RETURN")) return language === "ru" ? "Возврат" : language === "en" ? "Return" : "Qaytish"
  if (t.includes("WASTE")) return language === "ru" ? "Списание" : language === "en" ? "Write-off" : "Hisobdan chiqarish"
  return t || "-"
}

function normText(v: unknown) {
  return String(v || "").trim().toLowerCase()
}

function classifyMovement(row: MovementItem): Exclude<MovementTab, "ALL"> {
  const movementText = String(row.movement_type ?? row.type ?? "").toUpperCase()
  const refText = String(row.ref_type ?? "").toUpperCase()
  const noteText = String(row.note ?? "").toUpperCase()
  const full = `${movementText} ${refText} ${noteText}`

  if (full.includes("WASTE") || full.includes("SPIS") || full.includes("WRITE_OFF")) return "WASTE"
  if (full.includes("TRANSFER")) return "TRANSFER"
  if (full.includes("RETURN")) return "RETURN"
  if (full.includes("OUT") || full.includes("ISSUE")) return "OUT"
  if (full.includes("IN") || full.includes("RECEIPT")) return "IN"

  const qty = Number(row.qty || 0)
  return qty < 0 ? "OUT" : "IN"
}

function matchProductMovements(rows: MovementItem[], product: Product): MovementItem[] {
  const productId = Number(product.id || 0)
  const productName = normText(product.name)

  const strict = rows.filter((row) => {
    const itemType = String((row.item_type ?? "") || "").toUpperCase()
    const itemId = Number(row.item_id || 0)
    return itemType === "FINISHED_PRODUCT" && itemId === productId
  })
  if (strict.length > 0) return strict

  const looseById = rows.filter((row) => {
    const itemType = String((row.item_type ?? "") || "").toUpperCase()
    const itemId = Number(row.item_id || 0)
    const typeOk = !itemType || itemType === "ITEM" || itemType === "PRODUCT" || itemType === "FINISHED_PRODUCT"
    return typeOk && itemId === productId
  })
  if (looseById.length > 0) return looseById

  const byName = rows.filter((row) => normText((row as any).itemName) === productName)
  return byName
}

function formatMovementDocument(row: MovementItem, documentLabel: string) {
  if (row.ref_type) return `${row.ref_type}${row.ref_id ? ` #${row.ref_id}` : ""}`
  if (row.ref_id) return `${documentLabel} #${row.ref_id}`
  return "-"
}

function resolveMovementFromLabel(
  row: MovementItem,
  labels: { externalSource: string }
) {
  const movementType = String(row.movement_type ?? row.type ?? "").toUpperCase()
  const fromName = String((row as any).from_location_name ?? "")
  const locationName = String(row.location_name ?? "")
  return (
    fromName ||
    (movementType.includes("IN") || movementType.includes("RECEIPT")
      ? labels.externalSource
      : locationName || "-")
  )
}

function resolveMovementToLabel(
  row: MovementItem,
  labels: { externalTarget: string }
) {
  const movementType = String(row.movement_type ?? row.type ?? "").toUpperCase()
  const toName = String((row as any).to_location_name ?? "")
  const locationName = String(row.location_name ?? "")
  return (
    toName ||
    (movementType.includes("OUT") || movementType.includes("ISSUE") || movementType.includes("WASTE")
      ? labels.externalTarget
      : locationName || "-")
  )
}

function escapeCsvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`
}

export default function ProductCrudModal({
  open,
  mode,
  current,
  onRequestEdit,
  onClose,
  onChanged,
}: {
  open: boolean
  mode: Mode
  current: Product | null
  onRequestEdit?: () => void
  onClose: () => void
  onChanged?: () => void
}) {
  const { language } = useI18n()
  const [ui, setUi] = useState<"idle" | "loading" | "ready">("idle")
  const [err, setErr] = useState<string | null>(null)

  const [categories, setCategories] = useState<ProductCategoryRow[]>([])
  const [uoms, setUoms] = useState<UomRow[]>([])

  const [product, setProduct] = useState<Product | null>(null)
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
  const debouncedBarcode = useDebounce(barcode, 450)
  const currency: "UZS" = "UZS"
  const [busyAction, setBusyAction] = useState<"idle" | "printing" | "exporting">("idle")

  const [movementRows, setMovementRows] = useState<MovementItem[]>([])
  const [movementLoading, setMovementLoading] = useState(false)
  const [movementError, setMovementError] = useState("")
  const [movementTab, setMovementTab] = useState<MovementTab>("ALL")
  const [selectedMovement, setSelectedMovement] = useState<MovementItem | null>(null)

  const readOnly = mode === "view" || mode === "delete"
  const resolvedProduct = product ?? current
  const copy =
    language === "ru"
      ? {
          dictError: "Ошибка загрузки справочников (category/uom).",
          detailError: "Не удалось загрузить детали товара",
          movementsError: "Не удалось загрузить движения товара",
          deleteError: "Ошибка удаления",
          requiredName: "Название обязательно.",
          missingCategory: "Категория не выбрана.",
          missingUom: "UoM не выбран.",
          invalidPrice: "Цена указана неверно.",
          saveError: "Ошибка сохранения",
          titleView: "Просмотр товара",
          titleEdit: "Редактирование товара",
          titleDelete: "Удаление товара",
          deleteQuestion: "Удалить товар",
          name: "Название *",
          category: "Категория *",
          categoryEmpty: "Не выбрано",
          uom: "UoM *",
          uomEmpty: "(UoM не найден)",
          price: "Цена продажи (необязательно)",
          currency: "Валюта",
          createdAt: "Создано",
          updatedAt: "Последнее изменение",
          state: "Текущее состояние",
          deleted: "Удален",
          active: "Активный",
          movements: "Движения товара",
          rows: "Количество строк",
          totalIn: "Всего приход",
          totalOut: "Всего уменьшено",
          writeOff: "Списано",
          currentStock: "Текущий остаток",
          all: "Все",
          in: "Приход",
          out: "Расход",
          transfer: "Перемещение",
          ret: "Возврат",
          waste: "Списание",
          date: "Дата",
          movementType: "Тип движения",
          from: "Откуда",
          to: "Куда",
          doc: "Документ",
          qty: "Количество",
          note: "Примечание",
          loading: "Загрузка...",
          noMovements: "Для выбранной вкладки движения не найдены.",
          externalSource: "Внешний источник",
          externalTarget: "Внешнее направление",
          document: "Документ",
          edit: "Редактировать",
          close: "Закрыть",
          waiting: "Подождите...",
          delete: "Удалить",
          save: "Сохранить",
        }
      : language === "en"
        ? {
            dictError: "Failed to load dictionaries (category/uom).",
            detailError: "Failed to load product details",
            movementsError: "Failed to load product movements",
            deleteError: "Delete error",
            requiredName: "Name is required.",
            missingCategory: "Category is not selected.",
            missingUom: "UoM is not selected.",
            invalidPrice: "Invalid price.",
            saveError: "Save error",
            titleView: "View product",
            titleEdit: "Edit product",
            titleDelete: "Delete product",
            deleteQuestion: "Delete product",
            name: "Name *",
            category: "Category",
            categoryEmpty: "Not selected",
            uom: "UoM *",
            uomEmpty: "(UoM not found)",
            price: "Selling price (optional)",
            currency: "Currency",
            createdAt: "Created at",
            updatedAt: "Updated at",
            state: "Current state",
            deleted: "Deleted",
            active: "Active",
            movements: "Product movements",
            rows: "Rows",
            totalIn: "Total in",
            totalOut: "Total reduced",
            writeOff: "Written off",
            currentStock: "Current stock",
            all: "All",
            in: "In",
            out: "Out",
            transfer: "Transfer",
            ret: "Return",
            waste: "Write-off",
            date: "Date",
            movementType: "Movement type",
            from: "From",
            to: "To",
            doc: "Document",
            qty: "Qty",
            note: "Note",
            loading: "Loading...",
            noMovements: "No movements found for the selected tab.",
            externalSource: "External source",
            externalTarget: "External destination",
            document: "Document",
            edit: "Edit",
            close: "Close",
            waiting: "Please wait...",
            delete: "Delete",
            save: "Save",
          }
        : {
            dictError: "Dicts yuklashda xatolik (category/uom).",
            detailError: "Mahsulot detail yuklanmadi",
            movementsError: "Tovar harakatlari yuklanmadi",
            deleteError: "O'chirishda xatolik",
            requiredName: "Nomi majburiy.",
            missingCategory: "Kategoriya tanlanmagan.",
            missingUom: "UoM tanlanmagan.",
            invalidPrice: "Narx noto'g'ri.",
            saveError: "Saqlashda xatolik",
            titleView: "Mahsulotni ko'rish",
            titleEdit: "Mahsulotni tahrirlash",
            titleDelete: "Mahsulotni o'chirish",
            deleteQuestion: "mahsulotini o'chirmoqchimisiz?",
            name: "Nomi *",
            category: "Kategoriya",
            categoryEmpty: "Tanlanmagan",
            uom: "UoM *",
            uomEmpty: "(UoM topilmadi)",
            price: "Sotuv narxi (ixtiyoriy)",
            currency: "Valyuta",
            createdAt: "Yaratilgan vaqti",
            updatedAt: "Oxirgi o'zgartirilgan vaqti",
            state: "Joriy holat",
            deleted: "O'chirilgan",
            active: "Active",
            movements: "Tovarlar harakati",
            rows: "Qatorlar soni",
            totalIn: "Jami kirim",
            totalOut: "Jami kamaydi (minus)",
            writeOff: "Spisaniyaga ketgan",
            currentStock: "Joriy qoldiq",
            all: "Barchasi",
            in: "Kirim",
            out: "Chiqim",
            transfer: "Ko'chirish",
            ret: "Qaytish",
            waste: "Hisobdan chiqarish",
            date: "Sana",
            movementType: "Harakat turi",
            from: "Qayerdan",
            to: "Qayerga",
            doc: "Hujjat",
            qty: "Miqdor",
            note: "Izoh",
            loading: "Yuklanmoqda...",
            noMovements: "Tanlangan tab bo'yicha harakat topilmadi.",
            externalSource: "Tashqi manba",
            externalTarget: "Tashqi yo'nalish",
            document: "Hujjat",
            edit: "Tahrirlash",
            close: "Yopish",
            waiting: "Kutilmoqda...",
            delete: "O'chirish",
            save: "Saqlash",
          }
  const barcodeCopy =
    language === "ru"
      ? {
          label: "Штрих-код",
          locked: "Штрих-код после создания товара не редактируется.",
          placeholder: "Например: 2001234567890",
          generate: "Создать",
          generating: "Создается...",
          checking: "Проверка штрих-кода...",
          available: "Штрих-код свободен, можно использовать.",
          currentProduct: (label: string) => `Этот штрих-код уже привязан к текущему товару ${label}.`,
          duplicate: (label: string) => `Этот штрих-код уже привязан к товару ${label}.`,
          generateError: "Не удалось создать штрих-код.",
          scanError: "Не удалось проверить штрих-код.",
          conflictSave: "Укажите другой штрих-код. Этот код уже используется.",
          empty: "-",
          print: "Печать",
          printUnavailable: "Штрих-код пустой или неверный.",
          printError: "Не удалось распечатать штрих-код.",
        }
      : language === "en"
        ? {
            label: "Barcode",
            placeholder: "For example: 2001234567890",
            generate: "Generate",
            generating: "Generating...",
            checking: "Checking barcode...",
            available: "Barcode is available and ready to use.",
            currentProduct: (label: string) => `This barcode already belongs to the current product ${label}.`,
            duplicate: (label: string) => `This barcode is already linked to ${label}.`,
            generateError: "Failed to generate barcode.",
            scanError: "Failed to verify barcode.",
            conflictSave: "Choose another barcode. This one is already used.",
            locked: "Barcode cannot be changed after product creation.",
            empty: "-",
            print: "Print",
            printUnavailable: "Barcode is empty or invalid.",
            printError: "Failed to print barcode.",
          }
        : {
            label: "Shtrix kod",
            placeholder: "Masalan: 2001234567890",
            generate: "Yaratish",
            generating: "Yaratilmoqda...",
            checking: "Shtrix kod tekshirilmoqda...",
            available: "Shtrix kod bo'sh, ishlatish mumkin.",
            currentProduct: (label: string) => `Bu shtrix kod joriy ${label} mahsulotiga biriktirilgan.`,
            duplicate: (label: string) => `Bu shtrix kod allaqachon ${label} mahsulotiga biriktirilgan.`,
            generateError: "Shtrix kod yaratib bo'lmadi.",
            scanError: "Shtrix kodni tekshirib bo'lmadi.",
            conflictSave: "Boshqa shtrix kod kiriting. Bu kod allaqachon ishlatilgan.",
            locked: "Shtrix kod mahsulot yaratilgandan keyin o'zgartirilmaydi.",
            empty: "-",
            print: "Chop etish",
            printUnavailable: "Shtrix kod bo'sh yoki noto'g'ri.",
            printError: "Shtrix kodni chop etib bo'lmadi.",
          }
  const printSentMessage =
    language === "ru"
      ? "Этикетка отправлена на печать."
      : language === "en"
        ? "Label sent to printer."
        : "Etiketka printerga yuborildi."
  const minPriceLabel =
    language === "ru"
      ? "РњРёРЅ. С†РµРЅР° (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)"
      : language === "en"
        ? "Min price (optional)"
        : "Minimal narx (ixtiyoriy)"
  const actionCopy =
    language === "ru"
      ? {
          export: "Eksport",
          exporting: "Eksport...",
          printing: "Pechat...",
          exportError: "Ne udalos vygruzit fayl.",
        }
      : language === "en"
        ? {
            export: "Export",
            exporting: "Exporting...",
            printing: "Printing...",
            exportError: "Failed to export file.",
          }
        : {
            export: "Eksport",
            exporting: "Eksport...",
            printing: "Chop etilmoqda...",
            exportError: "Faylni eksport qilib bo'lmadi.",
          }
  const movementDetailTitle =
    language === "ru" ? "Детали движения" : language === "en" ? "Movement details" : "Harakat tafsiloti"
  const closeDetailLabel =
    language === "ru" ? "Закрыть" : language === "en" ? "Close" : "Yopish"

  useEffect(() => {
    if (!open) return
    setErr(null)
    setUi("loading")
    setBusyAction("idle")
    setBarcodeStatus({ tone: "idle", message: "" })

    let cancelled = false
    ;(async () => {
      try {
        const [cats, uu] = await Promise.all([
          dictsApi.listProductCategories().catch(() => []),
          dictsApi.listUom().catch(() => []),
        ])
        if (cancelled) return
        setCategories(cats)
        setUoms(uu)
        setUi("ready")
      } catch (e: any) {
        if (cancelled) return
        setUi("ready")
        setErr(e?.message || copy.dictError)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ"
  const resolvedMinPriceLabel = language === "ru" ? "Мин. цена (необязательно)" : minPriceLabel
  const resolvedActionCopy =
    language === "ru"
      ? {
          export: "Экспорт",
          exporting: "Экспорт...",
          printing: "Печать...",
          exportError: "Не удалось выгрузить файл.",
        }
      : actionCopy
  const resolvedMovementDetailTitle = language === "ru" ? "Детали движения" : movementDetailTitle
  const resolvedCloseDetailLabel = language === "ru" ? "Закрыть" : closeDetailLabel

  useEffect(() => {
    if (!open) {
      setSelectedMovement(null)
      return
    }
    if (!current) return

    setProduct(current)
    setMovementTab("ALL")
    setSelectedMovement(null)
  }, [open, current])

  useEffect(() => {
    if (!open || !current?.id || mode === "delete") return
    let cancelled = false

    const loadDetail = async () => {
      try {
        const detail = await productsApi.detail(current.id)
        if (!cancelled) setProduct(detail)
      } catch (e: any) {
        if (!cancelled) {
          const message = extractProductApiErrorMessage(e, copy.detailError)
          setErr((prev) => prev ?? message)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [open, current?.id, mode])

  useEffect(() => {
    if (!open || !resolvedProduct) return
    setName(resolvedProduct.name ?? "")
    setCategoryId(resolvedProduct.category ?? "")
    setUomId(resolvedProduct.uom ?? "")
    setBarcode(sanitizeBarcodeInput(String(resolvedProduct.barcode ?? "")))
    setBarcodeStatus({ tone: "idle", message: "" })
    setMinPrice(
      resolvedProduct.min_price == null
        ? ""
        : formatIntegerInput(String(Math.trunc(Number(resolvedProduct.min_price))))
    )
    setSellingPrice(
      resolvedProduct.selling_price == null
        ? ""
        : formatIntegerInput(String(Math.trunc(Number(resolvedProduct.selling_price))))
    )
  }, [open, resolvedProduct])

  useEffect(() => {
    if (!open || !resolvedProduct) return

    if (categoryId === "" && categories.length > 0) {
      const resolvedCategoryId = resolveLookupIdByName(categories, resolvedProduct.category_name)
      if (resolvedCategoryId !== "") setCategoryId(resolvedCategoryId)
    }

    if (uomId === "" && uoms.length > 0) {
      const resolvedUomId = resolveLookupIdByName(uoms, resolvedProduct.uom_name)
      if (resolvedUomId !== "") setUomId(resolvedUomId)
    }
  }, [open, resolvedProduct, categoryId, uomId, categories, uoms])

  useEffect(() => {
    if (!open || !resolvedProduct?.id || mode === "delete") return
    let cancelled = false

    const loadMovements = async () => {
      try {
        setMovementLoading(true)
        setMovementError("")

        const targeted = await warehouseApi.listMovementsPage({
          page: 1,
          page_size: 300,
          item_type: "FINISHED_PRODUCT",
          item_id: Number(resolvedProduct.id),
          product: Number(resolvedProduct.id),
          product_id: Number(resolvedProduct.id),
        } as any)

        let list = matchProductMovements((targeted.results ?? []) as MovementItem[], resolvedProduct)
        if (list.length === 0) {
          const fallback = await warehouseApi.listMovementsPage({ page: 1, page_size: 500 } as any)
          list = matchProductMovements((fallback.results ?? []) as MovementItem[], resolvedProduct)
        }

        const sorted = [...list].sort((a, b) => {
          const ta = new Date(a.date || "").getTime() || 0
          const tb = new Date(b.date || "").getTime() || 0
          return tb - ta
        })

        if (!cancelled) setMovementRows(sorted)
      } catch (e: any) {
        if (!cancelled) setMovementError(e?.message || copy.movementsError)
      } finally {
        if (!cancelled) setMovementLoading(false)
      }
    }

    void loadMovements()

    return () => {
      cancelled = true
    }
  }, [open, resolvedProduct, mode])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const canSave = useMemo(() => {
    if (readOnly) return false
    if (!name.trim() || uomId === "") return false
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
  }, [barcodeStatus.tone, minPrice, name, uomId, sellingPrice, readOnly])
  const isBusy = ui === "loading" || busyAction !== "idle"

  useEffect(() => {
    if (!open || mode === "edit" || mode === "view" || mode === "delete") {
      setBarcodeStatus({ tone: "idle", message: "" })
      return
    }

    const cleanBarcode = sanitizeBarcodeInput(debouncedBarcode)
    if (!cleanBarcode || cleanBarcode.length < 8) {
      setBarcodeStatus({ tone: "idle", message: "" })
      return
    }

    let cancelled = false
    setBarcodeStatus({ tone: "loading", message: barcodeCopy.checking })

    ;(async () => {
      try {
        const found = await barcodeApi.scan(cleanBarcode)
        if (cancelled) return

        if (!found) {
          setBarcodeStatus({ tone: "success", message: barcodeCopy.available })
          return
        }

        const foundLabel = formatBarcodeProductLabel(found.name, found.id)
        if (resolvedProduct?.id && Number(found.id) === Number(resolvedProduct.id)) {
          setBarcodeStatus({ tone: "success", message: barcodeCopy.currentProduct(foundLabel) })
          return
        }

        setBarcodeStatus({
          tone: "warning",
          message: barcodeCopy.duplicate(foundLabel),
        })
      } catch (e: any) {
        if (cancelled) return
        setBarcodeStatus({ tone: "error", message: e?.message || barcodeCopy.scanError })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, mode, debouncedBarcode, resolvedProduct?.id, language])

  const totalIn = useMemo(
    () =>
      movementRows
        .filter((x) => {
          const t = String(x.movement_type ?? x.type ?? "").toUpperCase()
          return t.includes("IN") || t.includes("RECEIPT") || t.includes("RETURN")
        })
        .reduce((sum, x) => sum + Number(x.qty || 0), 0),
    [movementRows]
  )

  const totalOut = useMemo(
    () =>
      movementRows
        .filter((x) => {
          const t = String(x.movement_type ?? x.type ?? "").toUpperCase()
          return t.includes("OUT") || t.includes("ISSUE") || t.includes("WASTE")
        })
        .reduce((sum, x) => sum + Number(x.qty || 0), 0),
    [movementRows]
  )

  const movementStats = useMemo(() => {
    const base = { ALL: 0, IN: 0, OUT: 0, TRANSFER: 0, RETURN: 0, WASTE: 0 } as Record<MovementTab, number>
    for (const row of movementRows) {
      const qty = Number(row.qty || 0)
      const kind = classifyMovement(row)
      base.ALL += qty
      base[kind] += qty
    }
    return base
  }, [movementRows])

  const filteredMovementRows = useMemo(() => {
    if (movementTab === "ALL") return movementRows
    return movementRows.filter((r) => classifyMovement(r) === movementTab)
  }, [movementRows, movementTab])

  const fallbackStock = useMemo(() => totalIn - totalOut, [totalIn, totalOut])
  const currentStock = useMemo(() => {
    const raw =
      Number(resolvedProduct?.stock_qty ?? NaN) ||
      Number(resolvedProduct?.qty_onhand ?? NaN) ||
      Number(resolvedProduct?.balance_qty ?? NaN) ||
      Number(resolvedProduct?.qty ?? NaN) ||
      Number(resolvedProduct?.quantity ?? NaN)
    return Number.isFinite(raw) ? raw : fallbackStock
  }, [resolvedProduct, fallbackStock])

  const writeOffQty = useMemo(
    () =>
      movementRows
        .filter((x) => classifyMovement(x) === "WASTE")
        .reduce((sum, x) => sum + Math.abs(Number(x.qty || 0)), 0),
    [movementRows]
  )

  const selectedCategoryLabel = useMemo(() => {
    if (categoryId === "") return copy.categoryEmpty
    const category = categories.find((row) => Number(row.id) === Number(categoryId))
    return category ? `${category.name} (#${category.id})` : copy.categoryEmpty
  }, [categories, categoryId, copy.categoryEmpty])

  const selectedUomLabel = useMemo(() => {
    if (uomId === "") return copy.uomEmpty
    const uom = uoms.find((row) => Number(row.id) === Number(uomId))
    return uom ? `${uom.name} (#${uom.id})` : copy.uomEmpty
  }, [copy.uomEmpty, uomId, uoms])

  const minusQty = useMemo(
    () =>
      movementRows
        .filter((x) => {
          const kind = classifyMovement(x)
          return kind === "OUT" || kind === "WASTE"
        })
        .reduce((sum, x) => sum + Math.abs(Number(x.qty || 0)), 0),
    [movementRows]
  )

  if (!open || !resolvedProduct) return null

  async function submit() {
    setErr(null)

    if (!resolvedProduct) return

    if (mode === "delete") {
      try {
        setUi("loading")
        await productsApi.remove(resolvedProduct.id)
        onChanged?.()
        onClose()
      } catch (e: any) {
        setUi("ready")
        setErr(e?.message || copy.deleteError)
      }
      return
    }

    if (mode === "edit") {
      if (!name.trim()) return setErr(copy.requiredName)
      if (uomId === "") return setErr(copy.missingUom)

      const payload: ProductPatchPayload = {
        name: name.trim(),
        category: categoryId === "" ? null : Number(categoryId),
        uom: Number(uomId),
        min_price: null,
        selling_price: null,
        currency,
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
        await productsApi.patch(resolvedProduct.id, payload)
        onChanged?.()
        onClose()
      } catch (e: any) {
        setUi("ready")
        setErr(extractProductApiErrorMessage(e, copy.saveError))
      }
    }
  }

  async function handleExportProduct() {
    if (!resolvedProduct) return
    if (filteredMovementRows.length === 0) {
      setErr(copy.noMovements)
      return
    }

    try {
      setErr(null)
      setBusyAction("exporting")
      const lines = [
        [
          copy.date,
          copy.movementType,
          copy.from,
          copy.to,
          copy.doc,
          copy.qty,
          copy.note,
        ]
          .map(escapeCsvCell)
          .join(";"),
        ...filteredMovementRows.map((row) =>
          [
            fmtDate(String(row.date ?? "")),
            formatMovementType(String(row.movement_type ?? row.type ?? ""), language),
            resolveMovementFromLabel(row, { externalSource: copy.externalSource }),
            resolveMovementToLabel(row, { externalTarget: copy.externalTarget }),
            formatMovementDocument(row, copy.document),
            fmtQty(Number(row.qty || 0)),
            String(row.note ?? "-"),
          ]
            .map(escapeCsvCell)
            .join(";")
        ),
      ]
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
      const csvBlob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
      triggerBrowserDownload(csvBlob, `product_${resolvedProduct.id}_movements_${stamp}.csv`)
    } catch (error: any) {
      setErr(extractProductApiErrorMessage(error, resolvedActionCopy.exportError))
    } finally {
      setBusyAction("idle")
    }
  }

  async function handlePrintBarcode() {
    if (!resolvedProduct) return
    const normalizedBarcode = sanitizeBarcodeInput(String(resolvedProduct.barcode ?? barcode ?? ""))
    if (!normalizedBarcode) {
      setErr(barcodeCopy.printUnavailable)
      return
    }

    try {
      setErr(null)
      setBusyAction("printing")
      printBarcodeLabel(normalizedBarcode, {
        title: resolvedProduct.name || "Product",
        subtitle: normalizedBarcode,
      })
      toast.success(printSentMessage)
    } catch (error: any) {
      setErr(extractProductApiErrorMessage(error, barcodeCopy.printError))
    } finally {
      setBusyAction("idle")
    }
  }

  const createdAt = String((resolvedProduct as any)?.created_at ?? "")
  const updatedAt = String((resolvedProduct as any)?.updated_at ?? "")

  return (
    <Portal>
      <div className="fixed inset-0 z-[1000] bg-[rgba(15,23,42,0.38)] backdrop-blur-[3px]">
        <div className="hide-scrollbar min-h-full w-full overflow-y-auto p-4">
          <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
            <div className="hide-scrollbar w-full max-w-[1180px] rounded-[28px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)] max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2f6fed]">Products</div>
                <div className="mt-2 text-[28px] font-extrabold text-[#16325c]">
                  {mode === "view" ? copy.titleView : mode === "edit" ? copy.titleEdit : copy.titleDelete}
                </div>

                {err && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div>
                )}

                {mode === "delete" ? (
                  <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 p-5 text-base text-rose-700">
                    <b>{resolvedProduct.name}</b> {copy.deleteQuestion}
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="grid grid-cols-1 gap-5 rounded-[22px] border border-[#d7e3f7] bg-white p-5 shadow-sm">
                      <Field label={copy.name}>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f8fbff] px-4 text-base text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]"
                          disabled={readOnly || isBusy}
                        />
                      </Field>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label={copy.category}>
                          {readOnly ? (
                            <input
                              value={selectedCategoryLabel}
                              readOnly
                              className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f1f6ff] px-4 text-base text-[#16325c] outline-none"
                            />
                          ) : (
                            <select
                              value={categoryId === "" ? "" : String(categoryId)}
                              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
                              className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f8fbff] px-4 text-base text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]"
                              disabled={isBusy}
                            >
                              <option value="">{copy.categoryEmpty}</option>
                              {categories.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {c.name} (#{c.id})
                                </option>
                              ))}
                            </select>
                          )}
                        </Field>

                        <Field label={copy.uom}>
                          {readOnly ? (
                            <input
                              value={selectedUomLabel}
                              readOnly
                              className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f1f6ff] px-4 text-base text-[#16325c] outline-none"
                            />
                          ) : (
                            <select
                              value={uomId === "" ? "" : String(uomId)}
                              onChange={(e) => setUomId(e.target.value ? Number(e.target.value) : "")}
                              className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f8fbff] px-4 text-base text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]"
                              disabled={isBusy}
                            >
                              {uoms.length === 0 ? <option value="">{copy.uomEmpty}</option> : null}
                              <option value="">{copy.categoryEmpty}</option>
                              {uoms.map((u) => (
                                <option key={u.id} value={String(u.id)}>
                                  {u.name} (#{u.id})
                                </option>
                              ))}
                            </select>
                          )}
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label={barcodeCopy.label}>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                value={barcode || barcodeCopy.empty}
                                readOnly
                                className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f1f6ff] px-4 text-base text-[#16325c] outline-none"
                              />
                              <button
                                type="button"
                                onClick={handlePrintBarcode}
                                disabled={!resolvedProduct || isBusy}
                                className="h-12 shrink-0 rounded-xl border border-[#b9cdf3] bg-white px-4 text-sm font-semibold text-[#1d4ed8] shadow-sm transition hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busyAction === "printing" ? resolvedActionCopy.printing : barcodeCopy.print}
                              </button>
                            </div>
                            {mode === "edit" ? (
                              <div className="text-xs font-medium text-slate-500">{barcodeCopy.locked}</div>
                            ) : null}
                          </div>
                        </Field>

                        <Field label={resolvedMinPriceLabel}>
                          <input
                            value={minPrice}
                            onChange={(e) => setMinPrice(formatIntegerInput(e.target.value))}
                            inputMode="numeric"
                            placeholder="19 000"
                            className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f8fbff] px-4 text-base text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]"
                            disabled={readOnly || isBusy}
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label={copy.price}>
                          <input
                            value={sellingPrice}
                            onChange={(e) => setSellingPrice(formatIntegerInput(e.target.value))}
                            inputMode="numeric"
                            placeholder="19 000"
                            className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f8fbff] px-4 text-base text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]"
                            disabled={readOnly || isBusy}
                          />
                        </Field>

                        <Field label={copy.currency}>
                          <input
                            value={currency}
                            readOnly
                            className="h-12 w-full rounded-xl border border-[#c7d7ef] bg-[#f1f6ff] px-4 text-base text-[#16325c] outline-none"
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-[20px] border border-[#d7e3f7] bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.createdAt}</div>
                        <div className="mt-2 text-base font-semibold text-[#16325c]">{fmtDate(createdAt, locale)}</div>
                      </div>
                      <div className="rounded-[20px] border border-[#d7e3f7] bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.updatedAt}</div>
                        <div className="mt-2 text-base font-semibold text-[#16325c]">{fmtDate(updatedAt, locale)}</div>
                      </div>
                      <div className="rounded-[20px] border border-[#d7e3f7] bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.state}</div>
                        <div className="mt-2 text-base font-semibold text-[#16325c]">
                          {resolvedProduct.deleted_at === undefined ? "-" : resolvedProduct.deleted_at ? copy.deleted : copy.active}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-[22px] border border-[#d7e3f7] bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-extrabold text-[#16325c]">{copy.movements}</div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.rows}: {filteredMovementRows.length} / {movementRows.length}</div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-[18px] border border-emerald-100 bg-emerald-50 p-3">
                          <div className="text-[11px] text-emerald-700">{copy.totalIn}</div>
                          <div className="text-base font-bold text-emerald-800">{fmtQty(totalIn, locale)}</div>
                        </div>
                        <div className="rounded-[18px] border border-rose-100 bg-rose-50 p-3">
                          <div className="text-[11px] text-rose-700">{copy.totalOut}</div>
                          <div className="text-base font-bold text-rose-800">{fmtQty(minusQty, locale)}</div>
                        </div>
                        <div className="rounded-[18px] border border-amber-100 bg-amber-50 p-3">
                          <div className="text-[11px] text-amber-700">{copy.writeOff}</div>
                          <div className="text-base font-bold text-amber-800">{fmtQty(writeOffQty, locale)}</div>
                        </div>
                        <div className="rounded-[18px] border border-blue-100 bg-blue-50 p-3">
                          <div className="text-[11px] text-blue-700">{copy.currentStock}</div>
                          <div className="text-base font-bold text-blue-800">{fmtQty(currentStock, locale)}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "ALL", label: copy.all },
                          { key: "IN", label: copy.in },
                          { key: "OUT", label: copy.out },
                          { key: "TRANSFER", label: copy.transfer },
                          { key: "RETURN", label: copy.ret },
                          { key: "WASTE", label: copy.waste },
                        ].map((tab) => {
                          const key = tab.key as MovementTab
                          const active = movementTab === key
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setMovementTab(key)}
                              className={cx(
                                "rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
                                active
                                  ? "border-blue-700 bg-blue-700 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                              )}
                            >
                              {tab.label}: {fmtQty(movementStats[key], locale)}
                            </button>
                          )
                        })}
                      </div>

                      <div className="overflow-hidden rounded-[20px] border border-[#d7e3f7]">
                        <div className="overflow-x-auto">
                          <table className="min-w-[980px] w-full text-left text-sm">
                            <thead className="bg-[#f8fbff] text-slate-700">
                              <tr>
                                <th className="px-3 py-2 font-semibold">{copy.date}</th>
                                <th className="px-3 py-2 font-semibold">{copy.movementType}</th>
                                <th className="px-3 py-2 font-semibold">{copy.from}</th>
                                <th className="px-3 py-2 font-semibold">{copy.to}</th>
                                <th className="px-3 py-2 font-semibold">{copy.doc}</th>
                                <th className="px-3 py-2 text-right font-semibold">{copy.qty}</th>
                                <th className="px-3 py-2 font-semibold">{copy.note}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-900">
                              {movementLoading ? (
                                <tr>
                                  <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                                    {copy.loading}
                                  </td>
                                </tr>
                              ) : null}

                              {!movementLoading && movementError ? (
                                <tr>
                                  <td className="px-3 py-6 text-center text-rose-600" colSpan={7}>
                                    {movementError}
                                  </td>
                                </tr>
                              ) : null}

                              {!movementLoading && !movementError && filteredMovementRows.length === 0 ? (
                                <tr>
                                  <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                                    {copy.noMovements}
                                  </td>
                                </tr>
                              ) : null}

                              {!movementLoading && !movementError
                                ? filteredMovementRows.map((r, idx) => {
                                    const whereFrom = resolveMovementFromLabel(r, {
                                      externalSource: copy.externalSource,
                                    })
                                    const whereTo = resolveMovementToLabel(r, {
                                      externalTarget: copy.externalTarget,
                                    })
                                    const doc = formatMovementDocument(r, copy.document)

                                    return (
                                      <tr
                                        key={`${r.id ?? "m"}_${idx}`}
                                        className="cursor-pointer hover:bg-blue-50/40"
                                        onClick={() => setSelectedMovement(r)}
                                      >
                                        <td className="px-3 py-2">{fmtDate(r.date, locale)}</td>
                                        <td className="px-3 py-2">{formatMovementType(String(r.movement_type ?? r.type), language)}</td>
                                        <td className="px-3 py-2">{whereFrom}</td>
                                        <td className="px-3 py-2">{whereTo}</td>
                                        <td className="px-3 py-2 font-medium text-[#1d4ed8]">{doc}</td>
                                        <td className="px-3 py-2 text-right font-semibold">{fmtQty(Number(r.qty || 0), locale)}</td>
                                        <td className="px-3 py-2">{r.note || "-"}</td>
                                      </tr>
                                    )
                                  })
                                : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedMovement ? (
                  <div
                    className="fixed inset-0 z-[1010] bg-[rgba(15,23,42,0.42)] backdrop-blur-[2px]"
                    onClick={() => setSelectedMovement(null)}
                  >
                    <div className="flex min-h-full items-center justify-center p-4">
                      <div
                        className="w-full max-w-[760px] rounded-[24px] border border-[#d7e3f7] bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.45)]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="border-b border-[#e4ecf8] px-5 py-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
                            {resolvedMovementDetailTitle}
                          </div>
                          <div className="mt-2 text-2xl font-extrabold text-[#16325c]">
                            {fmtDate(String(selectedMovement.date ?? ""), locale)}
                          </div>
                        </div>

                        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                          <div className="rounded-[18px] border border-[#d7e3f7] bg-[#f8fbff] p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7ea1]">
                              {copy.movementType}
                            </div>
                            <div className="mt-2 text-base font-semibold text-[#16325c]">
                              {formatMovementType(String(selectedMovement.movement_type ?? selectedMovement.type), language)}
                            </div>
                          </div>

                          <div className="rounded-[18px] border border-[#d7e3f7] bg-[#f8fbff] p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7ea1]">
                              {copy.qty}
                            </div>
                            <div className="mt-2 text-base font-semibold text-[#16325c]">
                              {fmtQty(Number(selectedMovement.qty || 0), locale)}
                            </div>
                          </div>

                          <div className="rounded-[18px] border border-[#d7e3f7] bg-[#f8fbff] p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7ea1]">
                              {copy.from}
                            </div>
                            <div className="mt-2 text-base font-semibold text-[#16325c]">
                              {String(
                                (selectedMovement as any).from_location_name ??
                                  selectedMovement.location_name ??
                                  copy.externalSource
                              )}
                            </div>
                          </div>

                          <div className="rounded-[18px] border border-[#d7e3f7] bg-[#f8fbff] p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7ea1]">
                              {copy.to}
                            </div>
                            <div className="mt-2 text-base font-semibold text-[#16325c]">
                              {String(
                                (selectedMovement as any).to_location_name ??
                                  selectedMovement.location_name ??
                                  copy.externalTarget
                              )}
                            </div>
                          </div>

                          <div className="rounded-[18px] border border-[#d7e3f7] bg-[#f8fbff] p-4 md:col-span-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7ea1]">
                              {copy.doc}
                            </div>
                            <div className="mt-2 text-base font-semibold text-[#16325c]">
                              {selectedMovement.ref_type
                                ? `${selectedMovement.ref_type}${selectedMovement.ref_id ? ` #${selectedMovement.ref_id}` : ""}`
                                : selectedMovement.ref_id
                                  ? `${copy.document} #${selectedMovement.ref_id}`
                                  : "-"}
                            </div>
                          </div>

                          <div className="rounded-[18px] border border-[#d7e3f7] bg-[#f8fbff] p-4 md:col-span-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7ea1]">
                              {copy.note}
                            </div>
                            <div className="mt-2 text-base font-semibold text-[#16325c]">
                              {String(selectedMovement.note ?? "-")}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end border-t border-[#e4ecf8] px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedMovement(null)}
                            className="h-11 rounded-xl border border-[#d7e3f7] bg-white px-5 text-sm font-medium text-[#24406b] shadow-sm hover:bg-[#f8fbff]"
                          >
                            {resolvedCloseDetailLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-end gap-3">
                  {mode === "view" && (
                    <button
                       type="button"
                       onClick={handleExportProduct}
                       className="h-11 rounded-xl border border-[#d7e3f7] bg-white px-5 text-sm font-semibold text-[#24406b] shadow-sm hover:bg-[#f8fbff]"
                       disabled={isBusy || movementLoading || !!movementError || filteredMovementRows.length === 0}
                     >
                      {busyAction === "exporting" ? actionCopy.exporting : actionCopy.export}
                    </button>
                  )}

                  {mode === "view" && (
                    <button
                      type="button"
                      onClick={onRequestEdit}
                      className="h-11 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(29,78,216,0.18)]"
                      disabled={isBusy}
                    >
                      {copy.edit}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 rounded-xl border border-[#d7e3f7] bg-white px-5 text-sm font-medium text-[#24406b] shadow-sm hover:bg-[#f8fbff]"
                    disabled={isBusy}
                  >
                    {copy.close}
                  </button>

                  {mode !== "view" && (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={(mode === "edit" && !canSave) || isBusy}
                      className={cx(
                        "h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60",
                        mode === "delete"
                          ? "bg-rose-600 hover:bg-rose-700 shadow-[0_12px_24px_rgba(244,63,94,0.18)]"
                          : "bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] shadow-[0_12px_24px_rgba(29,78,216,0.18)]"
                      )}
                    >
                      {ui === "loading" ? copy.waiting : mode === "delete" ? copy.delete : copy.save}
                    </button>
                  )}
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  )
}
