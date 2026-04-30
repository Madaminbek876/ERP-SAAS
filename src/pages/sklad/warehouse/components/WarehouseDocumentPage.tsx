import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type BadgeTone = "slate" | "blue" | "emerald" | "amber" | "rose" | "violet"

export type WarehouseDocumentPageBadge = {
  label: string
  tone?: BadgeTone
}

export type WarehouseDocumentPageAction = {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: "primary" | "secondary" | "outline" | "danger"
}

export type WarehouseDocumentPageField = {
  label: string
  value: ReactNode
  columnSpan?: 1 | 2
  multiline?: boolean
}

export type WarehouseDocumentPageTab = {
  key: string
  label: string
  content: ReactNode
}

const badgeToneClass: Record<BadgeTone, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
}

function actionClass(variant: WarehouseDocumentPageAction["variant"]) {
  if (variant === "outline") {
    return "rounded-2xl border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
  }
  if (variant === "secondary") {
    return "!bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-2xl"
  }
  if (variant === "danger") {
    return "rounded-2xl"
  }
  return "bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-2xl"
}

export default function WarehouseDocumentPage({
  title,
  badges = [],
  summary = [],
  actions = [],
  leftTitle,
  fields,
  tabs,
  loading,
  loadingLabel = "Yuklanmoqda...",
  error,
}: {
  title: string
  badges?: WarehouseDocumentPageBadge[]
  summary?: ReactNode[]
  actions?: WarehouseDocumentPageAction[]
  leftTitle: string
  fields: WarehouseDocumentPageField[]
  tabs: WarehouseDocumentPageTab[]
  loading?: boolean
  loadingLabel?: string
  error?: string
}) {
  const defaultTab = tabs[0]?.key ?? "tab"

  return (
    <div className="p-6">
      <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur">
        <div className="p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
                  {badges.map((badge) => (
                    <span
                      key={`${badge.label}-${badge.tone ?? "slate"}`}
                      className={[
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                        badgeToneClass[badge.tone ?? "slate"],
                      ].join(" ")}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>

                {summary.length > 0 ? (
                  <div className="mt-2 text-xs text-slate-500">
                    {summary.map((item, index) => (
                      <span key={`summary-${index}`}>
                        {index > 0 ? " | " : ""}
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {actions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {actions.map((action) => (
                    <Button
                      key={`${action.label}-${action.variant ?? "primary"}`}
                      variant={action.variant === "danger" ? "destructive" : "outline"}
                      className={actionClass(action.variant)}
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="h-px bg-slate-200" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">{leftTitle}</div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {fields.map((field, index) => (
                    <div
                      key={`${field.label}-${index}`}
                      className={field.columnSpan === 2 ? "md:col-span-2" : undefined}
                    >
                      <div className="text-xs text-slate-500">{field.label}</div>
                      <div
                        className={[
                          "mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
                          field.multiline ? "min-h-[96px] whitespace-pre-wrap" : "min-h-[42px]",
                        ].join(" ")}
                      >
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <Tabs defaultValue={defaultTab}>
                  <div className="border-b border-slate-100 p-3">
                    <TabsList className="w-full justify-start gap-2 rounded-xl bg-slate-50 p-1">
                      {tabs.map((tab) => (
                        <TabsTrigger
                          key={tab.key}
                          value={tab.key}
                          className="!h-10 !flex-1 cursor-pointer rounded-md border border-slate-300 bg-white px-6 py-2 text-base font-semibold text-black shadow-lg"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {error ? <div className="mx-4 mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
                  {loading ? <div className="px-4 py-4 text-sm text-slate-500">{loadingLabel}</div> : null}

                  {tabs.map((tab) => (
                    <TabsContent key={tab.key} value={tab.key} className="mt-0">
                      {tab.content}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
