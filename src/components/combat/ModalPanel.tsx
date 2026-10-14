import { useEffect, useRef, type ReactNode } from "react";

export function ModalPanel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="battle-panel"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="battle-panel-heading">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label={`Close ${title}`}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
