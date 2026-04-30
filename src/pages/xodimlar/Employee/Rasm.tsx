import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Camera } from "lucide-react"
import { toast } from "react-toastify"
import { useI18n, type LanguageCode } from "@/i18n"

const MAX_SIZE_MB = 2
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"]

function getImageCardCopy(language: LanguageCode) {
  if (language === "ru") {
    return {
      invalidType: "Разрешены только JPG, JPEG или PNG",
      maxSizeError: `Размер изображения не должен превышать ${MAX_SIZE_MB}MB`,
      addImage: "Добавить изображение",
      previewAlt: "Предпросмотр",
      recommendedFormat: "Рекомендуемый формат",
      maximumSize: "Максимальный размер",
      addEmployee: "Добавить сотрудника",
    } as const
  }

  if (language === "en") {
    return {
      invalidType: "Only JPG, JPEG, or PNG files are allowed",
      maxSizeError: `Image size must not exceed ${MAX_SIZE_MB}MB`,
      addImage: "Add image",
      previewAlt: "Preview",
      recommendedFormat: "Recommended format",
      maximumSize: "Maximum size",
      addEmployee: "Add employee",
    } as const
  }

  return {
    invalidType: "Faqat JPG, JPEG yoki PNG ruxsat etiladi",
    maxSizeError: `Rasm hajmi ${MAX_SIZE_MB}MB dan oshmasligi kerak`,
    addImage: "Rasm qo'shish",
    previewAlt: "Ko'rinish",
    recommendedFormat: "Tafsiya qilingan format",
    maximumSize: "Maksimal hajm",
    addEmployee: "Xodim qo'shish",
  } as const
}

const Rasm = () => {
  const { language } = useI18n()
  const copy = getImageCardCopy(language)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleSelect = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(copy.invalidType)
      return
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(copy.maxSizeError)
      return
    }

    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  return (
    <div className="mt-11 w-[314px]">
      <div className="flex h-[400px] flex-col items-center rounded-3xl bg-white">
        <div
          onClick={handleSelect}
          className="relative mb-[46px] mt-[35px] flex h-[163px] w-[163px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-violet-400 transition hover:bg-violet-50"
        >
          {preview ? (
            <img
              src={preview}
              alt={copy.previewAlt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <Camera className="mb-2 text-violet-500" />
              <span className="text-sm text-gray-500">{copy.addImage}</span>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/png, image/jpeg"
            className="hidden"
            onChange={handleChange}
          />
        </div>

        <div className="space-y-5 text-center">
          <p className="text-sm">
            <span className="text-gray-500">{copy.recommendedFormat}</span>
            <br />
            JPG, JPEG, PNG
          </p>

          <p className="text-sm">
            <span className="text-gray-500">{copy.maximumSize}</span>
            <br />
            {MAX_SIZE_MB}MB
          </p>
        </div>
      </div>

      <Button className="mt-[38px] h-[44px] w-full bg-[#2187BF] text-white hover:bg-[#1b6f9d]">
        {copy.addEmployee}
      </Button>
    </div>
  )
}

export default Rasm
