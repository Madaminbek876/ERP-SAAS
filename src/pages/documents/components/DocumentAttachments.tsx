import type { DocumentItem } from "../types/documents.types";

type Props = { doc: DocumentItem };

export default function DocumentAttachments({ doc }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Fayllar</div>
          <div className="text-xs text-slate-500">PDF/JPG/PNG/DOCX</div>
        </div>

        <label className="rounded-2xl px-3 py-2 text-xs font-semibold bg-slate-900 text-white cursor-pointer">
          + Fayl yuklash
          <input
            type="file"
            className="hidden"
            multiple
            onChange={() => {
              // MOCK: backend bo‘lganda upload endpointga yuborasiz
              alert("Upload: backendga ulaysiz (mock rejim)");
            }}
          />
        </label>
      </div>

      <div className="mt-3 space-y-2">
        {doc.attachments.length === 0 ? (
          <div className="text-sm text-slate-500">Fayl yo‘q</div>
        ) : (
          doc.attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{a.name}</div>
                <div className="text-xs text-slate-500">{a.mime} • {(a.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                className="rounded-2xl px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50"
                onClick={() => alert("Download: backend url bo‘lsa ochiladi")}
              >
                Ochish
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
