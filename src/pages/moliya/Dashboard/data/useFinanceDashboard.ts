import { useEffect, useMemo, useState } from "react"
import { adaptFinanceDashboard, ensureModel } from "./adapter"
import type { FinanceDashboardModel } from "./types"
import { financeApi, type FinanceDashboardQuery, type FinanceDashboardResponse } from "./financeApi"
import { financeEvents } from "../../shared/events"

type UiState = "idle" | "loading" | "error" | "success"

export function useFinanceDashboard(query: FinanceDashboardQuery) {
  const [ui, setUi] = useState<UiState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState<FinanceDashboardResponse | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const unsubscribe = financeEvents.subscribe(() => {
      setReloadKey((key) => key + 1)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setUi("loading")
        setError(null)

        const data = await financeApi.getDashboard(query)
        if (cancelled) return

        setRaw(data ?? null)
        setUi("success")
      } catch (e: any) {
        if (cancelled) return
        setUi("error")
        setError(e?.message || "Failed to load finance dashboard")
        setRaw(null)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [query.range, query.search, reloadKey])

  const model: FinanceDashboardModel = useMemo(() => {
    const adapted = adaptFinanceDashboard(raw)
    return ensureModel(adapted)
  }, [raw])

  function retry() {
    setReloadKey((k) => k + 1)
  }

  return {
    ui,
    error,
    model,
    raw,
    retry,
    hasBackend: !!raw,
  }
}
