import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import type { StockOnHandItem } from "../api/types"
import { warehouseApi } from "../api/warehouseApi"
import WarehouseDocumentPage, {
  type WarehouseDocumentPageAction,
  type WarehouseDocumentPageBadge,
  type WarehouseDocumentPageField,
  type WarehouseDocumentPageTab,
} from "../components/WarehouseDocumentPage"
import { downloadLedgerExportFile } from "../utils/exportFile"
import {
  documentRowName,
  documentRowQty,
  documentRowTotal,
  documentRowUnit,
  documentRowUnitCost,
  fetchWarehouseDocumentLines,
  type WarehouseDocumentMode,
  type WarehouseDocumentSourceRow,
} from "../utils/documentDetail"
import { getCurrentLocale, useI18n } from "@/i18n"

type PageMode = "transfer" | "writeoff" | "inventory"
type Language = "uz" | "ru" | "en"

function normalizeLanguage(value?: string): Language {
  if (value === "ru" || value === "en") return value
  return "uz"
}

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

function itemTypeLabel(value: unknown, language: Language) {
  const key = String(value || "").toUpperCase()
  if (key === "RAW_MATERIAL") return language === "ru" ? "Сырье" : language === "en" ? "Raw material" : "Xomashyo"
  if (key === "FINISHED_PRODUCT") return language === "ru" ? "Готовая продукция" : language === "en" ? "Finished product" : "Tayyor mahsulot"
  return key || "-"
}

function movementTypeLabel(value: unknown, language: Language) {
  const key = String(value || "").toUpperCase().trim()
  if (!key) return "-"

  const labels: Record<string, { uz: string; ru: string; en: string }> = {
    WASTE: { uz: "Hisobdan chiqarish", ru: "Списание", en: "Write-off" },
    IN: { uz: "Kirim", ru: "Приход", en: "Receipt" },
    OUT: { uz: "Chiqim", ru: "Расход", en: "Issue" },
    TRANSFER: { uz: "Ko'chirish", ru: "Перемещение", en: "Transfer" },
    ADJUST: { uz: "Inventarizatsiya", ru: "Инвентаризация", en: "Inventory" },
  }

  return labels[key]?.[language] ?? key
}

function localizedLocationName(value: unknown, language: Language) {
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

function formatTransferNumber(value?: string | null, fallbackId?: number | string) {
  const source = String(value ?? "").trim()
  const digits = source.replace(/\D+/g, "")
  const prefix = "\u2116"

  if (digits) return `${prefix}${String(Number(digits))}`
  if (fallbackId !== undefined && fallbackId !== null && String(fallbackId).trim()) return `${prefix}${fallbackId}`
  return `${prefix}-`
}

function toPositiveNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
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

async function fetchAllStockRows(params?: Record<string, string | number>) {
  const pageSize = 500
  let page = 1
  let guard = 0
  const collected: StockOnHandItem[] = []

  while (guard < 100) {
    const response = await warehouseApi.fetchStock({
      page,
      page_size: pageSize,
      ...params,
    })
    const pageRows = (response.results ?? []) as StockOnHandItem[]
    collected.push(...pageRows)

    if (!response.next || pageRows.length < pageSize || collected.length >= Number(response.count ?? 0)) {
      break
    }

    page += 1
    guard += 1
  }

  return collected
}

function buildCommonCopy(language: Language) {
  if (language === "ru") {
    return {
      loading: "Загрузка...",
      refresh: "Обновить",
      exportExcel: "Excel экспорт",
      print: "Печать",
      close: "Закрыть",
      main: "Основная информация",
      positions: "Позиции",
      details: "Сведения",
      documentNo: "Номер документа",
      currency: "Валюта",
      empty: "Позиции не найдены",
      noteFallback: "Примечание не указано",
      source: "Источник",
      date: "Дата",
      location: "Локация",
      qty: "Количество",
      total: "Итого",
      note: "Примечание",
      name: "Название",
      type: "Тип",
      unit: "Ед. изм.",
      price: "Цена",
      sender: "Откуда",
      receiver: "Куда",
      movementType: "Тип движения",
      detailError: "Не удалось загрузить детали",
      invalidId: "Некорректный ID документа",
      exportEmpty: "Для документа нет строк для экспорта",
      exportDone: "Файл загружен",
      exportError: "Не удалось скачать Excel",
      item: "Номенклатура",
      direction: "Маршрут",
      productsLabel: (count: number) => `${count} позиций`,
      positionsLabel: (count: number) => `${count} позиций`,
      statusLabel: "Статус",
    }
  }

  if (language === "en") {
    return {
      loading: "Loading...",
      refresh: "Refresh",
      exportExcel: "Export Excel",
      print: "Print",
      close: "Close",
      main: "Main information",
      positions: "Items",
      details: "Details",
      documentNo: "Document number",
      currency: "Currency",
      empty: "No items found",
      noteFallback: "No note provided",
      source: "Source",
      date: "Date",
      location: "Location",
      qty: "Qty",
      total: "Total",
      note: "Note",
      name: "Name",
      type: "Type",
      unit: "Unit",
      price: "Price",
      sender: "From",
      receiver: "To",
      movementType: "Movement type",
      detailError: "Failed to load details",
      invalidId: "Invalid document ID",
      exportEmpty: "No lines available for export",
      exportDone: "File downloaded",
      exportError: "Failed to export file",
      item: "Item",
      direction: "Direction",
      productsLabel: (count: number) => `${count} items`,
      positionsLabel: (count: number) => `${count} items`,
      statusLabel: "Status",
    }
  }

  return {
    loading: "Yuklanmoqda...",
    refresh: "Yangilash",
    exportExcel: "Excel eksport",
    print: "Chop etish",
    close: "Yopish",
    main: "Asosiy ma'lumotlar",
    positions: "Pozitsiyalar",
    details: "Tafsilotlar",
    documentNo: "Hujjat raqami",
    currency: "Valyuta",
    empty: "Pozitsiyalar topilmadi",
    noteFallback: "Izoh kiritilmagan",
    source: "Manba",
    date: "Sana",
    location: "Joylashuv",
    qty: "Miqdor",
    total: "Jami",
    note: "Izoh",
    name: "Nomi",
    type: "Turi",
    unit: "O'lchov birligi",
    price: "Narx",
    sender: "Qayerdan",
    receiver: "Qayerga",
    movementType: "Harakat turi",
    detailError: "Detal ma'lumot yuklanmadi",
    invalidId: "Hujjat ID noto'g'ri",
    exportEmpty: "Eksport uchun qator topilmadi",
    exportDone: "Fayl yuklandi",
    exportError: "Faylni eksport qilib bo'lmadi",
    item: "Nomenklatura",
    direction: "Yo'nalish",
    productsLabel: (count: number) => `${count} ta mahsulot`,
    positionsLabel: (count: number) => `${count} ta pozitsiya`,
    statusLabel: "Holati",
  }
}

function buildModeConfig(mode: PageMode, language: Language) {
  if (mode === "transfer") {
    return {
      listPath: "/dashboard/sklad/warehouse/internal-orders",
      pageTitle: language === "ru" ? "Перемещение" : language === "en" ? "Transfer" : "Ko'chirish",
      positionsMeta:
        language === "ru" ? "Позиции перемещения" : language === "en" ? "Transfer items" : "Ko'chirish pozitsiyalari",
      sourceLabel: "MANUAL_TRANSFER",
      baseName: "kochirish",
      documentMode: "transfer" as WarehouseDocumentMode,
      filterRefType: "MANUAL_TRANSFER",
      filterMovementType: undefined,
    }
  }

  if (mode === "writeoff") {
    return {
      listPath: "/dashboard/sklad/warehouse/write-offs",
      pageTitle: language === "ru" ? "Списание" : language === "en" ? "Write-off" : "Chiqim",
      positionsMeta:
        language === "ru" ? "Позиции списания" : language === "en" ? "Write-off items" : "Chiqim pozitsiyalari",
      sourceLabel: "MANUAL_WASTE",
      baseName: "chiqim",
      documentMode: "writeoff" as WarehouseDocumentMode,
      filterRefType: "MANUAL_WASTE",
      filterMovementType: "WASTE",
    }
  }

  return {
    listPath: "/dashboard/sklad/warehouse/inventories",
    pageTitle: language === "ru" ? "Инвентаризация" : language === "en" ? "Inventory" : "Inventarizatsiya",
    positionsMeta:
      language === "ru" ? "Позиции инвентаризации" : language === "en" ? "Inventory items" : "Inventarizatsiya pozitsiyalari",
    sourceLabel: "ADJUST",
    baseName: "inventarizatsiya",
    documentMode: "inventory" as WarehouseDocumentMode,
    filterRefType: undefined,
    filterMovementType: "ADJUST",
  }
}

function resolveDocumentNumber(mode: PageMode, row: WarehouseDocumentSourceRow, routeId: number) {
  if (mode === "transfer") {
    const refId = toPositiveNumber(row.ref_id)
    const fallbackId = refId || toPositiveNumber(row.id) || routeId
    const rawValue = refId > 0 ? `TR-${refId}` : refId === 0 && fallbackId > 0 ? `TR-${fallbackId}` : undefined
    return formatTransferNumber(rawValue, fallbackId || routeId)
  }

  const resolvedId =
    toPositiveNumber(row.id) ||
    toPositiveNumber((row as Record<string, unknown>).movement_id) ||
    routeId

  return `№${resolvedId || "-"}`
}

function resolvePrimaryItemName(row: WarehouseDocumentSourceRow, fallback: string) {
  const value = documentRowName(row)
  return value && value !== "-" ? value : fallback
}

function resolveDocumentLocation(row: WarehouseDocumentSourceRow, mode: PageMode, language: Language) {
  if (mode === "transfer") {
    const fromLocation = localizedLocationName(
      row.from_location_name ?? row.location_name ?? row.from_location ?? row.from_location_id ?? row.location_id ?? "-",
      language
    )
    const toLocation = localizedLocationName(row.to_location_name ?? row.to_location ?? row.to_location_id ?? "-", language)
    return `${fromLocation} -> ${toLocation}`
  }

  return localizedLocationName(row.location_name ?? row.location ?? row.location_id ?? "-", language)
}

export default function WarehouseDocumentDetailPage({ mode }: { mode: PageMode }) {
  const { language } = useI18n()
  const localeLanguage = normalizeLanguage(language)
  const copy = useMemo(() => buildCommonCopy(localeLanguage), [localeLanguage])
  const modeConfig = useMemo(() => buildModeConfig(mode, localeLanguage), [mode, localeLanguage])
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams()
  const documentId = Number(id)
  const backPath = useMemo(() => {
    if (mode === "transfer" && location.pathname.includes("/dashboard/sklad/warehouse/transfers/")) {
      return "/dashboard/sklad/warehouse/transfers"
    }
    return modeConfig.listPath
  }, [location.pathname, mode, modeConfig.listPath])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null)
  const [documentRows, setDocumentRows] = useState<WarehouseDocumentSourceRow[]>([])
  const [inventoryStockRows, setInventoryStockRows] = useState<StockOnHandItem[]>([])
  const [exporting, setExporting] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(documentId) || documentId <= 0) {
      setError(copy.invalidId)
      setDetailData(null)
      setDocumentRows([])
      setInventoryStockRows([])
      return
    }

    try {
      setLoading(true)
      setError("")
      setDetailData(null)
      setDocumentRows([])
      if (mode === "inventory") setInventoryStockRows([])

      const detail = await warehouseApi.ledgerDetail(documentId)
      const anchorRow = ((detail && typeof detail === "object" ? detail : { id: documentId }) ?? {
        id: documentId,
      }) as WarehouseDocumentSourceRow
      setDetailData((detail && typeof detail === "object" ? detail : null) as Record<string, unknown> | null)

      let lines: WarehouseDocumentSourceRow[] = [anchorRow]
      try {
        const nextLines = await fetchWarehouseDocumentLines({
          mode: modeConfig.documentMode,
          anchorRow,
          filterRefType: modeConfig.filterRefType,
          filterMovementType: modeConfig.filterMovementType,
        })
        if (nextLines.length > 0) lines = nextLines
      } catch (lineError: unknown) {
        const err = lineError as { response?: { data?: { detail?: unknown } }; message?: unknown }
        setError(String(err?.response?.data?.detail || err?.message || copy.detailError))
      }

      setDocumentRows(lines)

      if (mode === "inventory") {
        try {
          const inventoryLocation = toPositiveNumber(anchorRow.location ?? (anchorRow as Record<string, unknown>).location_id)
          const stockRows = await fetchAllStockRows(inventoryLocation > 0 ? { location: inventoryLocation } : undefined)
          setInventoryStockRows(stockRows)
        } catch {
          setInventoryStockRows([])
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      setError(String(err?.response?.data?.detail || err?.message || copy.detailError))
      setDetailData(null)
      setDocumentRows([])
      setInventoryStockRows([])
    } finally {
      setLoading(false)
    }
  }, [copy.detailError, copy.invalidId, documentId, mode, modeConfig.documentMode, modeConfig.filterMovementType, modeConfig.filterRefType])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const primaryRow = useMemo(
    () => ({ ...(documentRows[0] ?? {}), ...(detailData ?? {}) }) as WarehouseDocumentSourceRow,
    [detailData, documentRows]
  )

  const stockValueMaps = useMemo(() => {
    const byItemLocation = new Map<string, { qty: number; value: number }>()
    const byItem = new Map<string, { qty: number; value: number }>()

    for (const row of inventoryStockRows) {
      const qty = Number(row.balance_qty ?? row.qty_onhand ?? 0)
      if (!Number.isFinite(qty) || qty === 0) continue

      const value = Number(row.value_onhand ?? 0)
      if (!Number.isFinite(value) || value <= 0) continue

      const itemType = String(row.item_type ?? "").toUpperCase()
      const itemId = stockRowItemId(row)
      const locationId = Number(row.location ?? 0)
      const locationKey = inventoryValueKey(itemType, itemId, locationId)
      const itemKey = inventoryValueKey(itemType, itemId)

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
  }, [inventoryStockRows])

  const resolveInventoryRowAmount = useCallback((row: WarehouseDocumentSourceRow) => {
    const directTotal = Number(row.total ?? row.line_total ?? row.total_cost ?? row.amount ?? 0)
    if (Number.isFinite(directTotal) && directTotal > 0) return directTotal

    const qty = Number(row.qty ?? row.quantity ?? 0)
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
      stockValueMaps.byItemLocation.get(
        inventoryValueKey(
          String(row.item_type ?? ""),
          row.item_id,
          (row.location ?? (row as Record<string, unknown>).location_id) as string | number | undefined
        )
      )
    )
    if (locationAverageCost > 0) return qty * locationAverageCost

    const itemAverageCost = readAverageCost(stockValueMaps.byItem.get(inventoryValueKey(String(row.item_type ?? ""), row.item_id)))
    if (itemAverageCost > 0) return qty * itemAverageCost

    return 0
  }, [stockValueMaps])

  const detailRows = documentRows.length > 0 ? documentRows : Object.keys(primaryRow).length > 0 ? [primaryRow] : []
  const detailDate = String(primaryRow.occurred_at ?? primaryRow.date ?? primaryRow.created_at ?? "")
  const detailCurrency = String(primaryRow.currency ?? "UZS")
  const detailNote = String(primaryRow.note ?? copy.noteFallback)
  const detailLocation = resolveDocumentLocation(primaryRow, mode, localeLanguage)
  const detailItemName = resolvePrimaryItemName(primaryRow, "-")
  const detailDocumentNumber = resolveDocumentNumber(mode, primaryRow, documentId)
  const detailMovement =
    mode !== "writeoff"
      ? modeConfig.pageTitle
      : movementTypeLabel(primaryRow.movement_type ?? "WASTE", localeLanguage)

  const lineTotalForMode = useCallback((row: WarehouseDocumentSourceRow) => {
    if (mode === "inventory") return resolveInventoryRowAmount(row)
    return documentRowTotal(row)
  }, [mode, resolveInventoryRowAmount])

  const detailDocumentQty = detailRows.reduce((sum, row) => sum + documentRowQty(row), 0)
  const detailDocumentTotal = detailRows.reduce((sum, row) => sum + lineTotalForMode(row), 0)

  const detailBadges: WarehouseDocumentPageBadge[] = [
    { label: modeConfig.pageTitle, tone: "blue" },
    { label: copy.productsLabel(detailRows.length), tone: "emerald" },
  ]

  const detailSummary =
    mode === "transfer"
      ? [
          `${copy.qty}: ${fmtNum(detailDocumentQty)}`,
          copy.positionsLabel(detailRows.length),
          detailLocation,
        ]
      : [
          `${copy.total}: ${fmtNum(detailDocumentTotal.toFixed(2))} ${detailCurrency}`,
          `${copy.qty}: ${fmtNum(detailDocumentQty)}`,
          `${copy.location}: ${detailLocation}`,
        ]

  const detailFields: WarehouseDocumentPageField[] =
    mode === "transfer"
      ? [
          { label: copy.documentNo, value: detailDocumentNumber },
          { label: copy.date, value: fmtDate(detailDate) },
          {
            label: copy.sender,
            value: localizedLocationName(
              primaryRow.from_location_name ??
                primaryRow.location_name ??
                primaryRow.from_location ??
                primaryRow.from_location_id ??
                primaryRow.location_id ??
                "-",
              localeLanguage
            ),
          },
          {
            label: copy.receiver,
            value: localizedLocationName(primaryRow.to_location_name ?? primaryRow.to_location ?? primaryRow.to_location_id ?? "-", localeLanguage),
          },
          { label: copy.type, value: itemTypeLabel(primaryRow.item_type, localeLanguage) },
          { label: copy.currency, value: detailCurrency },
          {
            label: copy.total,
            value: detailDocumentTotal > 0 ? `${fmtNum(detailDocumentTotal.toFixed(2))} ${detailCurrency}` : "-",
          },
          { label: copy.note, value: detailNote || copy.noteFallback, columnSpan: 2, multiline: true },
        ]
      : mode === "writeoff"
        ? [
            { label: copy.documentNo, value: detailDocumentNumber },
            { label: copy.date, value: fmtDate(detailDate) },
            { label: copy.location, value: detailLocation },
            { label: copy.movementType, value: detailMovement },
            { label: copy.currency, value: detailCurrency },
            { label: copy.qty, value: fmtNum(detailDocumentQty) },
            { label: copy.note, value: detailNote || copy.noteFallback, columnSpan: 2, multiline: true },
          ]
        : [
            { label: copy.documentNo, value: detailDocumentNumber },
            { label: copy.date, value: fmtDate(detailDate) },
            { label: copy.location, value: detailLocation },
            { label: copy.qty, value: fmtNum(detailDocumentQty) },
            { label: copy.currency, value: detailCurrency },
            {
              label: copy.total,
              value: detailDocumentTotal > 0 ? `${fmtNum(detailDocumentTotal.toFixed(2))} ${detailCurrency}` : "-",
            },
            { label: copy.note, value: detailNote || copy.noteFallback, columnSpan: 2, multiline: true },
          ]

  const exportDocumentExcel = useCallback(async () => {
    try {
      setExporting(true)
      if (detailRows.length === 0) {
        toast.error(copy.exportEmpty)
        return
      }

      const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`
      const header = [copy.date, copy.name, copy.type, copy.location, copy.qty, copy.unit, copy.price, copy.total, copy.note]
      const lines = [
        header.map(esc).join(";"),
        ...detailRows.map((row) => {
          const qty = documentRowQty(row)
          const total = lineTotalForMode(row)
          const unitPrice = qty > 0 ? total / qty : documentRowUnitCost(row)

          return [
            fmtDate(String(row.date ?? row.occurred_at ?? row.created_at ?? "")),
            documentRowName(row),
            itemTypeLabel(row.item_type, localeLanguage),
            resolveDocumentLocation(row, mode, localeLanguage),
            fmtNum(qty),
            documentRowUnit(row),
            unitPrice > 0 ? fmtNum(unitPrice.toFixed(2)) : "-",
            total > 0 ? fmtNum(total.toFixed(2)) : "-",
            String(row.note ?? "-"),
          ]
            .map(esc)
            .join(";")
        }),
      ]

      const csvBlob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8;" })
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      await downloadLedgerExportFile({
        data: csvBlob,
        contentType: "text/csv;charset=utf-8;",
        baseName: `${modeConfig.baseName}-${documentId}-${stamp}`,
      })
      toast.success(copy.exportDone)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      toast.error(String(err?.response?.data?.detail || err?.message || copy.exportError))
    } finally {
      setExporting(false)
    }
  }, [copy.exportDone, copy.exportEmpty, copy.exportError, copy.date, copy.location, copy.name, copy.note, copy.price, copy.qty, copy.total, copy.type, copy.unit, detailRows, documentId, lineTotalForMode, localeLanguage, mode, modeConfig.baseName])

  const actions: WarehouseDocumentPageAction[] = [
    {
      label: copy.refresh,
      onClick: () => void loadDetail(),
      disabled: loading,
      variant: "primary",
    },
    {
      label: exporting ? copy.loading : copy.exportExcel,
      onClick: () => void exportDocumentExcel(),
      disabled: exporting || detailRows.length === 0,
      variant: "outline",
    },
    {
      label: copy.print,
      onClick: () => window.print(),
      variant: "secondary",
    },
    {
      label: copy.close,
      onClick: () => navigate(backPath),
      variant: "primary",
    },
  ]

  const tabs: WarehouseDocumentPageTab[] = [
    {
      key: "positions",
      label: copy.positions,
      content: (
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-semibold text-slate-700">{modeConfig.positionsMeta}</div>
            <div className="text-sm text-slate-500">{detailCurrency}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">№</th>
                  <th className="px-4 py-3 text-left font-semibold">{copy.name}</th>
                  <th className="px-4 py-3 text-left font-semibold">{copy.type}</th>
                  <th className="px-4 py-3 text-right font-semibold">{copy.qty}</th>
                  <th className="px-4 py-3 text-left font-semibold">{copy.unit}</th>
                  <th className="px-4 py-3 text-right font-semibold">{copy.price}</th>
                  <th className="px-4 py-3 text-right font-semibold">{copy.total}</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      {copy.empty}
                    </td>
                  </tr>
                ) : (
                  detailRows.map((row, index) => {
                    const qty = documentRowQty(row)
                    const total = lineTotalForMode(row)
                    const unitPrice = qty > 0 ? total / qty : documentRowUnitCost(row)

                    return (
                      <tr key={`${row.id ?? index}-${index}`} className="border-t border-slate-200">
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{documentRowName(row)}</td>
                        <td className="px-4 py-3">{itemTypeLabel(row.item_type, localeLanguage)}</td>
                        <td className="px-4 py-3 text-right">{fmtNum(qty)}</td>
                        <td className="px-4 py-3">{documentRowUnit(row)}</td>
                        <td className="px-4 py-3 text-right">{unitPrice > 0 ? fmtNum(unitPrice.toFixed(2)) : "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold">{total > 0 ? fmtNum(total.toFixed(2)) : "-"}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 px-4 py-3 text-right text-sm">
            <span className="text-slate-500">{copy.total}:</span>{" "}
            <span className="font-bold text-slate-900">
              {fmtNum(detailDocumentTotal.toFixed(2))} {detailCurrency}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "details",
      label: copy.details,
      content: (
        <div className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.item}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{detailItemName}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.source}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{modeConfig.sourceLabel}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.direction}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{detailLocation}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.movementType}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{detailMovement}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.note}</div>
            <div className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-900">
              {detailNote || copy.noteFallback}
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <WarehouseDocumentPage
      title={`${modeConfig.pageTitle} ${detailDocumentNumber}`}
      badges={detailBadges}
      summary={detailSummary}
      actions={actions}
      leftTitle={copy.main}
      fields={detailFields}
      tabs={tabs}
      loading={loading}
      loadingLabel={copy.loading}
      error={error}
    />
  )
}

export function WarehouseTransferDetailPage() {
  return <WarehouseDocumentDetailPage mode="transfer" />
}

export function WarehouseWriteOffDetailPage() {
  return <WarehouseDocumentDetailPage mode="writeoff" />
}

export function WarehouseInventoryDetailPage() {
  return <WarehouseDocumentDetailPage mode="inventory" />
}
