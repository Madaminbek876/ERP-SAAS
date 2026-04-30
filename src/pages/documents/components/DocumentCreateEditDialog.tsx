import React, { useMemo, useState } from "react"
import { useI18n } from "@/i18n"
import { docStatusLabel, docTypeLabel, refTypeLabel } from "../utils/documents.utils"
import type { DocumentItem, DocumentStatus, DocumentType, RefType } from "../types/documents.types"

type Props = {
  open: boolean
  mode: "create" | "edit"
  initial?: DocumentItem | null
  onClose: () => void
  onSubmit: (data: Omit<DocumentItem, "id" | "createdAt" | "updatedAt">) => Promise<void>
}

export default function DocumentCreateEditDialog({ open, mode, initial, onClose, onSubmit }: Props) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          create: "Новый документ",
          edit: "Редактирование документа",
          subtitle: "Введите данные документа",
          close: "Закрыть",
          number: "Номер документа",
          date: "Дата",
          type: "Тип",
          status: "Статус",
          counterparty: "Контрагент",
          counterpartyPlaceholder: "Например: Jasur Trade",
          title: "Заголовок",
          titlePlaceholder: "Например: Договор",
          refType: "Тип ссылки",
          refId: "Reference ID",
          refIdPlaceholder: "Например: ORD-789",
          amount: "Сумма",
          amountPlaceholder: "1500000",
          currency: "Валюта",
          note: "Примечание",
          cancel: "Отмена",
          save: "Сохранить",
          saving: "Сохранение...",
        }
      : language === "en"
        ? {
            create: "New document",
            edit: "Edit document",
            subtitle: "Enter document information",
            close: "Close",
            number: "Document number",
            date: "Date",
            type: "Type",
            status: "Status",
            counterparty: "Counterparty",
            counterpartyPlaceholder: "Example: Jasur Trade",
            title: "Title",
            titlePlaceholder: "Example: Contract",
            refType: "Reference type",
            refId: "Reference ID",
            refIdPlaceholder: "Example: ORD-789",
            amount: "Amount",
            amountPlaceholder: "1500000",
            currency: "Currency",
            note: "Note",
            cancel: "Cancel",
            save: "Save",
            saving: "Saving...",
          }
        : {
            create: "Yangi hujjat",
            edit: "Hujjatni tahrirlash",
            subtitle: "Hujjat ma'lumotlarini kiriting",
            close: "Yopish",
            number: "Hujjat raqami",
            date: "Sana",
            type: "Turi",
            status: "Status",
            counterparty: "Kontragent",
            counterpartyPlaceholder: "Masalan: Jasur Trade",
            title: "Sarlavha (nom)",
            titlePlaceholder: "Masalan: Shartnoma",
            refType: "Reference turi",
            refId: "Reference ID",
            refIdPlaceholder: "Masalan: ORD-789",
            amount: "Summa (ixtiyoriy)",
            amountPlaceholder: "1500000",
            currency: "Valyuta",
            note: "Izoh",
            cancel: "Bekor qilish",
            save: "Saqlash",
            saving: "Saqlanmoqda...",
          }

  const init = useMemo(() => {
    const base = initial ?? null
    return {
      number: base?.number ?? `DOC-${String(Math.floor(Math.random() * 900000) + 100000)}`,
      title: base?.title ?? "",
      type: base?.type ?? ("INVOICE" as DocumentType),
      status: base?.status ?? ("DRAFT" as DocumentStatus),
      date: base?.date ?? new Date().toISOString().slice(0, 10),
      kontragentName: base?.kontragentName ?? "",
      refType: base?.refType ?? ("MANUAL" as RefType),
      refId: base?.refId ?? "",
      amount: base?.amount ?? undefined,
      currency: base?.currency ?? "UZS",
      createdBy: base?.createdBy ?? "Admin",
      note: base?.note ?? "",
      attachments: base?.attachments ?? [],
    }
  }, [initial])

  const [form, setForm] = useState(init)
  const [loading, setLoading] = useState(false)

  React.useEffect(() => setForm(init), [init])

  if (!open) return null

  const docTypes: DocumentType[] = ["INVOICE", "CONTRACT", "ACT", "PAYMENT_ORDER", "DELIVERY_NOTE", "INVENTORY_ACT", "PRODUCTION_REPORT", "OTHER"]
  const statuses: DocumentStatus[] = ["DRAFT", "SIGNED", "PAID", "CANCELED", "ARCHIVED"]
  const refTypes: RefType[] = ["ORDER", "PURCHASE", "PRODUCTION", "WAREHOUSE", "FINANCE", "MANUAL"]

  const set = (patch: Partial<typeof form>) => setForm((p) => ({ ...p, ...patch }))

  const submit = async () => {
    setLoading(true)
    try {
      await onSubmit(form as any)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_26px_70px_rgba(2,6,23,0.25)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-900">{mode === "create" ? copy.create : copy.edit}</div>
            <div className="text-xs text-slate-500">{copy.subtitle}</div>
          </div>
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            {copy.close}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
          <div>
            <label className="text-xs text-slate-600">{copy.number}</label>
            <input value={form.number} onChange={(e) => set({ number: e.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.date}</label>
            <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.type}</label>
            <select value={form.type} onChange={(e) => set({ type: e.target.value as DocumentType })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
              {docTypes.map((t) => (
                <option key={t} value={t}>
                  {docTypeLabel[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.status}</label>
            <select value={form.status} onChange={(e) => set({ status: e.target.value as DocumentStatus })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {docStatusLabel[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.counterparty}</label>
            <input
              value={form.kontragentName}
              onChange={(e) => set({ kontragentName: e.target.value })}
              placeholder={copy.counterpartyPlaceholder}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.title}</label>
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={copy.titlePlaceholder} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.refType}</label>
            <select value={form.refType} onChange={(e) => set({ refType: e.target.value as RefType })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
              {refTypes.map((r) => (
                <option key={r} value={r}>
                  {refTypeLabel[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.refId}</label>
            <input value={form.refId} onChange={(e) => set({ refId: e.target.value })} placeholder={copy.refIdPlaceholder} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.amount}</label>
            <input
              value={form.amount ?? ""}
              onChange={(e) => set({ amount: e.target.value ? Number(e.target.value) : undefined })}
              placeholder={copy.amountPlaceholder}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-600">{copy.currency}</label>
            <select value={form.currency} onChange={(e) => set({ currency: e.target.value as any })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="UZS">UZS</option>
              <option value="USD">USD</option>
              <option value="RUB">RUB</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-slate-600">{copy.note}</label>
            <textarea value={form.note ?? ""} onChange={(e) => set({ note: e.target.value })} rows={3} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
            {copy.cancel}
          </button>
          <button disabled={loading} onClick={submit} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60">
            {loading ? copy.saving : copy.save}
          </button>
        </div>
      </div>
    </div>
  )
}
