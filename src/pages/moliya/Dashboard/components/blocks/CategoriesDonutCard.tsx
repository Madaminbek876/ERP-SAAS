import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import type { CategorySlice } from "../../data/types"
import { cx } from "../../ui/cx"
import { cardBase, cardHeader, titleText, subText } from "../../ui/theme"

/**
 * ✅ CategoriesDonutCard
 * Qayerga tegishli:
 * - src/pages/moliya/Dashboard/blocks/CategoriesDonutCard.tsx
 *
 * Vazifasi:
 * - Kategoriyalar donut chart + legend
 *
 * Dizayn:
 * - light card
 * - legend: slate ranglar
 * - donut: premium ranglar
 */
export default function CategoriesDonutCard({ slices }: { slices: CategorySlice[] }) {
  const COLORS = ["#8b5cf6", "#22c55e", "#f59e0b", "#06b6d4", "#ec4899"]
  const data = (slices ?? []).map((s) => ({ name: s.name, value: s.percent }))

  return (
    <div className={cx(cardBase, "p-4")}>
      <div className={cardHeader}>
        <div className={titleText}>Kategoriyalar</div>
        <div className={cx("ml-auto", subText)}>oxirgi oy</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 items-center">
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={48} outerRadius={62} paddingAngle={4}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {(slices ?? []).slice(0, 5).map((s, i) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-slate-700 font-semibold">{s.name}</span>
              <span className="ml-auto text-slate-500 font-bold">{s.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
