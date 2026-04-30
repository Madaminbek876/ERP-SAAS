export type DocumentType =
  | "INVOICE"
  | "CONTRACT"
  | "ACT"
  | "PAYMENT_ORDER"
  | "DELIVERY_NOTE"
  | "INVENTORY_ACT"
  | "PRODUCTION_REPORT"
  | "OTHER";

export type DocumentStatus = "DRAFT" | "SIGNED" | "PAID" | "CANCELED" | "ARCHIVED";

export type RefType = "ORDER" | "PURCHASE" | "PRODUCTION" | "WAREHOUSE" | "FINANCE" | "MANUAL";

export type DocumentAttachment = {
  id: string;
  name: string;
  url: string; // keyin backend file url
  size: number; // bytes
  mime: string;
  uploadedAt: string; // ISO
};

export type DocumentItem = {
  id: string;
  number: string; // DOC-000123
  title: string; // "Shartnoma"
  type: DocumentType;
  status: DocumentStatus;

  date: string; // YYYY-MM-DD
  kontragentName?: string;

  refType?: RefType;
  refId?: string;

  amount?: number; // UZS tiyin yoki so'm (siz modelga moslab keyin)
  currency?: "UZS" | "USD" | "RUB";

  createdBy?: string;
  note?: string;

  attachments: DocumentAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type DocumentsFilters = {
  dateFrom?: string;
  dateTo?: string;
  type?: DocumentType | "ALL";
  status?: DocumentStatus | "ALL";
  refType?: RefType | "ALL";
  q?: string; // search
  refId?: string; // reference id text
};
