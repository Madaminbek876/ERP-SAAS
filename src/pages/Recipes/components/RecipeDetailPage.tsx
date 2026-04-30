import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import { extractRecipeApiErrorMessage, recipesApi, type RecipeDetail, type RecipePayload } from "@/pages/Recipes/api/recipesApi"
import { materialsApi, type Material } from "@/pages/Materials/api/materialsApi"
import { Button } from "@/components/ui/button"
import { productsApi, type Product } from "@/pages/catalog/api/ProductsApi"
import RecipeEditorForm from "@/pages/Recipes/components/RecipeEditorForm"
import { useI18n } from "@/i18n"

export default function RecipeDetailPage() {
  const { language } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { id } = useParams()
  const recipeId = Number(id)
  const recipesBasePath = pathname.startsWith("/dashboard/production/recipes") ? "/dashboard/production/recipes" : "/dashboard/catalog/recipes"
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [items, setItems] = useState<RecipeDetail["items"]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy =
    language === "ru"
      ? {
          loadError: "Данные рецепта не загрузились",
          needOne: "Нужен минимум 1 материал",
          chooseEach: "Выберите материал в каждой строке",
          qty: "qty_per_unit должен быть больше 0",
          duplicates: "Не вводите один и тот же материал дважды",
          activeReadonly: "Активный рецепт не редактируется. Создайте новую версию.",
          updated: "Рецепт обновлен",
          saveError: "Не удалось сохранить рецепт",
          activated: "Рецепт активирован",
          activateError: "Не удалось активировать рецепт",
          deleted: "Рецепт удален",
          deleteError: "Не удалось удалить рецепт",
          loading: "Загрузка...",
          notFound: "Рецепт не найден.",
          title: "Технологическая операция #{{id}}",
          forProduct: "Для {{product}} версия {{version}}",
          active: "Активный рецепт",
          draft: "Черновой рецепт",
          note: "Сохранение рецепта не добавляет остаток на склад. Продукт поступает только после завершения batch.",
          save: "Сохранить",
          activate: "Активировать",
          footerActive: "Активный рецепт не редактируется. Создайте новую версию или только просматривайте.",
          footerDraft: "Черновой рецепт можно обновить на этой странице, затем активировать.",
          delete: "Удалить",
          productFallback: "Продукт",
        }
      : language === "en"
        ? {
            loadError: "Failed to load recipe details",
            needOne: "At least 1 material is required",
            chooseEach: "Select a material in each row",
            qty: "qty_per_unit must be greater than 0",
            duplicates: "Do not enter the same material twice",
            activeReadonly: "Active recipe cannot be edited. Create a new version.",
            updated: "Recipe updated",
            saveError: "Failed to save recipe",
            activated: "Recipe activated",
            activateError: "Failed to activate recipe",
            deleted: "Recipe deleted",
            deleteError: "Failed to delete recipe",
            loading: "Loading...",
            notFound: "Recipe not found.",
            title: "Technological operation #{{id}}",
            forProduct: "For {{product}} version {{version}}",
            active: "Active recipe",
            draft: "Draft recipe",
            note: "Saving a recipe does not add stock to warehouse. Product is received only after batch completion.",
            save: "Save",
            activate: "Activate",
            footerActive: "Active recipe cannot be edited. Create a new version or keep it read-only.",
            footerDraft: "Draft recipe can be updated on this page and then activated.",
            delete: "Delete",
            productFallback: "Product",
          }
        : {
            loadError: "Retsept ma'lumotlari yuklanmadi",
            needOne: "Kamida 1 ta material kerak",
            chooseEach: "Har bir qatorda material tanlang",
            qty: "qty_per_unit 0 dan katta bo'lishi kerak",
            duplicates: "Bir xil material 2 marta kiritilmasin",
            activeReadonly: "Active recipe tahrirlanmaydi. Yangi versiya yarating.",
            updated: "Retsept yangilandi",
            saveError: "Retseptni saqlab bo'lmadi",
            activated: "Retsept aktiv qilindi",
            activateError: "Retseptni aktiv qilib bo'lmadi",
            deleted: "Retsept o'chirildi",
            deleteError: "Retseptni o'chirib bo'lmadi",
            loading: "Yuklanmoqda...",
            notFound: "Recipe topilmadi.",
            title: "Texnologik operatsiya #{{id}}",
            forProduct: "{{product}} uchun versiya {{version}}",
            active: "Faol retsept",
            draft: "Draft retsept",
            note: "Retsept saqlanishi omborga qoldiq kiritmaydi. Omborga mahsulot faqat ishlab chiqarish batchi yakunlanganda tushadi.",
            save: "Saqlash",
            activate: "Aktiv qilish",
            footerActive: "Faol retsept tahrirlanmaydi. Yangi versiya yarating yoki faqat ko'ring.",
            footerDraft: "Draft retseptni shu sahifada yangilab, keyin aktiv qilishingiz mumkin.",
            delete: "O'chirish",
            productFallback: "Mahsulot",
          }

  const duplicateIds = useMemo(() => {
    const seen = new Set<number>()
    const dup = new Set<number>()
    items.forEach((it) => {
      if (!it.raw_material) return
      if (seen.has(it.raw_material)) dup.add(it.raw_material)
      seen.add(it.raw_material)
    })
    return dup
  }, [items])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await recipesApi.read(recipeId)
      setRecipe(data)
      setItems(data.items || [])
      const [{ rows: materialRows }, { rows: productRows }] = await Promise.all([
        materialsApi.listAll(),
        productsApi.listAll(),
      ])
      setMaterials(materialRows)
      setProducts(productRows)
    } catch (e: any) {
      setError(extractRecipeApiErrorMessage(e, copy.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (recipeId) void load() }, [recipeId])
  function addRow() { setItems((prev) => [...prev, { raw_material: 0, qty_per_unit: "1.000000" }]) }
  function removeRow(index: number) { setItems((prev) => prev.filter((_, i) => i !== index)) }
  function updateItem(index: number, field: "raw_material" | "qty_per_unit", value: number | string) { setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))) }
  function validateItems() {
    if (items.length === 0) return copy.needOne
    for (const it of items) {
      if (!it.raw_material) return copy.chooseEach
      const qty = Number(it.qty_per_unit)
      if (!Number.isFinite(qty) || qty <= 0) return copy.qty
    }
    if (duplicateIds.size > 0) return copy.duplicates
    return null
  }
  async function save() {
    if (!recipe) return
    if (recipe.is_active) return setError(copy.activeReadonly)
    const msg = validateItems()
    if (msg) return setError(msg)
    setSaving(true)
    setError(null)
    const payload: RecipePayload = {
      name: recipe.name ?? recipe.product_name ?? `${copy.productFallback} #${recipe.product}`,
      version: recipe.version,
      items: items.map((i) => ({ raw_material: Number(i.raw_material), qty_per_unit: String(i.qty_per_unit) })),
    }
    try {
      await recipesApi.update(recipe.id, payload)
      await load()
      toast.success(copy.updated)
    } catch (e: any) {
      setError(extractRecipeApiErrorMessage(e, copy.saveError))
    } finally { setSaving(false) }
  }
  async function activate() {
    if (!recipe) return
    try {
      await recipesApi.activate(recipe.id)
      await load()
      toast.success(copy.activated)
    } catch (e: any) { setError(extractRecipeApiErrorMessage(e, copy.activateError)) }
  }
  async function remove() {
    if (!recipe) return
    try {
      await recipesApi.remove(recipe.id)
      toast.success(copy.deleted)
      navigate(recipesBasePath)
    } catch (e: any) { setError(extractRecipeApiErrorMessage(e, copy.deleteError)) }
  }

  if (loading) return <div className="p-6">{copy.loading}</div>
  if (!recipe) return <div className="space-y-4 p-6">{error ? <div className="rounded border border-red-300 p-3 text-sm text-red-600">{error}</div> : null}<div className="text-sm text-slate-600">{copy.notFound}</div></div>

  const readonly = recipe.is_active

  return (
    <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-normal text-slate-950">{copy.title.replace("{{id}}", String(recipe.id))}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.forProduct.replace("{{product}}", recipe.product_name ?? `${copy.productFallback} #${recipe.product}`).replace("{{version}}", String(recipe.version))}</p>
        </div>
        <div className="border border-slate-300 bg-[#f6f6f6] px-3 py-1 text-xs text-slate-700">{recipe.is_active ? copy.active : copy.draft}</div>
      </div>

      <div className="mb-4 rounded-[10px] border border-[#d7e3f7] bg-[#f8fbff] p-3 text-sm text-[#24406b]">{copy.note}</div>
      {(recipe.cost_warnings ?? []).length > 0 ? <div className="mb-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{(recipe.cost_warnings ?? []).join(" | ")}</div> : null}

      <RecipeEditorForm
        products={products}
        materials={materials}
        selectedProduct={recipe.product}
        version={String(recipe.version)}
        items={items}
        duplicateIds={duplicateIds}
        readonly={readonly}
        productLocked
        showVersionInput={false}
        error={error}
        saving={saving}
        primaryLabel={copy.save}
        onAddRow={addRow}
        onRemoveRow={removeRow}
        onUpdateItem={updateItem}
        onSubmit={save}
        onCancel={() => navigate(recipesBasePath)}
        onSecondaryAction={!recipe.is_active ? activate : undefined}
        secondaryLabel={!recipe.is_active ? copy.activate : undefined}
        footerNote={recipe.is_active ? copy.footerActive : copy.footerDraft}
      />

      <div className="mt-3 flex justify-end">
        <Button variant="destructive" onClick={remove}>{copy.delete}</Button>
      </div>
    </div>
  )
}
