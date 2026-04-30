import { useMemo, useState } from "react"
import type { DashboardFilter, FilterRange } from "../dashboard-api/types"
import { useI18n } from "@/i18n"

type Props = {
  onApply?: (payload: DashboardFilter) => void
}

const chipBase = "rounded-md px-2.5 py-1 text-xs font-semibold border transition"
const chipActive = "bg-slate-900 text-white border-slate-900"
const chipIdle = "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function FilterBar({ onApply }: Props) {
  const { language } = useI18n()
  const [range, setRange] = useState<FilterRange>("month")

  const today = useMemo(() => todayISO(), [])
  const [date, setDate] = useState(today)

  const copy =
    language === "ru"
      ? {
          title: "Фильтр по дате:",
          today: "Сегодня",
          week: "Неделя",
          month: "Месяц",
          apply: "Применения фильтра",
        }
      : language === "en"
        ? {
            title: "Filter by date:",
            today: "Today",
            week: "Week",
            month: "Month",
            apply: "Apply filters",
          }
        : {
            title: "Sana bo'yicha filtrlash:",
            today: "Bugun",
            week: "Hafta",
            month: "Oy",
            apply: "Filtrlarni qo'llash",
          }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/70 p-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">{copy.title}</span>

        <button
          type="button"
          className={`${chipBase} ${range === "today" ? chipActive : chipIdle}`}
          onClick={() => setRange("today")}
        >
          {copy.today}
        </button>

        <button
          type="button"
          className={`${chipBase} ${range === "week" ? chipActive : chipIdle}`}
          onClick={() => setRange("week")}
        >
          {copy.week}
        </button>

        <button
          type="button"
          className={`${chipBase} ${range === "month" ? chipActive : chipIdle}`}
          onClick={() => setRange("month")}
        >
          {copy.month}
        </button>

        <div className="ml-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
          <span className="text-xs text-slate-500">...</span>
          <input
            className="text-xs text-slate-700 outline-none"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => onApply?.({ range, date })}
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
        >
          {copy.apply}
        </button>
      </div>
    </div>
  )
}
