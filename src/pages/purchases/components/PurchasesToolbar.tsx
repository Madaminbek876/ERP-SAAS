import { Button } from "@/components/ui/button"
import { Download, Plus, Trash2 } from "lucide-react"
import { useI18n } from "@/i18n"

export default function PurchasesToolbar({
  onCreate,
  onDeleteSelected,
  onExportExcel,
  deleteDisabled = true,
  deleteLoading = false,
  selectedCount = 0,
  deleteLabel,
}: {
  onCreate: () => void
  onDeleteSelected?: () => void
  onExportExcel?: () => void
  deleteDisabled?: boolean
  deleteLoading?: boolean
  selectedCount?: number
  deleteLabel?: string
}) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? { create: "Новая закупка", export: "Экспорт Excel", delete: "Удалить выбранные", deleting: "Удаление..." }
      : language === "en"
        ? { create: "New purchase", export: "Export Excel", delete: "Delete selected", deleting: "Deleting..." }
        : { create: "Yangi xarid", export: "Excel eksport", delete: "Tanlanganlarni o'chirish", deleting: "O'chirilmoqda..." }

  const deleteButtonLabel = selectedCount > 0 ? `${deleteLabel ?? copy.delete} (${selectedCount})` : deleteLabel ?? copy.delete

  return (
    <div className="flex items-center gap-2">
      {onDeleteSelected ? (
        <Button
          type="button"
          variant="destructive"
          className="cursor-pointer rounded-2xl"
          onClick={onDeleteSelected}
          disabled={deleteDisabled || deleteLoading}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLoading ? copy.deleting : deleteButtonLabel}
        </Button>
      ) : null}

      <Button
        className="!bg-gradient-to-r from-blue-900 to-blue-700 text-white cursor-pointer rounded-2xl"
        onClick={onCreate}
      >
        <Plus className="mr-2 h-4 w-4" />
        {copy.create}
      </Button>

      {onExportExcel ? (
        <Button
          variant="secondary"
          className="cursor-pointer rounded-2xl !border-slate-300 bg-white shadow-lg text-black hover:bg-slate-100"
          onClick={onExportExcel}
        >
          <Download className="mr-2 h-4 w-4" />
          {copy.export}
        </Button>
      ) : null}
    </div>
  )
}
