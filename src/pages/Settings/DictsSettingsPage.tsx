import { useEffect, useMemo, useState } from "react"
import DashboardShell from "@/pages/Dashboard/components/DashboardShell"
import {
  dictsApi,
  type UomRow,
  type ProductCategoryRow,
  type WarehouseLocationRow,
} from "./Api/dictsApi"
import { Plus, Search, Trash2 } from "lucide-react"
import TablePagination from "@/components/common/TablePagination"
import { useClientPagination } from "@/components/common/useClientPagination"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n"

type TabKey = "uom" | "category" | "location"
type RowBase = { id: number; name: string; code?: string }
type AppLanguage = "uz" | "ru" | "en"

const UOM_LABELS: Record<string, Record<AppLanguage, string>> = {
  piece: { uz: "Dona", ru: "Штука", en: "Piece" },
  kilogram: { uz: "Kilogram", ru: "Килограмм", en: "Kilogram" },
  meter: { uz: "Metr", ru: "Метр", en: "Meter" },
  liter: { uz: "Litr", ru: "Литр", en: "Liter" },
  ton: { uz: "Tonna", ru: "Тонна", en: "Ton" },
  kilogram_ton: { uz: "Kilogram/tonna", ru: "Килограмм/тонна", en: "Kilogram/ton" },
}

const UOM_ALIASES: Record<string, keyof typeof UOM_LABELS> = {
  dona: "piece",
  piece: "piece",
  pieces: "piece",
  pcs: "piece",
  pc: "piece",
  sht: "piece",
  shtuka: "piece",
  штука: "piece",
  шт: "piece",
  kg: "kilogram",
  kilogram: "kilogram",
  kilogramm: "kilogram",
  килограмм: "kilogram",
  кг: "kilogram",
  metr: "meter",
  meter: "meter",
  metre: "meter",
  метр: "meter",
  m: "meter",
  litr: "liter",
  liter: "liter",
  litre: "liter",
  литр: "liter",
  l: "liter",
  tonna: "ton",
  ton: "ton",
  тонна: "ton",
  t: "ton",
  kgt: "kilogram_ton",
  "kilogram tonna": "kilogram_ton",
  "kilogram-tonna": "kilogram_ton",
  "kilogram/tonna": "kilogram_ton",
  "kg ton": "kilogram_ton",
  "kg/ton": "kilogram_ton",
  "kilogram ton": "kilogram_ton",
}

function normalizeLookupValue(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

function getLocalizedUomName(name: string, code: string | undefined, language: AppLanguage) {
  const candidates = [code, name].map(normalizeLookupValue).filter(Boolean)

  for (const candidate of candidates) {
    const key = UOM_ALIASES[candidate]
    if (key) return UOM_LABELS[key][language]
  }

  return name
}

function getDisplayRowName(row: RowBase, language: AppLanguage, showCodeField: boolean) {
  if (!showCodeField) return row.name
  return getLocalizedUomName(row.name, row.code, language)
}

function cx(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ")
}

function getApiErrorMessage(error: any, fallback: string) {
  const status = Number(error?.response?.status || 0)
  const data = error?.response?.data
  const detail = data?.detail ? String(data.detail) : ""
  const text = typeof data === "string" ? data : data ? JSON.stringify(data) : ""
  if (status === 409) return detail || fallback
  if (status === 400 && (detail || text.toLowerCase().includes("already exists"))) return detail || fallback
  if (detail) return detail
  if (typeof data === "string" && data.trim()) return data
  if (text) return text
  return fallback
}

export default function DictsSettingsPage() {
  const { language } = useI18n()
  const pageTitle = language === "ru" ? "Справочники" : language === "en" ? "Reference Data" : "Ma'lumotnoma"
  const tabs: Array<{ key: TabKey; title: string; subtitle: string }> = useMemo(
    () =>
      language === "ru"
        ? [
          { key: "uom", title: "Единицы измерения", subtitle: "Единицы измерения (кг, шт, литр...)" },
          { key: "category", title: "Группы товаров", subtitle: "Группы товаров" },
          { key: "location", title: "Склады", subtitle: "Складские локации" },
        ]
        : language === "en"
          ? [
            { key: "uom", title: "Units of measure", subtitle: "Units of measure (kg, pcs, liter...)" },
            { key: "category", title: "Product groups", subtitle: "Product groups" },
            { key: "location", title: "Warehouses", subtitle: "Warehouse locations" },
          ]
          : [
            { key: "uom", title: "O'lchov birliklari", subtitle: "O'lchov birliklari (kg, dona, litr...)" },
            { key: "category", title: "Mahsulot guruhlari", subtitle: "Mahsulot guruhlari" },
            { key: "location", title: "Omborlar", subtitle: "Ombor joylari" },
          ],
    [language]
  )
  const [tab, setTab] = useState<TabKey>("uom")
  const tabByKey = useMemo(
    () => Object.fromEntries(tabs.map((item) => [item.key, item])) as Record<TabKey, { key: TabKey; title: string; subtitle: string }>,
    [tabs]
  )

  return (
    <DashboardShell>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-lg font-extrabold text-slate-900">{pageTitle}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cx(
                "h-9 rounded-lg border px-3 py-0 text-xs font-extrabold transition-colors duration-200",
                tab === t.key
                  ? "border-[#0A4D96] bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-[0_8px_18px_rgba(10,77,150,0.22)]"
                  : "border-slate-300 bg-white text-black shadow-lg hover:border-slate-300 hover:bg-white hover:text-black"
              )}
            >
              {t.title}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {tab === "uom" && (
          <DictSection<UomRow>
            title={tabByKey.uom.title}
            subtitle={tabByKey.uom.subtitle}
            fetcher={dictsApi.listUom}
            detailer={dictsApi.getUom}
            creator={dictsApi.createUom}
            patcher={dictsApi.patchUom}
            deleter={dictsApi.deleteUom}
            showCodeField
          />
        )}
        {tab === "category" && (
          <DictSection<ProductCategoryRow>
            title={tabByKey.category.title}
            subtitle={tabByKey.category.subtitle}
            fetcher={dictsApi.listProductCategories}
            detailer={dictsApi.getProductCategory}
            creator={dictsApi.createProductCategory}
            patcher={dictsApi.patchProductCategory}
            deleter={dictsApi.deleteProductCategory}
          />
        )}
        {tab === "location" && (
          <DictSection<WarehouseLocationRow>
            title={tabByKey.location.title}
            subtitle={tabByKey.location.subtitle}
            fetcher={dictsApi.listWarehouseLocations}
            detailer={dictsApi.getWarehouseLocation}
            creator={dictsApi.createWarehouseLocation}
            patcher={dictsApi.patchWarehouseLocation}
            deleter={dictsApi.deleteWarehouseLocation}
          />
        )}
      </div>
    </DashboardShell>
  )
}

function DictSection<T extends RowBase>({
  title,
  subtitle,
  fetcher,
  detailer,
  creator,
  patcher,
  deleter,
  showCodeField = false,
}: {
  title: string
  subtitle: string
  fetcher: () => Promise<T[]>
  detailer: (id: number) => Promise<T>
  creator: (p: { name: string; code?: string }) => Promise<T>
  patcher: (id: number, p: { name?: string; code?: string }) => Promise<T>
  deleter: (id: number) => Promise<any>
  showCodeField?: boolean
}) {
  const { language } = useI18n()
  const [ui, setUi] = useState<"loading" | "ready" | "error">("loading")
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<T[]>([])
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "edit" | "view" | "delete">("create")
  const [current, setCurrent] = useState<T | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const copy =
    language === "ru"
      ? {
        loadError: "Ошибка загрузки",
        readError: "Ошибка получения данных",
        requiredName: "Название обязательно.",
        requiredCode: "Code обязателен.",
        saveError: "Ошибка сохранения",
        deleteError: "Ошибка удаления",
        searchNameCode: "Поиск (name/code)...",
        searchName: "Поиск (name)...",
        add: "Добавить",
        loading: "Загрузка...",
        genericError: "Ошибка",
        type: "Тип",
        code: "Code",
        actions: "Действия",
        empty: "Пока данных нет.",
        view: "Просмотр",
        edit: "Редактировать",
        del: "Удалить",
        createTitle: "Добавить новый тип",
        editTitle: "Редактировать",
        viewTitle: "Просмотр",
        deleteTitle: "Удаление",
        deleteQuestion: "Вы действительно хотите удалить",
        cancel: "Отмена",
        close: "Закрыть",
        save: "Сохранить",
      }
      : language === "en"
        ? {
          loadError: "Load error",
          readError: "Failed to fetch data",
          requiredName: "Name is required.",
          requiredCode: "Code is required.",
          saveError: "Save error",
          deleteError: "Delete error",
          searchNameCode: "Search (name/code)...",
          searchName: "Search (name)...",
          add: "Add",
          loading: "Loading...",
          genericError: "Error",
          type: "Type",
          code: "Code",
          actions: "Actions",
          empty: "No data yet.",
          view: "View",
          edit: "Edit",
          del: "Delete",
          createTitle: "Add new type",
          editTitle: "Edit",
          viewTitle: "View",
          deleteTitle: "Delete",
          deleteQuestion: "Are you sure you want to delete",
          cancel: "Cancel",
          close: "Close",
          save: "Save",
        }
        : {
          loadError: "Yuklashda xatolik",
          readError: "Ma'lumotni olishda xatolik",
          requiredName: "Nomi majburiy.",
          requiredCode: "Code majburiy.",
          saveError: "Saqlashda xatolik",
          deleteError: "O'chirishda xatolik",
          searchNameCode: "Qidirish (name/code)...",
          searchName: "Qidirish (name)...",
          add: "Qo'shish",
          loading: "Yuklanmoqda...",
          genericError: "Xatolik",
          type: "Turi",
          code: "Code",
          actions: "Amallar",
          empty: "Hozircha ma'lumot yo'q.",
          view: "Ko'rish",
          edit: "Tahrirlash",
          del: "O'chirish",
          createTitle: "Yangi tur qo'shish",
          editTitle: "Tahrirlash",
          viewTitle: "Ko'rish",
          deleteTitle: "O'chirish",
          deleteQuestion: "Rostdan ham",
          cancel: "Bekor",
          close: "Yopish",
          save: "Saqlash",
        }

  async function load() {
    try {
      setUi("loading")
      setErr(null)
      const data = await fetcher()
      setRows(data)
      setSelectedIds((prev) => prev.filter((id) => data.some((row) => row.id === id)))
      setUi("ready")
    } catch (e: any) {
      setUi("error")
      setErr(getApiErrorMessage(e, copy.loadError))
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return rows
    return rows.filter((r) => {
      const displayName = getDisplayRowName(r, language as AppLanguage, showCodeField).toLowerCase()
      return (
        String(r.name ?? "").toLowerCase().includes(qq) ||
        displayName.includes(qq) ||
        String(r.code ?? "").toLowerCase().includes(qq)
      )
    })
  }, [rows, q, language, showCodeField])
  const { page, setPage, totalPages, pagedItems: pagedRows } = useClientPagination(filtered, 10, [q, rows.length, language])
  const allPageSelected = pagedRows.length > 0 && pagedRows.every((row) => selectedIds.includes(row.id))

  function openCreate() { setMode("create"); setCurrent(null); setName(""); setCode(""); setErr(null); setOpen(true) }
  function openEdit(r: T) { setMode("edit"); setCurrent(r); setName(r.name ?? ""); setCode(r.code ?? ""); setErr(null); setOpen(true) }
  function openDeleteSelected() { setMode("delete"); setCurrent(null); setErr(null); setOpen(true) }
  function toggleRowSelection(id: number, checked: boolean) {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id)))
  }
  function togglePageSelection(checked: boolean) {
    const pageIds = pagedRows.map((row) => row.id)
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, ...pageIds])) : prev.filter((id) => !pageIds.includes(id))))
  }

  async function save() {
    try {
      setErr(null)
      const n = name.trim()
      const c = code.trim()
      if (!n) return setErr(copy.requiredName)
      if (showCodeField && !c) return setErr(copy.requiredCode)
      if (mode === "create") {
        const created = await creator(showCodeField ? { name: n, code: c } : { name: n })
        setRows((prev) => [created, ...prev]); setOpen(false); return
      }
      if (mode === "edit" && current) {
        const updated = await patcher(current.id, showCodeField ? { name: n, code: c } : { name: n })
        setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x))); setOpen(false)
      }
    } catch (e: any) { setErr(getApiErrorMessage(e, copy.saveError)) }
  }

  async function remove() {
    try {
      setErr(null)
      if (selectedIds.length > 0) {
        await Promise.all(selectedIds.map((id) => deleter(id)))
        setRows((prev) => prev.filter((x) => !selectedIds.includes(x.id)))
        setSelectedIds([])
      } else {
        if (!current) return
        await deleter(current.id)
        setRows((prev) => prev.filter((x) => x.id !== current.id))
      }
      setOpen(false)
    } catch (e: any) { setErr(getApiErrorMessage(e, copy.deleteError)) }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 p-4 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-extrabold">{title}</div>
          <div className="text-xs">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={openDeleteSelected}
            disabled={selectedIds.length === 0}
            className="flex h-10 items-center gap-2 rounded-xl border !border-rose-200 bg-rose-50 px-5 text-sm font-bold !text-rose-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span><Trash2 size={18} /></span> {copy.del}
          </Button>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="text-slate-400"><Search size="16" /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={showCodeField ? copy.searchNameCode : copy.searchName} className="h-5 w-56 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
          </div>
          <Button type="button" onClick={openCreate} className="flex h-10 items-center gap-2 rounded-xl border !border-slate-300 bg-white px-5 text-sm font-bold text-black shadow-lg">
            <span><Plus /></span> {copy.add}
          </Button>
        </div>
      </div>

      {ui === "loading" && <div className="mt-4 text-xs text-slate-500">{copy.loading}</div>}
      {ui === "error" && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err || copy.genericError}</div>}

      {ui === "ready" && (
        <>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="w-14 px-4 py-4 text-center font-bold">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={(e) => togglePageSelection(e.target.checked)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Select all rows"
                    />
                  </th>
                  <th className="px-6 py-4 font-bold">{copy.type}</th>
                  {showCodeField && <th className="px-6 py-4 font-bold">{copy.code}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={showCodeField ? 3 : 2} className="px-6 py-10 text-center text-sm text-slate-500">{copy.empty}</td></tr>
                ) : (
                  pagedRows.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer bg-white transition hover:bg-slate-50"
                      onClick={() => {
                        setCurrent(r)
                        openEdit(r)
                      }}
                    >
                      <td className="px-4 py-5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={(e) => toggleRowSelection(r.id, e.target.checked)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select row ${r.id}`}
                        />
                      </td>
                      <td className="px-6 py-5 font-medium text-slate-900">{getDisplayRowName(r, language as AppLanguage, showCodeField)}</td>
                      {showCodeField && <td className="px-6 py-5 text-slate-700">{r.code || "-"}</td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 ? (
            <div className="mt-4 flex justify-end">
              <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      )}

      {open && (
        <Modal title={mode === "create" ? copy.createTitle : mode === "edit" ? copy.editTitle : mode === "view" ? copy.viewTitle : copy.deleteTitle} err={err} onClose={() => setOpen(false)}>
          {mode === "delete" ? (
            <div>
              <div className="text-sm text-slate-700">
                {selectedIds.length > 0 ? (
                  <>{copy.deleteQuestion} <b>{selectedIds.length}</b> {language === "ru" ? "записей?" : language === "en" ? "records?" : "ta yozuvni o'chirmoqchimisiz?"}</>
                ) : (
                  <>{copy.deleteQuestion} <b>{current ? getDisplayRowName(current, language as AppLanguage, showCodeField) : ""}</b>{language === "uz" ? " ni o'chirmoqchimisiz?" : "?"}</>
                )}
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <Btn onClick={() => setOpen(false)} variant="ghost">{copy.cancel}</Btn>
                <Btn onClick={remove} variant="danger">{copy.del}</Btn>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 gap-3">
                {showCodeField && <Field label={copy.code}><input value={code} onChange={(e) => setCode(e.target.value)} disabled={mode === "view"} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none disabled:bg-slate-50" /></Field>}
                <Field label={copy.type}><input value={mode === "view" && current ? getDisplayRowName(current, language as AppLanguage, showCodeField) : name} onChange={(e) => setName(e.target.value)} disabled={mode === "view"} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none disabled:bg-slate-50" /></Field>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <Btn onClick={() => setOpen(false)} variant="ghost">{mode === "view" ? copy.close : copy.cancel}</Btn>
                {mode !== "view" && <Btn onClick={save} variant="primary">{copy.save}</Btn>}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose, err }: { title: string; children: React.ReactNode; onClose: () => void; err: string | null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-extrabold text-slate-900">{title}</div>
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 !bg-gradient-to-r from-blue-900 to-blue-700 px-3 text-xs font-extrabold text-white hover:from-blue-950 hover:to-blue-800">X</button>
          </div>
          {err && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] font-extrabold text-slate-600">{label}</div><div className="mt-1">{children}</div></div>
}

function Btn({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant: "primary" | "ghost" | "danger" }) {
  const cls = variant === "primary" ? "app-btn-default text-white" : variant === "danger" ? "bg-rose-600 text-white hover:bg-rose-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  return <button type="button" onClick={onClick} className={cx("h-10 rounded-xl !bg-gradient-to-r from-blue-900 to-blue-700 px-4 text-sm font-extrabold text-white hover:from-blue-950 hover:to-blue-800", cls)}>{children}</button>
}
