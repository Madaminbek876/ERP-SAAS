import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, Package, Scale } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import TablePagination from "@/components/common/TablePagination"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { warehouseApi } from "../api/warehouseApi"
import { warehouseEvents } from "../api/events"
import type { LookupItem, StockOnHandItem } from "../api/types"
import StockActionCreateDialog from "../components/StockActionCreateDialog"
import WarehouseDocumentViewDialog from "../components/WarehouseDocumentViewDialog"
import { downloadLedgerExportFile } from "../utils/exportFile"
import {
  documentRowName,
  documentRowQty,
  documentRowUnit,
  fetchWarehouseDocumentLines,
  type WarehouseDocumentSourceRow,
} from "../utils/documentDetail"
import ScrollReveal from "@/components/common/ScrollReveal"
import { getCurrentLocale, useI18n } from "@/i18n"

type InventoryRow = {
  id?: number | string
  item_type?: string
  item_id?: number
  itemName?: string
  location?: number
  location_name?: string
  qty?: number | string
  unit_cost?: number | string
  total?: number | string
  movement_type?: string
  note?: string
  date?: string
}

type InventoryUiRow = InventoryRow & {
  rowKey: string
}

type InventorySummary = {
  totalCount: number
  totalAmount: number
  totalQty: number
}

type InventorySortKey = "date" | "itemName" | "id" | "item_type" | "location_name" | "qty" | "note"

function fmtNum(v: number | string | undefined) {
  return new Intl.NumberFormat(getCurrentLocale()).format(Number(v || 0))
}

function fmtDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString(getCurrentLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function itemTypeLabel(value: string | undefined, language: "uz" | "ru" | "en") {
  const key = String(value || "").toUpperCase()
  if (key === "RAW_MATERIAL") return language === "ru" ? "Сырье" : language === "en" ? "Raw material" : "Xomashyo"
  if (key === "FINISHED_PRODUCT") return language === "ru" ? "Готовая продукция" : language === "en" ? "Finished product" : "Tayyor mahsulot"
  return key || "-"
}

function inventoryRowName(row: InventoryRow) {
  return String(row.itemName ?? row.note ?? "-").trim() || "-"
}

function inventoryRowId(row: InventoryRow) {
  const value = row.id ?? row.item_id
  return value === undefined || value === null || value === "" ? "-" : String(value)
}

function inventoryRowMatchesSearch(row: InventoryRow, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    String(row.itemName ?? "").toLowerCase().includes(q) ||
    String(row.item_type ?? "").toLowerCase().includes(q) ||
    String(row.item_id ?? "").toLowerCase().includes(q) ||
    String(row.note ?? "").toLowerCase().includes(q)
  )
}

function inventoryValueKey(itemType?: string, itemId?: number | string, location?: number | string) {
  const normalizedType = String(itemType ?? "").toUpperCase() || "ITEM"
  const normalizedItemId = Number(itemId ?? 0)
  const normalizedLocation = Number(location ?? 0)
  return `${normalizedType}:${Number.isFinite(normalizedItemId) && normalizedItemId > 0 ? normalizedItemId : 0}:${Number.isFinite(normalizedLocation) && normalizedLocation > 0 ? normalizedLocation : 0}`
}

function stockRowItemId(row: StockOnHandItem) {
  if (String(row.item_type ?? "").toUpperCase() === "RAW_MATERIAL") {
    return Number(row.raw_material ?? row.id ?? 0)
  }
  return Number(row.product ?? row.id ?? 0)
}

export default function WarehouseInventoryPage() {
  const { language } = useI18n()
  const navigate = useNavigate()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [recentRows, setRecentRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [summaryRows, setSummaryRows] = useState<InventoryRow[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryStockRows, setSummaryStockRows] = useState<StockOnHandItem[]>([])
  const [summaryStockLoading, setSummaryStockLoading] = useState(false)

  const [locations, setLocations] = useState<Array<LookupItem & { warehouse_id?: number }>>([])
  const [lookupLoading, setLookupLoading] = useState(false)

  const [locationId, setLocationId] = useState("")
  const [itemType, setItemType] = useState<"ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL">("ALL")
  const [movementType, setMovementType] = useState<"ADJUST">("ADJUST")
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useState<InventorySortKey>("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const pageSize = 30
  const [count, setCount] = useState(0)
  const [checkedRowKeys, setCheckedRowKeys] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<InventoryUiRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null)
  const [detailExporting, setDetailExporting] = useState(false)
  const [detailLines, setDetailLines] = useState<WarehouseDocumentSourceRow[]>([])
  const [detailLinesLoading, setDetailLinesLoading] = useState(false)
  const copy =
    language === "ru"
      ? {
        loadError: "Данные инвентаризации не загрузились",
        selectAtLeastOne: "Сначала выберите хотя бы одну строку для удаления",
        noValidId: "У выбранных строк не найден корректный ID",
        deleted: "записей удалено",
        deleteFailed: "записей не удалось удалить",
        deleteError: "Ошибка удаления",
        detailError: "Не удалось загрузить детали",
        itemUnknown: "Товар не определен",
        exportEmpty: "Для выбранного товара записи для экспорта не найдены",
        exportDone: "Файл по выбранному товару загружен",
        exportError: "Не удалось скачать Excel",
        title: "Инвентаризация",
        subtitle: "Страница учета и контроля складских расхождений",
        createTitle: "Добавить новую инвентаризацию",
        createTrigger: "+ Новая инвентаризация",
        filters: "Фильтры",
        selectWarehouse: "Выберите склад",
        searchProduct: "Поиск товара",
        location: "Локация",
        search: "Поиск",
        itemType: "Тип товара",
        movementType: "Тип движения",
        all: "Все",
        searchPlaceholder: "категория и товар",
        categoryProduct: "Категория и товар",
        raw: "Сырье",
        finished: "Готовая продукция",
        movementAdjust: "Корректировка",
        deleteUnavailable: "Удаление недоступно",
        deleteUnavailableHint: "В backend contract не указан endpoint удаления ledger",
        deleteTitle: "Удаление записи инвентаризации",
        deleteQuestion: "Удалить выбранные записи?",
        deleteEmpty: "Пока ничего не выбрано. Перед продолжением отметьте хотя бы одну строку.",
        select: "Выбрать",
        date: "Дата",
        name: "Название",
        id: "ID",
        type: "Тип",
        qty: "Количество",
        note: "Примечание",
        noData: "Данные не найдены",
        loading: "Загрузка...",
        inventoryDoc: "Документ инвентаризации",
        inventoryDocSubtitle: "Таблица записей с деталями по локации и количеству.",
        of: "из",
        products: "Товары",
        searchLabel: "Поиск",
        unit: "Ед. изм.",
        price: "Цена",
        total: "Итого",
        print: "Печать",
        exportExcel: "Скачать Excel",
        refresh: "Обновить",
        close: "Закрыть",
      }
      : language === "en"
        ? {
          loadError: "Inventory data failed to load",
          selectAtLeastOne: "Select at least one row to delete",
          noValidId: "No valid ID found in selected rows",
          deleted: "records deleted",
          deleteFailed: "records could not be deleted",
          deleteError: "Delete error",
          detailError: "Failed to load details",
          itemUnknown: "Item not identified",
          exportEmpty: "No exportable records found for selected item",
          exportDone: "File for selected item downloaded",
          exportError: "Failed to download Excel",
          title: "Inventory",
          subtitle: "Page for recording and controlling warehouse differences",
          createTitle: "Add new inventory",
          createTrigger: "+ New Inventory",
          filters: "Filters",
          selectWarehouse: "Select warehouse",
          searchProduct: "Search product",
          location: "Location",
          search: "Search",
          itemType: "Item type",
          movementType: "Movement type",
          all: "All",
          searchPlaceholder: "category and product",
          categoryProduct: "Category and product",
          raw: "Raw material",
          finished: "Finished product",
          movementAdjust: "Adjustment",
          deleteUnavailable: "Delete unavailable",
          deleteUnavailableHint: "Ledger delete endpoint is not specified in backend contract",
          deleteTitle: "Delete inventory record",
          deleteQuestion: "Delete selected records?",
          deleteEmpty: "Nothing selected yet. Select at least one row before continuing.",
          select: "Select",
          date: "Date",
          name: "Name",
          id: "ID",
          type: "Type",
          qty: "Qty",
          note: "Note",
          noData: "No data found",
          loading: "Loading...",
          inventoryDoc: "Inventory document",
          inventoryDocSubtitle: "Records table with location and quantity details.",
          of: "of",
          products: "Products",
          searchLabel: "Search",
          unit: "Unit",
          price: "Price",
          total: "Total",
          print: "Print",
          exportExcel: "Download Excel",
          refresh: "Refresh",
          close: "Close",
        }
        : {
          loadError: "Inventarizatsiya ma'lumotlari yuklanmadi",
          selectAtLeastOne: "Avval o'chirish uchun kamida bitta qator tanlang",
          noValidId: "Tanlangan qatorlarda yaroqli ID topilmadi",
          deleted: "ta yozuv o'chirildi",
          deleteFailed: "ta yozuvni o'chirib bo'lmadi",
          deleteError: "O'chirishda xatolik",
          detailError: "Detal ma'lumot yuklanmadi",
          itemUnknown: "Mahsulot aniqlanmadi",
          exportEmpty: "Tanlangan mahsulot uchun eksport qilinadigan yozuv topilmadi",
          exportDone: "Tanlangan mahsulot bo'yicha fayl yuklandi",
          exportError: "Excel yuklab bo'lmadi",
          title: "Inventarizatsiya",
          subtitle: "Ombordagi farqlarni ro'yxatga olish va nazorat qilish sahifasi",
          createTitle: "Yangi inventarizatsiya qoshish",
          createTrigger: " + Yangi Inventarizatsiya",
          filters: "Filtrlar",
          selectWarehouse: "Omborni tanlang",
          searchProduct: "Mahsulot qidirish",
          location: "Joylashuv",
          search: "Qidiruv",
          itemType: "Mahsulot turi",
          movementType: "Harakat turi",
          all: "Barchasi",
          searchPlaceholder: "kategoriya va Mahsulot",
          categoryProduct: "Category va Mahsulot",
          raw: "Xomashyo",
          finished: "Tayyor mahsulot",
          movementAdjust: "Kiritish",
          deleteUnavailable: "O'chirish mavjud emas",
          deleteUnavailableHint: "Backend contractda ledger delete endpoint ko'rsatilmagan",
          deleteTitle: "Inventarizatsiya yozuvini o'chirish",
          deleteQuestion: "Tanlangan yozuvlarni o'chirmoqchimisiz?",
          deleteEmpty: "Hali hech narsa tanlanmagan. Davom etishdan oldin kamida bitta qatorni belgilang.",
          select: "Tanlash",
          date: "Sana",
          name: "Nomi",
          id: "ID",
          type: "Turi",
          qty: "Miqdor",
          note: "Izoh",
          noData: "Ma'lumot topilmadi",
          loading: "Yuklanmoqda...",
          inventoryDoc: "Inventarizatsiya hujjati",
          inventoryDocSubtitle: "Yozuvlar jadvali, joylashuv va miqdor tafsilotlari bilan.",
          of: "dan",
          products: "Mahsulotlar",
          searchLabel: "Qidiruv",
          unit: "O'lchov birligi",
          price: "Narx",
          total: "Jami",
          print: "Chop etish",
          exportExcel: "Excel yuklash",
          refresh: "Yangilash",
          close: "Yopish",
        }

  const loadLocations = useCallback(async () => {
    try {
      setLookupLoading(true)
      const list = await warehouseApi.listWarehouseLocationOptions()
      setLocations(list)
      setLocationId((prev) => (prev && list.some((x) => String(x.id) === prev) ? prev : ""))
    } finally {
      setLookupLoading(false)
    }
  }, [])

  const loadRows = useCallback(async (targetPage = page) => {
    try {
      setLoading(true)
      setError("")
      const params: Record<string, string | number> = { page: targetPage, page_size: pageSize }
      params.movement_type = movementType
      if (itemType !== "ALL") params.item_type = itemType
      if (locationId) params.location = Number(locationId)

      const res = await warehouseApi.listMovementsPage(params)
      setRows((res.results ?? []) as InventoryRow[])
      setCount(res.count)
      setPage(targetPage)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      setError(String(err?.response?.data?.detail || err?.message || copy.loadError))
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, itemType, locationId, movementType])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  useEffect(() => {
    loadRows(1)
  }, [loadRows])

  useEffect(() => {
    let active = true

    const loadSummaryRows = async () => {
      try {
        setSummaryLoading(true)
        const summaryPageSize = 500
        let targetPage = 1
        let guard = 0
        const collected: InventoryRow[] = []

        while (guard < 100) {
          const params: Record<string, string | number> = {
            page: targetPage,
            page_size: summaryPageSize,
            movement_type: movementType,
          }
          if (itemType !== "ALL") params.item_type = itemType
          if (locationId) params.location = Number(locationId)

          const res = await warehouseApi.listMovementsPage(params)
          const pageRows = (res.results ?? []) as InventoryRow[]
          collected.push(...pageRows)

          if (!res.next || pageRows.length < summaryPageSize || collected.length >= Number(res.count ?? 0)) {
            break
          }

          targetPage += 1
          guard += 1
        }

        if (active) setSummaryRows(collected)
      } catch {
        if (active) setSummaryRows([])
      } finally {
        if (active) setSummaryLoading(false)
      }
    }

    void loadSummaryRows()
    return () => {
      active = false
    }
  }, [itemType, locationId, movementType])

  useEffect(() => {
    let active = true

    const loadSummaryStockRows = async () => {
      try {
        setSummaryStockLoading(true)
        const summaryPageSize = 500
        let targetPage = 1
        let guard = 0
        const collected: StockOnHandItem[] = []

        while (guard < 100) {
          const params: Record<string, string | number> = {
            page: targetPage,
            page_size: summaryPageSize,
          }
          if (itemType !== "ALL") params.item_type = itemType
          if (locationId) params.location = Number(locationId)

          const res = await warehouseApi.fetchStock(params)
          const pageRows = (res.results ?? []) as StockOnHandItem[]
          collected.push(...pageRows)

          if (!res.next || pageRows.length < summaryPageSize || collected.length >= Number(res.count ?? 0)) {
            break
          }

          targetPage += 1
          guard += 1
        }

        if (active) setSummaryStockRows(collected)
      } catch {
        if (active) setSummaryStockRows([])
      } finally {
        if (active) setSummaryStockLoading(false)
      }
    }

    void loadSummaryStockRows()
    return () => {
      active = false
    }
  }, [itemType, locationId])

  useEffect(() => {
    const unsub = warehouseEvents.subscribe(() => {
      loadRows(page)
    })
    return () => unsub()
  }, [loadRows, page])

  const filteredRows = useMemo(() => {
    const merged = [...recentRows, ...rows]
    return merged.filter((r) => {
      const movementKey = String(r.movement_type || "").toUpperCase()
      const movementOk = movementKey === movementType
      const typeOk = itemType === "ALL" || String(r.item_type || "") === itemType
      const locationOk = !locationId || String(r.location ?? "") === locationId
      const searchOk = inventoryRowMatchesSearch(r, query)
      return movementOk && typeOk && locationOk && searchOk
    })
  }, [recentRows, rows, query, itemType, locationId, movementType])

  const productSuggestions = useMemo(() => {
    const baseRows = [...recentRows, ...rows].filter((r) => {
      const movementKey = String(r.movement_type || "").toUpperCase()
      const movementOk = movementKey === movementType
      const typeOk = itemType === "ALL" || String(r.item_type || "") === itemType
      const locationOk = !locationId || String(r.location ?? "") === locationId
      return movementOk && typeOk && locationOk
    })
    const names = baseRows
      .map((r) => String(r.itemName || "").trim())
      .filter(Boolean)
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)).slice(0, 200)
  }, [recentRows, rows, itemType, locationId, movementType])

  const uiRows = useMemo<InventoryUiRow[]>(() => {
    return filteredRows.map((r, i) => ({
      ...r,
      rowKey: [
        r.id ?? "no-id",
        r.date ?? "no-date",
        r.item_id ?? "no-item",
        r.location ?? "no-location",
        r.qty ?? "no-qty",
        i,
      ].join("_"),
    }))
  }, [filteredRows])

  const locationMap = useMemo(() => new Map(locations.map((x) => [String(x.id), x.name])), [locations])

  const sortedRows = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1
    const getValue = (row: InventoryUiRow) => {
      switch (sortBy) {
        case "date": {
          const timestamp = new Date(row.date || "").getTime()
          return Number.isFinite(timestamp) ? timestamp : 0
        }
        case "itemName":
          return inventoryRowName(row).toLowerCase()
        case "id":
          return inventoryRowId(row).toLowerCase()
        case "item_type":
          return itemTypeLabel(row.item_type, language).toLowerCase()
        case "location_name":
          return String(row.location_name ?? locationMap.get(String(row.location ?? "")) ?? row.location ?? "-").toLowerCase()
        case "qty":
          return Number(row.qty ?? 0)
        case "note":
          return String(row.note ?? "").toLowerCase()
        default:
          return ""
      }
    }
    return [...uiRows].sort((a, b) => {
      const left = getValue(a)
      const right = getValue(b)
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor
      return String(left).localeCompare(String(right), language === "ru" ? "ru" : language === "en" ? "en" : "uz") * factor
    })
  }, [language, locationMap, sortBy, sortDirection, uiRows])

  const toggleSort = (key: InventorySortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(key)
    setSortDirection(key === "date" ? "desc" : "asc")
  }

  const renderSortIcon = (key: InventorySortKey) => {
    if (sortBy !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-80" />
    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  const sortTriggerClassName = "flex cursor-pointer select-none items-center gap-2 bg-transparent p-0 text-left text-white outline-none"

  const renderSortTrigger = (key: InventorySortKey, label: string, align: "left" | "right" = "left") => (
    <span
      role="button"
      tabIndex={0}
      className={`${sortTriggerClassName}${align === "right" ? " ml-auto text-right" : ""}`}
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

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize))
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1
  const to = count === 0 ? 0 : Math.min(count, page * pageSize)
  const totalQty = uiRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const selectedLocationName =
    locationId
      ? locations.find((item) => String(item.id) === locationId)?.name ?? `#${locationId}`
      : language === "ru"
        ? "Все локации"
        : language === "en"
          ? "All locations"
          : "Barcha joylashuvlar"
  const selectedItemTypeLabel =
    itemType === "ALL"
      ? language === "ru"
        ? "Все типы"
        : language === "en"
          ? "All item types"
          : "Barcha turlar"
      : itemTypeLabel(itemType, language)
  const activeFiltersCount = Number(Boolean(locationId)) + Number(itemType !== "ALL") + Number(Boolean(query.trim()))
  const summaryBaseRows = summaryRows.length > 0 ? summaryRows : rows
  const summarySourceRows = useMemo(() => {
    const seen = new Set<string>()
    return [...recentRows, ...summaryBaseRows].filter((row) => {
      const key = [
        row.id ?? "no-id",
        row.date ?? "no-date",
        row.item_id ?? "no-item",
        row.location ?? "no-location",
        row.qty ?? "no-qty",
        row.total ?? "no-total",
      ].join("_")
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [recentRows, summaryBaseRows])
  const stockValueMaps = useMemo(() => {
    const byItemLocation = new Map<string, { qty: number; value: number }>()
    const byItem = new Map<string, { qty: number; value: number }>()

    for (const row of summaryStockRows) {
      const itemTypeKey = String(row.item_type ?? "").toUpperCase()
      const itemId = stockRowItemId(row)
      if (!itemTypeKey || itemId <= 0) continue

      const qty = Number(row.qty_onhand ?? row.balance_qty ?? 0)
      const value = Number(row.value_onhand ?? qty * Number(row.avg_unit_cost ?? 0))
      const locationKey = inventoryValueKey(itemTypeKey, itemId, row.location)
      const itemKey = inventoryValueKey(itemTypeKey, itemId)

      const locationAggregate = byItemLocation.get(locationKey) ?? { qty: 0, value: 0 }
      locationAggregate.qty += qty
      locationAggregate.value += value
      byItemLocation.set(locationKey, locationAggregate)

      const itemAggregate = byItem.get(itemKey) ?? { qty: 0, value: 0 }
      itemAggregate.qty += qty
      itemAggregate.value += value
      byItem.set(itemKey, itemAggregate)
    }

    return { byItemLocation, byItem }
  }, [summaryStockRows])
  const resolveInventoryRowAmount = useCallback((row: InventoryRow) => {
    const directTotal = Number(row.total ?? 0)
    if (Number.isFinite(directTotal) && directTotal > 0) return directTotal

    const qty = Number(row.qty ?? 0)
    if (!Number.isFinite(qty) || qty === 0) return 0

    const directUnitCost = Number(row.unit_cost ?? 0)
    if (Number.isFinite(directUnitCost) && directUnitCost > 0) {
      return qty * directUnitCost
    }

    const readAverageCost = (aggregate?: { qty: number; value: number }) => {
      if (!aggregate || !Number.isFinite(aggregate.qty) || aggregate.qty === 0) return 0
      return aggregate.value / aggregate.qty
    }

    const locationAverageCost = readAverageCost(
      stockValueMaps.byItemLocation.get(inventoryValueKey(row.item_type, row.item_id, row.location))
    )
    if (locationAverageCost > 0) return qty * locationAverageCost

    const itemAverageCost = readAverageCost(stockValueMaps.byItem.get(inventoryValueKey(row.item_type, row.item_id)))
    if (itemAverageCost > 0) return qty * itemAverageCost

    return 0
  }, [stockValueMaps])
  const summaryBusy = summaryLoading || summaryStockLoading
  const inventorySummary = useMemo<InventorySummary>(() => {
    const searchedRows = summarySourceRows.filter((row) => inventoryRowMatchesSearch(row, query))
    return {
      totalCount: searchedRows.length,
      totalAmount: searchedRows.reduce((sum, row) => sum + resolveInventoryRowAmount(row), 0),
      totalQty: searchedRows.reduce((sum, row) => sum + Number(row.qty ?? 0), 0),
    }
  }, [summarySourceRows, query, resolveInventoryRowAmount])
  const inventoryHighlights = [
    {
      key: "count",
      eyebrow: language === "ru" ? "Инвентаризация" : language === "en" ? "Inventory" : "Inventarizatsiya",
      label:
        language === "ru"
          ? "Общее количество инвентаризаций"
          : language === "en"
            ? "Total inventory count"
            : "Jami inventarizatsiya soni",
      value: summaryBusy ? copy.loading : fmtNum(inventorySummary.totalCount),
      icon: <Boxes className="h-5 w-5" />,
      iconClass: "bg-sky-100 text-sky-700",
      accentClass: "from-sky-500 to-cyan-400",
      chips: [selectedLocationName, selectedItemTypeLabel],
    },
    {
      key: "amount",
      eyebrow: language === "ru" ? "Сумма" : language === "en" ? "Amount" : "Summa",
      label: language === "ru" ? "Общая сумма" : language === "en" ? "Total amount" : "Jami summasi",
      value: summaryBusy ? copy.loading : fmtNum(inventorySummary.totalAmount),
      icon: <Scale className="h-5 w-5" />,
      iconClass: "bg-emerald-100 text-emerald-700",
      accentClass: "from-emerald-500 to-teal-400",
      chips: ["UZS", `${language === "ru" ? "Фильтров" : language === "en" ? "Filters" : "Filtrlar"}: ${activeFiltersCount}`],
    },
    {
      key: "qty",
      eyebrow: language === "ru" ? "Товары" : language === "en" ? "Products" : "Mahsulotlar",
      label:
        language === "ru"
          ? "Количество товаров по инвентаризации"
          : language === "en"
            ? "Total inventory product quantity"
            : "Jami inventarizatsiya mahsulot soni",
      value: summaryBusy ? copy.loading : fmtNum(inventorySummary.totalQty),
      icon: <Package className="h-5 w-5" />,
      iconClass: "bg-violet-100 text-violet-700",
      accentClass: "from-violet-500 to-fuchsia-400",
      chips: [
        query.trim() ? `${copy.searchLabel}: ${query.trim()}` : selectedLocationName,
      ],
    },
  ]
  const locationFilterValue = locationId || "ALL_LOCATIONS"
  const checkedRows = uiRows.filter((r) => checkedRowKeys.includes(r.rowKey))

  useEffect(() => {
    setCheckedRowKeys((prev) => prev.filter((key) => uiRows.some((r) => r.rowKey === key)))
  }, [uiRows])

  const deleteSelectedRow = async () => {
    if (checkedRows.length === 0) {
      toast.error(copy.selectAtLeastOne)
      return
    }
    const ids = Array.from(
      new Set(
        checkedRows
          .map((row) => Number(row.id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    )
    if (ids.length === 0) {
      toast.error(copy.noValidId)
      return
    }
    try {
      setDeleting(true)
      const results = await Promise.allSettled(ids.map((id) => warehouseApi.deleteLedgerMovement(id)))
      const successCount = results.filter((x) => x.status === "fulfilled").length
      const failCount = results.length - successCount

      if (successCount > 0) toast.success(`${successCount} ${copy.deleted}`)
      if (failCount > 0) toast.error(`${failCount} ${copy.deleteFailed}`)
      setDeleteOpen(false)
      setCheckedRowKeys([])
      setRecentRows((prev) => prev.filter((x) => !ids.includes(Number(x.id))))
      await loadRows(1)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      toast.error(String(err?.response?.data?.detail || err?.message || copy.deleteError))
    } finally {
      setDeleting(false)
    }
  }

  const openRowDetail = async (row: InventoryUiRow) => {
    setSelectedRow(row)
    setDetailOpen(true)
    setDetailError("")
    setDetailData(null)
    setDetailLines([])

    const id = Number(row.id)
    try {
      setDetailLoading(true)
      setDetailLinesLoading(true)

      const detailTask =
        Number.isFinite(id) && id > 0 ? warehouseApi.ledgerDetail(id) : Promise.resolve<Record<string, unknown> | null>(null)
      const documentTask = fetchWarehouseDocumentLines({
        mode: "inventory",
        anchorRow: row,
        filterMovementType: movementType,
      })

      const [detailResult, linesResult] = await Promise.allSettled([detailTask, documentTask])

      if (detailResult.status === "fulfilled") {
        const data = detailResult.value
        setDetailData((data && typeof data === "object" ? data : null) as Record<string, unknown> | null)
      } else {
        const err = detailResult.reason as { response?: { data?: { detail?: unknown } }; message?: unknown }
        setDetailError(String(err?.response?.data?.detail || err?.message || copy.detailError))
      }

      if (linesResult.status === "fulfilled") {
        setDetailLines(linesResult.value)
      } else {
        setDetailLines([row])
        if (!detailError) {
          const err = linesResult.reason as { response?: { data?: { detail?: unknown } }; message?: unknown }
          setDetailError(String(err?.response?.data?.detail || err?.message || copy.detailError))
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      setDetailError(String(err?.response?.data?.detail || err?.message || copy.detailError))
    } finally {
      setDetailLoading(false)
      setDetailLinesLoading(false)
    }
  }

  const detailItemName =
    String(detailData?.itemName ?? detailData?.item_name ?? detailData?.product_name ?? detailData?.raw_material_name ?? selectedRow?.itemName ?? "-")
  const detailLocation = String(detailData?.location_name ?? selectedRow?.location_name ?? selectedRow?.location ?? "-")
  const detailNote = String(detailData?.note ?? selectedRow?.note ?? "-")
  const detailDate = String(detailData?.occurred_at ?? detailData?.date ?? detailData?.created_at ?? selectedRow?.date ?? "")
  const detailCurrency = String(detailData?.currency ?? "UZS")
  const detailMovementId = typeof detailData?.movement_id === "number" ? detailData.movement_id : undefined
  const detailDocIdRaw = Number(detailData?.id ?? detailMovementId ?? selectedRow?.id ?? 0)
  const detailDocId = Number.isFinite(detailDocIdRaw) && detailDocIdRaw > 0
    ? `INV-${detailDocIdRaw}`
    : `INV-${(detailDate || new Date().toISOString()).replace(/[^\d]/g, "").slice(0, 12)}`
  const detailDocumentRows: WarehouseDocumentSourceRow[] = detailLines.length > 0
    ? detailLines
    : selectedRow
      ? [{ ...selectedRow, ...detailData } as WarehouseDocumentSourceRow]
      : []
  const detailDocumentQty = detailDocumentRows.reduce((sum, row) => sum + documentRowQty(row), 0)
  const detailDocumentTotal = detailDocumentRows.reduce((sum, row) => sum + resolveInventoryRowAmount(row as InventoryRow), 0)
  const detailMovementLabel =
    language === "ru"
      ? "Инвентаризация"
      : language === "en"
        ? "Inventory"
        : "Inventarizatsiya"
  const detailDocumentBadges = [
    { label: detailMovementLabel, tone: "blue" as const },
    { label: `${detailDocumentRows.length} ${copy.products.toLowerCase()}`, tone: "emerald" as const },
  ]
  const detailDocumentSummary = [
    `${copy.total}: ${fmtNum(detailDocumentTotal.toFixed(2))} ${detailCurrency}`,
    `${copy.qty}: ${fmtNum(detailDocumentQty)}`,
    `${copy.location}: ${detailLocation}`,
  ]
  const detailDialogCopy =
    language === "ru"
      ? {
        main: "Основная информация",
        positions: "Позиции",
        details: "Сведения",
        documentNo: "Номер документа",
        currency: "Валюта",
        empty: "Позиции не найдены",
        positionsMeta: "Позиции документа",
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
          positionsMeta: "Document items",
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
          positionsMeta: "Hujjat pozitsiyalari",
          noteFallback: "Izoh kiritilmagan",
          source: "Manba",
        }
  const controlInputClass = "h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 shadow-lg placeholder:text-slate-400"
  const controlSelectClass = "!h-11 !w-full rounded-2xl border border-slate-300 bg-white px-4 py-0 text-sm font-semibold text-slate-900 shadow-lg cursor-pointer"

  const exportDetailExcel = async () => {
    try {
      setDetailExporting(true)
      if (detailDocumentRows.length === 0) {
        toast.error(copy.exportEmpty)
        return
      }

      const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`
      const header = [copy.date, copy.name, copy.type, copy.location, copy.qty, copy.price, copy.total, copy.note]
      const lines = [
        header.map(esc).join(";"),
        ...detailDocumentRows.map((row) =>
          [
            fmtDate(String(row.date ?? row.occurred_at ?? row.created_at ?? "")),
            documentRowName(row),
            itemTypeLabel(String(row.item_type ?? ""), language),
            String(row.location_name ?? row.location ?? "-"),
            fmtNum(documentRowQty(row)),
            fmtNum((documentRowQty(row) > 0 ? resolveInventoryRowAmount(row as InventoryRow) / documentRowQty(row) : 0).toFixed(2)),
            fmtNum(resolveInventoryRowAmount(row as InventoryRow).toFixed(2)),
            String(row.note ?? "-"),
          ]
            .map(esc)
            .join(";")
        ),
      ]

      const csvBlob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      await downloadLedgerExportFile({
        data: csvBlob,
        contentType: "text/csv;charset=utf-8;",
        baseName: `inventarizatsiya-${detailDocId}-${stamp}`,
      })
      toast.success(copy.exportDone)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      toast.error(String(err?.response?.data?.detail || err?.message || copy.exportError))
    } finally {
      setDetailExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="motion-enter-side-slow relative overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_32%),linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-blue-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 shadow-sm">
              {language === "ru" ? "Складской контроль" : language === "en" ? "Warehouse control" : "Ombor nazorati"}
            </div>
            <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{copy.title}</div>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{copy.subtitle}</p>
          </div>
          <div className="flex items-center">
            <StockActionCreateDialog
              action="adjust"
              title={copy.createTitle}
              triggerLabel={copy.createTrigger}
              onSuccess={(created) => {
                if (created && typeof created === "object") {
                  const normalized = {
                    ...created,
                    movement_type: "ADJUST",
                  } as InventoryRow
                  setRecentRows((prev) => [normalized, ...prev].slice(0, 20))
                }
                loadRows(1)
              }}
            />
          </div>
        </div>

        <div className="relative mt-6 grid gap-4 xl:grid-cols-3">
          {inventoryHighlights.map((card) => (
            <div
              key={card.key}
              className="group relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className={["pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r", card.accentClass].join(" ")} />
              <div className="pointer-events-none absolute -right-8 top-4 h-20 w-20 rounded-full bg-slate-100/80 blur-2xl transition-transform duration-500 group-hover:scale-110" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {card.eyebrow}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-500">{card.label}</div>
                    <div className="break-words text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                      {card.value}
                    </div>
                  </div>
                </div>

                <div className={["relative inline-flex rounded-2xl p-3.5 shadow-sm ring-1 ring-black/5", card.iconClass].join(" ")}>
                  {card.icon}
                </div>
              </div>

              {card.chips.length > 0 ? (
                <div className="relative mt-5 flex flex-wrap gap-2 border-t border-dashed border-slate-200 pt-4">
                  {card.chips.map((chip) => (
                    <div
                      key={`${card.key}-${chip}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
                    >
                      {chip}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <ScrollReveal delay={100}>
        <div className="rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="space-y-3 rounded-2xl border border-blue-700 bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="text-base font-medium text-slate-900">{copy.filters}</div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <div className="flex h-5 items-end text-xs text-slate-500">{copy.selectWarehouse}</div>
                <Select
                  value={locationFilterValue}
                  onValueChange={(value) => setLocationId(value === "ALL_LOCATIONS" ? "" : value)}
                  disabled={lookupLoading}
                >
                  <SelectTrigger className={`${controlSelectClass} !border-slate-300 bg-white text-black`}>
                    <SelectValue placeholder={copy.all} />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg text-black">
                    <SelectItem value="ALL_LOCATIONS">{copy.all}</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="flex h-5 items-end text-xs text-slate-500">{copy.searchProduct}</div>
                <Input
                  className={controlInputClass}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  list="inventory-product-suggestions"
                  placeholder={copy.categoryProduct}
                />
                <datalist id="inventory-product-suggestions">
                  {productSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1">
                <div className="flex h-5 items-end text-xs text-slate-500">{copy.itemType}</div>
                <Select value={itemType} onValueChange={(value) => setItemType(value as "ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL")}>
                  <SelectTrigger className={`${controlSelectClass} !border-slate-300 bg-white text-black`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white text-black shadow-lg">
                    <SelectItem value="ALL">{copy.all}</SelectItem>
                    <SelectItem value="RAW_MATERIAL">{copy.raw}</SelectItem>
                    <SelectItem value="FINISHED_PRODUCT">{copy.finished}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="flex h-5 items-end text-xs text-transparent">Delete</div>
                <Button
                  variant="destructive"
                  className="!h-11 w-full rounded-2xl !bg-none !bg-rose-400 !text-white hover:!bg-rose-500"
                  disabled={checkedRows.length === 0 || deleting}
                  onClick={() => setDeleteOpen(true)}
                >
                  {deleting ? copy.loading : copy.deleteTitle}
                </Button>
              </div>
            </div>
          </div>

          <DeleteAlertDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={copy.deleteTitle}
            description={
              checkedRows.length > 0
                ? `${checkedRows.length}. ${copy.deleteQuestion}`
                : copy.deleteEmpty
            }
            loading={deleting}
            onConfirm={() => void deleteSelectedRow()}
          />

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">{copy.inventoryDoc}</div>
                <div className="mt-1 text-sm text-slate-500">{copy.inventoryDocSubtitle}</div>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
                {copy.qty}: {fmtNum(totalQty)}
              </div>
            </div>

            <div className="overflow-hidden border-t border-slate-200 bg-[#eceff2]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1160px] text-sm text-slate-800">
                  <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
                    <tr className="[&>th]:border-r [&>th]:border-r-slate-300 [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:text-sm [&>th]:font-medium [&>th:last-child]:border-r-0">
                      <th className="w-16 text-center">{copy.select}</th>
                      <th>{renderSortTrigger("date", copy.date)}</th>
                      <th>{renderSortTrigger("itemName", copy.name)}</th>
                      <th>{renderSortTrigger("item_type", copy.type)}</th>
                      <th>{renderSortTrigger("location_name", copy.location)}</th>
                      <th className="text-right">{renderSortTrigger("qty", copy.qty, "right")}</th>
                      <th>{renderSortTrigger("note", copy.note)}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-300 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          {copy.loading}
                        </td>
                      </tr>
                    ) : null}

                    {!loading && uiRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                          {copy.noData}
                        </td>
                      </tr>
                    ) : null}

                    {!loading
                      ? sortedRows.map((r, i) => (
                        <tr
                          key={r.rowKey}
                          className={`cursor-pointer transition ${i % 2 === 0 ? "hover:bg-[#e7edf4]" : "bg-slate-50 hover:bg-[#e2e8ef]"}`}
                          onClick={() => {
                            const rowId = Number(r.id)
                            if (!Number.isFinite(rowId) || rowId <= 0) return
                            navigate(`/dashboard/sklad/warehouse/inventories/${rowId}`)
                          }}
                        >
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={checkedRowKeys.includes(r.rowKey)}
                              onCheckedChange={(checked) => {
                                setCheckedRowKeys((prev) =>
                                  checked ? Array.from(new Set([...prev, r.rowKey])) : prev.filter((x) => x !== r.rowKey)
                                )
                              }}
                              aria-label={`Qatorni tanlash ${r.id ?? i}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-700">{fmtDate(r.date)}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{inventoryRowName(r)}</td>
                          <td className="px-4 py-3">{itemTypeLabel(r.item_type, language)}</td>
                          <td className="px-4 py-3">{r.location_name ?? locationMap.get(String(r.location ?? "")) ?? r.location ?? "-"}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">{fmtNum(r.qty)}</td>
                          <td className="px-4 py-3 text-slate-600">{r.note ?? "-"}</td>
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
                  onPageChange={(nextPage) => void loadRows(nextPage)}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>

      <WarehouseDocumentViewDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={`${copy.inventoryDoc} ${detailDocId}`}
        badges={detailDocumentBadges}
        summary={detailDocumentSummary}
        leftTitle={detailDialogCopy.main}
        loading={detailLoading || detailLinesLoading}
        loadingLabel={copy.loading}
        error={detailError}
        actions={[
          {
            label: copy.refresh,
            onClick: () => {
              if (selectedRow) void openRowDetail(selectedRow)
            },
            disabled: !selectedRow || detailLoading || detailLinesLoading,
            variant: "primary",
          },
          {
            label: detailExporting ? copy.loading : copy.exportExcel,
            onClick: () => void exportDetailExcel(),
            disabled: detailExporting || detailDocumentRows.length === 0,
            variant: "outline",
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
          { label: detailDialogCopy.documentNo, value: `${copy.title} № ${detailDocId}` },
          { label: copy.date, value: fmtDate(detailDate) },
          { label: copy.location, value: detailLocation },
          { label: copy.qty, value: fmtNum(detailDocumentQty) },
          { label: detailDialogCopy.currency, value: detailCurrency },
          { label: copy.total, value: `${fmtNum(detailDocumentTotal.toFixed(2))} ${detailCurrency}` },
          { label: copy.note, value: detailNote || detailDialogCopy.noteFallback, columnSpan: 2, multiline: true },
        ]}
        tabs={[
          {
            key: "positions",
            label: detailDialogCopy.positions,
            content: (
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-700">{detailDialogCopy.positionsMeta}</div>
                  <div className="text-sm text-slate-500">{detailCurrency}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] table-fixed text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">№</th>
                        <th className="px-4 py-3 text-left font-semibold">{copy.name}</th>
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
                          const lineQty = documentRowQty(row)
                          const lineTotal = resolveInventoryRowAmount(row as InventoryRow)
                          const lineUnitPrice = lineQty > 0 ? lineTotal / lineQty : 0
                          return (
                            <tr key={`${row.id ?? index}-${index}`} className="border-t border-slate-200">
                              <td className="px-4 py-3">{index + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-900">{documentRowName(row)}</td>
                              <td className="px-4 py-3 text-right">{fmtNum(lineQty)}</td>
                              <td className="px-4 py-3">{documentRowUnit(row)}</td>
                              <td className="px-4 py-3 text-right">{lineUnitPrice > 0 ? fmtNum(lineUnitPrice.toFixed(2)) : "-"}</td>
                              <td className="px-4 py-3 text-right font-semibold">{lineTotal > 0 ? fmtNum(lineTotal.toFixed(2)) : "-"}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-200 px-4 py-3 text-right text-sm">
                  <span className="text-slate-500">{copy.total}:</span>{" "}
                  <span className="font-bold text-slate-900">{fmtNum(detailDocumentTotal.toFixed(2))} {detailCurrency}</span>
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
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.searchLabel}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{detailItemName}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{detailDialogCopy.source}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{detailMovementLabel}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.note}</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-900">
                    {detailNote || detailDialogCopy.noteFallback}
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
