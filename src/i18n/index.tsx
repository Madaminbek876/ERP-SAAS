import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import i18n from "i18next"
import { initReactI18next, useTranslation as useReactTranslation } from "react-i18next"
import { translateLooseText } from "./loose"
import { resources } from "./resources"
import { localizeDomTree } from "./domLocalization"

export { useTranslation } from "react-i18next"

export const LANGUAGE_STORAGE_KEY = "erp-language"

export type LanguageCode = "uz" | "ru" | "en"

type TranslationParams = Record<string, string | number | boolean | null | undefined>

const localeMap: Record<LanguageCode, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" }

export function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "uz"
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (saved === "uz" || saved === "ru" || saved === "en") return saved
  const browserLanguage = window.navigator.language.toLowerCase()
  if (browserLanguage.startsWith("ru")) return "ru"
  if (browserLanguage.startsWith("en")) return "en"
  return "uz"
}

const initialLanguage = getInitialLanguage()
let activeLanguage: LanguageCode = initialLanguage

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: "uz",
    supportedLngs: ["uz", "ru", "en"],
    defaultNS: "translation",
    ns: ["translation"],
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
    initImmediate: false,
  } as any)
}

export function getCurrentLocale() {
  return localeMap[activeLanguage]
}

export function getCurrentLanguage() {
  return activeLanguage
}

export function localizeText(value: string) {
  return translateLooseText(value, activeLanguage)
}

export function translate(key: string, fallback?: string, params?: TranslationParams) {
  return String(
    i18n.t(key, {
      ...params,
      lng: activeLanguage,
      defaultValue: fallback ?? key,
      ns: "translation",
    })
  )
}

type I18nContextValue = {
  language: LanguageCode
  setLanguage: (value: LanguageCode) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => getInitialLanguage())

  const setLanguage = useCallback((value: LanguageCode) => {
    activeLanguage = value
    setLanguageState((current) => (current === value ? current : value))
  }, [])

  useEffect(() => {
    activeLanguage = language
    if (typeof window === "undefined") return

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language

    if (i18n.resolvedLanguage !== language) {
      void i18n.changeLanguage(language)
    }
  }, [language])

  useEffect(() => {
    if (typeof window === "undefined") return

    const nativeAlert = window.alert.bind(window)
    const nativeConfirm = window.confirm.bind(window)
    const nativePrompt = window.prompt.bind(window)

    window.alert = ((message?: unknown) => nativeAlert(localizeText(String(message ?? "")))) as typeof window.alert
    window.confirm = ((message?: string) => nativeConfirm(localizeText(String(message ?? "")))) as typeof window.confirm
    window.prompt = ((message?: string, defaultValue?: string) =>
      nativePrompt(localizeText(String(message ?? "")), defaultValue)) as typeof window.prompt

    return () => {
      window.alert = nativeAlert as typeof window.alert
      window.confirm = nativeConfirm as typeof window.confirm
      window.prompt = nativePrompt as typeof window.prompt
    }
  }, [language])

  useEffect(() => {
    if (typeof window === "undefined") return

    const run = (root?: ParentNode | null) => {
      if (!root) return
      window.requestAnimationFrame(() => {
        localizeDomTree(root, language)
      })
    }

    run(document.body)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const parent = mutation.target.parentNode
          if (parent) run(parent)
          continue
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement || node instanceof DocumentFragment) {
            run(node)
          }
        })

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          run(mutation.target)
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "value"],
    })

    return () => observer.disconnect()
  }, [language])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
    }),
    [language, setLanguage]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used within I18nProvider")

  const { t: baseT } = useReactTranslation()

  const t = useMemo(
    () =>
      (key: string, fallback?: string, params?: TranslationParams) =>
        String(
          baseT(key, {
            ...params,
            defaultValue: fallback ?? key,
          })
        ),
    [baseT]
  )

  return useMemo(
    () => ({
      language: context.language,
      setLanguage: context.setLanguage,
      locale: localeMap[context.language],
      t,
    }),
    [context.language, context.setLanguage, t]
  )
}
