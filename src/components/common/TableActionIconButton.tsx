import type { ButtonHTMLAttributes, ReactNode } from "react"

type Props = {
  title: string
  danger?: boolean
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

export default function TableActionIconButton({
  title,
  danger = false,
  children,
  className = "",
  type = "button",
  ...props
}: Props) {
  const base = "inline-flex h-10 w-14 items-center justify-center rounded-2xl border transition"
  const tone = danger
    ? "!border-rose-200 !bg-rose-50 !text-rose-600 hover:!bg-rose-100"
    : "!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"

  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      data-slot="button"
      style={{ backgroundImage: "none" }}
      className={`${base} ${tone} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
