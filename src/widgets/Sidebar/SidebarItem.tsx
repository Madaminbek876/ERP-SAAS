import { NavLink, useLocation } from "react-router-dom"
import type { MouseEvent } from "react"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/utils"

export default function SidebarItem({
  item,
  onSelect,
}: {
  item: {
    to: string
    labelKey: string
    icon: any
    badge?: string | number
    disabled?: boolean
    activeMatch?: string[]
  }
  onSelect?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const { t } = useI18n()
  const location = useLocation()
  const activePaths = item.activeMatch?.length ? item.activeMatch : [item.to]

  const isCustomActive =
    item.to === "/dashboard"
      ? location.pathname === "/dashboard"
      : activePaths.some((path) => location.pathname === path || location.pathname.startsWith(path + "/"))

  const Icon = item.icon
  const label = t(item.labelKey)

  return (
    <NavLink
      to={item.disabled ? "#" : item.to}
      className={cn("block", item.disabled && "pointer-events-none opacity-45")}
      onClick={onSelect}
      aria-label={label}
      aria-disabled={item.disabled}
      tabIndex={item.disabled ? -1 : 0}
    >
      {() => (
        <div
          className={cn(
            "lux-motion-surface relative flex h-[45px] w-full items-center rounded-2xl px-2.5 transition-all duration-200 ease-out hover:translate-x-0.5 hover:bg-slate-900/5",
            isCustomActive && "bg-slate-900/5 ring-1 ring-slate-900/10"
          )}
        >
          <div
            className={cn(
              "absolute left-0 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-sky-400 to-indigo-600 opacity-0",
              isCustomActive && "opacity-100"
            )}
          />

          <div className="flex w-[64px] shrink-0 items-center justify-center">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200 ease-out",
                isCustomActive
                  ? "bg-blue-600/12 ring-1 ring-blue-500/15 shadow-[0_12px_26px_-18px_rgba(37,99,235,0.65)]"
                  : "bg-white ring-1 ring-slate-900/5 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.2)]"
              )}
            >
              <Icon size={20} className={cn(isCustomActive ? "text-blue-600" : "text-slate-700")} />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden pr-3">
            <span
              className={cn(
                "block min-w-0 w-0 truncate translate-x-2 opacity-0 text-[14px] font-semibold transition-all duration-200 group-hover/sidebar:w-auto group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100",

                isCustomActive ? "text-slate-900" : "text-slate-700"
              )}
            >
              {label}
            </span>

            {item.badge !== undefined ? (
              <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
                {item.badge}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </NavLink>
  )
}
