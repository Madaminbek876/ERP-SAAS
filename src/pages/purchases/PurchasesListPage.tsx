import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-toastify"
import { useI18n } from "@/i18n"

import { useDebounce } from "@/hooks/useDebounce"
import {
  createPurchase,
  deletePurchase,
  exportPurchaseExcel,
  fetchPurchaseLocations,
  fetchPurchaseMaterials,
  fetchPurchaseSuppliers,
  fetchPurchases,
  fetchPurchasesMeta,
  getPurchaseApiErrorMessage,
  type CreatePurchasePayload,
} from "@/Api/purchases.api"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import type { ChoiceValue } from "./types"

import PurchasesToolbar from "./components/PurchasesToolbar"
import PurchasesFilters, { type PurchasesFiltersValue } from "./components/PurchasesFilters"
import PurchasesTable from "./components/PurchasesTable"
import CreatePurchaseModal from "./components/CreatePurchaseModal"

const DEFAULT_PAGE_SIZE = 20

function parseChoiceValue(choice: ChoiceValue): string {
  if (typeof choice === "string") return choice
  if (Array.isArray(choice)) return String(choice[0] ?? "")
  return String(choice?.value ?? "")
}

export default function PurchasesListPage() {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          created: "Черновик закупки создан",
          createFailed: "Закупка не создана",
          deleteSelected: "Удалить выбранные",
          deleted: "закупок удалено",
          deleteFailed: "Не удалось удалить закупки",
          deletePartialFailed: "закупок не удалось удалить",
          deleteDialogTitle: "Удалить закупки",
          title: "Поступления на склад",
          subtitle: "Список",
        }
      : language === "en"
        ? {
            created: "Purchase draft created",
            createFailed: "Failed to create purchase",
            deleteSelected: "Delete selected",
            deleted: "purchases deleted",
            deleteFailed: "Failed to delete purchases",
            deletePartialFailed: "purchases could not be deleted",
            deleteDialogTitle: "Delete purchases",
            title: "Warehouse receipts",
            subtitle: "List",
          }
        : {
            created: "Xarid qoralama holatda yaratildi",
            createFailed: "Xarid yaratilmadi",
            deleteSelected: "Tanlanganlarni o'chirish",
            deleted: "ta xarid o'chirildi",
            deleteFailed: "Xaridlarni o'chirib bo'lmadi",
            deletePartialFailed: "ta xarid o'chirilmadi",
            deleteDialogTitle: "Xaridlarni o'chirish",
            title: "Omborga bo'lgan kirimlar",
            subtitle: "Ro'yxati",
          }
  const exportFailedMessage =
    language === "ru" ? "Eksport bajarilmadi" : language === "en" ? "Export failed" : "Excel eksport bajarilmadi"
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [filters, setFilters] = useState<PurchasesFiltersValue>({
    supplier: "",
    date_from: "",
    date_to: "",
    status: "ALL",
    payment_status: "ALL",
    search: "",
  })

  const debouncedSearch = useDebounce(filters.search, 400)

  const queryParams = useMemo(() => {
    return {
      page,
      page_size: DEFAULT_PAGE_SIZE,
      supplier: filters.supplier ? Number(filters.supplier) : undefined,
      status: filters.status !== "ALL" ? filters.status : undefined,
      payment_status: filters.payment_status !== "ALL" ? filters.payment_status : undefined,
      search: debouncedSearch || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      ordering: "-id",
    }
  }, [page, debouncedSearch, filters])

  const q = useQuery({
    queryKey: ["purchases", "list", queryParams],
    queryFn: () => fetchPurchases(queryParams),
    staleTime: 10_000,
  })

  const metaQ = useQuery({
    queryKey: ["purchases", "meta"],
    queryFn: fetchPurchasesMeta,
    staleTime: 60_000,
  })

  const suppliersQ = useQuery({
    queryKey: ["purchases", "suppliers"],
    queryFn: fetchPurchaseSuppliers,
    staleTime: 60_000,
  })

  const locationsQ = useQuery({
    queryKey: ["purchases", "locations"],
    queryFn: fetchPurchaseLocations,
    staleTime: 60_000,
  })

  const materialsQ = useQuery({
    queryKey: ["purchases", "materials"],
    queryFn: fetchPurchaseMaterials,
    staleTime: 60_000,
  })

  const rows = q.data?.results || []
  const total = q.data?.count || 0
  const loading = q.isLoading

  const createM = useMutation({
    mutationFn: (payload: CreatePurchasePayload) => createPurchase(payload),
    onSuccess: async () => {
      setPage(1)
      setCreateOpen(false)
      await qc.invalidateQueries({ queryKey: ["purchases", "list"] })
      toast.success(copy.created)
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.createFailed))
    },
  })

  const deleteM = useMutation({
    mutationFn: async (ids: number[]) => {
      const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0)))
      const results = await Promise.allSettled(uniqueIds.map((id) => deletePurchase(id)))
      const successIds: number[] = []
      const failed: Array<{ id: number; error: unknown }> = []

      results.forEach((result, index) => {
        const id = uniqueIds[index]
        if (result.status === "fulfilled") {
          successIds.push(id)
          return
        }
        failed.push({ id, error: result.reason })
      })

      if (successIds.length === 0 && failed.length > 0) {
        throw failed[0].error
      }

      return { successIds, failed }
    },
    onSuccess: async ({ successIds, failed }) => {
      if (successIds.length >= rows.length && rows.length > 0 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1))
      }

      setSelectedIds((prev) => prev.filter((id) => !successIds.includes(id)))
      setDeleteOpen(false)
      await qc.invalidateQueries({ queryKey: ["purchases", "list"] })
      successIds.forEach((id) => {
        qc.removeQueries({ queryKey: ["purchases", "detail", id] })
      })

      if (successIds.length > 0) {
        toast.success(`${successIds.length} ${copy.deleted}`)
      }
      if (failed.length > 0) {
        toast.error(`${failed.length} ${copy.deletePartialFailed}`)
      }
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.deleteFailed))
    },
  })

  const deleteDialogDescription =
    language === "ru"
      ? `Удалить ${selectedIds.length} выбран${selectedIds.length === 1 ? "ную закупку" : "ных закупок"}?`
      : language === "en"
        ? `Delete ${selectedIds.length} selected purchase${selectedIds.length === 1 ? "" : "s"}?`
        : `${selectedIds.length} ta tanlangan xarid o'chirilsinmi?`

  return (
    <div className="p-6">
      <div className="rounded-3xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
            </div>

            <PurchasesToolbar
              onCreate={() => setCreateOpen(true)}
            />
          </div>

          <div className="mt-5">
            <PurchasesFilters
              value={filters}
              suppliers={suppliersQ.data || []}
              statusChoices={metaQ.data?.purchase_status_choices || []}
              onDeleteSelected={() => setDeleteOpen(true)}
              deleteDisabled={selectedIds.length === 0}
              deleteLoading={deleteM.isPending}
              deleteLabel={copy.deleteSelected}
              selectedCount={selectedIds.length}
              onChange={(next) => {
                setPage(1)
                setFilters(next)
              }}
              onReset={() => {
                setPage(1)
                setFilters({
                  supplier: "",
                  date_from: "",
                  date_to: "",
                  status: "ALL",
                  payment_status: "ALL",
                  search: "",
                })
                setSelectedIds([])
              }}
            />
          </div>

          <div className="mt-5">
            <PurchasesTable
              loading={loading}
              rows={rows}
              total={total}
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              selectedIds={selectedIds}
              onPageChange={setPage}
              onToggleSelected={(id, checked) => {
                setSelectedIds((prev) =>
                  checked ? Array.from(new Set([...prev, id])) : prev.filter((selectedId) => selectedId !== id)
                )
              }}
              onToggleAllCurrentPage={(ids, checked) => {
                setSelectedIds((prev) =>
                  checked
                    ? Array.from(new Set([...prev, ...ids]))
                    : prev.filter((selectedId) => !ids.includes(selectedId))
                )
              }}
              onExport={(row) => {
                void exportPurchaseExcel(row.id, row.purchase_no).catch((error: any) => {
                  toast.error(getPurchaseApiErrorMessage(error, exportFailedMessage))
                })
              }}
            />
          </div>
        </div>
      </div>

      <CreatePurchaseModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        loading={createM.isPending}
        suppliers={suppliersQ.data || []}
        locations={locationsQ.data || []}
        materials={materialsQ.data || []}
        currencyChoices={(metaQ.data?.currency_choices || []).map(parseChoiceValue).filter(Boolean)}
        onSubmit={(payload) => createM.mutate(payload)}
      />

      <DeleteAlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={copy.deleteDialogTitle}
        description={deleteDialogDescription}
        confirmText={language === "ru" ? "Удалить" : language === "en" ? "Delete" : "O'chirish"}
        cancelText={language === "ru" ? "Отмена" : language === "en" ? "Cancel" : "Bekor"}
        loading={deleteM.isPending}
        onConfirm={() => {
          deleteM.mutate(selectedIds)
        }}
      />
    </div>
  )
}
