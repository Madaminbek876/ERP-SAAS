import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { employeeSchema } from "@/types/schemas";
import { apiAxios } from "@/Api/api.axios";
import { useI18n } from "@/i18n";

const TYPE_OPTIONS = [
  { value: "EMPLOYEE", label: "Employee" },
] as const;

// ✅ input/output type ajratib olamiz (transform sabab)
type EmployeeFormInput = z.input<typeof employeeSchema>;
type EmployeeFormOutput = z.output<typeof employeeSchema>; // bu EmployeeFormValues bilan bir xil

export function EmployeeForm({
  defaultValues,
  mode,
  onSubmit,
}: {
  // ✅ defaultValues input bo‘yicha bo‘lishi to‘g‘ri
  defaultValues?: Partial<EmployeeFormInput>;
  mode: "create" | "edit" | "view";
  // ✅ onSubmit output (transformdan keyingi)
  onSubmit: (values: EmployeeFormOutput) => void;
}) {
  const { language } = useI18n();
  const copy =
    language === "ru"
      ? {
          fullName: "Полное имя",
          phone: "Телефон",
          type: "Тип",
          position: "Должность",
          currency: "Валюта",
          salary: "Зарплата",
          save: "Сохранить",
          employee: "Сотрудник",
        }
      : language === "en"
        ? {
            fullName: "Full name",
            phone: "Phone",
            type: "Type",
            position: "Position",
            currency: "Currency",
            salary: "Salary",
            save: "Save",
            employee: "Employee",
          }
        : {
            fullName: "To'liq ism",
            phone: "Telefon",
            type: "Turi",
            position: "Lavozim",
            currency: "Valyuta",
            salary: "Oylik",
            save: "Saqlash",
            employee: "Xodim",
          };
  const disabled = mode === "view";
  const [currencyOptions, setCurrencyOptions] = useState<string[]>(["UZS", "USD", "EUR", "RUB"]);
  const [nameSuggestions, setNameSuggestions] = useState<Array<{ id: string; full_name: string; phone: string }>>([]);

  const { register, handleSubmit, formState, reset, watch } = useForm<
    EmployeeFormInput,
    any,
    EmployeeFormOutput
  >({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: "",
      phone: "",
      type: "EMPLOYEE",
      address: "",
      position: "",
      currency: "UZS",
      salary: undefined,
      ...defaultValues,
    },
  });

  useEffect(() => {
    reset({
      name: "",
      phone: "",
      type: "EMPLOYEE",
      address: "",
      position: "",
      currency: "UZS",
      salary: undefined,
      ...defaultValues,
    });
  }, [defaultValues, reset]);

  const nameQuery = watch("name");
  const canSuggest = useMemo(() => String(nameQuery || "").trim().length >= 2, [nameQuery]);

  useEffect(() => {
    // employees/meta -> currency choices
    let alive = true;
    (async () => {
      try {
        const meta = await apiAxios.employeesMeta();
        const choices = Array.isArray((meta as any)?.currency_choices)
          ? (meta as any).currency_choices
          : Array.isArray((meta as any)?.currencies)
            ? (meta as any).currencies
            : null;
        if (!alive || !choices) return;
        const normalized = choices
          .map((x: any) => (typeof x === "string" ? x : x?.value))
          .filter(Boolean)
          .map((x: any) => String(x).toUpperCase());
        if (normalized.length > 0) setCurrencyOptions(Array.from(new Set(normalized)));
      } catch {
        // meta endpoint bo'lmasa fallback options qoladi
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // employees/autocomplete -> full_name + phone tavsiyalari
    if (!canSuggest) {
      setNameSuggestions([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const list = await apiAxios.autocompleteEmployees({ q: String(nameQuery).trim(), limit: 8 });
        if (!alive) return;
        setNameSuggestions(
          list.map((x) => ({ id: String(x.id), full_name: String(x.full_name || ""), phone: String(x.phone || "") }))
        );
      } catch {
        if (alive) setNameSuggestions([]);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [canSuggest, nameQuery]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={styles.grid}>
      <Field label={copy.fullName} error={formState.errors.name?.message}>
        <input disabled={disabled} {...register("name")} style={styles.input} list="employee-name-hints" />
        <datalist id="employee-name-hints">
          {nameSuggestions.map((x) => (
            <option key={x.id} value={x.full_name}>
              {x.phone}
            </option>
          ))}
        </datalist>
      </Field>

      <Field label={copy.phone} error={formState.errors.phone?.message}>
        <input disabled={disabled} {...register("phone")} style={styles.input} />
      </Field>

      {/* ✅ TYPE select (Emaildan keyin) */}
      <Field label={copy.type} error={formState.errors.type?.message as any}>
        {disabled ? (
          <input value={copy.employee} readOnly style={styles.readOnlyInput} />
        ) : (
          <select style={styles.select} {...register("type")}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {copy.employee}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label={copy.position} error={formState.errors.position?.message}>
        <input disabled={disabled} {...register("position")} style={styles.input} />
      </Field>

      <Field label={copy.currency} error={formState.errors.currency?.message as any}>
        {/* Employee API currency tanlovi */}
        {disabled ? (
          <input value={String(watch("currency") || "UZS")} readOnly style={styles.readOnlyInput} />
        ) : (
          <select {...register("currency")} style={styles.select}>
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label={copy.salary} error={formState.errors.salary?.message as any}>
        <input
          disabled={disabled}
          type="number"
          {...register("salary", { valueAsNumber: true })}
          style={styles.input}
        />
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
    background: "linear-gradient(to bottom, #0D3B78, #0A4D96)",
    color: "white",
    fontWeight: 800,
  },
};
