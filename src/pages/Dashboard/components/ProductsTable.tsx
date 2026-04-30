import { useEffect, useState } from "react"
import { productsApi, type Product } from "@/pages/catalog/api/ProductsApi"
import { formatNumberWithSpaces } from "@/lib/numberFormat"
import { useI18n } from "@/i18n"

export default function ProductsTable({ reloadKey }: { reloadKey: number }) {
  const { language } = useI18n()
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const copy =
    language === "ru"
      ? {
          title: "Товары",
          subtitle: "Последние 20",
          loading: "Загрузка...",
          name: "Название",
          category: "Категория",
          uom: "UoM",
          price: "Цена",
          empty: "Пока пусто.",
        }
      : language === "en"
        ? {
            title: "Products",
            subtitle: "Latest 20",
            loading: "Loading...",
            name: "Name",
            category: "Category",
            uom: "UoM",
            price: "Min / sale",
            empty: "No data yet.",
          }
        : {
            title: "Mahsulotlar",
            subtitle: "So'nggi 20 ta",
            loading: "Yuklanmoqda...",
            name: "Nomi",
            category: "Kategoriya",
            uom: "UoM",
            price: "Min / sotuv",
            empty: "Hozircha yo'q.",
          }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const { rows } = await productsApi.listAll({ ordering: "-created_at" })
        if (!cancelled) setRows(rows.slice(0, 20))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-extrabold text-slate-900">{copy.title}</div>
      <div className="text-xs text-slate-500">{copy.subtitle}</div>

      {loading ? (
        <div className="mt-3 text-xs text-slate-500">{copy.loading}</div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[900px] w-full text-left text-xs">
            <thead className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
              <tr>
                <th className="px-4 py-3 font-bold">{copy.name}</th>
                <th className="px-4 py-3 font-bold">{copy.category}</th>
                <th className="px-4 py-3 font-bold">{copy.uom}</th>
                <th className="px-4 py-3 font-bold">{copy.price}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {copy.empty}
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3">{p.category_name ?? p.category ?? "-"}</td>
                    <td className="px-4 py-3">{p.uom_name ?? p.uom}</td>
                    <td className="px-4 py-3">
                      {formatProductPrice(p.min_price)} / {formatProductPrice(p.selling_price ?? p.default_selling_price)} {p.currency}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatProductPrice(value: number | null | undefined): string {
  if (value == null) return "-"
  return formatNumberWithSpaces(value)
}
