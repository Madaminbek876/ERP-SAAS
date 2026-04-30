import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from "recharts"
import type { IncomeExpensePoint } from "../../data/types"
import { cx } from "../../ui/cx"
import { cardBase, cardHeader, titleText, subText } from "../../ui/theme"
import { chartTheme } from "../../ui/chartTheme"

/**
 * ✅ IncomeExpenseLineCard (LIGHT + 2 rang)
 * - Kirim: ko‘k chiziq + yengil glow
 * - Xarajat: binafsha chiziq + yengil glow
 */
export default function IncomeExpenseLineCard({ points }: { points: IncomeExpensePoint[] }) {
  return (
    <div className={cx(cardBase, "p-4")}>
      <div className={cardHeader}>
        <div className={titleText}>Kirim va xarajat</div>
        <div className={cx("ml-auto", subText)}>oxirgi hafta</div>
      </div>

      <div className="mt-3 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <defs>
              {/* ✅ yengil fill gradient (luxury) */}
              <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartTheme.income.stroke} stopOpacity={0.18} />
                <stop offset="100%" stopColor={chartTheme.income.stroke} stopOpacity={0.02} />
              </linearGradient>

              <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartTheme.expense.stroke} stopOpacity={0.18} />
                <stop offset="100%" stopColor={chartTheme.expense.stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <XAxis dataKey="label" tick={{ fill: chartTheme.axis, fontSize: 10 }} />

            <Tooltip
              cursor={{ stroke: "rgba(148,163,184,.45)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(226,232,240,1)",
                background: "white",
                color: "#0f172a",
                fontSize: 12,
              }}
              labelStyle={{ color: "#334155", fontWeight: 800 }}
            />

            {/* ✅ 2 xil rang */}
            <Line
              type="monotone"
              dataKey="income"
              stroke={chartTheme.income.stroke}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke={chartTheme.expense.stroke}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
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
