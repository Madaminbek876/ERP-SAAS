import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { LanguageSelect } from "@/components/common/LanguageSelect"
import { useI18n } from "@/i18n"
import { Input } from "@/components/ui/input"
import ordersReal from "@/assets/images/auth-orders-realistic.jpg"
import warehouseReal from "@/assets/images/auth-warehouse-realistic.jpg"
import financeReal from "@/assets/images/auth-finance-realistic.jpg"
import teamReal from "@/assets/images/auth-team-realistic.jpg"
import analyticsReal from "@/assets/images/auth-analytics-realistic.jpg"
import { clearAuth, markSessionAuth, resolveAuthRedirect, setStoredUser, setTokens } from "@/lib/auth"
import { accountsApi } from "@/pages/auth/api/accountsApi"
import type { LoginPayload } from "@/types/auth"

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username kiriting"),
  password: z.string().min(1, "Password kiriting"),
})

type LoginValues = z.infer<typeof loginSchema>

function getErrorMessage(error: unknown, fallback: string) {
  const data = (error as any)?.response?.data
  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail

  if (data && typeof data === "object") {
    const firstValue = Object.values(data)[0]
    if (typeof firstValue === "string" && firstValue.trim()) return firstValue
    if (Array.isArray(firstValue) && typeof firstValue[0] === "string" && firstValue[0].trim()) return firstValue[0]
  }

  return fallback
}

export default function LoginPage() {
  const { language } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroVisible, setHeroVisible] = useState(true)

  const copy =
    language === "ru"
      ? {
        title: "\u0412\u0445\u043e\u0434 \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0443",
        subtitle:
          "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0438 \u043f\u0430\u0440\u043e\u043b\u044c, \u0447\u0442\u043e\u0431\u044b \u0432\u043e\u0439\u0442\u0438 \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0443",
        username: "\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f",
        usernamePlaceholder:
          "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f",
        password: "\u041f\u0430\u0440\u043e\u043b\u044c",
        passwordPlaceholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c",
        submit: "\u0412\u043e\u0439\u0442\u0438",
        loading: "\u041f\u043e\u0434\u043e\u0436\u0434\u0438\u0442\u0435...",
        success: "\u0412\u0445\u043e\u0434 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d \u0443\u0441\u043f\u0435\u0448\u043d\u043e",
        heroBadge: "ERP SOLUTION",
        heroTitle: "\u0412\u0441\u0435 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u044b \u0432 \u043e\u0434\u043d\u043e\u043c ERP \u043e\u043a\u043d\u0435",
        heroDescription:
          "\u0417\u0430\u043a\u0430\u0437\u044b, \u0441\u043a\u043b\u0430\u0434, \u0444\u0438\u043d\u0430\u043d\u0441\u044b \u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u0430 \u0441\u043e\u0431\u0440\u0430\u043d\u044b \u0432 \u043e\u0434\u043d\u043e\u043c \u0440\u0430\u0431\u043e\u0447\u0435\u043c \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0435.",
        heroAlt: "\u0424\u043e\u043d \u0441 ERP \u0441\u0438\u0441\u0442\u0435\u043c\u043e\u0439",
        usernameRequired:
          "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f",
        passwordRequired: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c",
        invalidCredentials:
          "\u0418\u043c\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0438\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c \u043d\u0435\u0432\u0435\u0440\u043d\u044b",
        invalidPayload: "\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0437\u0430\u043f\u0440\u043e\u0441\u0430",
        tooManyAttempts:
          "\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.",
        server: "\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430",
      }
      : language === "en"
        ? {
          title: "Sign In",
          subtitle: "Enter your credentials to access the system",
          username: "Username",
          usernamePlaceholder: "Enter username",
          password: "Password",
          passwordPlaceholder: "Enter password",
          submit: "Login",
          loading: "Please wait...",
          success: "Login successful",
          heroBadge: "ERP SOLUTION",
          heroTitle: "Every workflow in one ERP workspace",
          heroDescription: "Orders, warehouse, finance, and team activity stay connected in one dashboard.",
          heroAlt: "Real ERP dashboard background",
          usernameRequired: "Enter username",
          passwordRequired: "Enter password",
          invalidCredentials: "Username or password is incorrect",
          invalidPayload: "Invalid request data",
          tooManyAttempts: "Too many attempts. Please try again later.",
          server: "Server error",
        }
        : {
          title: "Tizimga Kirish",
          subtitle: "Tizimga kirish uchun foydalanuvchi nomi va parol ma'lumotlaringizni kiriting",
          username: "Foydalanuvchi nomi",
          usernamePlaceholder: "Foydalanuvchi nomini kiriting",
          password: "Parol",
          passwordPlaceholder: "Parolni kiriting",
          submit: "Kirish",
          loading: "Kutilmoqda...",
          success: "Kirish muvaffaqiyatli",
          heroBadge: "ERP SOLUTION",
          heroTitle: "Barcha jarayonlar bitta ERP markazida",
          heroDescription: "Buyurtma, ombor, moliya va jamoa ishlarini bitta dashboard orqali boshqaring.",
          heroAlt: "Haqiqiy ERP dashboard fon rasmi",
          usernameRequired: "Foydalanuvchi nomi kiriting",
          passwordRequired: "Parol kiriting",
          invalidCredentials: "Foydalanuvchi nomi yoki parol noto'g'ri",
          invalidPayload: "Ma'lumotlar noto'g'ri yuborildi",
          tooManyAttempts: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
          server: "Serverda xatolik",
        }

  const heroSlides =
    language === "ru"
      ? [
        {
          title: "\u0420\u0430\u0437\u0434\u0435\u043b \u0437\u0430\u043a\u0430\u0437\u043e\u0432",
          description:
            "\u0412 \u044d\u0442\u043e\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b \u043f\u0440\u0438\u043d\u0438\u043c\u0430\u044e\u0442\u0441\u044f, \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0438\u0440\u0443\u044e\u0442\u0441\u044f \u0438 \u0433\u043e\u0442\u043e\u0432\u044f\u0442\u0441\u044f \u043a \u043e\u0442\u0433\u0440\u0443\u0437\u043a\u0435.",
          alt: "\u0424\u043e\u0442\u043e \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u0430 \u0437\u0430\u043a\u0430\u0437\u043e\u0432 \u0438 \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438",
          image: ordersReal,
        },
        {
          title: "\u0421\u043a\u043b\u0430\u0434\u0441\u043a\u043e\u0439 \u0440\u0430\u0437\u0434\u0435\u043b",
          description:
            "\u0417\u0434\u0435\u0441\u044c \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0438\u0440\u0443\u044e\u0442\u0441\u044f \u043e\u0441\u0442\u0430\u0442\u043a\u0438, \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u0438 \u0441\u043a\u043b\u0430\u0434\u0441\u043a\u0438\u0435 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438.",
          alt: "\u0424\u043e\u0442\u043e \u0441\u043a\u043b\u0430\u0434\u0441\u043a\u043e\u0433\u043e \u0438 \u0438\u043d\u0432\u0435\u043d\u0442\u0430\u0440\u043d\u043e\u0433\u043e \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u0430",
          image: warehouseReal,
        },
        {
          title: "\u0424\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u0439 \u0440\u0430\u0437\u0434\u0435\u043b",
          description:
            "\u0417\u0434\u0435\u0441\u044c \u0443\u0434\u043e\u0431\u043d\u043e \u0441\u043b\u0435\u0434\u0438\u0442\u044c \u0437\u0430 \u0440\u0430\u0441\u0445\u043e\u0434\u0430\u043c\u0438, \u043f\u043e\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u044f\u043c\u0438 \u0438 \u043e\u0441\u043d\u043e\u0432\u043d\u044b\u043c\u0438 \u0444\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u043c\u0438 \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044f\u043c\u0438.",
          alt: "\u0424\u043e\u0442\u043e \u0444\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u043e\u0433\u043e \u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f",
          image: financeReal,
        },
        {
          title: "\u0420\u0430\u0437\u0434\u0435\u043b \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u0432",
          description:
            "\u0412 \u044d\u0442\u043e\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u043d\u0430\u044f \u0440\u0430\u0431\u043e\u0442\u0430, \u0440\u043e\u043b\u0438 \u0438 \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u044b\u0435 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u044b \u0432\u0435\u0434\u0443\u0442\u0441\u044f \u0432 \u043e\u0434\u043d\u043e\u043c \u043c\u0435\u0441\u0442\u0435.",
          alt: "\u0424\u043e\u0442\u043e \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0446\u0438\u0438 \u043a\u043e\u043c\u0430\u043d\u0434\u044b",
          image: teamReal,
        },
        {
          title: "\u0420\u0430\u0437\u0434\u0435\u043b \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0438",
          description:
            "\u0413\u0440\u0430\u0444\u0438\u043a\u0438 \u0438 \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u0438 \u043f\u043e\u043c\u043e\u0433\u0430\u044e\u0442 \u0431\u044b\u0441\u0442\u0440\u043e \u043f\u043e\u043d\u0438\u043c\u0430\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0435\u0435 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u0431\u0438\u0437\u043d\u0435\u0441\u0430.",
          alt: "\u0424\u043e\u0442\u043e \u044d\u043a\u0440\u0430\u043d\u043e\u0432 \u0431\u0438\u0437\u043d\u0435\u0441-\u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0438",
          image: analyticsReal,
        },
      ]
      : language === "en"
        ? [
          {
            title: "Orders Module",
            description: "Manage incoming orders, track fulfillment, and control delivery workflow in one place.",
            alt: "Orders and delivery workflow photo",
            image: ordersReal,
          },
          {
            title: "Warehouse Module",
            description: "Monitor stock levels, item locations, and day-to-day warehouse movement.",
            alt: "Warehouse inventory workflow photo",
            image: warehouseReal,
          },
          {
            title: "Finance Module",
            description: "Follow expenses, payments, and core financial performance from one workspace.",
            alt: "Finance planning photo",
            image: financeReal,
          },
          {
            title: "Team Module",
            description: "Keep teams aligned, manage responsibilities, and support daily collaboration.",
            alt: "Team coordination photo",
            image: teamReal,
          },
          {
            title: "Analytics Module",
            description: "Review key charts and metrics that help you understand business performance quickly.",
            alt: "Business analytics screen photo",
            image: analyticsReal,
          },
        ]
        : [
          {
            title: "Buyurtmalar bo'limi",
            description: "Bu bo'limda buyurtmalar qabul qilinadi, kuzatiladi va yetkazib berish jarayoni boshqariladi.",
            alt: "Buyurtma va yetkazib berish jarayoni rasmi",
            image: ordersReal,
          },
          {
            title: "Ombor bo'limi",
            description: "Bu bo'limda mahsulot qoldig'i, joylashuvi va ombordagi kundalik harakat nazorat qilinadi.",
            alt: "Ombor va inventar jarayoni rasmi",
            image: warehouseReal,
          },
          {
            title: "Moliya bo'limi",
            description: "Bu bo'limda tushum, xarajat va asosiy moliyaviy natijalarni bir joyda kuzatish mumkin.",
            alt: "Moliya rejalashtirish rasmi",
            image: financeReal,
          },
          {
            title: "Xodimlar bo'limi",
            description: "Bu bo'limda jamoa ishini muvofiqlashtirish va kundalik vazifalarni boshqarish mumkin.",
            alt: "Jamoa koordinatsiyasi rasmi",
            image: teamReal,
          },
          {
            title: "Analitika bo'limi",
            description: "Bu bo'limda asosiy ko'rsatkichlar va hisobotlar orqali biznes holati tez tahlil qilinadi.",
            alt: "Biznes analitika ekranlari rasmi",
            image: analyticsReal,
          },
        ]

  const activeHeroSlide = heroSlides[heroIndex] ?? heroSlides[0]

  const redirectTo = resolveAuthRedirect(new URLSearchParams(location.search).get("redirect"))

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  })

  const { register, handleSubmit, formState } = form
  const { errors } = formState

  useEffect(() => {
    let timeoutId: number | undefined

    const intervalId = window.setInterval(() => {
      setHeroVisible(false)

      timeoutId = window.setTimeout(() => {
        setHeroIndex((prev) => (prev + 1) % heroSlides.length)
        setHeroVisible(true)
      }, 900)
    }, 8000)

    return () => {
      window.clearInterval(intervalId)
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [heroSlides.length])

  const onSubmit = async (values: LoginPayload) => {
    setLoading(true)

    try {
      const { access, refresh } = await accountsApi.login(values)
      setTokens(access, refresh)

      const me = await accountsApi.me()
      markSessionAuth()
      setStoredUser(me)

      toast.success(copy.success)
      navigate(redirectTo, { replace: true })
    } catch (error: unknown) {
      clearAuth()
      const status = (error as any)?.response?.status

      if (status === 401) {
        toast.error(getErrorMessage(error, copy.invalidCredentials))
      } else if (status === 400) {
        toast.error(getErrorMessage(error, copy.invalidPayload))
      } else if (status === 429) {
        toast.error(copy.tooManyAttempts)
      } else {
        toast.error(getErrorMessage(error, copy.server))
      }

      console.error("LOGIN ERROR:", (error as any)?.response?.data || error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-20">
      <div className="flex w-full max-w-[1120px] flex-col items-center gap-8 lg:flex-row lg:items-stretch lg:justify-center">
        <section className="hidden w-full max-w-[526px] lg:flex">
          <div className="motion-enter-bottom flex h-[580px] w-full flex-col overflow-hidden rounded-[36px] border border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
            <div className="relative h-[328px] overflow-hidden">
              <img
                src={activeHeroSlide.image}
                alt={activeHeroSlide.alt}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1800ms] ease-out ${heroVisible ? "scale-100 opacity-100" : "scale-105 opacity-0"
                  }`}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,20,48,0.12)_0%,rgba(11,23,56,0.22)_30%,rgba(10,20,48,0.48)_100%)]" />
            </div>

            <div className="flex flex-1 p-7 md:p-8">
              <div className="w-full rounded-[30px] border border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.08)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_24px_40px_rgba(8,15,40,0.22)] backdrop-blur-xl">
                <span className="inline-flex rounded-full border border-white/18 bg-white/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/72">
                  {copy.heroBadge}
                </span>

                <h2 className="mt-4 max-w-[340px] text-[30px] font-semibold leading-tight text-white">
                  {activeHeroSlide.title}
                </h2>
                <p className="mt-3 max-w-[380px] text-[14px] leading-6 text-white/78">
                  {activeHeroSlide.description}
                </p>
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="motion-enter-bottom flex h-[580px] w-full max-w-[526px] shrink-0 flex-col rounded-[36px] border border-white/20 bg-white/10 p-7 text-white shadow-2xl backdrop-blur-xl md:p-8"
        >
          <div className="motion-stagger mb-7 text-center">
            <h1 className="pb-4 text-[36px] font-semibold tracking-wide !text-white/80">{copy.title}</h1>
            <p className="mx-auto mt-2 max-w-[390px] text-[16px] leading-7 text-white/80">{copy.subtitle}</p>
          </div>

          <div className="motion-stagger space-y-[18px]">
            <div>
              <label className="mb-2.5 block text-[15px] text-white/90">{copy.username}</label>
              <Input
                placeholder={copy.usernamePlaceholder}
                {...register("username")}
                className="auth-glass-input h-[54px] rounded-[22px] border-white/20 !bg-white/8 text-black shadow-lg backdrop-blur-xl placeholder:text-white/60 focus-visible:border-white/35 focus-visible:ring-white/15"
              />
              {errors.username && <p className="mt-1 text-sm text-red-500">{copy.usernameRequired}</p>}
            </div>

            <div>
              <label className="mb-2.5 block text-[15px] text-white/90">{copy.password}</label>
              <Input
                type="password"
                placeholder={copy.passwordPlaceholder}
                {...register("password")}
                className="auth-glass-input h-[54px] rounded-[22px] border-white/20 !bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_-18px_rgba(15,23,42,0.55)] backdrop-blur-xl placeholder:text-white/60 focus-visible:border-white/35 focus-visible:ring-white/15"
              />
              {errors.password && <p className="mt-1 text-sm text-red-500">{copy.passwordRequired}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-5 h-[56px] w-full rounded-[20px] bg-gradient-to-r from-blue-900 to-blue-700 text-[17px] font-semibold transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? copy.loading : copy.submit}
            </button>

            <div className="mt-auto flex justify-center pt-5">
              <LanguageSelect
                variant="glass"
                className="h-[46px] w-[104px] rounded-full"
                contentAlign="center"
                contentSideOffset={10}
                contentClassName="min-w-[210px] rounded-[24px] p-1.5"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
