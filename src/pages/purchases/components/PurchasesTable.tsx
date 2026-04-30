import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import TablePagination from "@/components/common/TablePagination"
import type { PaymentStatus, PurchaseListItem, PurchaseStatus } from "../types"
import { useI18n } from "@/i18n"
import { formatPurchaseNumber } from "../utils"
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react"

type SortKey =
  | "purchase_no"
  | "received_date"
  | "supplier_name"
  | "total"
  | "paid_amount"
  | "remaining_amount"
  | "status"
  | "payment_status"

function fmtMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(amount || 0)
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("ru-RU")
}

export default function PurchasesTable({
  rows,
  loading,
  total,
  page,
  pageSize,
  selectedIds,
  onPageChange,
  onToggleSelected,
  onToggleAllCurrentPage,
  onExport,
}: {
  rows: PurchaseListItem[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  selectedIds: number[]
  onPageChange: (p: number) => void
  onToggleSelected: (id: number, checked: boolean) => void
  onToggleAllCurrentPage: (ids: number[], checked: boolean) => void
  onExport?: (row: PurchaseListItem) => void
}) {
  const { language } = useI18n()
  const nav = useNavigate()
  const [sortBy, setSortBy] = useState<SortKey>("received_date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const detailPath = (id: number) => `/dashboard/sklad/warehouse/purchases/${id}`
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const copy =
    language === "ru"
      ? {
        select: "Выбрать",
        number: "Номер",
        date: "Дата",
        supplier: "Контрагент",
        total: "Итого",
        paid: "Оплачено",
        remaining: "Остаток",
        status: "Статус",
        paymentStatus: "Статус оплаты",
        receiptStatus: "Статус приемки",
        loading: "Загрузка...",
        empty: "Ничего не найдено",
        paidLabel: "Оплачено",
        partialLabel: "Частично оплачено",
        unpaidLabel: "Не оплачено",
        confirmed: "Подтверждено",
        cancelled: "Отменено",
        draft: "Черновик",
        accepted: "Принято",
        notAccepted: "Не принято",
        export: "Экспорт",
        actions: "Действия",
        of: "из",
      }
      : language === "en"
        ? {
          select: "Select",
          number: "Number",
          date: "Date",
          supplier: "Counterparty",
          total: "Total",
          paid: "Paid",
          remaining: "Remaining",
          status: "Status",
          paymentStatus: "Payment status",
          receiptStatus: "Receipt status",
          loading: "Loading...",
          empty: "Nothing found",
          paidLabel: "Paid",
          partialLabel: "Partially paid",
          unpaidLabel: "Unpaid",
          confirmed: "Confirmed",
          cancelled: "Cancelled",
          draft: "Draft",
          accepted: "Accepted",
          notAccepted: "Not accepted",
          export: "Export",
          actions: "Actions",
          of: "of",
        }
        : {
          select: "Tanlash",
          number: "Raqam",
          date: "Sana",
          supplier: "Kontragent",
          total: "Jami",
          paid: "To'langan",
          remaining: "Qoldiq",
          status: "Holati",
          paymentStatus: "To'lov statusi",
          receiptStatus: "Qabul statusi",
          loading: "Yuklanmoqda...",
          empty: "Hech narsa topilmadi",
          paidLabel: "To'langan",
          partialLabel: "Qisman to'langan",
          unpaidLabel: "To'lanmagan",
          confirmed: "Tasdiqlangan",
          cancelled: "Bekor qilingan",
          draft: "Qoralama",
          accepted: "Qabul qilingan",
          notAccepted: "Qabul qilinmagan",
          export: "Eksport",
          actions: "Harakatlar",
          of: "dan",
        }

  const paymentStatusLabel = (status: PaymentStatus) =>
    status === "PAID" ? copy.paidLabel : status === "PARTIAL" ? copy.partialLabel : copy.unpaidLabel
  const purchaseStatusLabel = (status: PurchaseStatus) =>
    status === "CONFIRMED" ? copy.confirmed : status === "CANCELLED" ? copy.cancelled : copy.draft
  const receiptStatusLabel = (status: PurchaseStatus) =>
    status === "CONFIRMED" ? copy.accepted : status === "CANCELLED" ? copy.cancelled : copy.notAccepted
  const canDeleteRow = (row: PurchaseListItem) => row.status !== "CONFIRMED" && !row.deleted_at

  const sortedRows = useMemo(() => {
    const factor = sortDirection === "asc" ? 1 : -1
    const getValue = (row: PurchaseListItem) => {
      if (sortBy === "total" || sortBy === "paid_amount" || sortBy === "remaining_amount") return Number(row[sortBy] || 0)
      if (sortBy === "received_date") {
        const timestamp = new Date(row.received_date || "").getTime()
        return Number.isFinite(timestamp) ? timestamp : 0
      }
      return String(row[sortBy] ?? "").toLowerCase()
    }

    return [...rows].sort((a, b) => {
      const left = getValue(a)
      const right = getValue(b)
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor
      return String(left).localeCompare(String(right), language === "ru" ? "ru" : language === "en" ? "en" : "uz") * factor
    })
  }, [language, rows, sortBy, sortDirection])

  const selectableRowIds = useMemo(
    () => sortedRows.filter(canDeleteRow).map((row) => row.id),
    [sortedRows]
  )
  const allCurrentPageSelected = selectableRowIds.length > 0 && selectableRowIds.every((id) => selectedIds.includes(id))
  const someCurrentPageSelected = selectableRowIds.some((id) => selectedIds.includes(id))

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortBy(key)
    setSortDirection(key === "received_date" ? "desc" : "asc")
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortBy !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-80" />
    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  const sortTriggerClassName = "flex cursor-pointer select-none items-center gap-2 bg-transparent p-0 text-left text-white outline-none"

  const renderSortTrigger = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <span
      role="button"
      tabIndex={0}
      className={`${sortTriggerClassName}${align === "right" ? " ml-auto text-right" : ""}`}
      onClick={() => toggleSort(key)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          toggleSort(key)
        }
      }}
    >
      {label}
      {renderSortIcon(key)}
    </span>
  )

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#eceff2]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-sm text-slate-800">
          <thead className="!bg-gradient-to-r from-blue-900 to-blue-700 text-white">
            <tr className="[&>th]:border-r [&>th]:border-r-slate-300 [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-sm [&>th]:font-medium [&>th:last-child]:border-r-0">
              <th className="w-14 text-center">
                <Checkbox
                  checked={allCurrentPageSelected ? true : someCurrentPageSelected ? "indeterminate" : false}
                  disabled={selectableRowIds.length === 0}
                  onCheckedChange={(checked) => onToggleAllCurrentPage(selectableRowIds, Boolean(checked))}
                  aria-label="Select all purchases"
                />
              </th>
              <th>{renderSortTrigger("purchase_no", copy.number)}</th>
              <th>{renderSortTrigger("received_date", copy.date)}</th>
              <th>{renderSortTrigger("supplier_name", copy.supplier)}</th>
              <th className="text-right">{renderSortTrigger("total", copy.total, "right")}</th>
              <th className="text-right">{renderSortTrigger("paid_amount", copy.paid, "right")}</th>
              <th className="text-right">{renderSortTrigger("remaining_amount", copy.remaining, "right")}</th>
              <th>{renderSortTrigger("status", copy.status)}</th>
              <th>{renderSortTrigger("payment_status", copy.paymentStatus)}</th>
              <th>{copy.receiptStatus}</th>
              {onExport ? <th className="text-right">{copy.actions}</th> : null}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300 bg-white">
            {loading ? (
              <tr>
                <td colSpan={onExport ? 11 : 10} className="px-4 py-8 text-center text-slate-500">
                  {copy.loading}
                </td>
              </tr>
            ) : null}

            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={onExport ? 11 : 10} className="px-4 py-10 text-center text-slate-500">
                  {copy.empty}
                </td>
              </tr>
            ) : null}

            {!loading
              ? sortedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={idx % 2 === 0 ? "cursor-pointer hover:bg-[#e7edf4]" : "cursor-pointer bg-slate-50 hover:bg-[#e2e8ef]"}
                  onClick={() => nav(detailPath(row.id))}
                >
                  <td className="px-3 py-2.5 text-center" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      disabled={!canDeleteRow(row)}
                      onCheckedChange={(checked) => onToggleSelected(row.id, Boolean(checked))}
                      aria-label={`Select purchase ${row.id}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">{formatPurchaseNumber(row.purchase_no, row.id)}</td>
                  <td className="px-3 py-2.5">{fmtDate(row.received_date)}</td>
                  <td className="px-3 py-2.5 text-blue-800">{row.supplier_name ?? "-"}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{fmtMoney(row.total)}</td>
                  <td className="px-3 py-2.5 text-right">{fmtMoney(row.paid_amount)}</td>
                  <td className="px-3 py-2.5 text-right">{fmtMoney(row.remaining_amount)}</td>
                  <td className="px-3 py-2.5">{purchaseStatusLabel(row.status)}</td>
                  <td className="px-3 py-2.5">{paymentStatusLabel(row.payment_status)}</td>
                  <td className="px-3 py-2.5">{receiptStatusLabel(row.status)}</td>
                  {onExport ? (
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl !bg-gradient-to-r from-blue-900 to-blue-700 text-white"
                        onClick={(event) => {
                          event.stopPropagation()
                          onExport(row)
                        }}
                      >
                        <Download color="white" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-300 bg-white px-4 py-2.5">
        <div className="text-sm text-slate-700">
          {from}-{to} {copy.of} {total}
        </div>

        <TablePagination page={page} totalPages={pages} onPageChange={onPageChange} size="sm" />
      </div>
    </div>
  )
}
