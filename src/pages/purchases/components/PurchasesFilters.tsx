import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/i18n"
import type { LookupItem } from "@/pages/sklad/warehouse/api/types"
import type { ChoiceValue } from "../types"

export type PurchasesFiltersValue = {
  supplier: string
  date_from: string
  date_to: string
  status: "ALL" | "DRAFT" | "CONFIRMED" | "CANCELLED"
  payment_status: "ALL" | "UNPAID" | "PARTIAL" | "PAID"
  search: string
}

function parseChoice(choice: ChoiceValue): { value: string; label: string } {
  if (typeof choice === "string") return { value: choice, label: choice }
  if (Array.isArray(choice)) {
    return { value: String(choice[0] ?? ""), label: String(choice[1] ?? choice[0] ?? "") }
  }

  return {
    value: String(choice?.value ?? ""),
    label: String(choice?.label ?? choice?.value ?? ""),
  }
}

export default function PurchasesFilters({
  value,
  suppliers,
  statusChoices,
  onChange,
  onReset,
  onDeleteSelected,
  deleteDisabled = true,
  deleteLoading = false,
}: {
  value: PurchasesFiltersValue
  suppliers: LookupItem[]
  statusChoices: ChoiceValue[]
  onChange: (v: PurchasesFiltersValue) => void
  onReset: () => void
  onDeleteSelected?: () => void
  deleteDisabled?: boolean
  deleteLoading?: boolean
  deleteLabel?: string
  selectedCount?: number
}) {
  const { language } = useI18n()
  const statusOptions = statusChoices.map(parseChoice).filter((x) => x.value)
  const inputBorderClass =
    "mt-1 rounded-xl border-slate-300 bg-white shadow-lg focus-visible:!border-blue-700 focus-visible:!ring-blue-200"
  const copy =
    language === "ru"
      ? {
          title: "Фильтр закупок",
          supplier: "Контрагент",
          all: "Все",
          dateFrom: "Дата начала",
          dateTo: "Дата окончания",
          status: "Статус",
          paymentStatus: "Статус оплаты",
          unpaid: "Не оплачено",
          partial: "Частично оплачено",
          paid: "Оплачено",
          search: "Поиск",
          searchPlaceholder: "Номер PRC, контрагент, ИНН или телефон...",
          reset: "Очистить фильтры",
          confirmed: "Подтвержден",
          cancelled: "Отменен",
          draft: "Черновик",
          delete: "Удалить",
          deleting: "Удаление...",
        }
      : language === "en"
        ? {
            title: "Purchase filters",
            supplier: "Counterparty",
            all: "All",
            dateFrom: "Start date",
            dateTo: "End date",
            status: "Status",
            paymentStatus: "Payment status",
            unpaid: "Unpaid",
            partial: "Partially paid",
            paid: "Paid",
            search: "Search",
            searchPlaceholder: "PRC number, counterparty, tax ID or phone...",
            reset: "Clear filters",
            confirmed: "Confirmed",
            cancelled: "Cancelled",
            draft: "Draft",
            delete: "Delete",
            deleting: "Deleting...",
          }
        : {
            title: "Kirimlarni filtrlash",
            supplier: "Kontragent",
            all: "Barchasi",
            dateFrom: "Boshlanish sana",
            dateTo: "Tugash sana",
            status: "Holati",
            paymentStatus: "To'lov holati",
            unpaid: "To'lanmagan",
            partial: "Qisman to'langan",
            paid: "To'langan",
            search: "Qidiruv",
            searchPlaceholder: "PRC raqami, kontragent, STIR yoki telefon...",
            reset: "Filtrlarni tozalash",
            confirmed: "Tasdiqlangan",
            cancelled: "Bekor qilingan",
            draft: "Qoralama",
            delete: "O'chirish",
            deleting: "O'chirilmoqda...",
          }

  return (
    <div className="rounded-2xl border border-blue-700 bg-white p-5 shadow-lg">
      <div className="text-sm font-semibold text-slate-900">{copy.title}</div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="text-xs text-slate-500">{copy.supplier}</label>
          <Select
            value={value.supplier || "ALL"}
            onValueChange={(next) => onChange({ ...value, supplier: next === "ALL" ? "" : next })}
          >
            <SelectTrigger className="mt-1 h-10 w-full rounded-xl !border-slate-300 bg-white text-black shadow-lg">
              <SelectValue placeholder={copy.all} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg">
              <SelectItem value="ALL">{copy.all}</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={String(supplier.id)}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-slate-500">{copy.dateFrom}</label>
          <Input
            className={inputBorderClass}
            type="date"
            value={value.date_from}
            onChange={(e) => onChange({ ...value, date_from: e.target.value })}
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-slate-500">{copy.dateTo}</label>
          <Input
            className={inputBorderClass}
            type="date"
            value={value.date_to}
            onChange={(e) => onChange({ ...value, date_to: e.target.value })}
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-slate-500">{copy.status}</label>
          <Select value={value.status} onValueChange={(next) => onChange({ ...value, status: next as PurchasesFiltersValue["status"] })}>
            <SelectTrigger className="mt-1 h-10 w-full cursor-pointer rounded-xl !border-slate-300 bg-white text-black shadow-lg">
              <SelectValue placeholder={copy.all} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg">
              <SelectItem value="ALL">{copy.all}</SelectItem>
              {(statusOptions.length
                ? statusOptions
                : [
                    { value: "DRAFT", label: copy.draft },
                    { value: "CONFIRMED", label: copy.confirmed },
                    { value: "CANCELLED", label: copy.cancelled },
                  ]).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-3">
          <label className="text-xs text-slate-500">{copy.paymentStatus}</label>
          <Select value={value.payment_status} onValueChange={(next) => onChange({ ...value, payment_status: next as PurchasesFiltersValue["payment_status"] })}>
            <SelectTrigger className="mt-1 h-10 w-full cursor-pointer rounded-xl !border-slate-300 bg-white text-black shadow-lg">
              <SelectValue placeholder={copy.all} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-300 bg-white shadow-lg">
              <SelectItem value="ALL">{copy.all}</SelectItem>
              <SelectItem value="UNPAID">{copy.unpaid}</SelectItem>
              <SelectItem value="PARTIAL">{copy.partial}</SelectItem>
              <SelectItem value="PAID">{copy.paid}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-9">
          <label className="text-xs text-slate-500">{copy.search}</label>
          <Input
            className={inputBorderClass}
            placeholder={copy.searchPlaceholder}
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        {onDeleteSelected ? (
          <Button
            variant="destructive"
            className="rounded-xl bg-red-500"
            onClick={onDeleteSelected}
            disabled={deleteDisabled || deleteLoading}
          >
            {deleteLoading ? copy.deleting : copy.delete}
          </Button>
        ) : null}

        <Button variant="secondary" className="rounded-xl !bg-gradient-to-r from-blue-900 to-blue-700 text-white" onClick={onReset}>
          {copy.reset}
        </Button>
      </div>
    </div>
  )
}
