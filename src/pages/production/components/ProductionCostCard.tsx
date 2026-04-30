import { useI18n } from "@/i18n"
import type { ProductionDetail, ProductionPreview } from "../types/production.types"
import { formatMoney } from "../utils/production.utils"

type Props = {
  order: ProductionDetail
  preview?: ProductionPreview | null
}

export default function ProductionCostCard({ order, preview }: Props) {
  const { t } = useI18n()

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{t("production.cost.title")}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">{t("production.cost.unitCost")}</div>
          <div className="text-lg font-extrabold text-slate-900">{formatMoney(order.unit_cost, order.currency)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">{t("production.cost.materialCost")}</div>
          <div className="font-semibold text-slate-900">{formatMoney(order.materials_cost_total, order.currency)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">{t("production.cost.extraCost")}</div>
          <div className="font-semibold text-slate-900">{formatMoney(order.extra_cost_total, order.currency)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">{t("production.cost.totalCost")}</div>
          <div className="font-semibold text-slate-900">{formatMoney(order.total_cost, order.currency)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">{t("production.cost.currency")}</div>
          <div className="font-semibold text-slate-900">{order.currency}</div>
        </div>
      </div>

      {preview ? (
        <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-4">
          <div className="text-sm font-semibold text-slate-900">{t("production.cost.previewTitle")}</div>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs text-slate-500">{t("production.cost.materialEstimate")}</div>
              <div className="font-semibold text-slate-900">{formatMoney(preview.materials_cost_estimate, order.currency)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t("production.cost.extraCost")}</div>
              <div className="font-semibold text-slate-900">{formatMoney(preview.extra_cost_total, order.currency)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t("production.cost.totalEstimate")}</div>
              <div className="font-semibold text-slate-900">{formatMoney(preview.total_cost_estimate, order.currency)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t("production.cost.unitEstimate")}</div>
              <div className="font-semibold text-slate-900">{formatMoney(preview.unit_cost_estimate, order.currency)}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
