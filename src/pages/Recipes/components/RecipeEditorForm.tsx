import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import type { Product } from "@/pages/catalog/api/ProductsApi"
import type { Material } from "@/pages/Materials/api/materialsApi"
import type { RecipeItemDetail } from "@/pages/Recipes/api/recipesApi"
import WarehouseCatalogPicker from "@/pages/sklad/warehouse/components/WarehouseCatalogPicker"
import { useI18n } from "@/i18n"

type RecipeEditorFormProps = {
  products: Product[]
  materials: Material[]
  selectedProduct: number
  onProductChange?: (value: number) => void
  version: string
  onVersionChange?: (value: string) => void
  items: RecipeItemDetail[]
  duplicateIds: Set<number>
  readonly?: boolean
  productLocked?: boolean
  showVersionInput?: boolean
  error?: string | null
  saving?: boolean
  primaryLabel: string
  onAddRow: () => void
  onRemoveRow: (index: number) => void
  onUpdateItem: (index: number, field: "raw_material" | "qty_per_unit", value: number | string) => void
  onSubmit: () => void
  onCancel?: () => void
  onSecondaryAction?: () => void
  secondaryLabel?: string
  secondaryDisabled?: boolean
  footerNote?: string
}

function formatMoney(value: number, currency = "UZS") {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0)
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0)
}
function fieldClassName() {
  return "h-9 w-full rounded-[10px] border border-[#c7d7ef] bg-[#f8fbff] px-3 text-sm text-[#16325c] outline-none transition focus:border-[#2f6fed] focus:bg-white focus:ring-2 focus:ring-[#dbe7ff]"
}
function primaryButtonClassName() {
  return "!min-w-[120px] !rounded-[12px] !border !border-[#1d4ed8] !bg-gradient-to-r !from-[#1d4ed8] !via-[#1e40af] !to-[#1d4ed8] !px-4 !py-2 !text-left !text-sm !font-semibold !text-white !shadow-[0_10px_22px_rgba(29,78,216,0.22)] transition hover:!brightness-105 disabled:!cursor-not-allowed disabled:!opacity-60"
}
function secondaryButtonClassName() {
  return "!rounded-[12px] !border !border-[#1d4ed8] !bg-gradient-to-r !from-[#1d4ed8] !via-[#1e40af] !to-[#1d4ed8] !px-4 !py-2 !text-sm !font-semibold !text-white !shadow-[0_10px_20px_rgba(29,78,216,0.18)] transition hover:!brightness-105 disabled:!cursor-not-allowed disabled:!opacity-60"
}

export default function RecipeEditorForm(props: RecipeEditorFormProps) {
  const { language } = useI18n()
  const {
    products, materials, selectedProduct, onProductChange, version, onVersionChange, items, duplicateIds,
    readonly = false, productLocked = false, showVersionInput = true, error, saving = false, primaryLabel,
    onAddRow, onRemoveRow, onUpdateItem, onSubmit, onCancel, onSecondaryAction, secondaryLabel, secondaryDisabled = false, footerNote,
  } = props
  const copy =
    language === "ru"
      ? {
          saving: "Сохранение...",
          close: "Закрыть",
          opNo: "Технологическая операция №",
          status: "Статус",
          active: "Активный",
          draft: "Черновик",
          materials: "Материалы",
          warnings: "Предупреждения",
          noProduct: "Продукт не выбран",
          noUnit: "Нет единицы",
          product: "Продукт",
          selectProduct: "Выберите продукт",
          techCard: "Технологическая карта",
          productionSize: "Объем производства",
          version: "Версия",
          versionPlaceholder: "Введите версию",
          materialCost: "Себестоимость материалов",
          warning: "Предупреждение",
          none: "Нет",
          main: "Основное",
          productSection: "Продукт",
          name: "Название",
          qty: "Количество",
          unit: "Единица",
          state: "Состояние",
          ready: "Готово",
          notSelected: "Не выбрано",
          raw: "Сырье",
          addRaw: "Добавить сырье",
          price: "Цена",
          sum: "Сумма",
          action: "Действие",
          noRaw: "Сырье не добавлено",
          duplicate: "Дубликат",
          noPrice: "Нет цены",
          delete: "Удалить",
          note: "Примечание",
          extra: "Доп. расходы",
          total: "Итого",
        }
      : language === "en"
        ? {
            saving: "Saving...",
            close: "Close",
            opNo: "Technological operation No",
            status: "Status",
            active: "Active",
            draft: "Draft",
            materials: "Materials",
            warnings: "Warnings",
            noProduct: "No product selected",
            noUnit: "No unit",
            product: "Product",
            selectProduct: "Select product",
            techCard: "Tech card",
            productionSize: "Production size",
            version: "Version",
            versionPlaceholder: "Enter version",
            materialCost: "Material cost",
            warning: "Warning",
            none: "None",
            main: "Main",
            productSection: "Product",
            name: "Name",
            qty: "Qty",
            unit: "Unit",
            state: "State",
            ready: "Ready",
            notSelected: "Not selected",
            raw: "Raw materials",
            addRaw: "Add raw material",
            price: "Price",
            sum: "Amount",
            action: "Action",
            noRaw: "No raw materials added",
            duplicate: "Duplicate",
            noPrice: "No price",
            delete: "Delete",
            note: "Note",
            extra: "Extra cost",
            total: "Total",
          }
        : {
            saving: "Saqlanmoqda...",
            close: "Yopish",
            opNo: "Texnologik operatsiya No",
            status: "Holat",
            active: "Faol",
            draft: "Draft",
            materials: "Materiallar",
            warnings: "Ogohlantirish",
            noProduct: "Mahsulot tanlanmagan",
            noUnit: "Birlik yo'q",
            product: "Mahsulot",
            selectProduct: "Mahsulot tanlang",
            techCard: "Texnologik karta",
            productionSize: "Ishlab chiqarish hajmi",
            version: "Versiya",
            versionPlaceholder: "Versiya kiriting",
            materialCost: "Material tannarxi",
            warning: "Ogohlantirish",
            none: "Yo'q",
            main: "Asosiy",
            productSection: "Mahsulot",
            name: "Nomi",
            qty: "Miqdor",
            unit: "Birlik",
            state: "Holat",
            ready: "Tayyor",
            notSelected: "Tanlanmagan",
            raw: "Xomashyo",
            addRaw: "Xomashyo qo'shish",
            price: "Narx",
            sum: "Summa",
            action: "Amal",
            noRaw: "Xomashyo qo'shilmagan",
            duplicate: "Dublikat",
            noPrice: "Narx yo'q",
            delete: "O'chirish",
            note: "Izoh",
            extra: "Qo'shimcha xarajat",
            total: "Jami",
          }

  const selectedProductRow = useMemo(() => products.find((product) => product.id === selectedProduct) ?? null, [products, selectedProduct])
  const enrichedItems = useMemo(() => items.map((item, index) => {
    const material = materials.find((entry) => entry.id === item.raw_material) ?? null
    const qty = Number(item.qty_per_unit)
    const price = Number(material?.default_purchase_price ?? item.default_purchase_price ?? 0)
    const currency = material?.currency ?? item.currency ?? "UZS"
    const lineCost = item.line_material_cost_estimate ?? (Number.isFinite(qty) && qty > 0 ? qty * price : 0)
    return { ...item, index, material, qty: Number.isFinite(qty) ? qty : 0, currency, lineCost, hasWarning: !material || !material.default_purchase_price || duplicateIds.has(item.raw_material) }
  }), [duplicateIds, items, materials])
  const totalItems = enrichedItems.filter((item) => item.raw_material > 0).length
  const estimatedCost = enrichedItems.reduce((sum, item) => sum + (Number.isFinite(item.lineCost) ? item.lineCost : 0), 0)
  const warningCount = enrichedItems.filter((item) => item.hasWarning).length

  return (
    <div className="space-y-5 bg-white text-slate-900">
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[#d7e3f7] bg-[#f8fbff] px-4 py-3">
        <button type="button" className={primaryButtonClassName()} onClick={onSubmit} disabled={saving || readonly}>{saving ? copy.saving : primaryLabel}</button>
        {onCancel ? <button type="button" className={secondaryButtonClassName()} onClick={onCancel}>{copy.close}</button> : null}
        {secondaryLabel && onSecondaryAction ? <button type="button" className={secondaryButtonClassName()} onClick={onSecondaryAction} disabled={secondaryDisabled}>{secondaryLabel}</button> : null}
      </div>

      <div className="rounded-[18px] border border-[#d9e6fb] bg-[linear-gradient(180deg,#fafdff_0%,#f3f8ff_100%)] px-5 py-5 shadow-[0_12px_30px_rgba(47,111,237,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[18px] font-semibold text-[#16325c]">{copy.opNo} <span className="inline-block min-w-[42px] rounded-[8px] border border-[#bfd3f5] bg-white px-2 py-1 text-center text-[#2f6fed]">{version || "-"}</span></div>
            <div className="mt-2 text-xs font-medium text-[#5b7196]">{copy.status}: {readonly ? copy.active : copy.draft} | {copy.materials}: {totalItems} | {copy.warnings}: {warningCount}</div>
          </div>
          <div className="rounded-[14px] border border-[#d7e3f7] bg-white px-4 py-3 text-right text-sm shadow-sm">
            <div className="font-medium text-[#16325c]">{selectedProductRow?.name ?? copy.noProduct}</div>
            <div className="text-xs text-[#6a7ea1]">{selectedProductRow?.uom_name ?? copy.noUnit}</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="space-y-3 rounded-[14px] border border-[#dbe6f7] bg-white/90 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">{copy.productSection}</div>
            <div className="grid grid-cols-[170px_minmax(0,1fr)] items-center gap-3">
              <label className="text-sm font-medium text-[#24406b]">{copy.product}</label>
              <WarehouseCatalogPicker
                kind="PRODUCTS"
                products={products}
                materials={[]}
                selectedId={selectedProduct ? String(selectedProduct) : ""}
                mode="overlay"
                size="compact"
                disabled={readonly || productLocked}
                onSelect={(value) => onProductChange?.(value ? Number(value) : 0)}
              />
            </div>
            <div className="grid grid-cols-[170px_minmax(0,1fr)] items-center gap-3">
              <label className="text-sm font-medium text-[#24406b]">{copy.techCard}</label>
              <input className={fieldClassName()} value={selectedProductRow?.category_name ?? ""} readOnly />
            </div>
            <div className="grid grid-cols-[170px_minmax(0,1fr)] items-center gap-3">
              <label className="text-sm font-medium text-[#24406b]">{copy.productionSize}</label>
              <input className={`${fieldClassName()} max-w-[140px]`} value={formatNumber(1)} readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="relative py-1">
        <div className="border-t border-[#c7d7ef]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#bfd3f5] bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
          {copy.main}
        </div>
      </div>
      {error ? <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <section className="space-y-3 rounded-[18px] border border-[#d7e3f7] bg-white px-4 py-4">
        <h3 className="text-[18px] font-medium text-[#2f6fed]">{copy.productSection}</h3>
        <div className="border-b border-[#d7e3f7] pb-2"><div className="grid grid-cols-[minmax(280px,1fr)_120px_140px_140px] gap-4 px-1 text-sm font-medium text-[#4b648a]"><div>{copy.name}</div><div>{copy.qty}</div><div>{copy.unit}</div><div>{copy.state}</div></div></div>
        <div className="grid grid-cols-[minmax(280px,1fr)_120px_140px_140px] gap-4 rounded-[10px] border border-[#e4ecf8] bg-[#fbfdff] px-3 py-3 text-sm"><div>{selectedProductRow?.name ?? copy.noProduct}</div><div>1</div><div>{selectedProductRow?.uom_name ?? "-"}</div><div>{selectedProductRow ? copy.ready : copy.notSelected}</div></div>
      </section>

      <section className="space-y-3 rounded-[18px] border border-[#d7e3f7] bg-white px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[18px] font-medium text-[#2f6fed]">{copy.raw}</h3>
          {!readonly ? <button type="button" className={secondaryButtonClassName()} onClick={onAddRow}>{copy.addRaw}</button> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead><tr className="border-b border-[#d7e3f7] text-left text-[#4b648a]"><th className="px-1 py-2 font-normal">{copy.name}</th><th className="px-1 py-2 font-normal">{copy.qty}</th><th className="px-1 py-2 font-normal">{copy.unit}</th><th className="px-1 py-2 font-normal">{copy.price}</th><th className="px-1 py-2 font-normal">{copy.sum}</th><th className="px-1 py-2 font-normal">{copy.state}</th><th className="px-1 py-2 text-right font-normal">{copy.action}</th></tr></thead>
            <tbody>
              {enrichedItems.length === 0 ? <tr><td colSpan={7} className="px-1 py-5 text-slate-500">{copy.noRaw}</td></tr> : enrichedItems.map((item) => (
                <tr key={`${item.id ?? "row"}-${item.index}`} className="border-b border-[#e7eef8] align-top">
                  <td className="px-1 py-3">
                    <div className="min-w-[360px]">
                      <WarehouseCatalogPicker
                        kind="MATERIALS"
                        products={[]}
                        materials={materials}
                        selectedId={item.raw_material ? String(item.raw_material) : ""}
                        mode="overlay"
                        size="default"
                        disabled={readonly}
                        onSelect={(value) => onUpdateItem(item.index, "raw_material", value ? Number(value) : 0)}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-3"><Input className="h-8 rounded-none border-slate-300 px-2 text-sm" value={item.qty_per_unit} onChange={(e) => onUpdateItem(item.index, "qty_per_unit", e.target.value)} placeholder="0" disabled={readonly} /></td>
                  <td className="px-1 py-3 text-slate-700">{item.material?.uom_name ?? "-"}</td>
                  <td className="px-1 py-3 text-slate-700">{item.material?.default_purchase_price ? formatMoney(Number(item.material.default_purchase_price), item.material.currency) : "-"}</td>
                  <td className="px-1 py-3 text-slate-900">{item.material ? formatMoney(item.lineCost, item.currency) : formatNumber(item.qty)}</td>
                  <td className="px-1 py-3">{duplicateIds.has(item.raw_material) ? <span className="text-rose-600">{copy.duplicate}</span> : !item.material ? <span className="text-slate-500">{copy.notSelected}</span> : !item.material.default_purchase_price ? <span className="text-amber-600">{copy.noPrice}</span> : <span className="text-emerald-700">{copy.ready}</span>}</td>
                  <td className="px-1 py-3 text-right"><button type="button" className="!rounded-[12px] !border !border-[#1d4ed8] !bg-gradient-to-r !from-[#1d4ed8] !via-[#1e40af] !to-[#1d4ed8] !px-3 !py-1 !text-sm !font-semibold !text-white !shadow-[0_10px_20px_rgba(29,78,216,0.18)] transition hover:!brightness-105 disabled:!cursor-not-allowed disabled:!opacity-60" onClick={() => onRemoveRow(item.index)} disabled={readonly}>{copy.delete}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <div className="mb-2 text-sm text-slate-500">{copy.note}</div>
          <textarea className="min-h-[110px] w-full resize-none rounded-[10px] border border-[#c7d7ef] bg-[#f8fbff] p-3 text-sm text-[#24406b] outline-none focus:border-[#2f6fed] focus:bg-white" value={footerNote ?? ""} readOnly />
        </div>
        <div className="space-y-3 pt-1 text-sm">
          <div className="flex items-center justify-between"><span>{copy.materialCost}:</span><span>{formatMoney(estimatedCost)}</span></div>
          <div className="flex items-center justify-between"><span>{copy.extra}:</span><span>0,00 UZS</span></div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 font-medium"><span>{copy.total}:</span><span>{formatMoney(estimatedCost)}</span></div>
        </div>
      </div>
    </div>
  )
}
