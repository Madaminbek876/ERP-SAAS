import React from "react"
import { toast } from "react-toastify"
import { useI18n } from "@/i18n"
import Portal from "@/pages/documents/components/Portal"
import { materialsApi } from "@/pages/Materials/api/materialsApi"
import { warehouseApi } from "@/pages/sklad/warehouse/api/warehouseApi"
import {
  cancelProductionOrder,
  confirmProductionOrder,
  doneProductionOrder,
  previewProductionOrder,
  startProductionOrder,
} from "../api/productionApi"
import type { LookupOption, ProductionDetail, ProductionPreview } from "../types/production.types"
import {
  describeMissingItem,
  extractApiErrorMessage,
  formatDateTime,
  formatMoney,
  formatQty,
  getStatusLabel,
  statusChipClass,
} from "../utils/production.utils"
import ProductionCancelDialog from "./ProductionCancelDialog"
import ProductionCostCard from "./ProductionCostCard"
import ProductionDoneDialog from "./ProductionDoneDialog"

type Props = {
  open: boolean
  order: ProductionDetail | null
  locations: LookupOption[]
  onClose: () => void
  onUpdated: (id: number) => void | Promise<void>
  onEdit?: (id: number) => void
}

function normalizeLookupKey(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
}

function normalizeCompactLookupKey(value?: string | null) {
  return normalizeLookupKey(value).replace(/[^a-z0-9]+/g, "")
}

function extractLeadingTokenKey(value?: string | null) {
  const match = normalizeLookupKey(value).match(/^[a-z0-9]+/)
  return match?.[0] ?? ""
}

function resolveMetaByName<T>(map: Record<string, T>, value?: string | null) {
  const exactKey = normalizeLookupKey(value)
  if (exactKey && map[exactKey]) return map[exactKey]

  const compactKey = normalizeCompactLookupKey(value)
  if (compactKey && map[compactKey]) return map[compactKey]

  const leadingTokenKey = extractLeadingTokenKey(value)
  if (leadingTokenKey && map[leadingTokenKey]) return map[leadingTokenKey]

  return undefined
}

function pickPreferredMoneyValue(...values: Array<number | null | undefined>) {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  const positiveValue = finiteValues.find((value) => value > 0)
  if (positiveValue !== undefined) return positiveValue
  return finiteValues[0] ?? null
}

export default function ProductionViewModal({ open, order, locations, onClose, onUpdated, onEdit }: Props) {
  const { t } = useI18n()
  const [preview, setPreview] = React.useState<ProductionPreview | null>(null)
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)
  const [doneOpen, setDoneOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [materialMetaById, setMaterialMetaById] = React.useState<
    Record<number, { uom_name: string | null; unit_cost: number | null; currency: string | null }>
  >({})
  const [stockMetaById, setStockMetaById] = React.useState<
    Record<number, { unit_cost: number | null; currency: string | null }>
  >({})
  const [materialMetaByName, setMaterialMetaByName] = React.useState<
    Record<string, { uom_name: string | null; unit_cost: number | null; currency: string | null }>
  >({})
  const [stockMetaByName, setStockMetaByName] = React.useState<
    Record<string, { unit_cost: number | null; currency: string | null }>
  >({})

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !actionLoading) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, onClose, actionLoading])

  React.useEffect(() => {
    if (!open) return
    setPreview(null)
    setDoneOpen(false)
    setCancelOpen(false)
  }, [open, order?.id])

  React.useEffect(() => {
    if (!open || !order) return

    const materialIds = Array.from(
      new Set(
        order.consumptions
          .map((line) => Number(line.raw_material ?? 0))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    )
    const materialNames = Array.from(
      new Set(
        order.consumptions
          .map((line) => normalizeLookupKey(line.raw_material_name))
          .filter(Boolean)
      )
    )

    if (materialIds.length === 0 && materialNames.length === 0) {
      setMaterialMetaById({})
      setStockMetaById({})
      setMaterialMetaByName({})
      setStockMetaByName({})
      return
    }

    let cancelled = false

    void (async () => {
      const [materialsResult, stockResult] = await Promise.allSettled([
        materialsApi.listAll(),
        order.location
          ? warehouseApi.fetchStock({
              page: 1,
              page_size: 5000,
              location: order.location,
              item_type: "RAW_MATERIAL",
            })
          : Promise.resolve({ results: [] as Array<Record<string, unknown>> }),
      ])

      if (cancelled) return

      const nextMaterialMeta: Record<number, { uom_name: string | null; unit_cost: number | null; currency: string | null }> = {}
      const nextMaterialMetaByName: Record<string, { uom_name: string | null; unit_cost: number | null; currency: string | null }> = {}
      if (materialsResult.status === "fulfilled") {
        for (const material of materialsResult.value.rows ?? []) {
          const unitCost = material.default_purchase_price ?? material.purchase_price ?? null
          const meta = {
            uom_name: material.uom_name ?? null,
            unit_cost: unitCost,
            currency: material.currency ?? null,
          }
          nextMaterialMeta[material.id] = meta
          const nameKeys = [
            normalizeLookupKey(material.name),
            normalizeCompactLookupKey(material.name),
            extractLeadingTokenKey(material.name),
          ].filter(Boolean)
          for (const nameKey of nameKeys) {
            if (!nextMaterialMetaByName[nameKey]) {
              nextMaterialMetaByName[nameKey] = meta
            }
          }
        }
      }

      const nextStockMeta: Record<number, { unit_cost: number | null; currency: string | null }> = {}
      const nextStockMetaByName: Record<string, { unit_cost: number | null; currency: string | null }> = {}
      if (stockResult.status === "fulfilled") {
        for (const row of stockResult.value.results ?? []) {
          const rawMaterialId = Number((row as any)?.raw_material ?? 0)
          const avgUnitCost = Number((row as any)?.avg_unit_cost ?? 0)
          const stockMeta = {
            unit_cost: Number.isFinite(avgUnitCost) ? avgUnitCost : null,
            currency: (row as any)?.currency ? String((row as any).currency) : null,
          }

          if (Number.isFinite(rawMaterialId) && rawMaterialId > 0 && materialIds.includes(rawMaterialId)) {
            nextStockMeta[rawMaterialId] = stockMeta
          }

          const stockName = String((row as any)?.raw_material_name ?? (row as any)?.item_name ?? "")
          const stockNameKeys = [
            normalizeLookupKey(stockName),
            normalizeCompactLookupKey(stockName),
            extractLeadingTokenKey(stockName),
          ].filter(Boolean)
          for (const stockNameKey of stockNameKeys) {
            if (stockNameKey && materialNames.includes(stockNameKey) && !nextStockMetaByName[stockNameKey]) {
              nextStockMetaByName[stockNameKey] = stockMeta
            }
          }
        }
      }

      setMaterialMetaById(nextMaterialMeta)
      setStockMetaById(nextStockMeta)
      setMaterialMetaByName(nextMaterialMetaByName)
      setStockMetaByName(nextStockMetaByName)
    })()

    return () => {
      cancelled = true
    }
  }, [open, order])

  const consumptionRows = React.useMemo(() => {
    if (!order) return []

    return order.consumptions.map((line) => {
      const materialMeta = line.raw_material ? materialMetaById[line.raw_material] : undefined
      const stockMeta = line.raw_material ? stockMetaById[line.raw_material] : undefined
      const materialMetaFromName = resolveMetaByName(materialMetaByName, line.raw_material_name)
      const stockMetaFromName = resolveMetaByName(stockMetaByName, line.raw_material_name)
      const qtyValue = Number(line.qty_used)
      const unitCost = pickPreferredMoneyValue(
        line.unit_cost,
        materialMeta?.unit_cost,
        materialMetaFromName?.unit_cost,
        stockMeta?.unit_cost,
        stockMetaFromName?.unit_cost
      )
      const computedTotal = unitCost !== null && Number.isFinite(qtyValue) ? unitCost * qtyValue : null
      const totalCost = pickPreferredMoneyValue(line.total_cost, computedTotal)

      return {
        ...line,
        uom_name: line.uom_name ?? materialMeta?.uom_name ?? materialMetaFromName?.uom_name ?? null,
        unit_cost: unitCost,
        total_cost: totalCost,
        currency:
          line.currency ??
          stockMeta?.currency ??
          stockMetaFromName?.currency ??
          materialMeta?.currency ??
          materialMetaFromName?.currency ??
          order.currency,
      }
    })
  }, [materialMetaById, materialMetaByName, order, stockMetaById, stockMetaByName])

  if (!open) return null

  const reload = async () => {
    if (!order) return
    await onUpdated(order.id)
  }

  const runPreview = async () => {
    if (!order) return null
    setActionLoading("preview")
    try {
      const response = await previewProductionOrder(order.id)
      setPreview(response)
      if (response.can_confirm) toast.success(t("production.view.previewSuccess"))
      else toast.error(t("production.view.previewInsufficient"))
      return response
    } catch (error) {
      toast.error(extractApiErrorMessage(error, t("production.view.previewFailed")))
      return null
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirm = async () => {
    if (!order) return
    setActionLoading("confirm")
    try {
      const result = await previewProductionOrder(order.id)
      setPreview(result)
      if (!result.can_confirm || result.missing.length > 0) {
        toast.error(t("production.view.confirmBlocked"))
        return
      }
      await confirmProductionOrder(order.id)
      toast.success(t("production.view.confirmed"))
      await reload()
    } catch (error) {
      toast.error(extractApiErrorMessage(error, t("production.view.confirmFailed")))
    } finally {
      setActionLoading(null)
    }
  }

  const handleStart = async () => {
    if (!order) return
    setActionLoading("start")
    try {
      await startProductionOrder(order.id)
      toast.success(t("production.view.started"))
      await reload()
    } catch (error) {
      toast.error(extractApiErrorMessage(error, t("production.view.startFailed")))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDone = async (payload: { qty_actual?: string; qty_waste?: string; waste_location?: number }) => {
    if (!order) return
    setActionLoading("done")
    try {
      await doneProductionOrder(order.id, payload)
      toast.success(t("production.view.done"))
      setDoneOpen(false)
      await reload()
    } catch (error) {
      toast.error(extractApiErrorMessage(error, t("production.view.doneFailed")))
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (payload: { reason?: string }) => {
    if (!order) return
    setActionLoading("cancel")
    try {
      await cancelProductionOrder(order.id, payload)
      toast.success(t("production.view.cancelled"))
      setCancelOpen(false)
      await reload()
    } catch (error) {
      toast.error(extractApiErrorMessage(error, t("production.view.cancelFailed")))
    } finally {
      setActionLoading(null)
    }
  }

  const canEdit = order?.status === "DRAFT"
  const canPreview = order?.status === "DRAFT"
  const canConfirm = order?.status === "DRAFT"
  const canStart = order?.status === "CONFIRMED"
  const canDone = order?.status === "IN_PROGRESS"
  const canCancel = order ? order.status !== "DONE" && order.status !== "CANCELLED" : false

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="close" />

        <div className="relative max-h-[90vh] w-full max-w-[980px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(2,6,23,0.35)]">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
            <div>
              <div className="text-base font-semibold text-slate-900">{t("production.view.title")}</div>
              <div className="text-xs text-slate-500">{t("production.view.subtitle")}</div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {canEdit && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(order.id)}
                  disabled={Boolean(actionLoading)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                >
                  {t("production.view.edit")}
                </button>
              ) : null}

              {canPreview ? (
                <button
                  type="button"
                  onClick={runPreview}
                  disabled={Boolean(actionLoading)}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  {actionLoading === "preview" ? t("production.view.previewLoading") : t("production.view.preview")}
                </button>
              ) : null}

              {canConfirm ? (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={Boolean(actionLoading)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                >
                  {actionLoading === "confirm" ? t("production.view.confirmLoading") : t("production.view.confirm")}
                </button>
              ) : null}

              {canStart ? (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={Boolean(actionLoading)}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  {actionLoading === "start" ? t("production.view.startLoading") : t("production.view.start")}
                </button>
              ) : null}

              {canDone ? (
                <button
                  type="button"
                  onClick={() => setDoneOpen(true)}
                  disabled={Boolean(actionLoading)}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                >
                  {t("production.view.finish")}
                </button>
              ) : null}

              {canCancel ? (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  disabled={Boolean(actionLoading)}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  {t("production.view.cancel")}
                </button>
              ) : null}

              <button type="button" onClick={onClose} className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-95">
                {t("production.view.close")}
              </button>
            </div>
          </div>

          <div className="max-h-[calc(90vh-76px)] space-y-4 overflow-auto p-5">
            {!order ? (
              <div className="py-12 text-center text-slate-500">{t("production.view.notFound")}</div>
            ) : (
              <>
                <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500">{order.production_date}</div>
                      <div className="text-lg font-semibold text-slate-900">{order.batch_no}</div>
                      <div className="text-sm text-slate-700">
                        {order.product_name} • {t("production.view.planLabel")}: {formatQty(order.qty_produced)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {t("production.view.recipeLabel")}: {order.recipe_name || (order.recipe ? `#${order.recipe}` : "-")}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {t("production.view.productionAndOutput", undefined, {
                          production: order.location_name || "-",
                          output: order.output_location_name || "-",
                        })}
                      </div>
                    </div>

                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusChipClass(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  {order.notes ? <div className="mt-3 text-sm text-slate-700">{order.notes}</div> : null}
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">{t("production.view.planQty")}</div>
                    <div className="font-semibold text-slate-900">{formatQty(order.qty_produced)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">{t("production.view.actualQty")}</div>
                    <div className="font-semibold text-slate-900">{formatQty(order.qty_actual)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">{t("production.view.wasteQty")}</div>
                    <div className="font-semibold text-slate-900">{formatQty(order.qty_waste)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">{t("production.view.wasteLocation")}</div>
                    <div className="font-semibold text-slate-900">{order.waste_location_name || "-"}</div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">{t("production.view.timestamps")}</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">{t("production.view.confirmedAt")}</div>
                      <div className="font-semibold text-slate-900">{formatDateTime(order.confirmed_at)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">{t("production.view.startedAt")}</div>
                      <div className="font-semibold text-slate-900">{formatDateTime(order.started_at)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">{t("production.view.doneAt")}</div>
                      <div className="font-semibold text-slate-900">{formatDateTime(order.done_at)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">{t("production.view.cancelledAt")}</div>
                      <div className="font-semibold text-slate-900">{formatDateTime(order.cancelled_at)}</div>
                    </div>
                  </div>
                </div>

                <ProductionCostCard order={order} preview={preview} />

                {preview ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{t("production.view.previewResult")}</div>
                        <div className="text-xs text-slate-500">
                          {t("production.view.canConfirm", undefined, {
                            value: preview.can_confirm ? t("production.view.yes") : t("production.view.no"),
                          })}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{formatMoney(preview.total_cost_estimate, order.currency)}</div>
                    </div>

                    <div className="mt-3">
                      {preview.missing.length === 0 ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          {t("production.view.stockEnough")}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {preview.missing.map((item, index) => (
                            <div
                              key={`${item.raw_material ?? "missing"}-${index}`}
                              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                            >
                              {describeMissingItem(item)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {order.cancel_reason ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {t("production.view.cancelReason", undefined, { reason: order.cancel_reason })}
                  </div>
                ) : null}

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>

                      <div className="text-sm font-semibold text-slate-900">{t("production.view.consumptionsTitle")}</div>
                      <div className="text-xs text-slate-500">{t("production.view.consumptionsSubtitle")}</div>

                    </div>
                    <div className="text-sm font-semibold text-slate-900">{t("production.view.rowsCount", undefined, { count: order.consumptions.length })}</div>
                  </div >

                  <div className="mt-3 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="text-slate-600">
                        <tr className="border-b border-slate-100">
                          <th className="py-2 text-left">{t("production.view.rawMaterial")}</th>
                          <th className="py-2 text-left">{t("production.view.uom")}</th>
                          <th className="py-2 text-right">{t("production.view.qty")}</th>
                          <th className="py-2 text-right">{t("production.view.unitCost")}</th>
                          <th className="py-2 text-right">{t("production.view.total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consumptionRows.map((line) => (
                          <tr key={line.id} className="border-b border-slate-50">
                            <td className="py-2">{line.raw_material_name || `${t("production.view.rawMaterial")} #${line.raw_material ?? "-"}`}</td>
                            <td className="py-2 text-slate-600">{line.uom_name || "-"}</td>
                            <td className="py-2 text-right">{formatQty(line.qty_used)}</td>
                            <td className="py-2 text-right">{line.unit_cost === null ? "-" : formatMoney(line.unit_cost, line.currency || order.currency)}</td>
                            <td className="py-2 text-right font-semibold">{line.total_cost === null ? "-" : formatMoney(line.total_cost, line.currency || order.currency)}</td>
                          </tr>
                        ))}

                        {consumptionRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">
                              {t("production.view.missingConsumption")}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div >
              </>
            )
            }
          </div >
        </div >

        <ProductionDoneDialog
          open={doneOpen}
          producedQty={order?.qty_produced ?? "0"}
          locations={locations}
          loading={actionLoading === "done"}
          onClose={() => setDoneOpen(false)}
          onSubmit={handleDone}
        />

        <ProductionCancelDialog open={cancelOpen} loading={actionLoading === "cancel"} onClose={() => setCancelOpen(false)} onSubmit={handleCancel} />
      </div >
    </Portal >
  )
}
