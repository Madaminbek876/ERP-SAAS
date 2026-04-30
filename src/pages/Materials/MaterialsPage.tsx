import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Trash2 } from "lucide-react"
import TablePagination from "@/components/common/TablePagination"
import {
  extractMaterialApiErrorMessage,
  materialsApi,
  type Material,
  type MaterialCreatePayload,
  type MaterialUpdatePayload,
} from "@/pages/Materials/api/materialsApi"
import { MaterialFormDialog } from "./MaterialFormDialog"
import { DeleteConfirmDialog } from "./DeleteConfirmDialog"
import { useI18n } from "@/i18n"
import { dictsApi, type MaterialTypeRow } from "@/pages/Settings/Api/dictsApi"
import { fetchOnHand } from "@/Api/warehouse"
import { formatNumberWithSpaces } from "@/lib/numberFormat"

export default function MaterialsPage() {
  const { language } = useI18n()
  const [rows, setRows] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeRow[]>([])
  const [materialTypeId, setMaterialTypeId] = useState("ALL")
  const [ordering, setOrdering] = useState<"name" | "-name" | "-created_at">("-created_at")
  const [page, setPage] = useState(1)
  const [stockByMaterialId, setStockByMaterialId] = useState<Record<number, number>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<Material | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const copy =
    language === "ru"
      ? {
        title: "Материалы",
        add: "Добавить",
        search: "Поиск...",
        newest: "Сначала новые",
        nameAz: "Имя A-Z",
        nameZa: "Имя Z-A",
        genericError: "Произошла ошибка",
        detailError: "Не удалось загрузить детали материала",
        id: "ID",
        name: "Название",
        type: "Материальная группа",
        uom: "Ед. изм.",
        price: "Стандартная закупочная цена",
        currency: "Валюта",
        actions: "Действия",
        loading: "Загрузка...",
        empty: "Нет данных",
        edit: "Редактировать",
        delete: "Удалить",
        deleteTitle: "Материал будет удален",
        deleteDescription: "{{name}} (ID: {{id}}) удалить?",
        deleteFallback: "Удалить?",
      }
      : language === "en"
        ? {
          title: "Materials",
          add: "Add",
          search: "Search...",
          newest: "Newest first",
          nameAz: "Name A-Z",
          nameZa: "Name Z-A",
          genericError: "Something went wrong",
          detailError: "Failed to load material details",
          id: "ID",
          name: "Name",
          type: "Material group",
          uom: "UOM",
          price: "Default purchase price",
          currency: "Currency",
          actions: "Actions",
          loading: "Loading...",
          empty: "No data",
          edit: "Edit",
          delete: "Delete",
          deleteTitle: "Material will be deleted",
          deleteDescription: "Delete {{name}} (ID: {{id}})?",
          deleteFallback: "Delete?",
        }
        : {
          title: "Materiallar",
          add: "Qo'shish",
          search: "Qidirish...",
          newest: "Yangi avval",
          nameAz: "Nomi A-Z",
          nameZa: "Nomi Z-A",
          genericError: "Xatolik yuz berdi",
          detailError: "Material detail yuklanmadi",
          id: "ID",
          name: "Nomi",
          type: "Material guruhi",
          uom: "O'lchov birligi",
          price: "Standart xarid narxi",
          currency: "Valyuta",
          actions: "Amallar",
          loading: "Yuklanmoqda...",
          empty: "Ma'lumot yo'q",
          edit: "Tahrirlash",
          delete: "O'chirish",
          deleteTitle: "Material o'chiriladi",
          deleteDescription: "{{name}} (ID: {{id}}) o'chirilsinmi?",
          deleteFallback: "O'chirilsinmi?",
        }
  const materialTypeFilterLabel =
    language === "ru"
      ? "\u0412\u0441\u0435 \u0433\u0440\u0443\u043f\u043f\u044b \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432"
      : language === "en"
        ? "All material groups"
        : "Barcha material guruhlari"
  const barcodeLabel = language === "ru" ? "Штрих-код" : language === "en" ? "Barcode" : "Shtrix kod"
  const stockLabel = language === "ru" ? "Остаток" : language === "en" ? "Stock" : "Qoldiq"

  const pageSize = 10
  const selectedMaterialTypeName = useMemo(
    () => materialTypes.find((materialType) => String(materialType.id) === materialTypeId)?.name ?? null,
    [materialTypeId, materialTypes]
  )
  const orderingLabel = ordering === "name" ? copy.nameAz : ordering === "-name" ? copy.nameZa : copy.newest
  const filteredRows = useMemo(() => {
    if (materialTypeId === "ALL") return rows

    const normalizedSelectedType = normalizeLookupName(selectedMaterialTypeName)
    return rows.filter((row) => {
      if (row.material_type !== null && String(row.material_type) === materialTypeId) return true
      return normalizedSelectedType.length > 0 && normalizeLookupName(row.material_type_name) === normalizedSelectedType
    })
  }, [rows, materialTypeId, selectedMaterialTypeName])
  const count = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page])
  const allPageSelected = pagedRows.length > 0 && pagedRows.every((row) => selectedIds.includes(row.id))

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [{ rows }, onHandRows] = await Promise.all([
        materialsApi.listAll({
          search: search.trim() || undefined,
          ordering,
        }),
        fetchOnHand({ item_type: "RAW_MATERIAL" }).catch(() => []),
      ])

      const nextStockMap: Record<number, number> = {}
      for (const row of onHandRows) {
        const materialId = Number(row.raw_material_id ?? 0)
        if (!materialId) continue
        const qty = Number(row.qty_onhand ?? 0)
        nextStockMap[materialId] = (nextStockMap[materialId] ?? 0) + (Number.isFinite(qty) ? qty : 0)
      }

      setRows(rows)
      setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)))
      setStockByMaterialId(nextStockMap)
    } catch (e: any) {
      setError(extractMaterialApiErrorMessage(e, copy.genericError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [ordering, search])

  useEffect(() => {
    void dictsApi
      .listMaterialTypes()
      .then(setMaterialTypes)
      .catch(() => setMaterialTypes([]))
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, materialTypeId, ordering])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  async function openEdit(material: Material) {
    setSelected(material)
    setEditOpen(true)
    setError(null)
    try {
      const detail = await materialsApi.detail(material.id)
      setSelected((current) => (current?.id === material.id ? detail : current))
    } catch (e: any) {
      setError(extractMaterialApiErrorMessage(e, copy.detailError))
    }
  }

  async function onCreate(payload: MaterialCreatePayload) {
    setSaving(true)
    setError(null)
    try {
      await materialsApi.create(payload)
      await load()
      setCreateOpen(false)
    } catch (e: any) {
      setError(extractMaterialApiErrorMessage(e, copy.genericError))
    } finally {
      setSaving(false)
    }
  }

  async function onEdit(payload: MaterialUpdatePayload) {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await materialsApi.update(selected.id, payload)
      await load()
      setEditOpen(false)
      setSelected(null)
    } catch (e: any) {
      setError(extractMaterialApiErrorMessage(e, copy.genericError))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    setDeleting(true)
    setError(null)
    try {
      if (selectedIds.length > 0) {
        await Promise.all(selectedIds.map((id) => materialsApi.remove(id)))
        setSelectedIds([])
      } else {
        if (!selected) return
        await materialsApi.remove(selected.id)
      }
      await load()
      setDeleteOpen(false)
      setSelected(null)
    } catch (e: any) {
      setError(extractMaterialApiErrorMessage(e, copy.genericError))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">{copy.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setDeleteOpen(true)}
            disabled={selectedIds.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" /> {copy.delete}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {copy.add}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="border-b border-gray-300 pl-8 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} />
        </div>

        <Select value={materialTypeId} onValueChange={setMaterialTypeId}>
          <SelectTrigger className="min-w-[220px] cursor-pointer rounded-[18px]">
            <SelectValue placeholder={materialTypeFilterLabel}>{materialTypeFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="ALL">{materialTypeFilterLabel}</SelectItem>
            {materialTypes.map((materialType) => (
              <SelectItem key={materialType.id} value={String(materialType.id)}>
                {materialType.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ordering} onValueChange={(value) => setOrdering(value as typeof ordering)}>
          <SelectTrigger className="min-w-[170px] cursor-pointer rounded-[18px]">
            <SelectValue placeholder={orderingLabel}>{orderingLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="-created_at">{copy.newest}</SelectItem>
            <SelectItem value="name">{copy.nameAz}</SelectItem>
            <SelectItem value="-name">{copy.nameZa}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? <div className="rounded-md border p-3 text-sm text-red-500">{error}</div> : null}

      <div className="materials-table-no-select overflow-x-auto rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1520px] w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[64px]" />
            <col className="w-[280px]" />
            <col className="w-[180px]" />
            <col className="w-[420px]" />
            <col className="w-[160px]" />
            <col className="w-[140px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
          </colgroup>

          <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
            <tr>
              <th className="relative px-4 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds((prev) => Array.from(new Set([...prev, ...pagedRows.map((row) => row.id)])))
                    } else {
                      setSelectedIds((prev) => prev.filter((id) => !pagedRows.some((row) => row.id === id)))
                    }
                  }}
                />
              </th>
              <th className="relative px-6 py-5 font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-[''] text-white">{copy.name}</th>
              <th className="relative px-6 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{barcodeLabel}</th>
              <th className="relative px-6 py-5 font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{copy.type}</th>
              <th className="relative px-6 py-5 font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{copy.uom}</th>
              <th className="relative px-6 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{copy.price}</th>
              <th className="relative px-6 py-5 text-center font-bold after:absolute after:bottom-4 after:right-0 after:top-4 after:w-px after:bg-slate-200 after:content-['']">{stockLabel}</th>
              <th className="px-6 py-5 text-center font-bold">{copy.currency}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-slate-900">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-500">{copy.loading}</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-500">{copy.empty}</td>
              </tr>
            ) : (
              pagedRows.map((m) => (
                <tr
                  key={m.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => {
                    void openEdit(m)
                  }}
                >
                  <td className="px-4 py-6 text-center align-top" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) => (e.target.checked ? Array.from(new Set([...prev, m.id])) : prev.filter((id) => id !== m.id)))
                      }}
                    />
                  </td>
                  <td className="px-6 py-6 align-top font-semibold">
                    <button
                      type="button"
                      draggable={false}
                      className="material-name-button block select-none bg-transparent px-0 text-left leading-8 text-[15px] font-semibold text-[#43506b] outline-none hover:text-[#43506b]"
                      onMouseDown={(event) => {
                        event.preventDefault()
                      }}
                      onDragStart={(event) => {
                        event.preventDefault()
                      }}
                      onClick={() => {
                        void openEdit(m)
                      }}
                    >
                      {m.name}
                    </button>
                  </td>
                  <td className="px-6 py-6 text-center align-top whitespace-nowrap font-mono text-xs text-slate-600">{m.barcode || "-"}</td>
                  <td className="px-6 py-6 align-top break-words whitespace-normal leading-7 text-slate-700">{m.material_type_name ?? m.material_type ?? "-"}</td>
                  <td className="px-6 py-6 align-top whitespace-nowrap text-slate-700">{m.uom_name ?? m.uom}</td>
                  <td className="px-6 py-6 text-center align-top whitespace-nowrap font-medium">{m.purchase_price == null ? "-" : formatNumberWithSpaces(m.purchase_price)}</td>
                  <td className="px-6 py-6 text-center align-top whitespace-nowrap">{formatQty(stockByMaterialId[m.id] ?? null)}</td>
                  <td className="px-6 py-6 text-center align-top whitespace-nowrap">{m.currency || "UZS"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filteredRows.length > 0 ? (
        <div className="flex justify-end">
          <TablePagination page={page} totalPages={totalPages} disabled={loading} onPageChange={setPage} />
        </div>
      ) : null}

      <MaterialFormDialog open={createOpen} mode="create" loading={saving} onClose={() => setCreateOpen(false)} onSubmit={onCreate} />

      {selected ? (
        <MaterialFormDialog
          open={editOpen}
          mode="edit"
          initial={selected}
          loading={saving}
          onClose={() => {
            setEditOpen(false)
            setSelected(null)
          }}
          onSubmit={onEdit}
        />
      ) : null}

      <DeleteConfirmDialog
        open={deleteOpen}
        loading={deleting}
        title={copy.deleteTitle}
        description={
          selectedIds.length > 0
            ? language === "ru"
              ? `${selectedIds.length} материалов удалить?`
              : language === "en"
                ? `Delete ${selectedIds.length} materials?`
                : `${selectedIds.length} ta material o'chirilsinmi?`
            : selected
              ? copy.deleteDescription.replace("{{name}}", selected.name).replace("{{id}}", String(selected.id))
              : copy.deleteFallback
        }
        onClose={() => {
          setDeleteOpen(false)
          setSelected(null)
        }}
        onConfirm={onDelete}
      />
    </div>
  )
}

function formatQty(value: number | null | undefined): string {
  if (value == null) return "-"
  const formatted = formatNumberWithSpaces(value)
  return formatted || "-"
}

function normalizeLookupName(value?: string | null): string {
  return String(value ?? "").trim().toLocaleLowerCase()
}
