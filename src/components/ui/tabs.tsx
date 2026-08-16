"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

// Mirrors the premium pill/segmented-control pattern already used for the
// Leasing/Αγορά switch on the vehicle-detail page (rounded-full track,
// deep-navy active trigger) — deliberately reused here rather than
// invented fresh, so the two selectors on the same page read as one design
// language rather than two competing tab systems.
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex items-center gap-1 rounded-full border border-[#dfe8ed] bg-[#f7fafc] p-1", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-extrabold text-[#8a97a5] transition-colors duration-150 ease-out motion-reduce:transition-none",
      "hover:text-detail-title",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
      "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-soft data-[state=active]:hover:text-white",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("focus-visible:outline-none data-[state=active]:animate-fade-in motion-reduce:animate-none", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
