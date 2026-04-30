export type UiState = "loading" | "empty" | "error" | "content";

type Props = {
  state: UiState;
  onChange: (s: UiState) => void;
};

// Tugma uslublari
const btnBase = "rounded-md px-3 py-1.5 text-xs font-medium border transition";
const active = "bg-orange-500 text-white border-orange-500";
const idle = "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";

export default function DashboardStateBar({ state, onChange }: Props) {
  // Dashboard holatini almashtirish uchun tugmalar ro‘yxati
  const items: { key: UiState; label: string }[] = [
    { key: "content", label: "Kontent (Content)" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          // Agar hozirgi state shu tugmaniki bo‘lsa, active rang bo‘ladi
          className={`${btnBase} ${state === i.key ? active : idle}`}
          // Tugma bosilganda parentdagi state o‘zgaradi
          onClick={() => onChange(i.key)}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
