"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;
const SelectGroup = SelectPrimitive.Group;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-11 w-full items-center justify-between rounded-lg border border-border bg-white px-3.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

// Radix's own ScrollUpButton/ScrollDownButton — not a manually-tracked
// scroll-position system — render exactly when scrolling in that direction
// is actually possible, and disappear the instant the viewport reaches
// that edge. Undecorated by default, so all sizing/color below is this
// repo's own styling on top of Radix's built-in show/hide logic.
const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex h-7 cursor-default items-center justify-center bg-white text-primary/60", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" aria-hidden="true" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex h-7 cursor-default items-center justify-center bg-white text-primary/60", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" aria-hidden="true" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        // A fixed 300px desktop ceiling (within the 240–320px comfortable
        // range) wrapped in min() against Radix's own
        // --radix-select-content-available-height custom property — the
        // documented, built-in way to keep the menu from ever extending
        // past the actual viewport on a short screen, without any manual
        // viewport math.
        "z-50 max-h-[min(300px,var(--radix-select-content-available-height))] min-w-[8rem] overflow-hidden rounded-lg border border-border bg-white shadow-card animate-fade-in",
        position === "popper" && "translate-y-1",
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm text-ink outline-none data-[highlighted]:bg-surface data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectScrollUpButton, SelectScrollDownButton, SelectItem };
