import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import TablePagination from "@/components/common/TablePagination"
import { warehouseApi } from "../warehouse/api/warehouseApi"
import { warehouseEvents } from "../warehouse/api/events"
import type { LookupItem, StockOnHandItem } from "../warehouse/api/types"
import StockActionCreateDialog from "../warehouse/components/StockActionCreateDialog"
import { useI18n } from "@/i18n"
import { Trash2 } from "lucide-react"

function fmtNum(v: number | string | undefined) {
  return new Intl.NumberFormat("ru-RU").format(Number(v || 0))
}

function buildRowKey(row: StockOnHandItem, idx: number) {
  return [
    row.id ?? "no-id",
    row.item_type ?? "no-type",
    row.product ?? "no-product",
    row.raw_material ?? "no-material",
    row.location ?? row.location_name ?? "no-location",
    idx,
  ].join("_")
}

function localizedLocationName(value?: string, language?: string) {
  const raw = String(value || "").trim()
  if (!raw) return "-"

  if (language === "ru") return raw.replace(/^Warehouse\b/i, "Склад")
  if (language === "uz") return raw.replace(/^Warehouse\b/i, "Ombor")
  return raw
}

type StockOnHandPageProps = {
  initialItemType?: "ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL"
}

const LOCATION_SELECT_ALL = "__all_locations__"

export default function StockOnHandPage({ initialItemType = "ALL" }: StockOnHandPageProps) {
  const { language } = useI18n()
  const [rows, setRows] = useState<StockOnHandItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [locations, setLocations] = useState<Array<LookupItem & { warehouse_id?: number }>>([])
  const [lookupLoading, setLookupLoading] = useState(false)

  const [locationId, setLocationId] = useState("")
  const [itemType, setItemType] = useState<"ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL">(initialItemType)
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 30
  const [count, setCount] = useState(0)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const copy =
    language === "ru"
      ? {
          loadError: "Ошибка загрузки остатков",
          title: "Складские остатки",
          loading: "Загрузка...",
          refresh: "Обновить",
          selectLocation: "Выберите локацию склада",
          search: "Поиск по названию товара / сырья",
          allTypes: "Все типы",
          rawMaterial: "Сырье",
          finishedProduct: "Готовая продукция",
          apply: "Применить фильтр",
          itemName: "Название товара",
          warehouse: "Склад",
          balance: "Остаток",
          avgCost: "Средняя цена за единицу",
          currency: "Валюта",
          empty: "Данные не найдены",
        }
      : language === "en"
        ? {
            loadError: "Failed to load stock balance",
            title: "Stock on hand",
            loading: "Loading...",
            refresh: "Refresh",
            selectLocation: "Select warehouse location",
            search: "Search by product / material name",
            allTypes: "All types",
            rawMaterial: "Raw material",
            finishedProduct: "Finished product",
            apply: "Apply filter",
            itemName: "Item name",
            warehouse: "Warehouse",
            balance: "Balance",
            avgCost: "Average unit cost",
            currency: "Currency",
            empty: "No data found",
            delete: "Delete",
            deleteUnavailable: "Delete unavailable",
          }
        : {
            loadError: "Qoldiqni yuklashda xato",
            title: "Ombor qoldig'i",
            loading: "Yuklanmoqda...",
            refresh: "Yangilash",
            selectLocation: "Ombor joylashuvini tanlang",
            search: "Tovar / material nomi bo'yicha qidirish",
            allTypes: "Barcha turlar",
            rawMaterial: "Xomashyo",
            finishedProduct: "Tayyor mahsulot",
            apply: "Filtr qo'llash",
            itemName: "Tovar nomi",
            warehouse: "Ombor",
            balance: "Qoldiq",
            avgCost: "O'rtacha birlik narxi",
            currency: "Valyuta",
            empty: "Ma'lumot topilmadi",
            delete: "O'chirish",
            deleteUnavailable: "O'chirish mavjud emas",
          }

  const loadLocations = useCallback(async () => {
    try {
      setLookupLoading(true)
      const list = await warehouseApi.listWarehouseLocationOptions()
      setLocations(list)
      setLocationId((prev) => (prev && list.some((x) => String(x.id) === prev) ? prev : String(list[0]?.id ?? "")))
    } finally {
      setLookupLoading(false)
    }
  }, [])

  const loadRows = useCallback(
    async (targetPage = page) => {
      try {
        setLoading(true)
        setError("")
        const params: Record<string, string | number> = { page: targetPage, page_size: pageSize }
        if (locationId) params.location = Number(locationId)
        if (itemType !== "ALL") params.item_type = itemType
        if (appliedQuery) params.q = appliedQuery
        const data = await warehouseApi.fetchStock(params)
        setRows(data.results)
        setSelectedRowKeys((prev) =>
          prev.filter((key) => data.results.some((row: StockOnHandItem, idx: number) => buildRowKey(row, idx) === key))
        )
        setCount(Number(data?.count ?? data.results.length))
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
    [page, pageSize, locationId, itemType, appliedQuery, copy.loadError]
  )

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  useEffect(() => {
    setItemType(initialItemType)
    setAppliedQuery("")
    setPage(1)
  }, [initialItemType])

  useEffect(() => {
    void loadRows(1)
  }, [loadRows, locationId, itemType, appliedQuery])

  useEffect(() => {
    const unsub = warehouseEvents.subscribe(() => {
      void loadRows(page)
    })
    return () => unsub()
  }, [loadRows, page])

  const filteredRows = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [
        String(r.product_name ?? ""),
        String(r.raw_material_name ?? ""),
        String(r.item_name ?? ""),
        String(r.location_name ?? ""),
        String(r.product ?? ""),
        String(r.raw_material ?? ""),
      ].some((value) => value.toLowerCase().includes(q))
    )
  }, [rows, appliedQuery])

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize))
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1
  const to = count === 0 ? 0 : Math.min(count, page * pageSize)
  const visibleRows = useMemo(() => filteredRows.map((row, idx) => ({ ...row, rowKey: buildRowKey(row, idx) })), [filteredRows])
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedRowKeys.includes(row.rowKey))
  const selectedLocationLabel =
    localizedLocationName(locations.find((location) => String(location.id) === locationId)?.name, language) ?? copy.selectLocation
  const addProductLabel = language === "en" ? "Add product" : "Mahsulot qo'shish"
  const deleteLabel = "delete" in copy ? copy.delete : "O'chirish"
  const deleteUnavailableLabel = "deleteUnavailable" in copy ? copy.deleteUnavailable : "O'chirish mavjud emas"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">{copy.title}</div>
        <div className="flex items-center gap-2">
          <StockActionCreateDialog
            action="receipt"
            title={addProductLabel}
            triggerLabel={addProductLabel}
            initialCatalogGroup="PRODUCTS"
            onSuccess={() => {
              setPage(1)
              return loadRows(1)
            }}
          />
          <Button variant="outline" disabled title={deleteUnavailableLabel}>
            <Trash2 className="mr-2 h-4 w-4" />
            {deleteLabel}
          </Button>
          <Button variant="outline" onClick={() => void loadRows(page)} disabled={loading}>
            {loading ? copy.loading : copy.refresh}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-blue-700 px-3 py-7 md:grid-cols-4">
        <Select
          value={locationId || LOCATION_SELECT_ALL}
          onValueChange={(value) => setLocationId(value === LOCATION_SELECT_ALL ? "" : value)}
          disabled={lookupLoading}
        >
          <SelectTrigger className="h-11 cursor-pointer rounded-[18px]">
            <SelectValue placeholder={selectedLocationLabel}>{selectedLocationLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
              <SelectItem value={LOCATION_SELECT_ALL}>{copy.selectLocation}</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {localizedLocationName(l.name, language)}
                </SelectItem>
              ))}
            </SelectContent>
        </Select>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          className="border border-slate-300 bg-white"
        />

        <Select value={itemType} onValueChange={(value) => setItemType(value as "ALL" | "FINISHED_PRODUCT" | "RAW_MATERIAL")}>
          <SelectTrigger className="h-11 cursor-pointer rounded-[18px]">
            <SelectValue>
              {itemType === "RAW_MATERIAL" ? copy.rawMaterial : itemType === "FINISHED_PRODUCT" ? copy.finishedProduct : copy.allTypes}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="ALL">{copy.allTypes}</SelectItem>
            <SelectItem value="RAW_MATERIAL">{copy.rawMaterial}</SelectItem>
            <SelectItem value="FINISHED_PRODUCT">{copy.finishedProduct}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={() => {
            setAppliedQuery(query.trim())
            setPage(1)
          }}
          disabled={loading}
          className="border border-slate-300 bg-white text-black"
        >
          {copy.apply}
        </Button>
      </div>

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#eceff2]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm text-slate-800">
            <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
              <tr className="[&>th]:border-r [&>th]:border-r-slate-300 [&>th]:px-4 [&>th]:py-3 [&>th]:text-left [&>th]:text-sm [&>th]:font-medium [&>th:last-child]:border-r-0">
                <th className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRowKeys((prev) => Array.from(new Set([...prev, ...visibleRows.map((row) => row.rowKey)])))
                      } else {
                        setSelectedRowKeys((prev) => prev.filter((key) => !visibleRows.some((row) => row.rowKey === key)))
                      }
                    }}
                  />
                </th>
                <th>{copy.itemName}</th>
                <th>{copy.warehouse}</th>
                <th className="text-right">{copy.balance}</th>
                <th className="text-right">{copy.avgCost}</th>
                <th>{copy.currency}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {copy.loading}
                  </td>
                </tr>
              ) : null}

              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {copy.empty}
                  </td>
                </tr>
              ) : null}

              {!loading
                ? visibleRows.map((r, i) => (
                    <tr
                      key={r.rowKey}
                      className={i % 2 === 0 ? "hover:bg-[#e7edf4]" : "bg-slate-50 hover:bg-[#e2e8ef]"}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRowKeys.includes(r.rowKey)}
                          onChange={(e) => {
                            setSelectedRowKeys((prev) => (e.target.checked ? Array.from(new Set([...prev, r.rowKey])) : prev.filter((key) => key !== r.rowKey)))
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.item_name || r.product_name || r.raw_material_name || "-"}</td>
                      <td className="px-4 py-3">{localizedLocationName(r.location_name ?? "-", language)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtNum(r.balance_qty ?? r.qty_onhand)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(r.avg_unit_cost)}</td>
                      <td className="px-4 py-3">{r.currency ?? "UZS"}</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-300 bg-white px-4 py-2.5">
          <div className="text-sm text-slate-700">
            {from}-{to} {language === "ru" ? "из" : language === "en" ? "of" : "dan"} {count}
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
  )
}
