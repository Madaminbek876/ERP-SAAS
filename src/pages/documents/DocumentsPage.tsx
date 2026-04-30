import { useEffect, useState } from "react"
import { useI18n } from "@/i18n"
import DocumentsTopbar from "./components/DocumentsTopbar"
import DocumentsFiltersPanel from "./components/DocumentsFilters"
import DocumentsTable from "./components/DocumentsTable"
import DocumentCreateEditDialog from "./components/DocumentCreateEditDialog"
import DocumentViewDrawer from "./components/DocumentViewDrawer"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import TablePagination from "@/components/common/TablePagination"
import { Button } from "@/components/ui/button"

import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
} from "./api/documentsApi"

import type { DocumentItem, DocumentsFilters } from "./types/documents.types"

const defaultFilters: DocumentsFilters = {
  type: "ALL",
  status: "ALL",
  refType: "ALL",
  dateFrom: undefined,
  dateTo: undefined,
  q: "",
  refId: "",
}

export default function DocumentsPage() {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          loading: "Загрузка...",
          prev: "Назад",
          next: "Далее",
          deletingTitle: "Удаление",
          deletingDescription: "Вы действительно хотите удалить этот документ?",
          loadingDoc: "Загрузка...",
        }
      : language === "en"
        ? {
            loading: "Loading...",
            prev: "Previous",
            next: "Next",
            deletingTitle: "Delete",
            deletingDescription: "Are you sure you want to delete this document?",
            loadingDoc: "Loading...",
          }
        : {
            loading: "Yuklanmoqda...",
            prev: "Oldingi",
            next: "Keyingi",
            deletingTitle: "O'chirish",
            deletingDescription: "Rostdan ham ushbu hujjatni o'chirmoqchimisiz?",
            loadingDoc: "Yuklanmoqda...",
          }
  const [filtersDraft, setFiltersDraft] = useState<DocumentsFilters>(defaultFilters)
  const [filters, setFilters] = useState<DocumentsFilters>(defaultFilters)

  const [rows, setRows] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null)

  const [viewOpen, setViewOpen] = useState(false)
  const [viewDoc, setViewDoc] = useState<DocumentItem | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async (f: DocumentsFilters) => {
    setLoading(true)
    try {
      const data = await listDocuments(f)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await listDocuments(filters)
        if (!alive) return
        setRows(data)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [filters])

  const onApply = () => setFilters(filtersDraft)

  const onReset = () => {
    setFiltersDraft(defaultFilters)
    setFilters(defaultFilters)
  }

  const onCreate = () => setCreateOpen(true)

  const onExportCsv = () => {
    const header = [
      "date",
      "number",
      "type",
      "status",
      "kontragent",
      "refType",
      "refId",
      "amount",
      "currency",
      "note",
    ]

    const lines = rows.map((r) =>
      [
        r.date,
        r.number,
        r.type,
        r.status,
        r.kontragentName ?? "",
        r.refType ?? "",
        r.refId ?? "",
        r.amount ?? "",
        r.currency ?? "",
        (r.note ?? "").replaceAll("\n", " "),
      ]
        .map((x) => `"${String(x).replaceAll('"', '""')}"`)
        .join(",")
    )

    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `documents_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ✅ VIEW: drawer ochish
  const onView = async (id: string) => {
    setViewOpen(true)
    setViewLoading(true)
    setViewDoc(null)

    try {
      const d = await getDocument(id)
      setViewDoc(d)
    } finally {
      setViewLoading(false)
    }
  }

  // ✅ EDIT
  const onEdit = async (id: string) => {
    const d = await getDocument(id)
    setEditDoc(d)
    setEditOpen(true)
  }

  // ✅ DELETE
  const onDelete = async (id: string) => {
    setDeleteId(id)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteDocument(deleteId)
      await load(filters)
      setDeleteOpen(false)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const submitCreate = async (data: Omit<DocumentItem, "id" | "createdAt" | "updatedAt">) => {
    await createDocument(data)
    await load(filters)
  }

  const submitEdit = async (data: Omit<DocumentItem, "id" | "createdAt" | "updatedAt">) => {
    if (!editDoc) return
    await updateDocument(editDoc.id, data as any)
    await load(filters)
  }

  const closeView = () => {
    setViewOpen(false)
    setViewDoc(null)
    setViewLoading(false)
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [filters, rows.length])

  return (
    <div className="space-y-5">
      {/* Topbar */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <DocumentsTopbar onCreate={onCreate} onExportCsv={onExportCsv} />
      </div>

      {/* Filters */}
      <DocumentsFiltersPanel
        value={filtersDraft}
        onChange={setFiltersDraft}
        onApply={onApply}
        onReset={onReset}
      />

      {/* Table */}
      {loading ? (
        <div className="overflow-hidden rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-100">
          {copy.loading}
        </div>
      ) : (
        <>
          <DocumentsTable rows={pagedRows} onView={onView} onEdit={onEdit} onDelete={onDelete} />
          <div className="flex justify-end rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
            <TablePagination page={page} totalPages={totalPages} disabled={loading} onPageChange={setPage} />
          </div>
        </>
      )}

      {/* Create */}
      <DocumentCreateEditDialog
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={submitCreate}
      />

      {/* Edit */}
      <DocumentCreateEditDialog
        open={editOpen}
        mode="edit"
        initial={editDoc}
        onClose={() => setEditOpen(false)}
        onSubmit={submitEdit}
      />

      {/* View Drawer */}
      <DocumentViewDrawer
        open={viewOpen}
        doc={
          viewLoading
            ? ({
                id: "loading",
                number: copy.loadingDoc,
                title: "",
                type: "OTHER",
                status: "DRAFT",
                date: new Date().toISOString().slice(0, 10),
                attachments: [],
                createdAt: "",
                updatedAt: "",
              } as any)
            : viewDoc
        }
        onClose={closeView}
      />

      <DeleteAlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleteId(null)
        }}
        title={copy.deletingTitle}
        description={copy.deletingDescription}
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

