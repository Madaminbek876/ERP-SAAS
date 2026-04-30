import { useEffect, useMemo, useState, type DependencyList } from "react"

export function useClientPagination<T>(items: T[], pageSize: number, resetDeps: DependencyList = []) {
  const [page, setPage] = useState(1)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / pageSize)), [items.length, pageSize])

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), totalPages))
  }, [totalPages])

  useEffect(() => {
    setPage(1)
  }, resetDeps)

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return {
    page,
    setPage,
    totalPages,
    pagedItems,
  }
}
