import type { ChartRange } from "../api/types"
import { pageTabClass } from "@/components/common/pageTabStyles"

export default function RangeTabs({
  value,
  onChange,
}: {
  value: ChartRange
  onChange: (r: ChartRange) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {(["1W", "1M", "3M", "1Y"] as const).map((t) => (
        <button
          key={t}
          type="button"
          className={pageTabClass(value === t, "px-2 py-1 !bg-gradient-to-r from-blue-900 to-blue-700 text-white hover:from-blue-950 hover:to-blue-800 text-[10px] font-bold")}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
