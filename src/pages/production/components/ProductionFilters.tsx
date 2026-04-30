import { useI18n } from "@/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ChoiceOption, LookupOption, ProductionFilters } from "../types/production.types"

type Props = {
  value: ProductionFilters
  statusChoices: ChoiceOption[]
  products: LookupOption[]
  locations: LookupOption[]
  onChange: (v: ProductionFilters) => void
  onApply: () => void
  onReset: () => void
}

export default function ProductionFiltersPanel({
  value,
  statusChoices,
  products,
  locations,
  onChange,
  onApply,
  onReset,
}: Props) {
  const { t } = useI18n()
  const fieldClassName =
    "w-full h-11 rounded-2xl border-slate-200 bg-white px-4 text-[15px] shadow-sm focus-visible:border-blue-300 focus-visible:ring-blue-100"
  const labelClassName = "mb-1.5 text-sm font-medium text-slate-600"

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(2,6,23,0.08)]">
      <div className="text-sm font-semibold text-slate-900">{t("production.filters.title")}</div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.05fr_1.05fr_0.8fr_1fr_1fr_1.15fr_auto] xl:items-end">
        <div className="min-w-0">
          <div className={labelClassName}>{t("production.filters.startDate")}</div>
          <Input
            type="date"
            value={value.dateFrom ?? ""}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })}
            className={fieldClassName}
          />
        </div>

        <div className="min-w-0">
          <div className={labelClassName}>{t("production.filters.endDate")}</div>
          <Input
            type="date"
            value={value.dateTo ?? ""}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value || undefined })}
            className={fieldClassName}
          />
        </div>

        <div className="min-w-0">
          <div className={labelClassName}>{t("production.filters.status")}</div>
          <Select value={value.status} onValueChange={(nextValue) => onChange({ ...value, status: nextValue as ProductionFilters["status"] })}>
            <SelectTrigger className={fieldClassName}>
              <SelectValue placeholder={t("production.filters.all")} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" className="rounded-2xl border-slate-200 bg-white shadow-lg">
              <SelectItem value="ALL">{t("production.filters.all")}</SelectItem>
              {statusChoices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <div className={labelClassName}>{t("production.filters.product")}</div>
          <Select
            value={String(value.product)}
            onValueChange={(nextValue) => onChange({ ...value, product: nextValue === "ALL" ? "ALL" : Number(nextValue) })}
          >
            <SelectTrigger className={fieldClassName}>
              <SelectValue placeholder={t("production.filters.all")} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" className="rounded-2xl border-slate-200 bg-white shadow-lg">
              <SelectItem value="ALL">{t("production.filters.all")}</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={String(product.id)}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <div className={labelClassName}>{t("production.filters.location")}</div>
          <Select
            value={String(value.location)}
            onValueChange={(nextValue) => onChange({ ...value, location: nextValue === "ALL" ? "ALL" : Number(nextValue) })}
          >
            <SelectTrigger className={fieldClassName}>
              <SelectValue placeholder={t("production.filters.all")} />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" align="start" className="rounded-2xl border-slate-200 bg-white shadow-lg">
              <SelectItem value="ALL">{t("production.filters.all")}</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={String(location.id)}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <div className={labelClassName}>{t("production.filters.search")}</div>
          <Input
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onApply()
            }}
            placeholder={t("production.filters.searchPlaceholder")}
            className={fieldClassName}
          />
        </div>

        <div className="flex items-end justify-end gap-2 xl:justify-start">
          <Button onClick={onReset} className="h-11 min-w-[132px] rounded-2xl px-5 text-base font-semibold shadow-[0_12px_24px_rgba(29,78,216,0.18)]">
            {t("production.filters.clear")}
          </Button>
          <Button onClick={onApply} className="h-11 min-w-[132px] rounded-2xl px-5 text-base font-semibold shadow-[0_12px_24px_rgba(29,78,216,0.18)]">
            {t("production.filters.apply")}
          </Button>
        </div>
      </div>
    </div>
  )
}
