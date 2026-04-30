import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createKontragent,
  createOrder,
  fetchKontragents,
  fetchWarehouseLocations,
  type Kontragent,
  type WarehouseLocation,
} from "@/pages/orders/api/ordersApi"
import { useDebouncedValue } from "@/pages/orders/api/useDebouncedValue"
import OrderItemsCalcTable, { type OrderCalcItemRow } from "@/pages/orders/components/OrderItemsCalcTable"
import { toast } from "react-toastify"
import { PackagePlus, UserPlus } from "lucide-react"
import { useI18n } from "@/i18n"

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function safeNumber(n: any) {
  const x = Number(n)
  return Number.isFinite(x) ? x : 0
}

function clampNdsRate(n: any) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(100, x))
}

function normalizeClientSearchText(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function formatClientSearchLabel(client: Kontragent) {
  const baseName = String(client.name || "").trim()
  const extra = [client.code ? `Kod: ${client.code}` : "", client.inn ? `STIR: ${client.inn}` : ""]
    .filter(Boolean)
    .join(" | ")

  return extra ? `${baseName} (${extra})` : baseName
}

export default function OrderCreateDialog(props: { onSuccess?: () => void }) {
  const { language } = useI18n()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Master data
  const [clients, setClients] = useState<Kontragent[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([])

  // Form state
  const [clientSearch, setClientSearch] = useState("")
  const debouncedClientSearch = useDebouncedValue(clientSearch, 250)

  const [clientId, setClientId] = useState<number | null>(null)
  const [selectedClientOption, setSelectedClientOption] = useState<Kontragent | null>(null)
  const [warehouseLocationId, setWarehouseLocationId] = useState<number | null>(null)

  const [orderDate, setOrderDate] = useState(todayISO())
  const [deliveryDate, setDeliveryDate] = useState(todayISO())
  const [currency, setCurrency] = useState("UZS")
  const [discountTotal, setDiscountTotal] = useState<number>(0)
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [courierName, setCourierName] = useState("")

  const [itemsCalc, setItemsCalc] = useState<OrderCalcItemRow[]>([])

  // Inline client create
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "", inn: "" })
  const [creatingClient, setCreatingClient] = useState(false)
  const copy =
    language === "ru"
      ? {
        action: { create: "Новый заказ", save: "Сохранить", saving: "Сохранение...", close: "Закрыть" },
        form: {
          clients: "Клиенты",
          searchClient: "Поиск клиента...",
          newClient: "Новый клиент",
          selectClient: "Выберите клиента...",
          warehouses: "Склады",
          selectWarehouse: "Выберите склад...",
          orderDate: "Дата заказа",
          deliveryDate: "Дата доставки",
          currency: "Валюта",
          discount: "Скидка",
          address: "Адрес доставки",
          addressPlaceholder: "Адрес...",
          courier: "Имя курьера",
          courierPlaceholder: "Курьер...",
          total: "Общая сумма",
          nds: "Сумма НДС",
          totalWithNds: "Итого + НДС",
          totalFinal: "Итого",
          name: "Имя",
          phone: "Телефон",
        },
        errors: {
          selectClient: "Выберите клиента",
          addItem: "Добавьте хотя бы 1 позицию",
          selectWarehouse: "Выберите склад",
          invalidItems: "Укажите продукт и количество",
          duplicate: "Нельзя добавить один и тот же товар дважды в один заказ.",
          clientName: "Введите имя клиента",
          clientCreate: "Ошибка создания клиента.",
        },
        toast: { saved: "Заказ сохранен" },
      }
      : language === "en"
        ? {
          action: { create: "New order", save: "Save", saving: "Saving...", close: "Close" },
          form: {
            clients: "Clients",
            searchClient: "Search client...",
            newClient: "New client",
            selectClient: "Select client...",
            warehouses: "Warehouses",
            selectWarehouse: "Select warehouse...",
            orderDate: "Order date",
            deliveryDate: "Delivery date",
            currency: "Currency",
            discount: "Discount",
            address: "Notes",
            addressPlaceholder: "Notes...",
            courier: "Courier name",
            courierPlaceholder: "Courier...",
            total: "Total amount",
            nds: "VAT amount",
            totalWithNds: "Total + VAT",
            totalFinal: "Total",
            name: "Name",
            phone: "Phone",
          },
          errors: {
            selectClient: "Select a client",
            addItem: "Add at least 1 item",
            selectWarehouse: "Select a warehouse",
            invalidItems: "Please specify a product and quantity",
            duplicate: "You cannot add the same product twice to one order.",
            clientName: "Enter client name",
            clientCreate: "Client create error.",
          },
          toast: { saved: "Order saved" },
        }
        : {
          action: { create: "Yangi buyurtma", save: "Saqlash", saving: "Saqlanmoqda...", close: "Yopish" },
          form: {
            clients: "Mijozlar",
            searchClient: "Mijozni Qidirmoq...",
            newClient: "Yangi mijoz",
            selectClient: "Mijoz tanlang...",
            warehouses: "Omborlar",
            selectWarehouse: "Omborni tanlang...",
            orderDate: "Buyurtma sanasi",
            deliveryDate: "Yetkazish sanasi",
            currency: "Valyuta",
            discount: "Chegirma",
            address: "Yetkazib berish manzili",
            addressPlaceholder: "Manzil...",
            courier: "Yetkazib Beruvchi ismi",
            courierPlaceholder: "Yetkazib beruvchi...",

            total: "Umumiy summa",
            nds: "QQS summa",
            totalWithNds: "Umumiy + QQS",
            totalFinal: "Umumiy",
            name: "Ismi",
            phone: "Telefon raqami",
          },
          errors: {
            selectClient: "Mijozni tanlang",
            addItem: "Kamida 1 ta mahsulot qo'shing",
            selectWarehouse: "Omborni tanlang",
            invalidItems: "Mahsulot va miqdorni kiriting",
            duplicate: "Bir xil mahsulotni bitta buyurtmaga ikki marta qo'shib bo'lmaydi.",
            stockCheck: "Mahsulot qoldig'ini tekshirib bo'lmadi. Qayta urinib ko'ring.",
            clientName: "Mijoz ismini kiriting",
            clientCreate: "Mijozni yaratish xatosi.",
          },
          toast: { saved: "Buyurtma saqlandi va mahsulot qoldig'i kamaytirildi", syncWarning: "Buyurtma saqlandi, lekin mahsulot qoldig'i kamaymadi." },

        }

  // Dialog ochilganda warehouse master datani yuklaydi.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      try {
        const w = await fetchWarehouseLocations().catch(() => [] as WarehouseLocation[])
        if (cancelled) return

        setWarehouseLocations(w)
      } catch (e) {
        console.error(e)
      }
    }

    load()
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
        const nextClients = await fetchKontragents({
          search: debouncedClientSearch || undefined,
          page_size: debouncedClientSearch ? 100 : 500,
          limit: debouncedClientSearch ? 50 : 500,
        })
        if (cancelled) return
        setClients(nextClients)
      } catch (e) {
        console.error(e)
        if (!cancelled) setClients([])
      } finally {
        if (!cancelled) setClientsLoading(false)
      }
    }

    loadClients()
    return () => {
      cancelled = true
    }
  }, [open, debouncedClientSearch])

  const filteredClients = useMemo(() => {
    const q = debouncedClientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((x) => {
      return (
        x.name?.toLowerCase().includes(q) ||
        x.code?.toLowerCase().includes(q) ||
        (x.phone ?? "").toLowerCase().includes(q) ||
        (x.inn ?? "").toLowerCase().includes(q)
      )
    })
  }, [clients, debouncedClientSearch])

  const clientOptions = useMemo(() => {
    const byId = new Map<number, Kontragent>()
    if (selectedClientOption?.id) byId.set(selectedClientOption.id, selectedClientOption)
    filteredClients.forEach((client) => {
      if (client.id) byId.set(client.id, client)
    })
    return Array.from(byId.values())
  }, [filteredClients, selectedClientOption])

  const clientSuggestions = useMemo(() => clientOptions.slice(0, 12), [clientOptions])

  const clientSearchMeta = useMemo(() => {
    const q = normalizeClientSearchText(clientSearch)
    if (!q) return null

    return clientOptions.find((client) => {
      const searchTokens = [
        client.name,
        client.code,
        client.phone ?? "",
        client.inn ?? "",
        formatClientSearchLabel(client),
      ]
      return searchTokens.some((token) => normalizeClientSearchText(token) === q)
    }) ?? null
  }, [clientOptions, clientSearch])

  const selectedWarehouseLocation = useMemo(() => {
    if (!warehouseLocationId) return null
    return warehouseLocations.find((x) => x.id === warehouseLocationId) ?? null
  }, [warehouseLocationId, warehouseLocations])

  function round2(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100
  }

  const totals = useMemo(() => {
    const summary = itemsCalc.reduce((acc, it: any) => {
      const unitCost = safeNumber(it?.unit_cost)
      const qty = safeNumber(it?.qty)
      const ndsPercent = safeNumber(it?.nds_percent)
      const brutto = unitCost * qty
      const nds = brutto * (ndsPercent / 100)
      acc.sub += brutto
      acc.nds += nds
      acc.withNds += round2(brutto + nds)
      return acc
    }, { sub: 0, nds: 0, withNds: 0 })
    const disc = safeNumber(discountTotal)
    const total = Math.max(0, summary.withNds - disc)
    return {
      sub: round2(summary.sub),
      nds: round2(summary.nds),
      withNds: round2(summary.withNds),
      disc,
      total: round2(total),
    }
  }, [itemsCalc, discountTotal])

  const resetFormState = () => {
    setClients([])
    setClientsLoading(false)
    setClientSearch("")
    setClientId(null)
    setSelectedClientOption(null)
    setWarehouseLocationId(null)
    setOrderDate(todayISO())
    setDeliveryDate(todayISO())
    setCurrency("UZS")
    setDiscountTotal(0)
    setDeliveryAddress("")
    setCourierName("")
    setItemsCalc([])
    setShowCreateClient(false)
    setNewClient({ name: "", phone: "", email: "", inn: "" })
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) resetFormState()
  }

  const closeDialog = () => handleDialogOpenChange(false)

  const handleClientSearchChange = (value: string) => {
    setClientSearch(value)
    const q = normalizeClientSearchText(value)
    if (!q) return

    const exactMatch = clientOptions.find((client) => {
      return [client.name, client.code, client.phone ?? "", client.inn ?? "", formatClientSearchLabel(client)]
        .some((token) => normalizeClientSearchText(token) === q)
    })

    if (exactMatch) {
      setClientId(exactMatch.id)
      setSelectedClientOption(exactMatch)
      return
    }

    if (selectedClientOption) {
      const selectedStillMatches = [
        selectedClientOption.name,
        selectedClientOption.code,
        selectedClientOption.phone ?? "",
        selectedClientOption.inn ?? "",
        formatClientSearchLabel(selectedClientOption),
      ].some((token) => normalizeClientSearchText(token) === q)

      if (!selectedStillMatches) {
        setClientId(null)
        setSelectedClientOption(null)
      }
    }
  }

  const handleClientSelectChange = (value: string) => {
    const nextId = Number(value) || null
    setClientId(nextId)

    if (!nextId) {
      setSelectedClientOption(null)
      return
    }

    const nextClient = clientOptions.find((client) => client.id === nextId) ?? null
    if (!nextClient) return

    setSelectedClientOption(nextClient)
    setClientSearch(nextClient.name || "")
  }

  const submit = async () => {
    // Zakaz yaratish: backend create serializeriga mos payload yuboradi.
    try {
      if (!clientId) {
        toast.error(copy.errors.selectClient)
        return
      }

      if (!itemsCalc || itemsCalc.length === 0) {
        toast.error(copy.errors.addItem)
        return
      }

      const bad = itemsCalc.find((x: any) => !x.product_id || Number(x.qty) <= 0)
      if (bad) {
        toast.error(copy.errors.invalidItems)
        return
      }

      setLoading(true)

      const mappedItems = itemsCalc
        .filter((x: any) => x.product_id)
        .map((x: any) => {
          const unitCost = Number(x.unit_cost || 0)
          const qty = Number(x.qty || 0)
          const ndsPercent = clampNdsRate(x.nds_percent)

          return {
            item_type: "FINISHED_PRODUCT",
            product: x.product_id,
            qty: qty.toFixed(6),
            unit_price: unitCost,
            nds_rate: round2(ndsPercent).toFixed(2),
          }
        })

      const duplicateProductIds = mappedItems.reduce<number[]>((acc, item) => {
        if (!item.product || acc.includes(item.product)) return acc
        const occurrences = mappedItems.filter((row) => row.product === item.product).length
        if (occurrences > 1) acc.push(item.product)
        return acc
      }, [])

      if (duplicateProductIds.length > 0) {
        toast.error(copy.errors.duplicate)
        return
      }

      // API guide bo'yicha create payload.
      const payload = {
        client: clientId,
        order_date: orderDate,
        discount_total: safeNumber(discountTotal),
        notes: deliveryAddress || undefined,
        courier_name: courierName || undefined,
        delivery_date: deliveryDate || undefined,
        items: mappedItems,
      }

      await createOrder(payload)
      toast.success(copy.toast.saved)
      closeDialog()
      props.onSuccess?.()
    } catch (e: any) {
      console.error("ORDER CREATE ERROR:", e?.response?.data || e)
      const status = e?.response?.status
      const data = e?.response?.data
      const msg =
        data && typeof data === "object"
          ? JSON.stringify(data, null, 2)
          : String(data || e?.message || e)

      toast.error(`Order create error (${status ?? "no-status"}): ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const createClientInline = async () => {
    // Dialog ichidan tezkor yangi client yaratish helperi.
    try {
      if (!newClient.name.trim()) {
        toast.error(copy.errors.clientName)
        return
      }
      setCreatingClient(true)
      const created = await createKontragent({
        name: newClient.name.trim(),
        phone: newClient.phone || undefined,
        email: newClient.email || undefined,
        inn: newClient.inn || undefined,
        kind: "CLIENT",
      })
      setClients((prev) => [created, ...prev])
      setClientId(created.id)
      setSelectedClientOption(created)
      setClientSearch(created.name || "")
      setShowCreateClient(false)
      setNewClient({ name: "", phone: "", email: "", inn: "" })
    } catch (e) {
      console.error(e)
      toast.error(copy.errors.clientCreate)
    } finally {
      setCreatingClient(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="!bg-gradient-to-r from-blue-900 to-blue-700 text-white"> <span><PackagePlus /></span>{copy.action.create}</Button>
      </DialogTrigger>

      <DialogContent
        className="max-w-[1350px] overflow-x-hidden overflow-y-auto rounded-[28px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          window.requestAnimationFrame(() => {
            const input = document.querySelector<HTMLInputElement>('input[list="order-client-suggestions"]')
            input?.focus()
          })
        }}
      >
        <DialogHeader>

        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">{copy.form.clients}</div>
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder={copy.form.searchClient}
                className="h-11 rounded-xl border-slate-300 bg-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.28)] placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-100"
                list="order-client-suggestions"
                value={clientSearch}
                onChange={(e) => handleClientSearchChange(e.target.value)}
              />
              <datalist id="order-client-suggestions">
                {clientSuggestions.map((client) => (
                  <option key={client.id} value={formatClientSearchLabel(client)} />
                ))}
              </datalist>
              <Button className="bg-gradient-to-r from-blue-900 to-blue-700 text-white" type="button" variant="outline" onClick={() => setShowCreateClient((v) => !v)}>
                <span><UserPlus /></span> {copy.form.newClient}
              </Button>
            </div>
            <Select value={clientId ? String(clientId) : undefined} onValueChange={handleClientSelectChange}>
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.3)] transition focus-visible:border-blue-500 focus-visible:ring-[3px] focus-visible:ring-blue-100">
                <SelectValue placeholder={copy.form.selectClient} />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={6} className="rounded-xl border-slate-200 bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.28)]">
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)} className="rounded-lg text-sm text-slate-900">
                    {c.name}{c.inn ? ` - ${c.inn}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {
              clientSearchMeta ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" >
                  Tanlangan mijoz: {clientSearchMeta.name
                  }{clientSearchMeta.inn ? ` | STIR: ${clientSearchMeta.inn}` : ""}
                </div >
              ) : null
            }

            {
              showCreateClient ? (
                <div className="rounded-md border border-slate-300 bg-white shadow-lg p-3 space-y-2">
                  <div className="text-sm font-medium">{copy.form.newClient}</div>
                  <Input
                    placeholder=""
                    className="border border-slate-300 bg-white shadow-lg"
                    value={newClient.name}
                    onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder={copy.form.phone}
                      className="border border-slate-300 bg-white shadow-lg"
                      value={newClient.phone}
                      onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))}
                    />
                    <Input
                      placeholder="STIR"
                      className="border border-slate-300 bg-white shadow-lg"
                      value={newClient.inn}
                      onChange={(e) => setNewClient((p) => ({ ...p, inn: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button className="border border-slate-300 bg-white shadow-lg text-black" type="button" onClick={createClientInline} disabled={creatingClient}>
                      {creatingClient ? copy.action.saving : copy.action.save}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCreateClient(false)}>
                      {copy.action.close}
                    </Button>
                  </div>
                </div>
              ) : null
            }
          </div >

          <div className="space-y-2">
            <div className="text-sm font-medium">{copy.form.warehouses}</div>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white shadow-lg px-2 text-sm"
              value={warehouseLocationId ?? ""}
              onChange={(e) => setWarehouseLocationId(Number(e.target.value) || null)}
            >
              <option value="">{copy.form.selectWarehouse}</option>
              {warehouseLocations.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground  mb-1">{copy.form.orderDate}</div>
                <Input className="border border-slate-300 bg-white shadow-lg" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">{copy.form.deliveryDate}</div>
                <Input className="border border-slate-300 bg-white shadow-lg" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">{copy.form.currency}</div>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white shadow-lg px-2 text-sm"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">{copy.form.discount}</div>
                <Input
                  className=" h-10 border border-slate-300 bg-white shadow-lg"
                  value={String(discountTotal)}
                  onChange={(e) => setDiscountTotal(Number(e.target.value || 0))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div >

        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{copy.form.address}</div>
            <Input
              className="border border-slate-300 bg-white shadow-lg"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder={copy.form.addressPlaceholder}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{copy.form.courier}</div>
            <Input className="border border-slate-300 bg-white shadow-lg" value={courierName} onChange={(e) => setCourierName(e.target.value)} placeholder={copy.form.courierPlaceholder} />
          </div>
        </div>

        <OrderItemsCalcTable
          warehouseLocationId={warehouseLocationId}
          warehouseId={selectedWarehouseLocation?.warehouse_id ?? null}
          onItemsChange={setItemsCalc}
          showTotals={false}
        />

        <div className="grid gap-3 text-sm md:grid-cols-5">
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">{copy.form.total}</div>
            <div className="text-center font-medium">{totals.sub} {currency}</div>
          </div>
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">{copy.form.nds}</div>
            <div className="text-center font-medium">{totals.nds} {currency}</div>
          </div>
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">{copy.form.totalWithNds}</div>
            <div className="text-center text-base font-semibold">{totals.withNds} {currency}</div>
          </div>
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">{copy.form.discount}</div>
            <div className="text-center font-medium">{totals.disc}</div>
          </div>
          <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-md border border-blue-700 bg-white px-4 py-3 shadow-lg">
            <div className="text-center text-muted-foreground">{copy.form.totalFinal}</div>
            <div className="text-center text-base font-semibold">{totals.total}</div>
          </div>
        </div>

        <DialogFooter>
          <Button className="border border-slate-300 bg-white shadow-lg px-4 py-2 rounded-md text-black" onClick={closeDialog}>
            {copy.action.close}
          </Button>
          <Button className="!bg-gradient-to-r from-blue-900 to-blue-700 text-white" onClick={submit} disabled={loading}>
            {loading ? copy.action.saving : copy.action.save}
          </Button>
        </DialogFooter>
      </DialogContent >
    </Dialog >
  )
}
