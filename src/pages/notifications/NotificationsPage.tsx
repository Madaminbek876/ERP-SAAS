import { Bell, ShoppingBag } from "lucide-react"
import { Link } from "react-router-dom"

export default function NotificationsPage() {
  const items = [
    {
      id: "orders",
      title: "Buyurtmalar",
      description: "Faol va yangi buyurtmalar sahifasiga o'tish.",
      to: "/sotuv/orders",
      icon: <ShoppingBag className="h-5 w-5" />,
    },
  ]

  return (
    <div className="min-h-[560px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f6f9ff_32%,#edf3ff_62%,#e7eefb_100%)] p-6">
      <div className="rounded-[30px] border border-[#d8e3f5] bg-white/85 p-6 shadow-[0_28px_70px_-54px_rgba(37,65,168,0.32)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#3158ef_0%,#2948c5_52%,#21399a_100%)] text-white shadow-[0_18px_36px_rgba(37,65,168,0.24)]">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[28px] font-black tracking-tight text-[#1f2f4d]">Notifications</div>
            <div className="mt-1 text-sm text-[#70809e]">Bell icon bosilganda shu sahifa ochiladi. Hozircha asosiy shortcutlar shu yerda turadi.</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="group rounded-[24px] border border-[#dbe5f7] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_46px_-34px_rgba(15,23,42,0.22)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#eef4ff] text-[#315ccb]">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-[#1f2f4d]">{item.title}</div>
                  <div className="mt-1 text-sm text-[#70809e]">{item.description}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
