import { Checkbox } from "@/components/ui/checkbox"
import { useI18n } from "@/i18n"
import type { ProductionBatch } from "../types/production.types"
import { formatBatchNumber, formatQty, getStatusLabel, statusChipClass } from "../utils/production.utils"

type Props = {
  rows: ProductionBatch[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  onOpen: (id: number) => void
}

export default function ProductionTable({ rows, selectedIds, onSelectionChange, onOpen }: Props) {
  const { t } = useI18n()
  const allChecked = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id))

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-600">
          <tr className="border-b border-slate-100">
            <th className="w-12 px-3 py-3 text-center">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onSelectionChange(Array.from(new Set([...selectedIds, ...rows.map((row) => row.id)])))
                    return
                  }

                  onSelectionChange(selectedIds.filter((id) => !rows.some((row) => row.id === id)))
                }}
                aria-label={t("common.selectAll", "Hammasini tanlash")}
              />
            </th>
            <th className="px-3 py-3 text-left">{t("production.table.date")}</th>
            <th className="px-3 py-3 text-left">{t("production.table.batch")}</th>
            <th className="px-3 py-3 text-left">{t("production.table.product")}</th>
            <th className="px-3 py-3 text-left">{t("production.table.plan")}</th>
            <th className="px-3 py-3 text-left">{t("production.table.actual")}</th>
            <th className="px-3 py-3 text-left">{t("production.filters.location")}</th>
            <th className="px-3 py-3 text-left">{t("production.filters.status")}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/60"
              onClick={() => onOpen(row.id)}
            >
              <td
                className="px-3 py-3 text-center"
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                <Checkbox
                  checked={selectedIds.includes(row.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectionChange(Array.from(new Set([...selectedIds, row.id])))
                      return
                    }

                    onSelectionChange(selectedIds.filter((id) => id !== row.id))
                  }}
                  aria-label={`${t("production.table.product")} ${row.product_name}`}
                />
              </td>
              <td className="px-3 py-3 text-slate-700">{row.production_date}</td>
              <td className="px-3 py-3">
                <div className="font-semibold text-slate-900">{formatBatchNumber(row.batch_no, row.id)}</div>
                <div className="text-xs text-slate-500">
                  {t("production.table.output")}: {row.output_location_name || "-"}
                </div>
              </td>
              <td className="px-3 py-3 text-slate-900">
                <button
                  type="button"
                  data-slot="button"
                  draggable={false}
                  className="production-product-button block select-none bg-transparent p-0 text-left text-inherit"
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpen(row.id)
                  }}
                >
                  <div className="font-medium text-[#1f3b68] hover:text-[#1d4ed8]">{row.product_name}</div>
                  <div className="text-xs text-slate-500">
                    {row.recipe_name || (row.recipe ? t("production.table.recipeFallback", undefined, { id: row.recipe }) : "-")}
                  </div>
                </button>
              </td>
              <td className="px-3 py-3 text-slate-900">{formatQty(row.qty_produced)}</td>
              <td className="px-3 py-3 text-slate-900">{formatQty(row.qty_actual)}</td>
              <td className="px-3 py-3 text-slate-700">{row.location_name || "-"}</td>
              <td className="px-3 py-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusChipClass(row.status)}`}>
                  {getStatusLabel(row.status)}
                </span>
              </td>
            </tr>
          ))}

          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-10 text-center text-slate-500">
                {t("production.table.empty")}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
