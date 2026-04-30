import type { ActiveCard } from "../../data/types"
import { cx } from "../../ui/cx"
import { cardBase, cardHeader, titleText, innerBox, subText } from "../../ui/theme"

/**
 * ✅ ActiveCardsCard
 * Qayerga tegishli:
 * - src/pages/moliya/Dashboard/blocks/ActiveCardsCard.tsx
 *
 * Vazifasi:
 * - Aktiv kartalar blokini ko‘rsatadi
 * - 1ta asosiy karta + pastda kichik info
 *
 * Dizayn:
 * - light card
 * - ichida "innerBox" (soddaroq premium)
 */
export default function ActiveCardsCard({ cards }: { cards: ActiveCard[] }) {
  const c = cards?.[0]

  return (
    <div className={cx(cardBase, "p-4")}>
      <div className={cardHeader}>
        <div className={titleText}>Aktiv kartalar</div>
        <button
          className="ml-auto text-[11px] font-bold text-slate-500 hover:text-slate-700"
          type="button"
        >
          hammasi
        </button>
      </div>

      {c ? (
        <div className={cx("mt-3 p-3", innerBox)}>
          <div className="flex items-center">
            <div className="text-xs font-bold text-slate-700">{c.name}</div>
            <div className="ml-auto text-xs font-semibold text-slate-500">{c.brand}</div>
          </div>
          <div className="mt-2 text-lg font-extrabold text-slate-900">${c.balance.toFixed(2)}</div>
          <div className="mt-1 text-[11px] text-slate-500">{c.masked}</div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-500">Karta yo‘q</div>
      )}

      {cards?.[1] && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>{cards[1].name}</span>
          <span>{cards[1].masked}</span>
        </div>
      )}

      <div className={cx("mt-3", subText)}>Maslahat: keyin backend’dan kartalar ro‘yxatini ulab qo‘yamiz.</div>
    </div>
  )
}
