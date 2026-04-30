export type MovementType = "IN" | "OUT" | "RETURN" | "WASTE" | "ADJUST" | string

export type MovementItem = {
  id: number | string
  type: MovementType
  movement_type?: MovementType
  item_type?: string
  item_id?: number
  itemName: string
  location?: number
  location_name?: string
  from_location?: number
  to_location?: number
  from_location_name?: string
  to_location_name?: string
  qty: number
  unit_cost?: number
  total: number
  currency?: string
  ref_type?: string
  ref_id?: number | null
  date: string
  note?: string
}

export type StockOnHandItem = {
  id: number | string
  item_name: string
  item_type: string
  qty_onhand: number
  value_onhand: number
  avg_unit_cost: number
  currency?: string
  location?: number
  location_name?: string
  product?: number
  product_name?: string
  raw_material?: number
  raw_material_name?: string
  balance_qty?: string
}

export type OverviewSummary = {
  total_items: number
  total_qty: number
  total_value: number
  low_stock_count: number
  today?: string
  movements_today?: {
    in_qty: number
    out_qty: number
  }
}

export type AlertItem = {
  id: string | number
  title: string
  message: string
}

export type StockMetaChoice = {
  value: string
  label: string
}

export type WarehouseStockMeta = {
  item_type_choices: StockMetaChoice[]
  movement_type_choices: StockMetaChoice[]
}

export type LookupItem = {
  id: number
  name: string
  category_name?: string | null
  material_type_name?: string | null
}

export type WarehouseAction =
  | "issue"
  | "receipt"
  | "return"
  | "transfer"
  | "waste"
  | "adjust"
  | "waste-adjust"
