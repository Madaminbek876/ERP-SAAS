import { getCurrentLanguage, getCurrentLocale } from "@/i18n"

export function formatUZS(amount: number) {
  const formatted = new Intl.NumberFormat(getCurrentLocale()).format(amount)
  const suffix = getCurrentLanguage() === "ru" ? "сум" : getCurrentLanguage() === "en" ? "UZS" : "so'm"
  return `${formatted} ${suffix}`
}
