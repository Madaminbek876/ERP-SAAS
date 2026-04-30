import type { InvestmentRow } from "../../data/types"
import { cx } from "../../ui/cx"
import { cardBase, cardHeader, titleText, subText } from "../../ui/theme"

/**
 * ✅ InvestmentsCard
 * Qayerga tegishli:
 * - src/pages/moliya/Dashboard/components/blocks/InvestmentsCard.tsx
 *
 * Vazifasi:
 * - progress barlar
 *
 * Dizayn:
 * - light card
 * - progress: bg-slate-100 + gradientga o‘xshash premium rang (oddiy bg bilan)
 */
export default function InvestmentsCard({ rows }: { rows: InvestmentRow[] }) {
  return (
    <div className={cx(cardBase, "p-4")}>
      <div className={cardHeader}>
        <div className={titleText}>Investitsiyalar</div>
        <div className={cx("ml-auto", subText)}>bugun</div>
      </div>

      <div className="mt-3 space-y-3">
        {(rows ?? []).slice(0, 5).map((r) => {
          const pct = Math.max(0, Math.min(100, r.percent))
          return (
            <div key={r.title}>
              <div className="flex items-center text-xs">
                <span className="truncate font-bold text-slate-700">{r.title}</span>
                <span className="ml-auto font-extrabold text-slate-900">${r.amount.toFixed(2)}</span>
              </div>

              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-indigo-600"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
