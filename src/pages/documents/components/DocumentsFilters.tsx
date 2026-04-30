import { useI18n } from "@/i18n"
import type { DocumentsFilters, DocumentStatus, DocumentType, RefType } from "../types/documents.types"
import { docStatusLabel, docTypeLabel, refTypeLabel } from "../utils/documents.utils"

type Props = {
  value: DocumentsFilters
  onChange: (next: DocumentsFilters) => void
  onApply: () => void
  onReset: () => void
}

export default function DocumentsFiltersPanel({ value, onChange, onApply, onReset }: Props) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          title: "Фильтры",
          start: "Дата начала",
          end: "Дата окончания",
          type: "Тип документа",
          status: "Статус",
          refType: "Тип ссылки",
          refId: "Reference ID",
          search: "Поиск",
          all: "Все",
          refIdPlaceholder: "Например: ORD-789",
          searchPlaceholder: "Номер DOC, название, контрагент...",
          clear: "Очистить фильтры",
          apply: "Применить фильтры",
        }
      : language === "en"
        ? {
            title: "Filters",
            start: "Start date",
            end: "End date",
            type: "Document type",
            status: "Status",
            refType: "Reference type",
            refId: "Reference ID",
            search: "Search",
            all: "All",
            refIdPlaceholder: "Example: ORD-789",
            searchPlaceholder: "DOC number, title, counterparty...",
            clear: "Clear filters",
            apply: "Apply filters",
          }
        : {
            title: "Filtrlar",
            start: "Boshlanish sana",
            end: "Tugash sana",
            type: "Hujjat turi",
            status: "Status",
            refType: "Reference turi",
            refId: "Reference ID",
            search: "Qidiruv",
            all: "Barchasi",
            refIdPlaceholder: "Masalan: ORD-789",
            searchPlaceholder: "DOC raqam, nom, kontragent...",
            clear: "Filtrlarni tozalash",
            apply: "Filtrlarni qo'llash",
          }

  const set = (patch: Partial<DocumentsFilters>) => onChange({ ...value, ...patch })
  const primaryBtnClass =
    "rounded-2xl px-4 py-2 text-sm font-semibold border !border-blue-800 !bg-gradient-to-r !from-blue-900 !to-blue-700 !text-white transition hover:brightness-110"

  const docTypes: (DocumentType | "ALL")[] = ["ALL", "INVOICE", "CONTRACT", "ACT", "PAYMENT_ORDER", "DELIVERY_NOTE", "INVENTORY_ACT", "PRODUCTION_REPORT", "OTHER"]
  const statuses: (DocumentStatus | "ALL")[] = ["ALL", "DRAFT", "SIGNED", "PAID", "CANCELED", "ARCHIVED"]
  const refTypes: (RefType | "ALL")[] = ["ALL", "ORDER", "PURCHASE", "PRODUCTION", "WAREHOUSE", "FINANCE", "MANUAL"]

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h3 className="text-base font-medium text-slate-900">{copy.title}</h3>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="md:col-span-1">
          <label className="text-xs text-slate-600">{copy.start}</label>
          <input
            type="date"
            value={value.dateFrom ?? ""}
            onChange={(e) => set({ dateFrom: e.target.value || undefined })}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="md:col-span-1">
          <label className="text-xs text-slate-600">{copy.end}</label>
          <input
            type="date"
            value={value.dateTo ?? ""}
            onChange={(e) => set({ dateTo: e.target.value || undefined })}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="md:col-span-1">
          <label className="text-xs text-slate-600">{copy.type}</label>
          <select value={value.type ?? "ALL"} onChange={(e) => set({ type: e.target.value as any })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
            {docTypes.map((t) => (
              <option key={t} value={t}>
                {t === "ALL" ? copy.all : docTypeLabel[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="text-xs text-slate-600">{copy.status}</label>
          <select value={value.status ?? "ALL"} onChange={(e) => set({ status: e.target.value as any })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? copy.all : docStatusLabel[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="text-xs text-slate-600">{copy.refType}</label>
          <select value={value.refType ?? "ALL"} onChange={(e) => set({ refType: e.target.value as any })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
            {refTypes.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? copy.all : refTypeLabel[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="text-xs text-slate-600">{copy.refId}</label>
          <input
            value={value.refId ?? ""}
            onChange={(e) => set({ refId: e.target.value || undefined })}
            placeholder={copy.refIdPlaceholder}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="md:col-span-4">
          <label className="text-xs text-slate-600">{copy.search}</label>
          <input
            value={value.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder={copy.searchPlaceholder}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="md:col-span-2 flex items-end justify-end gap-2">
          <button onClick={onReset} className={primaryBtnClass}>
            {copy.clear}
          </button>
          <button onClick={onApply} className={primaryBtnClass}>
            {copy.apply}
          </button>
        </div>
      </div>
    </div>
  )
}
