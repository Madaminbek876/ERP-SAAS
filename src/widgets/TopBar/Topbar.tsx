import { type ReactNode, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Bell, Search, UserRound } from "lucide-react"
import { localizeText, useI18n } from "@/i18n"
import { LanguageSelect } from "@/components/common/LanguageSelect"
import { getUserAvatarFallbackUrl, getUserAvatarUrl, getUserInitials, getUserName, getUserRoleLabel } from "@/shared/useMe"
import { useResolvedImageSrcWithFallback } from "@/shared/useResolvedImageSrc"

function resolveSearchTarget(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return "/dashboard"
  if (normalized.includes("buyurtma") || normalized.includes("order") || normalized.includes("sotuv")) return "/sotuv/orders"
  if (normalized.includes("notification") || normalized.includes("xabar") || normalized.includes("bildirish")) return "/dashboard/notifications"
  if (normalized.includes("ombor") || normalized.includes("sklad") || normalized.includes("warehouse") || normalized.includes("purchase")) return "/dashboard/sklad/warehouse/purchases"
  if (normalized.includes("mahsulot") || normalized.includes("product")) return "/dashboard/catalog/products"
  if (normalized.includes("moliya") || normalized.includes("finance") || normalized.includes("kurs") || normalized.includes("dollar")) return "/dashboard/moliya"
  if (normalized.includes("xodim") || normalized.includes("mijoz") || normalized.includes("client") || normalized.includes("employee")) return "/xodimlar"
  return "/dashboard"
}

function buildNotifications() {
  return [
    { id: "orders", title: localizeText("Buyurtmalar"), text: localizeText("Yangi va faol buyurtmalarni ko'rish"), to: "/sotuv/orders" },
  ]
}

export default function Topbar() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [userName, setUserName] = useState(() => getUserName())
  const [userRoleLabel, setUserRoleLabel] = useState(() => getUserRoleLabel())
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => getUserAvatarUrl())
  const [userAvatarFallbackUrl, setUserAvatarFallbackUrl] = useState(() => getUserAvatarFallbackUrl())
  const [userInitials, setUserInitials] = useState(() => getUserInitials())
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [search, setSearch] = useState("")

  const notifications = useMemo(() => buildNotifications(), [])

  const resolvedUserAvatarUrl = useResolvedImageSrcWithFallback(userAvatarUrl, userAvatarFallbackUrl)
  const displayUserAvatarUrl = resolvedUserAvatarUrl || userAvatarFallbackUrl
  const shouldUseFallbackAvatar = avatarLoadFailed || !displayUserAvatarUrl

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(resolveSearchTarget(search))
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const updateUser = () => {
      setUserName(getUserName())
      setUserRoleLabel(getUserRoleLabel())
      setUserAvatarUrl(getUserAvatarUrl())
      setUserAvatarFallbackUrl(getUserAvatarFallbackUrl())
      setUserInitials(getUserInitials())
      setAvatarLoadFailed(false)
    }

    window.addEventListener("storage", updateUser)
    window.addEventListener("erp-user-change", updateUser as EventListener)
    return () => {
      window.removeEventListener("storage", updateUser)
      window.removeEventListener("erp-user-change", updateUser as EventListener)
    }
  }, [])

  return (
    <header className="motion-topbar-shell rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(244,248,255,0.96)_42%,rgba(233,241,255,0.93)_100%)] px-5 py-4 shadow-[0_26px_72px_-48px_rgba(37,65,168,0.34)]">
      <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap">
        <div className="min-w-[260px] flex-1">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,rgba(56,90,236,0.92)_0%,rgba(43,71,195,0.95)_52%,rgba(34,56,145,0.98)_100%)] p-[2px] shadow-[0_20px_42px_rgba(37,65,168,0.22)]">
            <div className="flex min-h-[72px] items-center gap-3 rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,#395de8_0%,#2f4dd0_52%,#2a3faa_100%)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
              <form onSubmit={handleSearchSubmit} className="relative min-w-0 flex-1">
                <div className="pointer-events-none absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.26)_0%,rgba(110,190,255,0.34)_34%,rgba(52,79,226,0.92)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_24px_rgba(15,23,42,0.24)] ring-1 ring-white/24 backdrop-blur-xl">
                  <div className="absolute inset-[3px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.34),rgba(255,255,255,0.08)_45%,rgba(16,24,64,0.18)_100%)]" />
                  <Search className="relative z-10 h-[18px] w-[18px]" />
                </div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 w-full rounded-[20px] bg-transparent pl-14 pr-4 text-[16px] font-semibold text-white outline-none placeholder:text-white/68"
                  placeholder={t("topbar.searchPlaceholder", localizeText("Qidiruv... (buyurtma, mijoz, mahsulot...)"))}
                />
              </form>

              <div className="hidden xl:flex items-center">
                <LanguageSelect className="h-12 w-[74px] rounded-[18px] border-white/10 bg-white/12 text-white shadow-[0_12px_22px_rgba(15,23,42,0.12)] hover:shadow-[0_14px_24px_rgba(37,65,168,0.18)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <ActionLink to="/dashboard/notifications" icon={<Bell className="h-5 w-5" />} badge={String(notifications.length)} title="Notifications" />

          <div className="xl:hidden">
            <LanguageSelect className="h-12 w-[74px] rounded-[18px] shadow-[0_12px_22px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_24px_rgba(37,65,168,0.12)]" />
          </div>

          <Link
            to="/profile"
            className="lux-motion-surface relative flex h-[72px] min-w-[220px] items-center gap-3 rounded-[26px] bg-[linear-gradient(135deg,#3158ef_0%,#2948c5_52%,#21399a_100%)] px-3 py-2.5 text-white shadow-[0_18px_36px_rgba(37,65,168,0.32)] ring-1 ring-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(37,65,168,0.38)]"
          >
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-white/24 via-white/10 to-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_10px_18px_rgba(15,23,42,0.22)] ring-1 ring-white/25 backdrop-blur-md">
              {!shouldUseFallbackAvatar ? (
                <img
                  src={displayUserAvatarUrl || ""}
                  alt={userName}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <>
                  <div className="absolute inset-[3px] rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.22),rgba(255,255,255,0.04)_48%,rgba(15,23,42,0.18)_100%)]" />
                  <UserRound size={16} strokeWidth={2.1} className="relative z-10 text-white" />
                </>
              )}
              {shouldUseFallbackAvatar ? (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/50 to-transparent px-1 py-0.5 text-center text-[8px] font-semibold uppercase tracking-[0.2em] text-white/92">
                  {userInitials}
                </div>
              ) : null}
            </div>

            <div className="min-w-0 leading-5">
              <div className="truncate text-[16px] font-black tracking-[0.01em] text-white">{userName}</div>
              <div className="truncate text-[12px] font-medium text-white/72">{userRoleLabel || t("topbar.defaultRole")}</div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}

function ActionLink({
  to,
  icon,
  badge,
  title,
}: {
  to: string
  icon: ReactNode
  badge?: string
  title: string
}) {
  return (
    <Link
      to={to}
      title={title}
      className="lux-motion-surface relative inline-flex h-12 w-[74px] cursor-pointer items-center justify-center rounded-[18px] border border-[#dbe6f8] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] text-[#566b90] shadow-[0_12px_22px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-[#b7ccf6] hover:text-[#1d4ed8] hover:shadow-[0_14px_24px_rgba(37,65,168,0.12)]"
    >
      {icon}
      {badge ? (
        <span className="absolute -right-1 -top-1 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-black text-white shadow-[0_8px_14px_rgba(239,68,68,0.28)]">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}
