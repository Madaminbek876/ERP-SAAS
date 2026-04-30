import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import type { SpendingParam } from "../../data/types"
import { cx } from "../../ui/cx"
import { cardBase, cardHeader, titleText, subText, innerBox } from "../../ui/theme"

/**
 * ✅ SpendingParamsCard
 * Qayerga tegishli:
 * - src/pages/moliya/Dashboard/components/blocks/SpendingParamsCard.tsx
 *
 * Vazifasi:
 * - 6ta mini donut (foizlar)
 *
 * Dizayn:
 * - light card + ichki mini kartalar (innerBox)
 * - text slate
 * - donut ranglari premium (qarama-qarshi, ko‘zga yoqimli)
 */
export default function SpendingParamsCard({ items }: { items: SpendingParam[] }) {
  const COLORS = ["#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"]

  return (
    <div className={cx(cardBase, "p-4")}>
      <div className={cardHeader}>
        <div className={titleText}>Xarajat parametrlari</div>
        <div className={cx("ml-auto", subText)}>oxirgi oy</div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {(items ?? []).slice(0, 6).map((it, idx) => {
          const done = Math.max(0, Math.min(100, it.percent))
          const data = [{ v: done }, { v: 100 - done }]

          return (
            <div key={it.name} className={cx(innerBox, "p-3")}>
              <div className="h-12 w-12 mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} dataKey="v" innerRadius={16} outerRadius={22} startAngle={90} endAngle={-270}>
                      <Cell fill={COLORS[idx % COLORS.length]} />
                      {/* qolgan qismi — juda yengil slate */}
                      <Cell fill="rgba(148,163,184,.35)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 text-center text-[10px] font-semibold text-slate-500">{it.name}</div>
              <div className="mt-1 text-center text-sm font-extrabold text-slate-900">{done}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
