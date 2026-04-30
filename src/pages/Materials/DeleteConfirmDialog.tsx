import DeleteAlertDialog from "@/components/common/DeleteAlertDialog"
import { useI18n } from "@/i18n"

export function DeleteConfirmDialog(props: {
  open: boolean
  title?: string
  description?: string
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? { title: "Удаление", description: "Это действие нельзя отменить." }
      : language === "en"
        ? { title: "Delete", description: "This action cannot be undone." }
        : { title: "O'chirish", description: "Bu amalni ortga qaytarib bo'lmaydi." }

  return (
    <DeleteAlertDialog
      open={props.open}
      onOpenChange={(v) => {
        if (!v) props.onClose()
      }}
      title={props.title ?? copy.title}
      description={props.description ?? copy.description}
      loading={props.loading}
      onConfirm={props.onConfirm}
    />
  )
}
