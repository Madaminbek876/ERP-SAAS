// src/pages/Dashboard/api/mock.ts
import type { ChartPoint, OverviewSummaryResponse, RecentRow } from "./types"

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// =====================================================
// ✅ Demo "realga o‘xshashi" uchun kichik random jitter
// - har reload bo‘lganda KPI/series ozgina o‘zgaradi
// - UI sinmaydi, backend kelganda kerak bo‘lmaydi
// =====================================================
function seeded(seed: number) {
  // oddiy deterministic random (0..1)
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function jitterInt(base: number, seed: number, pct = 0.06) {
  const r = seeded(seed) * 2 - 1 // -1..+1
  const v = Math.round(base * (1 + r * pct))
  return Math.max(0, v)
}

function jitterPct(base: number, seed: number, spread = 2.5) {
  const r = seeded(seed) * 2 - 1
  return Number((base + r * spread).toFixed(1))
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export const MOCK_ROWS: RecentRow[] = [
  { id: 1, name: "Yusuf-Latipov", qty: 5, amount: 250_000, date: todayISO(), type: "SALE" },
  { id: 2, name: "Madaminbek", qty: 2, amount: 180_000, date: todayISO(), type: "SALE" },
  { id: 3, name: "Kirim: Xomashyo", qty: 20, amount: 0, date: todayISO(), type: "MOVE_IN" },
  { id: 4, name: "Chiqim: Ombor", qty: 7, amount: 0, date: todayISO(), type: "MOVE_OUT" },
]

export function demoSalesSeries(range: "1W" | "1M" | "3M" | "1Y"): ChartPoint[] {
  const baseSeed = Math.floor(Date.now() / 60000) // har minutda ozgina o‘zgaradi

  let base: ChartPoint[] = []
  if (range === "1W") {
    base = [
      { label: "Du", value: 1200 },
      { label: "Se", value: 1600 },
      { label: "Cho", value: 900 },
      { label: "Pay", value: 2100 },
      { label: "Ju", value: 1800 },
      { label: "Sha", value: 2400 },
      { label: "Ya", value: 2000 },
    ]
  } else if (range === "3M") {
    base = [
      { label: "W1", value: 4200 },
      { label: "W2", value: 5100 },
      { label: "W3", value: 4800 },
      { label: "W4", value: 5600 },
      { label: "W5", value: 5300 },
      { label: "W6", value: 6100 },
    ]
  } else if (range === "1Y") {
    base = [
      { label: "Yan", value: 8200 },
      { label: "Fev", value: 9150 },
      { label: "Mar", value: 8750 },
      { label: "Apr", value: 9400 },
      { label: "May", value: 10200 },
      { label: "Iyun", value: 9800 },
      { label: "Iyul", value: 11050 },
      { label: "Avg", value: 10700 },
      { label: "Sen", value: 11400 },
      { label: "Okt", value: 12100 },
      { label: "Noy", value: 11850 },
      { label: "Dek", value: 12500 },
    ]
  } else {
    base = [
      { label: "01", value: 900 },
      { label: "05", value: 1300 },
      { label: "10", value: 1100 },
      { label: "15", value: 1700 },
      { label: "20", value: 1600 },
      { label: "25", value: 1900 },
      { label: "30", value: 2200 },
    ]
  }

  // ✅ jitter
  return base.map((p, i) => ({
    ...p,
    value: jitterInt(p.value, baseSeed + i * 17, 0.07),
  }))
}

export function demoSkladSeries(range: "1W" | "1M" | "3M" | "1Y"): ChartPoint[] {
  // ombor trend demo (sales’dan kichikroq)
  const base = demoSalesSeries(range).map((p) => ({
    ...p,
    value: Math.max(0, Math.round(p.value * 0.35)),
  }))
  return base
}

export function buildOverviewDemo(): OverviewSummaryResponse {
  const seed = Math.floor(Date.now() / 60000)

  // ✅ demo KPI sonlari ham ozgina o‘zgaradi
  const todaySales = jitterInt(1_250_000, seed + 1, 0.08)
  const todayProfit = jitterInt(320_000, seed + 2, 0.10)
  const monthSales = jitterInt(28_760_000, seed + 3, 0.05)

  const d1 = jitterPct(12.8, seed + 11, 2.2)
  const d2 = jitterPct(6.2, seed + 12, 2.0)
  const d3 = jitterPct(19.2, seed + 13, 2.8)
  const d4 = jitterPct(-2.1, seed + 14, 1.8)

  return {
    salesKpis: [
      { title: "Bugungi sotuv", value: todaySales.toLocaleString("uz-UZ"), sub: "so‘m", icon: "💳", tone: "success", deltaPercent: d1 },
      { title: "Bugungi daromad", value: todayProfit.toLocaleString("uz-UZ"), sub: "so‘m", icon: "💰", tone: "success", deltaPercent: d2 },
      { title: "Oylik sotuv", value: monthSales.toLocaleString("uz-UZ"), sub: "so‘m", icon: "📈", tone: "neutral", deltaPercent: d3 },
      { title: "Chegirma ta’siri", value: "—", sub: "demo", icon: "🏷️", tone: "neutral", deltaPercent: d4 },
    ],

    // ✅ sklad demo (warehouse ulanmasa fallback)
    skladKpis: [
      { title: "Omborda mahsulot", value: jitterInt(8450, seed + 21, 0.05).toLocaleString("uz-UZ"), sub: "dona", icon: "📦", tone: "neutral", deltaPercent: jitterPct(4.1, seed + 31, 1.2) },
      { title: "Bugun kirim", value: jitterInt(18, seed + 22, 0.25), sub: "pozitsiya", icon: "⬇️", tone: "success", deltaPercent: jitterPct(2.0, seed + 32, 1.4) },
      { title: "Bugun chiqim", value: jitterInt(5, seed + 23, 0.35), sub: "pozitsiya", icon: "⬆️", tone: "danger", deltaPercent: jitterPct(-1.2, seed + 33, 1.2) },
      { title: "Kam qolganlar", value: jitterInt(12, seed + 24, 0.22), sub: "diqqat", icon: "🔔", tone: "danger", deltaPercent: jitterPct(3.4, seed + 34, 1.8) },
    ],

    salesSeries: demoSalesSeries("1M"),
    skladSeries: demoSkladSeries("1M"),
    rows: MOCK_ROWS,
  }
}
