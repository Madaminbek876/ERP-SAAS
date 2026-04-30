import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { warehouseApi } from "../api/warehouseApi"
import type { LookupItem, StockOnHandItem } from "../api/types"
import WarehouseCatalogPicker from "../components/WarehouseCatalogPicker"
import WarehouseDocumentViewDialog from "../components/WarehouseDocumentViewDialog"
import TablePagination from "@/components/common/TablePagination"
import {
  documentRowName,
  documentRowQty,
  documentRowTotal,
  documentRowUnit,
  documentRowUnitCost,
  fetchWarehouseDocumentLines,
  type WarehouseDocumentSourceRow,
} from "../utils/documentDetail"
import ScrollReveal from "@/components/common/ScrollReveal"
import { useI18n } from "@/i18n"
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2 } from "lucide-react"

type InternalOrderRow = {
  id: number | string
  order_no: string
  status: string
  created_at: string
  total: number
  qty: number
  currency: string
  item_name: string
  item_type_label: string
  item_type?: string
  item_id?: number
  from_location_name: string
  to_location_name: string
  from_location?: number
  to_location?: number
  ref_type?: string
  ref_id?: number | null
  unit_cost?: number
  line_total?: number
  movement_type?: string
  note: string
}

type ApiLikeError = {
  response?: { status?: number; data?: { detail?: unknown } }
  message?: unknown
}

type SortKey =
  | "order_no"
  | "created_at"
  | "from_location_name"
  | "to_location_name"
  | "item_name"
  | "item_type_label"
  | "total"
  | "status"
  | "note"

function toNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtNum(v: number) {
  return new Intl.NumberFormat("ru-RU").format(Number(v || 0))
}

function formatTransferNumber(value?: string | null, fallbackId?: number | string) {
  const source = String(value ?? "").trim()
  const digits = source.replace(/\D+/g, "")
  const prefix = "\u2116"

  if (digits) return `${prefix}${String(Number(digits))}`
  if (fallbackId !== undefined && fallbackId !== null) return `${prefix}${fallbackId}`
  return `${prefix}-`
}

function formatDateTime(value?: string | null, language: "uz" | "ru" | "en" = "uz") {
  const raw = String(value ?? "").trim()
  if (!raw || raw === "-") return "-"
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  const locale = language === "ru" ? "ru-RU" : language === "en" ? "en-GB" : "uz-UZ"
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusLabel(status: string, language: "uz" | "ru" | "en") {
  const key = String(status || "").toUpperCase()
  if (language === "ru") {
    if (key === "NEW") return "Новый"
    if (key === "IN_PROGRESS") return "В процессе"
    if (key === "READY") return "Готов"
    if (key === "DONE") return "Завершен"
    if (key === "TRANSFER") return "Перемещение"
    if (key === "CANCELLED") return "Отменен"
    if (key === "ON_DELIVERY") return "В пути"
    if (key === "DELIVERED") return "Доставлен"
  }
  if (language === "en") {
    if (key === "NEW") return "New"
    if (key === "IN_PROGRESS") return "In progress"
    if (key === "READY") return "Ready"
    if (key === "DONE") return "Done"
    if (key === "TRANSFER") return "Transfer"
    if (key === "CANCELLED") return "Cancelled"
    if (key === "ON_DELIVERY") return "On delivery"
    if (key === "DELIVERED") return "Delivered"
  }
  if (key === "NEW") return "Yangi"
  if (key === "IN_PROGRESS") return "Jarayonda"
  if (key === "READY") return "Tayyor"
  if (key === "DONE") return "Yakunlangan"
  if (key === "TRANSFER") return "Ko'chirish"
  if (key === "CANCELLED") return "Bekor qilingan"
  if (key === "ON_DELIVERY") return "Yo'lda"
  if (key === "DELIVERED") return "Yetkazilgan"
  return key || "-"
}

function mapRow(x: unknown, idx: number, language: "uz" | "ru" | "en"): InternalOrderRow {
  const row = (x ?? {}) as Record<string, unknown>
  const fromLocation = String(row.from_location_name ?? row.location_name ?? "-")
  const toLocation = String(row.to_location_name ?? "-")
  const transferNo = row.ref_id ?? row.id ?? idx + 1
  const itemType = String(row.item_type ?? "").toUpperCase()
  const qty = toNum(row.qty ?? row.total ?? row.amount ?? row.sum ?? 0)
  const unitCost = toNum(row.unit_cost)
  const lineTotal = toNum(row.total ?? row.total_cost ?? row.amount ?? row.sum ?? qty * unitCost)

  return {
    id: (row.id as number | string | undefined) ?? `TRANSFER-${idx}`,
    order_no: `TR-${transferNo}`,
    status: String(row.status ?? row.ref_type ?? "DONE"),
    created_at: String(row.date ?? row.occurred_at ?? row.created_at ?? "-"),
    total: qty,
    qty,
    currency: String(row.currency ?? "UZS"),
    item_name: String(row.itemName ?? row.item_name ?? row.product_name ?? row.raw_material_name ?? "-"),
    item_type_label:
      itemType === "RAW_MATERIAL"
        ? language === "ru"
          ? "Сырье"
          : language === "en"
            ? "Raw material"
            : "Xomashyo"
        : language === "ru"
          ? "Готовая продукция"
          : language === "en"
            ? "Finished product"
            : "Tayyor mahsulot",
    item_type: itemType,
    item_id: toNum(row.item_id ?? row.product ?? row.product_id ?? row.raw_material ?? row.raw_material_id),
    from_location_name: fromLocation,
    to_location_name: toLocation,
    from_location: toNum(row.from_location ?? row.location ?? row.location_id),
    to_location: toNum(row.to_location),
    ref_type: String(row.ref_type ?? ""),
    ref_id: row.ref_id === null || row.ref_id === undefined ? null : toNum(row.ref_id),
    unit_cost: unitCost,
    line_total: lineTotal,
    movement_type: String(row.movement_type ?? row.type ?? "TRANSFER"),
    note: String(row.note ?? ""),
  }
}

async function fetchInternalOrders(
  params: { page: number; page_size: number; q?: string; status?: string },
  language: "uz" | "ru" | "en"
) {
  if (params.status && params.status !== "DONE" && params.status !== "TRANSFER") {
    return { results: [], count: 0 }
  }

  const res = await warehouseApi.listMovementsPage({
    page: params.page,
    page_size: params.page_size,
    ref_type: "MANUAL_TRANSFER",
  })

  const rows = res.results.map((row: unknown, idx: number) => mapRow(row, idx, language))
  return { results: rows, count: Number(res.count ?? rows.length) }
}

export default function WarehouseInternalOrdersPage() {
  const { language } = useI18n()
  const navigate = useNavigate()
  const [rows, setRows] = useState<InternalOrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [sortBy, setSortBy] = useState<SortKey>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [count, setCount] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [locationStockLoading, setLocationStockLoading] = useState(false)
  const [locations, setLocations] = useState<Array<LookupItem & { warehouse_id?: number }>>([])
  const [products, setProducts] = useState<LookupItem[]>([])
  const [materials, setMaterials] = useState<LookupItem[]>([])
  const [locationStockIds, setLocationStockIds] = useState<{ products: number[]; materials: number[] } | null>(null)
  const [warehouseLocationId, setWarehouseLocationId] = useState("")
  const [toWarehouseLocationId, setToWarehouseLocationId] = useState("")
  const [itemKind, setItemKind] = useState<"PRODUCT" | "RAW_MATERIAL">("PRODUCT")
  const [productId, setProductId] = useState("")
  const [rawMaterialId, setRawMaterialId] = useState("")
  const [qty, setQty] = useState("1")
  const [note, setNote] = useState("")
  const [transferNo, setTransferNo] = useState("")
  const [transferDate, setTransferDate] = useState("")
  const [transferTime, setTransferTime] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeRow, setActiveRow] = useState<InternalOrderRow | null>(null)
  const [detailRows, setDetailRows] = useState<WarehouseDocumentSourceRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const copy =
    language === "ru"
      ? {
        loadError: "Перемещения не загрузились",
        selectFrom: "Выберите исходную локацию",
        selectTo: "Выберите принимающую локацию",
        selectProduct: "Выберите товар",
        selectMaterial: "Выберите сырье",
        qtyPositive: "Количество должно быть положительным целым числом",
        created: "Перемещение создано",
        createError: "Ошибка создания",
        title: "Перемещения",
        create: "Создать перемещение",
        newTitle: "Новое перемещение",
        transferNo: "Номер перемещения",
        date: "Дата",
        time: "Время",
        baseInfo: "Основная информация",
        from: "Откуда *",
        to: "Куда *",
        itemType: "Тип товара *",
        product: "Товар",
        material: "Сырье",
        selectProductLabel: "Выберите товар *",
        selectMaterialLabel: "Выберите сырье *",
        searchProduct: "Введите название товара для поиска",
        searchMaterial: "Введите название сырья для поиска",
        productNotFound: "Товар не найден",
        materialNotFound: "Сырье не найдено",
        qty: "Количество *",
        qtyPlaceholder: "Количество",
        note: "Примечание",
        notePlaceholder: "Введите дополнительное примечание",
        detail: "Детали перемещения",
        sender: "Отправляющая локация",
        receiver: "Принимающая локация",
        nomenclature: "Выбранная номенклатура",
        transferType: "Тип перемещения",
         cancel: "Отмена",
         saving: "Сохранение...",
         save: "Сохранить перемещение",
         noItemsInLocation: "В выбранной локации нет доступных товаров этого типа",
         loading: "Загрузка...",
        refresh: "Обновить",
        search: "Поиск по перемещению / номенклатуре / локации",
        allStatuses: "Все статусы",
        done: "Завершено",
        transfer: "Перемещение",
        apply: "Применить фильтр",
        sort: "Сортировка",
        transferNumber: "Номер перемещения",
        dateTime: "Дата и время",
        itemName: "Номенклатура",
        state: "Статус",
        unit: "Ед. изм.",
        price: "Цена",
        total: "Итого",
        print: "Печать",
        rowDetail: "Детали перемещения",
        close: "Закрыть",
        noData: "Данные не найдены",
        of: "из",
        previous: "Назад",
        next: "Вперед",
      }
      : language === "en"
        ? {
          loadError: "Transfers failed to load",
          selectFrom: "Select source location",
          selectTo: "Select destination location",
          selectProduct: "Select product",
          selectMaterial: "Select raw material",
          qtyPositive: "Qty must be a positive integer",
          created: "Transfer created",
          createError: "Create error",
          title: "Transfers",
          create: "Create transfer",
          newTitle: "New transfer",
          transferNo: "Transfer number",
          date: "Date",
          time: "Time",
          baseInfo: "Main information",
          from: "From *",
          to: "To *",
          itemType: "Item type *",
          product: "Product",
          material: "Raw material",
          selectProductLabel: "Select product *",
          selectMaterialLabel: "Select raw material *",
          searchProduct: "Type product name to search",
          searchMaterial: "Type raw material name to search",
          productNotFound: "Product not found",
          materialNotFound: "Raw material not found",
          qty: "Qty *",
          qtyPlaceholder: "Qty",
          note: "Note",
          notePlaceholder: "Write an additional note",
          detail: "Transfer details",
          sender: "Source location",
          receiver: "Destination location",
          nomenclature: "Selected item",
          transferType: "Transfer type",
           cancel: "Cancel",
           saving: "Saving...",
           save: "Save transfer",
           noItemsInLocation: "No available items of this type in the selected location",
           loading: "Loading...",
          refresh: "Refresh",
          search: "Search by transfer / item / location",
          allStatuses: "All statuses",
          done: "Done",
          transfer: "Transfer",
          apply: "Apply filter",
          sort: "Sort",
          transferNumber: "Transfer number",
          dateTime: "Date and time",
          itemName: "Item",
          state: "Status",
          unit: "Unit",
          price: "Price",
          total: "Total",
          print: "Print",
          rowDetail: "Transfer details",
          close: "Close",
          noData: "No data found",
          of: "of",
          previous: "Previous",
          next: "Next",
        }
        : {
          loadError: "Ko'chirishlar yuklanmadi",
          selectFrom: "Ombor joylashuvini tanlang",
          selectTo: "Qabul qiluvchi joylashuvni tanlang",
          selectProduct: "Mahsulotni tanlang",
          selectMaterial: "Xomashyoni tanlang",
          qtyPositive: "Miqdor musbat butun son bo'lsin",
          created: "Ko'chirish yaratildi",
          createError: "Yaratishda xatolik",
          title: "Ko'chirishlar",
          create: "Ko'chirish yaratish",
          newTitle: "Yangi ko'chirish",
          transferNo: "Ko'chirish raqami",
          date: "Sana",
          time: "Vaqt",
          baseInfo: "Asosiy ma'lumotlar",
          from: "Qaysi ombordan *",
          to: "Qaysi omborga *",
          itemType: "Mahsulot turi *",
          product: "Mahsulot",
          material: "Xomashyo",
          selectProductLabel: "Mahsulotni tanlang *",
          selectMaterialLabel: "Xomashyoni tanlang *",
          searchProduct: "Mahsulot nomini yozib qidiring",
          searchMaterial: "Xomashyo nomini yozib qidiring",
          productNotFound: "Mahsulot topilmadi",
          materialNotFound: "Xomashyo topilmadi",
          qty: "Miqdor *",
          qtyPlaceholder: "Miqdor",
          note: "Izoh",
          notePlaceholder: "Qo'shimcha izoh yozing",
          detail: "Ko'chirish tafsiloti",
          sender: "Jo'natuvchi joy",
          receiver: "Qabul qiluvchi joy",
          nomenclature: "Tanlangan nomenklatura",
          transferType: "Ko'chirish turi",
           cancel: "Bekor qilish",
           saving: "Saqlanmoqda...",
           save: "Ko'chirishni saqlash",
           noItemsInLocation: "Tanlangan joylashuvda bu turdagi mahsulot mavjud emas",
           loading: "Yuklanmoqda...",
          refresh: "Yangilash",
          search: "Ko'chirish / nomenklatura / joy bo'yicha qidirish",
          allStatuses: "Barcha holatlar",
          done: "Yakunlangan",
          transfer: "Ko'chirish",
          apply: "Filtr qo'llash",
          sort: "Saralash",
          transferNumber: "Ko'chirish raqami",
          dateTime: "Sana va vaqt",
          itemName: "Nomenklatura",
          state: "Holati",
          unit: "O'lchov birligi",
          price: "Narx",
          total: "Jami",
          print: "Chop etish",
          rowDetail: "Ko'chirish tafsiloti",
          close: "Yopish",
          noData: "Ma'lumot topilmadi",
          of: "dan",
          previous: "Oldingi",
          next: "Keyingi",
        }

  const load = useCallback(async (targetPage = page) => {
    try {
      setLoading(true)
      setError("")
      const res = await fetchInternalOrders(
        {
          page: targetPage,
          page_size: pageSize,
          q: query.trim() || undefined,
          status: status || undefined,
        },
        language
      )
      setRows(res.results)
      setSelectedIds((prev) => prev.filter((id) => res.results.some((row: InternalOrderRow) => row.id === id)))
      setCount(res.count)
      setPage(targetPage)
    } catch (e: unknown) {
      const err = e as ApiLikeError
      setRows([])
      setCount(0)
      setError(String(err?.response?.data?.detail || err?.message || copy.loadError))
    } finally {
      setLoading(false)
    }
  }, [page, query, status, language, copy.loadError])

  useEffect(() => {
    load(1)
  }, [load])

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
      setWarehouseLocationId((current) => current || (l[0]?.id ? String(l[0].id) : ""))
      setToWarehouseLocationId((current) => current || (l[1]?.id ? String(l[1].id) : ""))
    } finally {
      setLookupLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!createOpen) return
    void loadLookups()
    const now = new Date()
    setTransferNo(`TR-${Math.floor(Math.random() * 9000) + 1000}`)
    setTransferDate(now.toISOString().slice(0, 10))
    setTransferTime(now.toTimeString().slice(0, 5))
    setProductId("")
    setRawMaterialId("")
  }, [createOpen, loadLookups])

  useEffect(() => {
    if (!createOpen || !warehouseLocationId) {
      setLocationStockLoading(false)
      setLocationStockIds(null)
      return
    }

    let active = true

    const loadLocationStock = async () => {
      try {
        setLocationStockLoading(true)
        const res = await warehouseApi.fetchStock({ location: Number(warehouseLocationId) }).catch(() => ({ results: [] as StockOnHandItem[] }))
        const nextProducts = new Set<number>()
        const nextMaterials = new Set<number>()

        for (const row of res.results as StockOnHandItem[]) {
          const qty = Number(row.balance_qty ?? row.qty_onhand ?? 0)
          if (!(qty > 0)) continue

          const itemType = String(row.item_type ?? "").toUpperCase()
          if (itemType === "RAW_MATERIAL") {
            const materialId = Number(row.raw_material ?? 0)
            if (materialId > 0) nextMaterials.add(materialId)
            continue
          }

          const productId = Number(row.product ?? 0)
          if (productId > 0) nextProducts.add(productId)
        }

        if (!active) return
        setLocationStockIds({
          products: Array.from(nextProducts),
          materials: Array.from(nextMaterials),
        })
      } finally {
        if (active) setLocationStockLoading(false)
      }
    }

    void loadLocationStock()
    return () => {
      active = false
    }
  }, [createOpen, warehouseLocationId])

  const availableProducts = useMemo(() => {
    if (!locationStockIds) return products
    const ids = new Set(locationStockIds.products)
    return products.filter((item) => ids.has(item.id))
  }, [locationStockIds, products])

  const availableMaterials = useMemo(() => {
    if (!locationStockIds) return materials
    const ids = new Set(locationStockIds.materials)
    return materials.filter((item) => ids.has(item.id))
  }, [locationStockIds, materials])

  useEffect(() => {
    if (!createOpen || !productId) return
    if (!availableProducts.some((item) => String(item.id) === productId)) {
      setProductId("")
    }
  }, [availableProducts, createOpen, productId])

  useEffect(() => {
    if (!createOpen || !rawMaterialId) return
    if (!availableMaterials.some((item) => String(item.id) === rawMaterialId)) {
      setRawMaterialId("")
    }
  }, [availableMaterials, createOpen, rawMaterialId])

  const selectedFromLocationName = useMemo(
    () => locations.find((item) => String(item.id) === warehouseLocationId)?.name || "-",
    [locations, warehouseLocationId]
  )
  const selectedToLocationName = useMemo(
    () => locations.find((item) => String(item.id) === toWarehouseLocationId)?.name || "-",
    [locations, toWarehouseLocationId]
  )
  const selectedItemName = useMemo(() => {
    if (itemKind === "PRODUCT") {
      return availableProducts.find((item) => String(item.id) === productId)?.name || "-"
    }
    return availableMaterials.find((item) => String(item.id) === rawMaterialId)?.name || "-"
  }, [availableMaterials, availableProducts, itemKind, productId, rawMaterialId])

  const createInternalOrder = async () => {
    try {
      if (!warehouseLocationId) return toast.error(copy.selectFrom)
      if (!toWarehouseLocationId) return toast.error(copy.selectTo)
      if (itemKind === "PRODUCT" && !productId) return toast.error(copy.selectProduct)
      if (itemKind === "RAW_MATERIAL" && !rawMaterialId) return toast.error(copy.selectMaterial)

      const qtyNumber = Math.trunc(Number(qty))
      if (!Number.isInteger(qtyNumber) || qtyNumber <= 0) return toast.error(copy.qtyPositive)

      const payload = {
        item_type: itemKind === "PRODUCT" ? "FINISHED_PRODUCT" : "RAW_MATERIAL",
        item_id: itemKind === "PRODUCT" ? Number(productId) : Number(rawMaterialId),
        from_location: Number(warehouseLocationId),
        to_location: toWarehouseLocationId ? Number(toWarehouseLocationId) : undefined,
        qty: String(qtyNumber),
        note: note.trim() || undefined,
      }

      setCreating(true)
      await warehouseApi.createInternalOrder(payload)
      toast.success(copy.created)
      setCreateOpen(false)
      await load(1)
    } catch (e: unknown) {
      const err = e as ApiLikeError
      const data = err?.response?.data
      const msg =
        typeof data === "string"
          ? data
          : data?.detail || (data ? JSON.stringify(data) : err?.message || copy.createError)
      toast.error(String(msg))
    } finally {
      setCreating(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize))
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1
  const to = count === 0 ? 0 : Math.min(count, page * pageSize)
  const statusFilterValue = status || "ALL_STATUSES"
  const openDetail = async (row: InternalOrderRow) => {
    setActiveRow(row)
    setDetailOpen(true)
    setDetailError("")
    setDetailRows([])
    try {
      setDetailLoading(true)
      const rows = await fetchWarehouseDocumentLines({
        mode: "transfer",
        anchorRow: row,
        filterRefType: "MANUAL_TRANSFER",
      })
      setDetailRows(rows)
    } catch (e: unknown) {
      const err = e as ApiLikeError
      setDetailError(String(err?.response?.data?.detail || err?.message || copy.loadError))
      setDetailRows([row])
    } finally {
      setDetailLoading(false)
    }
  }
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      r.order_no.toLowerCase().includes(q) ||
      r.from_location_name.toLowerCase().includes(q) ||
      r.to_location_name.toLowerCase().includes(q) ||
      r.item_name.toLowerCase().includes(q) ||
      r.note.toLowerCase().includes(q)
    )
  }, [rows, query])
  const sortedRows = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1
    const getValue = (row: InternalOrderRow) => {
      if (sortBy === "total") return row.total
      if (sortBy === "created_at") {
        const timestamp = new Date(row.created_at).getTime()
        return Number.isFinite(timestamp) ? timestamp : 0
      }
      if (sortBy === "order_no") {
        const digits = row.order_no.replace(/\D+/g, "")
        return Number(digits || 0)
      }
      return String(row[sortBy] ?? "").toLowerCase()
    }
    return [...filteredRows].sort((a, b) => {
      const left = getValue(a)
      const right = getValue(b)
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor
      return String(left).localeCompare(String(right), language === "ru" ? "ru" : language === "en" ? "en" : "uz") * factor
    })
  }, [filteredRows, language, sortBy, sortDirection])
  const allFilteredSelected = sortedRows.length > 0 && sortedRows.every((row) => selectedIds.includes(row.id))
  const detailDocumentRows = detailRows.length > 0 ? detailRows : activeRow ? [activeRow] : []
  const detailDocumentQty = detailDocumentRows.reduce((sum, row) => sum + documentRowQty(row), 0)
  const detailDocumentTotal = detailDocumentRows.reduce((sum, row) => sum + documentRowTotal(row), 0)
  const detailDialogCopy =
    language === "ru"
      ? {
          main: "Основная информация",
          positions: "Позиции",
          details: "Сведения",
          documentNo: "Номер документа",
          currency: "Валюта",
          empty: "Позиции не найдены",
          positionsMeta: "Позиции перемещения",
          noteFallback: "Примечание не указано",
          source: "Источник",
        }
      : language === "en"
        ? {
            main: "Main information",
            positions: "Items",
            details: "Details",
            documentNo: "Document number",
            currency: "Currency",
            empty: "No items found",
            positionsMeta: "Transfer items",
            noteFallback: "No note provided",
            source: "Source",
          }
        : {
            main: "Asosiy ma'lumotlar",
            positions: "Pozitsiyalar",
            details: "Tafsilotlar",
            documentNo: "Hujjat raqami",
            currency: "Valyuta",
            empty: "Pozitsiyalar topilmadi",
            positionsMeta: "Ko'chirish pozitsiyalari",
            noteFallback: "Izoh kiritilmagan",
            source: "Manba",
          }

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(key)
    setSortDirection(key === "created_at" ? "desc" : "asc")
  }

  const confirmDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    try {
      setDeleting(true)
      await Promise.all(
        selectedIds.map((id) => warehouseApi.deleteLedgerMovement(Number(id)))
      )
      toast.success(language === "ru" ? "Записи удалены" : language === "en" ? "Records deleted" : "Yozuvlar o'chirildi")
      setDeleteOpen(false)
      setSelectedIds([])
      await load(page)
    } catch (e: unknown) {
      const err = e as ApiLikeError
      toast.error(String(err?.response?.data?.detail || err?.message || "Delete error"))
    } finally {
      setDeleting(false)
    }
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortBy !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-80" />
    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  const sortButtonClassName =
    "flex cursor-pointer select-none items-center gap-2 bg-transparent p-0 text-left text-white outline-none"

  const renderSortTrigger = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <span
      role="button"
      tabIndex={0}
      className={`${sortButtonClassName}${align === "right" ? " ml-auto text-right" : ""}`}
      onClick={() => toggleSort(key)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          toggleSort(key)
        }
      }}
    >
      {label}
      {renderSortIcon(key)}
    </span>
  )

  return (
    <div className="space-y-4">
      <div className="motion-enter-side-slow flex items-center justify-between">
        <div className="text-xl font-semibold">{copy.title}</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setDeleteOpen(true)}
            disabled={selectedIds.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            O'chirish
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>{copy.create}</Button>
            </DialogTrigger>
            <DialogContent className="!h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] sm:!w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto rounded-[28px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-0 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)]">
              <DialogHeader className="border-b border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
                <DialogTitle className="text-left text-2xl font-semibold text-slate-900">
                  {copy.newTitle}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 px-6 py-5">
                <div className="grid gap-3 xl:grid-cols-[1fr_220px_140px]">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{copy.transferNo}</label>
                    <Input
                      value={transferNo}
                      onChange={(e) => setTransferNo(e.target.value)}
                      className="h-12 rounded-2xl border-slate-300 bg-white text-lg font-semibold text-slate-900"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{copy.date}</label>
                    <Input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      className="h-12 rounded-2xl border-slate-300 bg-white text-base text-slate-900"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{copy.time}</label>
                    <Input
                      type="time"
                      value={transferTime}
                      onChange={(e) => setTransferTime(e.target.value)}
                      className="h-12 rounded-2xl border-slate-300 bg-white text-base text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">{copy.baseInfo}</div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-1.5">
                        <label className="text-sm text-slate-600">{copy.from}</label>
                        <select
                          className="h-12 rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                          value={warehouseLocationId}
                          onChange={(e) => setWarehouseLocationId(e.target.value)}
                          disabled={lookupLoading}
                        >
                          <option value="">{copy.selectFrom}</option>
                          {locations.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-sm text-slate-600">{copy.to}</label>
                        <select
                          className="h-12 rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                          value={toWarehouseLocationId}
                          onChange={(e) => setToWarehouseLocationId(e.target.value)}
                          disabled={lookupLoading}
                        >
                          <option value="">{copy.selectTo}</option>
                          {locations.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-sm text-slate-600">{copy.itemType}</label>
                        <select
                          className="h-12 rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                          value={itemKind}
                          onChange={(e) => {
                            const nextKind = e.target.value as "PRODUCT" | "RAW_MATERIAL"
                            setItemKind(nextKind)
                            if (nextKind === "PRODUCT") {
                              setRawMaterialId("")
                              return
                            }
                            setProductId("")
                          }}
                        >
                          <option value="PRODUCT">{copy.product}</option>
                          <option value="RAW_MATERIAL">{copy.material}</option>
                        </select>
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-sm text-slate-600 ">
                          {itemKind === "PRODUCT" ? copy.selectProductLabel : copy.selectMaterialLabel}
                        </label>
                        <WarehouseCatalogPicker
                          kind={itemKind === "PRODUCT" ? "PRODUCTS" : "MATERIALS"}
                          products={availableProducts}
                          materials={availableMaterials}
                          selectedId={itemKind === "PRODUCT" ? productId : rawMaterialId}
                          onSelect={(id) => {
                            if (itemKind === "PRODUCT") {
                              setProductId(id)
                              return
                            }
                            setRawMaterialId(id)
                          }}
                          disabled={lookupLoading || locationStockLoading || !warehouseLocationId}
                          mode="overlay"
                          size="compact"
                        />
                        {!lookupLoading && !locationStockLoading && warehouseLocationId && (itemKind === "PRODUCT" ? availableProducts.length === 0 : availableMaterials.length === 0) ? (
                          <div className="text-xs text-amber-600">{copy.noItemsInLocation}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                      <div className="grid gap-1.5">
                        <label className="text-sm text-slate-600">{copy.qty}</label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder={copy.qtyPlaceholder}
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                          className="h-12 rounded-2xl border-slate-300 bg-white text-sm"
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-sm text-slate-600">{copy.note}</label>
                        <Input
                          placeholder={copy.notePlaceholder}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="h-12 rounded-2xl border-slate-300 bg-white text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">{copy.detail}</div>
                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.sender}</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{selectedFromLocationName}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.receiver}</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{selectedToLocationName}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.nomenclature}</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{selectedItemName}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.transferType}</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">
                          {itemKind === "PRODUCT" ? copy.product : copy.material}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>
                  {copy.cancel}
                </Button>
                <Button
                  className="rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 text-white"
                  onClick={createInternalOrder}
                  disabled={creating || lookupLoading}
                >
                  {creating ? copy.saving : copy.save}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => void load(1)} disabled={loading}>{copy.apply}</Button>
          <Button variant="outline" onClick={() => void load(page)} disabled={loading}>{loading ? copy.loading : copy.refresh}</Button>
        </div>
      </div>

      <ScrollReveal delay={90}>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
          <Input className="border-slate-300 bg-white shadow-lg text-black" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} />
          <Select value={statusFilterValue} onValueChange={(value) => setStatus(value === "ALL_STATUSES" ? "" : value)}>
            <SelectTrigger className="h-11 rounded-xl border border-slate-300 bg-white text-base shadow-sm">
              <SelectValue placeholder={copy.allStatuses} />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-200 bg-white shadow-lg">
              <SelectItem value="ALL_STATUSES">{copy.allStatuses}</SelectItem>
              <SelectItem value="DONE">{copy.done}</SelectItem>
              <SelectItem value="TRANSFER">{copy.transfer}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ScrollReveal>

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <ScrollReveal delay={140}>
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#eceff2]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm text-slate-800">
            <thead className="!bg-gradient-to-r from-blue-900 to-blue-700 text-white">
              <tr className="[&>th]:border-r [&>th]:border-r-slate-300 [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:text-sm [&>th]:font-medium [&>th:last-child]:border-r-0">
                <th className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(Array.from(new Set([...selectedIds, ...sortedRows.map((row) => row.id)])))
                      } else {
                        setSelectedIds((prev) => prev.filter((id) => !sortedRows.some((row) => row.id === id)))
                      }
                    }}
                  />
                </th>
                <th>{renderSortTrigger("order_no", copy.transferNumber)}</th>
                <th>{renderSortTrigger("created_at", copy.dateTime)}</th>
                <th>{renderSortTrigger("from_location_name", copy.sender)}</th>
                <th>{renderSortTrigger("to_location_name", copy.receiver)}</th>
                <th>{renderSortTrigger("item_name", copy.itemName)}</th>
                <th>{renderSortTrigger("item_type_label", copy.transferType)}</th>
                <th className="text-right">{renderSortTrigger("total", copy.qty, "right")}</th>
                <th>{renderSortTrigger("status", copy.state)}</th>
                <th>{renderSortTrigger("note", copy.note)}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    {copy.loading}
                  </td>
                </tr>
              ) : null}

              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    {copy.noData}
                  </td>
                </tr>
              ) : null}

              {!loading
                ? sortedRows.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`${idx % 2 === 0 ? "hover:bg-[#e7edf4]" : "bg-slate-50 hover:bg-[#e2e8ef]"} cursor-pointer`}
                      onClick={() => {
                        const rowId = Number(r.id)
                        if (!Number.isFinite(rowId) || rowId <= 0) return
                        navigate(`/dashboard/sklad/warehouse/internal-orders/${rowId}`)
                      }}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            setSelectedIds((prev) => (e.target.checked ? Array.from(new Set([...prev, r.id])) : prev.filter((id) => id !== r.id)))
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatTransferNumber(r.order_no, r.id)}</td>
                      <td className="px-4 py-3">{r.created_at}</td>
                      <td className="px-4 py-3 text-blue-800">{r.from_location_name || "-"}</td>
                      <td className="px-4 py-3 text-blue-800">{r.to_location_name || "-"}</td>
                      <td className="px-4 py-3">{r.item_name}</td>
                      <td className="px-4 py-3">{r.item_type_label}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtNum(r.total)}</td>
                      <td className="px-4 py-3">{statusLabel(r.status, language)}</td>
                      <td className="px-4 py-3">{r.note || "-"}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-300 bg-white px-4 py-2.5">
          <div className="text-sm text-slate-700">
            {from}-{to} {copy.of} {count}
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            disabled={loading}
            onPageChange={(nextPage) => void load(nextPage)}
            size="sm"
          />
        </div>
        </div>
      </ScrollReveal>

      <DeleteAlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={language === "ru" ? "Удаление перемещений" : language === "en" ? "Delete transfers" : "Ko'chirishlarni o'chirish"}
        description={
          language === "ru"
            ? `${selectedIds.length} записей будут удалены. Продолжить?`
            : language === "en"
              ? `${selectedIds.length} records will be deleted. Continue?`
              : `${selectedIds.length} ta yozuv o'chiriladi. Davom etilsinmi?`
        }
        loading={deleting}
        onConfirm={() => void confirmDeleteSelected()}
      />

      <WarehouseDocumentViewDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={activeRow ? `${copy.detail} ${formatTransferNumber(activeRow.order_no, activeRow.id)}` : copy.detail}
        badges={[
          { label: activeRow ? statusLabel(activeRow.status, language) : "-", tone: "emerald" },
          { label: copy.transfer, tone: "blue" },
        ]}
        summary={[
          `${copy.qty}: ${fmtNum(detailDocumentQty)}`,
          `${detailDialogCopy.positions}: ${detailDocumentRows.length}`,
          `${activeRow?.from_location_name || "-"} -> ${activeRow?.to_location_name || "-"}`,
        ]}
        leftTitle={detailDialogCopy.main}
        loading={detailLoading}
        loadingLabel={copy.loading}
        error={detailError}
        actions={[
          {
            label: copy.refresh,
            onClick: () => {
              if (activeRow) void openDetail(activeRow)
            },
            disabled: !activeRow || detailLoading,
            variant: "primary",
          },
          {
            label: copy.print,
            onClick: () => window.print(),
            variant: "secondary",
          },
          {
            label: copy.close,
            onClick: () => setDetailOpen(false),
            variant: "primary",
          },
        ]}
        fields={[
          { label: detailDialogCopy.documentNo, value: activeRow ? formatTransferNumber(activeRow.order_no, activeRow.id) : "-" },
          { label: copy.dateTime, value: activeRow ? formatDateTime(activeRow.created_at, language) : "-" },
          { label: copy.sender, value: activeRow?.from_location_name || "-" },
          { label: copy.receiver, value: activeRow?.to_location_name || "-" },
          { label: copy.transferType, value: activeRow?.item_type_label || "-" },
          { label: detailDialogCopy.currency, value: activeRow?.currency || "UZS" },
          { label: copy.total, value: detailDocumentTotal > 0 ? `${fmtNum(detailDocumentTotal)} ${activeRow?.currency || "UZS"}` : "-" },
          { label: copy.note, value: activeRow?.note || detailDialogCopy.noteFallback, columnSpan: 2, multiline: true },
        ]}
        tabs={[
          {
            key: "positions",
            label: detailDialogCopy.positions,
            content: (
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-700">{detailDialogCopy.positionsMeta}</div>
                  <div className="text-sm text-slate-500">{activeRow?.currency || "UZS"}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] table-fixed text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">№</th>
                          <th className="px-4 py-3 text-left font-semibold">{copy.itemName}</th>
                          <th className="px-4 py-3 text-right font-semibold">{copy.qty}</th>
                          <th className="px-4 py-3 text-left font-semibold">{copy.unit}</th>
                          <th className="px-4 py-3 text-right font-semibold">{copy.price}</th>
                          <th className="px-4 py-3 text-right font-semibold">{copy.total}</th>
                        </tr>
                    </thead>
                    <tbody>
                      {detailDocumentRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            {detailDialogCopy.empty}
                          </td>
                        </tr>
                      ) : (
                        detailDocumentRows.map((row, index) => {
                          const unitCost = documentRowUnitCost(row)
                          const lineTotal = documentRowTotal(row)
                          return (
                            <tr key={`${row.id ?? index}-${index}`} className="border-t border-slate-200">
                              <td className="px-4 py-3">{index + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-900">{documentRowName(row)}</td>
                              <td className="px-4 py-3 text-right">{fmtNum(documentRowQty(row))}</td>
                              <td className="px-4 py-3">{documentRowUnit(row)}</td>
                              <td className="px-4 py-3 text-right">{unitCost > 0 ? fmtNum(unitCost) : "-"}</td>
                              <td className="px-4 py-3 text-right font-semibold">{lineTotal > 0 ? fmtNum(lineTotal) : "-"}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-200 px-4 py-3 text-right text-sm">
                  <span className="text-slate-500">{copy.qty}:</span>{" "}
                  <span className="font-bold text-slate-900">{fmtNum(detailDocumentQty)}</span>
                </div>
              </div>
            ),
          },
          {
            key: "details",
            label: detailDialogCopy.details,
            content: (
              <div className="space-y-4 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.itemName}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{activeRow?.item_name || "-"}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{detailDialogCopy.source}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{activeRow?.ref_type || "MANUAL_TRANSFER"}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.note}</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-900">
                    {activeRow?.note || detailDialogCopy.noteFallback}
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

    </div>
  )
}

