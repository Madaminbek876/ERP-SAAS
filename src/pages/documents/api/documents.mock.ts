import type { DocumentItem } from "../types/documents.types";

export const mockDocuments: DocumentItem[] = [
  {
    id: "1",
    number: "DOC-000120",
    title: "Shartnoma (Kontrakt)",
    type: "CONTRACT",
    status: "SIGNED",
    date: "2026-02-23",
    kontragentName: "Jasur Trade",
    refType: "ORDER",
    refId: "ORD-789",
    amount: 150000000, // (misol)
    currency: "UZS",
    createdBy: "Admin",
    note: "2 nusxada imzolandi",
    attachments: [
      {
        id: "a1",
        name: "contract.pdf",
        url: "#",
        size: 412312,
        mime: "application/pdf",
        uploadedAt: "2026-02-23T10:20:00Z",
      },
    ],
    createdAt: "2026-02-23T09:00:00Z",
    updatedAt: "2026-02-23T10:20:00Z",
  },
  {
    id: "2",
    number: "DOC-000121",
    title: "Hisob-faktura",
    type: "INVOICE",
    status: "DRAFT",
    date: "2026-02-24",
    kontragentName: "ASASA QS",
    refType: "PURCHASE",
    refId: "PUR-102",
    amount: 115000000,
    currency: "UZS",
    createdBy: "Buxgalter",
    note: "",
    attachments: [],
    createdAt: "2026-02-24T08:00:00Z",
    updatedAt: "2026-02-24T08:00:00Z",
  },
];
