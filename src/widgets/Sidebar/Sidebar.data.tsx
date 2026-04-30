import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Warehouse,
  Wallet,
  Users,
  LogOut,
} from "lucide-react"

export type SidebarItemType = {
  to: string
  labelKey: string
  icon: LucideIcon
  badge?: string | number
  disabled?: boolean
  activeMatch?: string[]
}

export const sidebarItems: SidebarItemType[] = [
  { to: "/dashboard", labelKey: "sidebar.dashboard", icon: LayoutDashboard },
  { to: "/dashboard/settings/dicts", labelKey: "sidebar.dicts", icon: BookOpen },
  { to: "/sotuv/orders", labelKey: "sidebar.orders", icon: ClipboardList },
  {
    to: "/dashboard/sklad/warehouse/purchases",
    labelKey: "sidebar.warehouse",
    icon: Warehouse,
    activeMatch: ["/dashboard/sklad/warehouse", "/dashboard/catalog/products"],
  },
  { to: "/dashboard/moliya", labelKey: "sidebar.finance", icon: Wallet, activeMatch: ["/dashboard/moliya"] },
  { to: "/xodimlar", labelKey: "sidebar.people", icon: Users },
  { to: "/login", labelKey: "sidebar.logout", icon: LogOut },
]
