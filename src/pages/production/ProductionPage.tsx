import { useEffect, useState } from "react"
import { toast } from "react-toastify"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { useI18n } from "@/i18n"
import { recipesApi, type RecipeListItem } from "@/pages/Recipes/api/recipesApi"
import { warehouseApi } from "@/pages/sklad/warehouse/api/warehouseApi"
import {
  createProductionOrder,
  deleteProductionOrder,
  getProductionMeta,
  getProductionOrder,
  listProductionOrders,
  updateProductionOrder,
} from "./api/productionApi"
import ProductionFiltersPanel from "./components/ProductionFilters"
import ProductionOrderDialog from "./components/ProductionOrderDialog"
import ProductionTable from "./components/ProductionTable"
import ProductionTopbar from "./components/ProductionTopbar"
import ProductionViewModal from "./components/ProductionViewModal"
import type {
  LookupOption,
  ProductionBatch,
  ProductionCreatePayload,
  ProductionDetail,
  ProductionFilters,
  ProductionFormData,
} from "./types/production.types"
import {
  extractApiErrorMessage,
  FALLBACK_CURRENCY_CHOICES,
  getFallbackStatusChoices,
  normalizeStatusChoices,
  toNumber,
} from "./utils/production.utils"

const defaultFilters: ProductionFilters = {
  status: "ALL",
  product: "ALL",
  location: "ALL",
  search: "",
  dateFrom: undefined,
  dateTo: undefined,
}

function toOptionalLookupId(value: number | "") {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
}

function buildPayload(form: ProductionFormData) {
  const payload: ProductionCreatePayload = {
    product: Number(form.product),
    qty_produced: form.qty_produced,
    notes: form.notes.trim(),
    extra_cost_total: toNumber(form.extra_cost_total),
    currency: form.currency,
  }
  const recipe = toOptionalLookupId(form.recipe)
  const location = toOptionalLookupId(form.location)
  const outputLocation = toOptionalLookupId(form.output_location)
  const productionDate = form.production_date.trim()

  if (recipe !== undefined) payload.recipe = recipe
  if (productionDate) payload.production_date = productionDate
  if (location !== undefined) payload.location = location
  if (outputLocation !== undefined) payload.output_location = outputLocation

  return payload
}

function sortOptions(options: LookupOption[]) {
  return options.slice().sort((left, right) => left.name.localeCompare(right.name))
}

function sortRecipes(recipes: RecipeListItem[]) {
  return recipes
    .slice()
    .sort((left, right) =>
      `${left.product_name} ${String(left.version).padStart(4, "0")}`.localeCompare(
        `${right.product_name} ${String(right.version).padStart(4, "0")}`
      )
    )
}

export default function ProductionPage() {
  const { t } = useI18n()
  const [filtersDraft, setFiltersDraft] = useState(defaultFilters)
  const [filters, setFilters] = useState(defaultFilters)

  const [rows, setRows] = useState<ProductionBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [products, setProducts] = useState<LookupOption[]>([])
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [locations, setLocations] = useState<LookupOption[]>([])
  const [statusChoices, setStatusChoices] = useState(() => getFallbackStatusChoices())
  const [currencyChoices, setCurrencyChoices] = useState(FALLBACK_CURRENCY_CHOICES)
  const [supportLoading, setSupportLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editRow, setEditRow] = useState<ProductionDetail | null>(null)

  const [viewOpen, setViewOpen] = useState(false)
  const [viewRow, setViewRow] = useState<ProductionDetail | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteIds, setDeleteIds] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)

  const loadRows = async (nextFilters: ProductionFilters) => {
    setLoading(true)
    setError("")
    try {
      setRows(await listProductionOrders(nextFilters))
    } catch (err) {
      const message = extractApiErrorMessage(err, t("production.page.rowsLoadFailed"))
      setError(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const loadSupportData = async () => {
    setSupportLoading(true)
    try {
      const [metaResult, productsResult, recipesResult, locationsResult] = await Promise.allSettled([
        getProductionMeta(),
        warehouseApi.listProducts(),
        recipesApi.listAll({ ordering: "-version" }),
        warehouseApi.listWarehouseLocationOptions(),
      ])

      if (metaResult.status === "fulfilled") {
        setStatusChoices(
          metaResult.value.status_choices.length > 0
            ? normalizeStatusChoices(metaResult.value.status_choices)
            : getFallbackStatusChoices()
        )
        setCurrencyChoices(
          metaResult.value.currency_choices.length > 0 ? metaResult.value.currency_choices : FALLBACK_CURRENCY_CHOICES
        )
      } else {
        setStatusChoices(getFallbackStatusChoices())
        setCurrencyChoices(FALLBACK_CURRENCY_CHOICES)
      }

      if (productsResult.status === "fulfilled") {
        setProducts(sortOptions(productsResult.value))
      } else {
        toast.error(extractApiErrorMessage(productsResult.reason, t("production.page.productsLoadFailed")))
      }

      if (recipesResult.status === "fulfilled") {
        setRecipes(sortRecipes(recipesResult.value.rows))
      } else {
        toast.error(extractApiErrorMessage(recipesResult.reason, t("production.page.recipesLoadFailed")))
      }

      if (locationsResult.status === "fulfilled") {
        setLocations(sortOptions(locationsResult.value))
      } else {
        toast.error(extractApiErrorMessage(locationsResult.reason, t("production.page.locationsLoadFailed")))
      }
    } finally {
      setSupportLoading(false)
    }
  }

  useEffect(() => {
    void loadSupportData()
  }, [])

  useEffect(() => {
    void loadRows(filters)
  }, [filters])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)))
  }, [rows])

  const onApply = () => setFilters(filtersDraft)

  const onReset = () => {
    setFiltersDraft(defaultFilters)
    setFilters(defaultFilters)
  }

  const onExportCsv = () => {
    const header = [
      "production_date",
      "batch_no",
      "status",
      "product_name",
      "qty_produced",
      "qty_actual",
      "qty_waste",
      "location_name",
      "output_location_name",
      "total_cost",
      "unit_cost",
      "currency",
      "notes",
    ]

    const lines = rows.map((row) =>
      [
        row.production_date,
        row.batch_no,
        row.status,
        row.product_name,
        row.qty_produced,
        row.qty_actual,
        row.qty_waste,
        row.location_name,
        row.output_location_name,
        row.total_cost,
        row.unit_cost,
        row.currency,
        row.notes.replaceAll("\n", " "),
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )

    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `production_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const onView = async (id: number) => {
    try {
      const detail = await getProductionOrder(id)
      setViewRow(detail)
      setViewOpen(true)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("production.page.detailLoadFailed")))
    }
  }

  const onEdit = async (id: number) => {
    try {
      const detail = await getProductionOrder(id)
      if (detail.status !== "DRAFT") {
        toast.error(t("production.page.draftOnlyEdit"))
        return
      }
      setEditRow(detail)
      setEditOpen(true)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("production.page.detailLoadFailed")))
    }
  }

  const onDeleteSelected = () => {
    if (selectedIds.length === 0) return
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id))
    if (selectedRows.some((row) => row.status !== "DRAFT")) {
      toast.error(t("production.page.draftOnlyDelete"))
      return
    }
    setDeleteIds(selectedRows.map((row) => row.id))
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    const idsToDelete = deleteIds
    if (idsToDelete.length === 0) return
    setDeleting(true)
    try {
      await Promise.all(idsToDelete.map((id) => deleteProductionOrder(id)))
      toast.success(t("production.page.batchDeleted"))
      await loadRows(filters)
      setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)))
      setDeleteOpen(false)
      setDeleteIds([])
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("production.page.batchDeleteFailed")))
    } finally {
      setDeleting(false)
    }
  }

  const submitCreate = async (form: ProductionFormData) => {
    setCreateSubmitting(true)
    try {
      await createProductionOrder(buildPayload(form))
      toast.success(t("production.page.batchCreated"))
      setCreateOpen(false)
      await loadRows(filters)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("production.page.batchCreateFailed")))
    } finally {
      setCreateSubmitting(false)
    }
  }

  const submitEdit = async (form: ProductionFormData) => {
    if (!editRow) return
    setEditSubmitting(true)
    try {
      await updateProductionOrder(editRow.id, buildPayload(form))
      toast.success(t("production.page.batchUpdated"))
      setEditOpen(false)
      setEditRow(null)
      await loadRows(filters)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("production.page.batchUpdateFailed")))
    } finally {
      setEditSubmitting(false)
    }
  }

  const onViewUpdated = async (id: number) => {
    try {
      const detail = await getProductionOrder(id)
      setViewRow(detail)
      await loadRows(filters)
    } catch (err) {
      toast.error(extractApiErrorMessage(err, t("production.page.updatedDetailFailed")))
    }
  }

  const createDisabled = supportLoading

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white border border-slate-200 p-4 shadow-[0_18px_40px_rgba(2,6,23,0.08)]">
        <ProductionTopbar
          onCreate={() => setCreateOpen(true)}
          onExportCsv={onExportCsv}
          onDelete={onDeleteSelected}
          deleteDisabled={selectedIds.length === 0}
          createDisabled={createDisabled}
        />
      </div>
      <ProductionFiltersPanel
        value={filtersDraft}
        statusChoices={statusChoices}
        products={products}
        locations={locations}
        onChange={setFiltersDraft}
        onApply={onApply}
        onReset={onReset}
      />

      <div className="rounded-3xl bg-white border border-slate-200 p-3 shadow-[0_18px_40px_rgba(2,6,23,0.08)]">
        {loading ? (
          <div className="py-12 text-center text-slate-500">{t("production.page.loading")}</div>
        ) : error ? (
          <div className="py-12 text-center text-rose-600">{error}</div>
        ) : (
          <ProductionTable
            rows={rows}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onOpen={onView}
          />
        )}
      </div>

      <ProductionOrderDialog
        open={createOpen}
        mode="create"
        products={products}
        recipes={recipes}
        locations={locations}
        currencyChoices={currencyChoices}
        loadingOptions={supportLoading}
        submitting={createSubmitting}
        onClose={() => setCreateOpen(false)}
        onSubmit={submitCreate}
      />

      <ProductionOrderDialog
        open={editOpen}
        mode="edit"
        initial={editRow}
        products={products}
        recipes={recipes}
        locations={locations}
        currencyChoices={currencyChoices}
        loadingOptions={supportLoading}
        submitting={editSubmitting}
        onClose={() => {
          setEditOpen(false)
          setEditRow(null)
        }}
        onSubmit={submitEdit}
      />

      <ProductionViewModal
        open={viewOpen}
        order={viewRow}
        locations={locations}
        onClose={() => {
          setViewOpen(false)
          setViewRow(null)
        }}
        onUpdated={onViewUpdated}
        onEdit={(id) => {
          setViewOpen(false)
          void onEdit(id)
        }}
      />

      <DeleteAlertDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) {
            setDeleteIds([])
          }
        }}
        title={t("production.page.deleteTitle")}
        description={
          deleteIds.length > 1
            ? `${deleteIds.length} ta batch o'chirilsinmi?`
            : t("production.page.deleteDescription")
        }
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
