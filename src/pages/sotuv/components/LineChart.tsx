import { useMemo } from "react";

type Point = { label: string; value: number };

type Props = {
  // Grafik chiziladigan data (label + value)
  data: Point[];
  // Grafik balandligi (px). Default: 220
  height?: number;
};

export default function LineChart({ data, height = 220 }: Props) {
  // SVG viewBox uchun doimiy kenglik
  const width = 640;

  // Grafik chetlaridan ichki bo‘sh joy (padding)
  const pad = 28;

  // data o‘zgarganda yoki height o‘zgarganda qayta hisoblaymiz
  const { points, minV, maxV } = useMemo(() => {
    // 1) hamma value'larni ajratib olamiz
    const values = data.map((d) => d.value);

    // 2) min/max qiymatlarni topamiz
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    // 3) X o‘qi bo‘yicha qadam: nuqtalar orasidagi masofa
    const xStep = (width - pad * 2) / Math.max(1, data.length - 1);

    // 4) value'ni SVG y koordinatasiga aylantiruvchi funksiya
    const norm = (v: number) => {
      // agar hamma value bir xil bo‘lsa, nuqtani o‘rtaga qo‘yamiz
      if (maxV === minV) return height / 2;

      // 0..1 oralig‘iga normalizatsiya
      const t = (v - minV) / (maxV - minV);

      // SVG'ning y o‘qi pastga o‘sadi, shuning uchun teskari chiqaramiz
      return height - pad - t * (height - pad * 2);
    };

    // 5) data dagi har bir element uchun x/y koordinatalarni yasaymiz
    const pts = data.map((d, i) => {
      const x = pad + i * xStep;
      const y = norm(d.value);
      return { x, y };
    });

    return { points: pts, minV, maxV };
  }, [data, height]);

  // Polyline uchun "x,y x,y x,y" ko‘rinishida string yasaymiz
  const poly = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Y o‘qi uchun 4 ta bo‘linma (natijada 5ta chiziq)
  const ticks = 4;

  // Har bir tick uchun: y koordinata + ko‘rsatiladigan raqam
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => {
    const t = i / ticks;

    // qiymat tepadan pastga kamayib borishi uchun (1 - t)
    const v = Math.round(minV + (maxV - minV) * (1 - t));

    // y koordinata pad dan boshlanib pastga tushadi
    const y = pad + t * (height - pad * 2);

    return { v, y };
  });

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[220px]"
        role="img"
        aria-label="Sotuv grafigi"
      >
        {/* GRID: gorizontal chiziqlar + chap tomonda raqamlar */}
        {tickValues.map((t, idx) => (
          <g key={idx}>
            <line
              x1={pad}
              x2={width - pad}
              y1={t.y}
              y2={t.y}
              stroke="rgba(15,23,42,0.08)"
              strokeWidth="1"
            />
            <text
              x={6}
              y={t.y + 4}
              fontSize="10"
              fill="rgba(15,23,42,0.55)"
              fontFamily="ui-sans-serif, system-ui"
            >
              {t.v}
            </text>
          </g>
        ))}

        {/* X LABELS: pastda label’lar (Jan, Feb, ...) */}
        {data.map((d, i) => {
          const xStep = (width - pad * 2) / Math.max(1, data.length - 1);
          const x = pad + i * xStep;
          return (
            <text
              key={d.label}
              x={x}
              y={height - 8}
              fontSize="10"
              fill="rgba(15,23,42,0.55)"
              textAnchor="middle"
              fontFamily="ui-sans-serif, system-ui"
            >
              {d.label}
            </text>
          );
        })}

        {/* CHIZIQ: nuqtalarni ulab beradigan polyline */}
        <polyline
          points={poly}
          fill="none"
          stroke="rgba(15,23,42,0.85)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* NUQTALAR: har bir data point uchun circle */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="3.2"
            fill="white"
            stroke="rgba(15,23,42,0.85)"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}
