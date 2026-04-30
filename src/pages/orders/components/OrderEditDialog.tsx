import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  addOrderItem,
  createKontragent,
  fetchKontragents,
  fetchOrderDetail,
  fetchWarehouseLocations,
  normalizeOrderStatus,
  patchOrderHeader,
  removeOrderItem,
  updateOrderItem,
  type Kontragent,
  type OrderDetailResponse,
  type WarehouseLocation,
} from "@/pages/orders/api/ordersApi"
import { useDebouncedValue } from "@/pages/orders/api/useDebouncedValue"
import OrderItemsCalcTable, { type OrderCalcItemRow } from "@/pages/orders/components/OrderItemsCalcTable"
import { toast } from "react-toastify"
import { UserPlus } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: OrderDetailResponse | null | undefined
  onSaved?: (detail: OrderDetailResponse) => void | Promise<void>
}

function safeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
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

function clampPercent(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, parsed))
}

function percentFromRate(value: unknown) {
  const rate = Number(value ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return clampPercent(rate <= 1 ? rate * 100 : rate)
}

function decimalQty(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return "0.000000"
  return parsed.toFixed(6)
}

function decimalPercent(value: unknown) {
  return round2(clampPercent(value)).toFixed(2)
}

function hasRowChanged(row: OrderCalcItemRow, initial: NonNullable<OrderDetailResponse["items"]>[number]) {
  const rowProduct = Number(row.product_id ?? 0)
  const initialProduct = Number(initial.product ?? 0)
  if (rowProduct !== initialProduct) return true
  if (decimalQty(row.qty) !== decimalQty(initial.qty)) return true
  if (round2(safeNumber(row.unit_cost)) !== round2(safeNumber(initial.unit_price))) return true
  return decimalPercent(row.nds_percent) !== decimalPercent(percentFromRate(initial.nds_rate))
}

function formatClientLabel(client: Kontragent) {
  const extra = [client.code ? `Kod: ${client.code}` : "", client.inn ? `STIR: ${client.inn}` : ""]
    .filter(Boolean)
    .join(" | ")
  return extra ? `${client.name} (${extra})` : client.name
}

function itemRowsFromDetail(detail: OrderDetailResponse | null | undefined): OrderCalcItemRow[] {
  const currency = detail?.currency || "UZS"
  const rows =
    detail?.items?.map((item) => ({
      key: `order-item-${item.id}`,
      order_item_id: item.id,
      product_id: item.product ?? null,
      product_name: item.product_name ?? item.raw_material_name ?? undefined,
      uom_id: null,
      unit_cost: safeNumber(item.unit_price),
      qty: safeNumber(item.qty),
      stock_qty: null,
      nds_percent: percentFromRate(item.nds_rate),
      currency,
    })) ?? []

  return rows.length > 0
    ? rows
    : [
        {
          key: "new-item",
          order_item_id: null,
          product_id: null,
          uom_id: null,
          unit_cost: 0,
          qty: 1,
          stock_qty: null,
          nds_percent: 0,
          currency,
        },
      ]
}

export default function OrderEditDialog({ open, onOpenChange, detail, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Kontragent[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const debouncedClientSearch = useDebouncedValue(clientSearch, 250)
  const [clientId, setClientId] = useState<number | null>(null)
  const [selectedClient, setSelectedClient] = useState<Kontragent | null>(null)
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([])
  const [warehouseLocationId, setWarehouseLocationId] = useState<number | null>(null)
  const [orderDate, setOrderDate] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [currency, setCurrency] = useState("UZS")
  const [discountTotal, setDiscountTotal] = useState(0)
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [courierName, setCourierName] = useState("")
  const [itemsCalc, setItemsCalc] = useState<OrderCalcItemRow[]>([])
  const [initialItems, setInitialItems] = useState<OrderCalcItemRow[]>([])
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [newClient, setNewClient] = useState({ name: "", phone: "", inn: "" })
  const [creatingClient, setCreatingClient] = useState(false)

  useEffect(() => {
    if (!open || !detail) return
    const selected = detail.client?.id
      ? ({
          id: Number(detail.client.id),
          name: detail.client.name || `#${detail.client.id}`,
          kind: "CLIENT",
          code: detail.client.code || "",
          phone: detail.client.phone,
          inn: detail.client.inn,
          is_active: true,
        } as Kontragent)
      : null
    const rows = itemRowsFromDetail(detail)

    setClientId(selected?.id ?? null)
    setSelectedClient(selected)
    setClientSearch(selected?.name ?? "")
    setOrderDate(toDateInputValue(detail.order_date))
    setDeliveryDate(toDateInputValue(detail.delivery_date))
    setCurrency(detail.currency || "UZS")
    setDiscountTotal(safeNumber(detail.discount_total))
    setDeliveryAddress(String(detail.notes ?? detail.delivery_address ?? ""))
    setCourierName(String(detail.courier_name ?? ""))
    setWarehouseLocationId(Number(detail.reservations?.[0]?.location ?? 0) || null)
    setInitialItems(rows)
    setItemsCalc(rows)
    setShowCreateClient(false)
    setNewClient({ name: "", phone: "", inn: "" })
  }, [open, detail?.id, detail?.updated_at])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    fetchWarehouseLocations()
      .then((rows) => {
        if (!cancelled) setWarehouseLocations(rows)
      })
      .catch(() => {
        if (!cancelled) setWarehouseLocations([])
      })

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadClients() {
      try {
        setClientsLoading(true)
        const rows = await fetchKontragents({
          search: debouncedClientSearch || undefined,
          page_size: debouncedClientSearch ? 100 : 500,
          limit: debouncedClientSearch ? 50 : 500,
        })
        if (!cancelled) setClients(rows)
      } catch {
        if (!cancelled) setClients([])
      } finally {
        if (!cancelled) setClientsLoading(false)
      }
    }

    void loadClients()
    return () => {
      cancelled = true
    }
  }, [debouncedClientSearch, open])

  const clientOptions = useMemo(() => {
    const byId = new Map<number, Kontragent>()
    if (selectedClient?.id) byId.set(selectedClient.id, selectedClient)
    for (const client of clients) {
      if (client.id) byId.set(client.id, client)
    }
    return Array.from(byId.values())
  }, [clients, selectedClient])

  const selectedWarehouseLocation = useMemo(
    () => warehouseLocations.find((row) => row.id === warehouseLocationId) ?? null,
    [warehouseLocationId, warehouseLocations]
  )

  const totals = useMemo(() => {
    const summary = itemsCalc.reduce(
      (acc, item) => {
        const subtotal = safeNumber(item.unit_cost) * safeNumber(item.qty)
        const nds = subtotal * (safeNumber(item.nds_percent) / 100)
        acc.sub += subtotal
        acc.nds += nds
        acc.withNds += subtotal + nds
        return acc
      },
      { sub: 0, nds: 0, withNds: 0 }
    )
    return {
      sub: round2(summary.sub),
      nds: round2(summary.nds),
      withNds: round2(summary.withNds),
      disc: safeNumber(discountTotal),
      total: round2(Math.max(summary.withNds - safeNumber(discountTotal), 0)),
    }
  }, [discountTotal, itemsCalc])

  const closeDialog = () => {
    if (!saving) onOpenChange(false)
  }

  const selectClient = (value: string) => {
    const nextId = Number(value) || null
    setClientId(nextId)
    const nextClient = clientOptions.find((client) => client.id === nextId) ?? null
    setSelectedClient(nextClient)
    setClientSearch(nextClient?.name ?? "")
  }

  const handleClientSearchChange = (value: string) => {
    setClientSearch(value)
    const normalized = value.trim().toLowerCase()
    if (!normalized) return

    const exact = clientOptions.find((client) => {
      return [client.name, client.code, client.phone ?? "", client.inn ?? "", formatClientLabel(client)]
        .map((token) => String(token ?? "").trim().toLowerCase())
        .includes(normalized)
    })
    if (!exact) return

    setClientId(exact.id)
    setSelectedClient(exact)
    setClientSearch(exact.name || "")
  }

  const createClientInline = async () => {
    if (!newClient.name.trim()) {
      toast.error("Mijoz ismini kiriting")
      return
    }

    try {
      setCreatingClient(true)
      const created = await createKontragent({
        kind: "CLIENT",
        name: newClient.name.trim(),
        phone: newClient.phone || undefined,
        inn: newClient.inn || undefined,
      })
      setClients((prev) => [created, ...prev])
      setClientId(created.id)
      setSelectedClient(created)
      setClientSearch(created.name || "")
      setShowCreateClient(false)
      setNewClient({ name: "", phone: "", inn: "" })
    } catch {
      toast.error("Mijozni yaratib bo'lmadi")
    } finally {
      setCreatingClient(false)
    }
  }

  const save = async () => {
    if (!detail?.id) return
    if (!clientId) {
      toast.error("Mijozni tanlang")
      return
    }

    const validRows = itemsCalc.filter((item) => item.product_id || item.order_item_id)
    if (validRows.length === 0) {
      toast.error("Kamida 1 ta mahsulot qo'shing")
      return
    }
    if (validRows.some((item) => !item.product_id || safeNumber(item.qty) <= 0)) {
      toast.error("Mahsulot va miqdorni to'g'ri kiriting")
      return
    }

    const productIds = validRows.map((item) => Number(item.product_id))
    if (new Set(productIds).size !== productIds.length) {
      toast.error("Bir xil mahsulotni bitta buyurtmaga ikki marta qo'shib bo'lmaydi.")
      return
    }

    const initialById = new Map(
      (detail.items ?? []).map((item) => [Number(item.id), item])
    )
    const currentIds = new Set(
      validRows
        .map((item) => Number(item.order_item_id ?? 0))
        .filter((id) => id > 0)
    )
    const deletedItems = (detail.items ?? []).filter((item) => !currentIds.has(Number(item.id)))
    const changedRows = validRows.filter((item) => {
      const orderItemId = Number(item.order_item_id ?? 0)
      if (orderItemId <= 0) return true
      const initial = initialById.get(orderItemId)
      return !initial || hasRowChanged(item, initial)
    })
    const hasItemChanges = deletedItems.length > 0 || changedRows.length > 0
    const canEditItems = normalizeOrderStatus(detail.status) === "NEW"

    if (hasItemChanges && !canEditItems) {
      toast.error("Mahsulotlarni faqat NEW statusdagi buyurtmada tahrirlash mumkin. Boshqa ma'lumotlar uchun mahsulot qatorlarini o'zgartirmang.")
      return
    }

    try {
      setSaving(true)
      await patchOrderHeader(detail.id, {
        client: clientId,
        order_date: orderDate || null,
        delivery_date: deliveryDate || null,
        discount_total: safeNumber(discountTotal),
        notes: deliveryAddress || null,
        courier_name: courierName || null,
      })

      for (const item of deletedItems) {
        if (canEditItems) {
          await removeOrderItem(detail.id, item.id)
        }
      }

      for (const item of changedRows) {
        const orderItemId = Number(item.order_item_id ?? 0)
        const productId = Number(item.product_id ?? 0)
        const qty = decimalQty(item.qty)
        const unitPrice = safeNumber(item.unit_cost)
        const ndsRate = decimalPercent(item.nds_percent)
        const initial = initialById.get(orderItemId)
        const initialProductId = Number(initial?.product ?? 0)

        if (orderItemId > 0 && initial && (!initialProductId || initialProductId === productId)) {
          await updateOrderItem(detail.id, orderItemId, {
            qty,
            unit_price: unitPrice,
            nds_rate: ndsRate,
          })
          continue
        }

        if (orderItemId > 0 && initial) {
          await removeOrderItem(detail.id, orderItemId)
        }
        await addOrderItem(detail.id, {
          item_type: "FINISHED_PRODUCT",
          product: productId,
          qty,
          unit_price: unitPrice,
          nds_rate: ndsRate,
        })
      }

      const fresh = await fetchOrderDetail(detail.id)
      toast.success("Buyurtma yangilandi")
      onOpenChange(false)
      await onSaved?.(fresh)
    } catch (error: any) {
      const payload = error?.response?.data
      const message =
        payload && typeof payload === "object"
          ? JSON.stringify(payload)
          : String(payload || error?.message || "Buyurtmani saqlab bo'lmadi")
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (saving ? undefined : onOpenChange(nextOpen))}>
      <DialogContent className="max-w-[1350px] overflow-x-hidden overflow-y-auto rounded-[28px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)]">
        <DialogHeader className="sr-only">
          <DialogTitle>Buyurtmani tahrirlash</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Mijozlar</div>
            <div className="flex gap-2">
              <Input
                placeholder="Mijozni Qidirmoq..."
                className="h-11 rounded-xl border-slate-300 bg-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.28)] placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-100"
                list="order-edit-client-suggestions"
                value={clientSearch}
                onChange={(event) => handleClientSearchChange(event.target.value)}
              />
              <datalist id="order-edit-client-suggestions">
                {clientOptions.slice(0, 12).map((client) => (
                  <option key={client.id} value={formatClientLabel(client)} />
                ))}
              </datalist>
              <Button
                className="bg-gradient-to-r from-blue-900 to-blue-700 text-white"
                type="button"
                variant="outline"
                onClick={() => setShowCreateClient((value) => !value)}
              >
                <UserPlus className="h-4 w-4" /> Yangi mijoz
              </Button>
            </div>

            <select
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.3)] outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-100"
              value={clientId ?? ""}
              onChange={(event) => selectClient(event.target.value)}
            >
              <option value="">{clientsLoading ? "Yuklanmoqda..." : "Mijoz tanlang..."}</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}{client.inn ? ` - ${client.inn}` : ""}
                </option>
              ))}
            </select>

            {showCreateClient ? (
              <div className="space-y-2 rounded-md border border-slate-300 bg-white p-3 shadow-lg">
                <div className="text-sm font-medium">Yangi mijoz</div>
                <Input
                  className="border border-slate-300 bg-white shadow-lg"
                  value={newClient.name}
                  onChange={(event) => setNewClient((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ismi"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    className="border border-slate-300 bg-white shadow-lg"
                    value={newClient.phone}
                    onChange={(event) => setNewClient((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Telefon raqami"
                  />
                  <Input
                    className="border border-slate-300 bg-white shadow-lg"
                    value={newClient.inn}
                    onChange={(event) => setNewClient((prev) => ({ ...prev, inn: event.target.value }))}
                    placeholder="STIR"
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="border border-slate-300 bg-white text-black shadow-lg" type="button" onClick={createClientInline} disabled={creatingClient}>
                    {creatingClient ? "Saqlanmoqda..." : "Saqlash"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateClient(false)}>
                    Yopish
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Omborlar</div>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-lg"
              value={warehouseLocationId ?? ""}
              onChange={(event) => setWarehouseLocationId(Number(event.target.value) || null)}
            >
              <option value="">Omborni tanlang...</option>
              {warehouseLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Buyurtma sanasi</div>
                <Input className="border border-slate-300 bg-white shadow-lg" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Yetkazish sanasi</div>
                <Input className="border border-slate-300 bg-white shadow-lg" type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Valyuta</div>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-lg"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  disabled
                >
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Chegirma</div>
                <Input
                  className="h-10 border border-slate-300 bg-white shadow-lg"
                  value={String(discountTotal)}
                  onChange={(event) => setDiscountTotal(safeNumber(event.target.value))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Yetkazib berish manzili</div>
            <Input
              className="border border-slate-300 bg-white shadow-lg"
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              placeholder="Manzil..."
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Yetkazib Beruvchi ismi</div>
            <Input
              className="border border-slate-300 bg-white shadow-lg"
              value={courierName}
              onChange={(event) => setCourierName(event.target.value)}
              placeholder="Yetkazib beruvchi..."
            />
          </div>
        </div>

        <OrderItemsCalcTable
          warehouseLocationId={warehouseLocationId}
          warehouseId={selectedWarehouseLocation?.warehouse_id ?? null}
          initialItems={initialItems}
          resetKey={`${detail?.id ?? "new"}:${open ? "open" : "closed"}:${detail?.updated_at ?? ""}`}
          onItemsChange={setItemsCalc}
          showTotals={false}
        />

        <div className="grid gap-3 text-sm md:grid-cols-5">
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">Umumiy summa</div>
            <div className="text-center font-medium">{totals.sub} {currency}</div>
          </div>
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">QQS summa</div>
            <div className="text-center font-medium">{totals.nds} {currency}</div>
          </div>
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">Umumiy + QQS</div>
            <div className="text-center text-base font-semibold">{totals.withNds} {currency}</div>
          </div>
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">Chegirma</div>
            <div className="text-center font-medium">{totals.disc}</div>
          </div>
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">Umumiy</div>
            <div className="text-center text-base font-semibold">{totals.total}</div>
          </div>
        </div>

        <DialogFooter>
          <Button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-black shadow-lg" onClick={closeDialog} disabled={saving}>
            Yopish
          </Button>
          <Button className="!bg-gradient-to-r from-blue-900 to-blue-700 text-white" onClick={() => void save()} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
