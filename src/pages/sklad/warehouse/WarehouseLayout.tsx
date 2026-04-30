import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ScrollReveal from "@/components/common/ScrollReveal"
import { useI18n } from "@/i18n"
import {
  Boxes,
  Building2,
  Check,
  ClipboardList,
  Package,
  ShoppingCart,
  Trash2,
  type LucideIcon,
} from "lucide-react"

const WAREHOUSE_TABS: Array<{ value: string; to: string; icon: LucideIcon }> = [
  { value: "internal-orders", to: "/dashboard/sklad/warehouse/internal-orders", icon: Check },
  { value: "purchases", to: "/dashboard/sklad/warehouse/purchases", icon: ShoppingCart },
  { value: "write-offs", to: "/dashboard/sklad/warehouse/write-offs", icon: Trash2 },
  { value: "products", to: "/dashboard/sklad/warehouse/products", icon: Package },
  { value: "inventories", to: "/dashboard/sklad/warehouse/inventories", icon: ClipboardList },
  { value: "balances-products", to: "/dashboard/sklad/warehouse/balances-products", icon: Boxes },
  { value: "warehouses", to: "/dashboard/sklad/warehouse/warehouses", icon: Building2 },
]

function isActivePath(currentPath: string, tabPath: string) {
  return currentPath === tabPath || currentPath.startsWith(`${tabPath}/`)
}

export default function WarehouseLayout() {
  const { language } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const tabLabels: Record<string, string> =
    language === "ru"
      ? {
          "internal-orders": "Перемещение",
          purchases: "Закупки",
          "write-offs": "Расходы",
          products: "Товары",
          materials: "Сырьё",
          inventories: "Инвертизация",
          "balances-products": "Остатка",
          warehouses: "Склады",
        }
      : language === "en"
        ? {
            "internal-orders": "Transfers",
            purchases: "Purchases",
            "write-offs": "Write-offs",
            products: "Products",
            materials: "Raw material",
            inventories: "Inventory",
            "balances-products": "Balances",
            warehouses: "Warehouses",
          }
        : {
            "internal-orders": "Ko'chirishlar",
            purchases: "Xaridlar",
            "write-offs": "Chiqimlar",
            products: "Mahsulotlar",
            materials: "Xomashyo",
            inventories: "Inventarizatsiya",
            "balances-products": "Qoldig'i",
            warehouses: "Ombor",
          }

  const activeTab = WAREHOUSE_TABS.find((tab) => isActivePath(location.pathname, tab.to))?.value ?? WAREHOUSE_TABS[0].value

  return (
    <div className="space-y-6">
      <ScrollReveal delay={40}>
        <Tabs
          value={activeTab}
          onValueChange={(value) => navigate(WAREHOUSE_TABS.find((tab) => tab.value === value)?.to ?? WAREHOUSE_TABS[0].to)}
        >
          <TabsList className="motion-stagger-right-slow group-data-[orientation=horizontal]/tabs:!h-auto flex h-auto w-full justify-between gap-2 rounded-2xl bg-transparent p-0">
            {WAREHOUSE_TABS.map((tab) => {
              const Icon = tab.icon
              const active = tab.value === activeTab

              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={[
                    "group relative h-auto min-h-[96px] min-w-0 !flex-1 overflow-hidden rounded-xl border px-2.5 py-3 text-center after:hidden",
                    "border-slate-300 !bg-white !text-slate-900 transition-[background-size,border-color,color,transform,box-shadow] duration-700 ease-out",
                    "!bg-gradient-to-r from-blue-900 to-blue-700 bg-no-repeat [background-size:0%_100%] [background-position:0_100%]",
                    "hover:[background-size:100%_100%] hover:-translate-y-0.5 !hover:bg-gradient-to-r from-blue-900 to-blue-700 text-white hover:!text-white hover:shadow-[0_10px_24px_rgba(29,78,216,0.22)]",
                    "data-[state=active]:[background-size:100%_100%] data-[state=active]:border-blue-700 data-[state=active]:!text-white data-[state=active]:shadow-[0_12px_30px_rgba(29,78,216,0.25)]",
                    active ? "!bg-gradient-to-r from-blue-900 to-blue-700 text-white" : "border-slate-300",
                  ].join(" ")}
                >
                  <span
                    className="relative z-10 flex flex-col items-center justify-center gap-2 leading-tight text-slate-900 transition-colors duration-200 ease-out group-hover:text-white group-data-[state=active]:text-white"
                  >
                    <Icon className="size-5" />
                    <span className="max-w-full whitespace-nowrap px-1 text-center text-[14px] font-semibold md:text-[15px]">
                      {tabLabels[tab.value] ?? tab.value}
                    </span>
                  </span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </ScrollReveal>
      <div className="motion-enter-side-slow pt-2">
        <Outlet />
      </div>
    </div>
  )
}
