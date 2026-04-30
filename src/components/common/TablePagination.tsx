import { ChevronLeft, ChevronRight } from "lucide-react"

type TablePaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
  className?: string
  size?: "md" | "sm"
}

export default function TablePagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className = "",
  size = "md",
}: TablePaginationProps) {
  const canPrev = !disabled && page > 1
  const canNext = !disabled && page < totalPages
  const buttonSize = size === "sm" ? "h-8 w-8 rounded-[14px]" : "h-10 w-10 rounded-[16px]"
  const badgeSize = size === "sm" ? "min-w-[60px] px-2.5 py-1 text-[13px]" : "min-w-[70px] px-3 py-1.5 text-sm"
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"

  return (
    <div className={`mb-3 flex items-center gap-2 ${className}`.trim()}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
        className={`${buttonSize} inline-flex items-center justify-center bg-gradient-to-br from-[#9cb4d1] to-[#7f9cc0] text-white shadow-[0_6px_14px_rgba(59,95,145,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45`}
      >
        <ChevronLeft className={iconSize} />
      </button>

      <div
        className={`${badgeSize} inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]`}
      >
        {page} / {totalPages}
      </div>

      <button
        type="button"
        aria-label="Next page"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        className={`${buttonSize} inline-flex items-center justify-center bg-gradient-to-br from-[#9cb4d1] to-[#7f9cc0] text-white shadow-[0_6px_14px_rgba(59,95,145,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45`}
      >
        <ChevronRight className={iconSize} />
      </button>
    </div>
  )
}
