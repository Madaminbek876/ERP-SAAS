import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n, type LanguageCode } from "@/i18n"
import { cn } from "@/lib/utils"

const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; labelKey: string }> = [
  { code: "uz", labelKey: "language.uz" },
  { code: "ru", labelKey: "language.ru" },
  { code: "en", labelKey: "language.en" },
]

type LanguageSelectProps = {
  className?: string
  contentClassName?: string
  itemClassName?: string
  contentAlign?: "start" | "center" | "end"
  contentSideOffset?: number
  variant?: "default" | "glass"
}

function LanguageFlag({ code, className }: { code: LanguageCode; className?: string }) {
  const mergedClassName = ["h-4 w-5 shrink-0 rounded-[3px]", className].filter(Boolean).join(" ")

  if (code === "uz") {
    return (
      <svg viewBox="0 0 20 14" className={mergedClassName} aria-hidden="true">
        <rect width="20" height="4.5" fill="#1EB5E6" />
        <rect y="4.5" width="20" height="5" fill="#FFFFFF" />
        <rect y="9.5" width="20" height="4.5" fill="#1AA45B" />
        <rect y="4.2" width="20" height="0.35" fill="#D61F2C" />
        <rect y="9.45" width="20" height="0.35" fill="#D61F2C" />
        <circle cx="3.1" cy="2.3" r="1.4" fill="#FFFFFF" />
        <circle cx="3.6" cy="2.3" r="1.1" fill="#1EB5E6" />
        <circle cx="5.6" cy="1.4" r="0.25" fill="#FFFFFF" />
        <circle cx="6.8" cy="1.4" r="0.25" fill="#FFFFFF" />
        <circle cx="8" cy="1.4" r="0.25" fill="#FFFFFF" />
        <circle cx="5.6" cy="2.6" r="0.25" fill="#FFFFFF" />
        <circle cx="6.8" cy="2.6" r="0.25" fill="#FFFFFF" />
        <circle cx="8" cy="2.6" r="0.25" fill="#FFFFFF" />
      </svg>
    )
  }

  if (code === "ru") {
    return (
      <svg viewBox="0 0 20 14" className={mergedClassName} aria-hidden="true">
        <rect width="20" height="14" fill="#FFFFFF" />
        <rect y="4.67" width="20" height="4.66" fill="#1F57A4" />
        <rect y="9.33" width="20" height="4.67" fill="#D52B1E" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 14" className={mergedClassName} aria-hidden="true">
      <rect width="20" height="14" fill="#FFFFFF" />
      <rect y="0" width="20" height="2" fill="#B22234" />
      <rect y="2" width="20" height="2" fill="#FFFFFF" />
      <rect y="4" width="20" height="2" fill="#B22234" />
      <rect y="6" width="20" height="2" fill="#FFFFFF" />
      <rect y="8" width="20" height="2" fill="#B22234" />
      <rect y="10" width="20" height="2" fill="#FFFFFF" />
      <rect y="12" width="20" height="2" fill="#B22234" />
      <rect width="8.6" height="7.8" fill="#3C3B6E" />
      <circle cx="1.5" cy="1.5" r="0.35" fill="#FFFFFF" />
      <circle cx="3.1" cy="1.5" r="0.35" fill="#FFFFFF" />
      <circle cx="4.7" cy="1.5" r="0.35" fill="#FFFFFF" />
      <circle cx="6.3" cy="1.5" r="0.35" fill="#FFFFFF" />
      <circle cx="2.3" cy="3.1" r="0.35" fill="#FFFFFF" />
      <circle cx="3.9" cy="3.1" r="0.35" fill="#FFFFFF" />
      <circle cx="5.5" cy="3.1" r="0.35" fill="#FFFFFF" />
      <circle cx="1.5" cy="4.7" r="0.35" fill="#FFFFFF" />
      <circle cx="3.1" cy="4.7" r="0.35" fill="#FFFFFF" />
      <circle cx="4.7" cy="4.7" r="0.35" fill="#FFFFFF" />
      <circle cx="6.3" cy="4.7" r="0.35" fill="#FFFFFF" />
    </svg>
  )
}

function LanguageTriggerContent({ code, variant }: { code: LanguageCode; variant: "default" | "glass" }) {
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center gap-2 rounded-[21px] bg-transparent px-1",
        variant === "glass" ? "text-white" : "text-[#244788]"
      )}
    >
      <LanguageFlag code={code} className="h-[16px] w-[24px] rounded-[4px]" />
      <span className="text-[13px] font-black uppercase tracking-[0.12em]">{code}</span>
    </span>
  )
}

function LanguageOptionContent({ code, label, variant }: { code: LanguageCode; label: string; variant: "default" | "glass" }) {
  return (
    <span className={cn("flex w-full items-center gap-2.5", variant === "glass" ? "text-white" : "text-inherit")}>
      <LanguageFlag code={code} />
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "ml-auto text-[11px] font-semibold uppercase tracking-[0.18em]",
          variant === "glass" ? "text-white/60" : "text-slate-500"
        )}
      >
        {code}
      </span>
    </span>
  )
}

function isLanguageCode(value: string): value is LanguageCode {
  return value === "uz" || value === "ru" || value === "en"
}

export function LanguageSelect({
  className,
  contentClassName,
  itemClassName,
  contentAlign = "end",
  contentSideOffset = 8,
  variant = "default",
}: LanguageSelectProps) {
  const { language, setLanguage, t } = useI18n()
  const selectedLanguage = LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0]

  function handleLanguageChange(value: string) {
    if (!isLanguageCode(value)) return
    setLanguage(value)
  }

  return (
    <Select value={language} onValueChange={handleLanguageChange}>
      <SelectTrigger
        aria-label={t("topbar.selectLanguage")}
        className={cn(
          variant === "glass"
            ? "h-[50px] w-[72px] cursor-pointer justify-center gap-0 overflow-hidden rounded-[22px] border border-white/20 bg-white/10 p-0 text-sm font-medium text-white shadow-[0_18px_36px_-18px_rgba(15,23,42,0.55)] backdrop-blur-xl transition   [&>svg:last-child]:hidden [&_svg:not([class*='text-'])]:text-white/70"
            : "h-[50px] w-[72px] cursor-pointer justify-center gap-0 overflow-hidden rounded-[22px] border border-[#dbe6f8] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] p-0 text-sm font-medium text-slate-700 shadow-[0_14px_28px_rgba(15,23,42,0.08)] transition  hover:shadow-[0_18px_30px_rgba(37,65,168,0.14)]  [&>svg:last-child]:hidden",
          className
        )}
      >
        <SelectValue>
          <LanguageTriggerContent code={selectedLanguage.code} variant={variant} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        side="bottom"
        align={contentAlign}
        sideOffset={contentSideOffset}
        className={cn(
          variant === "glass"
            ? "min-w-[170px] px-10 rounded-2xl border border-white/20 bg-white/10 text-white shadow-[0_24px_48px_rgba(15,23,42,0.28)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/10"
            : "min-w-[170px] rounded-2xl border border-slate-200 bg-white shadow-lg",
          contentClassName
        )}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <SelectItem
            key={option.code}
            value={option.code}
            textValue={t(option.labelKey)}
            className={cn(
              variant === "glass"
                ? "cursor-pointer rounded-[18px] px-3 py-3 text-[15px] font-medium text-white focus:bg-white/12 focus:text-white data-[state=checked]:bg-white/10"
                : "cursor-pointer",
              itemClassName
            )}
          >
            <LanguageOptionContent code={option.code} label={t(option.labelKey)} variant={variant} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
