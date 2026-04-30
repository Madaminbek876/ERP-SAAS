import { getUserName } from "@/shared/useMe"
import { useI18n } from "@/i18n"

export default function DashboardShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
}) {
  const userName = getUserName()
  const { language } = useI18n()
  const fallbackTitle = language === "en" || language === "ru" ? `Welcome, ${userName}!` : `Xush kelibsiz, ${userName}!`
  const hasHero = Boolean(title || subtitle)

  return (
    <div className="motion-page-shell min-h-screen rounded-[36px] bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f6f9ff_28%,#edf3ff_60%,#e8eefb_100%)]">
      <div className="wide-desktop-shell mx-auto px-4 py-6">
        {hasHero ? (
          <section className="motion-hero-shell relative overflow-hidden rounded-[34px] border border-white/15 bg-[linear-gradient(135deg,#2f5bea_0%,#2948c9_52%,#2a3fa7_100%)] px-6 py-6 text-white shadow-[0_36px_120px_-52px_rgba(37,65,168,0.56)]">
            <div className="lux-ambient-orb absolute -left-16 top-0 h-44 w-44 rounded-full bg-white/12 blur-3xl" />
            <div className="lux-ambient-orb absolute right-0 top-10 h-48 w-48 rounded-full bg-sky-200/18 blur-3xl" />
            <div className="lux-ambient-orb absolute bottom-0 right-28 h-32 w-32 rounded-full bg-indigo-200/14 blur-3xl" />

            <div className="relative">
              <div className="text-[32px] font-black tracking-tight text-white">{title ?? fallbackTitle}</div>
              {subtitle ? <div className="mt-2 text-[15px] leading-6 text-white/80">{subtitle}</div> : null}
            </div>
          </section>
        ) : null}

        <div className={`${hasHero ? "mt-5 " : ""}motion-stagger`}>{children}</div>
      </div>
    </div>
  )
}
