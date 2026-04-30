import React, { useEffect, useRef } from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { Slide, ToastContainer, toast, type ToastContent, type ToastOptions } from "react-toastify"

import "@/index.css"
import { I18nProvider, useI18n } from "@/i18n"
import { router } from "@/routes"
import "react-toastify/dist/ReactToastify.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

let adaptiveToastInstalled = false

function extractToastText(content: ToastContent<unknown>): string {
  if (content === null || content === undefined || typeof content === "boolean") return ""
  if (typeof content === "string" || typeof content === "number") return String(content)
  if (Array.isArray(content)) return content.map((item) => extractToastText(item as ToastContent<unknown>)).join(" ")

  if (React.isValidElement(content)) {
    return extractToastText((content.props as { children?: React.ReactNode } | null)?.children as ToastContent<unknown>)
  }

  return ""
}

function getAdaptiveAutoClose(
  content: ToastContent<unknown>,
  options?: ToastOptions<unknown>
): ToastOptions<unknown>["autoClose"] {
  if (options?.autoClose === false || typeof options?.autoClose === "number") return options.autoClose

  const text = extractToastText(content).trim()
  if (!text) return 2400

  const nextDuration = 1800 + text.length * 32
  return Math.min(9000, Math.max(2400, nextDuration))
}

function withAdaptiveToastOptions<TData = unknown>(
  content: ToastContent<TData>,
  options?: ToastOptions<TData>
): ToastOptions<TData> | undefined {
  const autoClose = getAdaptiveAutoClose(content as ToastContent<unknown>, options as ToastOptions<unknown> | undefined)
  if (autoClose === undefined) return options
  return { ...options, autoClose }
}

function installAdaptiveToastBehavior() {
  if (adaptiveToastInstalled) return
  adaptiveToastInstalled = true

  const toastApi = toast as typeof toast & {
    success: typeof toast.success
    error: typeof toast.error
    info: typeof toast.info
    warning: typeof toast.warning
  }

  const originalSuccess = toast.success.bind(toast)
  const originalError = toast.error.bind(toast)
  const originalInfo = toast.info.bind(toast)
  const originalWarning = toast.warning.bind(toast)

  toastApi.success = ((content, options) => originalSuccess(content, withAdaptiveToastOptions(content, options))) as typeof toast.success
  toastApi.error = ((content, options) => originalError(content, withAdaptiveToastOptions(content, options))) as typeof toast.error
  toastApi.info = ((content, options) => originalInfo(content, withAdaptiveToastOptions(content, options))) as typeof toast.info
  toastApi.warning = ((content, options) => originalWarning(content, withAdaptiveToastOptions(content, options))) as typeof toast.warning
}

installAdaptiveToastBehavior()

function AppShell() {
  const { language } = useI18n()
  const queryClient = useQueryClient()
  const previousLanguage = useRef(language)

  useEffect(() => {
    if (previousLanguage.current === language) return

    previousLanguage.current = language
    void queryClient.invalidateQueries()
  }, [language, queryClient])

  return (
    <>
      <RouterProvider key={language} router={router} />
      <ToastContainer
        position="top-center"
        autoClose={2400}
        newestOnTop
        transition={Slide}
        hideProgressBar={false}
        closeButton={false}
        pauseOnHover
        style={{
          width: "fit-content",
          maxWidth: "min(92vw, 720px)",
          paddingInline: "12px",
        }}
        toastClassName="lux-toast"
        progressClassName="lux-toast-progress"
      />
    </>
  )
}

const app = (
  <I18nProvider>
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  </I18nProvider>
)

ReactDOM.createRoot(document.getElementById("root")!).render(
  import.meta.env.DEV ? app : <React.StrictMode>{app}</React.StrictMode>
)
