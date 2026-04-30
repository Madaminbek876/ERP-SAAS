import { useCallback, useEffect, useMemo, useState } from "react"
import { List, Plus, Search, Trash2, X } from "lucide-react"
import { toast } from "react-toastify"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { warehouseApi } from "../api/warehouseApi"
import type { LookupItem, WarehouseAction } from "../api/types"
import { downloadLedgerExportFile, downloadWarehouseDocumentTemplate } from "../utils/exportFile"
import { useI18n } from "@/i18n"

type Props = {
  action: WarehouseAction
  title: string
  triggerLabel: string
  submitAction?: WarehouseAction
  forceMovementType?: string
  invertQty?: boolean
  initialCatalogGroup?: "ALL" | "PRODUCTS" | "MATERIALS"
  onSuccess?: (created?: Record<string, unknown>) => Promise<void> | void
}

type DraftLine = {
  kind: "PRODUCTS" | "MATERIALS"
  id: number
  name: string
  groupKey: string
  qty: number
  stock: number
}

type CatalogRow = {
  id: number
  name: string
  kind: "PRODUCTS" | "MATERIALS"
  groupKey: string
  groupLabel: string
}

function resolveWarehouseAction(action: WarehouseAction, forceMovementType?: string): WarehouseAction {
  if (action !== "waste-adjust") return action
  return String(forceMovementType || "WASTE").toUpperCase() === "ADJUST" ? "adjust" : "waste"
}

function actionToMovementType(action: WarehouseAction) {
  if (action === "receipt") return "IN"
  if (action === "issue") return "OUT"
  if (action === "return") return "RETURN"
  if (action === "waste") return "WASTE"
  if (action === "adjust") return "ADJUST"
  return undefined
}

function actionToExportParams(action: WarehouseAction) {
  if (action === "transfer") return { ref_type: "MANUAL_TRANSFER" }
  const movementType = actionToMovementType(action)
  return movementType ? { movement_type: movementType } : {}
}

function actionDocLabel(action: WarehouseAction, language: string) {
  if (language === "ru") {
    if (action === "waste") return "Списание"
    if (action === "adjust") return "Инвентаризация"
    if (action === "transfer") return "Перемещение"
    if (action === "receipt") return "Приход"
    if (action === "return") return "Возврат"
    if (action === "issue") return "Расход"
    return "Движение"
  }

  if (language === "en") {
    if (action === "waste") return "Write-off"
    if (action === "adjust") return "Inventory"
    if (action === "transfer") return "Transfer"
    if (action === "receipt") return "Receipt"
    if (action === "return") return "Return"
    if (action === "issue") return "Issue"
    return "Movement"
  }

  if (action === "waste") return "Hisobdan chiqarish"
  if (action === "adjust") return "Inventarizatsiya"
  if (action === "transfer") return "Ko'chirish"
  if (action === "receipt") return "Kirim"
  if (action === "return") return "Qaytarish"
  if (action === "issue") return "Chiqim"
  return "Harakat"
}

function buildOccurredAt(dateValue: string, timeValue: string) {
  const date = String(dateValue || "").trim()
  if (!date) return undefined
  const time = String(timeValue || "").trim() || "00:00"
  return `${date}T${time}:00`
}

export default function StockActionCreateDialog(props: Props) {
  const { language } = useI18n()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [locations, setLocations] = useState<Array<LookupItem & { warehouse_id?: number }>>([])
  const [products, setProducts] = useState<LookupItem[]>([])
  const [materials, setMaterials] = useState<LookupItem[]>([])

  const [warehouseLocationId, setWarehouseLocationId] = useState("")
  const [toWarehouseLocationId, setToWarehouseLocationId] = useState("")
  const [itemType, setItemType] = useState<"RAW_MATERIAL" | "FINISHED_PRODUCT">("RAW_MATERIAL")
  const [itemId, setItemId] = useState("")
  const [unitCost, setUnitCost] = useState("0")
  const [comment, setComment] = useState("")

  const [inventoryNo, setInventoryNo] = useState("")
  const [inventoryDate, setInventoryDate] = useState("")
  const [inventoryTime, setInventoryTime] = useState("")
  const [inventoryName, setInventoryName] = useState("")
  const [extraOpen, setExtraOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"goods">("goods")
  const [organization, setOrganization] = useState("")
  const [author, setAuthor] = useState("")
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogQuery, setCatalogQuery] = useState("")
  const [catalogGroup, setCatalogGroup] = useState<"ALL" | "PRODUCTS" | "MATERIALS">("ALL")
  const [catalogNameGroup, setCatalogNameGroup] = useState("ALL_NAMES")
  const [stockQtyMap, setStockQtyMap] = useState<Record<string, number>>({})
  const [stockLoading, setStockLoading] = useState(false)
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])

  const requestedAction = props.submitAction ?? props.action
  const resolvedAction = resolveWarehouseAction(requestedAction, props.forceMovementType)
  const isTransfer = resolvedAction === "transfer"
  const isInventoryAdjust = resolvedAction === "adjust"
  const isWriteOff = resolvedAction === "waste"
  const needsUnitCost = resolvedAction === "receipt"
  const docLabel = actionDocLabel(resolvedAction, language)
  const copy =
    language === "ru"
      ? {
          added: "Товар добавлен в список",
          excelDownloaded: "Excel-документ загружен",
          excelFailed: "Не удалось скачать Excel",
          selectLocation: "Выберите локацию",
          selectTargetLocation: "Выберите принимающую локацию",
          addProductFirst: "Сначала добавьте товар из группы",
          selectProduct: "Выберите товар",
          qtyPositive: "Количество должно быть положительным",
          savedCount: "записей сохранено",
          saveError: "Ошибка сохранения",
          actions: "Движения",
          print: "Печать",
          docNumber: "Номер документа",
          date: "Дата",
          time: "Время",
          warehouse: "Склад *",
          selectWarehouse: "Выберите склад",
          docName: resolvedAction === "issue" ? "Расход товара" : `${docLabel} название`,
          docNamePlaceholder:
            resolvedAction === "issue"
              ? "Расход товара"
              : resolvedAction === "receipt"
                ? "Например: Ручной приход"
                : resolvedAction === "return"
                  ? "Например: Возврат от клиента"
                  : resolvedAction === "transfer"
                    ? "Например: Перемещение из A1 в A3"
                    : resolvedAction === "adjust"
                      ? "Например: Мартовская проверка"
                      : "Например: Списание брака",
          extraFields: "+ Дополнительные поля",
          organization: "Организация",
          responsible: "Ответственный",
          add: "+ Добавить",
          fill: "Заполнить",
          fillSoon: "Добавление по списку скоро появится",
          exportExcel: "Экспорт в Excel",
          exporting: "Загрузка...",
          searchCatalog: "Поиск по названию товара",
          allProducts: "Все товары",
          finishedProducts: "Готовая продукция",
          materials: "Сырье и материалы",
          groups: "Группы",
          allGroups: "Все группы",
          stock: "Остаток",
          nothingFound: "Ничего не найдено",
          addedProducts: "Добавленные товары",
          qty: "Количество",
          edit: "Редактировать",
          save: "Сохранить",
          delete: "Удалить",
          unitCost: "Цена за единицу",
          targetLocation: "Принимающая локация",
          choose: "Выберите",
          note: "Комментарий",
          notePlaceholder: "Дополнительный комментарий",
          cancel: "Отмена",
          saving: "Сохранение...",
        }
      : language === "en"
        ? {
            added: "Item added to list",
            excelDownloaded: "Excel document downloaded",
            excelFailed: "Failed to download Excel",
            selectLocation: "Select location",
            selectTargetLocation: "Select destination location",
            addProductFirst: "First add an item from the group",
            selectProduct: "Select an item",
            qtyPositive: "Qty must be positive",
            savedCount: "records saved",
            saveError: "Save error",
            actions: "Movements",
            print: "Print",
            docNumber: "Document number",
            date: "Date",
            time: "Time",
            warehouse: "Warehouse *",
            selectWarehouse: "Select warehouse",
            docName: `${docLabel} name`,
            docNamePlaceholder:
              resolvedAction === "issue"
                ? "Issue item"
                : resolvedAction === "receipt"
                  ? "Example: Manual receipt"
                  : resolvedAction === "return"
                    ? "Example: Customer return"
                    : resolvedAction === "transfer"
                      ? "Example: Transfer from A1 to A3"
                      : resolvedAction === "adjust"
                        ? "Example: March inventory check"
                        : "Example: Defective goods write-off",
            extraFields: "+ Additional fields",
            organization: "Organization",
            responsible: "Responsible person",
            add: "+ Add",
            fill: "Fill",
            fillSoon: "Bulk fill will be added soon",
            exportExcel: "Export to Excel",
            exporting: "Loading...",
            searchCatalog: "Search by item name",
            allProducts: "All items",
            finishedProducts: "Finished products",
            materials: "Raw materials",
            groups: "Groups",
            allGroups: "All groups",
            stock: "Stock",
            nothingFound: "Nothing found",
            addedProducts: "Added items",
            qty: "Qty",
            edit: "Edit",
            save: "Save",
            delete: "Delete",
            unitCost: "Unit cost",
            targetLocation: "Destination location",
            choose: "Choose",
            note: "Note",
            notePlaceholder: "Additional note",
            cancel: "Cancel",
            saving: "Saving...",
          }
        : {
            added: "Mahsulot ro'yxatga qo'shildi",
            excelDownloaded: "Excel hujjat yuklab olindi",
            excelFailed: "Excel yuklab bo'lmadi",
            selectLocation: "Joylashuvni tanlang",
            selectTargetLocation: "Qabul qiluvchi joylashuvni tanlang",
            addProductFirst: "Avval guruhdan mahsulot tanlab qo'shing",
            selectProduct: "Mahsulotni tanlang",
            qtyPositive: "Miqdor musbat son bo'lishi kerak",
            savedCount: "ta yozuv saqlandi",
            saveError: "Saqlashda xatolik",
            actions: "Harakatlar",
            print: "Chop etish",
            docNumber: "Hujjat raqami",
            date: "Sana",
            time: "Vaqt",
            warehouse: "Ombor *",
            selectWarehouse: "Omborni tanlang",
            docName: `${docLabel} nomi`,
            docNamePlaceholder:
              resolvedAction === "issue"
                ? "Masalan: Chiqim mahsuloti"
                : resolvedAction === "receipt"
                  ? "Masalan: Qo'lda kirim"
                  : resolvedAction === "return"
                    ? "Masalan: Mijoz qaytardi"
                    : resolvedAction === "transfer"
                      ? "Masalan: A1 dan A3 ga ko'chirish"
                      : resolvedAction === "adjust"
                        ? "Masalan: Mart oylik tekshiruv"
                        : "Masalan: Yaroqsiz mahsulot chiqarish",
            extraFields: "+ Qo'shimcha maydonlar",
            organization: "Tashkilot",
            responsible: "Mas'ul shaxs",
            add: "+ Qo'shish",
            fill: "To'ldirish",
            fillSoon: "Ro'yxat bo'yicha qo'shish tez orada qo'shiladi",
            exportExcel: "Excelga yuklash",
            exporting: "Yuklanmoqda...",
            searchCatalog: "Mahsulot nomi bo'yicha qidiring",
            allProducts: "Barcha mahsulotlar",
            finishedProducts: "Tayyor mahsulot",
            materials: "Xomashyo va materiallar",
            groups: "Guruhlar",
            allGroups: "Barcha guruhlar",
            stock: "Qoldiq",
            nothingFound: "Hech narsa topilmadi",
            addedProducts: "Qo'shilgan mahsulotlar",
            qty: "Miqdor",
            edit: "Tahrirlash",
            save: "Saqlash",
            delete: "O'chirish",
            unitCost: "Birlik narxi",
            targetLocation: "Qabul qiluvchi joylashuv",
            choose: "Tanlang",
            note: "Izoh",
            notePlaceholder: "Qo'shimcha izoh",
            cancel: "Bekor qilish",
            saving: "Saqlanmoqda...",
          }

  const loadLookups = useCallback(async () => {
    try {
      setLookupLoading(true)
      const [l, p, m] = await Promise.all([
        warehouseApi.listWarehouseLocationOptions().catch(() => []),
        warehouseApi.listProducts().catch(() => []),
        warehouseApi.listMaterials().catch(() => []),
      ])
      setLocations(l)
      setProducts(p)
      setMaterials(m)

      if (!warehouseLocationId && l[0]?.id) setWarehouseLocationId(String(l[0].id))
      if (!toWarehouseLocationId && l[1]?.id) setToWarehouseLocationId(String(l[1].id))
      if (!itemId) {
        const firstId = itemType === "FINISHED_PRODUCT" ? p[0]?.id : m[0]?.id
        if (firstId) setItemId(String(firstId))
      }
    } finally {
      setLookupLoading(false)
    }
  }, [warehouseLocationId, toWarehouseLocationId, itemId, itemType])

  useEffect(() => {
    if (!open) return
    if (props.initialCatalogGroup) {
      setCatalogGroup(props.initialCatalogGroup)
      if (props.initialCatalogGroup === "PRODUCTS") setItemType("FINISHED_PRODUCT")
      if (props.initialCatalogGroup === "MATERIALS") setItemType("RAW_MATERIAL")
    }
    loadLookups()
    const now = new Date()
    setInventoryNo(String(Math.floor(Math.random() * 9000) + 1000))
    setInventoryDate(now.toISOString().slice(0, 10))
    setInventoryTime(now.toTimeString().slice(0, 5))
  }, [open, loadLookups, props.initialCatalogGroup])

  useEffect(() => {
    if (!open) return
    const source = itemType === "FINISHED_PRODUCT" ? products : materials
    setItemId((prev) => {
      if (prev && source.some((x) => String(x.id) === prev)) return prev
      return String(source[0]?.id ?? "")
    })
  }, [itemType, products, materials, open])

  useEffect(() => {
    if (!open) return
    const loadStock = async () => {
      try {
        setStockLoading(true)
        const params = warehouseLocationId ? { location: Number(warehouseLocationId) } : undefined
        const res = await warehouseApi.fetchStock(params).catch(() => ({ results: [] as Array<Record<string, unknown>> }))
        const next: Record<string, number> = {}
        for (const row of res.results as Array<Record<string, unknown>>) {
          const itemTypeRaw = String(row.item_type ?? "").toUpperCase()
          const keyType = itemTypeRaw === "FINISHED_PRODUCT" ? "PRODUCTS" : "MATERIALS"
          const itemId =
            keyType === "PRODUCTS"
              ? Number(row.product ?? 0)
              : Number(row.raw_material ?? 0)
          if (itemId > 0) next[`${keyType}:${itemId}`] = Number(row.qty_onhand ?? 0)
        }
        setStockQtyMap(next)
      } finally {
        setStockLoading(false)
      }
    }
    void loadStock()
  }, [open, warehouseLocationId])

  const normalizeGroupKey = useCallback((name: string) => {
    const lower = name.toLowerCase().trim()
    const noTrailingDigits = lower.replace(/[\s\-_]*\d+$/g, "").trim()
    return (noTrailingDigits || lower).replace(/\s+/g, " ")
  }, [])

  const formatGroupLabel = useCallback((name: string) => {
    const cleaned = name.trim().replace(/[\s\-_]*\d+$/g, "").replace(/\s+/g, " ")
    if (!cleaned) return name.trim()
    return cleaned
  }, [])

  const resolveCatalogGroupLabel = useCallback(
    (row: LookupItem, kind: "PRODUCTS" | "MATERIALS") => {
      const rawGroup = kind === "PRODUCTS" ? row.category_name : row.material_type_name
      const normalizedGroup = String(rawGroup ?? "").trim()
      if (normalizedGroup) return formatGroupLabel(normalizedGroup)
      return formatGroupLabel(row.name)
    },
    [formatGroupLabel]
  )

  const catalogSourceRows = useMemo<CatalogRow[]>(() => {
    const productRows = products.map((x) => {
      const groupLabel = resolveCatalogGroupLabel(x, "PRODUCTS")
      return {
        id: x.id,
        name: x.name,
        kind: "PRODUCTS" as const,
        groupKey: normalizeGroupKey(groupLabel),
        groupLabel,
      }
    })
    const materialRows = materials.map((x) => {
      const groupLabel = resolveCatalogGroupLabel(x, "MATERIALS")
      return {
        id: x.id,
        name: x.name,
        kind: "MATERIALS" as const,
        groupKey: normalizeGroupKey(groupLabel),
        groupLabel,
      }
    })
    return [...productRows, ...materialRows]
  }, [products, materials, normalizeGroupKey, resolveCatalogGroupLabel])

  const catalogRows = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase()
    return catalogSourceRows.filter((x) => {
      const byGroup = catalogGroup === "ALL" || x.kind === catalogGroup
      const byNameGroup = catalogNameGroup === "ALL_NAMES" || x.groupKey === catalogNameGroup
      const byQuery =
        !q ||
        x.name.toLowerCase().includes(q) ||
        String(x.id).includes(q) ||
        x.groupKey.includes(q) ||
        x.groupLabel.toLowerCase().includes(q)
      return byGroup && byNameGroup && byQuery
    })
  }, [catalogSourceRows, catalogGroup, catalogNameGroup, catalogQuery])

  const writeOffCatalogRows = useMemo(() => {
    if (!isWriteOff || catalogNameGroup === "ALL_NAMES") return []
    const q = catalogQuery.trim().toLowerCase()
    return catalogSourceRows.filter((x) => {
      const byGroup = catalogGroup === "ALL" || x.kind === catalogGroup
      const byNameGroup = x.groupKey === catalogNameGroup
      const byQuery = !q || x.name.toLowerCase().includes(q) || String(x.id).includes(q)
      return byGroup && byNameGroup && byQuery
    })
  }, [isWriteOff, catalogSourceRows, catalogGroup, catalogNameGroup, catalogQuery])

  const catalogNameGroups = useMemo(() => {
    const source = catalogSourceRows.filter((row) => catalogGroup === "ALL" || row.kind === catalogGroup)
    const map = new Map<string, { label: string; count: number }>()
    for (const row of source) {
      const key = row.groupKey
      if (!key || key === "-" || key === "_") continue
      const entry = map.get(key)
      if (entry) {
        entry.count += 1
      } else {
        map.set(key, { label: row.groupLabel, count: 1 })
      }
    }
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [catalogSourceRows, catalogGroup])

  const selectedCatalogGroup = useMemo(
    () => catalogNameGroups.find((group) => group.key === catalogNameGroup) ?? null,
    [catalogNameGroup, catalogNameGroups]
  )

  const catalogSelectionHint =
    language === "ru"
      ? "Сначала выберите группу слева, затем появится список товаров этой группы."
      : language === "en"
        ? "Choose a group on the left first, then the products in that group will appear."
        : "Avval chap tomondan guruhni tanlang, keyin shu guruhdagi mahsulotlar ro'yxati chiqadi."

  const catalogItemsTitle =
    language === "ru"
      ? "Товары группы"
      : language === "en"
        ? "Group items"
        : "Guruh mahsulotlari"

  useEffect(() => {
    if (catalogNameGroup === "ALL_NAMES") return
    const exists = catalogNameGroups.some((g) => g.key === catalogNameGroup)
    if (!exists) setCatalogNameGroup("ALL_NAMES")
  }, [catalogNameGroups, catalogNameGroup])

  useEffect(() => {
    if (!open || !isWriteOff) return
    if (catalogGroup === "ALL") setCatalogGroup("PRODUCTS")
  }, [open, isWriteOff, catalogGroup])

  const getCatalogQty = useCallback(
    (kind: "PRODUCTS" | "MATERIALS", id: number) => Number(stockQtyMap[`${kind}:${id}`] ?? 0),
    [stockQtyMap]
  )

  const locationSelectDisabled = lookupLoading && locations.length === 0

  const addDraftLineFromCatalog = useCallback(
    (row: { kind: "PRODUCTS" | "MATERIALS"; id: number; name: string; groupKey: string }) => {
      const baseQty = 1
      setDraftLines((prev) => {
        const idx = prev.findIndex((x) => x.kind === row.kind && x.id === row.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], qty: next[idx].qty + baseQty, stock: getCatalogQty(row.kind, row.id) }
          return next
        }
        return [
          ...prev,
          {
            kind: row.kind,
            id: row.id,
            name: row.name,
            groupKey: row.groupKey,
            qty: baseQty,
            stock: getCatalogQty(row.kind, row.id),
          },
        ]
      })
      setItemType(row.kind === "PRODUCTS" ? "FINISHED_PRODUCT" : "RAW_MATERIAL")
      setItemId(String(row.id))
      toast.success(copy.added)
    },
    [getCatalogQty]
  )

  const updateDraftQty = useCallback((kind: "PRODUCTS" | "MATERIALS", id: number, value: string) => {
    const parsed = Number(value || 0)
    const nextQty = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1_000_000) / 1_000_000 : 1
    setDraftLines((prev) =>
      prev.map((x) => (x.kind === kind && x.id === id ? { ...x, qty: nextQty } : x))
    )
  }, [])

  const draftLineTypeLabel = (kind: DraftLine["kind"]) => {
    if (language === "ru") return kind === "PRODUCTS" ? "Готовая продукция" : "Сырье"
    if (language === "en") return kind === "PRODUCTS" ? "Finished product" : "Raw material"
    return kind === "PRODUCTS" ? "Tayyor mahsulot" : "Xomashyo"
  }

  const exportExcel = async () => {
    try {
      setExporting(true)
      if (resolvedAction === "receipt" && draftLines.length > 0) {
        const selectedLocation = locations.find((x) => String(x.id) === warehouseLocationId)
        const selectedToLocation = locations.find((x) => String(x.id) === toWarehouseLocationId)
        const stamp = inventoryDate
          ? new Date(inventoryDate).toLocaleDateString("uz-UZ")
          : new Date().toLocaleDateString("uz-UZ")

        downloadWarehouseDocumentTemplate({
          filename: `${docLabel.toLowerCase().replace(/\s+/g, "-")}-${inventoryNo || Date.now()}.xls`,
          title: `${docLabel} hujjati`,
          docNumber: inventoryNo || "-",
          docDate: `dan ${stamp}`,
          sender: selectedLocation?.name || organization || "Jo'natuvchi ko'rsatilmagan",
          receiver: isTransfer
            ? selectedToLocation?.name || "Qabul qiluvchi ko'rsatilmagan"
            : organization || "Qabul qiluvchi ko'rsatilmagan",
          currency: "UZS",
          rows: draftLines.map((line) => ({
            name: line.name,
            uom: "dona",
            qty: line.qty,
            price: needsUnitCost ? Number(unitCost || 0) : 0,
            total: needsUnitCost ? line.qty * Number(unitCost || 0) : 0,
          })),
        })
        toast.success(copy.excelDownloaded)
        return
      }

      const params: Record<string, string | number> = {}
      if (warehouseLocationId) params.location = Number(warehouseLocationId)
      Object.assign(params, actionToExportParams(resolvedAction))
      if (itemType) params.item_type = itemType

      const res = await api.get("/api/v1/warehouse/ledger/export/", {
        params,
        responseType: "blob",
      })
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      await downloadLedgerExportFile({
        data: res.data,
        contentType: res.headers?.["content-type"],
        baseName: `inventarizatsiya-${stamp}`,
      })
      toast.success(copy.excelDownloaded)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      toast.error(String(err?.response?.data?.detail || err?.message || copy.excelFailed))
    } finally {
      setExporting(false)
    }
  }

  const submit = async () => {
    try {
      const selectedLocation = locations.find((x) => String(x.id) === warehouseLocationId)
      const selectedToLocation = locations.find((x) => String(x.id) === toWarehouseLocationId)
      if (!selectedLocation) return toast.error(copy.selectLocation)
      if (isTransfer && !selectedToLocation) return toast.error(copy.selectTargetLocation)

      if (draftLines.length === 0) {
        return toast.error(copy.addProductFirst)
      }
      const lines = draftLines.map((line) => ({
        lineType: line.kind === "PRODUCTS" ? "FINISHED_PRODUCT" : "RAW_MATERIAL",
        lineId: line.id,
        lineQty: line.qty,
        lineName: line.name,
      }))

      for (const line of lines) {
        if (!line.lineId) return toast.error(copy.selectProduct)
        if (line.lineQty <= 0) {
          return toast.error(copy.qtyPositive)
        }
      }

      setSubmitting(true)
      const effectiveSubmitAction: WarehouseAction = resolvedAction
      const occurredAt = buildOccurredAt(inventoryDate, inventoryTime)
      let lastCreated: Record<string, unknown> | undefined
      for (const line of lines) {
        const qtyValue = Math.abs(Number(props.invertQty ? -line.lineQty : line.lineQty)).toFixed(6)
        const payload: Record<string, unknown> = {
          item_type: line.lineType,
          item_id: line.lineId,
          qty: qtyValue,
          note: [inventoryName.trim(), comment.trim()].filter(Boolean).join(" | "),
        }
        if (occurredAt) {
          payload.occurred_at = occurredAt
        }
        if (needsUnitCost) {
          payload.unit_cost = Number(unitCost || 0)
        }
        if (isTransfer) {
          payload.from_location = Number(warehouseLocationId || 0)
          payload.to_location = Number(toWarehouseLocationId || 0)
        } else {
          payload.location = Number(warehouseLocationId || 0)
        }

        const created = await warehouseApi.stockAction(effectiveSubmitAction, payload)
        const createdRow = created && typeof created === "object"
          ? created as Record<string, unknown>
          : {}
        const fallbackMovementType = actionToMovementType(effectiveSubmitAction)
        const fallbackRefType = effectiveSubmitAction === "transfer" ? "MANUAL_TRANSFER" : undefined
        lastCreated = {
          ...createdRow,
          id: createdRow.id ?? createdRow.out_id ?? createdRow.in_id ?? `${effectiveSubmitAction}-${line.lineId}-${occurredAt ?? Date.now()}`,
          item_type: createdRow.item_type ?? line.lineType,
          item_id: createdRow.item_id ?? line.lineId,
          qty: createdRow.qty ?? qtyValue,
          unit_cost: createdRow.unit_cost ?? (needsUnitCost ? Number(unitCost || 0) : undefined),
          movement_type: createdRow.movement_type ?? fallbackMovementType,
          ref_type: createdRow.ref_type ?? fallbackRefType,
          location: createdRow.location ?? payload.location ?? payload.from_location ?? undefined,
          from_location: createdRow.from_location ?? payload.from_location ?? undefined,
          to_location: createdRow.to_location ?? payload.to_location ?? undefined,
          note: createdRow.note ?? payload.note ?? undefined,
          currency: createdRow.currency ?? "UZS",
          date:
            createdRow.occurred_at ??
            createdRow.date ??
            createdRow.created_at ??
            occurredAt ??
            new Date().toISOString(),
          occurred_at:
            createdRow.occurred_at ??
            occurredAt ??
            undefined,
          itemName:
            createdRow.itemName ??
            createdRow.item_name ??
            line.lineName ??
            undefined,
          location_name:
            createdRow.location_name ??
            selectedLocation?.name ??
            undefined,
          from_location_name:
            createdRow.from_location_name ??
            selectedLocation?.name ??
            undefined,
          to_location_name:
            createdRow.to_location_name ??
            selectedToLocation?.name ??
            undefined,
        }
      }

      toast.success(`${lines.length} ${copy.savedCount}`)
      setOpen(false)
      setComment("")
      setUnitCost("0")
      setInventoryDate("")
      setInventoryTime("")
      setInventoryName("")
      setInventoryNo("")
      setItemType("RAW_MATERIAL")
      setDraftLines([])
      await props.onSuccess?.(lastCreated)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      const data = err?.response?.data
      const msg =
        typeof data === "string"
          ? data
          : data?.detail || (data ? JSON.stringify(data) : err?.message || copy.saveError)
      toast.error(String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isWriteOff || props.triggerLabel.toLowerCase().includes("spisaniya") ? (
          <button
            type="button"
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-blue-800 !bg-gradient-to-r !from-blue-900 !to-blue-700 px-5 text-sm font-semibold !text-white shadow-xs transition-colors hover:!from-blue-950 hover:!to-blue-800"
          >
            {props.triggerLabel}
          </button>
        ) : (
          <Button className="rounded-xl px-5">{props.triggerLabel}</Button>
        )}
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="!h-[94vh] !w-[96vw] !max-w-[1680px] overflow-x-hidden overflow-y-auto rounded-[28px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-0 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)]"
      >
        <DialogHeader className="border-b border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2f6fed]">{docLabel}</div>
              <DialogTitle className="mt-2 bg-transparent px-0 text-[26px] font-semibold text-[#16325c]">{props.title}</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border border-[#d7e3f7] bg-white px-4 text-sm font-medium text-[#24406b] shadow-sm hover:bg-[#f8fbff]"
                onClick={() => window.print()}
              >
                {copy.print}
              </Button>

            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 rounded-[22px] border border-[#d7e3f7] bg-white p-4 md:grid-cols-[1fr_170px_120px]">
            <div className="grid gap-1">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.docNumber}</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#16325c]">{docLabel} №</span>
                <Input
                  value={inventoryNo}
                  onChange={(e) => setInventoryNo(e.target.value)}
                  className="h-11 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-sm text-[#16325c] shadow-none"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.date}</label>
              <Input
                type="date"
                value={inventoryDate}
                onChange={(e) => setInventoryDate(e.target.value)}
                className="h-11 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-sm text-[#16325c] shadow-none"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.time}</label>
              <Input
                type="time"
                value={inventoryTime}
                onChange={(e) => setInventoryTime(e.target.value)}
                className="h-11 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-sm text-[#16325c] shadow-none"
              />
            </div>
          </div>

          <div className="grid gap-4 rounded-[22px] border border-[#d7e3f7] bg-white p-4 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.warehouse}</label>
              <Select
                value={warehouseLocationId || undefined}
                onValueChange={setWarehouseLocationId}
                disabled={locationSelectDisabled}
              >
                <SelectTrigger className="h-11 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-sm text-[#16325c] shadow-none">
                  <SelectValue placeholder={copy.selectWarehouse} />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  className="rounded-xl border-slate-300 bg-white shadow-lg"
                >
                  {locations.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a7ea1]">{copy.docName}</label>
              <Input
                className="h-11 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-sm text-[#16325c] shadow-none"
                value={inventoryName}
                onChange={(e) => setInventoryName(e.target.value)}
                placeholder={copy.docNamePlaceholder}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed] hover:text-[#1f56d8]"
              onClick={() => setExtraOpen((v) => !v)}
            >
              {copy.extraFields}
            </button>

          </div>

          {extraOpen ? (
            <div className="grid gap-3 rounded-[22px] border border-[#d7e3f7] bg-white p-4 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-xs text-slate-500">{copy.organization}</label>
                <Input
                  className="h-10 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-sm text-[#16325c]"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder={copy.organization}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-500">{copy.responsible}</label>
                <Input
                  className="h-10 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-sm text-[#16325c]"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="F.I.O."
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className="h-10 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(29,78,216,0.18)]" onClick={submit} disabled={submitting}>
              {copy.add}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border border-[#d7e3f7] bg-white px-4 text-sm font-medium text-[#24406b] shadow-sm hover:bg-[#f8fbff]"
              onClick={() => toast.info(copy.fillSoon)}
            >
              {copy.fill}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border border-[#d7e3f7] bg-white px-4 text-sm font-medium text-[#24406b] shadow-sm hover:bg-[#f8fbff]"
              onClick={() => void exportExcel()}
              disabled={exporting}
            >
              {exporting ? copy.exporting : copy.exportExcel}
            </Button>
          </div>

          <div className="space-y-3 rounded-[22px] border border-[#d7e3f7] bg-white p-4">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  className="h-11 rounded-xl border-[#c7d7ef] bg-[#f8fbff] pl-10 pr-3 text-sm text-[#16325c]"
                  placeholder={copy.searchCatalog}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-blue-800 bg-gradient-to-r from-blue-900 to-blue-700 px-3 text-white hover:from-blue-950 hover:to-blue-800"
                  onClick={() => setCatalogOpen(true)}
                  title="Katalogni ochish"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {catalogOpen ? (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,42,0.42)] p-4 backdrop-blur-[3px]">
                <div className="w-[min(calc(100vw-2rem),76rem)] max-w-6xl rounded-[30px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.groups}</div>
                      <div className="mt-1 text-base font-semibold text-slate-900">{copy.searchCatalog}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-11 rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      onClick={() => setCatalogOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="max-h-[min(72vh,760px)] overflow-hidden rounded-[24px] border border-[#d7e3f7] bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm">
                    <div className="mb-4 relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={catalogQuery}
                        onChange={(e) => setCatalogQuery(e.target.value)}
                        className="h-11 rounded-xl border-[#c7d7ef] bg-[#f8fbff] pl-10 pr-3 text-sm text-[#16325c]"
                        placeholder={copy.searchCatalog}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
                      <aside className="rounded-[20px] bg-white p-3 ring-1 ring-slate-100">
                        {!isWriteOff ? (
                          <button
                            type="button"
                            className={`mb-2 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${catalogGroup === "ALL" ? "bg-amber-100 text-amber-900" : "text-slate-700 hover:bg-slate-100"}`}
                            onClick={() => {
                              setCatalogGroup("ALL")
                              setCatalogNameGroup("ALL_NAMES")
                            }}
                          >
                            {copy.allProducts}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={`mb-2 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${catalogGroup === "PRODUCTS" ? "bg-blue-100 text-blue-900" : "text-slate-700 hover:bg-slate-100"}`}
                          onClick={() => {
                            setCatalogGroup("PRODUCTS")
                            setCatalogNameGroup("ALL_NAMES")
                          }}
                        >
                          {copy.finishedProducts}
                        </button>
                        <button
                          type="button"
                          className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${catalogGroup === "MATERIALS" ? "bg-emerald-100 text-emerald-900" : "text-slate-700 hover:bg-slate-100"}`}
                          onClick={() => {
                            setCatalogGroup("MATERIALS")
                            setCatalogNameGroup("ALL_NAMES")
                          }}
                        >
                          {copy.materials}
                        </button>

                        <div className="mt-3 border-t border-slate-200 pt-2">
                          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.groups}</div>
                          {!isWriteOff ? (
                            <button
                              type="button"
                              className={`mb-2 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${catalogNameGroup === "ALL_NAMES" ? "bg-violet-100 text-violet-900" : "text-slate-700 hover:bg-slate-100"}`}
                              onClick={() => {
                                setCatalogNameGroup("ALL_NAMES")
                                setCatalogGroup("ALL")
                              }}
                            >
                              {copy.allGroups}
                            </button>
                          ) : null}
                          <div className="max-h-[360px] overflow-auto pr-1">
                            {catalogNameGroups.map((g) => (
                              <button
                                key={g.key}
                                type="button"
                                className={`mb-2 w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${catalogNameGroup === g.key ? "bg-violet-100 text-violet-900" : "text-slate-700 hover:bg-slate-100"}`}
                                onClick={() => {
                                  setCatalogNameGroup(g.key)
                                  if (!isWriteOff) setCatalogGroup("ALL")
                                }}
                                title={g.label}
                              >
                                <span className="block whitespace-normal break-words leading-5">{g.label}</span>
                                <span className="ml-1 text-xs opacity-70">({g.count})</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </aside>

                      <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-slate-100">
                        <div className="grid grid-cols-[88px_minmax(0,1fr)_160px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                          <div>Turi</div>
                          <div>{isWriteOff && selectedCatalogGroup ? `${catalogItemsTitle}: ${selectedCatalogGroup.label}` : "Nomi"}</div>
                          <div>{copy.stock}{stockLoading ? "..." : ""}</div>
                        </div>
                        <div className="max-h-[480px] overflow-auto">
                          {isWriteOff && catalogNameGroup === "ALL_NAMES" ? (
                            <div className="px-4 py-10 text-center text-sm leading-6 text-slate-500">{catalogSelectionHint}</div>
                          ) : (
                            <>
                              {(isWriteOff ? writeOffCatalogRows : catalogRows).map((row) => (
                                <button
                                  key={`${row.kind}_${row.id}`}
                                  type="button"
                                  className="grid w-full grid-cols-[88px_minmax(0,1fr)_160px] items-center border-b border-slate-100 px-4 py-3 text-left text-base hover:bg-blue-50"
                                  onClick={() => {
                                    addDraftLineFromCatalog(row)
                                    setCatalogOpen(false)
                                  }}
                                >
                                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-200 to-slate-100 ring-1 ring-slate-200" />
                                  <div className="pr-3 font-medium text-slate-800">{row.name}</div>
                                  <div className="font-mono text-base text-slate-600">{getCatalogQty(row.kind, row.id)}</div>
                                </button>
                              ))}
                              {(isWriteOff ? writeOffCatalogRows : catalogRows).length === 0 ? (
                                <div className="px-3 py-8 text-center text-sm text-slate-500">{copy.nothingFound}</div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {draftLines.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.addedProducts}</div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
                    <tr>
                      <th className="w-14 px-3 py-2 text-left font-semibold">№</th>
                      <th className="px-3 py-2 text-left font-semibold">{language === "ru" ? "Название" : language === "en" ? "Name" : "Nomi"}</th>
                      <th className="w-[180px] px-3 py-2 text-left font-semibold">{language === "ru" ? "Тип" : language === "en" ? "Type" : "Turi"}</th>
                      <th className="w-[140px] px-3 py-2 text-right font-semibold">{language === "ru" ? "Остаток" : language === "en" ? "Stock" : "Qoldiq"}</th>
                      <th className="w-[180px] px-3 py-2 text-left font-semibold">{copy.qty}</th>
                      <th className="w-[120px] px-3 py-2 text-right font-semibold">{copy.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {draftLines.map((line, index) => {
                      const lineKey = `${line.kind}:${line.id}`
                      return (
                        <tr key={lineKey}>
                          <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-800">{line.name}</div>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{draftLineTypeLabel(line.kind)}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{line.stock}</td>
                          <td className="px-3 py-3">
                            <Input
                              className="h-9 w-full rounded-md border-slate-300 bg-white"
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              value={line.qty}
                              onChange={(e) => updateDraftQty(line.kind, line.id, e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
                              onClick={() =>
                                setDraftLines((prev) => prev.filter((x) => !(x.kind === line.kind && x.id === line.id)))
                              }
                              aria-label={copy.delete}
                              title={copy.delete}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {needsUnitCost ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-1">
              <div className="grid gap-1">
                <label className="text-xs text-slate-500">{copy.unitCost}</label>
                <Input
                  className="h-10 rounded-lg border-slate-300 bg-white text-sm"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  type="number"
                  min="0"
                />
              </div>
            </div>
          ) : null}

          {isTransfer ? (
            <div className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3">
              <label className="text-xs text-slate-500">{copy.targetLocation}</label>
              <Select
                value={toWarehouseLocationId || undefined}
                onValueChange={setToWarehouseLocationId}
                disabled={locationSelectDisabled}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-300 bg-white text-sm">
                  <SelectValue placeholder={copy.selectTargetLocation} />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  className="rounded-xl border-slate-300 bg-white shadow-lg"
                >
                  {locations.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-1">
            <label className="text-xs text-slate-500">{copy.note}</label>
            <Input
              className="h-10 rounded-lg border-slate-300 bg-white text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={copy.notePlaceholder}
            />
          </div>
        </div >

        <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Button variant="outline" className="h-9 border border-slate-300 bg-white shadow-lg px-4 py-2 rounded-md text-xs text-black hover:from-blue-950 hover:to-blue-800" onClick={() => setOpen(false)}>
            {copy.cancel}
          </Button>
          <Button className="h-9 rounded-lg border border-blue-800 bg-gradient-to-r from-blue-900 to-blue-700 px-4 text-xs text-white hover:from-blue-950 hover:to-blue-800" onClick={submit} disabled={submitting || lookupLoading}>
            {submitting ? copy.saving : copy.save}
          </Button>
        </DialogFooter>
      </DialogContent >
    </Dialog >
  )
}







