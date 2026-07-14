"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

// Hand-rolled accessible toggle — no @radix-ui/react-switch in package.json
// and this task must not add a dependency. `role="switch"` + `aria-checked`
// on a real <button> gives the same semantics Radix's primitive would,
// without installing anything.
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, id, className, ...aria }, ref) => {
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-border",
          className,
        )}
        {...aria}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-soft transition-transform motion-reduce:transition-none",
            checked && "translate-x-[22px]",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";
