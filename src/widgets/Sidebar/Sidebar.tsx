import SidebarItem from "./SidebarItem"
import { sidebarItems } from "./Sidebar.data"
import { clearAuth, getRefreshToken } from "@/lib/auth"
import { accountsApi } from "@/pages/auth/api/accountsApi"
import { type MouseEvent } from "react"
import { useNavigate } from "react-router-dom"

export type SectionKey =
  | "dashboard"
  | "sotuv"
  | "sklad"
  | "moliya"
  | "tovar"
  | "mijoz"

export default function Sidebar({
  onSectionChange,
}: {
  onSectionChange?: (key: SectionKey | null) => void
}) {
  const navigate = useNavigate()

  async function handleSelect(itTo: string, event: MouseEvent<HTMLAnchorElement>) {
    if (itTo === "/login") {
      event.preventDefault()

      const refresh = getRefreshToken()
      try {
        if (refresh) {
          await accountsApi.logout({ refresh })
        }
      } catch (error) {
        console.error("LOGOUT ERROR:", error)
      } finally {
        clearAuth()
        onSectionChange?.(null)
        navigate("/login", { replace: true })
      }
      return
    }

    if (itTo.startsWith("/dashboard")) {
      if (itTo === "/dashboard") {
        onSectionChange?.("dashboard")
        return
      }
      if (itTo.startsWith("/dashboard/sklad")) {
        onSectionChange?.("sklad")
        return
      }
      if (itTo.startsWith("/dashboard/moliya")) {
        onSectionChange?.("moliya")
        return
      }
      if (itTo.startsWith("/dashboard/partners")) {
        onSectionChange?.("mijoz")
        return
      }
      onSectionChange?.("dashboard")
      return
    }

    if (itTo.startsWith("/sotuv")) {
      onSectionChange?.("sotuv")
      return
    }

    if (itTo.startsWith("/xodimlar")) {
      onSectionChange?.("mijoz")
      return
    }

    onSectionChange?.(null)
  }

  return (
    <aside
      className={[
        "motion-sidebar-shell",
        "group/sidebar",
        "shrink-0",
        "sticky top-4 h-[calc(100vh-2rem)]",
        "flex flex-col",
        "rounded-[28px]",
        "bg-white",
        "border border-slate-200",
        "shadow-[0_22px_70px_-55px_rgba(15,23,42,0.55)]",
        "overflow-hidden",
        "overflow-x-hidden",
        "w-[92px] hover:w-[300px]",
        "will-change-[width]",
        "transition-[width] duration-200 ease-out",
        "group",

      ].join(" ")}
    >
      <div className="p-4 pb-3">
        <div className="lux-motion-surface relative rounded-3xl bg-gradient-to-r from-blue-900 to-blue-700 p-4 text-white shadow-[0_22px_60px_-40px_rgba(2,6,23,0.7)]">
          <div className="flex items-center justify-center gap-3 transition-all duration-200 group-hover/sidebar:justify-start">
            <div className="ml-[14px] flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <SidebarBrandMark />
            </div>

            <div className="min-w-0 w-0 translate-x-2 overflow-hidden opacity-0 transition-all duration-200 group-hover/sidebar:w-auto group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100">
              <div className="truncate leading-5 font-bold">OUR SYSTEM</div>
              <div className="truncate text-xs text-white/70">ERP SOLUTION</div>

              {/* ✅ text faqat hoverda chiqadi */}

            </div>
          </div>
        </div >
      </div >

      <div className="hide-scrollbar flex-1 overflow-y-auto px-3 pb-3">
        <nav className="flex flex-col gap-2">
          {sidebarItems.map((it) => (
            <SidebarItem
              key={it.to}
              item={it}
              onSelect={(event) => {
                void handleSelect(it.to, event)
              }}
            />
          ))}
        </nav>
      </div>
    </aside >
  )
}

function SidebarBrandMark() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-blue-600 text-[9px] font-black tracking-[0.18em] text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)]">
      ERP
    </div>
  )
}
