import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import type { Product } from "../api/ProductsApi"
import { formatNumberWithSpaces } from "@/lib/numberFormat"
import { useI18n } from "@/i18n"

type SortKey = "name" | "barcode" | "category" | "uom" | "price" | "stock" | "currency" | "status"

export default function ProductsTable({
  rows,
  onOpen,
  selectedIds,
  onToggleRow,
  onToggleAll,
  stockByProductId,
}: {
  rows: Product[]
  onOpen: (p: Product) => void
  selectedIds: number[]
  onToggleRow: (id: number, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  stockByProductId: Record<number, number>
}) {
  const { language } = useI18n()
  const [sortBy, setSortBy] = useState<SortKey>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id))
  const barcodeLabel = language === "ru" ? "Штрих-код" : language === "en" ? "Barcode" : "Shtrix kod"
  const copy =
    language === "ru"
      ? {
          selectAll: "Выбрать все",
          name: "Название",
          group: "Группа",
          uom: "Ед. изм.",
          price: "Цена",
          stock: "Остаток",
          currency: "Валюта",
          status: "Статус",
          empty: "Пока товаров нет.",
          open: "Открыть",
          selectOne: "Выбрать {{name}}",
          deleted: "Удален",
          active: "Активный",
        }
      : language === "en"
        ? {
            selectAll: "Select all",
            name: "Name",
            group: "Group",
            uom: "UOM",
            price: "Min / sale",
            stock: "Stock",
            currency: "Currency",
            status: "Status",
            empty: "No products yet.",
            open: "Open",
            selectOne: "Select {{name}}",
            deleted: "Deleted",
            active: "Active",
          }
        : {
            selectAll: "Barchasini tanlash",
            name: "Nomi",
            group: "Guruh",
            uom: "O'lchov Birligi",
            price: "Min / sotuv",
            stock: "Qoldiq",
            currency: "Valyuta",
            status: "Status",
            empty: "Hozircha mahsulot yo'q.",
            open: "Ochish",
            selectOne: "{{name}} tanlash",
            deleted: "Deleted",
            active: "Active",
          }

  const sortedRows = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1
    const getValue = (row: Product) => {
      switch (sortBy) {
        case "name":
          return String(row.name ?? "").toLowerCase()
        case "barcode":
          return String(row.barcode ?? "").toLowerCase()
        case "category":
          return String(row.category_name ?? row.category ?? "").toLowerCase()
        case "uom":
          return String(row.uom_name ?? row.uom ?? "").toLowerCase()
        case "price": {
          const minPrice = Number(row.min_price ?? 0)
          const sellingPrice = Number(row.selling_price ?? row.default_selling_price ?? 0)
          return minPrice + sellingPrice
        }
        case "stock":
          return Number(stockByProductId[row.id] ?? toNum(row.stock_qty) ?? toNum(row.qty_onhand) ?? toNum(row.balance_qty) ?? toNum(row.qty) ?? toNum(row.quantity) ?? 0)
        case "currency":
          return String(row.currency ?? "").toLowerCase()
        case "status":
          return row.deleted_at ? 1 : 0
        default:
          return ""
      }
    }
    return [...rows].sort((a, b) => {
      const left = getValue(a)
      const right = getValue(b)
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor
      return String(left).localeCompare(String(right), language === "ru" ? "ru" : language === "en" ? "en" : "uz") * factor
    })
  }, [language, rows, sortBy, sortDirection, stockByProductId])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(key)
    setSortDirection("asc")
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortBy !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-80" />
    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  const sortTriggerClassName = "flex cursor-pointer select-none items-center gap-2 bg-transparent p-0 text-left text-white outline-none"

  const renderSortTrigger = (key: SortKey, label: string, align: "left" | "right" | "center" = "left") => (
    <span
      role="button"
      tabIndex={0}
      className={`${sortTriggerClassName}${align === "right" ? " ml-auto text-right" : align === "center" ? " justify-center text-center" : ""}`}
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
    <div className="products-table-no-select overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1460px] w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[64px]" />
          <col className="w-[240px]" />
          <col className="w-[180px]" />
          <col className="w-[380px]" />
          <col className="w-[160px]" />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col className="w-[110px]" />
          <col className="w-[120px]" />
        </colgroup>
        <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
          <tr>
            <th className="relative px-4 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">
              <input type="checkbox" checked={allChecked} onChange={(e) => onToggleAll(e.target.checked)} aria-label={copy.selectAll} />
            </th>
            <th className="relative px-6 py-5 font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{renderSortTrigger("name", copy.name)}</th>
            <th className="relative px-6 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{renderSortTrigger("barcode", barcodeLabel, "center")}</th>
            <th className="relative px-6 py-5 font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{renderSortTrigger("category", copy.group)}</th>
            <th className="relative px-6 py-5 font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{renderSortTrigger("uom", copy.uom)}</th>
            <th className="relative px-6 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{renderSortTrigger("price", copy.price, "center")}</th>
            <th className="relative px-6 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{renderSortTrigger("stock", copy.stock, "center")}</th>
            <th className="relative px-6 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{renderSortTrigger("currency", copy.currency, "center")}</th>
            <th className="px-6 py-5 text-center font-bold">{renderSortTrigger("status", copy.status, "center")}</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200 text-slate-900">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                {copy.empty}
              </td>
            </tr>
          ) : (
            sortedRows.map((p) => (
              <tr key={p.id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => onOpen(p)} title={copy.open}>
                <td className="px-4 py-6 text-center align-top">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={(e) => onToggleRow(p.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={copy.selectOne.replace("{{name}}", p.name)}
                  />
                </td>
                <td className="px-6 py-6 align-top font-semibold">
                  <button
                    type="button"
                    data-slot="button"
                    className="block text-left leading-6 text-blue-700 hover:text-blue-800 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(p)
                    }}
                  >
                    {p.name}
                  </button>
                </td>
                <td className="px-6 py-6 text-center align-top whitespace-nowrap font-mono text-xs text-slate-600">
                  {p.barcode || "-"}
                </td>
                <td className="px-6 py-6 align-top break-words whitespace-normal leading-7 text-slate-700">{p.category_name ?? (p.category ?? "-")}</td>
                <td className="px-6 py-6 align-top whitespace-nowrap text-slate-700">{p.uom_name ?? p.uom}</td>
                <td className="px-6 py-6 text-center align-top whitespace-nowrap font-medium">
                  {formatProductPrice(p.min_price)} / {formatProductPrice(p.selling_price ?? p.default_selling_price)}
                </td>
                <td className="px-6 py-6 text-center align-top whitespace-nowrap">{formatQty(stockByProductId[p.id] ?? toNum(p.stock_qty) ?? toNum(p.qty_onhand) ?? toNum(p.balance_qty) ?? toNum(p.qty) ?? toNum(p.quantity))}</td>
                <td className="px-6 py-6 text-center align-top whitespace-nowrap">{p.currency}</td>
                <td className="px-6 py-6 text-center align-top whitespace-nowrap">{p.deleted_at === undefined ? "-" : p.deleted_at ? copy.deleted : copy.active}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function toNum(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatQty(value: number | null | undefined): string {
  if (value == null) return "-"
  return value.toLocaleString("uz-UZ")
}

function formatProductPrice(value: number | null | undefined): string {
  if (value == null) return "-"
  return formatNumberWithSpaces(value)
}
