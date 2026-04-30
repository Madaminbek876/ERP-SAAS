import { useEffect, useState } from "react"
import { financeClient } from "../shared/financeClient"
import type { Currency, Employee } from "../shared/types"
import { Eye, X } from "lucide-react"
import TablePagination from "@/components/common/TablePagination"
import TableActionIconButton from "@/components/common/TableActionIconButton"
import { useClientPagination } from "@/components/common/useClientPagination"
import { useI18n } from "@/i18n"

const copyByLang = {
  uz: {
    title: "Xodimlar ro'yxati",
    subtitle: "Bazaviy oylik ma'lumotlari",
    add: "Xodim qo'shish",
    loading: "Yuklanmoqda...",
    loadError: "Xodimlarni yuklashda xatolik",
    name: "F.I.Sh",
    role: "Lavozim",
    phone: "Telefon",
    salary: "Bazaviy oylik",
    actions: "Amallar",
    empty: "Hozircha xodim yo'q.",
    view: "Ko'rish",
    addTitle: "Xodim qo'shish",
    addSubtitle: "Oylik ma'lumotlari",
    close: "Yopish",
    fullName: "F.I.Sh",
    fullNamePlaceholder: "Masalan: Akmal Karimov",
    roleLabel: "Lavozim",
    rolePlaceholder: "Masalan: Hisobchi",
    phoneOptional: "Telefon (ixtiyoriy)",
    salaryLabel: "Bazaviy oylik",
    currency: "Valyuta",
    cancel: "Bekor qilish",
    save: "Saqlash",
    saving: "Saqlanmoqda...",
    requiredName: "F.I.Sh majburiy.",
    requiredRole: "Lavozim majburiy.",
    invalidSalary: "Oylik noto'g'ri.",
    saveError: "Saqlashda xatolik",
  },
  ru: {
    title: "Список сотрудников",
    subtitle: "Данные по базовой зарплате",
    add: "Добавить сотрудника",
    loading: "Загрузка...",
    loadError: "Ошибка загрузки сотрудников",
    name: "Ф.И.О",
    role: "Должность",
    phone: "Телефон",
    salary: "Базовая зарплата",
    actions: "Действия",
    empty: "Сотрудников пока нет.",
    view: "Просмотр",
    addTitle: "Добавить сотрудника",
    addSubtitle: "Данные по зарплате",
    close: "Закрыть",
    fullName: "Ф.И.О",
    fullNamePlaceholder: "Например: Акмал Каримов",
    roleLabel: "Должность",
    rolePlaceholder: "Например: Бухгалтер",
    phoneOptional: "Телефон (необязательно)",
    salaryLabel: "Базовая зарплата",
    currency: "Валюта",
    cancel: "Отмена",
    save: "Сохранить",
    saving: "Сохранение...",
    requiredName: "Ф.И.О обязательно.",
    requiredRole: "Должность обязательна.",
    invalidSalary: "Некорректная зарплата.",
    saveError: "Ошибка сохранения",
  },
  en: {
    title: "Employees List",
    subtitle: "Base salary data",
    add: "Add employee",
    loading: "Loading...",
    loadError: "Failed to load employees",
    name: "Full name",
    role: "Role",
    phone: "Phone",
    salary: "Base salary",
    actions: "Actions",
    empty: "No employees yet.",
    view: "View",
    addTitle: "Add employee",
    addSubtitle: "Salary information",
    close: "Close",
    fullName: "Full name",
    fullNamePlaceholder: "Example: Akmal Karimov",
    roleLabel: "Role",
    rolePlaceholder: "Example: Accountant",
    phoneOptional: "Phone (optional)",
    salaryLabel: "Base salary",
    currency: "Currency",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    requiredName: "Full name is required.",
    requiredRole: "Role is required.",
    invalidSalary: "Invalid salary.",
    saveError: "Save failed",
  },
} as const

export default function MoliyaEmployeesPage() {
  const { language } = useI18n()
  const copy = copyByLang[language]
  const [rows, setRows] = useState<Employee[]>([])
  const [ui, setUi] = useState<"loading" | "ready" | "error">("loading")
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const { page, setPage, totalPages, pagedItems: pagedRows } = useClientPagination(rows, 10, [rows.length])

  async function load() {
    try {
      setUi("loading")
      setErr(null)
      const res = await financeClient.listEmployees()
      setRows(res)
      setUi("ready")
    } catch (e: any) {
      setUi("error")
      setErr(e?.message || copy.loadError)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-slate-900">{copy.title}</div>
          <div className="text-xs font-semibold text-slate-500">{copy.subtitle}</div>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-extrabold text-white hover:bg-slate-800">
          + {copy.add}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        {ui === "loading" && <div className="p-4 text-sm text-slate-600">{copy.loading}</div>}
        {ui === "error" && <div className="p-4 text-sm text-rose-700">{err}</div>}

        {ui === "ready" && (
          <table className="min-w-[900px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-extrabold">{copy.name}</th>
                <th className="px-4 py-3 font-extrabold">{copy.role}</th>
                <th className="px-4 py-3 font-extrabold">{copy.phone}</th>
                <th className="px-4 py-3 font-extrabold">{copy.salary}</th>
                <th className="px-4 py-3 text-right font-extrabold">{copy.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">{copy.empty}</td>
                </tr>
              ) : pagedRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-extrabold text-slate-900">{r.fullName}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{r.role}</td>
                  <td className="px-4 py-3 text-slate-600">{r.phone ?? "-"}</td>
                  <td className="px-4 py-3 font-extrabold">{r.baseSalary.toLocaleString("uz-UZ")} {r.currency}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end">
                      <TableActionIconButton title={copy.view}><Eye size={16} /></TableActionIconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {ui === "ready" && rows.length > 0 ? (
        <div className="mt-4 flex justify-end">
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      {open ? <AddEmployeeModal onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await load() }} /> : null}
    </div>
  )
}

function AddEmployeeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { language } = useI18n()
  const copy = copyByLang[language]
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("")
  const [phone, setPhone] = useState("")
  const [baseSalary, setBaseSalary] = useState("")
  const [currency, setCurrency] = useState<Currency>("UZS")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setErr(null)
    const salary = Number(baseSalary)
    if (!fullName.trim()) return setErr(copy.requiredName)
    if (!role.trim()) return setErr(copy.requiredRole)
    if (!Number.isFinite(salary) || salary <= 0) return setErr(copy.invalidSalary)
    setSaving(true)
    try {
      await financeClient.createEmployee({ fullName: fullName.trim(), role: role.trim(), phone: phone.trim() || undefined, baseSalary: salary, currency })
      await onSaved()
    } catch (e: any) {
      setErr(e?.message || copy.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-extrabold text-slate-900">{copy.addTitle}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{copy.addSubtitle}</div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" aria-label={copy.close} title={copy.close}>
            <X className="mx-auto h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3">
          {err ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-700">{err}</div> : null}
          <div className="grid grid-cols-1 gap-3">
            <FieldSmall label={copy.fullName}><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none" placeholder={copy.fullNamePlaceholder} /></FieldSmall>
            <FieldSmall label={copy.roleLabel}><input value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none" placeholder={copy.rolePlaceholder} /></FieldSmall>
            <FieldSmall label={copy.phoneOptional}><input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none" placeholder="+998 90 123 45 67" /></FieldSmall>
            <div className="grid grid-cols-2 gap-3">
              <FieldSmall label={copy.salaryLabel}><input value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none" placeholder="3500000" inputMode="numeric" /></FieldSmall>
              <FieldSmall label={copy.currency}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none">
                  <option value="UZS">UZS</option><option value="USD">USD</option><option value="RUB">RUB</option>
                </select>
              </FieldSmall>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button onClick={onClose} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50">{copy.cancel}</button>
          <button disabled={saving} onClick={() => void save()} className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:opacity-60">{saving ? copy.saving : copy.save}</button>
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
