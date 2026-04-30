import type { TxRow } from "../../data/types"

function cx(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ")
}

function money(n: number) {
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  // hozir demo USD ko‘rinishi bo‘lishi mumkin, keyin UZSga o‘zgartirasan
  return `${sign}$${abs.toFixed(2)}`
}

export default function TransactionsCard({
  rows,
  title = "Tranzaksiyalar",
  subtitle = "bugun",
  onRowClick,
}: {
  rows: TxRow[]
  title?: string
  subtitle?: string
  onRowClick?: (row: TxRow) => void
}) {
  const safeRows = Array.isArray(rows) ? rows : []

  return (
    <div className="lux-motion-surface rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        <div className="text-xs font-semibold text-slate-400">{subtitle}</div>
      </div>

      <div className="mt-3 grid gap-3">
        {safeRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-500">
            Hozircha tranzaksiya yo‘q.
          </div>
        ) : (
          safeRows.map((r) => {
            const isNeg = r.amount < 0
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onRowClick?.(r)}
                className={cx(
                  "lux-motion-surface w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-left",
                  "hover:bg-slate-50 transition"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl border border-slate-200 bg-white" />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-slate-900">{r.title}</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">{r.dateLabel}</div>
                  </div>

                  <div className={cx("text-sm font-extrabold", isNeg ? "text-rose-600" : "text-emerald-700")}>
                    {money(r.amount)}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
