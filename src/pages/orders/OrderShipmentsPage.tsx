import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, RefreshCcw } from "lucide-react"
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
  ORDER_STATUS_VALUES,
  exportOrderShipmentsReport,
  fetchAllOrderShipments,
  fetchKontragents,
  type Kontragent,
  type OrderShipmentRow,
} from "@/pages/orders/api/ordersApi"
import { toast } from "react-toastify"

type ShipmentFilters = {
  date: string
  date_from: string
  date_to: string
  client: string
  status: string
  payment_status: string
  payment_method: string
}

const EMPTY_FILTERS: ShipmentFilters = {
  date: "",
  date_from: "",
  date_to: "",
  client: "ALL",
  status: "ALL",
  payment_status: "ALL",
  payment_method: "ALL",
}

function formatShipmentCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-"
  if (Array.isArray(value)) return value.map((item) => formatShipmentCell(item)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function formatDateTime(value: unknown): string {
  const text = String(value ?? "").trim()
  if (!text) return "-"
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
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

function buildShipmentQuery(filters: ShipmentFilters) {
  const exactDate = filters.date.trim()
  return {
    date: exactDate || undefined,
    date_from: exactDate ? undefined : filters.date_from || undefined,
    date_to: exactDate ? undefined : filters.date_to || undefined,
    client: filters.client === "ALL" ? undefined : Number(filters.client),
    status: filters.status === "ALL" ? undefined : filters.status,
    payment_status: filters.payment_status === "ALL" ? undefined : filters.payment_status,
    payment_method: filters.payment_method === "ALL" ? undefined : filters.payment_method,
  }
}

export default function OrderShipmentsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<OrderShipmentRow[]>([])
  const [clients, setClients] = useState<Kontragent[]>([])
  const [filters, setFilters] = useState<ShipmentFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<ShipmentFilters>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const columns = useMemo(() => {
    const discovered = Array.from(
      new Set(
        rows.flatMap((row) =>
          Object.keys(row).filter((key) => key !== "id" && key !== "order_id")
        )
      )
    )
    const preferred = [
      "order_no",
      "client_name",
      "product_name",
      "qty",
      "total_sell",
      "profit",
      "order_status",
      "payment_status",
      "created_at",
    ]
    return [...preferred.filter((key) => discovered.includes(key)), ...discovered.filter((key) => !preferred.includes(key))].slice(0, 12)
  }, [rows])

  const load = async (nextFilters = filters) => {
    try {
      setLoading(true)
      const data = await fetchAllOrderShipments(buildShipmentQuery(nextFilters))
      setRows(data)
      setAppliedFilters(nextFilters)
    } catch (error: any) {
      const message = String(error?.response?.data?.detail || error?.message || "Shipmentlarni yuklab bo'lmadi")
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async () => {
    try {
      setExporting(true)
      const file = await exportOrderShipmentsReport(buildShipmentQuery(appliedFilters))
      downloadBlobFile(file.blob, file.fileName || "shipments.xlsx")
    } catch (error: any) {
      const message = String(error?.response?.data?.detail || error?.message || "Shipment hisobotini yuklab bo'lmadi")
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    void load(EMPTY_FILTERS)
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const data = await fetchKontragents({ limit: 500 })
        if (!cancelled) setClients(data)
      } catch {
        if (!cancelled) setClients([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Orders / Shipments</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Shipmentlar ro'yxati</h1>
          <p className="mt-1 text-sm text-slate-500">Hujjatdagi shipment filterlari bilan hisobotni tekshirish uchun.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/sotuv/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Orders
          </Button>
          <Button variant="outline" onClick={() => void load(appliedFilters)} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Yangilash
          </Button>
          <Button onClick={() => void exportReport()} disabled={exporting}>
            {exporting ? "Export..." : "XLSX export"}
          </Button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="mb-1 text-xs text-slate-500">Aniq sana</div>
            <Input
              type="date"
              value={filters.date}
              onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
              className="h-11"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">Sana dan</div>
            <Input
              type="date"
              value={filters.date_from}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
              className="h-11"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">Sana gacha</div>
            <Input
              type="date"
              value={filters.date_to}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
              className="h-11"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">Mijoz</div>
            <select
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={filters.client}
              onChange={(event) => setFilters((prev) => ({ ...prev, client: event.target.value }))}
            >
              <option value="ALL">Barcha mijozlar</option>
              {clients.map((client) => (
                <option key={client.id} value={String(client.id)}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">Buyurtma statusi</div>
            <select
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="ALL">Barcha status</option>
              {ORDER_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">To'lov holati</div>
            <select
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={filters.payment_status}
              onChange={(event) => setFilters((prev) => ({ ...prev, payment_status: event.target.value }))}
            >
              <option value="ALL">Barchasi</option>
              <option value="UNPAID">UNPAID</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="PAID">PAID</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">To'lov usuli</div>
            <select
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={filters.payment_method}
              onChange={(event) => setFilters((prev) => ({ ...prev, payment_method: event.target.value }))}
            >
              <option value="ALL">Barchasi</option>
              <option value="CASH">CASH</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
              <option value="CARD">CARD</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button className="flex-1" onClick={() => void load(filters)} disabled={loading}>
              Filtrlash
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilters(EMPTY_FILTERS)
                void load(EMPTY_FILTERS)
              }}
            >
              Tozalash
            </Button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">Aniq sana kiritilsa `Sana dan / Sana gacha` filterlari e'tiborga olinmaydi.</div>
        <div className="mt-3 text-sm text-slate-500">
          Jami satrlar: <span className="font-semibold text-slate-900">{rows.length}</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column} className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {column.replace(/_/g, " ")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={Math.max(columns.length, 1)} className="py-10 text-center text-sm text-slate-500">
                    Shipmentlar yuklanmoqda...
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? (
                rows.map((row, index) => (
                  <TableRow key={`${row.id ?? row.order_id ?? "shipment"}:${index}`}>
                    {columns.map((column) => {
                      const rawValue = row[column]
                      const value = column === "created_at" ? formatDateTime(rawValue) : formatShipmentCell(rawValue)
                      return (
                        <TableCell key={`${index}:${column}`} className="align-top text-sm text-slate-700">
                          {value}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={Math.max(columns.length, 1)} className="py-10 text-center text-sm text-slate-500">
                    Shipment topilmadi.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
