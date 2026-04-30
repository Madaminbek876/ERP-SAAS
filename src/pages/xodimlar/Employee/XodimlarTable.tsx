import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Funnel, Plus, Search, MoreHorizontalIcon } from "lucide-react"
import { apiAxios } from "@/Api/api.axios"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import TablePagination from "@/components/common/TablePagination"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Link } from "react-router-dom"
import type { Client } from "@/Api/types"
import { toast } from "react-toastify"
import { useI18n } from "@/i18n"

type ClientRow = {
  id: string
  code: string
  clientName: string
  inn: string
  kind: string
  phoneNumber: string
  email: string
  address: string
  notes: string
  isActive: boolean
  deletedAt: string | null
}

const emptyFiltersUI = {
  id: "",
  code: "",
  clientName: "",
  inn: "",
  kind: "",
  isActive: "ALL",
  createdFrom: "",
  createdTo: "",
  phoneNumber: "",
  address: "",
}

const kindLabelMap: Record<string, { uz: string; ru: string; en: string }> = {
  CLIENT: { uz: "Mijoz", ru: "Клиент", en: "Client" },
  SUPPLIER: { uz: "Yetkazib beruvchi", ru: "Поставщик", en: "Supplier" },
  EMPLOYEE: { uz: "Xodim", ru: "Сотрудник", en: "Employee" },
}

const copyByLang = {
  uz: {
    title: "Mijozlar jadvali",
    search: "Mijozlarni qidirish...",
    filter: "Filtr",
    filterTitle: "Mijozlarni filtrlash",
    refresh: "Yangilash",
    loading: "Yuklanmoqda...",
    openCrud: "Mijoz CRUD ni ochish",
    pageCount: "Sahifada {{page}} ta / jami {{total}} ta mijoz",
    table: { id: "ID", code: "Kod", name: "Mijoz nomi", inn: "STIR", kind: "Turi", phone: "Telefon", email: "Email", address: "Manzil", status: "Holati", deletedAt: "O'chirilgan sana", notes: "Izoh", actions: "Amallar" },
    empty: "Mijoz topilmadi",
    edit: "Tahrirlash",
    restore: "Tiklash",
    hardDelete: "Butunlay o'chirish",
    activate: "Aktiv qilish",
    deactivate: "Noaktiv qilish",
    delete: "O'chirish",
    deleting: "O'chirilmoqda...",
    prev: "Oldingi",
    next: "Keyingi",
    deleteTitle: "O'chirish",
    deleteSoft: "Rostdan ham ushbu mijozni o'chirmoqchimisiz?",
    deleteHard: "Tanlangan mijoz butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
    editTitle: "Mijozni tahrirlash",
    clientName: "Mijoz nomi",
    phoneLabel: "Telefon",
    companyNotes: "Kompaniya / izoh",
    cancel: "Bekor qilish",
    save: "Saqlash",
    saving: "Saqlanmoqda...",
    active: "Aktiv",
    inactive: "Noaktiv",
    all: "Barchasi",
    activeOnly: "Faqat aktiv",
    inactiveOnly: "Faqat noaktiv/o'chirilgan",
    close: "Yopish",
    apply: "Qo'llash",
    reset: "Tozalash",
    loadError: "Mijozlar yuklanmadi",
    detailError: "Mijoz detali yuklanmadi",
    updateSuccess: "Mijoz yangilandi",
    updateError: "Yangilashda xatolik",
    deleteSuccess: "Mijoz o'chirildi",
    hardDeleteSuccess: "Mijoz butunlay o'chirildi",
    deleteError: "O'chirishda xatolik",
    restoreSuccess: "Mijoz tiklandi",
    restoreError: "Tiklashda xatolik",
    activateSuccess: "Mijoz aktiv qilindi",
    deactivateSuccess: "Mijoz noaktiv qilindi",
    statusError: "Holatni o'zgartirishda xatolik",
  },
  ru: {
    title: "Таблица клиентов",
    search: "Поиск клиентов...",
    filter: "Фильтр",
    filterTitle: "Фильтр клиентов",
    refresh: "Обновить",
    loading: "Загрузка...",
    openCrud: "Открыть CRUD клиентов",
    pageCount: "{{page}} на странице / всего {{total}} клиентов",
    table: { id: "ID", code: "Код", name: "Имя клиента", inn: "ИНН", kind: "Тип", phone: "Телефон", email: "Email", address: "Адрес", status: "Статус", deletedAt: "Удален", notes: "Примечание", actions: "Действия" },
    empty: "Клиенты не найдены",
    edit: "Редактировать",
    restore: "Восстановить",
    hardDelete: "Удалить навсегда",
    activate: "Активировать",
    deactivate: "Деактивировать",
    delete: "Удалить",
    deleting: "Удаление...",
    prev: "Назад",
    next: "Далее",
    deleteTitle: "Удаление",
    deleteSoft: "Вы действительно хотите удалить этого клиента?",
    deleteHard: "Клиент будет удален навсегда. Это действие нельзя отменить.",
    editTitle: "Редактировать клиента",
    clientName: "Имя клиента",
    phoneLabel: "Телефон",
    companyNotes: "Компания / заметки",
    cancel: "Отмена",
    save: "Сохранить",
    saving: "Сохранение...",
    active: "Активен",
    inactive: "Неактивен",
    all: "Все",
    activeOnly: "Только активные",
    inactiveOnly: "Только неактивные/удаленные",
    close: "Закрыть",
    apply: "Применить",
    reset: "Сбросить",
    loadError: "Клиенты не загрузились",
    detailError: "Детали клиента не загрузились",
    updateSuccess: "Клиент обновлен",
    updateError: "Ошибка обновления",
    deleteSuccess: "Клиент удален",
    hardDeleteSuccess: "Клиент удален навсегда",
    deleteError: "Ошибка удаления",
    restoreSuccess: "Клиент восстановлен",
    restoreError: "Ошибка восстановления",
    activateSuccess: "Клиент активирован",
    deactivateSuccess: "Клиент деактивирован",
    statusError: "Ошибка смены статуса",
  },
  en: {
    title: "Clients Table",
    search: "Search clients...",
    filter: "Filter",
    filterTitle: "Filter Clients",
    refresh: "Refresh",
    loading: "Loading...",
    openCrud: "Open Client CRUD",
    pageCount: "{{page}} on page / {{total}} total clients",
    table: { id: "ID", code: "Code", name: "Client Name", inn: "INN", kind: "Kind", phone: "Phone", email: "Email", address: "Address", status: "Status", deletedAt: "Deleted At", notes: "Notes", actions: "Actions" },
    empty: "No clients found",
    edit: "Edit",
    restore: "Restore",
    hardDelete: "Hard delete",
    activate: "Activate",
    deactivate: "Deactivate",
    delete: "Delete",
    deleting: "Deleting...",
    prev: "Previous",
    next: "Next",
    deleteTitle: "Delete",
    deleteSoft: "Are you sure you want to delete this client?",
    deleteHard: "The selected client will be permanently deleted. This action cannot be undone.",
    editTitle: "Edit client",
    clientName: "Client name",
    phoneLabel: "Phone",
    companyNotes: "Company / notes",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    active: "Active",
    inactive: "Inactive",
    all: "All",
    activeOnly: "Only active",
    inactiveOnly: "Only inactive/deleted",
    close: "Close",
    apply: "Apply",
    reset: "Reset",
    loadError: "Clients failed to load",
    detailError: "Client detail failed to load",
    updateSuccess: "Client updated",
    updateError: "Update failed",
    deleteSuccess: "Client deleted",
    hardDeleteSuccess: "Client permanently deleted",
    deleteError: "Delete failed",
    restoreSuccess: "Client restored",
    restoreError: "Restore failed",
    activateSuccess: "Client activated",
    deactivateSuccess: "Client deactivated",
    statusError: "Status update failed",
  },
} as const

const fieldPlaceholder = (key: "id" | "code" | "clientName" | "inn" | "kind" | "phone" | "address", language: "uz" | "ru" | "en") =>
  ({
    uz: { id: "ID", code: "Kod", clientName: "Mijoz nomi", inn: "STIR", kind: "Turi", phone: "Telefon", address: "Manzil" },
    ru: { id: "ID", code: "Код", clientName: "Имя клиента", inn: "ИНН", kind: "Тип", phone: "Телефон", address: "Адрес" },
    en: { id: "ID", code: "Code", clientName: "Client Name", inn: "INN", kind: "Kind", phone: "Phone", address: "Address" },
  }[language][key])

const XodimlarTable = () => {
  const { language } = useI18n()
  const copy = copyByLang[language]
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filtersUI, setFiltersUI] = useState(emptyFiltersUI)
  const [draftUI, setDraftUI] = useState(emptyFiltersUI)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard">("soft")
  const [saving, setSaving] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<ClientRow | null>(null)
  const [editForm, setEditForm] = useState({ clientName: "", inn: "", email: "", phoneNumber: "", address: "", notes: "" })

  const getKindLabel = (kind: string) => kindLabelMap[kind]?.[language] || kind

  const load = async (targetPage = page, activeFilters = filtersUI) => {
    try {
      setLoading(true)
      setError("")
      const backend = await apiAxios.listClientsPage({
        page: targetPage,
        page_size: pageSize,
        search: search.trim() || undefined,
        ordering: "-created_at",
        is_active: activeFilters.isActive === "true" ? true : activeFilters.isActive === "false" ? false : undefined,
      })
      const mapped = (backend.items as Client[]).map((x) => ({
        id: String(x.id),
        code: String(x.code || ""),
        clientName: String(x.name || "-"),
        inn: String(x.taxId || ""),
        kind: String(x.kind || "CLIENT"),
        phoneNumber: String(x.phone || ""),
        email: String(x.email || ""),
        address: String(x.address || ""),
        notes: String(x.notes || ""),
        isActive: Boolean(x.isActive ?? true),
        deletedAt: x.deletedAt ?? null,
      }))
      setRows(mapped)
      setTotal(Number(backend.total || 0))
      setPage(targetPage)
    } catch (e: any) {
      setRows([])
      setTotal(0)
      setError(String(e?.response?.data?.detail || e?.message || copy.loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(page, filtersUI)
  }, [page, search, filtersUI.isActive])

  const hasAnyFilter = useMemo(
    () => Object.entries(filtersUI).some(([k, v]) => String(v) !== String((emptyFiltersUI as Record<string, string>)[k])),
    [filtersUI]
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const matchesSearch = !q || [r.id, r.code, r.clientName, r.inn, r.phoneNumber, r.email].some((v) => v.toLowerCase().includes(q))
      if (!matchesSearch) return false
      if (filtersUI.id && !r.id.toLowerCase().includes(filtersUI.id.toLowerCase())) return false
      if (filtersUI.code && !r.code.toLowerCase().includes(filtersUI.code.toLowerCase())) return false
      if (filtersUI.clientName && !r.clientName.toLowerCase().includes(filtersUI.clientName.toLowerCase())) return false
      if (filtersUI.inn && !r.inn.toLowerCase().includes(filtersUI.inn.toLowerCase())) return false
      if (filtersUI.kind && !r.kind.toLowerCase().includes(filtersUI.kind.toLowerCase())) return false
      if (filtersUI.phoneNumber && !r.phoneNumber.toLowerCase().includes(filtersUI.phoneNumber.toLowerCase())) return false
      if (filtersUI.address && !r.address.toLowerCase().includes(filtersUI.address.toLowerCase())) return false
      return true
    })
  }, [rows, search, filtersUI])

  const openEdit = async (row: ClientRow) => {
    try {
      setEditLoading(true)
      const d = await apiAxios.detail("client", row.id)
      const enriched: ClientRow = {
        id: String(d.id),
        code: String(d.code || ""),
        clientName: String(d.name || "-"),
        inn: String(d.taxId || ""),
        kind: String(d.kind || "CLIENT"),
        phoneNumber: String(d.phone || ""),
        email: String(d.email || ""),
        address: String(d.address || ""),
        notes: String(d.notes || d.company || ""),
        isActive: Boolean(d.isActive ?? true),
        deletedAt: d.deletedAt ?? null,
      }
      setEditRow(enriched)
      setEditForm({ clientName: enriched.clientName, inn: enriched.inn, email: enriched.email, phoneNumber: enriched.phoneNumber, address: enriched.address, notes: enriched.notes })
      setEditOpen(true)
    } catch (e: any) {
      toast.error(String(e?.response?.data?.detail || e?.message || copy.detailError))
    } finally {
      setEditLoading(false)
    }
  }

  const submitEdit = async () => {
    if (!editRow) return
    try {
      setSaving(true)
      const updated = await apiAxios.update("client", editRow.id, {
        name: editForm.clientName,
        phone: editForm.phoneNumber,
        email: editForm.email,
        address: editForm.address,
        taxId: editForm.inn,
        notes: editForm.notes,
      } as any)
      const mapped: ClientRow = {
        id: String(updated.id),
        code: String(updated.code || ""),
        clientName: String(updated.name || "-"),
        inn: String(updated.taxId || ""),
        kind: String(updated.kind || "CLIENT"),
        phoneNumber: String(updated.phone || ""),
        email: String(updated.email || ""),
        address: String(updated.address || ""),
        notes: String(updated.notes || ""),
        isActive: Boolean(updated.isActive ?? true),
        deletedAt: updated.deletedAt ?? null,
      }
      setRows((prev) => prev.map((x) => (x.id === editRow.id ? mapped : x)))
      setEditOpen(false)
      setEditRow(null)
      toast.success(copy.updateSuccess)
    } catch (e: any) {
      toast.error(String(e?.response?.data?.detail || e?.message || copy.updateError))
    } finally {
      setSaving(false)
    }
  }

  const removeClient = async (id: string, mode: "soft" | "hard") => {
    try {
      setDeletingId(id)
      if (mode === "hard") await apiAxios.hardDelete("client", id)
      else await apiAxios.remove("client", id)
      await load(page, filtersUI)
      toast.success(mode === "hard" ? copy.hardDeleteSuccess : copy.deleteSuccess)
    } catch (e: any) {
      toast.error(String(e?.response?.data?.detail || e?.message || copy.deleteError))
    } finally {
      setDeletingId(null)
      setDeleteOpen(false)
      setDeleteTargetId(null)
    }
  }

  const toggleActive = async (row: ClientRow, nextActive: boolean) => {
    try {
      if (nextActive) await apiAxios.activate("client", row.id)
      else await apiAxios.deactivate("client", row.id)
      await load(page, filtersUI)
      toast.success(nextActive ? copy.activateSuccess : copy.deactivateSuccess)
    } catch (e: any) {
      toast.error(String(e?.response?.data?.detail || e?.message || copy.statusError))
    }
  }

  return (
    <div>
      <h1 className="pb-5 pl-5 text-2xl font-bold">{copy.title}</h1>
      <div className="flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-[320px]">
            <Input className="h-[36px] w-full rounded-xl border border-gray-300 bg-white/70 pl-10 shadow-[rgba(0,0,0,0.24)_0px_3px_8px] backdrop-blur-xl" type="search" placeholder={copy.search} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          </div>
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogTrigger asChild>
              <div className="flex h-[36px] items-center justify-center rounded-xl border border-gray-300 bg-white/70 px-3 shadow-[rgba(0,0,0,0.24)_0px_3px_8px] backdrop-blur-xl">
                <Funnel className="mr-2 h-4 w-4 text-gray-500" />
                <Button variant="ghost" className="h-[30px] px-2" onClick={() => { setDraftUI(filtersUI); setFilterOpen(true) }}>
                  {copy.filter} {hasAnyFilter ? "*" : ""}
                </Button>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-[720px] bg-white">
              <DialogHeader><DialogTitle>{copy.filterTitle}</DialogTitle></DialogHeader>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input placeholder={fieldPlaceholder("id", language)} value={draftUI.id} onChange={(e) => setDraftUI((p) => ({ ...p, id: e.target.value }))} />
                <Input placeholder={fieldPlaceholder("code", language)} value={draftUI.code} onChange={(e) => setDraftUI((p) => ({ ...p, code: e.target.value }))} />
                <Input placeholder={fieldPlaceholder("clientName", language)} value={draftUI.clientName} onChange={(e) => setDraftUI((p) => ({ ...p, clientName: e.target.value }))} />
                <Input placeholder={fieldPlaceholder("inn", language)} value={draftUI.inn} onChange={(e) => setDraftUI((p) => ({ ...p, inn: e.target.value }))} />
                <Input placeholder={fieldPlaceholder("kind", language)} value={draftUI.kind} onChange={(e) => setDraftUI((p) => ({ ...p, kind: e.target.value }))} />
                <Input type="date" value={draftUI.createdFrom} onChange={(e) => setDraftUI((p) => ({ ...p, createdFrom: e.target.value }))} />
                <Input type="date" value={draftUI.createdTo} onChange={(e) => setDraftUI((p) => ({ ...p, createdTo: e.target.value }))} />
                <select className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={draftUI.isActive} onChange={(e) => setDraftUI((p) => ({ ...p, isActive: e.target.value }))}>
                  <option value="ALL">{copy.all}</option><option value="true">{copy.activeOnly}</option><option value="false">{copy.inactiveOnly}</option>
                </select>
                <Input placeholder={fieldPlaceholder("phone", language)} value={draftUI.phoneNumber} onChange={(e) => setDraftUI((p) => ({ ...p, phoneNumber: e.target.value }))} />
                <Input placeholder={fieldPlaceholder("address", language)} value={draftUI.address} onChange={(e) => setDraftUI((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={() => { const x = { ...emptyFiltersUI }; setDraftUI(x); setFiltersUI(x); void load(1, x) }}>{copy.reset}</Button>
                <DialogClose asChild><Button variant="outline">{copy.close}</Button></DialogClose>
                <Button onClick={() => { setFiltersUI(draftUI); void load(1, draftUI); setFilterOpen(false) }}>{copy.apply}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => void load(page, filtersUI)} disabled={loading}>{loading ? copy.loading : copy.refresh}</Button>
        </div>
        <Link to="/xodimlar" className="flex h-[36px] cursor-pointer items-center justify-center rounded-xl border border-gray-300 bg-white/70 px-3 shadow-[rgba(0,0,0,0.24)_0px_3px_8px] backdrop-blur-xl">
          <Plus className="mr-2 h-4 w-4 text-gray-500" />
          <Button variant="ghost" className="h-[30px] cursor-pointer px-2">{copy.openCrud}</Button>
        </Link>
      </div>
      <div className="mt-4 px-4">
        {error ? <div className="pb-2 text-sm text-rose-600">{error}</div> : null}
        <div className="pb-2 text-sm text-gray-500">{copy.pageCount.replace("{{page}}", String(filteredRows.length)).replace("{{total}}", String(total))}</div>
        <Table>
          <TableHeader><TableRow><TableHead className="text-center">{copy.table.id}</TableHead><TableHead className="text-center">{copy.table.code}</TableHead><TableHead className="text-center">{copy.table.name}</TableHead><TableHead className="text-center">{copy.table.inn}</TableHead><TableHead className="text-center">{copy.table.kind}</TableHead><TableHead className="text-center">{copy.table.phone}</TableHead><TableHead className="text-center">{copy.table.email}</TableHead><TableHead className="text-center">{copy.table.address}</TableHead><TableHead className="text-center">{copy.table.status}</TableHead><TableHead className="text-center">{copy.table.deletedAt}</TableHead><TableHead className="text-center">{copy.table.notes}</TableHead><TableHead className="text-center">{copy.table.actions}</TableHead></TableRow></TableHeader>
          <TableBody>
            {!loading && filteredRows.length === 0 ? <TableRow><TableCell colSpan={12} className="py-8 text-center text-sm text-gray-500">{copy.empty}</TableCell></TableRow> : filteredRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-center font-medium">{r.id}</TableCell><TableCell className="text-center">{r.code || "-"}</TableCell><TableCell className="text-center">{r.clientName}</TableCell><TableCell className="text-center">{r.inn}</TableCell><TableCell className="text-center">{getKindLabel(r.kind)}</TableCell><TableCell className="text-center">{r.phoneNumber}</TableCell><TableCell className="text-center">{r.email || "-"}</TableCell><TableCell className="text-center">{r.address}</TableCell><TableCell className="text-center">{r.isActive ? copy.active : copy.inactive}</TableCell><TableCell className="text-center">{r.deletedAt || "-"}</TableCell><TableCell className="text-center">{r.notes}</TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void openEdit(r)} disabled={editLoading}>{editLoading ? copy.loading : copy.edit}</DropdownMenuItem>
                      {!r.deletedAt ? <DropdownMenuItem onClick={() => void toggleActive(r, !r.isActive)}>{r.isActive ? copy.deactivate : copy.activate}</DropdownMenuItem> : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => { setDeleteTargetId(r.id); setDeleteMode("soft"); setDeleteOpen(true) }} disabled={deletingId === r.id}>{deletingId === r.id ? copy.deleting : copy.delete}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex justify-end">
          <TablePagination
            page={page}
            totalPages={Math.max(1, Math.ceil((total || 0) / pageSize))}
            disabled={loading}
            onPageChange={(nextPage) => void load(nextPage, filtersUI)}
          />
        </div>
      </div>
      <DeleteAlertDialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteTargetId(null) }} title={copy.deleteTitle} description={deleteMode === "hard" ? copy.deleteHard : copy.deleteSoft} loading={!!deletingId} onConfirm={() => { if (deleteTargetId) void removeClient(deleteTargetId, deleteMode) }} />
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[640px] bg-white">
          <DialogHeader><DialogTitle>{copy.editTitle}</DialogTitle></DialogHeader>
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input placeholder={copy.clientName} value={editForm.clientName} onChange={(e) => setEditForm((p) => ({ ...p, clientName: e.target.value }))} />
            <Input placeholder={copy.table.inn} value={editForm.inn} onChange={(e) => setEditForm((p) => ({ ...p, inn: e.target.value }))} />
            <Input placeholder={copy.phoneLabel} value={editForm.phoneNumber} onChange={(e) => setEditForm((p) => ({ ...p, phoneNumber: e.target.value }))} />
            <Input placeholder={copy.table.email} value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
            <Input placeholder={copy.table.address} value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
            <Input className="md:col-span-2" placeholder={copy.companyNotes} value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <DialogFooter className="mt-4 gap-2">
            <DialogClose asChild><Button variant="outline">{copy.cancel}</Button></DialogClose>
            <Button onClick={() => void submitEdit()} disabled={saving}>{saving ? copy.saving : copy.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default XodimlarTable
