import { useEffect, useMemo, useState } from "react"
import { warehouseApi } from "../api/warehouseApi"
import { warehouseEvents } from "../api/events"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "react-toastify"
import { Download, ChevronDown,Eye } from "lucide-react"
import type { LookupItem, WarehouseAction } from "../api/types"
import WarehouseCatalogPicker from "../components/WarehouseCatalogPicker"
import { downloadLedgerExportFile } from "../utils/exportFile"
import TablePagination from "@/components/common/TablePagination"
import ScrollReveal from "@/components/common/ScrollReveal"
import { useI18n } from "@/i18n"

const ACTIONS: WarehouseAction[] = ["receipt", "issue", "return", "transfer", "waste", "adjust"]

function actionLabel(value: WarehouseAction, language: "uz" | "ru" | "en") {
  const labels: Record<WarehouseAction, { uz: string; ru: string; en: string }> = {
    receipt: { uz: "Kirim", ru: "Приход", en: "Receipt" },
    issue: { uz: "Chiqim", ru: "Расход", en: "Issue" },
    return: { uz: "Qaytarish", ru: "Возврат", en: "Return" },
    transfer: { uz: "Ko'chirish", ru: "Перемещение", en: "Transfer" },
    waste: { uz: "Hisobdan chiqarish", ru: "Списание", en: "Write-off" },
    adjust: { uz: "Tuzatish", ru: "Корректировка", en: "Adjustment" },
    "waste-adjust": { uz: "Hisobdan chiqarish tuzatishi", ru: "Корректировка списания", en: "Write-off adjustment" },
  }
  return labels[value]?.[language] ?? value
}

function itemKindLabel(value: "FINISHED_PRODUCT" | "RAW_MATERIAL", language: "uz" | "ru" | "en") {
  if (value === "FINISHED_PRODUCT") return language === "ru" ? "Готовая продукция" : language === "en" ? "Finished product" : "Tayyor mahsulot"
  return language === "ru" ? "Сырье" : language === "en" ? "Raw material" : "Xomashyo"
}

function movementTypeLabel(value: string, language: "uz" | "ru" | "en") {
  const key = String(value || "").toUpperCase().trim()
  const labels: Record<string, { uz: string; ru: string; en: string }> = {
    IN: { uz: "Kirim", ru: "Приход", en: "Receipt" },
    OUT: { uz: "Chiqim", ru: "Расход", en: "Issue" },
    RETURN: { uz: "Qaytarish", ru: "Возврат", en: "Return" },
    WASTE: { uz: "Hisobdan chiqarish", ru: "Списание", en: "Write-off" },
    ADJUST: { uz: "Tuzatish", ru: "Корректировка", en: "Adjustment" },
    TRANSFER: { uz: "Ko'chirish", ru: "Перемещение", en: "Transfer" },
  }
  return labels[key]?.[language] ?? (key || "-")
}

function fmtNum(v: number) {
  return new Intl.NumberFormat("ru-RU").format(Number(v || 0))
}

function fmtDate(v: string) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v || "-"
  return d.toLocaleString("ru-RU")
}

function resolveLocationLabel(row: any) {
  const primary = String(row?.location_name ?? row?.location ?? "").trim()
  const from = String(row?.from_location_name ?? "").trim()
  const to = String(row?.to_location_name ?? "").trim()
  const movementType = String(row?.movement_type ?? row?.type ?? "").toUpperCase()

  if (movementType === "TRANSFER" || (from && to)) {
    return [from || primary, to].filter(Boolean).join(" -> ") || primary || "-"
  }

  return primary || from || to || "-"
}

export default function WarehouseMovementsPage() {
  const { language } = useI18n()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [count, setCount] = useState(0)

  const [locations, setLocations] = useState<Array<LookupItem & { warehouse_id?: number }>>([])
  const [products, setProducts] = useState<LookupItem[]>([])
  const [materials, setMaterials] = useState<LookupItem[]>([])

  const [action, setAction] = useState<WarehouseAction>("receipt")
  const [warehouseLocationId, setWarehouseLocationId] = useState("")
  const [toWarehouseLocationId, setToWarehouseLocationId] = useState("")
  const [itemKind, setItemKind] = useState<"FINISHED_PRODUCT" | "RAW_MATERIAL">("FINISHED_PRODUCT")
  const [productId, setProductId] = useState("")
  const [rawMaterialId, setRawMaterialId] = useState("")
  const [qty, setQty] = useState("1")
  const [unitCost, setUnitCost] = useState("0")
  const [note, setNote] = useState("")
  const [search, setSearch] = useState("")
  const [filterLocationId, setFilterLocationId] = useState("")
  const [filterItemType, setFilterItemType] = useState<"ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL">("ALL")
  const [filterMovementType, setFilterMovementType] = useState("ALL")
  const [filterRefType, setFilterRefType] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailExporting, setDetailExporting] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null)
  const copy =
    language === "ru"
      ? {
          selectWarehouse: "Выберите локацию склада",
          selectReceiver: "Выберите принимающую локацию",
          selectProduct: "Выберите товар",
          selectMaterial: "Выберите сырье",
          qtyPositive: "Количество должно быть положительным",
          unitCostPositive: "Себестоимость не должна быть отрицательной",
          actionSuccess: "Складское действие выполнено успешно",
          actionError: "Ошибка действия",
          exportDone: "Экспорт загружен",
          exportError: "Ошибка экспорта",
          title: "Складские движения",
          export: "Экспорт Excel",
          exporting: "Экспорт...",
          loading: "Загрузка...",
          refresh: "Обновить",
          newMovement: "Новое складское движение",
          newMovementSub: "Выберите действие и заполните форму. Этот блок отправляет POST.",
          note: "Примечание",
          notePlaceholder: "примечание (необязательно)",
          submit: "Создать / Отправить",
          submitting: "Отправка...",
          payloadPreview: "Предпросмотр данных",
          ledgerFilters: "Фильтры движений",
          allLocations: "Все локации",
          allItemTypes: "Все типы товаров",
          allMovementTypes: "Все типы движений",
          refPlaceholder: "тип ссылки, например MANUAL_TRANSFER",
          searchPlaceholder: "Поиск по товару / примечанию / ссылке",
          apply: "Применить фильтр",
          date: "Дата",
          type: "Тип",
          location: "Локация",
          item: "Товар",
          qty: "Количество",
          unitCost: "Себестоимость",
          total: "Итого",
          ref: "Ссылка",
          noData: "Данных нет",
          previous: "Назад",
          next: "Вперед",
        }
      : language === "en"
        ? {
            selectWarehouse: "Select warehouse location",
            selectReceiver: "Select destination warehouse location",
            selectProduct: "Select product",
            selectMaterial: "Select raw material",
            qtyPositive: "Qty must be positive",
            unitCostPositive: "Unit cost must not be negative",
            actionSuccess: "Warehouse action completed successfully",
            actionError: "Action error",
            exportDone: "Export downloaded",
            exportError: "Export error",
            title: "Warehouse movements",
            export: "Export Excel",
            exporting: "Exporting...",
            loading: "Loading...",
            refresh: "Refresh",
            newMovement: "New warehouse movement",
            newMovementSub: "Choose an action and fill the form. This block sends POST requests.",
            note: "Note",
            notePlaceholder: "note (optional)",
            submit: "Create / Submit",
            submitting: "Submitting...",
            payloadPreview: "Payload preview",
            ledgerFilters: "Movement filters",
            allLocations: "All locations",
            allItemTypes: "All item_type",
            allMovementTypes: "All movement_type",
            refPlaceholder: "ref_type, e.g. MANUAL_TRANSFER",
            searchPlaceholder: "Search by item / note / ref",
            apply: "Apply filter",
            date: "Date",
            type: "Type",
            location: "Location",
            item: "Item",
            qty: "Qty",
            unitCost: "Unit cost",
            total: "Total",
            ref: "Ref",
            noData: "No data",
            previous: "Previous",
            next: "Next",
          }
        : {
            selectWarehouse: "Ombor joylashuvini tanlang",
            selectReceiver: "Qabul qiluvchi ombor joylashuvini tanlang",
            selectProduct: "Mahsulotni tanlang",
            selectMaterial: "Xomashyoni tanlang",
            qtyPositive: "Miqdor musbat son bo'lishi kerak",
            unitCostPositive: "Tannarx manfiy bo'lmasligi kerak",
            actionSuccess: "Ombor harakati muvaffaqiyatli bajarildi",
            actionError: "Amalda xatolik yuz berdi",
            exportDone: "Harakatlar eksport fayli yuklab olindi",
            exportError: "Eksportda xatolik",
            title: "Ombor harakatlari",
            export: "Excel eksport",
            exporting: "Eksport...",
            loading: "Yuklanmoqda...",
            refresh: "Yangilash",
            newMovement: "Yangi ombor harakati",
            newMovementSub: "Harakat turini tanlang va formani to'ldiring. Bu bo'lim yangi yozuv yuborish uchun ishlaydi.",
            note: "Izoh",
            notePlaceholder: "Izoh",
            submit: "Yaratish / Yuborish",
            submitting: "Yuborilmoqda...",
            ledgerFilters: "Harakatlar filtrlari",
            allLocations: "Barcha joylashuvlar",
            allItemTypes: "Barcha mahsulot turlari",
            allMovementTypes: "Barcha harakat turlari",
            refPlaceholder: "Bog'lanish turi, masalan MANUAL_TRANSFER",
            searchPlaceholder: "Mahsulot / izoh / bog'lanish bo'yicha qidirish",
            apply: "Filtrni qo'llash",
            date: "Sana",
            type: "Turi",
            location: "Joylashuv",
            item: "Mahsulot",
            qty: "Miqdor",
            unitCost: "Tannarx",
            total: "Jami",
            ref: "Bog'lanish",
            noData: "Ma'lumot yo'q",
            previous: "Oldingi",
            next: "Keyingi",
          }

  const actionsLabel = language === "ru" ? "Действия" : language === "en" ? "Actions" : "Harakatlar"
  const viewLabel = language === "ru" ? "Открыть" : language === "en" ? "Open" : "Ochish"
  const detailTitle = language === "ru" ? "Детали ledger" : language === "en" ? "Ledger details" : "Ledger tafsilotlari"
  const detailLoadError = language === "ru" ? "Не удалось загрузить detail" : language === "en" ? "Failed to load details" : "Detail yuklab bo'lmadi"
  const detailExportLabel = language === "ru" ? "Excel по документу" : language === "en" ? "Excel for entry" : "Yozuv bo'yicha Excel"
  const documentLabel = language === "ru" ? "Документ" : language === "en" ? "Document" : "Hujjat"
  const itemTypeLabel = language === "ru" ? "Item type" : language === "en" ? "Item type" : "Item type"
  const noteLabel = language === "ru" ? "Примечание" : language === "en" ? "Note" : "Izoh"
  const closeLabel = language === "ru" ? "Закрыть" : language === "en" ? "Close" : "Yopish"

  // Ledger ro'yxatini backenddan sahifalab olib tablega chiqaradi.
  const load = async (targetPage = page) => {
    try {
      setLoading(true)
      const params: Record<string, string | number> = { page: targetPage, page_size: pageSize }
      if (filterLocationId) params.location = Number(filterLocationId)
      if (filterItemType !== "ALL") params.item_type = filterItemType
      if (filterMovementType !== "ALL") params.movement_type = filterMovementType
      if (filterRefType.trim()) params.ref_type = filterRefType.trim()
      if (filterDateFrom) params.date_from = filterDateFrom
      if (filterDateTo) params.date_to = filterDateTo

      const res = await warehouseApi.listMovementsPage(params)
      setRows(res.results)
      setCount(res.count)
      setPage(targetPage)
    } finally {
      setLoading(false)
    }
  }

  // Dropdown/select ma'lumotlarini warehouse, product va material APIlaridan oladi.
  const loadLookups = async () => {
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
      if (!toWarehouseLocationId && !l[1]?.id && l[0]?.id) setToWarehouseLocationId(String(l[0].id))
      if (!productId && p[0]?.id) setProductId(String(p[0].id))
      if (!rawMaterialId && m[0]?.id) setRawMaterialId(String(m[0].id))
    } finally {
      setLookupLoading(false)
    }
  }

  useEffect(() => {
    loadLookups()
  }, [])

  useEffect(() => {
    load(1)
  }, [filterLocationId, filterItemType, filterMovementType, filterRefType, filterDateFrom, filterDateTo])

  // Warehouse action bajarilgandan keyin barcha warehouse sahifalari o'zini yangilashi uchun event tinglaydi.
  useEffect(() => {
    const unsub = warehouseEvents.subscribe(() => {
      load(page)
    })
    return () => unsub()
  }, [page, filterLocationId, filterItemType, filterMovementType, filterRefType, filterDateFrom, filterDateTo])

  // Form holatidan backend endpointiga yuboriladigan payloadni yig'adi.
  const makePayload = () => {
    const selectedId = itemKind === "FINISHED_PRODUCT" ? Number(productId || 0) : Number(rawMaterialId || 0)
    const qtyNumber = Number(qty || 0)
    const qtyValue = Number.isFinite(qtyNumber) ? qtyNumber.toFixed(6) : "0.000000"
    const base: any = {
      item_type: itemKind,
      item_id: selectedId,
      qty: qtyValue,
      note: note.trim() || undefined,
    }
    if (action === "transfer") {
      base.from_location = Number(warehouseLocationId || 0)
      base.to_location = Number(toWarehouseLocationId || 0)
    } else {
      base.location = Number(warehouseLocationId || 0)
    }
    if (action === "receipt") {
      base.unit_cost = Number(unitCost || 0)
    }
    return base
  }

  // Tanlangan action uchun payloadni swagger POST endpointiga yuboradi.
  const submitAction = async () => {
    try {
      const payload = makePayload()
      if (!(payload.location || payload.from_location)) return toast.error(copy.selectWarehouse)
      if (action === "transfer" && !payload.to_location) return toast.error(copy.selectReceiver)
      if (!payload.item_id) return toast.error(itemKind === "FINISHED_PRODUCT" ? copy.selectProduct : copy.selectMaterial)
      if (Number(payload.qty) <= 0) {
        return toast.error(copy.qtyPositive)
      }
      if (action === "receipt" && Number(payload.unit_cost) < 0) {
        return toast.error(copy.unitCostPositive)
      }

      setSubmitting(true)
      await warehouseApi.stockAction(action, payload)
      toast.success(`${copy.actionSuccess}: ${action}`)
      await load(1)
    } catch (e: any) {
      const data = e?.response?.data
      const msg =
        typeof data === "string"
          ? data
          : data?.detail || (data ? JSON.stringify(data) : e?.message || copy.actionError)
      toast.error(String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const exportLedger = async () => {
    try {
      setExporting(true)
      const params: Record<string, string | number> = { page }
      if (filterLocationId) params.location = Number(filterLocationId)
      if (filterItemType !== "ALL") params.item_type = filterItemType
      if (filterMovementType !== "ALL") params.movement_type = filterMovementType
      if (filterRefType.trim()) params.ref_type = filterRefType.trim()
      if (filterDateFrom) params.date_from = filterDateFrom
      if (filterDateTo) params.date_to = filterDateTo
      const res = await warehouseApi.ledgerExport(params)

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
      await downloadLedgerExportFile({
        data: res.data,
        contentType: res.contentType,
        baseName: `warehouse-ledger-${stamp}`,
      })
      toast.success(copy.exportDone)
    } catch (e: any) {
      const data = e?.response?.data
      const msg =
        typeof data === "string"
          ? data
          : e?.response?.data?.detail || e?.message || copy.exportError
      toast.error(String(msg))
    } finally {
      setExporting(false)
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      [
        String(row?.itemName ?? ""),
        String(resolveLocationLabel(row)),
        String(row?.movement_type ?? ""),
        String(row?.ref_type ?? ""),
        String(row?.note ?? ""),
      ].some((value) => value.toLowerCase().includes(q))
    )
  }, [rows, search])

  const openRowDetail = async (row: any) => {
    setSelectedRow(row)
    setDetailData(null)
    setDetailError("")
    setDetailOpen(true)

    const id = Number(row?.id ?? 0)
    if (!Number.isFinite(id) || id <= 0) return

    try {
      setDetailLoading(true)
      const data = await warehouseApi.ledgerDetail(id)
      setDetailData((data && typeof data === "object" ? data : null) as Record<string, unknown> | null)
    } catch (e: any) {
      setDetailError(String(e?.response?.data?.detail || e?.message || detailLoadError))
    } finally {
      setDetailLoading(false)
    }
  }

  const exportRowDetail = async (row?: any) => {
    const targetRow = row ?? selectedRow
    const id = Number(targetRow?.id ?? detailData?.id ?? 0)
    if (!Number.isFinite(id) || id <= 0) {
      toast.error(detailLoadError)
      return
    }

    try {
      setDetailExporting(true)
      const res = await warehouseApi.ledgerDetailExport(id)
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
      await downloadLedgerExportFile({
        data: res.data,
        contentType: res.contentType,
        baseName: `warehouse-ledger-entry-${id}-${stamp}`,
      })
      toast.success(copy.exportDone)
    } catch (e: any) {
      toast.error(String(e?.response?.data?.detail || e?.message || copy.exportError))
    } finally {
      setDetailExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const selectClassName =
    "h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
  const fieldClassName =
    "h-12 rounded-2xl border-slate-200 bg-white text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-100"
  const detailDocumentId = Number(detailData?.id ?? selectedRow?.id ?? 0)
  const detailItemName = String(
    detailData?.product_name ??
      detailData?.raw_material_name ??
      detailData?.item_name ??
      selectedRow?.itemName ??
      "-"
  )
  const detailMovement = String(detailData?.movement_type ?? selectedRow?.movement_type ?? selectedRow?.type ?? "-")
  const detailItemType = String(detailData?.item_type ?? selectedRow?.item_type ?? "-")
  const detailLocation = resolveLocationLabel({ ...selectedRow, ...detailData })
  const detailQty = Number(detailData?.qty ?? selectedRow?.qty ?? 0)
  const detailUnitCost = Number(detailData?.unit_cost ?? selectedRow?.unit_cost ?? 0)
  const detailTotal = Number(detailData?.total_cost ?? selectedRow?.total ?? 0)
  const detailDate = String(detailData?.occurred_at ?? selectedRow?.date ?? "")
  const detailRef =
    detailData?.ref_type || selectedRow?.ref_type
      ? `${String(detailData?.ref_type ?? selectedRow?.ref_type ?? "")}${(detailData?.ref_id ?? selectedRow?.ref_id) ? ` #${detailData?.ref_id ?? selectedRow?.ref_id}` : ""}`
      : "-"
  const detailNote = String(detailData?.note ?? selectedRow?.note ?? "-")
  return (
    <div className="space-y-5">
      <div className="motion-enter-side-slow flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f7faff_45%,#eef4ff_100%)] p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.type}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{copy.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportLedger}
            disabled={exporting}
            className="h-11 rounded-2xl border-emerald-200 bg-white text-emerald-700 shadow-sm hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Download size={16} />
            {exporting ? copy.exporting : copy.export}
          </Button>
          <Button
            variant="outline"
            onClick={() => load(page)}
            disabled={loading}
            className="h-11 rounded-2xl border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {loading ? copy.loading : copy.refresh}
          </Button>
        </div>
      </div>

      <ScrollReveal delay={90}>
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)] sm:p-5">
        <div className="mb-5 flex flex-col gap-1">
          <div className="text-lg font-semibold text-slate-950">{copy.newMovement}</div>
          <div className="text-sm text-slate-500">
            {copy.newMovementSub}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.type}</label>
                <div className="relative">
                  <select
                    className={selectClassName}
                    value={action}
                    onChange={(e) => setAction(e.target.value as WarehouseAction)}
                  >
                    {ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {actionLabel(a, language)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.location}</label>
                <div className="relative">
                  <select
                    className={selectClassName}
                    value={warehouseLocationId}
                    onChange={(e) => setWarehouseLocationId(e.target.value)}
                    disabled={lookupLoading}
                  >
                    <option value="">{copy.selectWarehouse}</option>
                    {locations.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  {action === "transfer" ? copy.ref : copy.qty}
                </label>
                {action === "transfer" ? (
                  <div className="relative">
                    <select
                      className={selectClassName}
                      value={toWarehouseLocationId}
                      onChange={(e) => setToWarehouseLocationId(e.target.value)}
                      disabled={lookupLoading}
                    >
                      <option value="">{copy.selectReceiver}</option>
                      {locations.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                ) : (
                  <Input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder={copy.qty}
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    className={fieldClassName}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.item}</label>
                <div className="relative">
                  <select
                    className={selectClassName}
                    value={itemKind}
                    onChange={(e) => {
                      const nextKind = e.target.value as "FINISHED_PRODUCT" | "RAW_MATERIAL"
                      setItemKind(nextKind)
                      if (nextKind === "FINISHED_PRODUCT") {
                        setRawMaterialId("")
                        return
                      }
                      setProductId("")
                    }}
                  >
                    <option value="FINISHED_PRODUCT">{itemKindLabel("FINISHED_PRODUCT", language)}</option>
                    <option value="RAW_MATERIAL">{itemKindLabel("RAW_MATERIAL", language)}</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.item}</label>
                <div className="rounded-2xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
                  <WarehouseCatalogPicker
                    kind={itemKind === "FINISHED_PRODUCT" ? "PRODUCTS" : "MATERIALS"}
                    products={products}
                    materials={materials}
                    selectedId={itemKind === "FINISHED_PRODUCT" ? productId : rawMaterialId}
                    onSelect={(id) => {
                      if (itemKind === "FINISHED_PRODUCT") {
                        setProductId(id)
                        return
                      }
                      setRawMaterialId(id)
                    }}
                    disabled={lookupLoading}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.note}</label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.notePlaceholder} className={fieldClassName} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.qty}</label>
                <Input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder={copy.qty}
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  className={fieldClassName}
                />
              </div>
            </div>

            {action === "receipt" && (
              <div className="grid gap-1.5 md:max-w-[320px]">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.unitCost}</label>
                <Input value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder={copy.unitCost} type="number" min="0" className={fieldClassName} />
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{copy.type}</div>
                <div className="mt-2 text-base font-semibold text-slate-950">{actionLabel(action, language)}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{copy.location}</div>
                <div className="mt-2 text-base font-semibold text-slate-950">
                  {locations.find((w) => String(w.id) === warehouseLocationId)?.name || "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{copy.item}</div>
                <div className="mt-2 text-base font-semibold text-slate-950">
                  {itemKindLabel(itemKind, language)}
                </div>
              </div>
            </div>

            <Button
              onClick={submitAction}
              disabled={submitting || lookupLoading}
              className="mt-5 h-12 rounded-2xl bg-gradient-to-r from-blue-900 via-blue-700 to-blue-600 text-white shadow-[0_16px_32px_-18px_rgba(37,99,235,0.6)] hover:brightness-110"
            >
              {submitting ? copy.submitting : copy.submit}
            </Button>
          </div>
        </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={140}>
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)] sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-slate-950">{copy.ledgerFilters}</div>
          <Button
            variant="outline"
            onClick={() => load(1)}
            disabled={loading}
            className="h-11 rounded-2xl border-slate-200 bg-white px-5 text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {loading ? copy.loading : copy.apply}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.location}</label>
            <div className="relative">
              <select
                className={selectClassName}
                value={filterLocationId}
                onChange={(e) => setFilterLocationId(e.target.value)}
              >
                <option value="">{copy.allLocations}</option>
                {locations.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.item}</label>
            <div className="relative">
              <select
                className={selectClassName}
                value={filterItemType}
                onChange={(e) => setFilterItemType(e.target.value as "ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL")}
              >
                <option value="ALL">{copy.allItemTypes}</option>
                <option value="FINISHED_PRODUCT">{itemKindLabel("FINISHED_PRODUCT", language)}</option>
                <option value="RAW_MATERIAL">{itemKindLabel("RAW_MATERIAL", language)}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.type}</label>
            <div className="relative">
              <select
                className={selectClassName}
                value={filterMovementType}
                onChange={(e) => setFilterMovementType(e.target.value)}
              >
                <option value="ALL">{copy.allMovementTypes}</option>
                <option value="IN">{movementTypeLabel("IN", language)}</option>
                <option value="OUT">{movementTypeLabel("OUT", language)}</option>
                <option value="RETURN">{movementTypeLabel("RETURN", language)}</option>
                <option value="WASTE">{movementTypeLabel("WASTE", language)}</option>
                <option value="ADJUST">{movementTypeLabel("ADJUST", language)}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.ref}</label>
            <Input value={filterRefType} onChange={(e) => setFilterRefType(e.target.value)} placeholder={copy.refPlaceholder} className={fieldClassName} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.date}</label>
            <Input value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} type="date" className={fieldClassName} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.date}</label>
            <Input value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} type="date" className={fieldClassName} />
          </div>
          <div className="grid gap-1.5 xl:col-span-2">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{copy.item}</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.searchPlaceholder} className={fieldClassName} />
          </div>
        </div>
        </div>
      </ScrollReveal>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-[linear-gradient(90deg,#1e3a8a_0%,#1d4ed8_45%,#2563eb_100%)] hover:bg-[linear-gradient(90deg,#1e3a8a_0%,#1d4ed8_45%,#2563eb_100%)]">
              <TableHead className="h-14 px-5 text-white">{copy.date}</TableHead>
              <TableHead className="px-5 text-white">{copy.type}</TableHead>
              <TableHead className="px-5 text-white">{copy.location}</TableHead>
              <TableHead className="px-5 text-white">{copy.item}</TableHead>
              <TableHead className="px-5 text-right text-white">{copy.qty}</TableHead>
              <TableHead className="px-5 text-right text-white">{copy.unitCost}</TableHead>
              <TableHead className="px-5 text-right text-white">{copy.total}</TableHead>
              <TableHead className="px-5 text-white">{copy.ref}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((r: any, i: number) => (
              <TableRow key={r.id ?? i} className="border-slate-200 hover:bg-slate-50/80">
                <TableCell className="px-5 py-4 text-sm text-slate-700">{fmtDate(r.date)}</TableCell>
                <TableCell className="px-5 py-4">
                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {movementTypeLabel(String(r.movement_type ?? r.type ?? ""), language)}
                  </span>
                </TableCell>
                <TableCell className="px-5 py-4 font-medium text-slate-700">{r.location_name || r.location || "-"}</TableCell>
                <TableCell className="max-w-[460px] px-5 py-4 text-slate-800">{r.itemName}</TableCell>
                <TableCell className="px-5 py-4 text-right font-medium text-slate-900">{fmtNum(r.qty)}</TableCell>
                <TableCell className="px-5 py-4 text-right text-slate-700">{fmtNum(r.unit_cost ?? 0)}</TableCell>
                <TableCell className="px-5 py-4 text-right font-semibold text-slate-900">{fmtNum(r.total)}</TableCell>
                <TableCell className="px-5 py-4 text-slate-700">{r.ref_type ? `${r.ref_type}${r.ref_id ? ` #${r.ref_id}` : ""}` : "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void openRowDetail(r)}>
                      <Eye className="h-4 w-4" />
                      {viewLabel}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void exportRowDetail(r)}>
                      <Download className="h-4 w-4" />
                      Excel
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  {copy.noData}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <TablePagination page={page} totalPages={totalPages} disabled={loading} onPageChange={load} />
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[min(92vw,760px)] max-w-[760px] rounded-[24px] border border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="text-left text-2xl font-semibold text-slate-900">{detailTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {detailLoading ? <div className="text-sm text-slate-500">{copy.loading}</div> : null}
            {!detailLoading && detailError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{detailError}</div>
            ) : null}

            {!detailLoading && !detailError ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{documentLabel}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">#{detailDocumentId || "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{copy.date}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{fmtDate(detailDate)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{copy.item}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{detailItemName}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{itemTypeLabel}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{detailItemType}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{copy.type}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{detailMovement}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{copy.location}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{detailLocation}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{copy.qty}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{fmtNum(detailQty)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{copy.unitCost}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{fmtNum(detailUnitCost)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{copy.total}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{fmtNum(detailTotal)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">{copy.ref}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{detailRef}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                  <div className="text-xs text-slate-500">{noteLabel}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{detailNote}</div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" className="gap-2" onClick={() => void exportRowDetail()} disabled={detailLoading || detailExporting || !!detailError}>
                <Download className="h-4 w-4" />
                {detailExporting ? copy.exporting : detailExportLabel}
              </Button>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                {closeLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
