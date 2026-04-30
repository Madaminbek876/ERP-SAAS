import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { PurchaseItem } from "../types"
import type { LookupItem } from "@/pages/sklad/warehouse/api/types"
import { useI18n } from "@/i18n"

type ItemDraft = { raw_material: string; qty: string; unit_price: string }

function fmtMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(amount || 0)
}

function fmtQty(value: string | number) {
  const qty = Number(value)
  if (!Number.isFinite(qty)) return String(value)
  return String(Number(qty.toFixed(6))).replace(/\.0+$/, "")
}

export default function PurchaseItemsTable({
  items,
  loading,
  currency,
  canEdit,
  materials,
  onAdd,
  onPatch,
  onDelete,
}: {
  items: PurchaseItem[]
  loading: boolean
  currency?: string
  canEdit: boolean
  materials: LookupItem[]
  onAdd: (payload: { raw_material: number; qty: string; unit_price: number }) => void
  onPatch: (itemId: number, payload: { raw_material?: number; qty?: string; unit_price?: number }) => void
  onDelete: (itemId: number) => void
}) {
  const { language } = useI18n()
  const [create, setCreate] = useState<ItemDraft>({ raw_material: "", qty: "1", unit_price: "0" })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [edit, setEdit] = useState<ItemDraft>({ raw_material: "", qty: "", unit_price: "" })
  const total = items.reduce((s, it) => s + (it.line_total || 0), 0)
  const columnTemplate = canEdit ? ["44%", "14%", "16%", "16%", "10%"] : ["40%", "20%", "20%", "20%"]
  const footerGridTemplate = canEdit ? "44% 14% 16% 16% 10%" : "40% 20% 20% 20%"
  const copy =
    language === "ru"
      ? { title: "Позиции", currency: "Валюта", selectMaterial: "Выберите сырье", qtyPlaceholder: "Кол-во (100.000000)", unitPricePlaceholder: "Цена за единицу", add: "Добавить позицию", materialName: "Название сырья", qty: "Количество", unitPrice: "Цена за единицу", subtotal: "Подытог строки", total: "Итого", actions: "Действия", loading: "Загрузка...", empty: "Позиции отсутствуют", save: "Сохранить", cancel: "Отмена", edit: "Редактировать", delete: "Удалить", totalSum: "Общая сумма" }
      : language === "en"
        ? { title: "Items", currency: "Currency", selectMaterial: "Select raw material", qtyPlaceholder: "Qty (100.000000)", unitPricePlaceholder: "Unit price", add: "Add item", materialName: "Raw material", qty: "Qty", unitPrice: "Unit price", total: "Total", actions: "Actions", loading: "Loading...", empty: "No items", save: "Save", cancel: "Cancel", edit: "Edit", delete: "Delete", totalSum: "line_total_sum" }
        : { title: "Pozitsiyalar", currency: "Valyuta", selectMaterial: "Xomashyoni tanlang", qtyPlaceholder: "Miqdor (100.000000)", unitPricePlaceholder: "Dona narxi", add: "Pozitsiya qo'shish", materialName: "Xomashyo nomi", qty: "Miqdor", unitPrice: "Dona narxi", total: "Jami", actions: "Harakatlar", loading: "Yuklanmoqda...", empty: "Pozitsiyalar yo'q", save: "Saqlash", cancel: "Bekor qilish", edit: "Tahrirlash", delete: "O'chirish", totalSum: "Jami summa" }

  const submitCreate = () => {
    const rawMaterial = Number(create.raw_material)
    const unitPrice = Number(create.unit_price)
    const qty = Number(create.qty)
    if (!Number.isFinite(rawMaterial) || rawMaterial <= 0) return
    if (!Number.isFinite(qty) || qty <= 0) return
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return
    if (!create.qty.trim()) return
    onAdd({ raw_material: rawMaterial, qty: String(qty), unit_price: unitPrice })
    setCreate({ raw_material: "", qty: "1", unit_price: "0" })
  }

  const startEdit = (row: PurchaseItem) => {
    const matchedMaterial = row.raw_material && row.raw_material > 0 ? row.raw_material : materials.find((x) => x.name === row.raw_material_name)?.id
    setEditingId(row.id)
    setEdit({ raw_material: matchedMaterial ? String(matchedMaterial) : "", qty: row.qty, unit_price: String(row.unit_price ?? 0) })
  }

  const submitEdit = () => {
    if (!editingId) return
    const payload: { raw_material?: number; qty?: string; unit_price?: number } = {}
    if (edit.raw_material.trim()) {
      const rawMaterial = Number(edit.raw_material)
      if (Number.isFinite(rawMaterial) && rawMaterial > 0) payload.raw_material = rawMaterial
    }
    if (edit.qty.trim()) {
      const qty = Number(edit.qty)
      if (Number.isFinite(qty) && qty > 0) payload.qty = String(qty)
    }
    if (edit.unit_price.trim()) {
      const unitPrice = Number(edit.unit_price)
      if (Number.isFinite(unitPrice) && unitPrice >= 0) payload.unit_price = unitPrice
    }
    onPatch(editingId, payload)
    setEditingId(null)
  }

  return (
    <div className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4">
        <div className="text-sm font-semibold text-slate-900">{copy.title}</div>
        <div className="text-xs text-slate-500">{copy.currency}: <span className="font-medium">{currency || "UZS"}</span></div>

        {canEdit && (
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-5">
            <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-black shadow-lg" value={create.raw_material} onChange={(e) => setCreate((p) => ({ ...p, raw_material: e.target.value }))}>
              <option value="">{copy.selectMaterial}</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
            <input type="number" min="0.000001" step="0.000001" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-black shadow-lg" placeholder={copy.qtyPlaceholder} value={create.qty} onChange={(e) => setCreate((p) => ({ ...p, qty: e.target.value }))} />
            <input type="number" min="0" step="0.01" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-black shadow-lg" placeholder={copy.unitPricePlaceholder} value={create.unit_price} onChange={(e) => setCreate((p) => ({ ...p, unit_price: e.target.value }))} />
            <div className="md:col-span-2">
              <Button className="cursor-pointer rounded-xl" onClick={submitCreate}>
                + {copy.add}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {columnTemplate.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead className="bg-slate-50 text-slate-600">
            <tr className="font-medium">
              <th className="px-4 py-3 text-left">{copy.materialName}</th>
              <th className="px-4 py-3 text-right">{copy.qty}</th>
              <th className="px-4 py-3 text-right">{copy.unitPrice}</th>
              <th className="px-4 py-3 text-right">{copy.total}</th>
              {canEdit && <th className="px-4 py-3 text-right">{copy.actions}</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-10 text-center text-slate-500">

                  {copy.loading}
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-12 text-center text-slate-500">

                  {copy.empty}
                </td>
              </tr>
            )}

            {!loading &&
              items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {editingId === it.id ? (
                      <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-black shadow-lg" value={edit.raw_material} onChange={(e) => setEdit((p) => ({ ...p, raw_material: e.target.value }))}>
                        <option value="">{copy.selectMaterial}</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      it.raw_material_name
                    )}
                  </td>

                  {editingId === it.id ? (
                    <>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end">
                          <input type="number" min="0.000001" step="0.000001" className="h-9 w-28 rounded-md border px-2 text-right text-sm" value={edit.qty} onChange={(e) => setEdit((p) => ({ ...p, qty: e.target.value }))} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end">
                          <input type="number" min="0" step="0.01" className="h-9 w-28 rounded-md border px-2 text-right text-sm" value={edit.unit_price} onChange={(e) => setEdit((p) => ({ ...p, unit_price: e.target.value }))} />
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtQty(it.qty)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(it.unit_price)}</td>
                    </>
                  )}

                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtMoney(it.line_total)}</td>

                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      {editingId === it.id ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" className="rounded-xl" onClick={submitEdit}>{copy.save}</Button>
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditingId(null)}>{copy.cancel}</Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startEdit(it)}>{copy.edit}</Button>
                          <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => onDelete(it.id)}>{copy.delete}</Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>

          <tfoot>
            <tr className="border-t border-slate-200">
              <td colSpan={canEdit ? 5 : 4} className="px-4 py-3">
                <div
                  className="grid items-center"
                  style={{ gridTemplateColumns: footerGridTemplate }}
                >
                  <div />
                  <div />
                  <div className="text-right font-medium text-slate-600">{copy.totalSum}</div>
                  <div className="text-right font-semibold text-slate-900 tabular-nums">{fmtMoney(total)}</div>
                  {canEdit ? <div /> : null}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
