"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A small, self-contained dropdown shared by the two dropdowns in the
 * public Navbar: the desktop "Η Εταιρεία μας" nav dropdown (nav.tsx,
 * `openOn="hover"`) and the authenticated account menu (header.tsx,
 * default `openOn="click"`). Click/keyboard activation always works
 * regardless of `openOn` — hover is an *additional* way in for mouse
 * users on the consumer that opts in, not a replacement for it — so
 * neither consumer ever loses keyboard/touch access.
 *
 * Deliberately not a full ARIA `menu` widget (no roving tabindex/arrow-key
 * navigation) since neither consumer needs that; the panel's own links
 * are just normal, individually Tab-able anchors once visible.
 * `visibility` (via Tailwind's `invisible`) on the closed panel — not
 * just `opacity` — is what actually keeps its links out of the Tab order
 * and hit-testing while hidden, so no separate `tabIndex`/click-guard is
 * needed per child. Clicking anywhere inside the panel (typically one of
 * its links) closes it, so it never lingers open after a same-app
 * navigation to a page that keeps this component mounted.
 */
export function NavDropdown({
  trigger,
  triggerClassName,
  panelClassName,
  align = "left",
  openOn = "click",
  children,
}: {
  trigger: (state: { open: boolean }) => React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  align?: "left" | "right";
  openOn?: "click" | "hover";
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Cancel any pending hover-close on unmount so it never fires a state
  // update after this component is gone.
  React.useEffect(() => () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  // Attached to the OUTER container (trigger + panel together). The
  // trigger's own box is the container's *only* in-flow content — the
  // panel is `position: absolute`, so it contributes no height to the
  // container — which means the few px of visual gap between them
  // (`mt-1.5` below) is genuinely empty space, not part of any element's
  // hit-box. The browser fires `mouseleave` the instant the pointer
  // enters that empty gap, same as it would leaving the trigger for
  // anything else outside this component — it does NOT wait for the
  // pointer to clear the whole container+panel pair. So closing can't
  // rely on that not happening; instead every close is delayed long
  // enough for a normal (if imprecise) mouse move to land back inside
  // either the trigger or the panel, and `mouseenter` on whichever one it
  // reaches cancels the pending close.
  function handleMouseEnter() {
    if (openOn !== "hover") return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
  }
  function handleMouseLeave() {
    if (openOn !== "hover") return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 300);
  }

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className={triggerClassName}
      >
        {trigger({ open })}
      </button>
      <div
        id={panelId}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={cn(
          "absolute top-full z-50 mt-1.5 min-w-[9rem] rounded-lg border border-border bg-white p-1.5 shadow-card transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          align === "left" ? "left-0" : "right-0",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
