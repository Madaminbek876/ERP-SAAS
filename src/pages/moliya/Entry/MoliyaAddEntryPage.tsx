import { useI18n } from "@/i18n"

const copyByLang = {
  uz: {
    title: "Moliyaviy yozuvlar",
    status: "Bo'lim faqat o'qish rejimida",
    description:
      "Backend contract bo'yicha Finance / Entries bo'limida faqat ro'yxat va detal olish documented qilingan. Shu sabab bu sahifada yangi yozuv yaratish o'chirildi.",
    hint: "Yozuvlarni ko'rish va eksport qilish uchun ledger sahifasidan foydalaning.",
  },
  ru: {
    title: "Финансовые записи",
    status: "Раздел доступен только для чтения",
    description:
      "По backend contract в разделе Finance / Entries документированы только список и детальная запись. Поэтому создание новой записи на этой странице отключено.",
    hint: "Для просмотра и экспорта используйте страницу ledger.",
  },
  en: {
    title: "Finance entries",
    status: "This section is read-only",
    description:
      "The backend contract for Finance / Entries documents only list and detail endpoints. Creating a new entry is disabled on this page.",
    hint: "Use the ledger page to review and export entries.",
  },
} as const

export default function MoliyaAddEntryPage() {
  const { language } = useI18n()
  const copy = copyByLang[language]

  return (
    <div className="ml-62 max-w-[720px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-extrabold text-slate-900">{copy.title}</div>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="text-sm font-extrabold text-amber-900">{copy.status}</div>
        <div className="mt-2 text-sm leading-6 text-amber-800">{copy.description}</div>
        <div className="mt-2 text-sm font-medium text-amber-900">{copy.hint}</div>
      </div>
    </div>
  )
}
