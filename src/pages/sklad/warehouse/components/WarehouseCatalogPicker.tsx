import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react"
import { List, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useI18n } from "@/i18n"
import type { LookupItem } from "../api/types"

type CatalogKind = "PRODUCTS" | "MATERIALS"

type Props = {
  kind: CatalogKind
  products: LookupItem[]
  materials: LookupItem[]
  selectedId: string
  onSelect: (id: string) => void
  disabled?: boolean
  loading?: boolean
  mode?: "inline" | "overlay"
  size?: "default" | "compact"
}

type CatalogRow = LookupItem & {
  category_name?: string | null
  material_type_name?: string | null
}

type IndexedCatalogRow = CatalogRow & {
  normalizedName: string
  normalizedGroupName: string
  normalizedId: string
  groupName: string
  groupKey: string
}

const MAX_GROUPS = 120
const MAX_ROWS = 200

function normalizeGroupKey(name: string) {
  const lower = name.toLowerCase().trim()
  const noTrailingDigits = lower.replace(/[\s\-_]*\d+$/g, "").trim()
  return (noTrailingDigits || lower).replace(/\s+/g, " ")
}

function formatGroupLabel(name: string) {
  const cleaned = name.trim().replace(/[\s\-_]*\d+$/g, "").replace(/\s+/g, " ")
  return cleaned || name.trim()
}

export default function WarehouseCatalogPicker(props: Props) {
  const { language } = useI18n()
  const {
    kind,
    products,
    materials,
    selectedId,
    onSelect,
    disabled = false,
    loading = false,
    mode = "inline",
    size = "default",
  } = props

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [groupKey, setGroupKey] = useState("ALL_NAMES")
  const rootRef = useRef<HTMLDivElement | null>(null)
  const overlayInputId = useId()
  const deferredQuery = useDeferredValue(query)

  const copy =
    language === "ru"
      ? {
          searchProduct: "Поиск по названию товара",
          searchMaterial: "Поиск по названию сырья",
          groups: "Группы",
          allGroups: "Все группы",
          nothingFound: "Ничего не найдено",
          loading: "Загрузка...",
        }
      : language === "en"
        ? {
            searchProduct: "Search by product name",
            searchMaterial: "Search by raw material name",
          groups: "Groups",
          allGroups: "All groups",
          nothingFound: "Nothing found",
          loading: "Loading...",
          showingResults: "Showing",
        }
        : {
            searchProduct: "Mahsulot nomi bo'yicha qidiring",
            searchMaterial: "Xomashyo nomi bo'yicha qidiring",
            groups: "Guruhlar",
            allGroups: "Barcha guruhlar",
            nothingFound: "Hech narsa topilmadi",
            loading: "Yuklanmoqda...",
            showingResults: "Ko'rsatilmoqda",
          }

  const source = useMemo<CatalogRow[]>(
    () => (kind === "PRODUCTS" ? (products as CatalogRow[]) : (materials as CatalogRow[])),
    [kind, materials, products]
  )

  const resolveGroupName = (item: CatalogRow) => {
    const explicitGroup = kind === "PRODUCTS" ? item.category_name : item.material_type_name
    const normalizedExplicit = String(explicitGroup ?? "").trim()
    if (normalizedExplicit) return normalizedExplicit
    return formatGroupLabel(item.name)
  }

  const indexedSource = useMemo<IndexedCatalogRow[]>(() => {
    return source.map((item) => {
      const groupName = resolveGroupName(item)
      return {
        ...item,
        groupName,
        groupKey: normalizeGroupKey(groupName),
        normalizedGroupName: groupName.toLowerCase(),
        normalizedName: item.name.toLowerCase(),
        normalizedId: String(item.id),
      }
    })
  }, [source])

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>()
    indexedSource.forEach((item) => {
      const key = item.groupKey
      if (!key || key === "-" || key === "_") return
      const existing = map.get(key)
      if (existing) existing.count += 1
      else map.set(key, { label: item.groupName, count: 1 })
    })

    return Array.from(map.entries())
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, MAX_GROUPS)
  }, [indexedSource])

  const rows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()
    return indexedSource.filter((item) => {
      const byGroup = groupKey === "ALL_NAMES" || item.groupKey === groupKey
      const byQuery =
        !normalizedQuery ||
        item.normalizedName.includes(normalizedQuery) ||
        item.normalizedGroupName.includes(normalizedQuery) ||
        item.normalizedId.includes(normalizedQuery)
      return byGroup && byQuery
    })
  }, [deferredQuery, groupKey, indexedSource])

  const visibleRows = useMemo(() => rows.slice(0, MAX_ROWS), [rows])

  useEffect(() => {
    if (groupKey === "ALL_NAMES") return
    if (!groups.some((group) => group.key === groupKey)) setGroupKey("ALL_NAMES")
  }, [groupKey, groups])

  useEffect(() => {
    const selected = indexedSource.find((item) => String(item.id) === String(selectedId))
    setQuery(selected?.name ?? "")
  }, [indexedSource, selectedId])

  useEffect(() => {
    if (disabled && open) setOpen(false)
  }, [disabled, open])

  useEffect(() => {
    if (!open || mode === "overlay") return
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [mode, open])

  useEffect(() => {
    if (!open || mode !== "overlay") return
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()

    const rafId = window.requestAnimationFrame(() => {
      const overlayInput = document.getElementById(overlayInputId)
      if (!(overlayInput instanceof HTMLInputElement)) return
      overlayInput.focus()
      const caretPosition = overlayInput.value.length
      overlayInput.setSelectionRange(caretPosition, caretPosition)
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [mode, open, overlayInputId])

  const placeholder = kind === "PRODUCTS" ? copy.searchProduct : copy.searchMaterial
  const compact = size === "compact"
  const controlHeight = compact ? "h-11" : "h-12"
  const overlayMaxWidth = compact ? "max-w-5xl" : "max-w-6xl"

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setOpen(true)
    const exact = indexedSource.find((item) => item.normalizedName === value.trim().toLowerCase())
    onSelect(exact ? String(exact.id) : "")
  }

  const openPickerPanel = () => {
    if (disabled) return
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()
    setOpen(true)
  }

  const panelContent = (
    <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-[20px] bg-white p-3 ring-1 ring-slate-100">
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.groups}</div>
        <button
          data-slot="picker-button"
          type="button"
          className={`mb-2 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
            groupKey === "ALL_NAMES" ? "bg-[#ece8ff] text-[#4a30b3]" : "text-slate-700 hover:bg-slate-100"
          }`}
          onClick={() => setGroupKey("ALL_NAMES")}
        >
          {copy.allGroups}
        </button>
        <div className="max-h-[360px] overflow-auto pr-1">
          {groups.map((group) => (
            <button
              key={group.key}
              data-slot="picker-button"
              type="button"
              className={`mb-2 w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                groupKey === group.key ? "bg-[#ece8ff] text-[#4a30b3]" : "text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => setGroupKey(group.key)}
              title={group.label}
            >
              <span className="block whitespace-normal break-words leading-5">{group.label}</span>
              <span className="ml-1 text-xs opacity-70">({group.count})</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-slate-100">
        <div className="max-h-[420px] overflow-auto p-3">
          {!loading && rows.length > MAX_ROWS ? (
            <div className="mb-3 rounded-2xl border border-[#d7e3f7] bg-[#f8fbff] px-4 py-3 text-xs font-medium text-slate-600">
              {copy.showingResults} {visibleRows.length} / {rows.length}
            </div>
          ) : null}
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              {copy.loading}
            </div>
          ) : null}
          {visibleRows.map((row) => (
            <button
              key={row.id}
              data-slot="picker-button"
              type="button"
              className={`mb-2 w-full rounded-2xl border px-4 py-3 text-left transition ${
                String(row.id) === String(selectedId)
                  ? "border-[#d6cdfd] bg-[#f4f1ff] shadow-sm"
                  : "border-slate-200 bg-white hover:border-[#dbe4f4] hover:bg-slate-50"
              }`}
              onClick={() => {
                onSelect(String(row.id))
                setQuery(row.name)
                setOpen(false)
              }}
            >
              <div className="text-sm font-semibold text-slate-900">{row.name}</div>
              <div className="mt-1 text-xs text-slate-500">ID: {row.id}</div>
            </button>
          ))}
          {!loading && rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              {copy.nothingFound}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const overlayPanel =
    mode === "overlay" ? (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            window.requestAnimationFrame(() => {
              const overlayInput = document.getElementById(overlayInputId)
              if (!(overlayInput instanceof HTMLInputElement)) return
              overlayInput.focus()
              const caretPosition = overlayInput.value.length
              overlayInput.setSelectionRange(caretPosition, caretPosition)
            })
          }}
          className="z-[11000] w-[min(calc(100vw-2rem),76rem)] max-w-none overflow-visible rounded-[30px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)]"
        >
        <div
          className={`relative w-[min(calc(100vw-2rem),76rem)] ${overlayMaxWidth} rounded-[30px] border border-[#d7e3f7] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)]`}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.groups}</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{placeholder}</div>
            </div>
            <button
              data-slot="picker-button"
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id={overlayInputId}
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                className="h-11 rounded-xl border-[#c7d7ef] bg-[#f8fbff] pl-10 pr-3 text-sm text-[#16325c]"
                placeholder={placeholder}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="max-h-[min(72vh,760px)] overflow-hidden rounded-[24px] border border-[#d7e3f7] bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm">
            {panelContent}
          </div>
        </div>
        </DialogContent>
      </Dialog>
    ) : null

  return (
    <div ref={rootRef} className={`relative ${mode === "inline" ? "space-y-2" : ""}`}>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onFocus={openPickerPanel}
            className={`${controlHeight} rounded-2xl border-[#c7d7ef] bg-[#f8fbff] pl-10 pr-3 text-sm text-[#16325c]`}
            placeholder={placeholder}
            disabled={disabled}
          />
        </div>

        <button
          type="button"
          className={`${controlHeight} inline-flex items-center justify-center rounded-2xl border border-blue-800 bg-gradient-to-r from-blue-900 to-blue-700 px-3 text-white transition hover:from-blue-950 hover:to-blue-800`}
          onClick={() => (open ? setOpen(false) : openPickerPanel())}
          disabled={disabled}
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      {open ? (mode === "overlay" ? overlayPanel : panelContent) : null}
    </div>
  )
}
