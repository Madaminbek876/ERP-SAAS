import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import TablePagination from "@/components/common/TablePagination"
import { warehouseApi } from "../api/warehouseApi"
import { warehouseEvents } from "../api/events"
import type { LookupItem, WarehouseAction } from "../api/types"
import StockActionCreateDialog from "../components/StockActionCreateDialog"
import WarehouseDocumentViewDialog from "../components/WarehouseDocumentViewDialog"
import { downloadLedgerExportFile } from "../utils/exportFile"
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
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

type ActionMode = "receipt" | "transfer" | "writeoff"

type ModeConfig = {
  title: string
  action: WarehouseAction
  rowMatches: (row: MovementRow) => boolean
  createLabel: string
  movementType?: string
  refType?: string
  optimisticMovementType?: string
  optimisticRefType?: string
}

type MovementRow = {
  id?: number | string
  item_type?: string
  item_id?: number
  itemName?: string
  location?: number
  location_name?: string
  from_location_name?: string
  to_location_name?: string
  from_location?: number
  to_location?: number
  qty?: number | string
  unit_cost?: number
  total?: number
  currency?: string
  movement_type?: string
  ref_type?: string
  ref_id?: number | null
  date?: string
  note?: string
}

type TableSortKey = "date" | "itemName" | "item_type" | "movement_type" | "location_name" | "qty" | "note"

function movementKey(value?: string) {
  return String(value || "").toUpperCase().trim()
}

function refTypeKey(value?: string) {
  return String(value || "").toUpperCase().trim()
}

const CONFIG: Record<ActionMode, ModeConfig> = {
  receipt: {
    title: "Prixod",
    action: "receipt",
    rowMatches: (row) => movementKey(row.movement_type) === "IN",
    createLabel: "Yangi prixod",
    movementType: "IN",
    optimisticMovementType: "IN",
    optimisticRefType: "MANUAL_RECEIPT",
  },
  transfer: {
    title: "Peremesheniya",
    action: "transfer",
    rowMatches: (row) => refTypeKey(row.ref_type) === "MANUAL_TRANSFER",
    createLabel: "Yangi peremesheniya",
    refType: "MANUAL_TRANSFER",
    optimisticMovementType: "OUT",
    optimisticRefType: "MANUAL_TRANSFER",
  },
  writeoff: {
    title: "Ombordan Chiqarish",
    action: "waste",
    rowMatches: (row) => movementKey(row.movement_type) === "WASTE" || refTypeKey(row.ref_type) === "MANUAL_WASTE",
    createLabel: " + Yangi chiqim",
    refType: "MANUAL_WASTE",
    optimisticMovementType: "WASTE",
    optimisticRefType: "MANUAL_WASTE",
  },
}

function fmtNum(v: number | string | undefined) {
  return new Intl.NumberFormat("uz-UZ").format(Number(v || 0))
}

function fmtDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function itemTypeLabel(value?: string) {
  const key = String(value || "").toUpperCase()
  if (key === "RAW_MATERIAL") return "Xomashyo"
  if (key === "FINISHED_PRODUCT") return "Tayyor mahsulot"
  return key || "-"
}

function movementTypeLabel(value?: string, language?: string) {
  const key = String(value || "").toUpperCase().trim()
  if (!key) return "-"

  const labels: Record<string, { uz: string; ru: string; en: string }> = {
    WASTE: { uz: "Hisobdan chiqarish", ru: "Списание", en: "Write-off" },
    IN: { uz: "Kirim", ru: "Приход", en: "Receipt" },
    OUT: { uz: "Chiqim", ru: "Расход", en: "Issue" },
    TRANSFER: { uz: "Ko'chirish", ru: "Перемещение", en: "Transfer" },
  }

  const locale = language === "ru" ? "ru" : language === "en" ? "en" : "uz"
  return labels[key]?.[locale] ?? key
}

function localizedLocationName(value?: string, language?: string) {
  const raw = String(value || "").trim()
  if (!raw || raw === "-") return "-"

  if (language === "ru") {
    return raw.replace(/^Warehouse\b/i, "Склад")
  }

  if (language === "uz") {
    return raw.replace(/^Warehouse\b/i, "Ombor")
  }

  return raw
}

export default function WarehouseActionPage({ mode }: { mode: ActionMode }) {
  const { language } = useI18n()
  const navigate = useNavigate()
  const cfg = CONFIG[mode]
  const pageTitle =
    mode === "writeoff" && language === "ru"
      ? "Списание со склада"
      : cfg.title
  const createActionLabel =
    mode === "writeoff" && language === "ru"
      ? "+ Новый Расход"
      : cfg.createLabel
  const detailDocLabel =
    mode === "writeoff" && language === "ru"
      ? "Списание со склада №"
      : "Ombordan chiqarish №"
  const [rows, setRows] = useState<MovementRow[]>([])
  const [recentRows, setRecentRows] = useState<MovementRow[]>([])
  const [locations, setLocations] = useState<Array<LookupItem & { warehouse_id?: number }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [locationId, setLocationId] = useState("")
  const [itemType, setItemType] = useState<"ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL">("ALL")
  const [sortBy, setSortBy] = useState<TableSortKey>("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [count, setCount] = useState(0)
  const [checkedRowKeys, setCheckedRowKeys] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<(MovementRow & { rowKey: string }) | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null)
  const [detailExporting, setDetailExporting] = useState(false)
  const [detailLines, setDetailLines] = useState<WarehouseDocumentSourceRow[]>([])
  const [detailLinesLoading, setDetailLinesLoading] = useState(false)
  const copy =
    language === "ru"
      ? {
        loadError: "Движения не загрузились",
        selectAtLeastOne: "Сначала выберите хотя бы одну строку для удаления",
        noValidId: "У выбранных строк не найден корректный ID",
        deleted: "записей удалено",
        deleteFailed: "записей не удалось удалить",
        deleteError: "Ошибка удаления",
        detailError: "Не удалось загрузить детали",
        itemUnknown: "Товар не определен",
        exportEmpty: "Для выбранного товара записи для экспорта не найдены",
        exportDone: "Excel файл загружен",
        exportError: "Не удалось скачать Excel",
        filters: "Фильтры",
        selectWarehouse: "Склад",
        all: "Все",
        searchProduct: "Поиск товара",
        categoryProduct: "Категория и товар",
        itemType: "Тип товара",
        raw: "Сырье",
        finished: "Готовая продукция",
        deleteUnavailable: "Удаление недоступно",
        deleteUnavailableHint: "В backend contract не указан endpoint удаления ledger",
        deleteTitle: "Удаление записи списания",
        deleteQuestion: "Удалить выбранные записи?",
        deleteEmpty: "Пока ничего не выбрано. Перед продолжением отметьте хотя бы одну строку.",
        select: "Выбрать",
        date: "Дата",
        name: "Название",
        type: "Тип",
        state: "Статус товара",
        location: "Локация",
        qty: "Количество",
        note: "Примечание",
        noData: "Данные не найдены",
        loading: "Загрузка...",
        doc: "Документ списания",
        movementType: "Тип движения",
        products: "Товары",
        search: "Поиск",
        unit: "Ед. изм.",
        price: "Цена",
        total: "Итого",
        print: "Печать",
        exportExcel: "Скачать Excel",
        close: "Закрыть",
        refresh: "Обновить",
        searchPlaceholder: "Поиск по item / location / note",
        of: "из",
      }
      : language === "en"
        ? {
          loadError: "Failed to load movements",
          selectAtLeastOne: "Select at least one row to delete",
          noValidId: "No valid ID found in selected rows",
          deleted: "records deleted",
          deleteFailed: "records could not be deleted",
          deleteError: "Delete error",
          detailError: "Failed to load details",
          itemUnknown: "Item not identified",
          exportEmpty: "No exportable records found for selected item",
          exportDone: "Excel file downloaded",
          exportError: "Failed to download Excel",
          filters: "Filters",
          selectWarehouse: "Warehouse",
          all: "All",
          searchProduct: "Product search",
          categoryProduct: "Category and product",
          itemType: "Item type",
          raw: "Raw material",
          finished: "Finished product",
          deleteUnavailable: "Delete unavailable",
          deleteUnavailableHint: "Ledger delete endpoint is not specified in backend contract",
          deleteTitle: "Delete write-off record",
          deleteQuestion: "Delete selected records?",
          deleteEmpty: "Nothing selected yet. Select at least one row before continuing.",
          select: "Select",
          date: "Date",
          name: "Name",
          type: "Type",
          state: "Item state",
          location: "Location",
          qty: "Qty",
          note: "Note",
          noData: "No data found",
          loading: "Loading...",
          doc: "Write-off document",
          movementType: "Movement type",
          products: "Products",
          search: "Search",
          unit: "Unit",
          price: "Price",
          total: "Total",
          print: "Print",
          exportExcel: "Download Excel",
          close: "Close",
          refresh: "Refresh",
          searchPlaceholder: "Search by item / location / note",
          of: "of",
        }
        : {
          loadError: "Harakatlar yuklanmadi",
          selectAtLeastOne: "Avval o'chirish uchun kamida bitta qator tanlang",
          noValidId: "Tanlangan qatorlarda yaroqli ID topilmadi",
          deleted: "ta yozuv o'chirildi",
          deleteFailed: "ta yozuvni o'chirib bo'lmadi",
          deleteError: "O'chirishda xatolik",
          detailError: "Detal ma'lumot yuklanmadi",
          itemUnknown: "Mahsulot aniqlanmadi",
          exportEmpty: "Tanlangan mahsulot uchun eksport qilinadigan yozuv topilmadi",
          exportDone: "Excel fayl yuklandi",
          exportError: "Excel yuklab bo'lmadi",
          filters: "Filtrlar",
          selectWarehouse: "Ombor",
          all: "Barchasi",
          searchProduct: "Mahsulot qidirish",
          categoryProduct: "Kategoriya va mahsulot",
          itemType: "Mahsulot turi",
          raw: "Xomashyo",
          finished: "Tayyor mahsulot",
          deleteUnavailable: "O'chirish mavjud emas",
          deleteUnavailableHint: "Backend shartnomasida ledger delete endpoint ko'rsatilmagan",
          deleteTitle: "O'chirish",
          deleteQuestion: "Tanlangan yozuvlarni o'chirmoqchimisiz?",
          deleteEmpty: "Hali hech narsa tanlanmagan. Davom etishdan oldin kamida bitta qatorni belgilang.",
          select: "Tanlash",
          date: "Sana",
          name: "Nomi",
          type: "Turi",
          state: "Mahsulot holati",
          location: "Joylashuv",
          qty: "Miqdor",
          note: "Izoh",
          noData: "Ma'lumot topilmadi",
          loading: "Yuklanmoqda...",
          doc: "Hisobdan chiqarish hujjati",
          movementType: "Harakat turi",
          products: "Mahsulotlar",
          search: "Qidiruv",
          unit: "O'lchov birligi",
          price: "Narx",
          total: "Jami",
          print: "Chop etish",
          exportExcel: "Excel yuklash",
          close: "Yopish",
          refresh: "Yangilash",
          searchPlaceholder: "mahsulot / joylashuv / izoh bo'yicha qidirish",
          of: "dan",
        }

  const loadRows = useCallback(
    async (targetPage = page) => {
      try {
        setLoading(true)
        setError("")
        const params: Record<string, number | string> = { page: targetPage, page_size: pageSize }
        if (cfg.movementType) params.movement_type = cfg.movementType
        if (cfg.refType) params.ref_type = cfg.refType
        if (itemType !== "ALL") params.item_type = itemType
        if (mode === "writeoff" && locationId) params.location = Number(locationId)
        const res = await warehouseApi.listMovementsPage(params)
        setRows((res.results ?? []) as MovementRow[])
        setCount(res.count ?? 0)
        setPage(targetPage)
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
        setError(String(err?.response?.data?.detail || err?.message || copy.loadError))
        setRows([])
        setCount(0)
      } finally {
        setLoading(false)
      }
    },
    [page, cfg.movementType, cfg.refType, mode, locationId, itemType]
  )

  useEffect(() => {
    ; (async () => {
      const list = await warehouseApi.listWarehouseLocationOptions().catch(() => [])
      setLocations(list)
    })()
  }, [])

  useEffect(() => {
    loadRows(1)
  }, [mode, loadRows])

  useEffect(() => {
    const unsub = warehouseEvents.subscribe(() => {
      loadRows(page)
    })
    return () => unsub()
  }, [page, mode, loadRows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const merged = [...recentRows, ...rows]
    return merged.filter((r) => {
      const typeOk = cfg.rowMatches(r)
      const itemTypeOk = itemType === "ALL" || String(r.item_type || "") === itemType
      const locationOk = mode !== "writeoff" || !locationId || String(r.location ?? "") === locationId
      const searchOk =
        !q ||
        String(r.item_type || "").toLowerCase().includes(q) ||
        String(r.item_id || "").toLowerCase().includes(q) ||
        String(r.itemName || "").toLowerCase().includes(q) ||
        String(r.location_name || "").toLowerCase().includes(q) ||
        String(r.from_location_name || "").toLowerCase().includes(q) ||
        String(r.to_location_name || "").toLowerCase().includes(q) ||
        String(r.ref_type || "").toLowerCase().includes(q) ||
        String(r.note || "").toLowerCase().includes(q)
      return typeOk && itemTypeOk && locationOk && searchOk
    })
  }, [recentRows, rows, search, cfg.rowMatches, itemType, mode, locationId])

  const productSuggestions = useMemo(() => {
    const merged = [...recentRows, ...rows]
    const names = merged
      .map((r) => String(r.itemName || "").trim())
      .filter(Boolean)
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)).slice(0, 200)
  }, [recentRows, rows])

  const uiRows = useMemo(() => {
    return filteredRows.map((r, i) => ({
      ...r,
      rowKey: [r.id ?? "no-id", r.date ?? "no-date", r.item_id ?? "no-item", r.location ?? "no-location", i].join("_"),
    }))
  }, [filteredRows])
  const sortedRows = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1
    const getValue = (row: MovementRow) => {
      if (sortBy === "qty") return Number(row.qty || 0)
      if (sortBy === "date") {
        const timestamp = new Date(String(row.date ?? "")).getTime()
        return Number.isFinite(timestamp) ? timestamp : 0
      }
      return String(row[sortBy] ?? "").toLowerCase()
    }
    return [...uiRows].sort((a, b) => {
      const left = getValue(a)
      const right = getValue(b)
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor
      return String(left).localeCompare(String(right), language === "ru" ? "ru" : language === "en" ? "en" : "uz") * factor
    })
  }, [language, sortBy, sortDirection, uiRows])

  const getLocationName = (id?: number, fallback?: string) => {
    if (fallback) return localizedLocationName(fallback, language)
    if (!id) return "-"
    return localizedLocationName(locations.find((x) => x.id === id)?.name || String(id), language)
  }
  const locationMap = useMemo(
    () => new Map(locations.map((x) => [String(x.id), localizedLocationName(x.name, language)])),
    [language, locations]
  )
  const checkedRows = uiRows.filter((r) => checkedRowKeys.includes(r.rowKey))
  const locationFilterValue = locationId || "ALL_LOCATIONS"

  useEffect(() => {
    setCheckedRowKeys((prev) => prev.filter((key) => uiRows.some((r) => r.rowKey === key)))
  }, [uiRows])

  const deleteSelectedRows = async () => {
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

  const openRowDetail = async (row: MovementRow & { rowKey: string }) => {
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
        mode: mode === "writeoff" ? "writeoff" : "transfer",
        anchorRow: row,
        filterRefType: cfg.refType,
        filterMovementType: cfg.movementType,
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

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize))
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1
  const to = count === 0 ? 0 : Math.min(count, page * pageSize)
  const detailItemName = String(detailData?.itemName ?? detailData?.item_name ?? selectedRow?.itemName ?? "-")
  const detailLocation = localizedLocationName(
    String(detailData?.location_name ?? selectedRow?.location_name ?? selectedRow?.location ?? "-"),
    language
  )
  const detailCurrency = String(detailData?.currency ?? selectedRow?.currency ?? "UZS")
  const detailDate = String(detailData?.occurred_at ?? detailData?.date ?? detailData?.created_at ?? selectedRow?.date ?? "")
  const detailNote = String(detailData?.note ?? selectedRow?.note ?? "-")
  const detailMovement = movementTypeLabel(
    String(detailData?.movement_type ?? selectedRow?.movement_type ?? cfg.movementType ?? "-"),
    language
  )
  const detailDocIdRaw = Number(detailData?.id ?? selectedRow?.id ?? 0)
  const detailDocId = Number.isFinite(detailDocIdRaw) && detailDocIdRaw > 0
    ? `SPI-${detailDocIdRaw}`
    : `SPI-${(detailDate || new Date().toISOString()).replace(/[^\d]/g, "").slice(0, 12)}`
  const detailDocumentRows: WarehouseDocumentSourceRow[] = detailLines.length > 0
    ? detailLines
      : selectedRow
      ? [{ ...selectedRow, ...detailData } as WarehouseDocumentSourceRow]
      : []
  const detailDocumentQty = detailDocumentRows.reduce((sum, row) => sum + documentRowQty(row), 0)
  const detailDocumentTotal = detailDocumentRows.reduce((sum, row) => sum + documentRowTotal(row), 0)
  const detailDocumentBadges = [
    { label: detailMovement, tone: "blue" as const },
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
  const filterSelectClass = "!h-11 !min-h-11 rounded-xl border border-blue-800 bg-gradient-to-r from-blue-900 to-blue-700 px-3 py-0 text-sm font-semibold text-white shadow-sm"
  const filterInputClass = "h-11 w-full rounded-xl border-slate-300 bg-white shadow-lg text-black border px-3 text-sm font-medium "

  const toggleSort = (key: TableSortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(key)
    setSortDirection(key === "date" ? "desc" : "asc")
  }

  const renderSortIcon = (key: TableSortKey) => {
    if (sortBy !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-80" />
    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  const sortTriggerClassName = "flex cursor-pointer select-none items-center gap-2 bg-transparent p-0 text-left text-white outline-none"

  const renderSortTrigger = (key: TableSortKey, label: string, align: "left" | "right" = "left") => (
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
            itemTypeLabel(String(row.item_type ?? "")),
            String(row.location_name ?? row.from_location_name ?? row.location ?? "-"),
            fmtNum(documentRowQty(row)),
            fmtNum(documentRowUnitCost(row).toFixed(2)),
            fmtNum(documentRowTotal(row).toFixed(2)),
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
        baseName: `hisobdan-chiqarish-${detailDocId}-${stamp}`,
      })
      toast.success(copy.exportDone)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      toast.error(String(err?.response?.data?.detail || err?.message || copy.exportError))
    } finally {
      setDetailExporting(false)
    }
  }

  if (mode === "writeoff") {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-2xl font-semibold text-slate-900 ">{pageTitle}</div>
            <div className="flex items-center gap-2">
              <StockActionCreateDialog
                action={cfg.action}
                submitAction={cfg.action}
                forceMovementType={undefined}
                title={createActionLabel}
                triggerLabel={createActionLabel}
                onSuccess={(created) => {
                  if (created && typeof created === "object") {
                    const rawRefType =
                      (created as Record<string, unknown>).ref_type ??
                      cfg.optimisticRefType
                    const rawMovementType =
                      (created as Record<string, unknown>).movement_type ??
                      cfg.optimisticMovementType
                    const normalized = {
                      ...created,
                      movement_type:
                        mode === "writeoff" && refTypeKey(String(rawRefType ?? "")) === "MANUAL_WASTE"
                          ? cfg.optimisticMovementType ?? rawMovementType
                          : rawMovementType,
                      ref_type: rawRefType,
                    } as MovementRow
                    setRecentRows((prev) => [normalized, ...prev].slice(0, 20))
                  }
                  loadRows(1)
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl bg-white p-5 border border-blue-700  shadow-sm ring-1 ring-slate-100">
          <div className="text-base font-medium text-slate-900">{copy.filters}</div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <div className="flex h-5 items-end text-xs text-slate-500">{copy.selectWarehouse}</div>
              <Select value={locationFilterValue} onValueChange={(value) => setLocationId(value === "ALL_LOCATIONS" ? "" : value)}>
                <SelectTrigger className={`${filterSelectClass} !w-full cursor-pointer !border-slate-300 bg-white shadow-lg text-black`}>
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
                className={filterInputClass}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                list="writeoff-product-suggestions"
                placeholder={copy.categoryProduct}
              />
              <datalist id="writeoff-product-suggestions">
                {productSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <div className="flex h-5 items-end text-xs text-slate-500">{copy.itemType}</div>
              <Select value={itemType} onValueChange={(value) => setItemType(value as "ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL")}>
                <SelectTrigger className={`${filterSelectClass} !w-full !border-slate-300 bg-white shadow-lg text-black cursor-pointer`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg text-black shadow-lg">
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
                className="!h-11 w-full rounded-xl !bg-none !bg-rose-600 !text-white hover:!bg-rose-700"
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
          onConfirm={() => void deleteSelectedRows()}
        />

        {error ? <div className="text-sm text-rose-600">{error}</div> : null}

        <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#eceff2]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm text-slate-800">
              <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
                <tr className="[&>th]:border-r [&>th]:border-r-slate-300 [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:text-sm [&>th]:font-medium [&>th:last-child]:border-r-0">
                  <th className="w-14 text-center">{copy.select}</th>
                  <th>{renderSortTrigger("date", copy.date)}</th>
                  <th>{renderSortTrigger("itemName", copy.name)}</th>
                  <th>{renderSortTrigger("item_type", copy.type)}</th>
                  <th>{renderSortTrigger("movement_type", copy.state)}</th>
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
                      className={i % 2 === 0 ? "cursor-pointer hover:bg-[#e7edf4]" : "cursor-pointer bg-slate-50 hover:bg-[#e2e8ef]"}
                      onClick={() => {
                        const rowId = Number(r.id)
                        if (!Number.isFinite(rowId) || rowId <= 0) return
                        navigate(`/dashboard/sklad/warehouse/${mode === "writeoff" ? "write-offs" : "transfers"}/${rowId}`)
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
                      <td className="px-4 py-3 font-medium text-slate-900">{r.itemName || "-"}</td>
                      <td className="px-4 py-3">{itemTypeLabel(r.item_type)}</td>
                      <td className="px-4 py-3">{movementTypeLabel(r.movement_type, language)}</td>
                      <td className="px-4 py-3">{localizedLocationName(String(r.location_name || locationMap.get(String(r.location || "")) || r.location || "-"), language)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtNum(r.qty)}</td>
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
              onPageChange={(nextPage) => void loadRows(nextPage)}
              size="sm"
            />
          </div>
        </div>

        <WarehouseDocumentViewDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          title={`${copy.doc} ${detailDocId}`}
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
            { label: detailDialogCopy.documentNo, value: `${detailDocLabel} ${detailDocId}` },
            { label: copy.date, value: fmtDate(detailDate) },
            { label: copy.location, value: detailLocation },
            { label: copy.movementType, value: detailMovement },
            { label: detailDialogCopy.currency, value: detailCurrency },
            { label: copy.qty, value: fmtNum(detailDocumentQty) },
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
                            const unitCost = documentRowUnitCost(row)
                            const lineTotal = documentRowTotal(row)
                            return (
                              <tr key={`${row.id ?? index}-${index}`} className="border-t border-slate-200">
                                <td className="px-4 py-3">{index + 1}</td>
                                <td className="px-4 py-3 font-medium text-slate-900">{documentRowName(row)}</td>
                                <td className="px-4 py-3 text-right">{fmtNum(documentRowQty(row))}</td>
                                <td className="px-4 py-3">{documentRowUnit(row)}</td>
                                <td className="px-4 py-3 text-right">{unitCost > 0 ? fmtNum(unitCost.toFixed(2)) : "-"}</td>
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
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.search}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{detailItemName}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{detailDialogCopy.source}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{cfg.refType ?? cfg.movementType ?? "-"}</div>
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

  return (
    <div className="space-y-4">
      <div className="motion-enter-side-slow flex items-center justify-between">
        <div className="text-xl font-semibold">{pageTitle}</div>
        <div className="flex items-center gap-2">
          <StockActionCreateDialog
            action={cfg.action}
            submitAction={cfg.action}
            forceMovementType={undefined}
            title={createActionLabel}
            triggerLabel={createActionLabel}
            onSuccess={(created) => {
              if (created && typeof created === "object") {
                const normalized = {
                  ...created,
                  movement_type:
                    (created as Record<string, unknown>).movement_type ??
                    cfg.optimisticMovementType,
                  ref_type:
                    (created as Record<string, unknown>).ref_type ??
                    cfg.optimisticRefType,
                } as MovementRow
                setRecentRows((prev) => [normalized, ...prev].slice(0, 20))
              }
              loadRows(1)
            }}
          />
          <Button variant="outline" className="border border-blue-800 bg-gradient-to-r from-blue-900 to-blue-700 text-white hover:from-blue-950 hover:to-blue-800" onClick={() => loadRows(page)} disabled={loading}>
            {loading ? copy.loading : copy.refresh}
          </Button>
        </div>
      </div>

      <ScrollReveal delay={90}>
        <div className="grid gap-2 md:grid-cols-4">
          <Input className="border border-blue-800 bg-gradient-to-r from-blue-900 to-blue-700 text-white placeholder:text-white/70" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.searchPlaceholder} />
        </div>
      </ScrollReveal>

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <ScrollReveal delay={140}>
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>item_type</TableHead>
                  <TableHead>item</TableHead>
                  {mode === "transfer" ? (
                    <>
                      <TableHead>from_location</TableHead>
                      <TableHead>to_location</TableHead>
                    </>
                  ) : (
                    <TableHead>location</TableHead>
                  )}
                  <TableHead className="text-right">qty</TableHead>
                  <TableHead className="text-right">unit_cost</TableHead>
                  <TableHead>ref</TableHead>
                  <TableHead>note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r, i) => (
                  <TableRow key={r.id ?? i}>
                    <TableCell>{r.item_type ?? "RAW_MATERIAL"}</TableCell>
                    <TableCell>{r.itemName || "-"}</TableCell>
                    {mode === "transfer" ? (
                      <>
                        <TableCell>{getLocationName(r.from_location ?? r.location, r.from_location_name || r.location_name)}</TableCell>
                        <TableCell>{getLocationName(r.to_location, r.to_location_name)}</TableCell>
                      </>
                    ) : (
                      <TableCell>{getLocationName(r.location, r.location_name)}</TableCell>
                    )}
                    <TableCell className="text-right">{fmtNum(r.qty)}</TableCell>
                    <TableCell className="text-right">{fmtNum(r.unit_cost)}</TableCell>
                    <TableCell>{r.ref_type ? `${r.ref_type}${r.ref_id ? ` #${r.ref_id}` : ""}` : "-"}</TableCell>
                    <TableCell>{r.note ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {!loading && filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={mode === "transfer" ? 8 : 7} className="text-center text-sm text-muted-foreground">
                      {copy.noData}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end">
            <TablePagination page={page} totalPages={totalPages} disabled={loading} onPageChange={(nextPage) => void loadRows(nextPage)} size="sm" />
          </div>
        </div>
      </ScrollReveal>
    </div>
  )
}
