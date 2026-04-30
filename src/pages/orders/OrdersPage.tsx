// src/pages/OrdersPage.tsx
import { Fragment, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import TablePagination from "@/components/common/TablePagination"
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { ArrowDownUp, ChevronDown, ChevronUp, RefreshCcw, RotateCcw, Trash2 } from "lucide-react"
import OrderCreateDialog from "@/pages/orders/components/OrderCreateDialog"
import OrderEditDialog from "@/pages/orders/components/OrderEditDialog"
import {
  deleteOrder,
  cancelOrder,
  confirmOrder,
  deliverOrder,
  exportOrderShipmentsReport,
  fetchAllOrders,
  fetchAllOrderShipments,
  fetchKontragents,
  fetchOrderDetail as fetchOrderDetailRequest,
  canCancelOrderStatus,
  canConfirmOrderStatus,
  canDeliverOrderStatus,
  getOrderStatusSelectOptions,
  isOrderStatus,
  normalizeOrderStatus,
  ORDER_STATUS_VALUES,
  patchOrderHeader,
  type Kontragent,
  type OrderDetailResponse,
  type OrderShipmentRow,
  type OrderStatus,
  type OrderSummary,
} from "@/pages/orders/api/ordersApi"
import { api } from "@/lib/api"
import { toast } from "react-toastify"
import { useI18n } from "@/i18n"

type OrderRow = OrderSummary & { nds_total?: number; nds_percent?: number }
type OrdersTabKey = "ALL" | "DONE" | "CANCELLED"
type OrderSortKey = "order_no" | "client" | "total" | "order_date" | "delivery_date"
type SortDirection = "asc" | "desc"

type OrderFilterStatus = "ALL" | OrderStatus
type OrdersPageFilters = {
  search: string
  status: OrderFilterStatus
  payment_status: "ALL" | "UNPAID" | "PARTIAL" | "PAID"
  shipment_state: "ALL" | "none" | "partial" | "full"
  client: string
  date_from: string
  date_to: string
}
type OrderEditFormState = {
  client: string
  order_date: string
  delivery_date: string
  currency: string
  discount_total: number
  delivery_address: string
  courier_name: string
  status: OrderStatus
}

type OrdersPageProps = {
  initialTab?: OrdersTabKey
}

function formatTaxRatePercent(value: unknown) {
  const rate = Number(value ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) return "0%"
  const percent = rate <= 1 ? rate * 100 : rate
  return `${percent.toLocaleString("uz-UZ", { maximumFractionDigits: 2 })}%`
}

function isDoneStatus(value: unknown) {
  const s = normalizeOrderStatus(value)
  return s === "DELIVERED"
}

function isCancelledStatus(value: unknown) {
  const s = normalizeOrderStatus(value)
  return s === "CANCELLED"
}

function promptValue(label: string, current = "") {
  const result = window.prompt(label, current)
  return result === null ? null : result.trim()
}

function formatOrderNumber(value?: string | null, fallbackId?: number | string) {
  const source = String(value ?? "").trim()
  const digits = source.replace(/\D+/g, "")

  if (digits) return `№${Number(digits)}`
  if (fallbackId !== undefined && fallbackId !== null) return `№${fallbackId}`
  return "№-"
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

type OrderDetail = OrderDetailResponse

type FinancePaymentRefRow = {
  amount?: number | string
  entry_type?: string
  entryType?: string
  type?: string
  ref_type?: string
  reference_type?: string
  referenceType?: string
  ref_id?: number | string
  reference_id?: number | string
  referenceId?: number | string
}

function normalizeApiList<T>(payload: { rows?: T[]; results?: T[] } | T[]) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray((payload as { results?: T[] })?.results)) return (payload as { results?: T[] }).results || []
  return []
}

function formatShipmentCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-"
  if (Array.isArray(value)) return value.map((item) => formatShipmentCell(item)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

async function fetchAllRows<T>(path: string) {
  const rows: T[] = []
  let page = 1
  let hasNext = true
  const useCompactFinancePagination = path.startsWith("/api/v1/finance/")

  while (hasNext) {
    const { data } = await api.get(path, {
      params: {
        page,
        ...(useCompactFinancePagination ? {} : { page_size: 200 }),
      },
    })
    const list = normalizeApiList<T>(data)
    rows.push(...list)

    if (Array.isArray(data)) {
      hasNext = false
      continue
    }

    const next = (data as { next?: unknown }).next
    const count = Number((data as { count?: unknown }).count)
    if (typeof next === "string" && next) {
      page += 1
      continue
    }
    if (Number.isFinite(count) && rows.length < count) {
      page += 1
      continue
    }
    hasNext = false
  }

  return rows
}

function paymentRefType(row: FinancePaymentRefRow) {
  return String(row.ref_type ?? row.reference_type ?? row.referenceType ?? "").toUpperCase()
}

function paymentRefId(row: FinancePaymentRefRow) {
  const raw = row.ref_id ?? row.reference_id ?? row.referenceId
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

function paymentSignedAmount(row: FinancePaymentRefRow) {
  const amount = Number(row.amount ?? 0)
  if (!Number.isFinite(amount)) return 0
  const entryType = String(row.entry_type ?? row.entryType ?? row.type ?? "").toUpperCase()
  if (entryType === "EXPENSE") return -Math.abs(amount)
  return amount
}

function collectOrderPaymentMap(rows: FinancePaymentRefRow[]) {
  const map = new Map<number, number>()
  rows.forEach((row) => {
    if (paymentRefType(row) !== "ORDER") return
    const orderId = paymentRefId(row)
    if (!orderId) return
    map.set(orderId, (map.get(orderId) || 0) + paymentSignedAmount(row))
  })
  return map
}

export default function OrdersPage({ initialTab = "ALL" }: OrdersPageProps) {
  const { language } = useI18n()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [clients, setClients] = useState<Kontragent[]>([])
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const [shipmentsOpen, setShipmentsOpen] = useState(false)
  const [shipmentsLoading, setShipmentsLoading] = useState(false)
  const [shipmentRows, setShipmentRows] = useState<OrderShipmentRow[]>([])
  const [activeTab, setActiveTab] = useState<OrdersTabKey>(initialTab)
  const [sortKey, setSortKey] = useState<OrderSortKey>("order_date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const headerDividerClass =
    "[&_th:not(:last-child)]:relative [&_th:not(:last-child)]:pr-5 [&_th:not(:last-child)]:after:absolute [&_th:not(:last-child)]:after:right-1.5 [&_th:not(:last-child)]:after:top-1/2 [&_th:not(:last-child)]:after:-translate-y-1/2 [&_th:not(:last-child)]:after:opacity-60 [&_th:not(:last-child)]:after:content-['|']"
  const [activeOrder, setActiveOrder] = useState<OrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filters, setFilters] = useState<OrdersPageFilters>({
    search: "",
    status: "ALL",
    payment_status: "ALL",
    shipment_state: "ALL",
    client: "ALL",
    date_from: "",
    date_to: "",
  })
  const [editForm, setEditForm] = useState<OrderEditFormState>({
    client: "",
    order_date: "",
    delivery_date: "",
    currency: "UZS",
    discount_total: 0,
    delivery_address: "",
    courier_name: "",
    status: "NEW",
  })
  const formatAmount = (n: number | string | null | undefined) => {
    const num = Number(n ?? 0)
    if (!Number.isFinite(num)) return "0"
    const sign = num < 0 ? "-" : ""
    const abs = Math.abs(Math.trunc(num))
    return `${sign}${String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`
  }
  const parseAmountInput = (v: string) => {
    const cleaned = v.replace(/\s/g, "").replace(/,/g, "")
    const num = Number(cleaned)
    return Number.isFinite(num) ? num : 0
  }
  const formatDate = (v: string | null | undefined) => {
    if (!v) return "-"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${dd}.${mm}.${yyyy}`
  }
  const formatDateTime = (v: string | null | undefined) => {
    if (!v) return "-"
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, "0")
    const min = String(d.getMinutes()).padStart(2, "0")
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`
  }
  const copy =
    language === "ru"
      ? {
        cancelReasonPrompt: "Введите причину отмены",
        cancelReasonRequired: "Введите причину отмены",
        newManualUnsupported: "Статус NEW нельзя установить вручную.",
        confirmUnsupported: "Статус IN_PROGRESS доступен только для NEW или CANCELLED.",
        cancelUnsupported: "Отмена доступна только для NEW или IN_PROGRESS.",
        deliverUnsupported: "Доставка доступна только для IN_PROGRESS.",
        status: {
          NEW: "Новый",
          IN_PROGRESS: "В процессе",
          DELIVERED: "Доставлен",
          CANCELLED: "Отменен",
          NO_STATUS: "Без статуса",
        },
        payment: {
          fullyPaid: "Полностью оплачено",
          partialPercent: "{{percent}}% оплачено",
          halfPaid: "Оплачена половина",
          unpaid: "Не оплачено",
          paid: "Оплачено",
          partial: "Частично оплачено",
          statusTitle: "Статус оплаты",
          paidLabel: "Оплачено",
          remainingLabel: "Остаток",
          totalLabel: "Итого",
        },
        tabs: {
          all: "Заказы",
          done: "Отгрузки (реализация)",
          cancelled: "Отмененные",
          allSubtitle: "Список заказов",
          doneSubtitle: "Список выполненных заказов",
          cancelledSubtitle: "Список отмененных заказов",
        },
        toast: {
          updated: "Заказ успешно обновлен",
          deleted: "Заказ удален",
          statusUpdated: "Статус обновлен",
        },
        errors: {
          editOpen: "Ошибка открытия редактирования",
          editSave: "Ошибка сохранения",
          delete: "Ошибка удаления",
          status: "Не удалось обновить статус",
          view: "Ошибка просмотра",
          download: "Ошибка загрузки",
        },
        actions: {
          loading: "Загрузка",
          refresh: "Обновить",
        },
        filters: {
          search: "Поиск по номеру заказа",
          allStatuses: "Все статусы",
          allPaymentStatuses: "Все статусы оплаты",
          allShipmentStates: "Все статусы отгрузки",
          unpaid: "Не оплачено",
          partial: "Частично оплачено",
          paid: "Оплачено",
          allClients: "Все клиенты",
          shipmentState: "Отгрузка",
          shipmentNone: "Не отгружено",
          shipmentPartial: "Частично",
          shipmentFull: "Полностью",
        },
        table: {
          orderNo: "Номер заказа",
          client: "Контрагент",
          dateTimeClient: "Дата и время / Контрагент",
          total: "Итого",
          status: "Статус",
          paymentStatus: "Статус оплаты",
          orderDate: "Дата заказа",
          deliveryDate: "Дата доставки",
          doneGroup: "Всего {{count}} реализаций, сумма {{total}}",
          group: "Всего {{count}} заказов, сумма {{total}}",
          empty: "Заказы не найдены",
        },
        footer: {
          total: "Всего: {{count}} шт",
          pageSize: "Размер страницы:",
        },
        view: {
          title: "Заказ №",
          edit: "Редактировать",
          loading: "Загрузка...",
          client: "Контрагент",
          orderDate: "Дата заказа",
          deliveryDate: "Дата доставки",
          currency: "Валюта",
          itemsTitle: "Товары / услуги",
          name: "Наименование",
          qty: "Количество",
          price: "Цена",
          ndsPercent: "НДС %",
          ndsAmount: "Сумма НДС",
          lineTotal: "Сумма строки",
          itemsEmpty: "В этом заказе товары не найдены",
          subtotal: "Подытог",
          nds: "НДС",
          grandTotal: "Общий итог",
          noData: "Данные не найдены",
        },
        edit: {
          title: "Редактирование заказа",
          loading: "Загрузка...",
          orderDate: "Дата заказа",
          deliveryDate: "Дата доставки",
          status: "Статус",
          currency: "Валюта",
          discountTotal: "Сумма скидки",
          deliveryAddress: "Примечание",
          courierName: "Курьер",
          cancel: "Отмена",
          save: "Сохранить",
        },
        deleteDialog: {
          title: "Удаление",
          descriptionPrefix: "Вы действительно хотите удалить",
          fallbackOrder: "заказ",
          descriptionSuffix: "?",
        },
      }
      : language === "en"
        ? {
          cancelReasonPrompt: "Enter cancellation reason",
          cancelReasonRequired: "Enter cancellation reason",
          newManualUnsupported: "NEW status cannot be set manually.",
          confirmUnsupported: "IN_PROGRESS is only available for NEW or CANCELLED.",
          cancelUnsupported: "Cancellation is only available for NEW or IN_PROGRESS.",
          deliverUnsupported: "Delivery is only available for IN_PROGRESS.",
          status: {
            NEW: "New",
            IN_PROGRESS: "In progress",
            DELIVERED: "Delivered",
            CANCELLED: "Cancelled",
            NO_STATUS: "No status",
          },
          payment: {
            fullyPaid: "Fully paid",
            partialPercent: "{{percent}}% paid",
            halfPaid: "Half paid",
            unpaid: "Unpaid",
            paid: "Paid",
            partial: "Partially paid",
            statusTitle: "Payment status",
            paidLabel: "Paid",
            remainingLabel: "Remaining",
            totalLabel: "Total",
          },
          tabs: {
            all: "Orders",
            done: "Completed",
            cancelled: "Cancelled",
            allSubtitle: "Order list",
            doneSubtitle: "Completed orders list",
            cancelledSubtitle: "Cancelled orders list",
          },
          toast: {
            updated: "Order updated successfully",
            deleted: "Order deleted",
            statusUpdated: "Status updated",
          },
          errors: {
            editOpen: "Edit open error",
            editSave: "Edit save error",
            delete: "Delete error",
            status: "Failed to update status",
            view: "View error",
            download: "Download error",
          },
          actions: {
            loading: "Loading",
            refresh: "Refresh",
          },
          filters: {
            search: "Search by order number",
            allStatuses: "All statuses",
            allPaymentStatuses: "All payment statuses",
            allShipmentStates: "All shipment states",
            unpaid: "Unpaid",
            partial: "Partially paid",
            paid: "Paid",
            allClients: "All clients",
            shipmentState: "Shipment state",
            shipmentNone: "Not shipped",
            shipmentPartial: "Partially shipped",
            shipmentFull: "Fully shipped",
          },
          table: {
            orderNo: "Order number",
            client: "Counterparty",
            dateTimeClient: "Date and time / Counterparty",
            total: "Total",
            status: "Status",
            paymentStatus: "Payment status",
            orderDate: "Order date",
            deliveryDate: "Delivery date",
            doneGroup: "Total {{count}} realizations, amount {{total}}",
            group: "Total {{count}} orders, amount {{total}}",
            empty: "No orders found",
          },
          footer: {
            total: "Total: {{count}} pcs",
            pageSize: "Page size:",
          },
          view: {
            title: "Order №",
            edit: "Edit",
            loading: "Loading...",
            client: "Counterparty",
            orderDate: "Order date",
            deliveryDate: "Delivery date",
            currency: "Currency",
            itemsTitle: "Goods / services",
            name: "Name",
            qty: "Qty",
            price: "Price",
            ndsPercent: "VAT %",
            ndsAmount: "VAT amount",
            lineTotal: "Line total",
            itemsEmpty: "No items found in this order",
            subtotal: "Subtotal",
            nds: "VAT",
            grandTotal: "Grand total",
            noData: "No data found",

          },
          edit: {
            title: "Edit order",
            loading: "Loading...",
            orderDate: "Order date",
            deliveryDate: "Delivery date",
            status: "Status",
            currency: "Currency",
            discountTotal: "Discount total",
            deliveryAddress: "Notes",
            courierName: "Courier",
            cancel: "Cancel",
            save: "Save",
          },
          deleteDialog: {
            title: "Delete",
            descriptionPrefix: "Are you sure you want to delete",
            fallbackOrder: "order",
            descriptionSuffix: "?",
          },
        }
        : {
            cancelReasonPrompt: "Bekor qilish sababini kiriting",
            cancelReasonRequired: "Bekor qilish sababini kiriting",
             newManualUnsupported: "NEW holatini qo'lda o'rnatib bo'lmaydi.",
             confirmUnsupported: "IN_PROGRESS holati faqat NEW yoki CANCELLED uchun ochiq.",
             cancelUnsupported: "Bekor qilish faqat NEW yoki IN_PROGRESS uchun ochiq.",
             deliverUnsupported: "Yetkazish faqat IN_PROGRESS holati uchun ochiq.",
             status: {
               NEW: "Yangi",
               IN_PROGRESS: "Jarayonda",
              DELIVERED: "Yetkazildi",
              CANCELLED: "Bekor qilingan",
              NO_STATUS: "Statussiz",
            },
            payment: {
              fullyPaid: "To'liq to'landi",
              partialPercent: "{{percent}}% to'landi",
              halfPaid: "Yarmi to'landi",
              unpaid: "To'lanmagan",
              paid: "To'langan",
              partial: "Qisman to'langan",
              statusTitle: "To'lov holati",
              paidLabel: "To'langan",
              remainingLabel: "Qoldiq",
              totalLabel: "Jami",
            },
            tabs: {
              all: "Buyurtmalar",
              done: "Amalga oshirilgan",
              cancelled: "Bekor qilingan",
              allSubtitle: "Buyurtmalar ro'yxati",
              doneSubtitle: "Amalga oshirilgan buyurtmalar ro'yxati",
              cancelledSubtitle: "Bekor qilingan buyurtmalar ro'yxati",
            },
            toast: {
              updated: "Zakaz muvaffaqiyatli yangilandi",
              deleted: "Zakaz o'chirildi",
              statusUpdated: "Status yangilandi",
            },
            errors: {
              editOpen: "Edit open error",
              editSave: "Edit save error",
              delete: "Delete error",
              status: "Statusni yangilab bo'lmadi",
              view: "View error",
              download: "Download error",
            },
            actions: {
              loading: "Yuklanmoqda",
              refresh: "Yangilash",
            },
            filters: {
              search: "Buyurtma raqami bo'yicha qidirish",
              allStatuses: "Barcha status",
              allPaymentStatuses: "Barcha to'lov holati",
              allShipmentStates: "Barcha jo'natish holati",
              unpaid: "To'lanmagan",
              partial: "Qisman to'langan",
              paid: "To'langan",
              allClients: "Barcha mijozlar",
              shipmentState: "Jo'natish holati",
              shipmentNone: "Jo'natilmagan",
              shipmentPartial: "Qisman jo'natilgan",
              shipmentFull: "To'liq jo'natilgan",
            },
            table: {
              orderNo: "Buyurtma raqami",
              client: "Kontragent",
              dateTimeClient: "Sana va vaqt / Kontragent",
              total: "Jami",
              status: "Status",
              paymentStatus: "To'lov holati",
              orderDate: "Buyurtma sana",
              deliveryDate: "Yetkazib berish sana",
              doneGroup: "Jami {{count}} ta realizatsiya, summa {{total}}",
              group: "Jami {{count}} ta buyurtma, summa {{total}}",
              empty: "Buyurtma topilmadi",
            },
            footer: {
              total: "Jami: {{count}} ta",
              pageSize: "Sahifa hajmi:",
            },
            view: {
              title: "Buyurtma №",
              edit: "Tahrirlash",
              loading: "Yuklanmoqda...",
              client: "Kontragent",
              orderDate: "Buyurtma sanasi",
              deliveryDate: "Yetkazib berish sanasi",
              currency: "Valyuta",
              itemsTitle: "Tovarlar / xizmatlar",
              name: "Nomi",
              qty: "Miqdor",
              price: "Narx",
              ndsPercent: "QQS %",
              ndsAmount: "QQS summa",
              lineTotal: "Line total",
              itemsEmpty: "Bu buyurtmada item topilmadi",
              subtotal: "Subtotal",
              nds: "QQS",
              grandTotal: "Umumiy",
              noData: "Ma'lumot topilmadi",
            },
            edit: {
              title: "Buyurtma o'zgartirish",
              loading: "Yuklanmoqda...",
              orderDate: "Buyurtma sanasi",
              deliveryDate: "Yetkazib berish sanasi",
              status: "Status",
              currency: "Valyuta",
              discountTotal: "Discount total",
              deliveryAddress: "Izoh",
              courierName: "Kuryer",
              cancel: "Bekor qilish",
              save: "Saqlash",
            },
            deleteDialog: {
              title: "O'chirish",
              descriptionPrefix: "Rostdan ham",
              fallbackOrder: "zakaz",
              descriptionSuffix: "ni o'chirmoqchimisiz?",
            },
          }
  const getStatusBadgeClass = (status?: string) => {
    switch (normalizeOrderStatus(status)) {
      case "NEW":
        return "bg-sky-50 text-sky-700 border-sky-200"
      case "IN_PROGRESS":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "CANCELLED":
        return "bg-orange-50 text-orange-700 border-orange-200"
      default:
        return "bg-slate-50 text-slate-700 border-slate-200"
    }
  }
  const toDateInputValue = (v: string | null | undefined) => {
    if (!v) return ""
    const s = String(v)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ""
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }
  const requestCancellationReasonLocal = (current = "") => {
    const reason = promptValue(copy.cancelReasonPrompt, current)
    if (reason === null) return null
    if (!reason) {
      toast.error(copy.cancelReasonRequired)
      return null
    }
    return reason
  }
  const applyOrderDetailToState = async (detail: OrderDetail) => {
    if (activeOrder?.id === detail.id) {
      setActiveOrder(detail)
    }
    await load(currentPage)
  }
  const runOrderStatusChange = async (orderId: number, nextStatus: OrderStatus, currentCancelReason = "") => {
    if (nextStatus === "NEW") {
      throw new Error(copy.newManualUnsupported)
    }

    const freshDetail = await fetchOrderDetailRequest(orderId)
    const freshStatus = normalizeOrderStatus(freshDetail.status)
    if (freshStatus === nextStatus) return freshDetail

    if (nextStatus === "IN_PROGRESS") {
      if (!canConfirmOrderStatus(freshStatus)) {
        throw new Error(copy.confirmUnsupported)
      }
      return confirmOrder(orderId)
    }

    if (nextStatus === "CANCELLED") {
      if (!canCancelOrderStatus(freshStatus)) {
        throw new Error(copy.cancelUnsupported)
      }
      const cancelledReason = requestCancellationReasonLocal(currentCancelReason)
      if (!cancelledReason) return null
      return cancelOrder(orderId, cancelledReason)
    }

    if (nextStatus === "DELIVERED") {
      if (!canDeliverOrderStatus(freshStatus)) {
        throw new Error(copy.deliverUnsupported)
      }
      return deliverOrder(orderId)
    }

    throw new Error(copy.errors.status)
  }

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])
  const allStatusOptions = ORDER_STATUS_VALUES.map((value) => ({
    value,
    label: copy.status[value],
  }))
  const clientSelectOptions = useMemo(() => {
    const byId = new Map<number, string>()
    for (const client of clients) {
      byId.set(Number(client.id), client.name)
    }
    if (activeOrder?.client?.id) {
      byId.set(Number(activeOrder.client.id), activeOrder.client.name || `#${activeOrder.client.id}`)
    }
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, language === "ru" ? "ru" : "uz"))
  }, [activeOrder?.client?.id, activeOrder?.client?.name, clients, language])
  const statusLabel = (status?: string) => {
    const normalized = normalizeOrderStatus(status)
    if (normalized === "UNKNOWN") return String(status || copy.status.NO_STATUS)
    return copy.status[normalized]
  }
  const paymentMeta = (paidRaw: number, totalRaw: number, paymentStatus?: string) => {
    const total = Math.max(0, Number(totalRaw || 0))
    const paid = Math.max(0, Number(paidRaw || 0))
    const effectiveTotal = total > 0 ? total : paid > 0 ? paid : 0
    const percent = effectiveTotal > 0 ? Math.min(100, Math.round((paid / effectiveTotal) * 100)) : 0
    const status = String(paymentStatus || "").toUpperCase()

    if (status === "PAID" || percent >= 100) {
      return {
        percent: 100,
        label: copy.payment.fullyPaid,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
        bar: "from-emerald-500 to-emerald-600",
      }
    }
    if (status === "PARTIAL" || (percent > 0 && percent < 100)) {
      if (percent < 50) {
        return {
          percent,
          label: copy.payment.partialPercent.replace("{{percent}}", String(percent)),
          tone: "border-amber-200 bg-amber-50 text-amber-700",
          bar: "from-amber-500 to-yellow-500",
        }
      }
      return {
        percent,
        label: copy.payment.halfPaid,
        tone: "border-sky-200 bg-sky-50 text-sky-700",
        bar: "from-sky-500 to-blue-600",
      }
    }
    return {
      percent: 0,
      label: copy.payment.unpaid,
      tone: "border-rose-200 bg-rose-50 text-rose-700",
      bar: "from-rose-400 to-rose-500",
    }
  }
  const paymentStatusBadgeClass = (label: string) => {
    if (label === copy.payment.fullyPaid || label === copy.payment.paid) return "border-emerald-200 bg-emerald-50 text-emerald-700"
    if (label === copy.payment.halfPaid || label.includes(copy.payment.partialPercent.replace("{{percent}}", "")) || label === copy.payment.partial) {
      return "border-amber-200 bg-amber-50 text-amber-700"
    }
    return "border-rose-200 bg-rose-50 text-rose-700"
  }
  const paymentStatusLabel = (paidRaw: number, totalRaw: number, paymentStatus?: string) => {
    const meta = paymentMeta(paidRaw, totalRaw, paymentStatus)
    if (meta.percent >= 100) return copy.payment.paid
    if (meta.percent > 0) return copy.payment.partial
    return copy.payment.unpaid
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const filteredRows = useMemo(() => {
    if (activeTab === "ALL") return rows
    if (activeTab === "DONE") {
      return rows.filter((row) => isDoneStatus(row.status))
    }
    return rows.filter((row) => isCancelledStatus(row.status))
  }, [rows, activeTab])

  const sortedRows = useMemo(() => {
    const toTimestamp = (value?: string | null) => {
      if (!value) return 0
      const time = new Date(value).getTime()
      return Number.isFinite(time) ? time : 0
    }

    const toNumericOrder = (value?: string | null, fallbackId?: number) => {
      const text = String(value ?? "").trim()
      const digits = text.replace(/\D+/g, "")
      if (digits) return Number(digits)
      return Number(fallbackId ?? 0)
    }

    const compareText = (a: string, b: string) => a.localeCompare(b, language === "ru" ? "ru" : language === "en" ? "en" : "uz", { sensitivity: "base" })

    const list = [...filteredRows]
    list.sort((a, b) => {
      let result = 0

      if (sortKey === "order_no") {
        result = toNumericOrder(a.order_no, a.id) - toNumericOrder(b.order_no, b.id)
      } else if (sortKey === "client") {
        const left = activeTab === "DONE"
          ? `${String(a.created_at ?? "")} ${String(a.client_name ?? "")}`.trim()
          : String(a.client_name ?? "")
        const right = activeTab === "DONE"
          ? `${String(b.created_at ?? "")} ${String(b.client_name ?? "")}`.trim()
          : String(b.client_name ?? "")
        result = compareText(left, right)
      } else if (sortKey === "total") {
        result = Number(a.total ?? 0) - Number(b.total ?? 0)
      } else if (sortKey === "delivery_date") {
        result = toTimestamp(a.delivery_date) - toTimestamp(b.delivery_date)
      } else {
        result = toTimestamp(a.order_date || a.created_at) - toTimestamp(b.order_date || b.created_at)
      }

      if (result === 0) {
        result = toTimestamp(a.created_at) - toTimestamp(b.created_at)
      }

      return sortDirection === "asc" ? result : -result
    })
    return list
  }, [activeTab, filteredRows, language, sortDirection, sortKey])

  const groupedRows = useMemo(() => {
    const bucket = new Map<string, OrderRow[]>()

    for (const key of ORDER_STATUS_VALUES) bucket.set(key, [])
    for (const row of sortedRows) {
      const key = normalizeOrderStatus(row.status)

      if (!bucket.has(key)) bucket.set(key, [])
      bucket.get(key)!.push(row)
    }
    return Array.from(bucket.entries()).filter(([, list]) => list.length > 0)
  }, [sortedRows])
  const doneDateGroups = useMemo(() => {
    if (activeTab !== "DONE") return []
    const map = new Map<string, OrderRow[]>()
    sortedRows.forEach((row) => {
      const key = String(row.order_date || "").slice(0, 10) || "unknown"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    })

    return Array.from(map.entries())
      .sort(([a], [b]) => String(b).localeCompare(String(a)))
      .map(([key, list]) => ({
        key,
        label: formatDate(key),
        list,
        total: list.reduce((sum, row) => sum + Number(row.total || 0), 0),
      }))
  }, [activeTab, sortedRows])
  const allVisibleSelected = sortedRows.length > 0 && sortedRows.every((row) => selectedIds.includes(row.id))

  const toggleSort = (key: OrderSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDirection(key === "client" ? "asc" : "desc")
  }

  const renderSortIcon = (key: OrderSortKey) => {
    if (sortKey !== key) return <ArrowDownUp className="h-4 w-4 opacity-70" />
    return sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
  }

  const tabItems = useMemo(
    () => [
      { key: "ALL" as const, label: copy.tabs.all, count: rows.length },
      {
        key: "DONE" as const,
        label: copy.tabs.done,
        count: rows.filter((row) => isDoneStatus(row.status)).length,
      },
      {
        key: "CANCELLED" as const,
        label: copy.tabs.cancelled,
        count: rows.filter((row) => isCancelledStatus(row.status)).length,
      },
    ],
    [rows]
  )
  const activeTabMeta = useMemo(() => {
    if (activeTab === "DONE") {
      return {
        title: copy.tabs.done,
        subtitle: copy.tabs.doneSubtitle,
      }
    }
    if (activeTab === "CANCELLED") {
      return {
        title: copy.tabs.cancelled,
        subtitle: copy.tabs.cancelledSubtitle,
      }
    }
    return {
      title: copy.tabs.all,
      subtitle: copy.tabs.allSubtitle,
    }
  }, [activeTab, copy.tabs])

  const shipmentColumns = useMemo(() => {
    const discovered = Array.from(
      new Set(
        shipmentRows.flatMap((row) =>
          Object.keys(row).filter((key) => key !== "id" && key !== "order_id")
        )
      )
    )
    const preferred = ["order_no", "client_name", "product_name", "qty", "location_name", "created_at"]
    return [...preferred.filter((key) => discovered.includes(key)), ...discovered.filter((key) => !preferred.includes(key))].slice(0, 10)
  }, [shipmentRows])

  // Order listni pagination bilan olib keladi va NDS ma'lumotini detaildan to'ldiradi.
  const load = async (page = currentPage) => {
    try {
      setLoading(true)
      const orderFilters = {
        search: filters.search.trim() || undefined,
        status: filters.status === "ALL" ? undefined : filters.status,
        payment_status: filters.payment_status === "ALL" ? undefined : filters.payment_status,
        shipment_state: filters.shipment_state === "ALL" ? undefined : filters.shipment_state,
        client: filters.client === "ALL" ? undefined : Number(filters.client),
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      }
      const [allOrders, paymentRows, ledgerRows] = await Promise.all([
        fetchAllOrders(orderFilters),
        fetchAllRows<FinancePaymentRefRow>("/api/v1/finance/payments/").catch(() => []),
        fetchAllRows<FinancePaymentRefRow>("/api/v1/finance/ledger/").catch(() => []),
      ])
      const totalRows = (Array.isArray(allOrders) ? allOrders : []).filter((row) => isOrderStatus(row.status))
      const safePage = Math.max(1, Number(page || 1))
      const startIndex = (safePage - 1) * pageSize
      const endIndex = startIndex + pageSize
      const list = totalRows.slice(startIndex, endIndex)

      setTotalCount(totalRows.length)
      setCurrentPage(safePage)
      const orderPaymentMap = collectOrderPaymentMap([...paymentRows, ...ledgerRows])

      const withNds = await Promise.all(
        list.map(async (row) => {
          try {
            const detail = await fetchOrderDetailRequest(row.id)
            const subtotal = Number(detail?.subtotal || 0)
            const ndsTotal = Number(detail?.nds_total || 0)
            const ndsPercent = subtotal > 0 ? (ndsTotal / subtotal) * 100 : 0
            const apiPaid = Number(row.paid_amount || 0)
            const orderPaid = Math.max(0, Number(orderPaymentMap.get(Number(row.id)) || 0))
            const effectivePaid = Math.max(apiPaid, orderPaid)
            const total = Math.max(0, Number(row.total || detail?.total || 0))
            const remaining = Math.max(total - effectivePaid, 0)
            const payment_status =
              effectivePaid >= total && total > 0
                ? "PAID"
                : effectivePaid > 0
                  ? "PARTIAL"
                  : String(row.payment_status || "UNPAID")
            return {
              ...row,
              status: normalizeOrderStatus(row.status),
              paid_amount: effectivePaid,
              remaining,
              payment_status,
              nds_total: ndsTotal,
              nds_percent: ndsPercent,
            }
          } catch {
            const apiPaid = Number(row.paid_amount || 0)
            const orderPaid = Math.max(0, Number(orderPaymentMap.get(Number(row.id)) || 0))
            const effectivePaid = Math.max(apiPaid, orderPaid)
            const total = Math.max(0, Number(row.total || 0))
            const remaining = Math.max(total - effectivePaid, 0)
            const payment_status =
              effectivePaid >= total && total > 0
                ? "PAID"
                : effectivePaid > 0
                  ? "PARTIAL"
                  : String(row.payment_status || "UNPAID")
            return {
              ...row,
              status: normalizeOrderStatus(row.status),
              paid_amount: effectivePaid,
              remaining,
              payment_status,
              nds_total: Number((row as any).nds_total || 0),
              nds_percent: Number((row as any).nds_percent || 0),
            }
          }
        })
      )

      setRows(withNds)
      setSelectedIds((prev) => prev.filter((id) => withNds.some((row) => row.id === id)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [pageSize, filters])

  useEffect(() => {
    fetchKontragents()
      .then(setClients)
      .catch(() => setClients([]))
  }, [])

  // View/Edit dialoglar uchun order detailni backenddan oladi.
  const fetchOrderDetail = async (id: number) => {
    setDetailLoading(true)
    try {
      return await fetchOrderDetailRequest(id)
    } finally {
      setDetailLoading(false)
    }
  }

  // View dialogni ochadi va order detailni ko'rsatadi.
  const viewOrder = async (id: number) => {
    const key = `${id}:view`
    try {
      setBusyKey(key)
      const data = await fetchOrderDetail(id)
      const listRow = rows.find((r) => r.id === id)
      const totalRaw = Number(data.total ?? listRow?.total ?? 0)
      const paidFromDetail = Number(data.paid_amount ?? 0)
      const paidFromList = Number(listRow?.paid_amount ?? 0)
      const paidAmount = Math.max(paidFromDetail, paidFromList)
      const total = Math.max(totalRaw, paidAmount)
      const remaining = Math.max(total - paidAmount, 0)
      const statusFromApi = String(data.payment_status ?? listRow?.payment_status ?? "").toUpperCase()
      const paymentStatus =
        paidAmount >= total && total > 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : statusFromApi || "UNPAID"
      setActiveOrder({
        ...data,
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        remaining,
        total,
      })
      setViewOpen(true)
    } catch (e: any) {
      const msg = String(e?.response?.data?.detail || e?.message || copy.errors.view)
      alert(msg)
    } finally {
      setBusyKey("")
    }
  }

  // Edit dialogni ochishdan oldin joriy order ma'lumotlarini formga joylaydi.
  const editOrder = async (id: number, options?: { closeView?: boolean }) => {
    const key = `${id}:edit`
    try {
      setBusyKey(key)
      const data = await fetchOrderDetail(id)
      setActiveOrder(data)
      setEditForm({
        client: data.client?.id ? String(data.client.id) : "",
        order_date: toDateInputValue(data.order_date),
        delivery_date: toDateInputValue(data.delivery_date),
        currency: data.currency || "UZS",
        discount_total: Number(data.discount_total || 0),
        delivery_address: data.notes || data.delivery_address || "",
        courier_name: data.courier_name || "",
        status: normalizeOrderStatus(data.status),
      })
      if (options?.closeView) setViewOpen(false)
      setEditOpen(true)
    } catch (e: any) {
      const msg = String(e?.response?.data?.detail || e?.message || copy.errors.editOpen)
      alert(msg)
    } finally {
      setBusyKey("")
    }
  }

  // Edit formdagi o'zgarishlarni saqlaydi; status bo'lsa set-status actionni chaqiradi.
  const saveEdit = async () => {
    if (!activeOrder?.id) return
    const key = `${activeOrder.id}:edit-save`
    try {
      setBusyKey(key)
      let updatedDetail = await patchOrderHeader(activeOrder.id, {
        client: editForm.client ? Number(editForm.client) : undefined,
        order_date: editForm.order_date || null,
        delivery_date: editForm.delivery_date || null,
        discount_total: Number(editForm.discount_total || 0),
        notes: editForm.delivery_address || null,
        courier_name: editForm.courier_name || null,
      })

      if (editForm.status !== normalizeOrderStatus(activeOrder.status)) {
        const statusDetail = await runOrderStatusChange(
          activeOrder.id,
          editForm.status,
          activeOrder.cancelled_reason || ""
        )
        if (!statusDetail) return
        updatedDetail = statusDetail
      }
      setActiveOrder(updatedDetail)
      setEditOpen(false)
      await load(currentPage)
      toast.success(copy.toast.updated)
    } catch (e: any) {
      const msg = extractApiErrorMessage(e, copy.errors.editSave)
      toast.error(msg)
    } finally {
      setBusyKey("")
    }
  }

  // Delete action oldidan center dialog ochish uchun target rowni saqlaydi.
  const askDeleteOrder = (row: OrderRow) => {
    setDeleteTarget(row)
    setDeleteOpen(true)
  }
  const askDeleteSelectedOrders = () => {
    if (selectedIds.length === 0) return
    setDeleteTarget(null)
    setDeleteOpen(true)
  }

  // Delete dialog tasdiqlansa backenddan orderni o'chiradi va ro'yxatni yangilaydi.
  const confirmDeleteOrder = async () => {
    try {
      if (selectedIds.length > 0) {
        setBusyKey("bulk-delete")
        await Promise.all(selectedIds.map((id) => deleteOrder(id)))
      } else {
        if (!deleteTarget) return
        const id = deleteTarget.id
        const key = `${id}:delete`
        setBusyKey(key)
        await deleteOrder(id)
      }
      setDeleteOpen(false)
      setDeleteTarget(null)
      setSelectedIds([])
      const isLastItemOnPage = rows.length === 1 && currentPage > 1
      const nextPage = isLastItemOnPage ? currentPage - 1 : currentPage
      await load(nextPage)
      toast.success(copy.toast.deleted)
    } catch (e: any) {
      const msg = String(e?.response?.data?.detail || e?.message || copy.errors.delete)
      toast.error(msg)
    } finally {
      setBusyKey("")
    }
  }

  const changeOrderStatus = async (row: OrderRow, nextStatus: string) => {
    const apiStatus = normalizeOrderStatus(nextStatus)
    const current = normalizeOrderStatus(row.status)
    if (current === apiStatus) return
    const key = `${row.id}:status:${apiStatus}`
    try {
      setBusyKey(key)
        const updatedDetail = await runOrderStatusChange(row.id, apiStatus, activeOrder?.id === row.id ? activeOrder.cancelled_reason || "" : "")
      if (!updatedDetail) return
      await applyOrderDetailToState(updatedDetail)
      toast.success(copy.toast.statusUpdated)
    } catch (e: any) {
      const msg = extractApiErrorMessage(e, copy.errors.status)
      toast.error(msg)
    } finally {
      setBusyKey("")
    }
  }

  const renderStatusSelect = (row: OrderRow) => {
    const currentStatusValue = normalizeOrderStatus(row.status)
    const disabled = busyKey.startsWith(`${row.id}:status:`)
    const statusOptions = getOrderStatusSelectOptions(row.status)
      .filter(isOrderStatus)
      .map((value) => ({
        value,
        label: copy.status[value],
      }))

    return (
      <select
        value={currentStatusValue}
        disabled={disabled}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => void changeOrderStatus(row, event.target.value)}
        className={[
          "h-10 min-w-[180px] cursor-pointer rounded-xl border px-3 text-sm font-semibold shadow-sm outline-none transition focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60",
          getStatusBadgeClass(row.status),
        ].join(" ")}
      >
        {statusOptions.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
    )
  }

  const toCsvCell = (v: string | number | null | undefined) => {
    const s = String(v ?? "")
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
      return `"${s.replace(/"/g, "\"\"")}"`
    }
    return s
  }

  // Order detaildan CSV tayyorlab yuklab beradi (Excel ochadi).
  const downloadOrderFile = async (row: OrderRow) => {
    const key = `${row.id}:download`
    try {
      setBusyKey(key)
      const data = await fetchOrderDetailRequest(row.id)
      const items: any[] = Array.isArray(data?.items) ? data.items : []

      const lines: string[] = []
      lines.push("Order No,Client,Status,Order Date,Delivery Date,Currency,Subtotal,NDS Total,Discount,Total")
      lines.push(
        [

          toCsvCell(data?.client?.name ?? row.client_name),
          toCsvCell(data?.status),
          toCsvCell(data?.order_date),
          toCsvCell(data?.delivery_date),
          toCsvCell(data?.currency),
          toCsvCell(data?.subtotal),
          toCsvCell(data?.nds_total),
          toCsvCell(data?.discount_total),
          toCsvCell(data?.total),
        ].join(",")
      )
      lines.push("")
      lines.push("Item Type,Product,Qty,Unit Price,NDS Rate,NDS Amount,Line Total")
      for (const it of items) {
        lines.push(
          [
            toCsvCell(it?.item_type),
            toCsvCell(it?.product_name ?? it?.raw_material_name ?? ""),
            toCsvCell(it?.qty),
            toCsvCell(it?.unit_price),
            toCsvCell(it?.nds_rate),
            toCsvCell(it?.nds_amount),
            toCsvCell(it?.line_total),
          ].join(",")
        )
      }

      const csv = `\uFEFF${lines.join("\r\n")}`
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${data?.order_no || row.order_no}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      const msg = String(e?.response?.data?.detail || e?.message || copy.errors.download)
      alert(msg)
    } finally {
      setBusyKey("")
    }
  }

  const openShipmentList = async () => {
    try {
      setShipmentsOpen(true)
      setShipmentsLoading(true)
      const rows = await fetchAllOrderShipments({
        client: filters.client === "ALL" ? undefined : Number(filters.client),
        status: filters.status === "ALL" ? undefined : filters.status,
        payment_status: filters.payment_status === "ALL" ? undefined : filters.payment_status,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      })
      setShipmentRows(rows)
    } catch (e: any) {
      const msg = extractApiErrorMessage(e, copy.errors.view)
      toast.error(msg)
      setShipmentsOpen(false)
    } finally {
      setShipmentsLoading(false)
    }
  }

  const exportShipmentReport = async () => {
    const key = "shipments:export"
    try {
      setBusyKey(key)
      const file = await exportOrderShipmentsReport({
        client: filters.client === "ALL" ? undefined : Number(filters.client),
        status: filters.status === "ALL" ? undefined : filters.status,
        payment_status: filters.payment_status === "ALL" ? undefined : filters.payment_status,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      })
      downloadBlobFile(file.blob, file.fileName || "shipments.xlsx")
    } catch (e: any) {
      const msg = extractApiErrorMessage(e, copy.errors.download)
      toast.error(msg)
    } finally {
      setBusyKey("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xl font-semibold">{activeTabMeta.title}</div>
          <div className="text-sm text-white/90">{activeTabMeta.subtitle}</div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="!border-rose-200 bg-rose-50 text-rose-600 shadow-lg hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={askDeleteSelectedOrders}
            disabled={selectedIds.length === 0}
          >
            <span className="flex items-center gap-2"><span><Trash2 /></span>O'chirish</span>
          </Button>
          <Button variant="outline" className="!border-slate-300 bg-white shadow-lg text-black" onClick={() => load(currentPage)} disabled={loading}>
            {loading ? <span className="flex items-center gap-2"> <span><RefreshCcw /></span>{copy.actions.loading}</span> : <span className="flex items-center gap-2"> <span><RotateCcw /></span>{copy.actions.refresh}</span>}
          </Button>
          {activeTab === "DONE" ? (
            <Button variant="outline" className="!border-slate-300 bg-white shadow-lg text-black" onClick={() => void openShipmentList()} disabled={shipmentsLoading}>
              {shipmentsLoading ? "Shipments..." : "Shipments JSON"}
            </Button>
          ) : null}
          {activeTab === "DONE" ? (
            <Button
              variant="outline"
              className="!border-slate-300 bg-white shadow-lg text-black"
              onClick={() => void exportShipmentReport()}
              disabled={busyKey === "shipments:export"}
            >
              {busyKey === "shipments:export" ? "Export..." : "Shipments XLSX"}
            </Button>
          ) : null}
          <OrderCreateDialog onSuccess={() => load(1)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4">
          <div className="mb-10 grid grid-cols-1 gap-3 rounded-xl border border-blue-700 px-5 py-6 md:grid-cols-4 xl:grid-cols-7">
            <Input
              placeholder={copy.filters.search}
              value={filters.search}
              className="h-10 rounded-md border border-slate-200 bg-white shadow-lg text-black  px-3 text-sm"
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
            <select
              className="h-10 rounded-md border border-slate-200 bg-white shadow-lg text-black  px-3 text-sm"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as OrderFilterStatus }))}
            >
              <option value="ALL">{copy.filters.allStatuses}</option>
              {allStatusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white shadow-lg text-black  px-3 text-sm"
              value={filters.payment_status}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  payment_status: e.target.value as OrdersPageFilters["payment_status"],
                }))
              }
            >
              <option value="ALL">{copy.filters.allPaymentStatuses}</option>
              <option value="UNPAID">{copy.filters.unpaid}</option>
              <option value="PARTIAL">{copy.filters.partial}</option>
              <option value="PAID">{copy.filters.paid}</option>
            </select>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-black shadow-lg"
              value={filters.shipment_state}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  shipment_state: e.target.value as OrdersPageFilters["shipment_state"],
                }))
              }
            >
              <option value="ALL">{copy.filters.allShipmentStates}</option>
              <option value="none">{copy.filters.shipmentNone}</option>
              <option value="partial">{copy.filters.shipmentPartial}</option>
              <option value="full">{copy.filters.shipmentFull}</option>
            </select>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white shadow-lg text-black  px-3 text-sm"
              value={filters.client}
              onChange={(e) => setFilters((prev) => ({ ...prev, client: e.target.value }))}
            >
              <option value="ALL">{copy.filters.allClients}</option>
              {clients.map((client) => (
                <option key={client.id} value={String(client.id)}>
                  {client.code} - {client.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white shadow-lg text-black  px-3 text-sm"
            />
            <Input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white shadow-lg text-black  px-3 text-sm"

            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tabItems.map((tab) => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    "flex h-[84px] w-full cursor-pointer items-center justify-center rounded-2xl border text-base font-semibold transition",
                    active
                      ? "border-blue-500 !bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-sm "
                      : "border-slate-300 !bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-sm ",
                  ].join(" ")}
                >
                  <span className="text-lg font-semibold">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-5">
          <Table>
            <TableHeader className={`sticky top-0 z-10 bg-gradient-to-r from-blue-900 to-blue-700 text-white ${headerDividerClass}`}>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(Array.from(new Set([...selectedIds, ...sortedRows.map((row) => row.id)])))
                      } else {
                        setSelectedIds((prev) => prev.filter((id) => !sortedRows.some((row) => row.id === id)))
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select all orders"
                  />
                </TableHead>
                <TableHead className="text-left">
                  <button
                    type="button"
                    className="inline-flex appearance-none items-center gap-1.5 !border-0 !bg-transparent px-0 py-0 font-semibold !text-white !shadow-none outline-none ring-0 transition hover:!bg-transparent hover:!text-white/85 focus-visible:ring-0 focus-visible:outline-none"
                    style={{ appearance: "none", WebkitAppearance: "none", background: "transparent", boxShadow: "none", border: "0" }}
                    onClick={() => toggleSort("order_no")}
                  >
                    {copy.table.orderNo}
                    {renderSortIcon("order_no")}
                  </button>
                </TableHead>
                <TableHead className="text-left">
                  <button
                    type="button"
                    className="inline-flex appearance-none items-center gap-1.5 !border-0 !bg-transparent px-0 py-0 font-semibold !text-white !shadow-none outline-none ring-0 transition hover:!bg-transparent hover:!text-white/85 focus-visible:ring-0 focus-visible:outline-none"
                    style={{ appearance: "none", WebkitAppearance: "none", background: "transparent", boxShadow: "none", border: "0" }}
                    onClick={() => toggleSort("client")}
                  >
                    {activeTab === "DONE" ? copy.table.dateTimeClient : copy.table.client}
                    {renderSortIcon("client")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="ml-auto inline-flex appearance-none items-center gap-1.5 !border-0 !bg-transparent px-0 py-0 font-semibold !text-white !shadow-none outline-none ring-0 transition hover:!bg-transparent hover:!text-white/85 focus-visible:ring-0 focus-visible:outline-none"
                    style={{ appearance: "none", WebkitAppearance: "none", background: "transparent", boxShadow: "none", border: "0" }}
                    onClick={() => toggleSort("total")}
                  >
                    {copy.table.total}
                    {renderSortIcon("total")}
                  </button>
                </TableHead>
                <TableHead className="text-center">{copy.table.status}</TableHead>
                <TableHead className="text-center">{copy.table.paymentStatus}</TableHead>
                <TableHead className="text-center">
                  <button
                    type="button"
                    className="mx-auto inline-flex appearance-none items-center gap-1.5 !border-0 !bg-transparent px-0 py-0 font-semibold !text-white !shadow-none outline-none ring-0 transition hover:!bg-transparent hover:!text-white/85 focus-visible:ring-0 focus-visible:outline-none"
                    style={{ appearance: "none", WebkitAppearance: "none", background: "transparent", boxShadow: "none", border: "0" }}
                    onClick={() => toggleSort("order_date")}
                  >
                    {copy.table.orderDate}
                    {renderSortIcon("order_date")}
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    type="button"
                    className="mx-auto inline-flex appearance-none items-center gap-1.5 !border-0 !bg-transparent px-0 py-0 font-semibold !text-white !shadow-none outline-none ring-0 transition hover:!bg-transparent hover:!text-white/85 focus-visible:ring-0 focus-visible:outline-none"
                    style={{ appearance: "none", WebkitAppearance: "none", background: "transparent", boxShadow: "none", border: "0" }}
                    onClick={() => toggleSort("delivery_date")}
                  >
                    {copy.table.deliveryDate}
                    {renderSortIcon("delivery_date")}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeTab === "DONE"
                ? doneDateGroups.map((group) => (
                  <Fragment key={`done-group-${group.key}`}>
                    <TableRow className="bg-slate-50/90">
                      <TableCell colSpan={8} className="py-2 text-sm">
                        <span className="font-semibold text-slate-800">{group.label}</span>{" "}
                        <span className="text-slate-500">
                          {copy.table.doneGroup.replace("{{count}}", String(group.list.length)).replace("{{total}}", formatAmount(group.total))}
                        </span>
                      </TableCell>
                    </TableRow>
                    {group.list.map((r) => {
                      return (
                      <TableRow key={r.id} className="cursor-pointer bg-white hover:bg-slate-50" onClick={() => void viewOrder(r.id)}>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(r.id)}
                            onChange={(e) => {
                              setSelectedIds((prev) => (e.target.checked ? Array.from(new Set([...prev, r.id])) : prev.filter((id) => id !== r.id)))
                            }}
                            aria-label={`Select order ${r.order_no ?? r.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">{formatOrderNumber(r.order_no, r.id)}</TableCell>
                        <TableCell className="text-slate-800">
                          <div className="font-medium">{formatDateTime(r.created_at)}</div>
                          <div className="text-xs text-slate-500">{r.client_name || "-"}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(r.total)} {r.currency}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
                            {renderStatusSelect(r)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                              paymentStatusBadgeClass(
                                paymentStatusLabel(Number(r.paid_amount || 0), Number(r.total || 0), r.payment_status)
                              ),
                            ].join(" ")}
                          >
                            {paymentStatusLabel(Number(r.paid_amount || 0), Number(r.total || 0), r.payment_status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{formatDate(r.order_date)}</TableCell>
                        <TableCell className="text-center">{formatDate(r.delivery_date)}</TableCell>
                      </TableRow>
                      )
                    })}
                  </Fragment>
                ))
                : groupedRows.map(([status, list]) => {
                  const groupTotal = list.reduce((sum, row) => sum + Number(row.total || 0), 0)
                  return (
                    <Fragment key={`group-${status}`}>
                      <TableRow className="bg-slate-50/90">
                        <TableCell colSpan={8} className="py-2 text-sm">
                          <span className="font-semibold text-slate-800">{statusLabel(status)}</span>{" "}
                          <span className="text-slate-500">
                            {copy.table.group.replace("{{count}}", String(list.length)).replace("{{total}}", formatAmount(groupTotal))}
                          </span>
                        </TableCell>
                      </TableRow>
                      {list.map((r) => {
                        return (
                          <TableRow key={r.id} className="cursor-pointer bg-white hover:bg-slate-50" onClick={() => void viewOrder(r.id)}>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(r.id)}
                              onChange={(e) => {
                                setSelectedIds((prev) => (e.target.checked ? Array.from(new Set([...prev, r.id])) : prev.filter((id) => id !== r.id)))
                              }}
                              aria-label={`Select order ${r.order_no ?? r.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">{formatOrderNumber(r.order_no, r.id)}</TableCell>
                          <TableCell className="text-slate-800">{r.client_name || "-"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatAmount(r.total)} {r.currency}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
                              {renderStatusSelect(r)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                                paymentStatusBadgeClass(
                                  paymentStatusLabel(Number(r.paid_amount || 0), Number(r.total || 0), r.payment_status)
                                ),
                              ].join(" ")}
                            >
                              {paymentStatusLabel(Number(r.paid_amount || 0), Number(r.total || 0), r.payment_status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{formatDate(r.order_date)}</TableCell>
                          <TableCell className="text-center">{formatDate(r.delivery_date)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </Fragment>
                  )
                })}
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm">
                    {copy.table.empty}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
      {/* fsagfdsgsgsgGSgg */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 rounded-lg border bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-1.5 text-white">
          <div className="text-sm text-white/90">
            {copy.footer.total.replace("{{count}}", String(sortedRows.length))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/90">{copy.footer.pageSize}</span>
            <select
              className="h-8 min-w-[68px] rounded-md border border-blue-200 bg-white px-2 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 10)}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          disabled={loading}
          onPageChange={(nextPage) => void load(nextPage)}
          size="sm"
        />
      </div>

      <Dialog open={shipmentsOpen} onOpenChange={setShipmentsOpen}>
        <DialogContent className="max-w-[1200px] overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-5 text-2xl font-bold text-slate-900">Shipments JSON</DialogTitle>
          </DialogHeader>
          {shipmentsLoading ? (
            <div className="px-6 pb-6 text-sm text-slate-500">Shipmentlar yuklanmoqda...</div>
          ) : shipmentRows.length > 0 ? (
            <div className="px-6 pb-6">
              <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-50">
                    <TableRow>
                      {shipmentColumns.map((column) => (
                        <TableHead key={column} className="whitespace-nowrap text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          {column.replace(/_/g, " ")}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipmentRows.map((row, index) => (
                      <TableRow key={`${row.id ?? row.order_id ?? index}:${index}`}>
                        {shipmentColumns.map((column) => (
                          <TableCell key={`${index}:${column}`} className="align-top text-sm text-slate-700">
                            {formatShipmentCell(row[column])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="px-6 pb-6 text-sm text-slate-500">Shipment topilmadi.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-[1350px] overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 p-0">
          <DialogHeader className="pt-5 pl-6 pr-20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <DialogTitle className="text-2xl font-bold text-slate-900">
                {copy.view.title} {activeOrder?.order_no ?? "-"} {activeOrder?.order_date ? `- ${formatDateTime(activeOrder.order_date)}` : ""}
              </DialogTitle>
              <Button
                type="button"
                className="bg-gradient-to-r from-blue-900 to-blue-700 text-white"
                disabled={!activeOrder?.id || busyKey === `${activeOrder?.id}:edit`}
                onClick={() => activeOrder?.id && void editOrder(activeOrder.id, { closeView: true })}
              >
                {busyKey === `${activeOrder?.id}:edit` ? copy.actions.loading : copy.view.edit}
              </Button>
            </div>
          </DialogHeader>
          {detailLoading ? (
            <div className="px-6 pb-6 text-sm text-slate-500">{copy.view.loading}</div>
          ) : activeOrder ? (
            <div className="space-y-4 px-6 pb-6">
              {(() => {
                const pm = paymentMeta(
                  Number(activeOrder.paid_amount ?? 0),
                  Number(activeOrder.total ?? 0),
                  activeOrder.payment_status
                )
                return (
                  <div className="rounded-xl border border-blue-800 bg-gradient-to-r from-blue-900 to-blue-700 p-4 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-white/80">{copy.payment.statusTitle}</div>
                        <div className="mt-1 text-sm font-semibold">{pm.label}</div>
                      </div>
                      <span className={["inline-flex rounded-full border px-3 py-1 text-xs font-bold", pm.tone].join(" ")}>
                        {pm.percent}%
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className={["h-full rounded-full bg-gradient-to-r transition-all", pm.bar].join(" ")}
                        style={{ width: `${pm.percent}%` }}
                      />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-white/90 sm:grid-cols-3">
                      <div>
                        {copy.payment.paidLabel}:{" "}
                        <span className="font-semibold text-white">
                          {formatAmount(activeOrder.paid_amount)} {activeOrder.currency}
                        </span>
                      </div>
                      <div>
                        {copy.payment.remainingLabel}:{" "}
                        <span className="font-semibold text-white">
                          {formatAmount(activeOrder.remaining)} {activeOrder.currency}
                        </span>
                      </div>
                      <div>
                        {copy.payment.totalLabel}:{" "}
                        <span className="font-semibold text-white">
                          {formatAmount(activeOrder.total)} {activeOrder.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-slate-500">{copy.view.client}</div>
                    <div className="text-base font-semibold text-slate-900">{activeOrder.client?.name ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{copy.view.orderDate}</div>
                    <div className="text-base font-medium text-slate-800">{formatDate(activeOrder.order_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{copy.view.deliveryDate}</div>
                    <div className="text-base font-medium text-slate-800">{formatDate(activeOrder.delivery_date)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                      getStatusBadgeClass(activeOrder.status),
                    ].join(" ")}
                  >
                    {statusLabel(activeOrder.status)}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                    {copy.view.currency}: {activeOrder.currency || "UZS"}
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-blue-800 bg-white">
                <div className="flex items-center justify-between border-b border-blue-800 bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 text-white">
                  <div className="text-sm font-semibold text-white">{copy.view.itemsTitle}</div>
                  <div className="text-sm text-slate-500">
                    <span className="text-white/80">{copy.payment.totalLabel}:</span>{" "}
                    <span className="font-semibold text-white">{formatAmount(activeOrder.total)} {activeOrder.currency}</span>
                  </div>
                </div>
                <Table>
                  <TableHeader className="bg-blue-50 text-blue-900">
                    <TableRow>
                      <TableHead className="font-semibold text-blue-900">#</TableHead>
                      <TableHead className="font-semibold text-blue-900">{copy.view.name}</TableHead>
                      <TableHead className="text-right font-semibold text-blue-900">{copy.view.qty}</TableHead>
                      <TableHead className="text-right font-semibold text-blue-900">{copy.view.price}</TableHead>
                      <TableHead className="text-right font-semibold text-blue-900">{copy.view.ndsPercent}</TableHead>
                      <TableHead className="text-right font-semibold text-blue-900">{copy.view.ndsAmount}</TableHead>
                      <TableHead className="text-right font-semibold text-blue-900">{copy.view.lineTotal}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activeOrder.items ?? []).map((it, idx) => (
                      <TableRow key={it.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{it.product_name ?? it.raw_material_name ?? "-"}</TableCell>
                        <TableCell className="text-right">{it.qty ?? "-"}</TableCell>
                        <TableCell className="text-right">{formatAmount(it.unit_price)}</TableCell>
                        <TableCell className="text-right">{formatTaxRatePercent(it.nds_rate)}</TableCell>
                        <TableCell className="text-right">{formatAmount(it.nds_amount)}</TableCell>
                        <TableCell className="text-right">{formatAmount(it.line_total)}</TableCell>
                      </TableRow>
                    ))}
                    {(activeOrder.items ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                          {copy.view.itemsEmpty}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
                <div className="border-t border-slate-200 px-4 py-3 text-right text-sm">
                  <span className="text-slate-500">{copy.view.subtotal}: </span>
                  <span className="font-medium text-slate-800">{formatAmount(activeOrder.subtotal)} {activeOrder.currency}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="text-slate-500">{copy.view.nds}: </span>
                  <span className="font-medium text-slate-800">{formatAmount(activeOrder.nds_total)} {activeOrder.currency}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="text-slate-500">{copy.view.grandTotal}: </span>
                  <span className="font-bold text-slate-900">{formatAmount(activeOrder.total)} {activeOrder.currency}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 pb-6 text-sm text-slate-500">{copy.view.noData}</div>
          )}
        </DialogContent>
      </Dialog>

      <OrderEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        detail={activeOrder}
        onSaved={(detail) => applyOrderDetailToState(detail)}
      />

      <DeleteAlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleteTarget(null)
        }}
        title={copy.deleteDialog.title}
        description={
          <>
            {selectedIds.length > 0 ? (
              <>
                {copy.deleteDialog.descriptionPrefix} <span className="font-bold text-slate-800">{selectedIds.length}</span>{" "}
                {language === "ru" ? "заказов?" : language === "en" ? "orders?" : "ta buyurtmani o'chirmoqchimisiz?"}
              </>
            ) : (
              <>
                {copy.deleteDialog.descriptionPrefix} <span className="font-bold text-slate-800">{deleteTarget?.order_no ?? copy.deleteDialog.fallbackOrder}</span>{" "}
                {copy.deleteDialog.descriptionSuffix}
              </>
            )}
          </>
        }
        loading={busyKey === `${deleteTarget?.id}:delete` || busyKey === "bulk-delete"}
        onConfirm={confirmDeleteOrder}
      />
    </div>
  )
}
