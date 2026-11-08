import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible confirmation dialog: focus starts on "cancel", Escape cancels, Tab stays inside, focus returns afterwards. */
export default function ConfirmDialog({ open, title, message, confirmLabel, busy = false, onConfirm, onCancel }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelBtn.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
    if (e.key === "Escape" && !busy) { onCancel(); return; }
    if (e.key !== "Tab") return;
    const items = Array.from(box.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center" onKeyDown={onKeyDown}>
      <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-msg"
           className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-[#121833]">
        <h2 id="cd-title" className="text-lg font-bold">{title}</h2>
        <p id="cd-msg" className="muted mt-2 text-sm">{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
          <button ref={cancelBtn} type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>انصراف</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? "در حال حذف…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
