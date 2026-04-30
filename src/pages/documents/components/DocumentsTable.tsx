import { useI18n } from "@/i18n"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { DocumentItem } from "../types/documents.types"
import { docTypeLabel } from "../utils/documents.utils"

type Props = {
  rows: DocumentItem[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export default function DocumentsTable({ rows, onView, onEdit, onDelete }: Props) {
  void onEdit
  void onDelete
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          select: "Выбрать",
          date: "Дата",
          name: "Название",
          id: "ID",
          type: "Тип",
          location: "Локация",
          amount: "Количество",
          note: "Примечание",
          rowSelect: "Выбрать строку {{number}}",
          empty: "Документы не найдены",
        }
      : language === "en"
        ? {
            select: "Select",
            date: "Date",
            name: "Name",
            id: "ID",
            type: "Type",
            location: "Location",
            amount: "Amount",
            note: "Note",
            rowSelect: "Select row {{number}}",
            empty: "No documents found",
          }
        : {
            select: "Tanlash",
            date: "Sana",
            name: "Nomi",
            id: "ID",
            type: "Turi",
            location: "Joylashuv",
            amount: "Miqdor",
            note: "Izoh",
            rowSelect: "Qatorni tanlash {{number}}",
            empty: "Hujjatlar topilmadi",
          }

  const formatDateTime = (row: DocumentItem) => {
    const raw = row.createdAt || row.date
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return row.date || "-"
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const h = String(d.getHours()).padStart(2, "0")
    const min = String(d.getMinutes()).padStart(2, "0")
    return `${y}-${m}-${day} ${h}:${min}`
  }

  const formatAmount = (amount?: number) => (amount == null ? "-" : amount.toLocaleString("en-US"))
  const locationLabel = (row: DocumentItem) => row.kontragentName || row.refId || "-"

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#1d4ed8] text-white">
            <TableHead className="w-12 px-5 py-3 font-semibold text-white">{copy.select}</TableHead>
            <TableHead className="px-5 py-3 font-semibold text-white">{copy.date}</TableHead>
            <TableHead className="px-5 py-3 font-semibold text-white">{copy.name}</TableHead>
            <TableHead className="px-5 py-3 font-semibold text-white">{copy.id}</TableHead>
            <TableHead className="px-5 py-3 font-semibold text-white">{copy.type}</TableHead>
            <TableHead className="px-5 py-3 font-semibold text-white">{copy.location}</TableHead>
            <TableHead className="px-5 py-3 text-right font-semibold text-white">{copy.amount}</TableHead>
            <TableHead className="px-5 py-3 font-semibold text-white">{copy.note}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onView(r.id)}>
              <TableCell className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                <Checkbox aria-label={copy.rowSelect.replace("{{number}}", r.number)} />
              </TableCell>
              <TableCell className="px-5 py-3 text-sm font-medium text-slate-700">{formatDateTime(r)}</TableCell>
              <TableCell className="px-5 py-3">{r.title || r.number}</TableCell>
              <TableCell className="px-5 py-3">{r.id}</TableCell>
              <TableCell className="px-5 py-3">{docTypeLabel[r.type]}</TableCell>
              <TableCell className="px-5 py-3">{locationLabel(r)}</TableCell>
              <TableCell className="px-5 py-3 text-right">{formatAmount(r.amount)}</TableCell>
              <TableCell className="px-5 py-3">{r.note || "-"}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                {copy.empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
