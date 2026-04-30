import { NavLink, Outlet } from "react-router-dom"
import { pageTabClass } from "@/components/common/pageTabStyles"
import { useI18n } from "@/i18n"

function Tab(props: { to: string; children: string }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) => pageTabClass(isActive)}
    >
      {props.children}
    </NavLink>
  )
}

export default function ProductionLayout() {
  const { t } = useI18n()

  return (
    <div className="production-scope space-y-4">
      <div className="flex flex-wrap gap-2">
        <Tab to="/dashboard/production/orders">{t("sidebar.production")}</Tab>
        <Tab to="/dashboard/production/recipes">{t("production.dialog.recipe")}</Tab>
      </div>
      <Outlet />
    </div>
  )
}
