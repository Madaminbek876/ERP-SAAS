import en from "./en"
import ru from "./ru"
import { repairNestedStrings } from "./repairEncoding"
import uz from "./uz"

export const resources = {
  uz: { translation: repairNestedStrings(uz) },
  ru: { translation: repairNestedStrings(ru) },
  en: { translation: repairNestedStrings(en) },
} as const
