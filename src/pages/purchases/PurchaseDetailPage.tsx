import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-toastify"
import {
  addPurchasePayment,
  addPurchaseItem,
  cancelPurchase,
  confirmPurchase,
  deletePurchase,
  deletePurchaseItem,
  exportPurchaseExcel,
  fetchPurchaseLocations,
  fetchPurchasesMeta,
  fetchPurchaseMaterials,
  fetchPurchase,
  getPurchaseApiErrorMessage,
  fetchPurchaseSuppliers,
  patchPurchase,
  patchPurchaseItem,
  type PatchPurchasePayload,
} from "@/Api/purchases.api"

import PurchaseHeader from "./components/PurchaseHeader"
import PurchaseForm from "./components/PurchaseForm"
import PurchaseItemsTable from "./components/PurchaseItemsTable"
import PurchasePaymentsPanel from "./components/PurchasePaymentsPanel"
import PurchaseTabs from "./components/PurchaseTabs"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import type { ChoiceValue } from "./types"
import { formatPurchaseNumber } from "./utils"
import { useI18n } from "@/i18n"

function parseChoiceValue(choice: ChoiceValue): string {
  if (typeof choice === "string") return choice
  if (Array.isArray(choice)) return String(choice[0] ?? "")
  return String(choice?.value ?? "")
}

export default function PurchaseDetailPage() {
  const { language } = useI18n()
  const { id } = useParams()
  const purchaseId = Number(id)
  const nav = useNavigate()
  const qc = useQueryClient()
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
  const [deletePurchaseOpen, setDeletePurchaseOpen] = useState(false)

  const q = useQuery({
    queryKey: ["purchases", "detail", purchaseId],
    queryFn: () => fetchPurchase(purchaseId),
    enabled: Number.isFinite(purchaseId),
  })
  const copy =
    language === "ru"
      ? {
          updateFailed: "Закупка не обновлена",
          addItemFailed: "Позиция не добавлена",
          editItemFailed: "Позиция не обновлена",
          deleteItemFailed: "Позиция не удалена",
          confirmFailed: "Подтверждение не выполнено",
          cancelFailed: "Отмена не выполнена",
          paymentAdded: "Платеж добавлен",
          paymentFailed: "Платеж не добавлен",
        }
      : language === "en"
        ? {
            updateFailed: "Purchase was not updated",
            addItemFailed: "Item was not added",
            editItemFailed: "Item was not updated",
            deleteItemFailed: "Item was not deleted",
            confirmFailed: "Confirmation failed",
            cancelFailed: "Cancellation failed",
            paymentAdded: "Payment added",
            paymentFailed: "Payment was not added",
          }
        : {
            updateFailed: "Xarid yangilanmadi",
            addItemFailed: "Item qo'shilmadi",
            editItemFailed: "Item yangilanmadi",
            deleteItemFailed: "Item o'chirilmadi",
            confirmFailed: "Tasdiqlash bajarilmadi",
            cancelFailed: "Bekor qilish bajarilmadi",
            paymentAdded: "To'lov qo'shildi",
            paymentFailed: "To'lov qo'shilmadi",
          }
  const exportFailedMessage = language === "en" ? "Export failed" : "Excel eksport bajarilmadi"
  const deletePurchaseFailedMessage = language === "en" ? "Purchase was not deleted" : "Xarid o'chirilmadi"
  const purchaseDeletedMessage = language === "en" ? "Purchase deleted" : "Xarid o'chirildi"

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

  const metaQ = useQuery({
    queryKey: ["purchases", "meta"],
    queryFn: fetchPurchasesMeta,
    staleTime: 60_000,
  })

  const refreshAll = () => {
    q.refetch()
    qc.invalidateQueries({ queryKey: ["purchases", "list"] })
  }

  const patchM = useMutation({
    mutationFn: (payload: PatchPurchasePayload) => patchPurchase(purchaseId, payload),
    onSuccess: (data) => {
      qc.setQueryData(["purchases", "detail", purchaseId], data)
      qc.invalidateQueries({ queryKey: ["purchases", "list"] })
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.updateFailed))
    },
  })

  const addItemM = useMutation({
    mutationFn: (payload: { raw_material: number; qty: string; unit_price: number }) =>
      addPurchaseItem(purchaseId, payload),
    onSuccess: (data) => {
      qc.setQueryData(["purchases", "detail", purchaseId], data)
      qc.invalidateQueries({ queryKey: ["purchases", "list"] })
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.addItemFailed))
    },
  })

  const patchItemM = useMutation({
    mutationFn: (args: { itemId: number; payload: { raw_material?: number; qty?: string; unit_price?: number } }) =>
      patchPurchaseItem(purchaseId, args.itemId, args.payload),
    onSuccess: (data) => {
      qc.setQueryData(["purchases", "detail", purchaseId], data)
      qc.invalidateQueries({ queryKey: ["purchases", "list"] })
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.editItemFailed))
    },
  })

  const deleteItemM = useMutation({
    mutationFn: (itemId: number) => deletePurchaseItem(purchaseId, itemId),
    onSuccess: (data) => {
      qc.setQueryData(["purchases", "detail", purchaseId], data)
      qc.invalidateQueries({ queryKey: ["purchases", "list"] })
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.deleteItemFailed))
    },
  })

  const exportM = useMutation({
    mutationFn: () => exportPurchaseExcel(purchaseId, data?.purchase_no),
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, exportFailedMessage))
    },
  })

  const deletePurchaseM = useMutation({
    mutationFn: () => deletePurchase(purchaseId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["purchases", "list"] })
      qc.removeQueries({ queryKey: ["purchases", "detail", purchaseId] })
      toast.success(purchaseDeletedMessage)
      nav("/dashboard/sklad/warehouse/purchases", { replace: true })
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, deletePurchaseFailedMessage))
    },
  })

  const confirmM = useMutation({
    mutationFn: () => confirmPurchase(purchaseId),
    onSuccess: (data) => {
      qc.setQueryData(["purchases", "detail", purchaseId], data)
      qc.invalidateQueries({ queryKey: ["purchases", "list"] })
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.confirmFailed))
    },
  })

  const cancelM = useMutation({
    mutationFn: () => cancelPurchase(purchaseId),
    onSuccess: (data) => {
      qc.setQueryData(["purchases", "detail", purchaseId], data)
      qc.invalidateQueries({ queryKey: ["purchases", "list"] })
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.cancelFailed))
    },
  })

  const payM = useMutation({
    mutationFn: (payload: { method: string; amount: number; occurred_on?: string; note?: string }) =>
      addPurchasePayment(purchaseId, {
        ...payload,
        currency: data?.currency || "UZS",
      }),
    onSuccess: (next) => {
      qc.setQueryData(["purchases", "detail", purchaseId], next)
      qc.invalidateQueries({ queryKey: ["purchases", "list"] })
      toast.success(copy.paymentAdded)
    },
    onError: (error: any) => {
      toast.error(getPurchaseApiErrorMessage(error, copy.paymentFailed))
    },
  })

  const data = q.data
  const loading = q.isLoading
  const isDraft = data?.status === "DRAFT"
  const canConfirm = Boolean(isDraft && (data?.location || data?.location_name) && data?.items?.length)
  const canDeletePurchase = Boolean(data?.id && data.status !== "CONFIRMED")

  const title = useMemo(() => {
    const prefix = language === "ru" ? "Закупка" : language === "en" ? "Purchase" : "Xarid"
    if (!data) return prefix
    return `${prefix} ${formatPurchaseNumber(data.purchase_no, data.id)}`
  }, [data, language])

  return (
    <div className="p-6">
      <div className="rounded-3xl bg-white/80 backdrop-blur border border-slate-200 shadow-sm">
        <div className="p-6">
          <PurchaseHeader
            title={title}
            loading={loading}
            status={data?.status}
            paymentStatus={data?.payment_status}
            updatedAt={data?.updated_at}
            total={data?.total || 0}
            paidAmount={data?.paid_amount || 0}
            remainingAmount={data?.remaining_amount || 0}
            currency={data?.currency}
            canConfirm={canConfirm}
            onClose={() => nav("/dashboard/sklad/warehouse/purchases")}
            onRefresh={refreshAll}
            onConfirm={() => confirmM.mutate()}
            onCancel={() => cancelM.mutate()}
            onExport={data?.id ? () => exportM.mutate() : undefined}
            onDelete={canDeletePurchase ? () => setDeletePurchaseOpen(true) : undefined}
            exportLoading={exportM.isPending}
            deleteLoading={deletePurchaseM.isPending}
            canDelete={canDeletePurchase}
          />

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <PurchaseForm
                loading={loading}
                value={data}
                suppliers={suppliersQ.data || []}
                locations={locationsQ.data || []}
                saving={patchM.isPending}
                onSubmit={(payload) => patchM.mutate(payload)}
              />
            </div>

            <div className="lg:col-span-7">
              <PurchaseTabs
                itemsTab={
                  <PurchaseItemsTable
                    loading={loading}
                    currency={data?.currency}
                    canEdit={isDraft}
                    materials={materialsQ.data || []}
                    items={data?.items || []}
                    onAdd={(payload) => addItemM.mutate(payload)}
                    onPatch={(itemId, payload) => patchItemM.mutate({ itemId, payload })}
                    onDelete={(itemId) => setDeleteItemId(itemId)}
                  />
                }
                paymentsTab={
                  <PurchasePaymentsPanel
                    payments={data?.payments || []}
                    paymentMethods={(metaQ.data?.payment_method_choices || []).map(parseChoiceValue).filter(Boolean)}
                    onPay={(payload) => payM.mutate(payload)}
                    paying={payM.isPending}
                  />
                }
              />
            </div>
          </div>
        </div>
      </div>
      <DeleteAlertDialog
        open={deleteItemId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteItemId(null)
        }}
        title={language === "ru" ? "Удалить позицию" : language === "en" ? "Delete item" : "Pozitsiyani o'chirish"}
        description={language === "ru" ? "Удалить эту позицию?" : language === "en" ? "Delete this item?" : "Item o'chirilsinmi?"}
        confirmText={language === "ru" ? "Удалить" : language === "en" ? "Delete" : "O'chirish"}
        cancelText={language === "ru" ? "Отмена" : language === "en" ? "Cancel" : "Bekor"}
        loading={deleteItemM.isPending}
        onConfirm={() => {
          if (deleteItemId != null) deleteItemM.mutate(deleteItemId)
          setDeleteItemId(null)
        }}
      />
      <DeleteAlertDialog
        open={deletePurchaseOpen}
        onOpenChange={setDeletePurchaseOpen}
        title={language === "en" ? "Delete purchase" : "Xaridni o'chirish"}
        description={language === "en" ? "Delete this purchase document?" : "Ushbu xarid hujjati o'chirilsinmi?"}
        confirmText={language === "en" ? "Delete" : "O'chirish"}
        cancelText={language === "en" ? "Cancel" : "Bekor"}
        loading={deletePurchaseM.isPending}
        onConfirm={() => {
          deletePurchaseM.mutate()
          setDeletePurchaseOpen(false)
        }}
      />
    </div>
  )
}
