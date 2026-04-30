export type ProductionStatus = "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED"

export type LookupOption = {
  id: number
  name: string
  warehouse_id?: number
}

export type ChoiceOption = {
  value: string
  label: string
}

export type ProductionFilters = {
  status: "ALL" | ProductionStatus
  product: number | "ALL"
  location: number | "ALL"
  search: string
  dateFrom?: string
  dateTo?: string
}

export type ProductionConsumptionInput = {
  raw_material: number | ""
  qty_used: string
}

export type ProductionConsumption = {
  id: number | string
  raw_material: number | null
  raw_material_name?: string | null
  qty_used: string
  uom_name?: string | null
  unit_cost: number | null
  total_cost: number | null
  currency?: string | null
}

export type ProductionBatch = {
  id: number
  batch_no: string
  status: ProductionStatus
  product: number | null
  product_name: string
  recipe: number | null
  recipe_name?: string | null
  qty_produced: string
  qty_actual: string
  qty_waste: string
  production_date: string
  location: number | null
  location_name: string
  output_location: number | null
  output_location_name: string
  waste_location: number | null
  waste_location_name: string | null
  notes: string
  materials_cost_total: number
  extra_cost_total: number
  total_cost: number
  unit_cost: number
  currency: string
  confirmed_at: string | null
  started_at: string | null
  done_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type ProductionDetail = ProductionBatch & {
  consumptions: ProductionConsumption[]
  cancel_reason: string | null
}

export type ProductionPreviewMissing = {
  raw_material: number | null
  raw_material_name: string
  qty_required: string
  qty_available: string
  shortfall: string
}

export type ProductionPreview = {
  can_confirm: boolean
  missing: ProductionPreviewMissing[]
  materials_cost_estimate: number
  extra_cost_total: number
  total_cost_estimate: number
  unit_cost_estimate: number
}

export type ProductionFormData = {
  product: number | ""
  recipe: number | ""
  qty_produced: string
  production_date: string
  location: number | ""
  output_location: number | ""
  notes: string
  extra_cost_total: string
  currency: string
}

export type ProductionCreatePayload = {
  product: number
  recipe?: number
  qty_produced: string
  production_date?: string
  location?: number
  output_location?: number
  notes?: string
  extra_cost_total?: number
  currency?: string
}

export type ProductionUpdatePayload = Partial<ProductionCreatePayload>

export type ProductionDonePayload = {
  qty_actual?: string
  qty_waste?: string
  waste_location?: number
}

export type ProductionCancelPayload = {
  reason?: string
}

export type ProductionMeta = {
  status_choices: ChoiceOption[]
  currency_choices: ChoiceOption[]
}
