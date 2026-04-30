import { cn } from "@/lib/utils"

export function pageTabClass(isActive: boolean, className?: string) {
  return cn(
    "rounded-2xl border px-6 py-3 text-base font-semibold transition-all duration-200",
    isActive
      ? "!border-blue-700 !bg-gradient-to-r !from-[#1d4ed8] !via-[#1e40af] !to-[#1d4ed8] !text-white shadow-[0_12px_28px_rgba(29,78,216,0.24)]"
      : "!border-blue-700/80 !bg-gradient-to-r !from-[#1d4ed8] !via-[#1e40af] !to-[#1d4ed8] !text-white shadow-[0_10px_22px_rgba(29,78,216,0.18)] opacity-90 hover:opacity-100",
    className
  )
}
