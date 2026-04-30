import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { productsApi, type Product } from "@/pages/catalog/api/ProductsApi"
import { materialsApi, type Material } from "@/pages/Materials/api/materialsApi"
import { extractRecipeApiErrorMessage, recipesApi, type RecipeItemDetail, type RecipePayload } from "@/pages/Recipes/api/recipesApi"
import RecipeEditorForm from "@/pages/Recipes/components/RecipeEditorForm"
import { useI18n } from "@/i18n"

function createInitialItems(): RecipeItemDetail[] {
  return [{ raw_material: 0, qty_per_unit: "" }]
}

export default function RecipeCreatePage() {
  const { language } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const recipesBasePath = pathname.startsWith("/dashboard/production/recipes") ? "/dashboard/production/recipes" : "/dashboard/catalog/recipes"
  const [products, setProducts] = useState<Product[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedProduct, setSelectedProduct] = useState<number>(0)
  const [version, setVersion] = useState("")
  const [items, setItems] = useState<RecipeItemDetail[]>(createInitialItems)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy =
    language === "ru"
      ? {
          loadError: "Данные не загрузились",
          needOne: "Нужен минимум 1 вид сырья",
          chooseEach: "Выберите сырье в каждой строке",
          qty: "Расход должен быть больше 0",
          duplicates: "Не вводите одно и то же сырье дважды",
          chooseProduct: "Выберите продукт",
          created: "Рецепт создан",
          saveError: "Endpoint сохранения рецепта не найден или backend не принял запрос",
          loading: "Загрузка...",
          badge: "Создание рецепта",
          title: "Новая технологическая операция",
          subtitle: "Данные о продукте и сырье берутся из вашего backend.",
          pageTitle: "Страница нового рецепта",
          note: "Сохранение рецепта не добавляет остаток на склад. Продукт поступает на склад только после завершения production batch.",
          back: "Назад к списку рецептов",
          save: "Сохранить рецепт",
          footer: "При сохранении используется текущий backend create endpoint. API не менялся.",
        }
      : language === "en"
        ? {
            loadError: "Failed to load data",
            needOne: "At least 1 raw material is required",
            chooseEach: "Select a raw material in each row",
            qty: "Consumption must be greater than 0",
            duplicates: "Do not enter the same raw material twice",
            chooseProduct: "Select a product",
            created: "Recipe created",
            saveError: "Recipe save endpoint was not found or the backend rejected the request",
            loading: "Loading...",
            badge: "Create recipe",
            title: "New technological operation",
            subtitle: "Product and material data are loaded from your backend.",
            pageTitle: "New recipe page",
            note: "Saving a recipe does not add stock to the warehouse. Product is received only after production batch completion.",
            back: "Back to recipes list",
            save: "Save recipe",
            footer: "The existing backend create endpoint is used on save. API integration was not changed.",
          }
        : {
            loadError: "Ma'lumotlar yuklanmadi",
            needOne: "Kamida 1 ta xomashyo kerak",
            chooseEach: "Har bir qatorda xomashyo tanlang",
            qty: "Sarf miqdori 0 dan katta bo'lishi kerak",
            duplicates: "Bir xil xomashyo 2 marta kiritilmasin",
            chooseProduct: "Mahsulot tanlang",
            created: "Retsept yaratildi",
            saveError: "Retseptni saqlash endpointi topilmadi yoki backend qabul qilmadi",
            loading: "Yuklanmoqda...",
            badge: "Retsept yaratish",
            title: "Yangi texnologik operatsiya",
            subtitle: "Ko'rinish ERP uslubiga yaqinlashtirildi, lekin mahsulot va xomashyo ma'lumotlari sizning backenddan olinadi.",
            pageTitle: "Yangi retsept sahifasi",
            note: "Retsept saqlanishi omborga qoldiq kiritmaydi. Omborga mahsulot faqat ishlab chiqarish batchi tasdiqlanib yakunlanganda tushadi.",
            back: "Retseptlar ro'yxatiga qaytish",
            save: "Retseptni saqlash",
            footer: "Saqlash bosilganda mavjud backend create endpoint ishlaydi. API ulanishi o'zgartirilmagan.",
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

  const selectedProductRow = useMemo(
    () => products.find((product) => product.id === selectedProduct) ?? null,
    [products, selectedProduct]
  )

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [{ rows: productRows }, { rows: materialRows }] = await Promise.all([
          productsApi.listAll(),
          materialsApi.listAll(),
        ])
        setProducts(productRows)
        setMaterials(materialRows)
      } catch (e: any) {
        setError(extractRecipeApiErrorMessage(e, copy.loadError))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  function addRow() { setItems((prev) => [...prev, { raw_material: 0, qty_per_unit: "" }]) }
  function removeRow(index: number) { setItems((prev) => prev.filter((_, i) => i !== index)) }
  function updateItem(index: number, field: "raw_material" | "qty_per_unit", value: number | string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
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
  async function createRecipe() {
    if (!selectedProduct) return setError(copy.chooseProduct)
    const validationError = validateItems()
    if (validationError) return setError(validationError)
    setSaving(true)
    setError(null)
    const fallbackName = selectedProductRow?.name?.trim() || `Recipe for product #${selectedProduct}`
    const payload: RecipePayload = {
      name: fallbackName,
      items: items.map((item) => ({ raw_material: Number(item.raw_material), qty_per_unit: String(item.qty_per_unit) })),
    }
    try {
      const created = await recipesApi.createForProduct(selectedProduct, payload)
      toast.success(copy.created)
      navigate(`${recipesBasePath}/${created.id}`)
    } catch (e: any) {
      setError(extractRecipeApiErrorMessage(e, copy.saveError))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="rounded-[32px] border border-[#d7e3f7] bg-white p-8 text-[#4b648a]">{copy.loading}</div>

  return (
    <div className="space-y-4 rounded-[28px] border border-[#d7e3f7] bg-white p-6 shadow-[0_20px_60px_rgba(47,111,237,0.08)]">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.24em] text-[#2f6fed]">{copy.badge}</div>
          <h1 className="mt-2 text-[20px] font-normal text-[#16325c]">{copy.title}</h1>
        </div>
      </div>

      <div className="border-t border-[#edf3fc] pt-4">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-[#6a7ea1]">{copy.pageTitle}</div>
          </div>
          <button type="button" className="!rounded-[12px] !border !border-[#1d4ed8] !bg-gradient-to-r !from-[#1d4ed8] !via-[#1e40af] !to-[#1d4ed8] !px-4 !py-2 !text-sm !font-semibold !text-white !shadow-[0_10px_20px_rgba(29,78,216,0.18)] transition hover:!brightness-105" onClick={() => navigate(recipesBasePath)}>
            {copy.back}
          </button>
        </div>

        <RecipeEditorForm
          products={products}
          materials={materials}
          selectedProduct={selectedProduct}
          onProductChange={setSelectedProduct}
          version={version}
          onVersionChange={setVersion}
          items={items}
          duplicateIds={duplicateIds}
          error={error}
          saving={saving}
          primaryLabel={copy.save}
          onAddRow={addRow}
          onRemoveRow={removeRow}
          onUpdateItem={updateItem}
          onSubmit={createRecipe}
          onCancel={() => navigate(recipesBasePath)}
          footerNote=""
        />
      </div>
    </div>
  )
}
