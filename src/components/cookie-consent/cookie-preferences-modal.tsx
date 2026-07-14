"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useCookieConsent } from "@/components/providers/cookie-consent-provider";
import type { CookieConsentState, OptionalCategorySelection } from "@/lib/cookie-consent";
import {
  getConsentCategoryViewModels,
  type ConsentCategoryViewModel,
  type OptionalConsentCategory,
} from "@/lib/consent-integrations";

// Presentation-only category copy — never a permission source. Which of
// these ever actually renders is decided entirely by
// getConsentCategoryViewModels() (src/lib/consent-integrations.ts), which
// only ever returns a category that has at least one real, enabled
// integration behind it.
const CATEGORY_COPY: Record<OptionalConsentCategory, { title: string; description: string }> = {
  preferences: {
    title: "Λειτουργικά / Προτιμήσεων",
    description: "Cookies που θυμούνται τις επιλογές σας για μια πιο εξατομικευμένη εμπειρία.",
  },
  analytics: {
    title: "Ανάλυσης",
    description: "Cookies που μας βοηθούν να κατανοήσουμε πώς χρησιμοποιείτε τον ιστότοπο, ώστε να τον βελτιώνουμε.",
  },
  marketing: {
    title: "Εμπορικής προώθησης",
    description: "Cookies που χρησιμοποιούνται για την προβολή σχετικών διαφημίσεων σε εσάς.",
  },
};

// Mounted once in the (public) layout, always in the tree — `open` is a
// real controlled Radix prop, not a manual mount/unmount guard, so Escape /
// outside-click / focus-trap all come from Radix for free. Focus-*restore*
// on close is handled manually via lastTriggerRef, same pattern as
// interest-modal.tsx: real browser (Playwright) testing showed Radix's own
// default onCloseAutoFocus does not reliably land back on the opener here
// (focus ends up on <body> instead) — this explicit onCloseAutoFocus fixes
// that regardless of the underlying cause.
export function CookiePreferencesModal() {
  const { preferencesOpen, closePreferences, consent, acceptAll, rejectNonEssential, savePreferences, lastTriggerRef } =
    useCookieConsent();

  return (
    <DialogPrimitive.Root open={preferencesOpen} onOpenChange={(next) => !next && closePreferences()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50 animate-fade-in" />
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <DialogPrimitive.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              lastTriggerRef.current?.focus();
            }}
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-card border border-border bg-white shadow-card animate-slide-up"
          >
            <ModalBody
              consent={consent}
              onAcceptAll={acceptAll}
              onReject={rejectNonEssential}
              onSave={savePreferences}
            />
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ModalBody({
  consent,
  onAcceptAll,
  onReject,
  onSave,
}: {
  consent: CookieConsentState | null;
  onAcceptAll: () => void;
  onReject: () => void;
  onSave: (selection: OptionalCategorySelection) => void;
}) {
  // Derived from the live registry every render — never a hardcoded list.
  // Today this is always [] (no enabled optional integration exists).
  const categoryViewModels = React.useMemo(() => getConsentCategoryViewModels(), []);

  // Re-initialized fresh every time the modal mounts (Radix unmounts this
  // subtree on close), so reopening from the footer always starts from the
  // currently stored consent — task section 12.
  const [draft, setDraft] = React.useState<OptionalCategorySelection>({
    preferences: consent?.preferences ?? false,
    analytics: consent?.analytics ?? false,
    marketing: consent?.marketing ?? false,
  });

  return (
    <>
      <div className="shrink-0 border-b border-border p-5 pr-12 sm:p-6 sm:pr-14">
        <DialogPrimitive.Title className="text-lg font-bold text-primary">Ρυθμίσεις Cookies</DialogPrimitive.Title>
        <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Μπορείτε να επιλέξετε ποιες κατηγορίες προαιρετικών cookies επιτρέπετε. Τα αναγκαία cookies
          χρησιμοποιούνται πάντα, επειδή είναι απαραίτητα για τη βασική λειτουργία και την ασφάλεια του ιστοτόπου.
        </DialogPrimitive.Description>
        <DialogPrimitive.Close
          aria-label="Κλείσιμο"
          className="absolute right-4 top-4 rounded-md p-1.5 text-ink-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6">
        <Accordion type="multiple" defaultValue={["necessary"]}>
          <AccordionItem value="necessary">
            <AccordionTrigger>
              <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                <span className="font-semibold text-ink">Αναγκαία</span>
                <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-primary">
                  Πάντα ενεργά
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p>
                Χρησιμοποιούνται πάντα για τη σύνδεση/συνεδρία λογαριασμού, την ασφάλεια (προστασία CSRF) και την
                αποθήκευση των ίδιων των προτιμήσεών σας για τα cookies. Δεν μπορούν να απενεργοποιηθούν.
              </p>
              <ul className="mt-2.5 space-y-1 text-xs text-ink-muted">
                <li>Σύνδεση και συνεδρία λογαριασμού</li>
                <li>Ασφάλεια και προστασία από επιθέσεις (CSRF)</li>
                <li>Αποθήκευση των επιλογών σας για τα cookies</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {categoryViewModels.map(({ category, integrations }) => (
            <AccordionItem key={category} value={category}>
              <AccordionTrigger>
                <span className="flex-1 pr-2 text-left font-semibold text-ink">{CATEGORY_COPY[category].title}</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex items-center justify-between gap-4">
                  <p id={`cookie-category-${category}-desc`} className="flex-1">
                    {CATEGORY_COPY[category].description}
                  </p>
                  <Switch
                    checked={draft[category]}
                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, [category]: checked }))}
                    aria-label={CATEGORY_COPY[category].title}
                    aria-describedby={`cookie-category-${category}-desc`}
                  />
                </div>
                {integrations.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-ink-muted">
                    {integrations.map((integration) => (
                      <li key={integration.id}>
                        <strong className="text-ink">
                          {integration.displayName} ({integration.provider})
                        </strong>
                        <p className="mt-0.5">{integration.description || "—"}</p>
                        {integration.cookies.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {integration.cookies.map((cookie) => (
                              <li key={cookie.name}>
                                <strong className="text-ink">{cookie.name}</strong> — {cookie.purpose}
                                {cookie.duration ? ` (${cookie.duration})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {categoryViewModels.length === 0 && (
          <p className="py-4 text-sm text-ink-muted">
            Αυτή τη στιγμή ο ιστότοπος χρησιμοποιεί μόνο αναγκαία cookies.
          </p>
        )}
      </div>

      {/* `sm:flex-row` triggers off *viewport* width, but the modal's own
          box is capped at `max-w-lg` regardless of viewport — three buttons
          do not fit in one row inside that width, and without flex-wrap
          the leftmost one is silently cropped by this Content's own
          `overflow-hidden` (only caught via an actual screenshot, not by
          toBeVisible() assertions). `sm:flex-wrap` lets whichever buttons
          don't fit move to a second line instead of being clipped. */}
      <div className="sticky bottom-0 flex shrink-0 flex-col gap-2.5 border-t border-border bg-white p-4 sm:flex-row sm:flex-wrap sm:justify-end sm:p-5">
        <Button type="button" variant="outline" onClick={onReject}>
          Απόρριψη μη απαραίτητων
        </Button>
        <Button type="button" variant="ghost" onClick={() => onSave(draft)}>
          Αποθήκευση επιλογών
        </Button>
        <Button type="button" variant="primary" onClick={onAcceptAll}>
          Αποδοχή όλων
        </Button>
      </div>
    </>
  );
}
