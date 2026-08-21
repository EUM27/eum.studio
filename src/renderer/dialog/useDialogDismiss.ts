import {
  useCallback,
  useEffect,
  useRef,
  type PointerEventHandler,
} from "react";

const dismissStack: symbol[] = [];

export function useDialogDismiss(input: {
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClose: () => void;
}): PointerEventHandler<HTMLDivElement> {
  const tokenRef = useRef(Symbol("dialog-dismiss"));
  const closeRef = useRef(input.onClose);
  const disabledRef = useRef(input.disabled === true);
  const active = input.active !== false;

  useEffect(() => {
    closeRef.current = input.onClose;
    disabledRef.current = input.disabled === true;
  }, [input.disabled, input.onClose]);

  useEffect(() => {
    if (!active) return;
    const token = tokenRef.current;
    dismissStack.push(token);
    const closeWithEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        dismissStack.at(-1) !== token
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!disabledRef.current) closeRef.current();
    };
    document.addEventListener("keydown", closeWithEscape, true);
    return () => {
      document.removeEventListener("keydown", closeWithEscape, true);
      const index = dismissStack.lastIndexOf(token);
      if (index >= 0) dismissStack.splice(index, 1);
    };
  }, [active]);

  return useCallback((event) => {
    if (
      event.target === event.currentTarget &&
      !disabledRef.current &&
      dismissStack.at(-1) === tokenRef.current
    ) {
      closeRef.current();
    }
  }, []);
}
