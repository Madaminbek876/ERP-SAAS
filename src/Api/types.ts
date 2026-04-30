export type TabKey = "employee" | "client" | "supplier";

export type BaseEntity = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  code?: string;
  kind?: "SUPPLIER" | "CLIENT" | "BOTH" | string;
  isActive?: boolean;
  deletedAt?: string | null;
  createdAt: string; // ISO
  updatedAt?: string;
};

export type Employee = BaseEntity & {
  position: string;
  salary?: number;
  // Employee maoshi valyutasi (backend: currency)
  currency?: "UZS" | "USD" | "EUR" | "RUB" | string;
  salaryStatus?: string;
  thisMonthAdvance?: number;
  salaryRemaining?: number;
};

export type Client = BaseEntity & {
  company?: string;
  taxId?: string;
  notes?: string;
};

export type Supplier = BaseEntity & {
  company?: string;
  taxId?: string;
  notes?: string;
  paymentTerms?: string;
};

export type EntityMap = {
  employee: Employee;
  client: Client;
  supplier: Supplier;
};

export type Mode = "create" | "edit" | "view";

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
