import { useCallback, useEffect, useState } from "react"
import { toast } from "react-toastify"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import TablePagination from "@/components/common/TablePagination"
import { useClientPagination } from "@/components/common/useClientPagination"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { warehouseApi } from "../api/warehouseApi"
import type { LookupItem } from "../api/types"
import { Plus } from "lucide-react"
import ScrollReveal from "@/components/common/ScrollReveal"
import { useI18n } from "@/i18n"

function localizedWarehouseName(value?: string, language?: string) {
  const raw = String(value || "").trim()
  if (!raw) return "-"
  if (language === "ru") return raw.replace(/^Warehouse\b/i, "Склад")
  if (language === "uz") return raw.replace(/^Warehouse\b/i, "Ombor")
  return raw
}

export default function WarehousesPage() {
  const { language } = useI18n()
  const [warehouses, setWarehouses] = useState<Array<LookupItem & { default_location_id?: number }>>([])
  const [locationOptions, setLocationOptions] = useState<Array<LookupItem & { warehouse_id?: number }>>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [checkedWarehouseIds, setCheckedWarehouseIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [warehouseCreateOpen, setWarehouseCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newWarehouseName, setNewWarehouseName] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editWarehouseId, setEditWarehouseId] = useState<number | null>(null)
  const [editWarehouseName, setEditWarehouseName] = useState("")
  const { page, setPage, totalPages, pagedItems: pagedWarehouses } = useClientPagination(warehouses, 10, [warehouses.length])
  const copy =
    language === "ru"
      ? {
          loadError: "Склады не загрузились",
          enterName: "Введите название склада",
          created: "Склад создан",
          createError: "Ошибка создания склада",
          selectDelete: "Сначала выберите склад для удаления",
          deleted: "складов удалено",
          deleteFailed: "склады не удалось удалить",
          deleteError: "Ошибка удаления склада",
          warehouseMissing: "Склад не найден",
          updated: "Название склада обновлено",
          updateError: "Ошибка обновления склада",
          deleting: "Удаление...",
          delete: "Удалить",
          title: "Склады",
          create: "+ Создать новый склад",
          createTitle: "Создать новый склад",
          namePlaceholder: "Название склада",
          cancel: "Отмена",
          creating: "Создание...",
          createAction: "Создать",
          deleteTitle: "Удаление",
          deleteDescription: "Вы действительно хотите удалить",
          warehousesSuffix: "складов",
          name: "Название",
          selectAll: "выбрать все",
          editName: "Редактировать название",
          empty: "Склады не найдены",
          editTitle: "Редактировать склад",
          saving: "Сохранение...",
          save: "Сохранить",
        }
      : language === "en"
        ? {
            loadError: "Warehouses failed to load",
            enterName: "Enter warehouse name",
            created: "Warehouse created",
            createError: "Create warehouse error",
            selectDelete: "Select a warehouse to delete first",
            deleted: "warehouses deleted",
            deleteFailed: "warehouses could not be deleted",
            deleteError: "Warehouse delete error",
            warehouseMissing: "Warehouse not found",
            updated: "Warehouse name updated",
            updateError: "Warehouse update error",
            deleting: "Deleting...",
            delete: "Delete",
            title: "Warehouses",
            create: "+ Create new warehouse",
            createTitle: "Create new warehouse",
            namePlaceholder: "Warehouse name",
            cancel: "Cancel",
            creating: "Creating...",
            createAction: "Create",
            deleteTitle: "Delete",
            deleteDescription: "Are you sure you want to delete",
            warehousesSuffix: "warehouses",
            name: "Name",
            selectAll: "select all",
            editName: "Edit name",
            empty: "No warehouses found",
            editTitle: "Edit warehouse",
            saving: "Saving...",
            save: "Save",
          }
        : {
            loadError: "Omborlar yuklanmadi",
            enterName: "Ombor nomini kiriting",
            created: "Ombor yaratildi",
            createError: "Ombor yaratishda xatolik",
            selectDelete: "Avval o'chirish uchun ombor tanlang",
            deleted: "ta ombor o'chirildi",
            deleteFailed: "ta omborni o'chirib bo'lmadi",
            deleteError: "Omborni o'chirishda xatolik",
            warehouseMissing: "Ombor topilmadi",
            updated: "Ombor nomi yangilandi",
            updateError: "Omborni yangilashda xatolik",
            deleting: "O'chirilmoqda...",
            delete: "O'chirish",
            title: "Omborlar",
            create: "+ Yangi ombor yaratish",
            createTitle: "Yangi ombor yaratish",
            namePlaceholder: "Ombor nomi",
            cancel: "Bekor qilish",
            creating: "Yaratilmoqda...",
            createAction: "Yaratish",
            deleteTitle: "O'chirish",
            deleteDescription: "Rostdan ham",
            warehousesSuffix: "ta ombor",
            name: "Nomi",
            selectAll: "barchasini tanlash",
            editName: "Nomini tahrirlash",
            empty: "Omborlar topilmadi",
            editTitle: "Omborni tahrirlash",
            saving: "Saqlanmoqda...",
            save: "Saqlash",
          }

  const loadWarehouses = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const list = await warehouseApi.listWarehousesFromLocations()
      setWarehouses(list)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      setError(String(err?.response?.data?.detail || err?.message || copy.loadError))
      setWarehouses([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLocationOptions = useCallback(async () => {
    try {
      const list = await warehouseApi.listWarehouseLocationOptions()
      setLocationOptions(list)
      setSelectedLocationId((prev) =>
        prev && list.some((x) => String(x.id) === prev) ? prev : String(list[0]?.id ?? "")
      )
    } catch {
      setLocationOptions([])
      setSelectedLocationId("")
    }
  }, [])

  useEffect(() => {
    loadWarehouses()
  }, [loadWarehouses])

  useEffect(() => {
    loadLocationOptions()
  }, [loadLocationOptions])

  useEffect(() => {
    setCheckedWarehouseIds((prev) => prev.filter((id) => warehouses.some((w) => String(w.id) === id)))
  }, [warehouses])

  const selectedWarehouseId = String(
    locationOptions.find((x) => String(x.id) === selectedLocationId)?.warehouse_id ?? ""
  )

  const allChecked =
    warehouses.length > 0 && warehouses.every((w) => checkedWarehouseIds.includes(String(w.id)))

  const createWarehouse = async () => {
    try {
      if (!newWarehouseName.trim()) return toast.error(copy.enterName)
      setCreating(true)
      await warehouseApi.createWarehouse({ name: newWarehouseName.trim() })
      toast.success(copy.created)
      setWarehouseCreateOpen(false)
      setNewWarehouseName("")
      await loadWarehouses()
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: unknown }
      const data = err?.response?.data
      const msg =
        typeof data === "string"
          ? data
          : (data as { detail?: unknown })?.detail ||
          (data ? JSON.stringify(data) : err?.message || copy.createError)
      toast.error(String(msg))
    } finally {
      setCreating(false)
    }
  }

  const deleteSelectedWarehouses = async () => {
    if (checkedWarehouseIds.length === 0) {
      toast.error(copy.selectDelete)
      return
    }

    try {
      setDeleting(true)
      const results = await Promise.allSettled(
        checkedWarehouseIds.map((id) => warehouseApi.deleteWarehouse(Number(id)))
      )
      const successCount = results.filter((r) => r.status === "fulfilled").length
      const failCount = results.length - successCount

      if (successCount > 0) toast.success(`${successCount} ${copy.deleted}`)
      if (failCount > 0) toast.error(`${failCount} ${copy.deleteFailed}`)

      setDeleteOpen(false)
      setCheckedWarehouseIds([])
      await loadLocationOptions()
      await loadWarehouses()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      toast.error(String(err?.response?.data?.detail || err?.message || copy.deleteError))
    } finally {
      setDeleting(false)
    }
  }

  const openEditModal = (warehouse: LookupItem) => {
    setEditWarehouseId(Number(warehouse.id))
    setEditWarehouseName(String(warehouse.name || ""))
    setEditOpen(true)
  }

  const updateWarehouseName = async () => {
    if (!editWarehouseId) return toast.error(copy.warehouseMissing)
    if (!editWarehouseName.trim()) return toast.error(copy.enterName)

    try {
      setEditing(true)
      await warehouseApi.updateWarehouse(editWarehouseId, { name: editWarehouseName.trim() })
      toast.success(copy.updated)
      setEditOpen(false)
      await loadLocationOptions()
      await loadWarehouses()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: unknown }
      toast.error(String(err?.response?.data?.detail || err?.message || copy.updateError))
    } finally {
      setEditing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="motion-enter-side-slow flex items-center justify-between">
        <div className="text-xl font-semibold">{copy.title}</div>
        <div className="flex items-center gap-2">
          <Button

            className="border-rose-500 bg-rose-600 !text-white hover:!bg-rose-700"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting || checkedWarehouseIds.length === 0}
          >
            {deleting ? copy.deleting : copy.delete}
          </Button>

          <Dialog open={warehouseCreateOpen} onOpenChange={setWarehouseCreateOpen}>
            <DialogTrigger asChild>
              <Button className="border-0 bg-gradient-to-r from-blue-900 to-blue-700 text-white hover:from-blue-950 hover:to-blue-800">
                {copy.create}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[min(92vw,720px)] max-w-[720px] overflow-hidden rounded-[28px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-0 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)]">
              <DialogHeader className="border-b border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2f6fed]">{language === "uz" ? "OMBOR" : "Warehouse"}</div>
                <DialogTitle className="mt-2 text-[28px] font-semibold text-[#16325c]">{copy.createTitle}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 px-6 py-5">
                <Input
                  className="h-12 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-base text-[#16325c]"
                  placeholder={copy.namePlaceholder}
                  value={newWarehouseName}
                  onChange={(e) => setNewWarehouseName(e.target.value)}
                />
              </div>
              <DialogFooter className="border-t border-[#e4ecf8] bg-white px-6 py-5">
                <Button className="h-11 rounded-xl !border border-[#d7e3f7] bg-white px-5 text-[#24406b]" onClick={() => setWarehouseCreateOpen(false)}>
                  {copy.cancel}
                </Button>
                <Button
                  className="h-11 rounded-xl border-0 bg-gradient-to-r from-blue-900 to-blue-700 px-5 text-white shadow-[0_12px_24px_rgba(29,78,216,0.18)] hover:from-blue-950 hover:to-blue-800"
                  onClick={createWarehouse}
                  disabled={creating}
                >
                  {creating ? copy.creating : copy.createAction}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      <DeleteAlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={copy.deleteTitle}
        description={
          <>
            {copy.deleteDescription} <span className="font-bold text-slate-800">{checkedWarehouseIds.length} {copy.warehousesSuffix}</span> ni o'chirmoqchimisiz?
          </>
        }
        loading={deleting}
        onConfirm={() => void deleteSelectedWarehouses()}
      />

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <ScrollReveal delay={110}>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white/70">
            <div className="w-[calc(100%+6rem)] overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
                  <tr className="[&>th]:h-12 [&>th]:text-sm [&>th]:align-middle">
                    <th className="w-12 px-2 text-left">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-white/70 align-middle"
                        aria-label={copy.selectAll}
                        checked={allChecked}
                        onChange={(e) => {
                          setCheckedWarehouseIds(e.target.checked ? warehouses.map((w) => String(w.id)) : [])
                        }}
                      />
                    </th>
                    <th className="min-w-[280px] px-2 text-left text-base font-semibold text-white">{copy.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedWarehouses.map((w) => (
                    <tr
                      key={w.id}
                      className={[
                        "border-b border-slate-200/80 last:border-b-0",
                        selectedWarehouseId === String(w.id) ? "bg-blue-50/70" : "bg-white/60",
                      ].join(" ")}
                    >
                      <td className="px-2 py-4 align-middle">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-slate-300"
                          aria-label={`select warehouse ${w.id}`}
                          checked={checkedWarehouseIds.includes(String(w.id))}
                          onChange={(e) => {
                            const id = String(w.id)
                            setCheckedWarehouseIds((prev) =>
                              e.target.checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)
                            )
                          }}
                        />
                      </td>
                      <td className="px-2 py-4 text-lg font-medium  text-slate-800">
                        <button
                          data-slot="warehouse-name"
                          type="button"
                          className="cursor-pointer rounded-md border-slate-300 bg-white px-2 py-1 text-left text-slate-800 hover:bg-slate-50"
                          onClick={() => openEditModal(w)}
                          title={copy.editName}
                        >
                          {localizedWarehouseName(w.name, language)}
                        </button>
                      </td>
                      <td className="px-2 py-4 text-lg text-slate-800"></td>
                    </tr>
                  ))}

                  {!loading && warehouses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        {copy.empty}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          {warehouses.length > 0 ? (
            <div className="flex justify-end">
              <TablePagination page={page} totalPages={totalPages} disabled={loading} onPageChange={setPage} />
            </div>
          ) : null}
        </div>
      </ScrollReveal>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[min(92vw,720px)] max-w-[720px] overflow-hidden rounded-[28px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-0 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)]">
          <DialogHeader className="border-b border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2f6fed]">{language === "uz" ? "OMBOR" : "Warehouse"}</div>
            <DialogTitle className="mt-2 text-[28px] font-semibold text-[#16325c]">{copy.editTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 px-6 py-5">
            <Input
              className="h-12 rounded-xl border-[#c7d7ef] bg-[#f8fbff] text-base text-[#16325c]"
              placeholder={copy.namePlaceholder}
              value={editWarehouseName}
              onChange={(e) => setEditWarehouseName(e.target.value)}
            />
          </div>
          <DialogFooter className="border-t border-[#e4ecf8] bg-white px-6 py-5">
            <Button className="h-11 rounded-xl !border border-[#d7e3f7] bg-white px-5 text-[#24406b]" onClick={() => setEditOpen(false)}>
              {copy.cancel}
            </Button>
            <Button
              className="h-11 rounded-xl border-0 bg-gradient-to-r from-blue-900 to-blue-700 px-5 text-white shadow-[0_12px_24px_rgba(29,78,216,0.18)] hover:from-blue-950 hover:to-blue-800"
              onClick={updateWarehouseName}
              disabled={editing}
            >
              {editing ? copy.saving : copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
