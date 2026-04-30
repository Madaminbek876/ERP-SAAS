import React from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.title}>{title}</div>
          <button style={s.x} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={s.body}>{children}</div>
        {footer ? <div style={s.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 50,
  },
  modal: {
    width: "min(760px, 96vw)",
    borderRadius: 18,
    background: "white",
    boxShadow: "0 24px 80px rgba(0,0,0,.28)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  title: { fontSize: 16, fontWeight: 900 },
  x: {
    border: "1px solid #e2e8f0",
    background: "white",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 800,
  },
  body: { padding: 16 },
  footer: { padding: 12, borderTop: "1px solid #e2e8f0", background: "#fafafa" },
};
