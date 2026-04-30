import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supplierSchema, type SupplierFormValues } from "@/types/schemas";
import { useI18n } from "@/i18n";

const TYPE_OPTIONS = [
  { value: "SUPPLIER", label: "Supplier" },
] as const;

export function SupplierForm({
  defaultValues,
  mode,
  onSubmit,
}: {
  defaultValues?: Partial<SupplierFormValues>;
  mode: "create" | "edit" | "view";
  onSubmit: (values: SupplierFormValues) => void;
}) {
  const { language } = useI18n();
  const copy =
    language === "ru"
      ? { contactName: "Контактное имя", phone: "Телефон", email: "Email", type: "Тип", inn: "ИНН", notes: "Заметки", address: "Адрес", save: "Сохранить", supplier: "Поставщик" }
      : language === "en"
        ? { contactName: "Contact name", phone: "Phone", email: "Email", type: "Type", inn: "INN", notes: "Notes", address: "Address", save: "Save", supplier: "Supplier" }
        : { contactName: "Kontakt nomi", phone: "Telefon", email: "Email", type: "Turi", inn: "STIR", notes: "Izoh", address: "Manzil", save: "Saqlash", supplier: "Yetkazib beruvchi" };
  const disabled = mode === "view";
  const { register, handleSubmit, formState, reset } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      email: "",
      type: "SUPPLIER",
      address: "",
      taxId: "",
      notes: "",
      paymentTerms: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    reset({
      name: "",
      company: "",
      phone: "",
      email: "",
      type: "SUPPLIER",
      address: "",
      taxId: "",
      notes: "",
      paymentTerms: "",
      ...defaultValues,
    });
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={styles.grid}>
      <Field label={copy.contactName} error={formState.errors.name?.message}>
        <input disabled={disabled} {...register("name")} style={styles.input} />
      </Field>

      <Field label={copy.phone} error={formState.errors.phone?.message}>
        <input disabled={disabled} {...register("phone")} style={styles.input} />
      </Field>

      <Field label={copy.email} error={formState.errors.email?.message}>
        <input disabled={disabled} {...register("email")} style={styles.input} />
      </Field>

      {/* ✅ TYPE select (Emaildan keyin) */}
      <Field label={copy.type} error={formState.errors.type?.message as any}>
        {disabled ? (
          <input value={copy.supplier} readOnly style={styles.readOnlyInput} />
        ) : (
          <select style={styles.select} {...register("type")}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {copy.supplier}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label={copy.inn} error={formState.errors.taxId?.message as any}>
        <input disabled={disabled} {...register("taxId")} style={styles.input} />
      </Field>

      <Field label={copy.notes} error={formState.errors.notes?.message as any}>
        <input disabled={disabled} {...register("notes")} style={styles.input} />
      </Field>

      <Field label={copy.address} error={formState.errors.address?.message}>
        <input disabled={disabled} {...register("address")} style={styles.input} />
      </Field>

      {mode !== "view" ? (
        <button type="submit" style={styles.save}>
          {copy.save}
        </button>
      ) : null}
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
      {error ? <span style={styles.error}>{error}</span> : null}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 800, color: "#334155" },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
  },
  readOnlyInput: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
    background: "#f8fafc",
  },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
    background: "white",
  },
  error: { fontSize: 12, color: "#ef4444" },
  save: {
    gridColumn: "1 / -1",
    border: "none",
    cursor: "pointer",
    padding: "10px 14px",
    borderRadius: 12,
    background: "#0f172a",
    color: "white",
    fontWeight: 800,
  },
};
