import { useEffect, useMemo, useState } from "react"

import { Pencil, Trash2 } from "lucide-react"
import TablePagination from "@/components/common/TablePagination"
import TableActionIconButton from "@/components/common/TableActionIconButton"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { useI18n } from "@/i18n"

export type RecentSaleRow = {
  id: string | number
  name: string
  soni: number
  narxi: number
  data: string
}

type SortKey = "name" | "soni" | "narxi" | "data"
type SortDir = "asc" | "desc"

type FetchParams = {
  page: number
  pageSize: number
  q: string
  sortKey: SortKey
  sortDir: SortDir
}

type FetchResult = {
  rows: RecentSaleRow[]
  totalCount: number
}

type Props = {
  title?: string
  subtitle?: string
  rows?: RecentSaleRow[]
  onFetch?: (params: FetchParams) => Promise<FetchResult>
  onEditSave?: (row: RecentSaleRow) => Promise<void> | any
  onDelete?: (id: RecentSaleRow["id"]) => Promise<void> | void
  pageSize?: number
}

function money(n: number) {
  return `$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`
}

function cx(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ")
}

function isValidDateYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export default function RecentSalesLuxuryTable({
  title = "So'nggi sotuvlar",
  subtitle = "Oxirgi kiritilgan sotuvlar ro'yxati",
  rows,
  onFetch,
  onEditSave,
  onDelete,
  pageSize: pageSizeProp = 5,
}: Props) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          title: "Последние продажи",
          subtitle: "Список последних добавленных продаж",
          serverError: "Ошибка получения данных с сервера",
          requiredName: "Имя / название не может быть пустым.",
          invalidQty: "Количество должно быть больше 0.",
          invalidPrice: "Цена не может быть меньше 0.",
          invalidDate: "Неверный формат даты. Пример: 2025-10-10",
          saveError: "Ошибка сохранения",
          deleteError: "Ошибка удаления",
          search: "Поиск: имя / название...",
          page: "Страница",
          name: "Имя / Название",
          qty: "Количество",
          price: "Цена",
          date: "Дата",
          actions: "Действия",
          loading: "Загрузка...",
          empty: "Пока нет данных.",
          edit: "Редактировать",
          delete: "Удалить",
          total: "Итого (цена × количество)",
          totalRecords: "Всего",
          records: "записей",
          previous: "Назад",
          next: "Вперед",
          deleteTitle: "Удаление",
          deleteDescription: "Вы действительно хотите удалить эту запись о продаже?",
          editTitle: "Редактирование",
          cancel: "Отмена",
          saving: "Сохранение...",
          save: "Сохранить",
          example: "Например: Yusuf-Latipov",
          priceOne: "Цена (1 шт)",
          format: "Формат: YYYY-MM-DD",
        }
      : language === "en"
        ? {
            title: "Recent sales",
            subtitle: "List of recently added sales",
            serverError: "Failed to fetch data from server",
            requiredName: "Name cannot be empty.",
            invalidQty: "Qty must be greater than 0.",
            invalidPrice: "Price cannot be below 0.",
            invalidDate: "Invalid date format. Example: 2025-10-10",
            saveError: "Save error",
            deleteError: "Delete error",
            search: "Search: name...",
            page: "Page",
            name: "Name",
            qty: "Qty",
            price: "Price",
            date: "Date",
            actions: "Actions",
            loading: "Loading...",
            empty: "No data yet.",
            edit: "Edit",
            delete: "Delete",
            total: "Total (price × qty)",
            totalRecords: "Total",
            records: "records",
            previous: "Previous",
            next: "Next",
            deleteTitle: "Delete",
            deleteDescription: "Are you sure you want to delete this sale record?",
            editTitle: "Edit",
            cancel: "Cancel",
            saving: "Saving...",
            save: "Save",
            example: "For example: Yusuf-Latipov",
            priceOne: "Price (1 item)",
            format: "Format: YYYY-MM-DD",
          }
        : {
            title: "So'nggi sotuvlar",
            subtitle: "Oxirgi kiritilgan sotuvlar ro'yxati",
            serverError: "Serverdan ma'lumot olishda xatolik",
            requiredName: "Ism/Nomi bo'sh bo'lishi mumkin emas.",
            invalidQty: "Soni 0 dan katta bo'lishi kerak.",
            invalidPrice: "Narxi 0 dan kichik bo'lishi mumkin emas.",
            invalidDate: "Sana formati noto'g'ri. Masalan: 2025-10-10",
            saveError: "Saqlashda xatolik",
            deleteError: "O'chirishda xatolik",
            search: "Qidirish: ism/nomi...",
            page: "Sahifa",
            name: "Ism / Nomi",
            qty: "Soni",
            price: "Narxi",
            date: "Sana",
            actions: "Amallar",
            loading: "Yuklanmoqda...",
            empty: "Hozircha ma'lumot yo'q.",
            edit: "Tahrirlash",
            delete: "O'chirish",
            total: "Jami (narxi × soni)",
            totalRecords: "Jami",
            records: "ta yozuv",
            previous: "Oldingi",
            next: "Keyingi",
            deleteTitle: "O'chirish",
            deleteDescription: "Rostdan ham ushbu sotuv yozuvini o'chirmoqchimisiz?",
            editTitle: "Tahrirlash",
            cancel: "Bekor qilish",
            saving: "Saqlanmoqda...",
            save: "Saqlash",
            example: "Masalan: Yusuf-Latipov",
            priceOne: "Narxi (1 dona)",
            format: "Format: YYYY-MM-DD",
          }

  const resolvedTitle = title === "So'nggi sotuvlar" ? copy.title : title
  const resolvedSubtitle = subtitle === "Oxirgi kiritilgan sotuvlar ro'yxati" ? copy.subtitle : subtitle

  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(pageSizeProp)
  const [sortKey, setSortKey] = useState<SortKey>("data")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const isServerMode = typeof onFetch === "function"
  const [localRows, setLocalRows] = useState<RecentSaleRow[]>(rows ?? [])
  const [serverRows, setServerRows] = useState<RecentSaleRow[]>([])
  const [totalCount, setTotalCount] = useState<number>((rows ?? []).length)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteId, setDeleteId] = useState<RecentSaleRow["id"] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editRow, setEditRow] = useState<RecentSaleRow | null>(null)
  const [fName, setFName] = useState("")
  const [fSoni, setFSoni] = useState<number>(0)
  const [fNarxi, setFNarxi] = useState<number>(0)
  const [fData, setFData] = useState("")

  useEffect(() => {
    setLocalRows(rows ?? [])
  }, [rows])

  useEffect(() => {
    if (!isServerMode) {
      setTotalCount(localRows.length)
      return
    }

    let cancelled = false
    setLoading(true)
    setErr(null)

    onFetch!({ page, pageSize, q, sortKey, sortDir })
      .then((res) => {
        if (cancelled) return
        setServerRows(res.rows)
        setTotalCount(res.totalCount)
      })
      .catch((e) => {
        if (cancelled) return
        setErr(e?.message || copy.serverError)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isServerMode, onFetch, page, pageSize, q, sortKey, sortDir, refreshKey, localRows.length, copy.serverError])

  const localFilteredSorted = useMemo(() => {
    const src = localRows ?? []
    const qq = q.trim().toLowerCase()

    const filtered = !qq ? src : src.filter((r) => r.name.toLowerCase().includes(qq))

    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir
      if (sortKey === "soni") return (a.soni - b.soni) * dir
      if (sortKey === "narxi") return (a.narxi - b.narxi) * dir
      return a.data.localeCompare(b.data) * dir
    })
  }, [localRows, q, sortKey, sortDir])

  const localTotalCount = localFilteredSorted.length
  const localTotalPages = Math.max(1, Math.ceil(localTotalCount / pageSize))

  useEffect(() => {
    setPage(1)
  }, [q, sortKey, sortDir])

  useEffect(() => {
    if (!isServerMode) {
      if (page > localTotalPages) setPage(localTotalPages)
      if (page < 1) setPage(1)
      setTotalCount(localTotalCount)
    }
  }, [isServerMode, page, localTotalPages, localTotalCount])

  const pageRows = useMemo(() => {
    if (isServerMode) return serverRows
    const start = (page - 1) * pageSize
    return localFilteredSorted.slice(start, start + pageSize)
  }, [isServerMode, serverRows, localFilteredSorted, page, pageSize])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize])

  const totalAmount = useMemo(() => {
    const src = isServerMode ? pageRows : localRows
    return (src ?? []).reduce((acc, r) => acc + r.narxi * r.soni, 0)
  }, [isServerMode, pageRows, localRows])

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir("asc")
      return
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"))
  }

  function openEdit(row: RecentSaleRow) {
    setErr(null)
    setEditRow(row)
    setFName(row.name)
    setFSoni(row.soni)
    setFNarxi(row.narxi)
    setFData(row.data)
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditRow(null)
  }

  async function handleEditSave() {
    if (!editRow) return

    if (!fName.trim()) {
      setErr(copy.requiredName)
      return
    }
    if (!Number.isFinite(fSoni) || fSoni <= 0) {
      setErr(copy.invalidQty)
      return
    }
    if (!Number.isFinite(fNarxi) || fNarxi < 0) {
      setErr(copy.invalidPrice)
      return
    }
    if (!isValidDateYYYYMMDD(fData)) {
      setErr(copy.invalidDate)
      return
    }

    const updated: RecentSaleRow = {
      id: editRow.id,
      name: fName.trim(),
      soni: Number(fSoni),
      narxi: Number(fNarxi),
      data: fData,
    }

    try {
      setEditSaving(true)
      setErr(null)
      await onEditSave?.(updated)

      if (!isServerMode) {
        setLocalRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        setRefreshKey((k) => k + 1)
      }

      closeEdit()
    } catch (e: any) {
      setErr(e?.message || copy.saveError)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (deleteId == null) return

    try {
      setDeleting(true)
      setErr(null)
      await onDelete?.(deleteId)

      if (!isServerMode) {
        setLocalRows((prev) => prev.filter((x) => x.id !== deleteId))
      } else {
        setRefreshKey((k) => k + 1)
      }

      setDeleteId(null)
    } catch (e: any) {
      setErr(e?.message || copy.deleteError)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const sortMark = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? "up" : "down") : "both")

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-extrabold text-slate-900">{resolvedTitle}</div>
          <div className="text-xs text-slate-500">{resolvedSubtitle}</div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="text-slate-400">Q</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={copy.search}
              className="w-56 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            {copy.page}: <span className="font-bold text-slate-900">{page}</span> / {totalPages}
          </div>
        </div>
      </div>

      <div className="p-4">
        {err && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {err}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[920px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold">
                  <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    {copy.name}
                    <span className="text-[10px] text-slate-400">{sortMark("name")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-bold">
                  <button type="button" onClick={() => toggleSort("soni")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    {copy.qty}
                    <span className="text-[10px] text-slate-400">{sortMark("soni")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-bold">
                  <button type="button" onClick={() => toggleSort("narxi")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    {copy.price}
                    <span className="text-[10px] text-slate-400">{sortMark("narxi")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-bold text-right">
                  <button type="button" onClick={() => toggleSort("data")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    {copy.date}
                    <span className="text-[10px] text-slate-400">{sortMark("data")}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-bold text-right">{copy.actions}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {copy.loading}
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {copy.empty}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={String(r.id)} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-800">
                        {r.soni}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-800">{money(r.narxi)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{r.data}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <TableActionIconButton title={copy.edit} onClick={() => openEdit(r)}>
                          <Pencil size={16} />
                        </TableActionIconButton>
                        <TableActionIconButton title={copy.delete} danger onClick={() => setDeleteId(r.id)}>
                          <Trash2 size={16} />
                        </TableActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="bg-slate-50 text-slate-700">
              <tr>
                <td className="px-4 py-3 font-bold" colSpan={4}>
                  {copy.total}
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-slate-900">{money(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="text-xs text-slate-500">
            {copy.totalRecords}: <span className="font-bold text-slate-900">{totalCount}</span> {copy.records}
          </div>

          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} size="sm" />
        </div>
      </div>

      <DeleteAlertDialog
        open={deleteId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title={copy.deleteTitle}
        description={copy.deleteDescription}
        loading={deleting}
        onConfirm={() => {
          void handleDeleteConfirmed()
        }}
      />

      {editOpen && editRow && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-slate-900">{copy.editTitle}</div>
                <div className="mt-1 text-xs text-slate-500">
                  ID: <span className="font-bold text-slate-900">{String(editRow.id)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                disabled={editSaving}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                x
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-bold text-slate-700">{copy.name}</span>
                <input
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder={copy.example}
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-slate-700">{copy.qty}</span>
                  <input
                    type="number"
                    value={String(fSoni)}
                    onChange={(e) => setFSoni(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    min={1}
                    step={1}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-bold text-slate-700">{copy.priceOne}</span>
                  <input
                    type="number"
                    value={String(fNarxi)}
                    onChange={(e) => setFNarxi(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    min={0}
                    step={0.01}
                  />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-bold text-slate-700">{copy.date}</span>
                <input
                  type="date"
                  value={fData}
                  onChange={(e) => setFData(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                />
                <span className="text-[11px] text-slate-400">{copy.format}</span>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={closeEdit}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {copy.cancel}
              </button>

              <button
                type="button"
                disabled={editSaving}
                onClick={handleEditSave}
                className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50"
              >
                {editSaving ? copy.saving : copy.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
