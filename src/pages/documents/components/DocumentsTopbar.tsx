import { useI18n } from "@/i18n"

type Props = {
  onCreate: () => void
  onExportCsv: () => void
}

export default function DocumentsTopbar({ onCreate, onExportCsv }: Props) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          title: "Документы",
          subtitle: "Список",
          add: "Новый документ",
          exportCsv: "Экспорт CSV",
        }
      : language === "en"
        ? {
            title: "Documents",
            subtitle: "List",
            add: "New document",
            exportCsv: "Export CSV",
          }
        : {
            title: "Hujjatlar",
            subtitle: "Ro'yxat",
            add: "Yangi hujjat qo'shish",
            exportCsv: "CSV eksport",
          }

  const primaryBtnClass =
    "rounded-2xl px-4 py-2 text-sm font-semibold border !border-blue-800 !bg-gradient-to-r !from-blue-900 !to-blue-700 !text-white transition hover:brightness-110"

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="text-sm text-slate-500">{copy.subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onCreate} className={primaryBtnClass}>
          + {copy.add}
        </button>
        <button onClick={onExportCsv} className={primaryBtnClass}>
          {copy.exportCsv}
        </button>
      </div>
    </div>
  )
}
