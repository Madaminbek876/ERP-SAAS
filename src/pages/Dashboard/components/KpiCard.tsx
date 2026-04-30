import type { Kpi } from "../api/types"
import { useI18n } from "@/i18n"

function cx(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ")
}

export default function KpiCard({ kpi }: { kpi: Kpi }) {
  const { language } = useI18n()
  const tone =
    kpi.tone === "success"
      ? "text-emerald-700"
      : kpi.tone === "danger"
        ? "text-rose-700"
        : "text-slate-900"

  const delta = typeof kpi.deltaPercent === "number" ? kpi.deltaPercent : null
  const deltaTone = delta == null ? "text-slate-500" : delta >= 0 ? "text-emerald-700" : "text-rose-700"
  const changeLabel =
    language === "ru" ? "к прошлому периоду" : language === "en" ? "vs previous period" : "o'tgan davrga nisbatan"

  return (
    <div className="lux-motion-surface relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="absolute right-3 top-3 text-lg text-slate-400">{kpi.icon ?? "+"}</div>
      <div className="text-xs font-semibold text-slate-500">{kpi.title}</div>
      <div className={cx("mt-2 text-2xl font-extrabold", tone)}>{kpi.value}</div>
      <div className="mt-1 text-xs text-slate-500">{kpi.sub}</div>

      {delta != null && (
        <div
          className={cx(
            "mt-3 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold",
            "border-slate-200 bg-slate-50",
            deltaTone
          )}
        >
          {delta >= 0 ? "+" : "-"} {Math.abs(delta).toFixed(1)}%
          <span className="font-semibold text-slate-500">{changeLabel}</span>
        </div>
      )}
    </div>
  )
}
