import { useMemo, useState } from "react"
import type { DashboardFilter, FilterRange } from "../api/types"
import { pageTabClass } from "@/components/common/pageTabStyles"
import { useI18n } from "@/i18n"

type Props = {
  onApply: (f: DashboardFilter) => void
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  initial?: DashboardFilter
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function FilterBar({ onApply, leftSlot, rightSlot, initial }: Props) {
  const { language } = useI18n()
  const init = useMemo<DashboardFilter>(
    () =>
      initial ?? {
        range: "month",
        date: todayISO(),
        currency: "UZS",
      },
    [initial]
  )

  const [range, setRange] = useState<FilterRange>(init.range ?? "month")
  const [date, setDate] = useState<string>(init.date ?? todayISO())
  const [currency, setCurrency] = useState<string>(init.currency ?? "UZS")

  const copy =
    language === "ru"
      ? {
          title: "Filter by date:",
          today: "Today",
          week: "Week",
          month: "Month",
          year: "Year",
          apply: "Apply filters",
        }
      : language === "en"
        ? {
            title: "Filter by date:",
            today: "Today",
            week: "Week",
            month: "Month",
            year: "Year",
            apply: "Apply filters",
          }
        : {
            title: "Sana bo'yicha filtrlash:",
            today: "Bugun",
            week: "Hafta",
            month: "Oy",
            year: "Yil",
            apply: "Filtrlarni qo'llash",
          }

  const apply = () => onApply({ range, date, currency })

  const Tab = ({ value, children }: { value: FilterRange; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => setRange(value)}
      className={pageTabClass(
        range === value,
        "h-9 rounded-lg px-3 !bg-gradient-to-r from-blue-900 to-blue-700 py-0 text-xs font-extrabold text-white"
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {!!leftSlot && <div className="flex items-center">{leftSlot}</div>}

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-bold text-slate-600">{copy.title}</div>
            <Tab value="today">{copy.today}</Tab>
            <Tab value="week">{copy.week}</Tab>
            <Tab value="month">{copy.month}</Tab>
            <Tab value="year">{copy.year}</Tab>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightSlot}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="UZS">UZS</option>
            <option value="USD">USD</option>
          </select>
          <button
            type="button"
            onClick={apply}
            className="h-9 rounded-lg !bg-gradient-to-r from-blue-900 to-blue-700 px-4 text-xs font-extrabold text-white hover:from-blue-950 hover:to-blue-800"
          >
            {copy.apply}
          </button>
        </div>
      </div>
    </div>
  )
}

