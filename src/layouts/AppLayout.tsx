// src/layouts/AppLayout.tsx
import { Outlet, NavLink, useLocation } from "react-router-dom"
import { useI18n } from "@/i18n"
import Sidebar from "../widgets/Sidebar/Sidebar"
import Topbar from "../widgets/TopBar/Topbar"

const QUICK_TAB_EXACT_PATHS = ["/dashboard", "/dashboard/sotuv", "/dashboard/sklad"] as const
const QUICK_TAB_HIDDEN_ROOTS = ["/dashboard/moliya", "/dashboard/sklad/warehouse"] as const

export default function AppLayout() {
  const { t } = useI18n()
  const location = useLocation()
  const routeMotionKey = location.pathname + location.search
  const isQuickTabHidden = QUICK_TAB_HIDDEN_ROOTS.some(
    (path) => location.pathname === path || location.pathname.startsWith(path + "/")
  )
  const showQuickTabs =
    !isQuickTabHidden &&
    QUICK_TAB_EXACT_PATHS.some((path) => location.pathname === path)

  return (
    <div className="min-h-screen w-full bg-slate-100">
      <div className="mx-auto max-w-[18000px] px-4 py-4">
        <div className="flex gap-4">
          <Sidebar />

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="motion-enter-top">
              <Topbar />
            </div>

            {showQuickTabs && (
              <div className="motion-enter-bottom lux-motion-surface relative rounded-2xl bg-white px-3 py-2 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  <DashTab to="/dashboard" end>{t("layout.tab.dashboard")}</DashTab>
                  <DashTab to="/dashboard/sotuv">{t("layout.tab.salesDashboard")}</DashTab>
                  <DashTab to="/dashboard/sklad">{t("layout.tab.warehouseDashboard")}</DashTab>
                  <DashTab to="/dashboard/moliya">{t("layout.tab.financeDashboard")}</DashTab>
                </div>
              </div>
            )}

            <main className="dashboard-scope glass min-w-0 p-4 md:p-6">
              <div key={routeMotionKey} className="motion-route-shell motion-stagger">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashTab({
  to,
  end,
  children,
}: {
  to: string
  end?: boolean
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "rounded-full px-5 py-2.5 text-sm font-medium transition",
          isActive
            ? "bg-gradient-to-r from-blue-900 to-blue-700 text-white hover:from-blue-950 hover:to-blue-800"
            : "bg-gradient-to-r from-blue-900 to-blue-700  text-white hover:from-blue-950 hover:to-blue-800 opacity-70 hover:opacity-100",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  )
}
