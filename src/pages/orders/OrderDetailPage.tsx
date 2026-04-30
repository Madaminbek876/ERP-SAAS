import { useMemo, useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  addOrderItem,
  addOrderPayment,
  cancelOrder,
  canCancelOrderStatus,
  canConfirmOrderStatus,
  canDeliverOrderStatus,
  confirmOrder,
  deliverOrder,
  fetchKontragents,
  fetchOrderDetail,
  fetchProducts,
  fetchWarehouseLocations,
  getOrderStatusSelectOptions,
  normalizeOrderStatus,
  patchOrderHeader,
  printOrderReceipt,
  removeOrderItem,
  reserveOrderItem,
  returnOrderItem,
  unreserveOrder,
  updateOrderItem,
  type Kontragent,
  type OrderDetailResponse,
  type OrderStatus,
  type Product,
  type WarehouseLocation,
} from "@/pages/orders/api/ordersApi"
import OrderEditDialog from "@/pages/orders/components/OrderEditDialog"
import { toast } from "react-toastify"

function formatAmount(value: number | string | null | undefined) {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return "0"
  return new Intl.NumberFormat("uz-UZ").format(num)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat("uz-UZ").format(date)
}

function paymentStatusLabel(paidRaw?: number, totalRaw?: number, paymentStatus?: string) {
  const total = Math.max(0, Number(totalRaw || 0))
  const paid = Math.max(0, Number(paidRaw || 0))
  const effectiveTotal = total > 0 ? total : paid > 0 ? paid : 0
  const status = String(paymentStatus || "").toUpperCase()
  if (status === "PAID" || (effectiveTotal > 0 && paid >= effectiveTotal)) return "To'langan"
  if (status === "PARTIAL" || status === "PARTIALLY_PAID" || paid > 0) return "Qisman to'langan"
  return "To'lanmagan"
}

function orderStatusLabel(value: unknown) {
  const status = normalizeOrderStatus(value)
  if (status === "NEW") return "Yangi"
  if (status === "IN_PROGRESS") return "Jarayonda"
  if (status === "DELIVERED") return "Yetkazildi"
  if (status === "CANCELLED") return "Bekor qilingan"
  return status
}

function itemName(item: any) {
  return item?.product_name ?? item?.raw_material_name ?? "-"
}

function formatTaxRatePercent(value: unknown) {
  const rate = Number(value ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) return "0%"
  const percent = rate <= 1 ? rate * 100 : rate
  return `${percent.toLocaleString("uz-UZ", { maximumFractionDigits: 2 })}%`
}

function promptValue(label: string, current = "") {
  const result = window.prompt(label, current)
  return result === null ? null : result.trim()
}

function requestCancellationReason(current = "") {
  const reason = promptValue("Bekor qilish sababini kiriting", current)
  if (reason === null) return null
  if (!reason) {
    toast.error("Bekor qilish sababini kiriting")
    return null
  }
  return reason
}

function reservationIdOf(row: any) {
  const value = Number(row?.reservation_id ?? row?.id ?? 0)
  return Number.isFinite(value) && value > 0 ? value : null
}

function formatStatusHistoryTitle(row: any) {
  const from = String(row?.from_status ?? "").trim()
  const to = String(row?.to_status ?? row?.status ?? "").trim()
  if (from && to) return `${normalizeOrderStatus(from)} -> ${normalizeOrderStatus(to)}`
  if (to) return normalizeOrderStatus(to)
  if (from) return normalizeOrderStatus(from)
  return "-"
}

function parseAmountInput(value: string) {
  const cleaned = value.replace(/\s/g, "").replace(/,/g, "")
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : 0
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ""
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function extractApiErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  if (detail) return String(detail)

  const payload = error?.response?.data
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const message = Object.entries(payload)
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.join(", ")}`
        if (value && typeof value === "object") return `${key}: ${JSON.stringify(value)}`
        return `${key}: ${String(value)}`
      })
      .filter(Boolean)
      .join("; ")

    if (message) return message
  }

  return String(error?.message || fallback)
}

type OrderEditFormState = {
  client: string
  order_date: string
  delivery_date: string
  currency: string
  discount_total: number
  notes: string
  courier_name: string
  status: OrderStatus
  ready_location: string
  status_note: string
  cancel_reason: string
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const orderId = Number(id)
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm, setEditForm] = useState<OrderEditFormState>({
    client: "",
    order_date: "",
    delivery_date: "",
    currency: "UZS",
    discount_total: 0,
    notes: "",
    courier_name: "",
    status: "NEW",
    ready_location: "",
    status_note: "",
    cancel_reason: "",
  })

  const detailQuery = useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => fetchOrderDetail(orderId) as Promise<OrderDetailResponse>,
    enabled: Number.isFinite(orderId) && orderId > 0,
  })

  const productsQuery = useQuery({
    queryKey: ["orders", "products"],
    queryFn: () => fetchProducts() as Promise<Product[]>,
  })

  const clientsQuery = useQuery({
    queryKey: ["orders", "clients"],
    queryFn: () => fetchKontragents() as Promise<Kontragent[]>,
  })

  const locationsQuery = useQuery({
    queryKey: ["orders", "locations"],
    queryFn: () => fetchWarehouseLocations() as Promise<WarehouseLocation[]>,
  })

  const data = detailQuery.data
  const currentStatus = normalizeOrderStatus(data?.status)
  const editableStatuses = useMemo(() => getOrderStatusSelectOptions(data?.status), [data?.status])
  const statusOptions = useMemo(
    () =>
      editableStatuses.map((status) => ({
        value: status,
        label: orderStatusLabel(status),
      })),
    [editableStatuses]
  )
  const paymentLabel = useMemo(
    () => paymentStatusLabel(data?.paid_amount, data?.total, data?.payment_status),
    [data?.paid_amount, data?.payment_status, data?.total]
  )
  const clientOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const client of clientsQuery.data ?? []) {
      map.set(Number(client.id), client.name)
    }
    if (data?.client?.id && data.client?.name) {
      map.set(Number(data.client.id), data.client.name)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "uz"))
  }, [clientsQuery.data, data?.client?.id, data?.client?.name])
  const productHint = (productsQuery.data ?? [])
    .slice(0, 20)
    .map((item) => `${item.id}:${item.name}`)
    .join(", ")
  const locationHint = (locationsQuery.data ?? [])
    .slice(0, 20)
    .map((item) => `${item.id}:${item.name}`)
    .join(", ")

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate("/sotuv/orders")
  }

  const refresh = async () => {
    await detailQuery.refetch()
  }

  const runAction = async (task: () => Promise<unknown>, successText: string) => {
    try {
      await task()
      toast.success(successText)
      await refresh()
    } catch (error: any) {
      const message =
        String(error?.response?.data?.detail || "") ||
        (typeof error?.response?.data === "object" ? JSON.stringify(error.response.data) : "") ||
        String(error?.message || "Amal bajarilmadi")
      toast.error(message)
    }
  }

  const openEditDialog = () => {
    if (!data) return
    setEditForm({
      client: data.client?.id ? String(data.client.id) : "",
      order_date: toDateInputValue(data.order_date),
      delivery_date: toDateInputValue(data.delivery_date),
      currency: data.currency || "UZS",
      discount_total: Number(data.discount_total || 0),
      notes: String(data.notes ?? data.delivery_address ?? ""),
      courier_name: String(data.courier_name ?? ""),
      status: normalizeOrderStatus(data.status),
      ready_location: "",
      status_note: "",
      cancel_reason: String(data.cancelled_reason ?? ""),
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!data) return

    const currentOrderStatus = normalizeOrderStatus(data.status)
    const nextOrderStatus = normalizeOrderStatus(editForm.status)
    const cancelReason = editForm.cancel_reason.trim()
    let headerPatched = false

    try {
      setEditSaving(true)

      const patchedDetail = await patchOrderHeader(orderId, {
        client: editForm.client ? Number(editForm.client) : undefined,
        order_date: editForm.order_date || null,
        delivery_date: editForm.delivery_date || null,
        discount_total: Number(editForm.discount_total || 0),
        notes: editForm.notes || null,
        courier_name: editForm.courier_name || null,
      })
      headerPatched = true

      if (nextOrderStatus !== currentOrderStatus) {
        if (nextOrderStatus === "NEW") {
          throw new Error("Yangi status buyurtma yaratilganda backend tomonidan beriladi.")
        }

        if (nextOrderStatus === "IN_PROGRESS") {
          await confirmOrder(orderId)
        } else if (nextOrderStatus === "DELIVERED") {
          await deliverOrder(orderId)
        } else if (nextOrderStatus === "CANCELLED") {
          if (!cancelReason) {
            throw new Error("Bekor qilish sababini kiriting.")
          }
          await cancelOrder(orderId, cancelReason)
        }
      }

      setEditOpen(false)
      await refresh()
      toast.success("Buyurtma yangilandi")
    } catch (error: any) {
      if (headerPatched) {
        await refresh()
      }
      toast.error(extractApiErrorMessage(error, "Buyurtmani saqlab bo'lmadi"))
    } finally {
      setEditSaving(false)
    }
  }

  const updateStatus = async () => {
    if (!data) return
    const allowedStatuses = editableStatuses
    const status = promptValue(
      `Status kiriting: ${allowedStatuses.join(", ")}`,
      String(allowedStatuses.includes(normalizeOrderStatus(data.status)) ? data.status : allowedStatuses[0])
    )
    if (!status) return
    const normalizedStatus = normalizeOrderStatus(status)
    if (!allowedStatuses.includes(normalizedStatus)) {
      toast.error(`Ruxsat etilgan holatlar: ${allowedStatuses.join(", ")}`)
      return
    }
    if (normalizedStatus === "NEW") {
      toast.error("Yangi status buyurtma yaratilganda backend tomonidan beriladi.")
      return
    }
    if (normalizedStatus === "IN_PROGRESS") {
      await runAction(() => confirmOrder(orderId), "Buyurtma tasdiqlandi")
      return
    }
    if (normalizedStatus === "DELIVERED") {
      await runAction(() => deliverOrder(orderId), "Buyurtma yetkazildi")
      return
    }
    const cancelledReason = requestCancellationReason(data.cancelled_reason || "")
    if (!cancelledReason) return
    await runAction(() => cancelOrder(orderId, cancelledReason), "Buyurtma bekor qilindi")
  }

  const cancelCurrentOrder = async () => {
    if (!canCancelOrderStatus(currentStatus)) {
      toast.error("Bu buyurtmani hozir bekor qilib bo'lmaydi.")
      return
    }
    const reason = promptValue("Bekor qilish sababini kiriting", "")
    if (!reason) return
    await runAction(() => cancelOrder(orderId, reason), "Buyurtma bekor qilindi")
  }

  const addPayment = async () => {
    const method = promptValue("Method: CASH, CARD, BANK_TRANSFER", "CASH")
    if (!method) return
    const amount = promptValue("Amount", String(data?.remaining ?? ""))
    if (!amount) return
    const note = promptValue("Note", "") ?? ""
    await runAction(
      () =>
        addOrderPayment(orderId, {
          method,
          amount: Number(amount),
          currency: "UZS",
          note,
        }),
      "To'lov qo'shildi"
    )
  }

  const addItem = async () => {
    const product = promptValue(`Product id kiriting.\n${productHint}`, "")
    if (!product) return
    const productId = Number(product)
    if (!Number.isFinite(productId) || productId <= 0) {
      toast.error("Product id noto'g'ri")
      return
    }
    const duplicateItem = data?.items?.find((item) => Number(item?.product ?? 0) === productId)
    if (duplicateItem) {
      toast.error("Bu product orderda allaqachon mavjud. Mavjud qatorni tahrir qiling.")
      return
    }
    const qty = promptValue("Qty (masalan 2.000000)", "1.000000")
    if (!qty) return
    const unitPrice = promptValue("Unit price", "0")
    if (!unitPrice) return
    const ndsRate = promptValue("NDS rate (0.12 = 12%)", "0.12")
    if (!ndsRate) return
    await runAction(
      () =>
        addOrderItem(orderId, {
          product: productId,
          qty,
          unit_price: Number(unitPrice),
          nds_rate: ndsRate,
        }),
      "Item qo'shildi"
    )
  }

  const editItem = async (item: any) => {
    const qty = promptValue("Qty", String(item.qty ?? "1.000000"))
    if (!qty) return
    const unitPrice = promptValue("Unit price", String(item.unit_price ?? 0))
    if (!unitPrice) return
    const ndsRate = promptValue("NDS rate (0.12 = 12%)", String(item.nds_rate ?? "0.12"))
    if (!ndsRate) return
    await runAction(
      () =>
        updateOrderItem(orderId, item.id, {
          product: item.product ?? undefined,
          raw_material: item.raw_material ?? undefined,
          qty,
          unit_price: Number(unitPrice),
          nds_rate: ndsRate,
        }),
      "Item yangilandi"
    )
  }

  const reserveItem = async (item: any) => {
    const location = promptValue(`Location id kiriting.\n${locationHint}`, "")
    if (!location) return
    const qty = promptValue("Rezerv qty", String(item.qty ?? "1.000000"))
    if (!qty) return
    const note = promptValue("Note", "") ?? ""
    await runAction(
      () =>
        reserveOrderItem(orderId, {
          location: Number(location),
          item_id: item.id,
          qty,
          note,
        }),
      "Rezerv qo'yildi"
    )
  }

  const returnItemRow = async (item: any) => {
    const location = promptValue(`Location id kiriting.\n${locationHint}`, "")
    if (!location) return
    const qty = promptValue("Return qty", String(item.qty ?? "1.000000"))
    if (!qty) return
    const note = promptValue("Note", "") ?? ""
    await runAction(
      () =>
        returnOrderItem(orderId, {
          location: Number(location),
          item_id: item.id,
          qty,
          note,
        }),
      "Qaytarish rasmiylashtirildi"
    )
  }

  const printReceipt = async () => {
    const copiesRaw = promptValue("Nechta nusxa chop etilsin? (1-2)", "1")
    if (!copiesRaw) return
    const copies = Number(copiesRaw)
    if (!Number.isFinite(copies) || copies < 1 || copies > 2) {
      toast.error("Nusxa soni 1 yoki 2 bo'lishi kerak")
      return
    }
    await runAction(() => printOrderReceipt(orderId, copies), "Chek printerga yuborildi")
  }

  return (
    <div className="p-6">
      <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Order Detail</div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                {data?.order_no ? `Buyurtma ${data.order_no}` : "Buyurtma detail"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {data?.order_date ? `${formatDate(data.order_date)} sanasidagi buyurtma` : "Buyurtma tarkibi va to'lov holati"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Orqaga
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-900 to-blue-700 text-white"
                onClick={openEditDialog}
                disabled={!data || detailQuery.isFetching}
              >
                Tahrirlash
              </Button>
              <Button variant="outline" onClick={() => detailQuery.refetch()} disabled={detailQuery.isFetching}>
                <RefreshCcw className={`mr-2 h-4 w-4 ${detailQuery.isFetching ? "animate-spin" : ""}`} />
                Yangilash
              </Button>
            </div>
          </div>
        </div>

        {detailQuery.isLoading ? (
          <div className="px-6 py-12 text-sm text-slate-500">Buyurtma yuklanmoqda...</div>
        ) : detailQuery.isError ? (
          <div className="px-6 py-12 text-sm text-rose-600">Buyurtma detailini yuklab bo'lmadi.</div>
        ) : data ? (
          <div className="space-y-6 px-6 py-6">
            <section className="rounded-3xl bg-[linear-gradient(135deg,#052f52_0%,#0f4c81_55%,#0ea5a3_120%)] p-5 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Kontragent</div>
                  <div className="mt-2 text-2xl font-black">{data.client?.name || "-"}</div>
                  <div className="mt-2 text-sm text-white/75">
                    {data.notes ? `Izoh: ${data.notes}` : "Izoh kiritilmagan"}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">
                    {orderStatusLabel(currentStatus)}
                  </span>
                  <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">
                    {paymentLabel}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <InfoCard label="Jami summa" value={`${formatAmount(data.total)} ${data.currency || "UZS"}`} />
                <InfoCard label="To'langan" value={`${formatAmount(data.paid_amount)} ${data.currency || "UZS"}`} />
                <InfoCard label="Qoldiq" value={`${formatAmount(data.remaining)} ${data.currency || "UZS"}`} />
                <InfoCard label="Yetkazish sanasi" value={formatDate(data.delivery_date)} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 text-sm font-black text-slate-950">Actions</div>
              <div className="flex flex-wrap gap-2">
                <ActionButton label="Tahrirlash" onClick={openEditDialog} />
                <ActionButton
                  label="Confirm"
                  disabled={!canConfirmOrderStatus(currentStatus)}
                  onClick={() => void runAction(() => confirmOrder(orderId), "Buyurtma tasdiqlandi")}
                />
                <ActionButton label="Set status" disabled={editableStatuses.length <= 1} onClick={() => void updateStatus()} />
                <ActionButton label="Cancel" tone="danger" disabled={!canCancelOrderStatus(currentStatus)} onClick={() => void cancelCurrentOrder()} />
                <ActionButton label="Add payment" onClick={() => void addPayment()} />
                <ActionButton label="Print receipt" onClick={() => void printReceipt()} />
                <ActionButton label="Add item" onClick={() => void addItem()} />
                <ActionButton
                  label="Deliver"
                  disabled={!canDeliverOrderStatus(currentStatus)}
                  onClick={() => void runAction(() => deliverOrder(orderId), "Buyurtma yetkazildi")}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <div className="text-sm font-black text-slate-950">Items</div>
                  <div className="mt-1 text-xs text-slate-500">{(data.items || []).length} ta pozitsiya</div>
                </div>
                <div className="text-sm font-semibold text-slate-600">
                  Umumiy: <span className="text-slate-950">{formatAmount(data.total)} {data.currency || "UZS"}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50/80 text-slate-500">
                    <tr className="border-b border-slate-200/80">
                      <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.22em]">Nomi</th>
                      <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em]">Miqdor</th>
                      <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em]">Narx</th>
                      <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em]">NDS %</th>
                      <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em]">Jami</th>
                      <th className="px-4 py-4 text-right text-[11px] font-black uppercase tracking-[0.22em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.items || []).map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/35"}>
                        <td className="px-4 py-4 font-semibold text-slate-950">{itemName(item)}</td>
                        <td className="px-4 py-4 text-right">{formatAmount(item.qty)}</td>
                        <td className="px-4 py-4 text-right">{formatAmount(item.unit_price)}</td>
                        <td className="px-4 py-4 text-right">{formatTaxRatePercent(item.nds_rate)}</td>
                        <td className="px-4 py-4 text-right">{formatAmount(item.line_total)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <MiniButton label="Edit" onClick={() => void editItem(item)} />
                            <MiniButton label="Reserve" onClick={() => void reserveItem(item)} />
                            <MiniButton label="Return" onClick={() => void returnItemRow(item)} />
                            <MiniButton
                              label="Delete"
                              tone="danger"
                              onClick={() =>
                                window.confirm("Itemni o'chiraymi?") &&
                                void runAction(() => removeOrderItem(orderId, item.id), "Item o'chirildi")
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(data.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                          Bu buyurtma ichida pozitsiyalar topilmadi.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <SimplePanel title="Payments">
                {(data.payments || []).map((payment, index) => (
                  <PanelRow
                    key={payment.id ?? index}
                    title={`${payment.method || "-"} - ${formatAmount(payment.amount)} ${payment.currency || data.currency}`}
                    subtitle={String(payment.note || formatDate(payment.paid_at ?? payment.created_at))}
                  />
                ))}
                {(data.payments || []).length === 0 ? <EmptyState text="To'lovlar hali yo'q." /> : null}
              </SimplePanel>

              <SimplePanel title="Reservations">
                {(data.reservations || []).map((reservation, index) => {
                  const reservationId = reservationIdOf(reservation)
                  return (
                    <PanelRow
                      key={reservationId ?? index}
                      title={`${reservation.location_name || "Lokatsiya"} - ${reservation.qty || "-"}`}
                      subtitle={String(reservation.note || "") || "Izoh yo'q"}
                      action={
                        <MiniButton
                          label="Unreserve"
                          tone="danger"
                          disabled={!reservationId}
                          onClick={() => reservationId && void runAction(() => unreserveOrder(orderId, reservationId), "Rezerv bekor qilindi")}
                        />
                      }
                    />
                  )
                })}
                {(data.reservations || []).length === 0 ? <EmptyState text="Rezervlar hali yo'q." /> : null}
              </SimplePanel>

              <SimplePanel title="Status History">
                {(data.status_history || []).map((row, index) => (
                  <PanelRow
                    key={row.id ?? index}
                    title={formatStatusHistoryTitle(row)}
                    subtitle={String(row.note || formatDate(row.created_at))}
                  />
                ))}
                {(data.status_history || []).length === 0 ? <EmptyState text="Status tarixi hali yo'q." /> : null}
              </SimplePanel>
            </section>
          </div>
        ) : (
          <div className="px-6 py-12 text-sm text-slate-500">Buyurtma topilmadi.</div>
        )}
      </div>

      <OrderEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        detail={data}
        onSaved={() => refresh()}
      />
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
      <div className="text-xs text-white/65">{label}</div>
      <div className="mt-2 text-xl font-black">{value}</div>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  tone = "default",
  disabled = false,
}: {
  label: string
  onClick: () => void
  tone?: "default" | "danger"
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={
        tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          : "border-slate-200 bg-white text-slate-900 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
      }
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function MiniButton({
  label,
  onClick,
  tone = "default",
  disabled = false,
}: {
  label: string
  onClick: () => void
  tone?: "default" | "danger"
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-xs font-semibold transition",
        tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {label}
    </button>
  )
}

function SimplePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="text-sm font-black text-slate-950">{title}</div>
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </section>
  )
}

function PanelRow({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-slate-900">{title}</div>
        {action}
      </div>
      <div className="mt-2 text-xs text-slate-500">{subtitle || "Izoh yo'q"}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">{text}</div>
}
