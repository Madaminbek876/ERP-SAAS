type Props = {
  // Karta sarlavhasi
  title: string;

  // Katta qilib ko‘rsatiladigan qiymat (raqam yoki matn)
  big: string;

  // Pastdagi badge matni
  badgeText: string;

  // Badge turi: xavfli (qizil) yoki oddiy
  badgeType?: "danger" | "neutral";

  // O‘ng tomonda ko‘rsatiladigan ikonka (emoji)
  icon?: string;
};

export default function MiniInfoCard({
  title,
  big,
  badgeText,
  badgeType = "neutral", // default holat
  icon = "⚠️",           // default ikonka
}: Props) {
  // Badge rangini aniqlash
  const badge =
    badgeType === "danger"
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
      {/* Sarlavha va ikonka */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-700">
          {title}
        </div>
        <div className="text-slate-500 text-sm">
          {icon}
        </div>
      </div>

      {/* Katta qiymat */}
      <div className="mt-3 text-3xl font-extrabold text-slate-900">
        {big}
      </div>

      {/* Holat badge */}
      <div className="mt-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${badge}`}
        >
          {badgeText}
        </span>
      </div>
    </div>
  );
}
