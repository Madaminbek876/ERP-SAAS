const CP1251_SPECIAL_BYTE_BY_CODEPOINT = new Map<number, number>([
  [0x0402, 0x80],
  [0x0403, 0x81],
  [0x201A, 0x82],
  [0x0453, 0x83],
  [0x201E, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x20AC, 0x88],
  [0x2030, 0x89],
  [0x0409, 0x8a],
  [0x2039, 0x8b],
  [0x040A, 0x8c],
  [0x040C, 0x8d],
  [0x040B, 0x8e],
  [0x040F, 0x8f],
  [0x0452, 0x90],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201C, 0x93],
  [0x201D, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x2122, 0x99],
  [0x0459, 0x9a],
  [0x203A, 0x9b],
  [0x045A, 0x9c],
  [0x045C, 0x9d],
  [0x045B, 0x9e],
  [0x045F, 0x9f],
  [0x00A0, 0xa0],
  [0x040E, 0xa1],
  [0x045E, 0xa2],
  [0x0408, 0xa3],
  [0x00A4, 0xa4],
  [0x0490, 0xa5],
  [0x00A6, 0xa6],
  [0x00A7, 0xa7],
  [0x0401, 0xa8],
  [0x00A9, 0xa9],
  [0x0404, 0xaa],
  [0x00AB, 0xab],
  [0x00AC, 0xac],
  [0x00AD, 0xad],
  [0x00AE, 0xae],
  [0x0407, 0xaf],
  [0x00B0, 0xb0],
  [0x00B1, 0xb1],
  [0x0406, 0xb2],
  [0x0456, 0xb3],
  [0x0491, 0xb4],
  [0x00B5, 0xb5],
  [0x00B6, 0xb6],
  [0x00B7, 0xb7],
  [0x0451, 0xb8],
  [0x2116, 0xb9],
  [0x0454, 0xba],
  [0x00BB, 0xbb],
  [0x0458, 0xbc],
  [0x0405, 0xbd],
  [0x0455, 0xbe],
  [0x0457, 0xbf],
])

const MOJIBAKE_MARKERS = /[ЂЃѓ„…†‡€‰ЉЊЋЏђ‘’“”•–—™љњќћџЎўЈҐЁЄЇІіё№єії]/gu
const utf8Decoder = new TextDecoder("utf-8")

function countMarkers(value: string) {
  return value.match(MOJIBAKE_MARKERS)?.length ?? 0
}

function cp1251ByteForChar(char: string) {
  const codePoint = char.codePointAt(0)
  if (codePoint == null) return null
  if (codePoint <= 0x7f) return codePoint
  if (codePoint >= 0x0410 && codePoint <= 0x044f) return codePoint - 0x350
  return CP1251_SPECIAL_BYTE_BY_CODEPOINT.get(codePoint) ?? null
}

function toCp1251Bytes(value: string) {
  const bytes: number[] = []

  for (const char of value) {
    const byte = cp1251ByteForChar(char)
    if (byte == null) return null
    bytes.push(byte)
  }

  return Uint8Array.from(bytes)
}

export function repairTextEncoding(value: string) {
  if (!value || countMarkers(value) === 0) return value

  const bytes = toCp1251Bytes(value)
  if (!bytes) return value

  const repaired = utf8Decoder.decode(bytes)
  if (!repaired || repaired.includes("\uFFFD")) return value
  if (countMarkers(repaired) >= countMarkers(value)) return value

  return repaired
}

export function repairNestedStrings<T>(value: T): T {
  if (typeof value === "string") return repairTextEncoding(value) as T

  if (Array.isArray(value)) {
    return value.map((item) => repairNestedStrings(item)) as T
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, repairNestedStrings(nestedValue)])
    ) as T
  }

  return value
}
