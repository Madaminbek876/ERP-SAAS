import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/i18n"

export default function PurchaseTabs({
  itemsTab,
  paymentsTab,
}: {
  itemsTab: React.ReactNode
  paymentsTab: React.ReactNode
}) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? { items: "Позиции", payments: "Платежи" }
      : language === "en"
        ? { items: "Items", payments: "Payments" }
        : { items: "Pozitsiyalar", payments: "To'lovlar" }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Tabs defaultValue="items">
        <div className="border-b border-slate-100 p-3">
          <TabsList className="w-full justify-start gap-2 rounded-xl bg-slate-50 p-1">
            <TabsTrigger value="items" className="!h-10 !flex-1 cursor-pointer rounded-md border border-slate-300 bg-white px-6 py-2 text-base font-semibold text-black shadow-lg">
              {copy.items}
            </TabsTrigger>
            <TabsTrigger value="payments" className="!h-10 !flex-1 cursor-pointer rounded-md border border-slate-300 bg-white px-6 py-2 text-base font-semibold text-black shadow-lg">
              {copy.payments}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="items" className="mt-0">
          {itemsTab}
        </TabsContent>

        <TabsContent value="payments" className="mt-0">
          {paymentsTab}
        </TabsContent>
      </Tabs>
    </div>
  )
}
