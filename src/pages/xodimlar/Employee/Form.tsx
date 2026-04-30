import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { apiAxios } from "@/Api/api.axios"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/i18n"

type Gender = "ayol" | "erkak"
type Role = "operator" | "manager" | "admin"
type Branch = "yunusobod" | "chilonzor" | "sergeli" | "andijon"

type EmployeePayload = {
  full_name: string
  passport_serial: string
  email: string
  phone: string
  extra_phone: string
  gender: Gender
  role: Role
  branch: Branch
  employee_id: string
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const genId = () => String(Math.floor(10000000 + Math.random() * 90000000))

function formatUZPhone(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 12)
  if (!digits) return ""
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 5),
    digits.slice(5, 8),
    digits.slice(8, 10),
    digits.slice(10, 12),
  ].filter(Boolean)
  return parts.join(" ")
}

export default function Form() {
  const { language } = useI18n()
  const navigate = useNavigate()
  const copy =
    language === "ru"
      ? {
          requiredName: "Имя обязательно",
          minName: "Минимум 3 символа",
          requiredPassport: "Паспорт обязателен",
          invalidPassport: "Неверный формат",
          requiredEmail: "Email обязателен",
          invalidEmail: "Неверный email",
          invalidPhone: "Телефон не полный (998...)",
          invalidExtraPhone: "Дополнительный телефон не полный",
          fillForm: "Заполните форму корректно",
          created: "Сотрудник добавлен",
          createError: "Ошибка создания сотрудника",
          name: "Имя",
          namePlaceholder: "Имя Фамилия...",
          passport: "Серия паспорта",
          email: "Email",
          emailPlaceholder: "Email@name.com",
          phone: "Телефон",
          gender: "Пол",
          select: "Выберите",
          female: "Женский",
          male: "Мужской",
          extraPhone: "Дополнительный номер",
          role: "Должность",
          operator: "Оператор",
          manager: "Менеджер",
          admin: "Админ",
          branch: "Филиал",
          employeeId: "ID сотрудника",
          back: "Назад",
          save: "Сохранить",
        }
      : language === "en"
        ? {
            requiredName: "Name is required",
            minName: "At least 3 characters",
            requiredPassport: "Passport is required",
            invalidPassport: "Invalid format",
            requiredEmail: "Email is required",
            invalidEmail: "Invalid email",
            invalidPhone: "Phone is incomplete (998...)",
            invalidExtraPhone: "Extra phone is incomplete",
            fillForm: "Fill the form correctly",
            created: "Employee added",
            createError: "Employee create error",
            name: "Name",
            namePlaceholder: "Full name...",
            passport: "Passport series",
            email: "Email",
            emailPlaceholder: "email@name.com",
            phone: "Phone",
            gender: "Gender",
            select: "Select",
            female: "Female",
            male: "Male",
            extraPhone: "Extra phone",
            role: "Role",
            operator: "Operator",
            manager: "Manager",
            admin: "Admin",
            branch: "Branch",
            employeeId: "Employee ID",
            back: "Back",
            save: "Save",
          }
        : {
            requiredName: "Ism majburiy",
            minName: "Kamida 3 ta belgi",
            requiredPassport: "Passport majburiy",
            invalidPassport: "Noto'g'ri format",
            requiredEmail: "Email majburiy",
            invalidEmail: "Email noto'g'ri",
            invalidPhone: "Telefon to'liq emas (998...)",
            invalidExtraPhone: "Qo'shimcha telefon to'liq emas",
            fillForm: "Formani to'g'ri to'ldiring",
            created: "Xodim qo'shildi",
            createError: "Employee create xatolik",
            name: "Ism",
            namePlaceholder: "Ism Familiya...",
            passport: "Pasport seriyasi",
            email: "Email manzil",
            emailPlaceholder: "Email@nomi.com",
            phone: "Telefon raqami",
            gender: "Jinsi",
            select: "Tanlang",
            female: "Ayol",
            male: "Erkak",
            extraPhone: "Qo'shimcha raqam",
            role: "Lavozimi",
            operator: "Operator",
            manager: "Manager",
            admin: "Admin",
            branch: "Filial",
            employeeId: "Xodim ID",
            back: "Orqaga",
            save: "Saqlash",
          }

  const [form, setForm] = useState<EmployeePayload>({
    full_name: "",
    passport_serial: "",
    email: "",
    phone: "",
    extra_phone: "",
    gender: "ayol",
    role: "operator",
    branch: "yunusobod",
    employee_id: genId(),
  })

  const errors = useMemo(() => {
    const e: Partial<Record<keyof EmployeePayload, string>> = {}

    if (!form.full_name.trim()) e.full_name = copy.requiredName
    else if (form.full_name.trim().length < 3) e.full_name = copy.minName

    if (!form.passport_serial.trim()) e.passport_serial = copy.requiredPassport
    else if (form.passport_serial.trim().length < 5) e.passport_serial = copy.invalidPassport

    if (!form.email.trim()) e.email = copy.requiredEmail
    else if (!emailRegex.test(form.email.trim())) e.email = copy.invalidEmail

    const phoneDigits = form.phone.replace(/\D/g, "")
    if (phoneDigits.length > 0 && phoneDigits.length < 12) e.phone = copy.invalidPhone

    const extraDigits = form.extra_phone.replace(/\D/g, "")
    if (form.extra_phone.trim() && extraDigits.length < 12) {
      e.extra_phone = copy.invalidExtraPhone
    }

    return e
  }, [form, copy])

  const hasErrors = Object.keys(errors).length > 0

  const set =
    <K extends keyof EmployeePayload>(k: K) =>
      (v: EmployeePayload[K]) =>
        setForm((p) => ({ ...p, [k]: v }))

  const onChangeInput =
    (k: keyof EmployeePayload) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value

      if (k === "phone" || k === "extra_phone") {
        setForm((p) => ({ ...p, [k]: formatUZPhone(val) }))
        return
      }

      setForm((p) => ({ ...p, [k]: val }))
    }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (hasErrors) {
      toast.error(copy.fillForm)
      return
    }

    const payload = {
      name: form.full_name,
      phone: form.phone.replace(/\D/g, "") || undefined,
      email: form.email || "",
      address: form.branch,
      position: form.role,
      currency: "UZS",
      isActive: true,
      salary: undefined,
    }

    try {
      await apiAxios.create("employee", payload as any)
      toast.success(copy.created)
      navigate("/xodimlar", { replace: true })
    } catch (err: any) {
      const msg = String(err?.response?.data?.detail || err?.message || copy.createError)
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-[calc(100vh-2rem)] w-[600px] px-6 py-10">
      <div className="wide-desktop-form-shell mx-auto">
        <form
          onSubmit={onSubmit}
          className="rounded-3xl bg-white/60 p-6 shadow-[0_22px_70px_-40px_rgba(2,6,23,0.35)] backdrop-blur-xl md:p-8"
        >
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
            <Field label={copy.name} error={errors.full_name}>
              <Input
                value={form.full_name}
                onChange={onChangeInput("full_name")}
                placeholder={copy.namePlaceholder}
                className={inputLuxury(!!errors.full_name)}
              />
            </Field>

            <Field label={copy.passport} error={errors.passport_serial}>
              <Input
                value={form.passport_serial}
                onChange={onChangeInput("passport_serial")}
                placeholder="AD06240624"
                className={inputLuxury(!!errors.passport_serial)}
              />
            </Field>

            <Field label={copy.email} error={errors.email}>
              <Input
                value={form.email}
                onChange={onChangeInput("email")}
                placeholder={copy.emailPlaceholder}
                className={inputLuxury(!!errors.email)}
              />
            </Field>

            <Field label={copy.phone} error={errors.phone}>
              <Input
                value={form.phone}
                onChange={onChangeInput("phone")}
                placeholder="998 99 123 45 67"
                className={inputLuxury(!!errors.phone)}
              />
            </Field>

            <Field label={copy.gender}>
              <Select value={form.gender} onValueChange={(v) => set("gender")(v as Gender)}>
                <SelectTrigger className={selectLuxury()}>
                  <SelectValue placeholder={copy.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ayol">{copy.female}</SelectItem>
                  <SelectItem value="erkak">{copy.male}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label={copy.extraPhone} error={errors.extra_phone}>
              <Input
                value={form.extra_phone}
                onChange={onChangeInput("extra_phone")}
                placeholder="998 90 123 45 67"
                className={inputLuxury(!!errors.extra_phone)}
              />
            </Field>

            <Field label={copy.role}>
              <Select value={form.role} onValueChange={(v) => set("role")(v as Role)}>
                <SelectTrigger className={selectLuxury()}>
                  <SelectValue placeholder={copy.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">{copy.operator}</SelectItem>
                  <SelectItem value="manager">{copy.manager}</SelectItem>
                  <SelectItem value="admin">{copy.admin}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label={copy.branch}>
              <Select value={form.branch} onValueChange={(v) => set("branch")(v as Branch)}>
                <SelectTrigger className={selectLuxury()}>
                  <SelectValue placeholder={copy.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yunusobod">Yunusobod</SelectItem>
                  <SelectItem value="chilonzor">Chilonzor</SelectItem>
                  <SelectItem value="sergeli">Sergeli</SelectItem>
                  <SelectItem value="andijon">Andijon</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label={copy.employeeId}>
              <Input
                value={form.employee_id}
                readOnly
                className="h-12 rounded-xl border-slate-200 bg-slate-100 text-center text-slate-700"
              />
            </Field>

            <div className="hidden md:block" />
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/xodimlar")}
              className="h-12 rounded-xl"
            >
              {copy.back}
            </Button>

            <Button
              type="submit"
              disabled={hasErrors}
              className={[
                "h-12 rounded-xl text-white",
                "bg-[#2187BF] hover:bg-[#1b6f9d]",
                hasErrors ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              {copy.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
      {children}
      {error ? <div className="mt-2 text-xs text-red-500">{error}</div> : null}
    </div>
  )
}

function inputLuxury(isError: boolean) {
  return [
    "h-12 rounded-xl",
    "bg-[#F6F7FB]",
    "border",
    isError ? "border-red-400" : "border-slate-200",
    "focus-visible:ring-2 focus-visible:ring-sky-400/30",
    "focus-visible:ring-offset-0",
  ].join(" ")
}

function selectLuxury() {
  return [
    "h-12 rounded-xl",
    "bg-[#F6F7FB]",
    "border border-slate-200",
    "focus:ring-2 focus:ring-sky-400/30",
  ].join(" ")
}
