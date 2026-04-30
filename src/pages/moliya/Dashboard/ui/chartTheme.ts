
/**
 * ✅ chartTheme.ts
 * Qayerga tegishli:
 * - src/pages/moliya/Dashboard/ui/chartTheme.ts
 *
 * Vazifasi:
 * - Grafiklar uchun premium 2 ta asosiy rang:
 *   1) Kirim (income)
 *   2) Xarajat (expense)
 *
 * Eslatma:
 * - Demo ham ishlaydi
 * - Backend ulanganda ham shu theme saqlanadi
 */
export const chartTheme = {
  income: {
    stroke: "#2563eb", // blue-600 (premium)
    fill: "rgba(37, 99, 235, 0.14)",
    bar: "rgba(37, 99, 235, 0.75)",
  },
  expense: {
    stroke: "#7c3aed", // violet-600 (premium)
    fill: "rgba(124, 58, 237, 0.14)",
    bar: "rgba(124, 58, 237, 0.75)",
  },
  axis: "#64748b", // slate-500
  grid: "rgba(148,163,184,.35)", // slate-400/35
}
