"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { createLeadSchema, type CreateLeadInput } from "@/lib/validators/lead.schema";

type InterestType = CreateLeadInput["interestType"];

const INTEREST_LABELS: Record<InterestType, string> = {
  LEASING: "Ενδιαφέρον για Leasing",
  FINANCING: "Ενδιαφέρον για Δανειοδότηση",
  TEST_DRIVE: "Κράτηση Test Drive",
  GENERAL: "Ερώτηση για το όχημα",
  PURCHASE: "Ενδιαφέρον για Αγορά",
};

// Matches the Kinsen premium easing used elsewhere (navigation loader, hero
// heading) so all motion across the site reads as one consistent system.
const PANEL_EASE = [0.22, 1, 0.36, 1] as const;

// One shared modal state owner for every interest CTA on the vehicle-detail
// page. Previously each button rendered its own independent <Dialog>, so
// two triggers could genuinely both be "open" at once (nothing coordinated
// them) and every open/close remounted a full Radix Dialog tree from
// scratch. A single `activeModal` value makes "more than one open" a type
// error, not just a UX mistake.
interface InterestModalContextValue {
  open: (type: InterestType) => void;
}

const InterestModalContext = React.createContext<InterestModalContextValue | null>(null);

export function useInterestModal() {
  const ctx = React.useContext(InterestModalContext);
  if (!ctx) throw new Error("useInterestModal must be used within an InterestModalProvider");
  return ctx;
}

export function InterestModalProvider({
  vehicleId,
  vehicleLabel,
  children,
}: {
  vehicleId?: string;
  vehicleLabel?: string;
  children: React.ReactNode;
}) {
  const [activeModal, setActiveModal] = React.useState<InterestType | null>(null);
  const lastTriggerRef = React.useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const pathnameAtOpenRef = React.useRef(pathname);
  const shouldReduceMotion = useReducedMotion();

  // A real route change while this modal is open hands loading feedback off
  // to the single global NavigationLoader — the modal must never be left
  // stacked above it, so it closes itself the moment the URL actually moves.
  React.useEffect(() => {
    if (activeModal && pathname !== pathnameAtOpenRef.current) {
      setActiveModal(null);
    }
    pathnameAtOpenRef.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const open = React.useCallback((type: InterestType) => {
    lastTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pathnameAtOpenRef.current = window.location.pathname;
    setActiveModal(type);
  }, []);

  const close = React.useCallback(() => setActiveModal(null), []);

  const contextValue = React.useMemo<InterestModalContextValue>(() => ({ open }), [open]);

  return (
    <InterestModalContext.Provider value={contextValue}>
      {children}
      <DialogPrimitive.Root open={activeModal !== null} onOpenChange={(next) => !next && close()}>
        {/* mode="wait" only matters for the rare case of switching directly
            from one interest type to another (e.g. clicking "Leasing" then
            immediately "Sale") — it guarantees the first panel fully exits
            before the second mounts, so the two can never be visible, or
            racing to unmount, at the same time. */}
        <AnimatePresence mode="wait">
          {activeModal && (
            <DialogPrimitive.Portal forceMount key={activeModal}>
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-[180] bg-[rgba(1,38,56,0.44)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                />
              </DialogPrimitive.Overlay>

              {/* Plain (non-Radix) full-viewport centering shell — deliberately
                  NOT part of Dialog.Content. If Content itself spanned the
                  full viewport, there would be no "outside Content" region
                  left to click, and Radix's own outside-click-to-close would
                  never fire. Keeping Content scoped to just the panel below
                  gives Radix real backdrop space to detect. */}
              <div className="fixed inset-0 z-[180] grid place-items-center p-4 sm:p-6">
                <DialogPrimitive.Content
                  asChild
                  forceMount
                  aria-modal="true"
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    lastTriggerRef.current?.focus();
                  }}
                >
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
                    transition={{ duration: shouldReduceMotion ? 0.01 : 0.24, ease: PANEL_EASE }}
                    style={{ willChange: "transform, opacity" }}
                    className="kinsen-modal-scroll relative max-h-[min(88dvh,760px)] w-full max-w-[min(92vw,640px)] overflow-y-auto overscroll-contain rounded-card border border-border bg-white p-6 shadow-[0_24px_70px_-30px_rgba(1,38,56,0.42)]"
                  >
                    <DialogPrimitive.Close className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-md text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                      <X className="h-4 w-4" />
                      <span className="sr-only">Κλείσιμο</span>
                    </DialogPrimitive.Close>

                    <InterestModalPanel
                      interestType={activeModal}
                      vehicleId={vehicleId}
                      vehicleLabel={vehicleLabel}
                      onClose={close}
                    />
                  </motion.div>
                </DialogPrimitive.Content>
              </div>
            </DialogPrimitive.Portal>
          )}
        </AnimatePresence>
      </DialogPrimitive.Root>
    </InterestModalContext.Provider>
  );
}

// Mounted fresh every time a modal opens (React tears down and recreates
// this whole subtree per open/close cycle via the parent's `key`), so its
// useForm/status state can never leak between opens or between interest
// types — no manual `reset()` call is needed, and because AnimatePresence
// keeps the outgoing instance mounted-but-untouched throughout its exit
// animation, closing never visibly resets or jumps before it fades out.
function InterestModalPanel({
  interestType,
  vehicleId,
  vehicleLabel,
  onClose,
}: {
  interestType: InterestType;
  vehicleId?: string;
  vehicleLabel?: string;
  onClose: () => void;
}) {
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  // One key per modal open (this whole component remounts per open/close —
  // see the comment above InterestModalPanel). Resubmitting after a
  // transient error reuses the same key, so the server treats it as a
  // retry of the same submission, not a new one; closing and reopening the
  // modal generates a fresh key, so a genuinely new submission still works.
  const [submissionId] = React.useState(() => crypto.randomUUID());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
      interestType,
      vehicleId,
      consent: undefined,
      honeypot: "",
      submissionId,
    },
  });

  const consent = watch("consent");

  const onSubmit = async (values: CreateLeadInput) => {
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.status === 429) {
        setStatus("error");
        setErrorMessage("Έχετε υποβάλει πολλά αιτήματα. Δοκιμάστε ξανά σε λίγο.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatus("error");
        setErrorMessage(data?.error ?? "Κάτι πήγε στραβά. Δοκιμάστε ξανά.");
        return;
      }

      setStatus("success");
      toast({
        title: "Το αίτημά σας εστάλη!",
        description: "Ένας σύμβουλός μας θα επικοινωνήσει μαζί σας σύντομα.",
        variant: "success",
      });
      setTimeout(onClose, 1200);
    } catch {
      setStatus("error");
      setErrorMessage("Δεν ήταν δυνατή η αποστολή. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.");
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-1.5 pr-8">
        <DialogPrimitive.Title className="text-lg font-semibold text-primary">
          {INTEREST_LABELS[interestType]}
        </DialogPrimitive.Title>
        <DialogPrimitive.Description className="text-sm text-ink-muted">
          {vehicleLabel ? `Για το όχημα: ${vehicleLabel}. ` : ""}Συμπληρώστε τα στοιχεία σας και θα επικοινωνήσουμε
          μαζί σας το συντομότερο.
        </DialogPrimitive.Description>
      </div>

      {status === "success" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-accent" />
          <p className="font-medium text-ink">Ευχαριστούμε για το ενδιαφέρον σας!</p>
          <p className="text-sm text-ink-muted">Θα επικοινωνήσουμε μαζί σας σύντομα.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input
            type="text"
            {...register("honeypot")}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="im-firstName">Όνομα</Label>
              <Input id="im-firstName" {...register("firstName")} />
              {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="im-lastName">Επώνυμο</Label>
              <Input id="im-lastName" {...register("lastName")} />
              {errors.lastName && <p className="text-xs text-red-600">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="im-email">Email</Label>
              <Input id="im-email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="im-phone">Τηλέφωνο (προαιρετικό)</Label>
              <Input id="im-phone" type="tel" {...register("phone")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="im-message">Μήνυμα (προαιρετικό)</Label>
            <Textarea id="im-message" rows={3} className="min-h-[84px]" {...register("message")} />
          </div>

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="im-consent"
              checked={consent === true}
              onCheckedChange={(checked) => setValue("consent", checked === true ? true : (undefined as never))}
            />
            <Label htmlFor="im-consent" className="text-sm font-normal text-ink-muted">
              Συμφωνώ με την{" "}
              <a href="#" className="text-primary underline-offset-2 hover:underline">
                πολιτική απορρήτου
              </a>
              .
            </Label>
          </div>
          {errors.consent && <p className="text-xs text-red-600">{errors.consent.message}</p>}

          {status === "error" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <Button type="submit" variant="accent" className="w-full" disabled={status === "submitting"}>
            {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Αποστολή αιτήματος
          </Button>
        </form>
      )}
    </>
  );
}

interface InterestModalTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  interestType: InterestType;
  asChild?: boolean;
}

// Drop-in replacement for the old `<InterestModal trigger={...} />` wrapper.
// Renders (or forwards onto, via `asChild`) a single trigger element and
// asks the shared provider to open the right modal — no independent Dialog
// state, no independent portal, per button.
export const InterestModalTrigger = React.forwardRef<HTMLButtonElement, InterestModalTriggerProps>(
  function InterestModalTrigger({ interestType, asChild = false, className, onClick, ...props }, ref) {
    const { open } = useInterestModal();
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        className={cn(className)}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(event);
          if (!event.defaultPrevented) open(interestType);
        }}
        {...props}
      />
    );
  },
);
