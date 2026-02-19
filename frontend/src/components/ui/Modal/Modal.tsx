import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "src/icons";
import "./Modal.scss";

type ModalSize = "sm" | "md" | "lg" | "xl";

export type ModalProps = {
  open?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  onEntered?: () => void;
  onExited?: () => void;
  show?: boolean;
  onHide?: () => void;
  centered?: boolean;
  "aria-labelledby"?: string;
};

type ModalHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  closeButton?: boolean;
  closeLabel?: string;
};

type ModalBodyProps = React.HTMLAttributes<HTMLDivElement>;
type ModalFooterProps = React.HTMLAttributes<HTMLDivElement>;
type ModalTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

const ANIMATION_MS = 200;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const ModalCloseContext = createContext<(() => void) | null>(null);

const getFocusableElements = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
    return element.offsetParent !== null || element === document.activeElement;
  });

function ModalHeader(props: ModalHeaderProps) {
  const {
    closeButton = false,
    closeLabel = "Cerrar modal",
    className,
    children,
    ...rest
  } = props;
  const onClose = useContext(ModalCloseContext);

  return (
    <div
      {...rest}
      className={["bb-ui-modal__header", "modal-header", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      {closeButton ? (
        <button
          type="button"
          className="bb-ui-modal__close btn-close"
          onClick={onClose ?? undefined}
          aria-label={closeLabel}
        >
          <X aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ModalBody(props: ModalBodyProps) {
  const { className, ...rest } = props;
  return (
    <div
      {...rest}
      className={["bb-ui-modal__body", "modal-body", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

function ModalFooter(props: ModalFooterProps) {
  const { className, ...rest } = props;
  return (
    <div
      {...rest}
      className={["bb-ui-modal__footer", "modal-footer", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

function ModalTitle(props: ModalTitleProps) {
  const { className, ...rest } = props;
  return (
    <h2
      {...rest}
      className={["bb-ui-modal__title", "modal-title", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

function ModalRoot(props: ModalProps) {
  const {
    open,
    show,
    onClose,
    onHide,
    title,
    size = "md",
    children,
    footer,
    className,
    closeOnOverlayClick = true,
    closeOnEsc = true,
    onEntered,
    onExited,
    centered = true,
    "aria-labelledby": ariaLabelledByProp,
  } = props;

  const isOpen = Boolean(open ?? show);
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    if (onHide) {
      onHide();
    }
  }, [onClose, onHide]);

  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const resolvedAriaLabelledBy = useMemo(
    () => ariaLabelledByProp ?? (title ? titleId : undefined),
    [ariaLabelledByProp, title, titleId],
  );
  const shouldRenderShell = Boolean(title || footer);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const raf = window.requestAnimationFrame(() => setIsVisible(true));
      const enteredTimer = window.setTimeout(() => {
        onEntered?.();
      }, ANIMATION_MS);
      return () => {
        window.cancelAnimationFrame(raf);
        window.clearTimeout(enteredTimer);
      };
    }

    if (!isMounted) return;
    setIsVisible(false);
    const exitedTimer = window.setTimeout(() => {
      setIsMounted(false);
      onExited?.();
    }, ANIMATION_MS);
    return () => window.clearTimeout(exitedTimer);
  }, [isMounted, isOpen, onEntered, onExited]);

  useEffect(() => {
    if (!isMounted) return;
    const lockCount = Number(document.body.dataset.bbModalLockCount ?? "0");
    if (lockCount === 0) {
      document.body.dataset.bbModalPreviousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    document.body.dataset.bbModalLockCount = String(lockCount + 1);

    return () => {
      const nextLockCount = Math.max(0, Number(document.body.dataset.bbModalLockCount ?? "1") - 1);
      if (nextLockCount === 0) {
        document.body.style.overflow = document.body.dataset.bbModalPreviousOverflow ?? "";
        delete document.body.dataset.bbModalLockCount;
        delete document.body.dataset.bbModalPreviousOverflow;
      } else {
        document.body.dataset.bbModalLockCount = String(nextLockCount);
      }
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || !isOpen) return;
    const focusTimer = window.setTimeout(() => {
      const content = contentRef.current;
      if (!content) return;
      const focusable = getFocusableElements(content);
      if (focusable.length > 0) {
        focusable[0].focus();
        return;
      }
      content.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [isMounted, isOpen]);

  useEffect(() => {
    if (!isMounted || !isOpen) return;

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEsc) {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== "Tab") return;
      const content = contentRef.current;
      if (!content) return;

      const focusable = getFocusableElements(content);
      if (focusable.length === 0) {
        event.preventDefault();
        content.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === content)) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [closeOnEsc, handleClose, isMounted, isOpen]);

  if (!isMounted) {
    return null;
  }

  const dialogSizeClass =
    size === "sm"
      ? "modal-sm"
      : size === "lg"
        ? "modal-lg"
        : size === "xl"
          ? "modal-xl"
          : "";

  return createPortal(
    <ModalCloseContext.Provider value={handleClose}>
      <div className={["bb-ui-modal", "modal", "fade", isVisible ? "show" : "", className ?? ""].filter(Boolean).join(" ")}>
        <div
          className={["bb-ui-modal__backdrop", "modal-backdrop", "fade", isVisible ? "show" : ""].filter(Boolean).join(" ")}
          onMouseDown={() => {
            if (closeOnOverlayClick) {
              handleClose();
            }
          }}
          aria-hidden="true"
        />

        <div className="bb-ui-modal__viewport">
          <div
            className={[
              "bb-ui-modal__dialog",
              "modal-dialog",
              centered ? "modal-dialog-centered" : "",
              dialogSizeClass,
            ]
              .filter(Boolean)
              .join(" ")}
            role="dialog"
            aria-modal="true"
            aria-labelledby={resolvedAriaLabelledBy}
          >
            <div className="bb-ui-modal__content modal-content" ref={contentRef} tabIndex={-1}>
              {shouldRenderShell ? (
                <>
                  {title ? (
                    <ModalHeader closeButton closeLabel="Cerrar modal">
                      <ModalTitle id={titleId}>{title}</ModalTitle>
                    </ModalHeader>
                  ) : null}
                  <ModalBody>{children}</ModalBody>
                  {footer ? <ModalFooter>{footer}</ModalFooter> : null}
                </>
              ) : (
                children
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalCloseContext.Provider>,
    document.body,
  );
}

type ModalCompoundComponent = typeof ModalRoot & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
  Title: typeof ModalTitle;
};

export const Modal: ModalCompoundComponent = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
  Title: ModalTitle,
});
