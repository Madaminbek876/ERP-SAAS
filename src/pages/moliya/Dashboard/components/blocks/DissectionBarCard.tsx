import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts"
import type { DissectionPoint } from "../../data/types"
import { cx } from "../../ui/cx"
import { cardBase, cardHeader, titleText, subText } from "../../ui/theme"
import { chartTheme } from "../../ui/chartTheme"

/**
 * ✅ DissectionBarCard (LIGHT + 2 rang)
 * - Kirim: ko‘k
 * - Xarajat: binafsha
 */
export default function DissectionBarCard({ points }: { points: DissectionPoint[] }) {
  return (
    <div className={cx(cardBase, "p-4")}>
      <div className={cardHeader}>
        <div className={titleText}>Tahlil</div>
        <div className={cx("ml-auto", subText)}>oxirgi oy</div>
      </div>

      <div className="mt-3 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points}>
            <XAxis dataKey="label" tick={{ fill: chartTheme.axis, fontSize: 10 }} />
            <Tooltip
              cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(226,232,240,1)",
                background: "white",
                color: "#0f172a",
                fontSize: 12,
              }}
              labelStyle={{ color: "#334155", fontWeight: 800 }}
            />

            {/* ✅ 2 rangli barlar */}
            <Bar dataKey="a" radius={[8, 8, 0, 0]} fill={chartTheme.income.bar} />
            <Bar dataKey="b" radius={[8, 8, 0, 0]} fill={chartTheme.expense.bar} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex gap-4 text-xs text-slate-500 font-semibold">
        <span className="inline-flex items-center gap-2">
          <i className="h-2.5 w-2.5 rounded-full" style={{ background: chartTheme.income.stroke }} />
          Kirim
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="h-2.5 w-2.5 rounded-full" style={{ background: chartTheme.expense.stroke }} />
          Xarajat
        </span>
      </div>
    </div>
  )
}
