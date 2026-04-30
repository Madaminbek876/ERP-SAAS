function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function formatMoneyRu(value: number) {
  return Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function isZipBlob(blob: Blob) {
  return blob.slice(0, 4).arrayBuffer().then((buf) => {
    const b = new Uint8Array(buf)
    return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
  })
}

export async function downloadLedgerExportFile({
  data,
  contentType,
  baseName,
}: {
  data: BlobPart
  contentType?: string
  baseName: string
}) {
  const rawBlob = data instanceof Blob ? data : new Blob([data], { type: contentType || "application/octet-stream" })
  const ct = String(contentType || rawBlob.type || "").toLowerCase()

  const zip = await isZipBlob(rawBlob)
  if (zip || ct.includes("spreadsheetml") || ct.includes("excel")) {
    triggerDownload(rawBlob, `${baseName}.xlsx`)
    return
  }

  const text = await rawBlob.text()
  const normalized = text.replace(/\r\n/g, "\n")
  const firstLine = normalized.split("\n", 1)[0] || ""
  const looksLikeCsv = firstLine.includes(",") || ct.includes("csv") || ct.includes("text/plain")

  if (looksLikeCsv) {
    // RU/UZ locale spreadsheets usually split CSV by semicolon.
    const csvText = normalized.replace(/,/g, ";")
    const csvBlob = new Blob(["\uFEFF", csvText], { type: "text/csv;charset=utf-8;" })
    triggerDownload(csvBlob, `${baseName}.csv`)
    return
  }

  triggerDownload(rawBlob, `${baseName}.xlsx`)
}

export function downloadWarehouseDocumentTemplate({
  filename,
  title,
  docNumber,
  docDate,
  sender,
  receiver,
  currency,
  rows,
}: {
  filename: string
  title: string
  docNumber: string
  docDate: string
  sender: string
  receiver: string
  currency: string
  rows: Array<{
    name: string
    uom?: string
    qty: number
    price?: number
    total?: number
  }>
}) {
  const normalizedRows = rows.map((row) => {
    const qty = Number(row.qty || 0)
    const price = Number(row.price || 0)
    const total = Number.isFinite(Number(row.total)) ? Number(row.total) : qty * price
    return {
      ...row,
      qty,
      price,
      total,
    }
  })
  const grandTotal = normalizedRows.reduce((sum, row) => sum + Number(row.total || 0), 0)

  const bodyRows = normalizedRows
    .map(
      (row, index) => `
        <tr>
          <td class="cell center">${index + 1}</td>
          <td class="cell">${escapeHtml(row.name)}</td>
          <td class="cell center">${escapeHtml(row.uom || "шт.")}</td>
          <td class="cell center">${row.qty}</td>
          <td class="cell right">${row.price ? formatMoneyRu(row.price) : "-"}</td>
          <td class="cell right">${formatMoneyRu(row.total)}</td>
        </tr>
      `
    )
    .join("")

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #000; }
          .sheet { width: 1180px; margin: 0 auto; padding: 18px 20px 24px; }
          .title-wrap { width: 920px; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
          .title { font-size: 22px; font-weight: 700; line-height: 1.2; }
          .meta-table { width: 920px; border-collapse: collapse; margin-bottom: 14px; }
          .meta-label { width: 140px; padding: 8px 0; vertical-align: top; font-size: 15px; }
          .meta-value { padding: 8px 0; font-size: 15px; font-weight: 700; }
          .main-table { width: 920px; border-collapse: collapse; margin-top: 12px; }
          .cell { border: 1px solid #111827; padding: 4px 8px; font-size: 14px; }
          .head { font-weight: 700; text-align: center; }
          .center { text-align: center; }
          .right { text-align: right; }
          .summary { width: 920px; margin-top: 12px; font-size: 15px; }
          .amount-words { width: 920px; margin-top: 6px; font-size: 15px; font-weight: 700; }
          .sign-row { width: 920px; margin-top: 42px; display: flex; justify-content: space-between; gap: 40px; }
          .sign-box { width: 420px; }
          .sign-label { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
          .sign-line { border-bottom: 2px solid #111; height: 30px; }
          .note-block { width: 920px; margin-top: 38px; }
          .note-label { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
          .note-line { border-bottom: 2px solid #111; height: 42px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="title-wrap">
            <div class="title">${escapeHtml(title)} № ${escapeHtml(docNumber)} ${escapeHtml(docDate)}</div>
          </div>

          <table class="meta-table">
            <tr>
              <td class="meta-label">Заказчик:</td>
              <td class="meta-value">${escapeHtml(sender)}</td>
            </tr>
            <tr>
              <td class="meta-label">Поставщик:</td>
              <td class="meta-value">${escapeHtml(receiver)}</td>
            </tr>
          </table>

          <table class="main-table">
            <tr>
              <td class="cell head" style="width:40px;">№</td>
              <td class="cell head">Товары (работы, услуги)</td>
              <td class="cell head" style="width:90px;">Кол-во</td>
              <td class="cell head" style="width:90px;">Ед. изм.</td>
              <td class="cell head" style="width:120px;">Цена</td>
              <td class="cell head" style="width:140px;">Сумма</td>
            </tr>
            ${bodyRows}
            <tr>
              <td class="cell" colspan="5" style="font-weight:700; text-align:right;">Итого:</td>
              <td class="cell right" style="font-weight:700;">${formatMoneyRu(grandTotal)}</td>
            </tr>
          </table>

          <div class="summary">
            Всего наименований ${normalizedRows.length}, на сумму ${formatMoneyRu(grandTotal)} руб.
          </div>
          <div class="amount-words">${formatMoneyRu(grandTotal)} рублей 00 копеек</div>

          <div class="sign-row">
            <div class="sign-box">
              <div class="sign-label">Заказчик</div>
              <div class="sign-line"></div>
            </div>
            <div class="sign-box">
              <div class="sign-label">Поставщик</div>
              <div class="sign-line"></div>
            </div>
          </div>

          <div class="note-block">
            <div class="note-label">Примечание:</div>
            <div class="note-line"></div>
          </div>
        </div>
      </body>
    </html>
  `

  const blob = new Blob(["\uFEFF", html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  })
  triggerDownload(blob, filename.endsWith(".xls") ? filename : `${filename}.xls`)
}

export function downloadPurchaseDocumentTemplate({
  filename,
  title,
  docNumber,
  docDate,
  customer,
  supplier,
  note,
  rows,
}: {
  filename: string
  title: string
  docNumber: string
  docDate: string
  customer: string
  supplier: string
  note?: string
  rows: Array<{
    name: string
    uom?: string
    qty: number
    price?: number
    total?: number
  }>
}) {
  const normalizedRows = rows.map((row) => {
    const qty = Number(row.qty || 0)
    const price = Number(row.price || 0)
    const total = Number.isFinite(Number(row.total)) ? Number(row.total) : qty * price
    return { ...row, qty, price, total }
  })
  const grandTotal = normalizedRows.reduce((sum, row) => sum + Number(row.total || 0), 0)

  const bodyRows = normalizedRows
    .map(
      (row, index) => `
        <tr>
          <td class="cell center">${index + 1}</td>
          <td class="cell">${escapeHtml(row.name)}</td>
          <td class="cell center">${row.qty}</td>
          <td class="cell center">${escapeHtml(row.uom || "шт.")}</td>
          <td class="cell right">${row.price ? formatMoneyRu(row.price) : "-"}</td>
          <td class="cell right">${formatMoneyRu(row.total)}</td>
        </tr>
      `
    )
    .join("")

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #000; }
          .sheet { width: 1180px; margin: 0 auto; padding: 18px 20px 24px; }
          .title-wrap { width: 920px; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
          .title { font-size: 22px; font-weight: 700; line-height: 1.2; }
          .meta-table { width: 920px; border-collapse: collapse; margin-bottom: 14px; }
          .meta-label { width: 140px; padding: 8px 0; vertical-align: top; font-size: 15px; }
          .meta-value { padding: 8px 0; font-size: 15px; font-weight: 700; }
          .main-table { width: 920px; border-collapse: collapse; margin-top: 12px; }
          .cell { border: 1px solid #111827; padding: 4px 8px; font-size: 14px; }
          .head { font-weight: 700; text-align: center; }
          .center { text-align: center; }
          .right { text-align: right; }
          .summary { width: 920px; margin-top: 12px; font-size: 15px; }
          .amount-words { width: 920px; margin-top: 6px; font-size: 15px; font-weight: 700; }
          .sign-row { width: 920px; margin-top: 42px; display: flex; justify-content: space-between; gap: 40px; }
          .sign-box { width: 420px; }
          .sign-label { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
          .sign-line { border-bottom: 2px solid #111; height: 30px; }
          .note-block { width: 920px; margin-top: 38px; }
          .note-label { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
          .note-line { border-bottom: 2px solid #111; height: 42px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="title-wrap">
            <div class="title">${escapeHtml(title)} № ${escapeHtml(docNumber)} ${escapeHtml(docDate)}</div>
          </div>

          <table class="meta-table">
            <tr>
              <td class="meta-label">Заказчик:</td>
              <td class="meta-value">${escapeHtml(customer)}</td>
            </tr>
            <tr>
              <td class="meta-label">Поставщик:</td>
              <td class="meta-value">${escapeHtml(supplier)}</td>
            </tr>
          </table>

          <table class="main-table">
            <tr>
              <td class="cell head" style="width:40px;">№</td>
              <td class="cell head">Товары (работы, услуги)</td>
              <td class="cell head" style="width:90px;">Кол-во</td>
              <td class="cell head" style="width:90px;">Ед. изм.</td>
              <td class="cell head" style="width:120px;">Цена</td>
              <td class="cell head" style="width:140px;">Сумма</td>
            </tr>
            ${bodyRows}
            <tr>
              <td class="cell" colspan="5" style="font-weight:700; text-align:right;">Итого:</td>
              <td class="cell right" style="font-weight:700;">${formatMoneyRu(grandTotal)}</td>
            </tr>
          </table>

          <div class="summary">
            Всего наименований ${normalizedRows.length}, на сумму ${formatMoneyRu(grandTotal)} руб.
          </div>
          <div class="amount-words">${formatMoneyRu(grandTotal)} рублей 00 копеек</div>

          <div class="sign-row">
            <div class="sign-box">
              <div class="sign-label">Заказчик</div>
              <div class="sign-line"></div>
            </div>
            <div class="sign-box">
              <div class="sign-label">Поставщик</div>
              <div class="sign-line"></div>
            </div>
          </div>

          <div class="note-block">
            <div class="note-label">Примечание:</div>
            <div class="note-line">${escapeHtml(note || "")}</div>
          </div>
        </div>
      </body>
    </html>
  `

  const blob = new Blob(["\uFEFF", html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  })
  triggerDownload(blob, filename.endsWith(".xls") ? filename : `${filename}.xls`)
}

