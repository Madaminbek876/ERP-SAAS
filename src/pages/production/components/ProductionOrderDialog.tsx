import React from "react"
import { toast } from "react-toastify"
import { useI18n } from "@/i18n"
import Portal from "@/pages/documents/components/Portal"
import type { RecipeListItem } from "@/pages/Recipes/api/recipesApi"
import WarehouseCatalogPicker from "@/pages/sklad/warehouse/components/WarehouseCatalogPicker"
import type { ChoiceOption, LookupOption, ProductionDetail, ProductionFormData } from "../types/production.types"
import { toNumber } from "../utils/production.utils"

type Props = {
  open: boolean
  mode: "create" | "edit"
  initial?: ProductionDetail | null
  products: LookupOption[]
  recipes: RecipeListItem[]
  locations: LookupOption[]
  currencyChoices: ChoiceOption[]
  loadingOptions?: boolean
  submitting?: boolean
  onClose: () => void
  onSubmit: (data: ProductionFormData) => void | Promise<void>
}

function buildForm(initial?: ProductionDetail | null, currencyChoices?: ChoiceOption[]): ProductionFormData {
  const defaultCurrency = currencyChoices?.[0]?.value || "UZS"
  if (!initial) {
    return {
      product: "",
      recipe: "",
      qty_produced: "",
      production_date: new Date().toISOString().slice(0, 10),
      location: "",
      output_location: "",
      notes: "",
      extra_cost_total: "0",
      currency: defaultCurrency,
    }
  }

  return {
    product: initial.product ?? "",
    recipe: initial.recipe ?? "",
    qty_produced: String(initial.qty_produced ?? ""),
    production_date: initial.production_date || new Date().toISOString().slice(0, 10),
    location: initial.location ?? "",
    output_location: initial.output_location ?? "",
    notes: initial.notes ?? "",
    extra_cost_total: String(initial.extra_cost_total ?? 0),
    currency: initial.currency || defaultCurrency,
  }
}

export default function ProductionOrderDialog({
  open,
  mode,
  initial,
  products,
  recipes,
  locations,
  currencyChoices,
  loadingOptions = false,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useI18n()
  const [form, setForm] = React.useState<ProductionFormData>(() => buildForm(initial, currencyChoices))

  React.useEffect(() => {
    if (!open) return
    setForm(buildForm(initial, currencyChoices))
  }, [open, initial, currencyChoices])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose, submitting])

  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const filteredRecipes = recipes.filter((recipe) => (form.product ? Number(recipe.product) === Number(form.product) : true))

  const submit = async () => {
    if (!form.product) return toast.error(t("production.dialog.validation.product"))
    if (!form.qty_produced || toNumber(form.qty_produced) <= 0) return toast.error(t("production.dialog.validation.qty"))
    if (mode === "edit" && !form.production_date) return toast.error(t("production.dialog.validation.date"))
    if (toNumber(form.extra_cost_total, -1) < 0) return toast.error(t("production.dialog.validation.extraCost"))

    await onSubmit(form)
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <button aria-label="close" className="absolute inset-0 bg-black/35" onClick={onClose} disabled={submitting} />

        <div className="relative max-h-[90vh] w-full max-w-[920px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(2,6,23,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="text-base font-semibold text-slate-900">
                {mode === "create" ? t("production.dialog.createTitle") : t("production.dialog.editTitle")}
              </div>
              <div className="text-xs text-slate-500">{t("production.dialog.subtitle")}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {submitting ? t("production.dialog.saveLoading") : t("production.dialog.save")}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
              >
                {t("production.dialog.close")}
              </button>
            </div>
          </div>

          <div className="max-h-[calc(90vh-76px)] space-y-5 overflow-auto p-5">
            {loadingOptions ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{t("production.dialog.supportLoading")}</div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.product")}</div>
                <WarehouseCatalogPicker
                  kind="PRODUCTS"
                  products={products}
                  materials={[]}
                  selectedId={String(form.product ?? "")}
                  loading={loadingOptions}
                  mode="overlay"
                  size="compact"
                  onSelect={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      product: value ? Number(value) : "",
                      recipe: "",
                    }))
                  }
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.recipe")}</div>
                <select
                  value={String(form.recipe)}
                  onChange={(e) => setForm((prev) => ({ ...prev, recipe: e.target.value ? Number(e.target.value) : "" }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{form.product ? t("production.dialog.selectRecipe") : t("production.dialog.selectProductFirst")}</option>
                  {form.recipe && !filteredRecipes.some((recipe) => recipe.id === Number(form.recipe)) ? (
                    <option value={form.recipe}>{initial?.recipe_name || t("production.table.recipeFallback", undefined, { id: form.recipe })}</option>
                  ) : null}
                  {filteredRecipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {`${recipe.product_name} - v${recipe.version}${recipe.is_active ? ` (${t("production.dialog.active")})` : ""}`}
                    </option>
                  ))}
                </select>
                {form.product && filteredRecipes.length === 0 ? <div className="mt-1 text-xs text-amber-600">{t("production.dialog.recipeMissing")}</div> : null}
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.plannedQty")}</div>
                <input
                  type="number"
                  value={form.qty_produced}
                  onChange={(e) => setForm((prev) => ({ ...prev, qty_produced: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  min="0"
                  step="0.000001"
                  placeholder="100.000000"
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.productionDate")}</div>
                <input
                  type="date"
                  value={form.production_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, production_date: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.currency")}</div>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {currencyChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.productionLocation")}</div>
                <select
                  value={String(form.location)}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value ? Number(e.target.value) : "" }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{t("production.dialog.selectLocation")}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.outputLocation")}</div>
                <select
                  value={String(form.output_location)}
                  onChange={(e) => setForm((prev) => ({ ...prev, output_location: e.target.value ? Number(e.target.value) : "" }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{t("production.dialog.selectLocation")}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.extraCost")}</div>
                <input
                  type="number"
                  value={form.extra_cost_total}
                  onChange={(e) => setForm((prev) => ({ ...prev, extra_cost_total: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  min="0"
                  step="0.01"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-xs text-slate-500">{t("production.dialog.notes")}</div>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="min-h-[96px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder={t("production.dialog.notesPlaceholder")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
