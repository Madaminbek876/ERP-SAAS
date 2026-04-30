import { useI18n } from "@/i18n"
import { Button } from "@/components/ui/button"

type Props = {
  onCreate: () => void
  onExportCsv: () => void
  onDelete?: () => void
  createDisabled?: boolean
  deleteDisabled?: boolean
}

export default function ProductionTopbar({
  onCreate,
  onExportCsv,
  onDelete,
  createDisabled = false,
  deleteDisabled = true,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-lg font-semibold text-slate-900">{t("production.topbar.title")}</div>
        <div className="text-sm text-slate-500">{t("production.topbar.subtitle")}</div>
      </div>

      <div className="flex items-center gap-2">
        {onDelete ? (
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={deleteDisabled}
            className="h-11 rounded-2xl border-rose-200 bg-rose-50 px-5 text-base font-semibold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("production.table.delete")}
          </Button>
        ) : null}
        <Button
          onClick={onCreate}
          disabled={createDisabled}
          className="h-11 rounded-2xl px-5 text-base font-semibold shadow-[0_12px_24px_rgba(29,78,216,0.18)]"
        >
          + {t("production.topbar.newBatch")}
        </Button>
        <Button
          onClick={onExportCsv}
          className="h-11 rounded-2xl px-5 text-base font-semibold shadow-[0_12px_24px_rgba(29,78,216,0.18)]"
        >
          {t("production.topbar.exportCsv")}
        </Button>
      </div>
    </div>
  )
}
