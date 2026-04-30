/* ===============================
   📊 CHART
   =============================== */

export type ChartRange = "1W" | "1M" | "3M" | "1Y";

export type ChartPoint = {
  label: string;
  value: number;
};

export type SalesSeriesResponse = {
  range: ChartRange;
  series: ChartPoint[];
};

/* ===============================
   📌 FILTER (Bugun / Hafta / Oy)
   =============================== */

export type FilterRange = "today" | "week" | "month";

export type DashboardFilter = {
  range: FilterRange;
  date: string; // YYYY-MM-DD
};

/* ===============================
   📦 STAT CARDS
   =============================== */

export type StatItem = {
  title: string;
  value: string;
  sub: string;
  icon?: string;
  tone?: "neutral" | "success" | "danger";
};

export type DashboardSummaryResponse = {
  stats: StatItem[];
  lowStockWarnings: number;
  unpaidOrders: number;
};

/* ===============================
   🧾 RECENT SALES TABLE
   =============================== */

export type RecentSaleRow = {
  id: number | string;
  name: string;
  soni: number;
  narxi: number;
  data: string; // YYYY-MM-DD
};

export type RecentSalesQuery = {
  page: number;
  pageSize: number;

  q?: string;
  sortKey?: "name" | "soni" | "narxi" | "data";
  sortDir?: "asc" | "desc";

  // ✅ FILTER BAR dan keladi
  range?: FilterRange;
  date?: string;
};

export type Paginated<T> = {
  rows: T[];
  totalCount: number;
};
