"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

// Shared between one AccordionItem's own Trigger and Content below — a
// plain mutable ref (not state) so toggling it never causes a re-render.
// See AccordionTrigger's comment for what this actually guards against.
const AccordionLockContext = React.createContext<React.MutableRefObject<boolean> | null>(null);

// Radix's own open/close height measurement (react-collapsible's
// CollapsibleContentImpl) briefly clears `animation-name` to remeasure the
// content's real height on every toggle. If that remeasure lands mid-way
// through a still-running open/close animation, the box has no height
// constraint outside the animation for that instant and snaps to its full
// intrinsic height before the new animation starts — a visible flash.
// Ignoring a second click on this item's own trigger while its animation is
// still running means every toggle always starts from a fully-settled
// state, so that remeasure can never land mid-flight.
//
// The lock is released by the *animationend* event for accordion-down/up
// (see AccordionItem below), not a fixed timer — a timer sized to the
// nominal 200ms duration was still occasionally too short under real
// main-thread jank (a delayed React commit pushes the actual animation's
// start, and therefore its end, later than the click timestamp + 200ms
// would assume), which is exactly why the flash got rarer but not gone
// after that first attempt. Tying the unlock to the real animation
// finishing removes that timing assumption entirely. A generous fallback
// timeout still exists only to self-heal if animationend is ever missed
// (e.g. the tab was backgrounded mid-animation) — not the primary release.
const ACCORDION_LOCK_FALLBACK_MS = 600;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, onAnimationEnd, ...props }, ref) => {
  const lockedRef = React.useRef(false);

  const handleAnimationEnd = React.useCallback(
    (event: React.AnimationEvent<HTMLDivElement>) => {
      if (event.animationName === "accordion-down" || event.animationName === "accordion-up") {
        lockedRef.current = false;
      }
      onAnimationEnd?.(event);
    },
    [onAnimationEnd],
  );

  return (
    <AccordionLockContext.Provider value={lockedRef}>
      <AccordionPrimitive.Item
        ref={ref}
        className={cn("border-b border-border", className)}
        onAnimationEnd={handleAnimationEnd}
        {...props}
      />
    </AccordionLockContext.Provider>
  );
});
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, onClick, ...props }, ref) => {
  const lockedRef = React.useContext(AccordionLockContext);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (lockedRef?.current) {
        event.preventDefault();
        return;
      }
      if (lockedRef) {
        lockedRef.current = true;
        window.setTimeout(() => {
          lockedRef.current = false;
        }, ACCORDION_LOCK_FALLBACK_MS);
      }
      onClick?.(event);
    },
    [onClick, lockedRef],
  );

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        onClick={handleClick}
        className={cn(
          "group flex flex-1 items-center justify-between py-4 text-left text-sm font-medium text-ink transition-all",
          className,
        )}
        {...props}
      >
        {children}
        <span className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 group-hover:bg-black/[0.04]">
          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 text-ink-muted", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
