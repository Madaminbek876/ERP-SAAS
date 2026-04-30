const EAN13_LENGTH = 13
const INTERNAL_PREFIX = "200"
const LEFT_ODD_PATTERNS = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"]
const LEFT_EVEN_PATTERNS = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"]
const RIGHT_PATTERNS = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"]
const EAN13_PARITY_PATTERNS = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"]

function randomDigit() {
  return Math.floor(Math.random() * 10)
}

export function sanitizeBarcodeInput(value: string) {
  return value.replace(/\D/g, "").slice(0, EAN13_LENGTH)
}

export function computeEan13CheckDigit(base12: string) {
  const digits = sanitizeBarcodeInput(base12).slice(0, EAN13_LENGTH - 1)
  if (digits.length !== EAN13_LENGTH - 1) return ""

  const sum = digits.split("").reduce((total, digit, index) => {
    const weight = index % 2 === 0 ? 1 : 3
    return total + Number(digit) * weight
  }, 0)

  return String((10 - (sum % 10)) % 10)
}

export function generateBarcodeValue() {
  let base = INTERNAL_PREFIX
  while (base.length < EAN13_LENGTH - 1) {
    base += String(randomDigit())
  }

  return `${base}${computeEan13CheckDigit(base)}`
}

export function normalizeEan13Value(value: string) {
  const digits = sanitizeBarcodeInput(value)
  if (digits.length === EAN13_LENGTH) return digits
  if (digits.length === EAN13_LENGTH - 1) return `${digits}${computeEan13CheckDigit(digits)}`
  return ""
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildEan13Pattern(value: string) {
  const barcode = normalizeEan13Value(value)
  if (!barcode) return ""

  const firstDigit = Number(barcode[0] || 0)
  const parityPattern = EAN13_PARITY_PATTERNS[firstDigit] || EAN13_PARITY_PATTERNS[0]
  let pattern = "101"

  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(barcode[index] || 0)
    pattern += parityPattern[index - 1] === "G" ? LEFT_EVEN_PATTERNS[digit] : LEFT_ODD_PATTERNS[digit]
  }

  pattern += "01010"

  for (let index = 7; index < barcode.length; index += 1) {
    const digit = Number(barcode[index] || 0)
    pattern += RIGHT_PATTERNS[digit]
  }

  pattern += "101"
  return pattern
}

export function createEan13BarcodeSvg(
  value: string,
  options?: {
    moduleWidth?: number
    quietZoneModules?: number
    barHeight?: number
    textHeight?: number
  }
) {
  const barcode = normalizeEan13Value(value)
  const pattern = buildEan13Pattern(barcode)
  if (!barcode || !pattern) return ""

  const moduleWidth = options?.moduleWidth ?? 2
  const quietZoneModules = options?.quietZoneModules ?? 10
  const barHeight = options?.barHeight ?? 76
  const textHeight = options?.textHeight ?? 26
  const width = (quietZoneModules * 2 + pattern.length) * moduleWidth
  const height = barHeight + textHeight
  const guardIndices = new Set<number>([
    0, 1, 2,
    45, 46, 47, 48, 49,
    92, 93, 94,
  ])

  const bars: string[] = []
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] !== "1") continue
    const x = (quietZoneModules + index) * moduleWidth
    const currentBarHeight = guardIndices.has(index) ? barHeight + 6 : barHeight
    bars.push(`<rect x="${x}" y="0" width="${moduleWidth}" height="${currentBarHeight}" fill="#111827" />`)
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="EAN-13 ${barcode}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff" />`,
    ...bars,
    `<text x="${width / 2}" y="${height - 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="4" fill="#0f172a">${barcode}</text>`,
    `</svg>`,
  ].join("")
}

export function printBarcodeLabel(
  value: string,
  options?: {
    title?: string
    subtitle?: string
  }
) {
  const barcode = normalizeEan13Value(value)
  if (!barcode) {
    throw new Error("Shtrix kod yaroqsiz")
  }
  if (typeof window === "undefined") {
    throw new Error("Chop etish faqat brauzerda ishlaydi")
  }

  const popup = window.open("", "_blank", "width=520,height=720")
  if (!popup) {
    throw new Error("Chop etish oynasini ochib bo'lmadi")
  }

  const svg = createEan13BarcodeSvg(barcode, { moduleWidth: 3, barHeight: 110, textHeight: 34 })
  const title = escapeHtml(options?.title?.trim() || "Barcode")
  const subtitle = escapeHtml(options?.subtitle?.trim() || "")

  popup.document.open()
  popup.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page { size: auto; margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        color: #0f172a;
        font-family: Arial, sans-serif;
      }
      .sheet {
        width: 100%;
        max-width: 420px;
        padding: 24px;
        border: 1px solid #cbd5e1;
        border-radius: 16px;
        text-align: center;
      }
      .title {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .subtitle {
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 18px;
      }
      .barcode svg {
        width: 100%;
        height: auto;
      }
      @media print {
        body { display: block; min-height: auto; }
        .sheet {
          max-width: none;
          border: none;
          border-radius: 0;
          margin: 0 auto;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="title">${title}</div>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
      <div class="barcode">${svg}</div>
    </div>
    <script>
      window.addEventListener("load", function () {
        window.focus();
        setTimeout(function () {
          window.print();
        }, 180);
      });
      window.addEventListener("afterprint", function () {
        window.close();
      });
    </script>
  </body>
</html>`)
  popup.document.close()
}
