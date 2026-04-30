import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { Eye, EyeOff, UserRound } from "lucide-react"
import { toast } from "react-toastify"

import { useI18n } from "@/i18n"
import Sidebar from "@/widgets/Sidebar/Sidebar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  clearPersistedUserAvatarUrl,
  clearTemporaryUserAvatarUrl,
  getStoredUser,
  setPersistedUserAvatarUrl,
  setStoredUser,
  setTemporaryUserAvatarUrl,
} from "@/lib/auth"
import { accountsApi, getAccountSuccessMessage } from "@/pages/auth/api/accountsApi"
import { getUserAvatarFallbackUrl, getUserAvatarUrl, getUserInitials } from "@/shared/useMe"
import { useResolvedImageSrcWithFallback } from "@/shared/useResolvedImageSrc"
import type { AccountUser } from "@/types/auth"

type ProfileFormState = {
  username: string
  full_name: string
  phone: string
}

type PasswordFormState = {
  old_password: string
  new_password: string
  new_password2: string
}

function toProfileForm(user: AccountUser | null): ProfileFormState {
  return {
    username: user?.username ?? "",
    full_name: user?.full_name ?? "",
    phone: user?.phone ?? "",
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const data = (error as any)?.response?.data

  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail
  }

  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (typeof value === "string" && value.trim()) return value
      if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0]
    }
  }

  return fallback
}

function formatAdminRole(role?: string | null) {
  if (!role) return "Admin"
  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const emptyPasswordForm: PasswordFormState = {
  old_password: "",
  new_password: "",
  new_password2: "",
}

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg"]
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }
      reject(new Error("Avatar preview yaratilmadi"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("Avatar preview yaratilmadi"))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Avatar preview yaratilmadi"))
    image.src = src
  })
}

async function createPersistedAvatarPreview(dataUrl: string) {
  if (typeof document === "undefined") return dataUrl

  try {
    const image = await loadImageElement(dataUrl)
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    const maxSide = 256
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight))
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) return dataUrl

    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    return canvas.toDataURL("image/jpeg", 0.84)
  } catch {
    return dataUrl
  }
}

function getProfileCopy(language: "uz" | "ru" | "en") {
  if (language === "ru") {
    return {
      title: "Профиль",
      avatarTitle: "Загрузка аватара",
      avatarHint: "Аватар сохранится и будет виден по всей системе",
      remove: "Удалить",
      update: "Обновить",
      uploading: "Аватар загружается...",
      wait: "Пожалуйста, подождите",
      dropPrefix: "Нажмите для загрузки",
      dropSuffix: "или перетащите файл",
      personalInfo: "Личные данные",
      edit: "Редактировать",
      editTitle: "Редактирование личных данных",
      close: "Закрыть",
      save: "Сохранить",
      password: "Пароль",
      change: "Изменить",
      passwordTitle: "Изменение пароля",
      currentPassword: "Текущий пароль",
      newPassword: "Новый пароль",
      confirmPassword: "Подтвердите пароль",
      passwordMismatch: "Новые пароли не совпадают.",
      passwordHidden: "Текущий пароль не отображается из соображений безопасности.",
      passwordHint: "Используйте кнопку выше, чтобы сменить пароль.",
      active: "Active",
      inactive: "Inactive",
    }
  }

  if (language === "en") {
    return {
      title: "Profile",
      avatarTitle: "Upload avatar",
      avatarHint: "Your avatar will be saved and shown across the system",
      remove: "Delete",
      update: "Update",
      uploading: "Uploading avatar...",
      wait: "Please wait",
      dropPrefix: "Click to upload",
      dropSuffix: "or drag & drop",
      personalInfo: "Personal information",
      edit: "Edit",
      editTitle: "Edit personal information",
      close: "Close",
      save: "Save",
      password: "Password",
      change: "Change",
      passwordTitle: "Change password",
      currentPassword: "Current Password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      passwordMismatch: "New passwords do not match.",
      passwordHidden: "Your current password is hidden for security reasons.",
      passwordHint: "Use the button above to change your password.",
      active: "Active",
      inactive: "Inactive",
    }
  }

  return {
    title: "Profil",
    avatarTitle: "Avatarga rasm qo'yish",
    avatarHint: "Avatar saqlanadi va tizim boylab korinadi",
    remove: "Delete",
    update: "Update",
    uploading: "Avatar yuklanmoqda...",
    wait: "Iltimos kuting",
    dropPrefix: "Click to upload",
    dropSuffix: "or drag & drop",
    personalInfo: "Shaxsiy ma'lumotlar",
    edit: "Tahrirlash",
    editTitle: "Shaxsiy ma'lumotlarni tahrirlash",
    close: "Yopish",
    save: "Saqlash",
    password: "Parol",
    change: "O'zgartirish",
    passwordTitle: "Parolni o'zgartirish",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    passwordMismatch: "Yangi passwordlar bir xil emas.",
    passwordHidden: "Amaldagi parol xavfsizlik sababli ko'rsatilmayapti.",
    passwordHint: "Parolni yangilash uchun yuqoridagi tugmadan foydalaning.",
    active: "Active",
    inactive: "Inactive",
  }
}

const ProfilePage = () => {
  const { language } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profile, setProfile] = useState<AccountUser | null>(() => getStoredUser())
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => toProfileForm(getStoredUser()))
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm)
  const [showPwd, setShowPwd] = useState({
    old_password: false,
    new_password: false,
    new_password2: false,
  })

  const inputRef = useRef<HTMLInputElement | null>(null)
  const previewObjectUrlRef = useRef<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<string | null>(() => getUserAvatarUrl(getStoredUser()))
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarPreviewLoadFailed, setAvatarPreviewLoadFailed] = useState(false)
  const persistedAvatarPreview = getUserAvatarFallbackUrl(profile ?? getStoredUser())
  const resolvedPreview = useResolvedImageSrcWithFallback(preview, persistedAvatarPreview)
  const copy = getProfileCopy(language)

  const replacePreview = (nextPreview: string | null) => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }

    if (nextPreview?.startsWith("blob:")) {
      previewObjectUrlRef.current = nextPreview
    }

    setPreview(nextPreview)
  }

  const syncProfileState = (user: AccountUser, options?: { keepPreview?: boolean }) => {
    setProfile(user)
    setProfileForm(toProfileForm(user))
    setStoredUser(user)
    if (!options?.keepPreview) {
      replacePreview(getUserAvatarUrl(user))
    }
  }

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setAvatarPreviewLoadFailed(false)
  }, [persistedAvatarPreview, preview, resolvedPreview])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setLoadingProfile(true)
      try {
        const me = await accountsApi.me()
        if (cancelled) return
        syncProfileState(me)
      } catch (error) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, copy.title))
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false)
        }
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

  const pickFile = () => inputRef.current?.click()

  const handleFile = async (file: File | null) => {
    if (!file) return

    if (!profile?.username) {
      toast.error(copy.wait)
      return
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Faqat JPG yoki PNG formatdagi rasm yuklang")
      return
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Avatar hajmi 5 MB dan oshmasligi kerak")
      return
    }

    const currentProfile = profile
    const nextPreview = await readFileAsDataUrl(file)
    const persistedPreview = await createPersistedAvatarPreview(nextPreview)

    setFileName(file.name)
    setTemporaryUserAvatarUrl(persistedPreview)
    replacePreview(nextPreview)
    setSavingAvatar(true)

    try {
      const updated = await accountsApi.patchMe({
        username: currentProfile.username,
        avatar: file,
      })

      setPersistedUserAvatarUrl(updated, persistedPreview)
      setTemporaryUserAvatarUrl(persistedPreview)
      syncProfileState(updated, { keepPreview: true })
      if (inputRef.current) inputRef.current.value = ""
      toast.success(copy.update)
    } catch (error) {
      clearTemporaryUserAvatarUrl()
      replacePreview(getUserAvatarUrl(currentProfile))
      setFileName("")
      toast.error(getApiErrorMessage(error, copy.avatarTitle))
    } finally {
      setSavingAvatar(false)
    }
  }

  const handleDelete = async () => {
    if (!profile?.username) {
      clearPersistedUserAvatarUrl(profile ?? getStoredUser())
      replacePreview(null)
      setFileName("")
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    setSavingAvatar(true)
    try {
      const updated = await accountsApi.patchMe({
        username: profile.username,
        avatar: null,
      })

      clearTemporaryUserAvatarUrl()
      clearPersistedUserAvatarUrl(updated)
      syncProfileState(updated)
      setFileName("")
      if (inputRef.current) inputRef.current.value = ""
      toast.success(copy.remove)
    } catch (error) {
      toast.error(getApiErrorMessage(error, copy.avatarTitle))
    } finally {
      setSavingAvatar(false)
    }
  }

  const handleProfileChange =
    (key: keyof ProfileFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setProfileForm((current) => ({ ...current, [key]: event.target.value }))
    }

  const handleSaveProfile = async () => {
    const username = profileForm.username.trim()
    const fullName = profileForm.full_name.trim()
    const phone = profileForm.phone.trim()

    if (!username) {
      toast.error("Username bosh bolmasligi kerak")
      return
    }

    setSavingProfile(true)
    try {
      const payload: {
        username: string
        full_name?: string
        phone?: string
      } = { username }

      if (fullName) {
        payload.full_name = fullName
      }

      if (phone) {
        payload.phone = phone
      }

      const updated = await accountsApi.patchMe(payload)

      syncProfileState(updated)
      setEditOpen(false)
      toast.success(copy.save)
    } catch (error) {
      toast.error(getApiErrorMessage(error, copy.personalInfo))
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSave = async () => {
    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.new_password2) {
      toast.error("Barcha maydonlarni toldiring")
      return
    }

    if (passwordForm.new_password !== passwordForm.new_password2) {
      toast.error(copy.passwordMismatch)
      return
    }

    setSavingPassword(true)
    try {
      const response = await accountsApi.changePassword(passwordForm)
      toast.success(getAccountSuccessMessage(response) || copy.save)
      setPasswordOpen(false)
      setPasswordForm(emptyPasswordForm)
    } catch (error) {
      toast.error(getApiErrorMessage(error, copy.passwordTitle))
    } finally {
      setSavingPassword(false)
    }
  }

  const displayFullName = profile?.full_name?.trim() || "-"
  const displayPhone = profile?.phone?.trim() || "-"
  const avatarSrc =
    resolvedPreview ||
    (preview?.startsWith("blob:") || preview?.startsWith("data:") ? preview : null) ||
    persistedAvatarPreview
  const userInitials = getUserInitials(profile ?? getStoredUser())
  const shouldUseAvatarFallback = avatarPreviewLoadFailed || !avatarSrc
  const hasAvatar = Boolean(preview || persistedAvatarPreview)
  const avatarActionDisabled = loadingProfile || savingAvatar
  const legacyCopy =
    language === "ru"
      ? {
        title: "Профиль",
        avatarTitle: "Загрузка аватара",
        avatarHint: "Аватар сохранится и будет виден по всей системе",
        remove: "Удалить",
        update: "Обновить",
        uploading: "Аватар загружается...",
        wait: "Пожалуйста, подождите",
        dropPrefix: "Нажмите для загрузки",
        dropSuffix: "или перетащите файл",
        personalInfo: "Личные данные",
        edit: "Редактировать",
        editTitle: "Редактирование личных данных",
        close: "Закрыть",
        save: "Сохранить",
        password: "Пароль",
        change: "Изменить",
        passwordTitle: "Изменение пароля",
        currentPassword: "Текущий пароль",
        newPassword: "Новый пароль",
        confirmPassword: "Подтвердите пароль",
        passwordMismatch: "Новые пароли не совпадают.",
        passwordHidden: "Текущий пароль не отображается из соображений безопасности.",
        passwordHint: "Используйте кнопку выше, чтобы сменить пароль.",
        active: "Active",
        inactive: "Inactive",
      }
      : language === "en"
        ? {
          title: "Profile",
          avatarTitle: "Upload avatar",
          avatarHint: "Your avatar will be saved and shown across the system",
          remove: "Delete",
          update: "Update",
          uploading: "Uploading avatar...",
          wait: "Please wait",
          dropPrefix: "Click to upload",
          dropSuffix: "or drag & drop",
          personalInfo: "Personal information",
          edit: "Edit",
          editTitle: "Edit personal information",
          close: "Close",
          save: "Save",
          password: "Password",
          change: "Change",
          passwordTitle: "Change password",
          currentPassword: "Current Password",
          newPassword: "New Password",
          confirmPassword: "Confirm Password",
          passwordMismatch: "New passwords do not match.",
          passwordHidden: "Your current password is hidden for security reasons.",
          passwordHint: "Use the button above to change your password.",
          active: "Active",
          inactive: "Inactive",
        }
        : {
          title: "Profil",
          avatarTitle: "Avatarga rasm qo'yish",
          avatarHint: "Avatar saqlanadi va tizim boylab korinadi",
          remove: "Delete",
          update: "Update",
          uploading: "Avatar yuklanmoqda...",
          wait: "Iltimos kuting",
          dropPrefix: "Click to upload",
          dropSuffix: "or drag & drop",
          personalInfo: "Shaxsiy ma'lumotlar",
          edit: "Tahrirlash",
          editTitle: "Shaxsiy ma'lumotlarni tahrirlash",
          close: "Yopish",
          save: "Saqlash",
          password: "Parol",
          change: "O'zgartirish",
          passwordTitle: "Parolni o'zgartirish",
          currentPassword: "Current Password",
          newPassword: "New Password",
          confirmPassword: "Confirm Password",
          passwordMismatch: "Yangi passwordlar bir xil emas.",
          passwordHidden: "Amaldagi parol xavfsizlik sababli ko'rsatilmayapti.",
          passwordHint: "Parolni yangilash uchun yuqoridagi tugmadan foydalaning.",
          active: "Active",
          inactive: "Inactive",
        }

  return (
    <div className="flex min-h-screen bg-[#F4F7FB]">
      <div
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
        className={`hidden md:block transition-all duration-100 ml-0 md:ml-20 ${sidebarOpen ? "w-[260px]" : "w-[60px]"}`}
      >
        <Sidebar />
      </div>

      <div className="flex-1 px-4 sm:px-6 md:px-10 py-6 ml-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{copy.title}</h1>
          </div>
          {/* <Button
            variant="outline"
            onClick={() => {
              if (profile) {
                setProfileForm(toProfileForm(profile))
              }
              setEditOpen(true)
            }}
            disabled={loadingProfile}
          >
            {loadingProfile ? "Yuklanmoqda..." : "Edit Profile"}
          </Button> */}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          <div className="w-full lg:w-[300px] h-80 rounded-2xl border-slate-300 bg-white shadow-lg text-black">
            <h2 className="  py-3 text-center font-medium">{copy.avatarTitle}</h2>

            <div className="p-4 ">
              <div className="flex items-center gap-4 mt-4  ">
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#4374ff] via-[#3256d6] to-[#263c9f] shadow-[0_18px_40px_rgba(37,65,168,0.3)] ring-1 ring-[#d5e2ff]">
                  {!shouldUseAvatarFallback ? (
                    <img
                      src={avatarSrc || ""}
                      alt="profile"
                      className="h-full w-full object-cover"
                      onError={() => setAvatarPreviewLoadFailed(true)}
                    />
                  ) : (
                    <>
                      <div className="absolute inset-[4px] rounded-full border border-white/18 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.24),rgba(255,255,255,0.06)_48%,rgba(15,23,42,0.2)_100%)]" />
                      <UserRound size={22} strokeWidth={2.05} className="relative z-10 text-white" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/55 to-transparent px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/95">
                        {userInitials}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm">{copy.avatarHint}</p>
                  <div className="mt-2 flex gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={!hasAvatar || avatarActionDisabled}
                      className="text-red-500 hover:cursor-pointer disabled:cursor-not-allowed disabled:text-red-300"
                    >
                      {savingAvatar ? copy.uploading : copy.remove}
                    </button>
                    <button
                      type="button"
                      onClick={pickFile}
                      disabled={avatarActionDisabled}
                      className="text-blue-500 hover:cursor-pointer disabled:cursor-not-allowed disabled:text-blue-300"
                    >
                      {copy.update}
                    </button>
                  </div>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                className="hidden"
              />

              <div
                onClick={() => {
                  if (!avatarActionDisabled) pickFile()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  void handleFile(event.dataTransfer.files?.[0] ?? null)
                }}
                onDragOver={(event) => event.preventDefault()}
                className={`mt-6 rounded-xl border-2 border-dashed bg-white/60 px-4 py-8 text-center ${avatarActionDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-[#334F9D]"
                  }`}
              >
                {savingAvatar ? (
                  <>
                    <p className="text-sm font-medium">{copy.uploading}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{copy.wait}</p>
                  </>
                ) : !fileName ? (
                  <>
                    <p className="text-xs">
                      <span className="text-blue-600 font-medium">{copy.dropPrefix}</span> {copy.dropSuffix}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">JPG or PNG</p>
                  </>
                ) : (
                  <p className="text-sm font-medium">{fileName}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <div className="rounded-2xl border-slate-300 bg-white shadow-lg text-black p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-semibold">{copy.personalInfo}</h2>

                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="text-xs bg-gradient-to-r from-blue-900 to-blue-700 text-white hover:from-blue-950 hover:to-blue-800"
                      onClick={() => {
                        setProfileForm(toProfileForm(profile))
                      }}
                    >
                      {copy.edit}
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="border-slate-300 bg-white shadow-lg text-black">
                    <DialogHeader>
                      <DialogTitle>{copy.editTitle}</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-4 mt-4">
                      <Input className="border-slate-300 bg-white shadow-lg text-black"
                        value={profileForm.username}
                        onChange={handleProfileChange("username")}
                        placeholder="Username"
                        disabled={savingProfile}
                      />
                      <Input
                        className="border-slate-300 bg-white shadow-lg text-black"
                        value={profileForm.full_name}
                        onChange={handleProfileChange("full_name")}
                        placeholder="Full name"
                        disabled={savingProfile}
                      />
                    </div>

                    <DialogFooter className="mt-4">
                      <DialogClose asChild>
                        <Button
                          className="border-slate-300 bg-white shadow-lg text-black"
                          disabled={savingProfile}>
                          {copy.close}
                        </Button>
                      </DialogClose>
                      <Button
                        variant="outline"
                        onClick={() => void handleSaveProfile()}
                        disabled={savingProfile}
                      >
                        {savingProfile ? copy.uploading : copy.save}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input className="border-slate-300 bg-white shadow-lg text-black" value={profile?.username ?? ""} disabled />
                <Input className="border-slate-300 bg-white shadow-lg text-black" value={formatAdminRole(profile?.admin_role)} disabled />
                <Input className="border-slate-300 bg-white shadow-lg text-black" value={profile?.is_active === false ? copy.inactive : copy.active} disabled />
              </div>
            </div>

            <div className="rounded-2xl border-slate-300 bg-white shadow-lg text-black p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{copy.password}</h2>
                </div>

                <Dialog
                  open={passwordOpen}
                  onOpenChange={(nextOpen) => {
                    setPasswordOpen(nextOpen)
                    if (!nextOpen) {
                      setPasswordForm(emptyPasswordForm)
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      className="bg-gradient-to-r from-blue-900 to-blue-700 text-white hover:from-blue-950 hover:to-blue-800 text-xs"
                      onClick={() => setPasswordForm(emptyPasswordForm)}
                    >
                      {copy.change}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-slate-300 bg-white shadow-lg text-black !h-[350px]">
                    <DialogHeader>
                      <DialogTitle>{copy.passwordTitle}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 mt-4">
                      {([
                        ["old_password", copy.currentPassword],
                        ["new_password", copy.newPassword],
                        ["new_password2", copy.confirmPassword],
                      ] as const).map(([key, label]) => (
                        <div key={key} className="relative">
                          <Input
                            type={showPwd[key] ? "text" : "password"}
                            placeholder={label}
                            value={passwordForm[key]}
                            disabled={savingPassword}
                            onChange={(event) =>
                              setPasswordForm((current) => ({ ...current, [key]: event.target.value }))
                            }
                            className="pr-10 border-slate-300 bg-white shadow-lg text-black"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd((current) => ({ ...current, [key]: !current[key] }))}
                            className="absolute right-3 top-5 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPwd[key] ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      ))}

                      {passwordForm.new_password2 && passwordForm.new_password !== passwordForm.new_password2 ? (
                        <p className="text-xs text-red-500">{copy.passwordMismatch}</p>
                      ) : null}
                    </div>

                    <DialogFooter>
                      <Button className="border-slate-300 bg-white shadow-lg text-black text-black" onClick={() => setPasswordOpen(false)} disabled={savingPassword}>
                        {copy.close}
                      </Button>
                      <Button
                        disabled={savingPassword}
                        onClick={() => void handlePasswordSave()}
                        className="bg-gradient-to-r from-blue-900 to-blue-700 text-white hover:from-blue-950 hover:to-blue-800"
                      >
                        {savingPassword ? copy.uploading : copy.save}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="rounded-2xl border border-[#E9EDF4] bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {copy.passwordHidden}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {copy.passwordHint}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
