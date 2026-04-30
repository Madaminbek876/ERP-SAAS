/**
 * ✅ cx()
 * Vazifasi:
 * - className'larni qo‘shib berish (false/null bo‘lsa tashlab ketadi)
 */
export function cx(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ")
}
