import React from "react"
import { useI18n } from "@/i18n"
import type { DocumentItem } from "../types/documents.types"
import { docStatusLabel, docTypeLabel, statusChipClass } from "../utils/documents.utils"
import { openPrintWindow } from "../utils/printDocument"
import DocumentAttachments from "./DocumentAttachments"
import DocumentPreview from "./DocumentPreview"
import Portal from "./Portal"

type Props = {
  open: boolean
  doc: DocumentItem | null
  onClose: () => void
}

export default function DocumentViewDrawer({ open, doc, onClose }: Props) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? {
          closeAria: "Закрыть модал",
          title: "Документ",
          subtitle: "Просмотр / Preview",
          print: "Печать",
          close: "Закрыть",
          notFound: "Документ не найден",
          counterparty: "Контрагент",
          reference: "Reference",
          amount: "Сумма",
          owner: "Ответственный",
        }
      : language === "en"
        ? {
            closeAria: "Close modal",
            title: "Document",
            subtitle: "View / Preview",
            print: "Print",
            close: "Close",
            notFound: "Document not found",
            counterparty: "Counterparty",
            reference: "Reference",
            amount: "Amount",
            owner: "Owner",
          }
        : {
            closeAria: "Close modal",
            title: "Hujjat",
            subtitle: "Ko'rish / Preview",
            print: "Pechat",
            close: "Yopish",
            notFound: "Hujjat topilmadi",
            counterparty: "Kontragent",
            reference: "Reference",
            amount: "Summa",
            owner: "Mas'ul",
          }

  const handlePrint = () => {
    if (!doc) return
    openPrintWindow(doc)
  }

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <button aria-label={copy.closeAria} onClick={onClose} className="absolute inset-0 bg-black/35" />

        <div className="relative max-h-[85vh] w-full max-w-[720px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(2,6,23,0.35)]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <div>
              <div className="text-base font-semibold text-slate-900">{copy.title}</div>
              <div className="text-xs text-slate-500">{copy.subtitle}</div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handlePrint} disabled={!doc} className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60">
                {copy.print}
              </button>

              <button onClick={onClose} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                {copy.close}
              </button>
            </div>
          </div>

          <div className="max-h-[calc(85vh-72px)] space-y-4 overflow-auto p-5">
            {!doc ? (
              <div className="py-10 text-center text-slate-500">{copy.notFound}</div>
            ) : (
              <>
                <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500">{doc.date}</div>
                      <div className="text-lg font-semibold text-slate-900">{doc.number}</div>
                      <div className="text-sm text-slate-700">
                        {docTypeLabel[doc.type]} • {doc.title}
                      </div>
                    </div>

                    <span className={["inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", statusChipClass(doc.status)].join(" ")}>
                      {docStatusLabel[doc.status]}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div>
                      <div className="text-xs text-slate-500">{copy.counterparty}</div>
                      <div className="font-semibold text-slate-900">{doc.kontragentName ?? "-"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">{copy.reference}</div>
                      <div className="font-semibold text-slate-900">{doc.refType ? `${doc.refType}: ${doc.refId ?? "-"}` : "-"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">{copy.amount}</div>
                      <div className="font-semibold text-slate-900">{doc.amount ? `${Number(doc.amount).toLocaleString()} ${doc.currency ?? "UZS"}` : "-"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">{copy.owner}</div>
                      <div className="font-semibold text-slate-900">{doc.createdBy ?? "-"}</div>
                    </div>
                  </div>

                  {doc.note ? <div className="mt-3 text-sm text-slate-700">{doc.note}</div> : null}
                </div>

                <DocumentAttachments doc={doc} />
                <DocumentPreview doc={doc} />
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
