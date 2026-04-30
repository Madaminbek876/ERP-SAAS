import React, { useEffect, useMemo, useState } from "react";
import type { TabKey, EntityMap, Mode, Employee, Client, Supplier } from "../../Api/types";
import { loadLS, saveLS } from "../../storage/storage";
import { apiAxios } from "../../Api/api.axios";
import { EmployeeForm } from "../../pages/xodimlar/Employee/EmployeeForm";
import { ClientForm } from "../../pages/xodimlar/Client/ClientForm";
import { SupplierForm } from "../../pages/xodimlar/Supplier/SupplierForm";
import { toast } from "react-toastify";
import DeleteAlertDialog from "@/components/common/DeleteAlertDialog";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import TableActionIconButton from "@/components/common/TableActionIconButton";
import { pageTabClass } from "@/components/common/pageTabStyles";
import { useI18n } from "@/i18n";


/** =========================
 *  Config
 *  ========================= */
const LS_KEY = "tabs_crud_pro_v1";
const USE_API = true;

type Store = {
  employee: Employee[];
  client: Client[];
  supplier: Supplier[];
};

type OrderingValue = "-created_at" | "created_at" | "name" | "-name";
type LanguageCode = "uz" | "ru" | "en";

const PRIMARY_GRADIENT =
  "!bg-gradient-to-r !from-[#1d4ed8] !via-[#1e40af] !to-[#1d4ed8]";
const PRIMARY_BUTTON =
  `${PRIMARY_GRADIENT} !border-blue-700 !text-white shadow-[0_14px_28px_rgba(29,78,216,0.22)] transition hover:brightness-110`;
const SELECT_TRIGGER_CLASSES =
  "h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-11 text-sm font-semibold text-slate-900 shadow-[0_12px_26px_-22px_rgba(15,23,42,0.28)] outline-none transition hover:border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100";

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const nowISO = () => new Date().toISOString();

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatEntityCode(value?: string | null, fallbackId?: string | number | null) {
  const source = String(value ?? "").trim();
  const digits = source.replace(/\D+/g, "");

  if (digits) return `№${Number(digits)}`;
  if (fallbackId !== undefined && fallbackId !== null && String(fallbackId).trim()) return `№${fallbackId}`;
  return "-";
}

// ✅ type -> tab mapping
function tabFromType(t: any): TabKey {
  if (t === "EMPLOYEE") return "employee";
  if (t === "CLIENT") return "client";
  return "supplier";
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_TRIGGER_CLASSES}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400 transition group-focus-within:text-blue-600">
        <ChevronDown className="h-4 w-4" />
      </span>
    </div>
  );
}
function StatusBadge({ active }: { active?: boolean }) {
  const { language } = useI18n();

  const isActive = active !== false;
  const label = isActive
    ? language === "ru"
      ? "Актив"
      : language === "en"
        ? "Active"
        : "Aktiv"
    : language === "ru"
      ? "Не актив"
      : language === "en"
        ? "Inactive"
        : "Noaktiv";
  return (
    <span
      className={
        isActive
          ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
          : "inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
      }
    >
      {label}
    </span>
  );
}

/** =========================
 *  Typed Table Columns
 *  ========================= */
type ColumnDef<T> = {
  key: keyof T | "actions";
  title: string;
  render?: (row: T) => React.ReactNode;
};

type AnyTabDef =
  | { key: "employee"; label: string; addLabel: string; listTitle: string; columns: ColumnDef<Employee>[] }
  | { key: "client"; label: string; addLabel: string; listTitle: string; columns: ColumnDef<Client>[] }
  | { key: "supplier"; label: string; addLabel: string; listTitle: string; columns: ColumnDef<Supplier>[] };

type TabsCrudCopy = ReturnType<typeof getTabsCrudCopy>;

function getTabsCrudCopy(language: LanguageCode) {
  if (language === "ru") {
    return {
      close: "Закрыть",
      page: "Страница",
      show: "Показать",
      total: "Всего",
      noData: "Данные не найдены",
      view: "Просмотр",
      edit: "Редактировать",
      delete: "Удалить",
      restore: "Восстановить",
      hardDelete: "Удалить навсегда",
      toggleStatus: "Изменить статус",
      activate: "Активировать",
      deactivate: "Деактивировать",
      active: "Активный",
      inactive: "Неактивный",
      listLoadError: "Список не загрузился",
      detailLoadError: "Детали не загрузились",
      deleteError: "Ошибка удаления",
      restoreError: "Ошибка восстановления",
      statusError: "Ошибка смены статуса",
      created: "Создано",
      updated: "Обновлено",
      savedError: "Ошибка сохранения",
      deleted: "Удалено",
      deletedHard: "Удалено навсегда",
      restored: "Восстановлено",
      activated: "Активировано",
      deactivated: "Деактивировано",
      filtersTitle: "Фильтры",
      statusLabel: "Статус",
      searchLabel: "Поиск",
      sortLabel: "Сортировка",
      clearLabel: "Сброс",
      clear: "Сбросить",
      all: "Все",
      onlyActive: "Только активные",
      onlyInactive: "Только неактивные",
      newestFirst: "Сначала новые",
      oldestFirst: "Сначала старые",
      totalRecords: (total: number) => `Всего ${total} записей`,
      deleteTitleSoft: "Удаление",
      deleteTitleHard: "Удалить навсегда",
      deleteSoftDescription: "Вы уверены, что хотите удалить выбранную запись?",
      deleteHardDescription: "Выбранная запись будет удалена навсегда. Это действие нельзя отменить.",
      tabs: {
        employee: {
          label: "Сотрудники",
          singular: "Сотрудник",
          addLabel: "Новый сотрудник",
          listTitle: "Список сотрудников",
          searchPlaceholder: "Имя, телефон или должность",
          editTitle: "Редактировать сотрудника",
          viewTitle: "Просмотр сотрудника",
          columns: {
            name: "Имя",
            position: "Должность",
            phone: "Телефон",
            salary: "Зарплата",
            currency: "Валюта",
            status: "Статус",
            actions: "Действия",
          },
        },
        client: {
          label: "Клиенты",
          singular: "Клиент",
          addLabel: "Новый клиент",
          listTitle: "Список клиентов",
          searchPlaceholder: "Имя, телефон, email или ИНН",
          editTitle: "Редактировать клиента",
          viewTitle: "Просмотр клиента",
          columns: {
            code: "Код",
            name: "Название",
            taxId: "ИНН",
            phone: "Телефон",
            email: "Email",
            status: "Статус",
            actions: "Действия",
          },
        },
        supplier: {
          label: "Поставщики",
          singular: "Поставщик",
          addLabel: "Новый поставщик",
          listTitle: "Список поставщиков",
          searchPlaceholder: "Имя, телефон, email или ИНН",
          editTitle: "Редактировать поставщика",
          viewTitle: "Просмотр поставщика",
          columns: {
            code: "Код",
            name: "Название",
            taxId: "ИНН",
            phone: "Телефон",
            email: "Email",
            status: "Статус",
            actions: "Действия",
          },
        },
      },
    } as const;
  }

  if (language === "en") {
    return {
      close: "Close",
      page: "Page",
      show: "Show",
      total: "Total",
      noData: "No records found",
      view: "View",
      edit: "Edit",
      delete: "Delete",
      restore: "Restore",
      hardDelete: "Delete permanently",
      toggleStatus: "Change status",
      activate: "Activate",
      deactivate: "Deactivate",
      active: "Active",
      inactive: "Inactive",
      listLoadError: "List failed to load",
      detailLoadError: "Details failed to load",
      deleteError: "Delete failed",
      restoreError: "Restore failed",
      statusError: "Status update failed",
      created: "Created",
      updated: "Updated",
      savedError: "Save failed",
      deleted: "Deleted",
      deletedHard: "Permanently deleted",
      restored: "Restored",
      activated: "Activated",
      deactivated: "Deactivated",
      filtersTitle: "Filters",
      statusLabel: "Status",
      searchLabel: "Search",
      sortLabel: "Sort",
      clearLabel: "Reset",
      clear: "Reset",
      all: "All",
      onlyActive: "Only active",
      onlyInactive: "Only inactive",
      newestFirst: "Newest first",
      oldestFirst: "Oldest first",
      totalRecords: (total: number) => `Total ${total} records`,
      deleteTitleSoft: "Delete",
      deleteTitleHard: "Delete permanently",
      deleteSoftDescription: "Are you sure you want to delete the selected record?",
      deleteHardDescription: "The selected record will be permanently deleted. This action cannot be undone.",
      tabs: {
        employee: {
          label: "Employees",
          singular: "Employee",
          addLabel: "New employee",
          listTitle: "Employees list",
          searchPlaceholder: "Name, phone, or position",
          editTitle: "Edit employee",
          viewTitle: "View employee",
          columns: {
            name: "Name",
            position: "Position",
            phone: "Phone",
            salary: "Salary",
            currency: "Currency",
            status: "Status",
            actions: "Actions",
          },
        },
        client: {
          label: "Clients",
          singular: "Client",
          addLabel: "New client",
          listTitle: "Clients list",
          searchPlaceholder: "Name, phone, email, or INN",
          editTitle: "Edit client",
          viewTitle: "View client",
          columns: {
            code: "Code",
            name: "Name",
            taxId: "INN",
            phone: "Phone",
            email: "Email",
            status: "Status",
            actions: "Actions",
          },
        },
        supplier: {
          label: "Suppliers",
          singular: "Supplier",
          addLabel: "New supplier",
          listTitle: "Suppliers list",
          searchPlaceholder: "Name, phone, email, or INN",
          editTitle: "Edit supplier",
          viewTitle: "View supplier",
          columns: {
            code: "Code",
            name: "Name",
            taxId: "INN",
            phone: "Phone",
            email: "Email",
            status: "Status",
            actions: "Actions",
          },
        },
      },
    } as const;
  }

  return {
    close: "Yopish",
    page: "Sahifa",
    show: "Ko'rsatish",
    total: "Jami",
    noData: "Ma'lumot topilmadi",
    view: "Ko'rish",
    edit: "Tahrirlash",
    delete: "O'chirish",
    restore: "Tiklash",
    hardDelete: "Butunlay o'chirish",
    toggleStatus: "Holatni o'zgartirish",
    activate: "Aktiv qilish",
    deactivate: "Noaktiv qilish",
    active: "Aktiv",
    inactive: "Noaktiv",
    listLoadError: "Ro'yxat yuklanmadi",
    detailLoadError: "Detail yuklanmadi",
    deleteError: "Delete xatolik",
    restoreError: "Restore xatolik",
    statusError: "Status o'zgartirish xatolik",
    created: "Yaratildi",
    updated: "Yangilandi",
    savedError: "Saqlashda xatolik",
    deleted: "O'chirildi",
    deletedHard: "Butunlay o'chirildi",
    restored: "Tiklandi",
    activated: "Aktiv qilindi",
    deactivated: "Noaktiv qilindi",
    filtersTitle: "Filtrlar",
    statusLabel: "Holati",
    searchLabel: "Qidiruv",
    sortLabel: "Saralash",
    clearLabel: "Tozalash",
    clear: "Tozalash",
    all: "Barchasi",
    onlyActive: "Faqat aktiv",
    onlyInactive: "Faqat noaktiv",
    newestFirst: "Yangi dan eski",
    oldestFirst: "Eski dan yangi",
    totalRecords: (total: number) => `Jami ${total} ta yozuv`,
    deleteTitleSoft: "O'chirish",
    deleteTitleHard: "Butunlay o'chirish",
    deleteSoftDescription: "Rostdan ham tanlangan yozuvni o'chirmoqchimisiz?",
    deleteHardDescription: "Tanlangan yozuv butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
    tabs: {
      employee: {
        label: "Xodimlar",
        singular: "Xodim",
        addLabel: "Yangi xodim",
        listTitle: "Xodimlar ro'yxati",
        searchPlaceholder: "Ism, telefon yoki lavozim",
        editTitle: "Xodimni tahrirlash",
        viewTitle: "Xodimni ko'rish",
        columns: {
          name: "Ismi",
          position: "Lavozimi",
          phone: "Telefon",
          salary: "Maoshi",
          currency: "Valyuta",
          status: "Holati",
          actions: "Amallar",
        },
      },
      client: {
        label: "Mijozlar",
        singular: "Mijoz",
        addLabel: "Yangi mijoz",
        listTitle: "Mijozlar ro'yxati",
        searchPlaceholder: "Nomi, telefon, email yoki STIR",
        editTitle: "Mijozni tahrirlash",
        viewTitle: "Mijozni ko'rish",
        columns: {
          code: "Kodi",
          name: "Nomi",
          taxId: "STIR",
          phone: "Telefon",
          email: "Email",
          status: "Holati",
          actions: "Amallar",
        },
      },
      supplier: {
        label: "Yetkazib beruvchilar",
        singular: "Yetkazib beruvchi",
        addLabel: "Yangi yetkazib beruvchi",
        listTitle: "Yetkazib beruvchilar ro'yxati",
        searchPlaceholder: "Nomi, telefon, email yoki STIR",
        editTitle: "Yetkazib beruvchini tahrirlash",
        viewTitle: "Yetkazib beruvchini ko'rish",
        columns: {
          code: "Kodi",
          name: "Nomi",
          taxId: "STIR",
          phone: "Telefon",
          email: "Email",
          status: "Holati",
          actions: "Amallar",
        },
      },
    },
  } as const;
}

/** =========================
 *  Modal (Tailwind)
 *  ========================= */
function Modal({
  open,
  title,
  onClose,
  closeLabel,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-base font-extrabold text-slate-900">{title}</div>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-extrabold text-slate-700 hover:bg-slate-100"
            onClick={onClose}
            type="button"
            aria-label={closeLabel}
          >
            ✕
          </button>
        </div>

        <div className="p-4">{children}</div>

        {footer ? <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** =========================
 *  Pagination (Tailwind)
 *  ========================= */
function Pagination({
  page,
  pageSize,
  total,
  copy,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  copy: Pick<TabsCrudCopy, "page" | "show" | "total">;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center gap-2">
        <button
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${PRIMARY_BUTTON}`}
          type="button"
        >
          <ChevronLeft />
        </button>

        <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
          {copy.page} <span className="font-semibold text-slate-900">{page}</span> /{" "}
          <span className="font-semibold text-slate-900">{totalPages}</span>
        </div>

        <button
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${PRIMARY_BUTTON}`}
          type="button"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">{copy.show}</span>
        <div className="group relative min-w-[92px]">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={`${SELECT_TRIGGER_CLASSES} h-12 rounded-2xl px-4 pr-10`}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400 transition group-focus-within:text-blue-600">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>

        <span className="text-sm text-slate-500">
          {copy.total}: <span className="font-semibold text-slate-900">{total}</span>
        </span>
      </div>
    </div>
  );
}

/** =========================
 *  DataTable (Tailwind)
 *  ========================= */
function DataTable<T extends { id: string }>({
  columns,
  rows,
  copy,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onHardDelete,
  onToggleActive,
}: {
  columns: ColumnDef<T>[];
  rows: T[];
  copy: Pick<TabsCrudCopy, "noData" | "view" | "edit" | "delete" | "restore" | "hardDelete" | "toggleStatus" | "activate" | "deactivate">;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onRowClick: (id: string) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onHardDelete?: (id: string) => void;
  onToggleActive?: (id: string, nextActive: boolean) => void;
}) {
  const { language } = useI18n();
  const allChecked = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="bg-[#1d4ed8] text-white">
              <th className="w-12 px-4 py-4 text-center text-sm font-semibold text-white">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectionChange(Array.from(new Set([...selectedIds, ...rows.map((row) => row.id)])));
                      return;
                    }

                    onSelectionChange(selectedIds.filter((id) => !rows.some((row) => row.id === id)));
                  }}
                  aria-label="Select all rows"
                />
              </th>
              {columns.map((c) => (
                <th key={String(c.key)} className="px-4 py-4 text-left text-sm font-semibold text-white">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={columns.length + 1}>
                  {copy.noData}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                  onClick={() => onRowClick(row.id)}
                >
                  <td
                    className="px-4 py-3 text-center"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSelectionChange(Array.from(new Set([...selectedIds, row.id])));
                          return;
                        }

                        onSelectionChange(selectedIds.filter((id) => id !== row.id));
                      }}
                      aria-label={`Select row ${row.id}`}
                    />
                  </td>
                  {columns.map((c) => {
                    if (c.key === "actions") {
                      const anyRow = row as any;
                      const isActive = typeof anyRow?.isActive === "boolean" ? anyRow.isActive : undefined;
                      const deletedAt = anyRow?.deletedAt as string | null | undefined;

                      return (
                        <td key="actions" className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TableActionIconButton title={copy.view} onClick={() => onView(row.id)}>
                              <Eye size={16} />
                            </TableActionIconButton>
                            <TableActionIconButton title={copy.edit} onClick={() => onEdit(row.id)}>
                              <Pencil size={16} />
                            </TableActionIconButton>
                            <TableActionIconButton title={copy.delete} danger onClick={() => onDelete(row.id)}>
                              <Trash2 size={16} />
                            </TableActionIconButton>
                            {deletedAt && onRestore ? (
                              <button
                                type="button"
                                onClick={() => onRestore(row.id)}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100"
                                title={copy.restore}
                              >
                                {copy.restore}
                              </button>
                            ) : null}
                            {deletedAt && onHardDelete ? (
                              <button
                                type="button"
                                onClick={() => onHardDelete(row.id)}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                                title={copy.hardDelete}
                              >
                                {copy.hardDelete}
                              </button>
                            ) : null}
                            {!deletedAt && typeof isActive === "boolean" && onToggleActive ? (
                              <button
                                type="button"
                                onClick={() => onToggleActive(row.id, !isActive)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                title={copy.toggleStatus}
                              >
                                {isActive
                                  ? language === "ru"
                                    ? "Не актив"
                                    : language === "en"
                                      ? "Deactivate"
                                      : "Noaktiv qilish"
                                  : language === "ru"
                                    ? "Активный"
                                    : language === "en"
                                      ? "Activate"
                                      : "Aktiv qilish"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      );
                    }

                    const val = (row as any)[c.key as any];
                    return (
                      <td key={String(c.key)} className="px-4 py-3 text-sm text-slate-900">
                        {c.render ? c.render(row) : val ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
/** =========================
 *  Main Component
 *  ========================= */
export default function TabsCrud() {
  const { language } = useI18n();
  const copy = useMemo(() => getTabsCrudCopy(language), [language]);
  const tabs: AnyTabDef[] = useMemo(
    () => [
      {
        key: "employee",
        label: language === "ru" ? "Сотрудник" : language === "en" ? "Employees" : "Hodimlar",
        addLabel: language === "ru" ? "Новый сотрудник" : language === "en" ? "New employee" : "Yangi hodim",
        listTitle: language === "ru" ? "Список сотрудников" : language === "en" ? "Employee list" : "Hodimlar ro'yxati",
        columns: [
          { key: "name", title: language === "ru" ? "Названия" : language === "en" ? "Name" : "Ismi" },
          { key: "position", title: language === "ru" ? "Должность" : language === "en" ? "Position" : "Lavozimi" },
          { key: "phone", title: language === "ru" ? "Телефон" : language === "en" ? "Phone" : "Telefon" },
          { key: "salary", title: language === "ru" ? "Зарплата" : language === "en" ? "Salary" : "Maoshi", render: (r) => (r.salary != null ? Number(r.salary).toLocaleString() : "-") },
          { key: "currency", title: language === "ru" ? "Валюта" : language === "en" ? "Currency" : "Valyuta", render: (r) => r.currency || "-" },
          { key: "isActive", title: language === "ru" ? "Актив" : language === "en" ? "Active" : "Holati", render: (r) => <StatusBadge active={r.isActive} /> },
        ],
      },
      {
        key: "client",
        label: language === "ru" ? "Контрагент" : language === "en" ? "Clients" : "Mijozlar",
        addLabel: language === "ru" ? "Новый контрагент" : language === "en" ? "New client" : "Yangi mijoz",
        listTitle: language === "ru" ? "Список контрагентов" : language === "en" ? "Client list" : "Mijozlar ro'yxati",
        columns: [
          { key: "code", title: language === "ru" ? "Код" : language === "en" ? "Code" : "Kodi", render: (r) => formatEntityCode(r.code, r.id) },
          { key: "name", title: language === "ru" ? "Название" : language === "en" ? "Name" : "Nomi" },
          { key: "taxId", title: language === "uz" ? "STIR" : "INN" },
          { key: "phone", title: language === "ru" ? "Телефон" : language === "en" ? "Phone" : "Telefon" },
          { key: "email", title: "Email", render: (r) => r.email || "-" },
          { key: "isActive", title: language === "ru" ? "Актив" : language === "en" ? "Active" : "Holati", render: (r) => <StatusBadge active={r.isActive} /> },
        ],
      },
      {
        key: "supplier",
        label: language === "ru" ? "Поставщик" : language === "en" ? "Suppliers" : "Yetkazib beruvchilar",
        addLabel: language === "ru" ? "Новый поставщик" : language === "en" ? "New supplier" : "Yangi yetkazib beruvchi",
        listTitle: language === "ru" ? "Список поставщиков" : language === "en" ? "Supplier list" : "Yetkazib beruvchilar ro'yxati",
        columns: [
          { key: "code", title: language === "ru" ? "Код" : language === "en" ? "Code" : "Kodi", render: (r) => formatEntityCode(r.code, r.id) },
          { key: "name", title: language === "ru" ? "Название" : language === "en" ? "Name" : "Nomi" },
          { key: "taxId", title: language === "uz" ? "STIR" : "INN" },
          { key: "phone", title: language === "ru" ? "Телефон" : language === "en" ? "Phone" : "Telefon" },
          { key: "email", title: "Email", render: (r) => r.email || "-" },
          { key: "isActive", title: language === "ru" ? "Актив" : language === "en" ? "Active" : "Holati", render: (r) => <StatusBadge active={r.isActive} /> },
        ],
      },
    ],
    [language]
  );

  const [activeTab, setActiveTab] = useState<TabKey>("employee");
  const [store, setStore] = useState<Store>(() =>
    loadLS<Store>(LS_KEY, {
      employee: [],
      client: [],
      supplier: [],
    })
  );
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "true" | "false">("ALL");
  const [ordering, setOrdering] = useState<OrderingValue>("-created_at");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [totals, setTotals] = useState<Record<TabKey, number>>({
    employee: 0,
    client: 0,
    supplier: 0,
  });

  useEffect(() => {
    saveLS(LS_KEY, store);
  }, [store]);

  const tabDef = tabs.find((t) => t.key === activeTab)!;
  const activeTabCopy = copy.tabs[activeTab];

  async function loadTabData(
    tabKey: TabKey = activeTab,
    targetPage: number = page,
    searchText: string = query,
    activeStatus: "ALL" | "true" | "false" = statusFilter,
    sortOrder: OrderingValue = ordering
  ) {
    if (!USE_API) return;

    const isActive = activeStatus === "ALL" ? undefined : activeStatus === "true";

    if (tabKey === "employee") {
      const res = await apiAxios.listEmployeesPage({
        page: targetPage,
        page_size: pageSize,
        search: searchText || undefined,
        ordering: sortOrder,
        is_active: isActive,
      });
      setStore((p) => ({ ...p, employee: res.items }));
      setTotals((p) => ({ ...p, employee: res.total }));
      return;
    }

    if (tabKey === "client") {
      const res = await apiAxios.listClientsPage({
        page: targetPage,
        page_size: pageSize,
        search: searchText || undefined,
        ordering: sortOrder,
        is_active: isActive,
      });
      setStore((p) => ({ ...p, client: res.items }));
      setTotals((p) => ({ ...p, client: res.total }));
      return;
    }

    const res = await apiAxios.listSuppliersPage({
      page: targetPage,
      page_size: pageSize,
      search: searchText || undefined,
      ordering: sortOrder,
      is_active: isActive,
    });
    setStore((p) => ({ ...p, supplier: res.items }));
    setTotals((p) => ({ ...p, supplier: res.total }));
  }

  useEffect(() => {
    setPage(1);
  }, [activeTab, query, statusFilter, ordering]);

  useEffect(() => {
    if (!USE_API) return;

    (async () => {
      try {
        await loadTabData(activeTab, page, query, statusFilter);
      } catch (err: any) {
        console.error(err);
        toast.error(String(err?.response?.data?.detail || err?.message || copy.listLoadError));
      }
    })();
  }, [activeTab, page, pageSize, query, statusFilter, ordering, copy.listLoadError]);

  const rows = store[activeTab] as EntityMap[typeof activeTab][];

  const filtered = useMemo(() => {
    if (USE_API) return rows;
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      for (const [, v] of Object.entries(r as any)) {
        if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
        if (typeof v === "number" && String(v).includes(q)) return true;
      }
      return false;
    });
  }, [rows, query]);

  const total = USE_API ? totals[activeTab] : filtered.length;
  const paged = useMemo(() => {
    if (USE_API) return rows;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, rows]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
  }, [rows, activeTab]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Delete confirm dialog (shadcn) holati.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard">("soft");
  const [deleting, setDeleting] = useState(false);

  const selectedRow = useMemo(() => {
    if (!selectedId) return null;
    return (store[activeTab] as any[]).find((x) => x.id === selectedId) ?? null;
  }, [activeTab, selectedId, store]);

  function openCreate() {
    setMode("create");
    setSelectedId(null);
    setModalOpen(true);
  }
  async function openEntityModal(nextMode: Mode, id: string) {
    if (USE_API) {
      try {
        const detail = await apiAxios.detail(activeTab as any, id);
        setStore((p) => ({
          ...p,
          [activeTab]: (p[activeTab] as any[]).map((x) => (x.id === id ? detail : x)),
        }));
      } catch (e: any) {
        toast.error(String(e?.response?.data?.detail || e?.message || copy.detailLoadError));
      }
    }
    setMode(nextMode);
    setSelectedId(id);
    setModalOpen(true);
  }
  async function openView(id: string) {
    await openEntityModal("view", id);
  }
  async function openEdit(id: string) {
    await openEntityModal("edit", id);
  }
  function closeModal() {
    setModalOpen(false);
    setSelectedId(null);
  }

  // ✅ create row TO target tab
  async function createRowTo(tabKey: TabKey, payload: any) {
    if (USE_API) {
      await apiAxios.create(tabKey as any, payload);
      setPage(1);
      await loadTabData(tabKey, 1, query, statusFilter, ordering);
      return;
    }

    const created = { ...payload, id: uid(), createdAt: nowISO() };
    setStore((p) => ({ ...p, [tabKey]: [created, ...(p[tabKey] as any[])] }));
  }

  async function updateRow(id: string, payload: any) {
    if (USE_API) {
      await apiAxios.update(activeTab as any, id, payload);
      await loadTabData(activeTab, page, query, statusFilter, ordering);
      return;
    }

    setStore((p) => ({
      ...p,
      [activeTab]: (p[activeTab] as any[]).map((x) => (x.id === id ? { ...x, ...payload } : x)),
    }));
  }

  function requestDeleteRow(id: string, mode: "soft" | "hard" = "soft") {
    setDeleteTargetId(id);
    setDeleteMode(mode);
    setDeleteOpen(true);
  }

  function requestDeleteSelected(mode: "soft" | "hard" = "soft") {
    if (selectedIds.length === 0) return;
    setDeleteTargetId(null);
    setDeleteMode(mode);
    setDeleteOpen(true);
  }

  async function removeRow(id: string, mode: "soft" | "hard") {
    try {
      setDeleting(true);
      if (USE_API) {
        if (mode === "hard") await apiAxios.hardDelete(activeTab as any, id);
        else await apiAxios.remove(activeTab as any, id);
        await loadTabData(activeTab, page, query, statusFilter, ordering);
      } else {
        setStore((p) => ({ ...p, [activeTab]: (p[activeTab] as any[]).filter((x) => x.id !== id) }));
      }
      setSelectedIds((prev) => prev.filter((selected) => selected !== id));
      toast.success(mode === "hard" ? copy.deletedHard : copy.deleted);
    } catch (e: any) {
      const data = e?.response?.data;
      const msg = typeof data === "string" ? data : data?.detail || e?.message || copy.deleteError;
      toast.error(String(msg));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
      setDeleteTargetId(null);
    }
  }

  async function removeSelectedRows(mode: "soft" | "hard") {
    if (selectedIds.length === 0) return;
    try {
      setDeleting(true);
      if (USE_API) {
        if (mode === "hard") {
          await Promise.all(selectedIds.map((id) => apiAxios.hardDelete(activeTab as any, id)));
        } else {
          await Promise.all(selectedIds.map((id) => apiAxios.remove(activeTab as any, id)));
        }
        await loadTabData(activeTab, page, query, statusFilter, ordering);
      } else {
        setStore((p) => ({
          ...p,
          [activeTab]: (p[activeTab] as any[]).filter((x) => !selectedIds.includes(x.id)),
        }));
      }
      setSelectedIds([]);
      toast.success(mode === "hard" ? copy.deletedHard : copy.deleted);
    } catch (e: any) {
      const data = e?.response?.data;
      const msg = typeof data === "string" ? data : data?.detail || e?.message || copy.deleteError;
      toast.error(String(msg));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
      setDeleteTargetId(null);
    }
  }

  async function toggleActiveRow(id: string, nextActive: boolean) {
    if (!USE_API) return;
    try {
      if (nextActive) await apiAxios.activate(activeTab as any, id);
      else await apiAxios.deactivate(activeTab as any, id);
      await loadTabData(activeTab, page, query, statusFilter, ordering);
      toast.success(nextActive ? copy.activated : copy.deactivated);
    } catch (e: any) {
      toast.error(String(e?.response?.data?.detail || e?.message || copy.statusError));
    }
  }

  const formNode = useMemo(() => {
    // ✅ universal submit for create/edit
    const handleEntitySubmit = async (values: any) => {
      try {
        if (mode === "create") {
          const targetTab = activeTab;
          await createRowTo(targetTab, values);
          setActiveTab(targetTab);
          toast.success(copy.created);
        }

        if (mode === "edit" && selectedId) {
          await updateRow(selectedId, values);
          toast.success(copy.updated);
        }

        closeModal();
      } catch (e: any) {
        const data = e?.response?.data
        const msg =
          typeof data === "string"
            ? data
            : data?.detail || (data ? JSON.stringify(data) : e?.message || copy.savedError)
        toast.error(msg)
        console.error("TabsCrud submit error:", e)
      }
    };

    if (activeTab === "employee") {
      return (
        <EmployeeForm
          mode={mode}
          defaultValues={mode === "create" ? { type: "EMPLOYEE" } as any : (selectedRow as any) ?? undefined}
          onSubmit={handleEntitySubmit as any}
        />
      );
    }

    if (activeTab === "client") {
      return (
        <ClientForm
          mode={mode}
          defaultValues={mode === "create" ? { type: "CLIENT" } as any : (selectedRow as any) ?? undefined}
          onSubmit={handleEntitySubmit as any}
        />
      );
    }

    return (
      <SupplierForm
        mode={mode}
        defaultValues={mode === "create" ? { type: "SUPPLIER" } as any : (selectedRow as any) ?? undefined}
        onSubmit={handleEntitySubmit as any}
      />
    );
  }, [activeTab, mode, selectedId, selectedRow, copy, ordering, page, query, statusFilter]);

  return (
    <div className="min-h-[570px] space-y-4 p-4 font-sans text-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">{tabDef.listTitle}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            data-slot="button"
            type="button"
            onClick={() => requestDeleteSelected()}
            disabled={selectedIds.length === 0}
            className="employee-delete-button h-12 rounded-2xl !border !border-rose-700 !bg-rose-600 px-5 text-sm font-semibold !text-white shadow-[0_14px_28px_rgba(225,29,72,0.22)] transition hover:!bg-rose-700 disabled:cursor-not-allowed disabled:!border-rose-200 disabled:!bg-rose-200 disabled:!text-white/80 disabled:opacity-50"
          >
            {copy.delete}
          </button>
          <button
            className={`h-12 rounded-2xl px-5 text-sm font-semibold ${PRIMARY_BUTTON}`}
            onClick={openCreate}
            type="button"
          >
            + {tabDef.addLabel}
          </button>
        </div>
      </div>

      <div className="flex w-fit flex-wrap gap-2 rounded-[26px] border border-slate-200 bg-slate-50/95 p-2 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.18)]">
        {tabs.map((t) => {
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={pageTabClass(isActive, "rounded-[18px] px-5 py-2.5 font-semibold")}
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="text-base font-medium text-slate-900">{copy.filtersTitle}</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">{copy.statusLabel}</div>
            <FilterSelect value={statusFilter} onChange={(value) => setStatusFilter(value as "ALL" | "true" | "false")}>
              <option value="ALL">{copy.all}</option>
              <option value="true">{copy.onlyActive}</option>
              <option value="false">{copy.onlyInactive}</option>
            </FilterSelect>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">{copy.searchLabel}</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                activeTab === "employee"
                  ? language === "ru"
                    ? "Имя, телефон или должность"
                    : language === "en"
                      ? "Name, phone or position"
                      : "Ism, telefon yoki lavozim"
                  : language === "ru"
                    ? "Название, телефон, email или ИНН"
                    : language === "en"
                      ? "Name, phone, email or TIN"
                      : "Nomi, telefon, email yoki STIR"
              }
              className="h-12 w-full rounded-2xl border border-blue-600 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500">{copy.sortLabel}</div>
            <FilterSelect value={ordering} onChange={(value) => setOrdering(value as OrderingValue)}>
              <option value="-created_at">{copy.newestFirst}</option>
              <option value="created_at">{copy.oldestFirst}</option>
              <option value="name">A-Z</option>
              <option value="-name">Z-A</option>
            </FilterSelect>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-transparent">{copy.clearLabel}</div>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("ALL");
                setOrdering("-created_at");
                setPage(1);
              }}
              className={`h-12 w-full rounded-2xl px-4 text-sm font-semibold ${PRIMARY_BUTTON}`}
            >
              {copy.clear}
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={tabDef.columns as any}
        rows={paged as any}
        copy={copy}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={openView}
        onView={openView}
        onEdit={openEdit}
        onDelete={requestDeleteRow}
        onRestore={undefined}
        onHardDelete={undefined}
        onToggleActive={toggleActiveRow}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        copy={copy}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        closeLabel={copy.close}
        title={mode === "create" ? tabDef.addLabel : mode === "edit" ? activeTabCopy.editTitle : activeTabCopy.viewTitle}
        footer={
          <div className="flex justify-end">
            <button
              onClick={closeModal}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-900 hover:bg-slate-100"
              type="button"
            >
              {copy.close}
            </button>
          </div>
        }
      >
        {formNode}
      </Modal>

      <DeleteAlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteTargetId(null);
        }}
        title={deleteMode === "hard" ? copy.deleteTitleHard : copy.deleteTitleSoft}
        description={
          deleteTargetId
            ? deleteMode === "hard"
              ? copy.deleteHardDescription
              : copy.deleteSoftDescription
            : selectedIds.length > 1
              ? `${selectedIds.length} ta yozuv o'chirilsinmi?`
              : copy.deleteSoftDescription
        }
        loading={deleting}
        onConfirm={() => {
          if (deleteTargetId) {
            void removeRow(deleteTargetId, deleteMode);
            return;
          }
          void removeSelectedRows(deleteMode);
        }}
      />
    </div>
  );
}

