import LineChart from "./LineChart"
import type { ChartRange } from "../dashboard-api/types"
import { useI18n } from "@/i18n"

type Props = {
  title?: string
  series: { label: string; value: number }[]
  activeRange: ChartRange
  onRangeChange: (r: ChartRange) => void
}

export default function SalesOverviewCard({
  title = "Sotuv & Daromad ko'rinishi",
  series,
  activeRange,
  onRangeChange,
}: Props) {
  const { language } = useI18n()
  const resolvedTitle =
    title === "Sotuv & Daromad ko'rinishi"
      ? language === "ru"
        ? "Обзор продаж и дохода"
        : language === "en"
          ? "Sales and revenue overview"
          : title
      : title
  const rangeLabel =
    language === "ru" ? "Выбранный диапазон:" : language === "en" ? "Selected range:" : "Tanlangan oraliq:"

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">{resolvedTitle}</h3>
          <div className="mt-1 text-xs text-slate-500">
            {rangeLabel} <span className="font-bold text-slate-900">{activeRange}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(["1W", "1M", "3M", "1Y"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onRangeChange(t)}
              className={[
                "rounded-lg border px-2.5 py-1.5 text-xs font-bold transition",
                activeRange === t
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <LineChart data={series} />
      </div>
    </div>
  )
}
