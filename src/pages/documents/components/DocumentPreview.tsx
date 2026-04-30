import type { DocumentItem } from "../types/documents.types";
import { docTypeLabel } from "../utils/documents.utils";

type Props = { doc: DocumentItem };

export default function DocumentPreview({ doc }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Preview</div>
          <div className="text-xs text-slate-500">Print uchun tayyor ko‘rinish</div>
        </div>
        <button
          className="rounded-2xl px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-800">
        <div className="text-xs text-slate-500">Hujjat</div>
        <div className="text-lg font-semibold">{doc.number}</div>
        <div className="text-sm">{docTypeLabel[doc.type]} • {doc.title}</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><span className="text-slate-500">Sana:</span> <span className="font-semibold">{doc.date}</span></div>
          <div><span className="text-slate-500">Kontragent:</span> <span className="font-semibold">{doc.kontragentName ?? "-"}</span></div>
          <div><span className="text-slate-500">Reference:</span> <span className="font-semibold">{doc.refType ? `${doc.refType} ${doc.refId ?? ""}` : "-"}</span></div>
          <div><span className="text-slate-500">Summa:</span> <span className="font-semibold">{doc.amount ? `${doc.amount.toLocaleString()} ${doc.currency ?? "UZS"}` : "-"}</span></div>
        </div>
        {doc.note ? <div className="mt-3"><span className="text-slate-500">Izoh:</span> {doc.note}</div> : null}
      </div>
    </div>
  );
}
