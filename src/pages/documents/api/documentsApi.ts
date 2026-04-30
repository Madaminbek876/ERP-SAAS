import type { DocumentItem, DocumentsFilters } from "../types/documents.types";
import { mockDocuments } from "./documents.mock";

let db = [...mockDocuments];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function match(doc: DocumentItem, f: DocumentsFilters) {
  if (f.type && f.type !== "ALL" && doc.type !== f.type) return false;
  if (f.status && f.status !== "ALL" && doc.status !== f.status) return false;
  if (f.refType && f.refType !== "ALL" && doc.refType !== f.refType) return false;

  if (f.dateFrom && doc.date < f.dateFrom) return false;
  if (f.dateTo && doc.date > f.dateTo) return false;

  if (f.refId && !(doc.refId || "").toLowerCase().includes(f.refId.toLowerCase())) return false;

  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = `${doc.number} ${doc.title} ${doc.kontragentName ?? ""} ${doc.refId ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  return true;
}

export async function listDocuments(filters: DocumentsFilters): Promise<DocumentItem[]> {
  await sleep(250);
  return db.filter((d) => match(d, filters)).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getDocument(id: string): Promise<DocumentItem | null> {
  await sleep(150);
  return db.find((x) => x.id === id) ?? null;
}

export async function createDocument(payload: Omit<DocumentItem, "id" | "createdAt" | "updatedAt">) {
  await sleep(250);
  const id = String(Date.now());
  const now = new Date().toISOString();
  const item: DocumentItem = { ...payload, id, createdAt: now, updatedAt: now };
  db = [item, ...db];
  return item;
}

export async function updateDocument(id: string, patch: Partial<DocumentItem>) {
  await sleep(250);
  const now = new Date().toISOString();
  db = db.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now } : x));
  return db.find((x) => x.id === id) ?? null;
}

export async function deleteDocument(id: string) {
  await sleep(200);
  db = db.filter((x) => x.id !== id);
  return true;
}
