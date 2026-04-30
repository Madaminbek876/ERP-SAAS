import React from "react"
import { useI18n } from "@/i18n"

export type ColumnDef<T> = {
  key: keyof T | "actions"
  title: string
  render?: (row: T) => React.ReactNode
}

type Props<T extends { id: string }> = {
  columns: ColumnDef<T>[]
  rows: T[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function IconEye() {
  return <span style={{ fontSize: 14 }}>View</span>
}
function IconEdit() {
  return <span style={{ fontSize: 14 }}>Edit</span>
}
function IconTrash() {
  return <span style={{ fontSize: 14 }}>Del</span>
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onView,
  onEdit,
  onDelete,
}: Props<T>) {
  const { language } = useI18n()
  const copy =
    language === "ru"
      ? { noData: "Нет данных", view: "Просмотр", edit: "Редактировать", delete: "Удалить" }
      : language === "en"
        ? { noData: "No data", view: "View", edit: "Edit", delete: "Delete" }
        : { noData: "Ma'lumot yo'q", view: "Ko'rish", edit: "Tahrirlash", delete: "O'chirish" }

  return (
    <div style={styles.wrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)} style={styles.th}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td style={styles.td} colSpan={columns.length}>
                {copy.noData}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} style={styles.tr}>
                {columns.map((c) => {
                  if (c.key === "actions") {
                    return (
                      <td key="actions" style={styles.td}>
                        <div style={styles.actions}>
                          <button style={styles.btn} onClick={() => onView(row.id)} title={copy.view}>
                            <IconEye />
                          </button>
                          <button style={styles.btn} onClick={() => onEdit(row.id)} title={copy.edit}>
                            <IconEdit />
                          </button>
                          <button
                            style={{ ...styles.btn, ...styles.danger }}
                            onClick={() => onDelete(row.id)}
                            title={copy.delete}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    )
                  }

                  const val = (row as any)[c.key as any]
                  return (
                    <td key={String(c.key)} style={styles.td}>
                      {c.render ? c.render(row) : (val ?? "")}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    overflow: "hidden",
    background: "white",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    background: "#f8fafc",
    padding: "12px",
    fontSize: 12,
    color: "#334155",
    borderBottom: "1px solid #e2e8f0",
  },
  tr: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "12px", fontSize: 13, color: "#0f172a" },
  actions: { display: "flex", gap: 10 },
  btn: {
    border: "1px solid #e2e8f0",
    background: "white",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
  },
  danger: { borderColor: "#fecaca", background: "#fff1f2" },
}
