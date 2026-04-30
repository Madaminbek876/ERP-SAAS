type Props = {
  // Karta sarlavhasi (masalan: "Jami sotuvlar")
  title: string;

  // Asosiy qiymat (raqam yoki matn)
  value: string | number;

  // Pastdagi izoh (masalan: "+12% o'tgan oyga nisbatan")
  sub: string;

  // Ixtiyoriy ikonka (emoji yoki icon)
  icon?: string;

  // Ixtiyoriy rang holati
  tone?: "neutral" | "success" | "danger";
};

export default function StatCard({
  title,
  value,
  sub,
  icon = "📊",
  tone = "neutral",
}: Props) {
  const toneStyles =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
      ? "text-red-600"
      : "text-slate-900";

  return (
    <div className="lux-motion-surface relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      {/* Icon */}
      <div className="absolute top-3 right-3 text-slate-400 text-lg">
        {icon}
      </div>

      {/* Title */}
      <div className="text-xs font-semibold text-slate-500">
        {title}
      </div>

      {/* Value */}
      <div className={`mt-2 text-2xl font-extrabold ${toneStyles}`}>
        {value}
      </div>

      {/* Sub text */}
      <div className="mt-1 text-xs text-slate-500">
        {sub}
      </div>
    </div>
  );
}
