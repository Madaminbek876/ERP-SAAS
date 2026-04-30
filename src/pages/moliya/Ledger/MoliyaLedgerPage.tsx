import { useEffect, useMemo, useState } from "react"
import { financeClient } from "../shared/financeClient"
import { apiAxios } from "@/Api/api.axios"
import type { FinanceEntry, EntryType, PaymentMethod } from "../shared/types"
import { Pencil, Trash2 } from "lucide-react"
import TablePagination from "@/components/common/TablePagination"
import TableActionIconButton from "@/components/common/TableActionIconButton"
import { useClientPagination } from "@/components/common/useClientPagination"

type Filters = {
  startDate?: string
  endDate?: string
  entryType?: EntryType | "ALL"
  category?: string | "ALL"
  paymentMethod?: PaymentMethod | "ALL"
  referenceType?: string | "ALL"
  referenceId?: string
}

function cx(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ")
}

type ClientOption = {
  id: string
  name: string
}

const badgeType: Record<string, string> = {
  INCOME: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPENSE: "bg-rose-50 text-rose-700 border-rose-200",
  ADJUSTMENT: "bg-slate-50 text-slate-700 border-slate-200",
}

const badgePay: Record<string, string> = {
  BANK: "bg-sky-50 text-sky-700 border-sky-200",
  CARD: "bg-indigo-50 text-indigo-700 border-indigo-200",
  CASH: "bg-amber-50 text-amber-700 border-amber-200",
}

function toCSV(rows: FinanceEntry[]) {
  const head = ["date", "entryType", "category", "amount", "currency", "paymentMethod", "reference", "notes"].join(",")
  const body = rows
    .map((r) =>
      [
        r.date,
        r.entryType,
        `"${r.category.replaceAll('"', '""')}"`,
        r.amount,
        r.currency,
        r.paymentMethod,
        `"${(r.reference ?? "").replaceAll('"', '""')}"`,
        `"${(r.notes ?? "").replaceAll('"', '""')}"`,
      ].join(",")
    )
    .join("\n")
  return head + "\n" + body
}

export default function MoliyaLedgerPage() {
  const [all, setAll] = useState<FinanceEntry[]>([])
  const [ui, setUi] = useState<"loading" | "ready" | "error">("loading")
  const [err, setErr] = useState<string | null>(null)
  const readOnlyNotice = "Finance / Entries backend contract is read-only. Creating, editing, and deleting entries is disabled."

  const [draft, setDraft] = useState<Filters>({
    entryType: "ALL",
    category: "ALL",
    paymentMethod: "ALL",
    referenceType: "ALL",
  })
  const [applied, setApplied] = useState<Filters>(draft)

  // вњ… modal: add / edit
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceEntry | null>(null)

  async function load() {
    try {
      setUi("loading")
      setErr(null)
      const res = await financeClient.listEntries()
      setAll(res)
      setUi("ready")
    } catch (e: any) {
      setUi("error")
      setErr(e?.message || "Failed to load ledger entries")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const categories = useMemo(() => {
    const s = new Set(all.map((x) => x.category))
    return ["ALL", ...Array.from(s)]
  }, [all])

  const filtered = useMemo(() => {
    const f = applied
    return all.filter((r) => {
      if (f.startDate && r.date < f.startDate) return false
      if (f.endDate && r.date > f.endDate) return false
      if (f.entryType && f.entryType !== "ALL" && r.entryType !== f.entryType) return false
      if (f.category && f.category !== "ALL" && r.category !== f.category) return false
      if (f.paymentMethod && f.paymentMethod !== "ALL" && r.paymentMethod !== f.paymentMethod) return false
      if (f.referenceType && f.referenceType !== "ALL" && r.referenceType !== f.referenceType) return false
      if (f.referenceId?.trim()) {
        const q = f.referenceId.trim().toLowerCase()
        if (!String(r.referenceId ?? "").toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [all, applied])
  const { page, setPage, totalPages, pagedItems: pagedRows } = useClientPagination(filtered, 10, [filtered.length, JSON.stringify(applied)])

  function resetFilters() {
    const x: Filters = { entryType: "ALL", category: "ALL", paymentMethod: "ALL", referenceType: "ALL" }
    setDraft(x)
    setApplied(x)
  }

  function exportCSV() {
    const csv = toCSV(filtered)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `finance_ledger_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function removeRow(id: string) {
    await financeClient.deleteEntry(id)
    await load()
  }

  function openAdd() {
    setEditing(null)
    setOpen(true)
  }

  function openEdit(row: FinanceEntry) {
    setEditing(row)
    setOpen(true)
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 md:p-5 shadow-sm">
      {/* Top row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-extrabold text-slate-900">Ledger entries</div>
          <div className="mt-1 text-sm text-slate-500">List</div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={openAdd}
            disabled
            className="h-10 cursor-not-allowed rounded-xl bg-slate-300 px-4 text-sm font-extrabold text-white"
            title={readOnlyNotice}
          >
            + Add new entry
          </button>

          <button
            type="button"
            onClick={exportCSV}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {readOnlyNotice}
      </div>

      {/* Filters */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-extrabold text-slate-900">Filter ledger</div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
          <div>
            <div className="text-[11px] font-bold text-slate-600">Start date</div>
            <input
              type="date"
              value={draft.startDate ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value || undefined }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-600">End date</div>
            <input
              type="date"
              value={draft.endDate ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value || undefined }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-600">Entry type</div>
            <select
              value={draft.entryType ?? "ALL"}
              onChange={(e) => setDraft((p) => ({ ...p, entryType: e.target.value as any }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="ALL">All</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-600">Category</div>
            <select
              value={draft.category ?? "ALL"}
              onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "All" : c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-600">Payment method</div>
            <select
              value={draft.paymentMethod ?? "ALL"}
              onChange={(e) => setDraft((p) => ({ ...p, paymentMethod: e.target.value as any }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="ALL">All</option>
              <option value="BANK">Bank transfer</option>
              <option value="CARD">Card</option>
              <option value="CASH">Cash</option>
            </select>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-600">Reference type</div>
            <select
              value={draft.referenceType ?? "ALL"}
              onChange={(e) => setDraft((p) => ({ ...p, referenceType: e.target.value }))}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="ALL">All</option>
              <option value="ORDER">ORDER</option>
              <option value="PURCHASE">PURCHASE</option>
              <option value="SALARY">SALARY</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="text-[11px] font-bold text-slate-600">Reference ID</div>
            <input
              value={draft.referenceId ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, referenceId: e.target.value || undefined }))}
              placeholder="Masalan: INV789"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            />
          </div>

          <div className="md:col-span-3 flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>

            <button
              type="button"
              onClick={() => setApplied(draft)}
              className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-extrabold text-white hover:bg-slate-800"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        {ui === "loading" && <div className="p-4 text-sm text-slate-600">Loading...</div>}
        {ui === "error" && <div className="p-4 text-sm text-rose-700">{err}</div>}

        {ui === "ready" && (
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-extrabold">Date</th>
                <th className="px-4 py-3 font-extrabold">Type</th>
                <th className="px-4 py-3 font-extrabold">Category</th>
                <th className="px-4 py-3 font-extrabold">Amount</th>
                <th className="px-4 py-3 font-extrabold">Currency</th>
                <th className="px-4 py-3 font-extrabold">Payment</th>
                <th className="px-4 py-3 font-extrabold">Reference</th>
                <th className="px-4 py-3 font-extrabold">Notes</th>
                <th className="px-4 py-3 font-extrabold text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-900">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No entries found yet.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-700">{r.date}</td>

                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
                          badgeType[r.entryType]
                        )}
                      >
                        {r.entryType === "INCOME" ? "Income" : r.entryType === "EXPENSE" ? "Expense" : "Adjustment"}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-semibold">{r.category}</td>

                    <td className="px-4 py-3 font-extrabold">{r.amount.toLocaleString("en-US")}</td>

                    <td className="px-4 py-3 text-slate-600 font-bold">{r.currency}</td>

                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
                          badgePay[r.paymentMethod]
                        )}
                      >
                        {r.paymentMethod === "BANK" ? "Bank" : r.paymentMethod === "CARD" ? "Card" : "Cash"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-600 font-semibold">{r.reference}</td>
                    <td className="px-4 py-3 text-slate-600">{r.notes ?? "-"}</td>

                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <TableActionIconButton title={readOnlyNotice} onClick={() => openEdit(r)} disabled>
                          <Pencil size={16} />
                        </TableActionIconButton>
                        <TableActionIconButton title={readOnlyNotice} danger onClick={() => removeRow(r.id)} disabled>
                          <Trash2 size={16} />
                        </TableActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* вњ… Modal */}
      {ui === "ready" && filtered.length > 0 ? (
        <div className="mt-4 flex justify-end">
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      {open && (
        <EntryModal
          editing={editing}
          onClose={() => {
            setOpen(false)
            setEditing(null)
          }}
          onSaved={async () => {
            setOpen(false)
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

/** вњ… KICHIK MODAL: Add/Edit */
function EntryModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: FinanceEntry | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!editing
  const initialClientId =
    String(editing?.referenceType ?? "").toUpperCase() === "CLIENT" && editing?.referenceId != null
      ? String(editing.referenceId)
      : ""

  const [entryType, setEntryType] = useState<EntryType | "">(editing?.entryType ?? "")
  const [clientId, setClientId] = useState(initialClientId)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [amount, setAmount] = useState(String(editing?.amount ?? ""))
  const [currency, setCurrency] = useState<"UZS" | "USD" | "RUB">((editing?.currency as any) ?? "UZS")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(editing?.paymentMethod ?? "")
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(editing?.notes ?? "")

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function loadClients() {
      try {
        setClientsLoading(true)
        const data = await apiAxios.listClientsPage({
          page: 1,
          page_size: 500,
          ordering: "name",
          is_active: true,
        })
        if (!alive) return
        setClients(
          data.items
            .map((x, i) => ({
              id: String(x.id ?? `client-${i}`),
              name: String(x.name ?? x.code ?? `Client #${i + 1}`),
            }))
            .filter((x) => x.id && x.name)
        )
      } catch (e: any) {
        if (!alive) return
        setClients([])
        setErr(e?.message || "Failed to load clients")
      } finally {
        if (alive) setClientsLoading(false)
      }
    }
    loadClients()
    return () => {
      alive = false
    }
  }, [])

  async function save() {
    setErr(null)

    const a = Number(amount)
    if (!clientId) return setErr("Select a client.")
    if (!entryType) return setErr("Select a type.")
    if (!Number.isFinite(a) || a <= 0) return setErr("Invalid amount.")
    if (!paymentMethod) return setErr("Select a payment method.")
    if (!date) return setErr("Date is required.")

    setSaving(true)
    try {
      const payload = {
        date,
        entryType,
        category:
          editing?.category ||
          (entryType === "INCOME" ? "CLIENT_PAYMENT" : entryType === "EXPENSE" ? "CLIENT_EXPENSE" : "CLIENT_ADJUSTMENT"),
        amount: a,
        currency,
        paymentMethod,
        referenceType: "CLIENT",
        referenceId: clientId,
        notes: notes.trim() || undefined,
      }

      if (isEdit && editing) {
        await financeClient.updateEntry(editing.id, payload as any)
      } else {
        await financeClient.createEntry(payload as any)
      }

      await onSaved()
    } catch (e: any) {
      const data = e?.response?.data
      const msg =
        typeof data === "string"
          ? data
          : data?.detail || (data ? JSON.stringify(data) : e?.message || "Failed to save entry")
      setErr(String(msg))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              {isEdit ? "Edit entry" : "New finance entry"}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">Income / Expense / Adjustment</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 max-h-[70vh] overflow-y-auto">
          {err && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-700">
              {err}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <FieldSmall label="Client">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
              >
                <option value="">{clientsLoading ? "Loading..." : "Select..."}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FieldSmall>

            <FieldSmall label="Amount">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="For example: 150000"
                inputMode="numeric"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
              />
            </FieldSmall>

            <div className="grid grid-cols-2 gap-3">
              <FieldSmall label="Currency">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                >
                  <option value="UZS">UZS</option>
                </select>
              </FieldSmall>

              <FieldSmall label="Payment method">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                >
                  <option value="">Select...</option>
                  <option value="BANK">Bank</option>
                  <option value="CARD">Card</option>
                  <option value="CASH">Cash</option>
                </select>
              </FieldSmall>
            </div>

            <FieldSmall label="Type">
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as any)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
              >
                <option value="">Select...</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </FieldSmall>

            <FieldSmall label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
              />
            </FieldSmall>

            <FieldSmall label="Notes (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes..."
                className="h-20 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none resize-none"
              />
            </FieldSmall>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : isEdit ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldSmall({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold text-slate-600">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

