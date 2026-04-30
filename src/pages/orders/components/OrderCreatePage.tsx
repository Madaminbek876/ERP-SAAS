import { Link, useNavigate } from "react-router-dom"
import OrderCreateDialog from "@/pages/orders/components/OrderCreateDialog"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n"

export default function OrderCreatePage() {
  const nav = useNavigate()
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          title: "Новый заказ",
          subtitle: "Создание заказа на отдельной странице",
          back: "Назад",
          info: "Нажмите “Open form”, чтобы создать заказ.",
        }
      : language === "en"
        ? {
            title: "New order",
            subtitle: "Create an order on a separate page",
            back: "Back",
            info: "Click “Open form” to create an order.",
          }
        : {
            title: "Yangi buyurtma",
            subtitle: "Alohida sahifada order yaratish",
            back: "Orqaga",
            info: "Order yaratish uchun “Open form” ni bosing.",
          }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xl font-semibold">{copy.title}</div>
          <div className="text-sm text-muted-foreground">{copy.subtitle}</div>
        </div>
        <Link to="/sotuv/orders">
          <Button variant="outline">{copy.back}</Button>
        </Link>
      </div>

      <div className="rounded-md border p-4">
        <div className="mb-3 text-sm text-muted-foreground">{copy.info}</div>
        <OrderCreateDialog onSuccess={() => nav("/sotuv/orders")} />
      </div>
    </div>
  )
}
