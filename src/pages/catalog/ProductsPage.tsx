import { useEffect, useMemo, useState } from "react"
import { Plus, Search, Trash2, X } from "lucide-react"
import { toast } from "react-toastify"
import { useI18n } from "@/i18n"
import DashboardShell from "@/pages/Dashboard/components/DashboardShell"
import ProductCreateModal from "@/pages/Dashboard/components/ProductCreateModal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import TablePagination from "@/components/common/TablePagination"
import ProductsTable from "./components/ProductsTable"
import ProductCrudModal from "./components/ProductCrudModal"
import { extractProductApiErrorMessage, productsApi, type Product } from "./api/ProductsApi"
import { fetchOnHand } from "@/Api/warehouse"
import { dictsApi, type ProductCategoryRow } from "@/pages/Settings/Api/dictsApi"
import Portal from "@/pages/documents/components/Portal"

type Ui = "loading" | "error" | "ready"

export default function ProductsPage() {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
        loadError: "Ошибка при загрузке товаров",
        removeConfirm: "Удалить {{count}} товаров?",
        no: "Нет",
        yesDelete: "Да, удалить",
        removeSuccess: "{{count}} товаров удалено",
        removeFailed: "Не удалось удалить {{count}} товаров.",
        removeError: "Ошибка при удалении выбранных товаров",
        title: "Товары",
        search: "Поиск...",
        add: "Добавить",
        delete: "Удалить",
        newest: "Сначала новые",
        loading: "Загрузка...",
        error: "Ошибка",
        total: "Всего",
      }
      : language === "en"
        ? {
          loadError: "Failed to load products",
          removeConfirm: "Delete {{count}} products?",
          no: "No",
          yesDelete: "Yes, delete",
          removeSuccess: "{{count}} products deleted",
          removeFailed: "Failed to delete {{count}} products.",
          removeError: "Failed to delete selected products",
          title: "Products",
          search: "Search...",
          allCategories: "All categories",
          add: "Add",
          delete: "Delete",
          newest: "Newest first",
          loading: "Loading...",
          error: "Error",
          total: "Total",
        }
        : {
          loadError: "Mahsulotlar yuklashda xatolik",
          removeConfirm: "{{count}} ta mahsulotni o'chirasizmi?",
          no: "Yo'q",
          yesDelete: "Ha, o'chiring!",
          removeSuccess: "{{count}} ta mahsulot o'chirildi",
          removeFailed: "{{count}} ta mahsulotni o'chirib bo'lmadi.",
          removeError: "Tanlangan mahsulotlarni o'chirishda xatolik",
          title: "Mahsulotlar",
          search: "Qidirish...",
          allCategories: "Barcha kategoriyalar",
          add: "Qo'shish",
          delete: "Delete",
          newest: "Yangi avval",
          loading: "Yuklanmoqda...",
          error: "Xatolik",
          total: "Jami",
        }
  const deleteDialogCopy =
    language === "ru"
      ? { title: "Удаление товаров", cancel: "Отмена", close: "Закрыть" }
      : language === "en"
        ? { title: "Delete products", cancel: "Cancel", close: "Close" }
        : { title: "Mahsulotlarni o'chirish", cancel: "Bekor", close: "Yopish" }
  const categoryFilterLabel =
    language === "ru" ? "\u0412\u0441\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438" : language === "en" ? "All categories" : "Barcha kategoriyalar"
  const [ui, setUi] = useState<Ui>("loading")
  const [err, setErr] = useState<string | null>(null)

  const [rows, setRows] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategoryRow[]>([])

  const [q, setQ] = useState("")
  const [categoryId, setCategoryId] = useState("ALL")
  const [ordering, setOrdering] = useState<"name" | "-name" | "-created_at">("-created_at")
  const [page, setPage] = useState(1)
  const pageSize = 10
  const selectedCategoryName = useMemo(
    () => categories.find((category) => String(category.id) === categoryId)?.name ?? null,
    [categories, categoryId]
  )
  const filteredRows = useMemo(() => {
    if (categoryId === "ALL") return rows

    const normalizedCategoryName = normalizeLookupName(selectedCategoryName)
    return rows.filter((row) => {
      if (row.category !== null && String(row.category) === categoryId) return true
      return normalizedCategoryName.length > 0 && normalizeLookupName(row.category_name) === normalizedCategoryName
    })
  }, [rows, categoryId, selectedCategoryName])
  const count = filteredRows.length
  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize])
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page])

  const [openCreate, setOpenCreate] = useState(false)
  const [openCrud, setOpenCrud] = useState(false)
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view")
  const [current, setCurrent] = useState<Product | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [stockByProductId, setStockByProductId] = useState<Record<number, number>>({})
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false)

  async function load() {
    try {
      setUi("loading")
      setErr(null)
      const res = await productsApi.listAll({
        category: categoryId === "ALL" ? undefined : Number(categoryId),
        search: q.trim() || undefined,
        ordering,
      })

      // Ombor qoldiqlarini backenddan o'qib, product_id bo'yicha yig'amiz.
      try {
        const onHandRows = await fetchOnHand({ item_type: "FINISHED_PRODUCT" })
        const nextMap: Record<number, number> = {}
        for (const row of onHandRows) {
          const productId = Number(row.product_id ?? 0)
          if (!productId) continue
          const qty = Number(row.qty_onhand ?? 0)
          nextMap[productId] = (nextMap[productId] ?? 0) + (Number.isFinite(qty) ? qty : 0)
        }
        setStockByProductId(nextMap)
      } catch {
        // Qoldiq endpointi xato bersa ham mahsulotlar sahifasi ishlayveradi.
        setStockByProductId({})
      }

      setRows(res.rows)
      setSelectedIds((prev) => prev.filter((id) => res.rows.some((r) => r.id === id)))
      setUi("ready")
    } catch (e: any) {
      setUi("error")
      setErr(extractProductApiErrorMessage(e, copy.loadError))
    }
  }

  useEffect(() => {
    void dictsApi
      .listProductCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordering])

  useEffect(() => {
    setPage(1)
  }, [q, categoryId, ordering])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filteredRows.some((row) => row.id === id)))
  }, [filteredRows])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function openProductModal(p: Product, m: "view" | "edit" | "delete") {
    setCurrent(p)
    setMode(m)
    setOpenCrud(true)
  }

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((x) => x !== id)
    })
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pagedRows.map((row) => row.id)])))
      return
    }
    setSelectedIds((prev) => prev.filter((id) => !pagedRows.some((row) => row.id === id)))
  }

  async function removeSelected() {
    if (selectedIds.length === 0) return
    setOpenDeleteConfirm(true)
  }

  async function confirmRemoveSelected() {
    if (selectedIds.length === 0) {
      setOpenDeleteConfirm(false)
      return
    }

    try {
      setUi("loading")
      setErr(null)
      const settled = await Promise.allSettled(selectedIds.map((id) => productsApi.remove(id)))
      const failed = settled.filter((s) => s.status === "rejected").length
      const success = settled.length - failed
      setSelectedIds([])
      setOpenDeleteConfirm(false)
      await load()
      if (success > 0) toast.success(copy.removeSuccess.replace("{{count}}", String(success)))
      if (failed > 0) setErr(copy.removeFailed.replace("{{count}}", String(failed)))
    } catch (e: any) {
      setUi("error")
      const message = extractProductApiErrorMessage(e, copy.removeError)
      setErr(message)
      toast.error(message)
    }
  }

  return (
    <>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-extrabold text-slate-900">{copy.title}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="text-slate-400"><Search size="16" /></span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={copy.search}
                className="w-64 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
              />
            </div>

            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-10 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                <SelectValue placeholder={categoryFilterLabel} />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="end" sideOffset={6} className="rounded-xl border-slate-200 bg-white shadow-lg">
                <SelectItem value="ALL">{categoryFilterLabel}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setOpenCreate(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl !bg-gradient-to-r from-blue-900 to-blue-700 text-white cursor-pointer px-4 text-sm font-extrabold"
            >
              <Plus size={16} />
              {copy.add}
            </button>

            <button
              type="button"
              data-slot="button"
              onClick={removeSelected}
              disabled={selectedIds.length === 0 || ui === "loading"}
              className="inline-flex h-10 items-center gap-2 cursor-pointer rounded-xl border border-rose-700 bg-rose-600 px-4 text-sm font-extrabold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:border-rose-300 disabled:bg-rose-300 disabled:text-white/80"
            >
              <Trash2 size={16} />
              {copy.delete}
            </button>

            <Select value={ordering} onValueChange={(value) => setOrdering(value as "name" | "-name" | "-created_at")}>
              <SelectTrigger className="h-10 min-w-[140px] rounded-xl border border-blue-800 !bg-gradient-to-r from-blue-900 to-blue-700 px-3 text-sm font-bold text-white hover:from-blue-950 hover:to-blue-800 [&_svg:not([class*='text-'])]:text-white/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="end" sideOffset={6} className="rounded-xl border-slate-200 bg-white shadow-lg">
                <SelectItem value="-created_at">{copy.newest}</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="-name">Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          {ui === "loading" && <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm">{copy.loading}</div>}
          {ui === "error" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{err ?? copy.error}</div>
          )}
          {ui === "ready" && (
            <>
              <ProductsTable
                rows={pagedRows}
                onOpen={(p) => openProductModal(p, "view")}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                stockByProductId={stockByProductId}
              />

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  {copy.total}: <b>{count}</b>
                </div>

                <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>

      <ProductCreateModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={() => {
          setOpenCreate(false)
          load()
        }}
      />

      <ProductCrudModal
        open={openCrud}
        mode={mode}
        current={current}
        onRequestEdit={() => setMode("edit")}
        onClose={() => setOpenCrud(false)}
        onChanged={() => load()}
      />

      {openDeleteConfirm ? (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label={deleteDialogCopy.close}
              className="absolute inset-0 bg-[rgba(15,23,42,0.32)] backdrop-blur-[2px]"
              onClick={() => setOpenDeleteConfirm(false)}
              disabled={ui === "loading"}
            />

            <div className="relative w-full max-w-[620px] rounded-[26px] border border-[#d6e0ef] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_28px_90px_-36px_rgba(15,23,42,0.42)]">
              <button
                type="button"
                aria-label={deleteDialogCopy.close}
                title={deleteDialogCopy.close}
                onClick={() => setOpenDeleteConfirm(false)}
                disabled={ui === "loading"}
                className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-[18px] border border-[#d7e3f7] bg-[#eef4fb] text-[#5a6f90] transition hover:bg-[#e5eef9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={22} />
              </button>

              <div className="pr-16 text-[17px] font-extrabold text-[#0f172a]">{deleteDialogCopy.title}</div>
              <div className="mt-8 max-w-[520px] text-[15px] leading-8 text-[#526a8f]">
                {copy.removeConfirm.replace("{{count}}", String(selectedIds.length))}
              </div>

              <div className="mt-8 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setOpenDeleteConfirm(false)}
                  disabled={ui === "loading"}
                  className="inline-flex h-12 min-w-[120px] items-center justify-center rounded-[18px] border border-[#d2dceb] bg-[#f4f8fc] px-6 text-[16px] font-semibold text-[#42556f] transition hover:bg-[#ecf2f9] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteDialogCopy.cancel}
                </button>

                <button
                  type="button"
                  onClick={confirmRemoveSelected}
                  disabled={ui === "loading"}
                  className="inline-flex h-12 min-w-[132px] items-center justify-center rounded-[18px] border border-[#d9044f] bg-[#f20557] px-6 text-[16px] font-extrabold text-white shadow-[0_12px_30px_-16px_rgba(242,5,87,0.9)] transition hover:bg-[#de0450] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ui === "loading" ? copy.loading : copy.delete}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  )
}

function normalizeLookupName(value?: string | null): string {
  return String(value ?? "").trim().toLocaleLowerCase()
}
