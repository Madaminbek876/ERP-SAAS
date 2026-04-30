import { ResponsiveContainer, AreaChart, Area } from "recharts"
import type { Kpi } from "../../data/types"
import { formatUZS } from "../../ui/money"
import { cx } from "../../ui/cx"
import { cardBase, cardHeader, titleText, subText } from "../../ui/theme"

/**
 * ✅ KpiSparkCard
 * Qayerga tegishli:
 * - src/pages/moliya/Dashboard/blocks/KpiSparkCard.tsx
 *
 * Vazifasi:
 * - Yuqoridagi 2ta KPI karta
 * - title + amount + delta + o‘ngda sparkline
 *
 * Dizayn:
 * - Default dashboard (light) bilan bir xil card
 * - Text: slate
 * - Sparkline: premium stroke + yengil fill
 */
export default function KpiSparkCard({ item }: { item: Kpi }) {
  const delta = typeof item.deltaPercent === "number" ? item.deltaPercent : null

  const deltaTone =
    delta == null ? "text-slate-500" : delta >= 0 ? "text-emerald-700" : "text-rose-700"

  const chartData = (item.spark ?? []).map((v, i) => ({ i, v }))

  return (
    <div className={cx(cardBase, "p-4")}>
      <div className={cardHeader}>
        <div className={cx(titleText, "text-xs font-semibold text-slate-500")}>{item.title}</div>
        <div className={cx("ml-auto", subText)}>oxirgi oy</div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-2xl font-extrabold text-slate-900">{formatUZS(item.amount)}</div>

          <div className={cx("mt-1 text-xs font-bold", deltaTone)}>
            {delta == null ? (
              <span className="text-slate-500 font-semibold">—</span>
            ) : (
              <>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                <span className="ml-2 text-slate-500 font-semibold">(oyga nisbatan)</span>
              </>
            )}
          </div>
        </div>

        {/* Sparkline */}
        <div className="h-12 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <Area
                type="monotone"
                dataKey="v"
                strokeWidth={2}
                fillOpacity={0.12}
                // rang bermaslik qoidasi matplotlib uchun edi, rechartsda muammo yo‘q.
                // Lekin premium bo‘lishi uchun yengil gradientni default qoldiramiz.
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
