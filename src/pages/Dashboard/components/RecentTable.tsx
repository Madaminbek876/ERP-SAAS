import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RecentRow } from "../api/types"
import { useI18n } from "@/i18n"

function money(n: number) {
  return `${n.toLocaleString("uz-UZ")} so'm`
}

function typeLabel(type: RecentRow["type"], copy: Record<string, string>) {
  if (type === "PAYMENT_IN") return copy.paymentIn
  if (type === "PAYMENT_OUT") return copy.paymentOut
  if (type === "MOVE_IN") return copy.moveIn
  if (type === "MOVE_OUT") return copy.moveOut
  return copy.sale
}

function metaLabel(row: RecentRow) {
  if (row.meta) return row.meta
  if (row.qty) return row.qty.toLocaleString("uz-UZ")
  return "-"
}

export default function RecentTable({
  rows,
  q,
  onQChange,
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  rows: RecentRow[]
  q: string
  onQChange: (v: string) => void
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          title: "Последние действия",
          subtitle: "Платежи, продажи и складские движения",
          search: "Поиск...",
          page: "Страница",
          date: "Дата",
          name: "Название",
          type: "Тип",
          note: "Примечание",
          amount: "Сумма",
          empty: "Пока нет данных.",
          paymentIn: "Оплата клиента",
          paymentOut: "Оплата поставщику",
          moveIn: "Приход",
          moveOut: "Расход",
          sale: "Продажа",
        }
      : language === "en"
        ? {
            title: "Recent activity",
            subtitle: "Payments, sales and warehouse movements",
            search: "Search...",
            page: "Page",
            date: "Date",
            name: "Name",
            type: "Type",
            note: "Note",
            amount: "Amount",
            empty: "No data yet.",
            paymentIn: "Client payment",
            paymentOut: "Supplier payment",
            moveIn: "Incoming",
            moveOut: "Outgoing",
            sale: "Sale",
          }
        : {
            title: "Oxirgi harakatlar",
            subtitle: "To'lovlar, sotuv va ombor harakati",
            search: "Qidirish...",
            page: "Sahifa",
            date: "Sana",
            name: "Nomi",
            type: "Turi",
            note: "Izoh",
            amount: "Summa",
            empty: "Hozircha ma'lumot yo'q.",
            paymentIn: "Klient to'lovi",
            paymentOut: "Supplier to'lovi",
            moveIn: "Kirim",
            moveOut: "Chiqim",
            sale: "Sotuv",
          }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-extrabold text-slate-900">{copy.title}</div>
          <div className="text-xs text-slate-500">{copy.subtitle}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="text-slate-400">Q</span>
            <input
              value={q}
              onChange={(e) => onQChange(e.target.value)}
              placeholder={copy.search}
              className="w-56 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {copy.page}: <b>{page}</b> / {totalPages}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[900px] w-full text-left text-xs">
          <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white text-slate-600">
            <tr>
              <th className="px-3 py-3 text-right font-bold">{copy.date}</th>
              <th className="px-3 py-3 font-bold">{copy.name}</th>
              <th className="px-4 py-3 font-bold">{copy.type}</th>
              <th className="px-4 py-3 font-bold">{copy.note}</th>
              <th className="px-4 py-3 font-bold">{copy.amount}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-slate-900">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  {copy.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-slate-50">
                  <td className="px-3 py-3 text-right text-slate-600">{row.date}</td>
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">{typeLabel(row.type, copy)}</td>
                  <td className="px-4 py-3">{metaLabel(row)}</td>
                  <td className="px-4 py-3">{row.amount ? money(row.amount) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          className="rounded-xl border border-slate-200 bg-white px-1 py-1 text-xs font-bold text-white !bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-950 hover:to-blue-800 disabled:opacity-50"
          disabled={page <= 1}
          onClick={onPrev}
        >
          <ChevronLeft />
        </button>
        <button
          className="rounded-xl border border-slate-200 bg-white px-1 py-1 text-xs font-bold text-white !bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-950 hover:to-blue-800 disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}
