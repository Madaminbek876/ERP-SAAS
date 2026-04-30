import { getCurrentLocale, localizeText } from "@/i18n"
import type { DocumentItem } from "../types/documents.types"
import { docStatusLabel, docTypeLabel } from "./documents.utils"

export function openPrintWindow(doc: DocumentItem) {
  const locale = getCurrentLocale()
  const printLabel = localizeText("Print")
  const dateLabel = localizeText("Sana")
  const titleLabel = localizeText("Sarlavha")
  const counterpartyLabel = localizeText("Kontragent")
  const referenceLabel = localizeText("Reference")
  const amountLabel = localizeText("Summa")
  const responsibleLabel = localizeText("Mas'ul")
  const noteLabel = localizeText("Izoh")
  const managerLabel = localizeText("Rahbar / Mas'ul")
  const recipientLabel = localizeText("Qabul qiluvchi")
  const signatureLabel = localizeText("Imzo / Pechat")
  const typeLabel = localizeText(docTypeLabel[doc.type])
  const statusLabel = localizeText(docStatusLabel[doc.status])
  const amountValue = doc.amount ? `${Number(doc.amount).toLocaleString(locale)} ${doc.currency ?? "UZS"}` : "-"

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${doc.number} - ${printLabel}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
    .wrap { max-width: 820px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
    .h1 { font-size: 20px; font-weight: 800; margin: 0; }
    .muted { color:#64748b; font-size: 12px; margin-top: 6px; }
    .badge { display:inline-block; padding: 6px 10px; border-radius: 999px; border: 1px solid #e2e8f0; font-weight:700; font-size:12px; }
    .grid { margin-top: 16px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .box { border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; }
    .lbl { font-size: 11px; color:#64748b; }
    .val { font-size: 14px; font-weight: 700; margin-top: 6px; }
    .note { margin-top: 16px; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 12px; }
    .sign { margin-top: 28px; display:grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .line { margin-top: 40px; border-top: 1px solid #94a3b8; }
    .signbox { font-size: 12px; color:#334155; }
    @media print {
      body { padding: 0; }
      .wrap { border: none; }
      .note { border-style: solid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <p class="h1">${typeLabel} - ${doc.number}</p>
        <div class="muted">${dateLabel}: ${doc.date}</div>
        <div class="muted">${titleLabel}: ${escapeHtml(doc.title || "-")}</div>
      </div>
      <span class="badge">${statusLabel}</span>
    </div>

    <div class="grid">
      <div class="box">
        <div class="lbl">${counterpartyLabel}</div>
        <div class="val">${escapeHtml(doc.kontragentName || "-")}</div>
      </div>
      <div class="box">
        <div class="lbl">${referenceLabel}</div>
        <div class="val">${escapeHtml(doc.refType ? `${doc.refType}: ${doc.refId ?? "-"}` : "-")}</div>
      </div>
      <div class="box">
        <div class="lbl">${amountLabel}</div>
        <div class="val">${amountValue}</div>
      </div>
      <div class="box">
        <div class="lbl">${responsibleLabel}</div>
        <div class="val">${escapeHtml(doc.createdBy || "-")}</div>
      </div>
    </div>

    <div class="note">
      <div class="lbl">${noteLabel}</div>
      <div class="val" style="font-weight:600;">${escapeHtml(doc.note || "-")}</div>
    </div>

    <div class="sign">
      <div class="signbox">
        ${managerLabel}: ______________________
        <div class="line"></div>
        ${signatureLabel}
      </div>
      <div class="signbox">
        ${recipientLabel}: ______________________
        <div class="line"></div>
        ${signatureLabel}
      </div>
    </div>
  </div>

  <script>
    window.onload = () => window.print();
  </script>
</body>
</html>
  `.trim()

  const w = window.open("", "_blank", "width=920,height=720")
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
