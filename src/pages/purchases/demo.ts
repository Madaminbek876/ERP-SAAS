import type { PageResponse, PurchaseDetail, PurchaseListItem } from "./types"

export const DEMO_PURCHASES_LIST: PageResponse<PurchaseListItem> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
}

export const DEMO_PURCHASES_DETAIL: Record<number, PurchaseDetail> = {}
