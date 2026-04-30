import type { ReactNode } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { useI18n } from "@/i18n"
import { pageTabClass } from "@/components/common/pageTabStyles"

export default function MoliyaLayout() {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          title: "Финансовый отдел",
          subtitle: "Здесь вы можете управлять приходами, расходами и задолженностями в одном месте.",
          dashboard: "Показатели",
          cash: "Кассовые документы",
          bank: "Банковские документы",
          payroll: "Зарплата сотрудников",
          debts: "Задолженности",
        }
      : language === "en"
        ? {
            title: "Finance Department",
            subtitle: "Here you can manage finance-related information in one place.",
            dashboard: "Dashboard",
            cash: "Cash documents",
            bank: "Bank documents",
            payroll: "Payroll",
            debts: "Debts",
          }
        : {
            title: "Moliya bo'limi",
            subtitle: "Bu yerda moliyaga oid ma'lumotlarni bir joyda boshqarishingiz mumkin.",
            dashboard: "Ko'rsatkichlar",
            cash: "Kassa hujjatlari",
            bank: "Bank hujjatlari",
            payroll: "Xodimlar oyligi",
            debts: "Qarzdorlik",
          }

  return (
    <div className="moliya-scope space-y-4">
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_30%)]" />

        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-lg font-black tracking-tight text-slate-900">{copy.title}</div>
            <div className="mt-1 text-sm text-slate-500">{copy.subtitle}</div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-slate-50/90 p-2">
            <Tab to="/dashboard/moliya" end>{copy.dashboard}</Tab>
            <Tab to="/dashboard/moliya/cash-documents">{copy.cash}</Tab>
            <Tab to="/dashboard/moliya/bank-documents">{copy.bank}</Tab>
            <Tab to="/dashboard/moliya/payroll">{copy.payroll}</Tab>
            <Tab to="/dashboard/moliya/debts">{copy.debts}</Tab>
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}

function Tab({
  to,
  children,
  end,
}: {
  to: string
  children: ReactNode
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => pageTabClass(isActive, "rounded-xl px-4 py-2 font-bold shadow-sm")}
    >
      {children}
    </NavLink>
  )
}
