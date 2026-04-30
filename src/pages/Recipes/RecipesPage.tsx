import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { extractRecipeApiErrorMessage, recipesApi, type RecipeDetail, type RecipeListItem, type RecipePayload } from "./api/recipesApi"
import { productsApi, type Product } from "@/pages/catalog/api/ProductsApi"
import { materialsApi, type Material } from "@/pages/Materials/api/materialsApi"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import RecipeEditorForm from "@/pages/Recipes/components/RecipeEditorForm"
import Portal from "@/pages/documents/components/Portal"
import TablePagination from "@/components/common/TablePagination"
import { useClientPagination } from "@/components/common/useClientPagination"
import { useI18n } from "@/i18n"

export default function RecipesPage() {
  const { language } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [rows, setRows] = useState<RecipeListItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailRecipe, setDetailRecipe] = useState<RecipeDetail | null>(null)
  const [detailItems, setDetailItems] = useState<RecipeDetail["items"]>([])
  const [detailError, setDetailError] = useState<string | null>(null)
  const { page, setPage, totalPages, pagedItems: pagedRows } = useClientPagination(rows, 10, [rows.length, q, activeFilter])
  const recipesBasePath = pathname.startsWith("/dashboard/production/recipes") ? "/dashboard/production/recipes" : "/dashboard/catalog/recipes"
  const genericDetailError =
    language === "ru" ? "Произошла ошибка" : language === "en" ? "Something went wrong" : "Xatolik yuz berdi"
  const copy =
    language === "ru"
      ? {
        title: "Рецепты",
        subtitle: "Создавайте, активируйте и управляйте составом рецептов для продукта.",
        search: "поиск...",
        all: "Все",
        active: "Активные",
        inactive: "Неактивные",
        add: "Добавить",
        loadError: "Не удалось загрузить рецепты",
        activated: "Рецепт активирован",
        activateError: "Не удалось активировать рецепт",
        deleted: "Рецепт удален",
        deleteError: "Не удалось удалить рецепт",
        id: "ID",
        product: "Продукт",
        version: "Версия",
        items: "Позиции",
        cost: "Себестоимость",
        warnings: "Предупреждения",
        activeCol: "Активен",
        actions: "Действия",
        loading: "Загрузка...",
        empty: "Нет данных",
        warning: "предупреждение",
        yes: "Да",
        no: "Нет",
        view: "Просмотр",
        activate: "Активировать",
        delete: "Удалить",
      }
      : language === "en"
        ? {
          title: "Recipes",
          subtitle: "Create, activate and manage recipe composition for a product.",
          search: "search...",
          all: "All",
          active: "Active",
          inactive: "Inactive",
          add: "Add",
          loadError: "Failed to load recipes",
          activated: "Recipe activated",
          activateError: "Failed to activate recipe",
          deleted: "Recipe deleted",
          deleteError: "Failed to delete recipe",
          save: "Save",
          id: "ID",
          product: "Product",
          version: "Version",
          items: "Items",
          cost: "Cost",
          warnings: "Warnings",
          activeCol: "Active",
          actions: "Actions",
          loading: "Loading...",
          empty: "No data",
          warning: "warning",
          yes: "Yes",
          no: "No",
          activate: "Activate",
          delete: "Delete",
          close: "Close",
          detailTitle: "Recipe details",
          detailLoadError: "Failed to load recipe details",
          detailSaveError: "Failed to save recipe",
          detailActivateError: "Failed to activate recipe",
          needOne: "At least 1 material is required",
          chooseEach: "Select a material in each row",
          qty: "qty_per_unit must be greater than 0",
          duplicates: "Do not enter the same material twice",
          activeReadonly: "Active recipe cannot be edited. Create a new version.",
          updated: "Recipe updated",
        }
        : {
          title: "Retseptlar",
          subtitle: "Mahsulot uchun retsept yarating, aktiv qiling va tarkibini boshqaring.",
          search: "qidirish...",
          all: "Hammasi",
          active: "Faol",
          inactive: "Nofaol",
          add: "Qo'shish",
          loadError: "Retseptlar yuklanmadi",
          activated: "Retsept aktiv qilindi",
          activateError: "Retseptni aktiv qilib bo'lmadi",
          deleted: "Retsept o'chirildi",
          deleteError: "Retseptni o'chirib bo'lmadi",
          save: "Saqlash",
          id: "ID",
          product: "Product",
          version: "Version",
          items: "Items",
          cost: "Cost",
          warnings: "Warnings",
          activeCol: "Active",
          actions: "Actions",
          loading: "Yuklanmoqda...",
          empty: "Ma'lumot yo'q",
          warning: "warning",
          yes: "Yes",
          no: "No",
          activate: "Activate",
          delete: "O'chirish",
          close: "Yopish",
          detailTitle: "Retsept tafsiloti",
          detailLoadError: "Retsept ma'lumotlari yuklanmadi",
          detailSaveError: "Retseptni saqlab bo'lmadi",
          detailActivateError: "Retseptni aktiv qilib bo'lmadi",
          needOne: "Kamida 1 ta material kerak",
          chooseEach: "Har bir qatorda material tanlang",
          qty: "qty_per_unit 0 dan katta bo'lishi kerak",
          duplicates: "Bir xil material 2 marta kiritilmasin",
          activeReadonly: "Active recipe tahrirlanmaydi. Yangi versiya yarating.",
          updated: "Retsept yangilandi",
        }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { rows: loadedRows } = await recipesApi.list({
        search: q.trim() || undefined,
        status: activeFilter === "active" ? "ACTIVE" : undefined,
        ordering: "-created_at",
      })
      setRows(
        activeFilter === "inactive"
          ? loadedRows.filter((row) => row.status !== "ACTIVE")
          : loadedRows
      )
      if (products.length === 0) {
        const { rows: productRows } = await productsApi.listAll()
        setProducts(productRows)
      }
      if (materials.length === 0) {
        const { rows: materialRows } = await materialsApi.listAll()
        setMaterials(materialRows)
      }
    } catch (e: any) {
      setError(extractRecipeApiErrorMessage(e, copy.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [activeFilter])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)))
  }, [rows])

  async function activateRecipe(id: number) {
    try {
      await recipesApi.activate(id)
      await load()
      toast.success(copy.activated)
    } catch (e: any) {
      setError(extractRecipeApiErrorMessage(e, copy.activateError))
    }
  }

  async function deleteSelectedRecipes() {
    if (selectedIds.length === 0) return
    setDeleting(true)
    try {
      await Promise.all(selectedIds.map((id) => recipesApi.remove(id)))
      await load()
      setSelectedIds([])
      setDeleteOpen(false)
      toast.success(copy.deleted)
    } catch (e: any) {
      setError(extractRecipeApiErrorMessage(e, copy.deleteError))
    } finally {
      setDeleting(false)
    }
  }

  const allPageSelected = pagedRows.length > 0 && pagedRows.every((row) => selectedIds.includes(row.id))
  const duplicateIds = useMemo(() => {
    const seen = new Set<number>()
    const dup = new Set<number>()
    detailItems.forEach((item) => {
      if (!item.raw_material) return
      if (seen.has(item.raw_material)) dup.add(item.raw_material)
      seen.add(item.raw_material)
    })
    return dup
  }, [detailItems])

  async function openRecipeModal(id: number) {
    setDetailLoading(true)
    setDetailError(null)
    setDetailOpen(true)
    try {
      const data = await recipesApi.read(id)
      setDetailRecipe(data)
      setDetailItems(data.items || [])
    } catch (e: any) {
      setDetailError(extractRecipeApiErrorMessage(e, copy.detailLoadError ?? genericDetailError))
    } finally {
      setDetailLoading(false)
    }
  }

  function closeRecipeModal() {
    setDetailOpen(false)
    setDetailRecipe(null)
    setDetailItems([])
    setDetailError(null)
    setDetailLoading(false)
  }

  function addDetailRow() {
    setDetailItems((prev) => [...prev, { raw_material: 0, qty_per_unit: "1.000000" }])
  }

  function removeDetailRow(index: number) {
    setDetailItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  function updateDetailItem(index: number, field: "raw_material" | "qty_per_unit", value: number | string) {
    setDetailItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  function validateDetailItems() {
    if (detailItems.length === 0) return copy.needOne
    for (const item of detailItems) {
      if (!item.raw_material) return copy.chooseEach
      const qty = Number(item.qty_per_unit)
      if (!Number.isFinite(qty) || qty <= 0) return copy.qty
    }
    if (duplicateIds.size > 0) return copy.duplicates
    return null
  }

  async function saveRecipeDetail() {
    if (!detailRecipe) return
    if (detailRecipe.is_active) {
      setDetailError(copy.activeReadonly ?? genericDetailError)
      return
    }

    const message = validateDetailItems()
    if (message) {
      setDetailError(message)
      return
    }

    setDetailSaving(true)
    setDetailError(null)
    const payload: RecipePayload = {
      name: detailRecipe.name ?? detailRecipe.product_name ?? `Product #${detailRecipe.product}`,
      version: detailRecipe.version,
      items: detailItems.map((item) => ({
        raw_material: Number(item.raw_material),
        qty_per_unit: String(item.qty_per_unit),
      })),
    }

    try {
      await recipesApi.update(detailRecipe.id, payload)
      const fresh = await recipesApi.read(detailRecipe.id)
      setDetailRecipe(fresh)
      setDetailItems(fresh.items || [])
      await load()
      toast.success(copy.updated)
    } catch (e: any) {
      setDetailError(extractRecipeApiErrorMessage(e, copy.detailSaveError ?? genericDetailError))
    } finally {
      setDetailSaving(false)
    }
  }

  async function activateRecipeDetail() {
    if (!detailRecipe) return
    try {
      await recipesApi.activate(detailRecipe.id)
      const fresh = await recipesApi.read(detailRecipe.id)
      setDetailRecipe(fresh)
      setDetailItems(fresh.items || [])
      await load()
      toast.success(copy.activated)
    } catch (e: any) {
      setDetailError(extractRecipeApiErrorMessage(e, copy.detailActivateError ?? genericDetailError))
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[32px] border border-[#d7e3f7] bg-white p-6 shadow-[0_20px_60px_rgba(47,111,237,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#16325c]">{copy.title}</h2>
            <p className="mt-1 text-sm text-[#4b648a]">{copy.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.search} className="h-11 w-[240px] rounded-2xl border-[#c7d7ef] bg-[#f8fbff] text-[#16325c] placeholder:text-[#7f91af] focus-visible:border-[#2f6fed] focus-visible:ring-[#dbe7ff]" />
            <select className="h-11 rounded-2xl border border-[#c7d7ef] bg-[#f8fbff] px-4 text-sm text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "all" | "active" | "inactive")}>
              <option value="all">{copy.all}</option>
              <option value="active">{copy.active}</option>
              <option value="inactive">{copy.inactive}</option>
            </select>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl border-rose-200 bg-rose-50 px-5 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setDeleteOpen(true)}
              disabled={selectedIds.length === 0}
            >
              {copy.delete}
            </Button>
            <Button className="h-11 rounded-2xl border border-[#1f56d8] bg-[#2f6fed] px-5 text-white hover:bg-[#1f56d8]" onClick={() => navigate(`${recipesBasePath}/new`)}>
              + {copy.add}
            </Button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-300 bg-rose-50 p-3 text-sm text-red-600">{error}</div> : null}

        <div className="mt-5 overflow-x-auto rounded-[28px] border border-[#d7e3f7]">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b bg-gradient-to-r from-[#2447a5] to-[#2f6fed] text-white">
              <tr className="border-b border-[#5676c2] transition-colors">
                <th className="p-3 text-center">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds((prev) => Array.from(new Set([...prev, ...pagedRows.map((row) => row.id)])))
                        return
                      }

                      setSelectedIds((prev) => prev.filter((id) => !pagedRows.some((row) => row.id === id)))
                    }}
                    aria-label="Select all recipes"
                  />
                </th>
                <th className="p-3 text-left">{copy.id}</th>
                <th className="p-3 text-left">{copy.product}</th>
                <th className="p-3 text-left">{copy.version}</th>
                <th className="p-3 text-left">{copy.items}</th>
                <th className="p-3 text-left">{copy.cost}</th>
                <th className="p-3 text-left">{copy.warnings}</th>
                <th className="p-3 text-left">{copy.activeCol}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-6">{copy.loading}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6">{copy.empty}</td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3 text-center">
                      <Checkbox
                        checked={selectedIds.includes(r.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) =>
                            checked ? Array.from(new Set([...prev, r.id])) : prev.filter((id) => id !== r.id)
                          )
                        }}
                        aria-label={`Select recipe ${r.id}`}
                      />
                    </td>
                    <td className="p-3">{r.id}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        data-slot="button"
                        draggable={false}
                        className="recipe-product-button block select-none bg-transparent p-0 text-left font-medium text-[#24406b]"
                        onMouseDown={(event) => {
                          event.preventDefault()
                        }}
                        onClick={() => {
                          void openRecipeModal(r.id)
                        }}
                      >
                        {r.product_name}
                      </button>
                    </td>
                    <td className="p-3">{r.version}</td>
                    <td className="p-3">{r.items_count}</td>
                    <td className="p-3">{r.unit_material_cost_display ?? "-"}</td>
                    <td className="p-3">
                      {(r.cost_warnings ?? []).length > 0 ? (
                        <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                          {(r.cost_warnings ?? []).length} {copy.warning}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3">{r.is_active ? copy.yes : copy.no}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 ? (
          <div className="mt-4 flex justify-end">
            <TablePagination page={page} totalPages={totalPages} disabled={loading} onPageChange={setPage} />
          </div>
        ) : null}

        <DeleteAlertDialog
          open={deleteOpen}
          onOpenChange={(nextOpen) => {
            setDeleteOpen(nextOpen)
          }}
          title={copy.delete}
          description={
            selectedIds.length > 1
              ? `${selectedIds.length} ta retsept o'chirilsinmi?`
              : "Tanlangan retsept o'chirilsinmi?"
          }
          loading={deleting}
          onConfirm={() => void deleteSelectedRecipes()}
        />
      </div>

      {detailOpen ? (
        <Portal>
          <div
            className="fixed inset-0 z-[1000] bg-[rgba(15,23,42,0.42)] backdrop-blur-[2px]"
            onClick={closeRecipeModal}
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="max-h-[92vh] w-full max-w-[1280px] overflow-y-auto rounded-[28px] border border-[#d7e3f7] bg-white p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.45)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">{copy.detailTitle}</div>
                    <div className="mt-2 text-2xl font-bold text-[#16325c]">
                      {detailRecipe?.product_name || "-"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-slate-300"
                    onClick={closeRecipeModal}
                  >
                    {copy.close}
                  </Button>
                </div>

                {detailLoading ? (
                  <div className="py-10 text-center text-slate-500">{copy.loading}</div>
                ) : detailRecipe ? (
                  <RecipeEditorForm
                    products={products}
                    materials={materials}
                    selectedProduct={detailRecipe.product}
                    version={String(detailRecipe.version)}
                    items={detailItems}
                    duplicateIds={duplicateIds}
                    readonly={detailRecipe.is_active}
                    productLocked
                    showVersionInput={false}
                    error={detailError}
                    saving={detailSaving}
                    primaryLabel={detailRecipe.is_active ? copy.close : (copy as any).save ?? "Save"}
                    onAddRow={addDetailRow}
                    onRemoveRow={removeDetailRow}
                    onUpdateItem={updateDetailItem}
                    onSubmit={() => {
                      if (detailRecipe.is_active) {
                        closeRecipeModal()
                        return
                      }
                      void saveRecipeDetail()
                    }}
                    onCancel={closeRecipeModal}
                    onSecondaryAction={detailRecipe.is_active ? undefined : activateRecipeDetail}
                    secondaryLabel={detailRecipe.is_active ? undefined : copy.activate}
                    footerNote={detailRecipe.is_active ? copy.activeReadonly : copy.detailTitle}
                  />
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {detailError || copy.detailLoadError}
                  </div>
                )}

              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  )
}
