import { useEffect, useMemo, useState } from "react"
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
import { fetchProducts, fetchUoms, type Product, type Uom } from "@/Api/catalog"
import { fetchOnHand, type OnHandRow } from "@/Api/warehouse"
import { PackagePlus, X } from "lucide-react"
import { useI18n } from "@/i18n"
import WarehouseCatalogPicker from "@/pages/sklad/warehouse/components/WarehouseCatalogPicker"
import { warehouseApi } from "@/pages/sklad/warehouse/api/warehouseApi"
import type { LookupItem } from "@/pages/sklad/warehouse/api/types"

type ItemRow = {
  key: string
  order_item_id?: number | null
  product_id: number | null
  product_name?: string
  uom_id: number | null
  unit_cost: number
  qty: number
  stock_qty: number | null
  nds_percent: number
  currency: string
}

export type OrderCalcItemRow = ItemRow

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function toNum(x: any) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

function toQty(x: any) {
  const n = Number(x)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n * 1_000_000) / 1_000_000)
}

function clampNdsRate(x: any) {
  const n = Number(x)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function toPercentFromRate(x: any) {
  const n = Number(x)
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n <= 1) return clampNdsRate(n * 100)
  return clampNdsRate(n)
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export default function OrderItemsCalcTable(props: {
  warehouseLocationId: number | null
  warehouseId?: number | null
  onItemsChange?: (items: OrderCalcItemRow[]) => void
  showTotals?: boolean
  initialItems?: OrderCalcItemRow[]
  resetKey?: string | number
}) {
  const { language } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [uoms, setUoms] = useState<Uom[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [onHandRows, setOnHandRows] = useState<OnHandRow[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const createEmptyRow = (): ItemRow => ({
    key: uid(),
    order_item_id: null,
    product_id: null,
    uom_id: null,
    unit_cost: 0,
    qty: 1,
    stock_qty: null,
    nds_percent: 0,
    currency: "UZS",
  })

  const normalizeInitialItems = (rows?: OrderCalcItemRow[]): ItemRow[] => {
    if (!rows?.length) return [createEmptyRow()]
    return rows.map((row) => ({
      key: row.key || uid(),
      order_item_id: row.order_item_id ?? null,
      product_id: row.product_id ?? null,
      product_name: row.product_name,
      uom_id: row.uom_id ?? null,
      unit_cost: toNum(row.unit_cost),
      qty: toQty(row.qty),
      stock_qty: row.stock_qty ?? null,
      nds_percent: clampNdsRate(row.nds_percent),
      currency: row.currency || "UZS",
    }))
  }

  const [items, setItems] = useState<ItemRow[]>(() => normalizeInitialItems(props.initialItems))

  const copy =
    language === "ru"
      ? {
          title: "Товары",
          add: "Добавить товар",
          product: "Товар",
          uom: "Ед. изм.",
          unitCost: "Себестоимость",
          qty: "Количество",
          stock: "Остаток",
          nds: "НДС %",
          total: "Общая сумма",
          select: "Выбрать...",
          selectWarehouse: "Выберите склад",
          loading: "Загрузка...",
          notEnough: "Недостаточно остатка",
          noNds: "Для этого товара НДС не применяется",
          subtotal: "Общая сумма",
          ndsTotal: "Сумма НДС",
          totalWithNds: "Общая сумма + НДС",
        }
      : language === "en"
        ? {
            title: "Products",
            add: "Add product",
            product: "Product",
            uom: "UOM",
            unitCost: "Unit cost",
            qty: "Qty",
            stock: "Stock",
            nds: "VAT %",
            total: "Total amount",
            select: "Select...",
            selectWarehouse: "Select warehouse",
            loading: "Loading...",
            notEnough: "Insufficient stock",
            noNds: "VAT is not applied to this product",
            subtotal: "Total amount",
            ndsTotal: "VAT amount",
            totalWithNds: "Total + VAT",
          }
        : {
            title: "Mahsulotlar",
            add: "Mahsulot qo'shish",
            product: "Mahsulotlar",
            uom: "O'lchov birligi",
            unitCost: "Tan narxi",
            qty: "Soni",
            stock: "Qoldiqlar",
            nds: "QQS %",
            total: "Umumiy summa",
            select: "Tanlang...",
            selectWarehouse: "Omborni tanlang",
            loading: "Yuklanmoqda...",
            notEnough: "Qoldiq yetarli emas",
            noNds: "Bu mahsulotga QQS qo'llanmaydi",
            subtotal: "Umumiy summa",
            ndsTotal: "QQS summa",
            totalWithNds: "Umumiy + QQS",
          }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setCatalogLoading(true)
        const [productRows, uomRows] = await Promise.all([
          fetchProducts().catch(async () => {
            const fallbackRows = await warehouseApi.listProducts().catch(() => [])
            return fallbackRows.map((item) => ({
              id: item.id,
              name: item.name,
              category: null,
              category_name: null,
              uom: 0,
              uom_name: "",
              default_selling_price: 0,
              currency: "UZS",
            }))
          }),
          fetchUoms().catch(() => [] as Uom[]),
        ])

        if (cancelled) return
        setProducts(productRows)
        setUoms(uomRows)
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (props.resetKey === undefined) return
    const next = normalizeInitialItems(props.initialItems)
    setItems(next)
    props.onItemsChange?.(next)
  }, [props.resetKey])

  useEffect(() => {
    if (!props.warehouseLocationId) {
      setOnHandRows([])
      setStockLoading(false)
      setItems((prev) => {
        const next = prev.map((x) => ({ ...x, stock_qty: null }))
        props.onItemsChange?.(next)
        return next
      })
      return
    }

    let cancelled = false
    setStockLoading(true)
    setOnHandRows([])
    setItems((prev) => {
      const next = prev.map((x) => ({ ...x, stock_qty: null }))
      props.onItemsChange?.(next)
      return next
    })

    ;(async () => {
      try {
        const rows = await fetchOnHand(
          props.warehouseLocationId
            ? {
                location: props.warehouseLocationId,
                warehouse: props.warehouseId ?? undefined,
              }
            : undefined
        )
        if (cancelled) return
        setOnHandRows(rows)
      } finally {
        if (!cancelled) setStockLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [props.warehouseLocationId, props.warehouseId])

  const stockMap = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of onHandRows) {
      if (r.item_type !== "FINISHED_PRODUCT" && r.item_type !== "PRODUCT") continue
      if (!r.product_id) continue
      m.set(r.product_id, (m.get(r.product_id) ?? 0) + toNum(r.qty_onhand))
    }
    return m
  }, [onHandRows])

  useEffect(() => {
    setItems((prev) => {
      const next = prev.map((r) => ({
        ...r,
        stock_qty:
          props.warehouseLocationId && r.product_id
            ? stockLoading
              ? null
              : (stockMap.get(r.product_id) ?? 0)
            : null,
      }))
      props.onItemsChange?.(next)
      return next
    })
  }, [props.warehouseLocationId, stockMap, stockLoading])

  const productMap = useMemo(() => {
    const m = new Map<number, Product>()
    products.forEach((p) => m.set(p.id, p))
    return m
  }, [products])

  const catalogProducts = useMemo<LookupItem[]>(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        category_name: product.category_name ?? null,
      })),
    [products]
  )

  const setRow = (key: string, patch: Partial<ItemRow>) => {
    setItems((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
      props.onItemsChange?.(next)
      return next
    })
  }

  const addRow = () => {
    setItems((prev) => {
      const next = [
        ...prev,
        {
          key: uid(),
          order_item_id: null,
          product_id: null,
          uom_id: null,
          unit_cost: 0,
          qty: 1,
          stock_qty: null,
          nds_percent: 0,
          currency: "UZS",
        },
      ]
      props.onItemsChange?.(next)
      return next
    })
  }

  const removeRow = (key: string) => {
    setItems((prev) => {
      const next = prev.filter((r) => r.key !== key)
      props.onItemsChange?.(next)
      return next
    })
  }

  const calc = (r: ItemRow) => {
    const brutto = round2(toNum(r.unit_cost) * toNum(r.qty))
    const nds_sum = round2(brutto * (toNum(r.nds_percent) / 100))
    const total = round2(brutto + nds_sum)
    return { brutto, nds_sum, total }
  }

  const grand = useMemo(() => {
    return items.reduce(
      (acc, r) => {
        const c = calc(r)
        acc.brutto += c.brutto
        acc.nds += c.nds_sum
        acc.total += c.total
        acc.currency = r.currency || acc.currency
        return acc
      },
      { brutto: 0, nds: 0, total: 0, currency: "UZS" }
    )
  }, [items])

  const pickProduct = (key: string, productId: number) => {
    const p = productMap.get(productId)
    if (!p) return

    const ndsPercent = p.nds_applies ? toPercentFromRate(p.nds_rate) : 0
    const stock = props.warehouseLocationId ? (stockMap.get(p.id) ?? 0) : null

    setRow(key, {
      product_id: p.id,
      product_name: p.name,
      uom_id: p.uom,
      unit_cost: toNum(p.default_selling_price),
      qty: 1,
      stock_qty: stock,
      nds_percent: ndsPercent,
      currency: p.currency ?? "UZS",
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{copy.title}</div>
        <Button className="bg-gradient-to-r from-blue-900 to-blue-700 text-white" type="button" variant="outline" onClick={addRow}>
          <span><PackagePlus /></span> {copy.add}
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">{copy.product}</TableHead>
              <TableHead className="w-[180px]">{copy.uom}</TableHead>
              <TableHead className="w-[170px]">{copy.unitCost}</TableHead>
              <TableHead className="w-[130px]">{copy.qty}</TableHead>
              <TableHead className="w-[160px]">{copy.stock}</TableHead>
              <TableHead className="w-[120px]">{copy.nds}</TableHead>
              <TableHead className="w-[180px]">{copy.total}</TableHead>
              <TableHead className="w-[72px]"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((r) => {
              const p = r.product_id ? productMap.get(r.product_id) : null
              const { total } = calc(r)
              const insufficientStock =
                Boolean(props.warehouseLocationId) &&
                Boolean(r.product_id) &&
                !stockLoading &&
                toNum(r.qty) > toNum(r.stock_qty)

              return (
                <TableRow key={r.key} className="align-top">
                  <TableCell className="align-top">
                    <div className="min-w-[360px]">
                      <WarehouseCatalogPicker
                        kind="PRODUCTS"
                        products={catalogProducts}
                        materials={[]}
                        selectedId={String(r.product_id ?? "")}
                        loading={catalogLoading}
                        mode="overlay"
                        size="compact"
                        onSelect={(value) => {
                          const id = Number(value)
                          if (id) {
                            pickProduct(r.key, id)
                            return
                          }

                          setRow(r.key, {
                            product_id: null,
                            product_name: undefined,
                            uom_id: null,
                            unit_cost: 0,
                            qty: 1,
                            stock_qty: props.warehouseLocationId ? 0 : null,
                            nds_percent: 0,
                            currency: "UZS",
                          })
                        }}
                      />
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <select
                      className="h-11 w-full min-w-[150px] rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm"
                      value={r.uom_id ?? ""}
                      onChange={(e) => setRow(r.key, { uom_id: Number(e.target.value) || null })}
                    >
                      <option value="">{copy.select}</option>
                      {uoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>

                  <TableCell className="align-top">
                    <Input
                      className="h-11 min-w-[150px] border border-slate-300 bg-white shadow-sm"
                      type="number"
                      value={String(r.unit_cost ?? 0)}
                      onChange={(e) => setRow(r.key, { unit_cost: toNum(e.target.value) })}
                      placeholder="0"
                    />
                  </TableCell>

                  <TableCell className="align-top">
                    <Input
                      className={`h-11 min-w-[110px] bg-white shadow-sm ${insufficientStock ? "border border-rose-500 focus-visible:ring-rose-200" : "border border-slate-300"}`}
                      type="number"
                      min="0"
                      step="0.000001"
                      value={String(r.qty ?? 0)}
                      onChange={(e) => setRow(r.key, { qty: toQty(e.target.value) })}
                      placeholder="0"
                    />
                  </TableCell>

                  <TableCell className="align-top">
                    {!props.warehouseLocationId ? copy.selectWarehouse : stockLoading ? copy.loading : (
                      <div className="space-y-1 pt-2">
                        <div className="font-medium text-slate-800">{r.stock_qty ?? 0}</div>
                        {insufficientStock ? <div className="text-xs font-medium text-rose-600">{copy.notEnough}</div> : null}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="align-top">
                    <Input
                      type="number"
                      className="h-11 min-w-[100px] border border-slate-300 bg-white shadow-sm"
                      value={String(r.nds_percent ?? 0)}
                      onChange={(e) => setRow(r.key, { nds_percent: clampNdsRate(e.target.value) })}
                      min="0"
                      max="100"
                      placeholder="0"
                      disabled={p?.nds_applies === false}
                      title={p?.nds_applies ? "" : copy.noNds}
                    />
                  </TableCell>

                  <TableCell className="align-top font-medium">
                    <div className="pt-2 text-base font-semibold text-slate-900">
                      {total} {r.currency}
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <Button type="button" variant="ghost" className="mt-1 h-11 w-11 rounded-xl bg-blue-700 text-white hover:bg-blue-800" onClick={() => removeRow(r.key)}>
                      <X color="white" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {props.showTotals !== false && (
        <div className="flex justify-end gap-8 text-sm">
          <div className="flex flex-col gap-2 rounded-md border border-blue-700 bg-white px-4 py-2 shadow-lg">
            <div className="text-muted-foreground text-center ">{copy.subtotal}</div>
            <div className="font-medium text-center">{round2(grand.brutto)} {grand.currency}</div>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-blue-700 bg-white px-4 py-2 shadow-lg">
            <div className="text-muted-foreground text-center">{copy.ndsTotal}</div>
            <div className="font-medium text-center">{round2(grand.nds)} {grand.currency}</div>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-blue-700 bg-white px-4 py-2 shadow-lg">
            <div className="text-muted-foreground text-center">{copy.totalWithNds}</div>
            <div className="text-base font-semibold text-center">{round2(grand.total)} {grand.currency}</div>
          </div>
        </div>
      )}
    </div>
  )
}
