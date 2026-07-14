"use client";

import * as React from "react";
import { toast } from "@/components/ui/use-toast";
import {
  type ConsentCategory,
  type CookieConsentState,
  type OptionalCategorySelection,
  LEGACY_COOKIE_CONSENT_NAMES,
  buildConsentCookieString,
  buildCookieClearString,
  createAcceptAllConsent,
  createCustomState,
  createRejectNonEssentialConsent,
  hasCategoryConsent,
  readConsentFromCookieHeader,
  readCookieValue,
} from "@/lib/cookie-consent";
import {
  ACTIVE_OPTIONAL_CATEGORIES,
  ALL_OPTIONAL_CATEGORIES,
  CURRENT_POLICY_FINGERPRINT,
  categoryRequiresReloadOnRevoke,
  getRemovableCookiesForCategory,
} from "@/lib/consent-integrations";

interface CookieConsentContextValue {
  consent: CookieConsentState | null;
  resolved: boolean;
  hasValidConsent: boolean;
  bannerVisible: boolean;
  preferencesOpen: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (selection: OptionalCategorySelection) => void;
  /**
   * `trigger` should be the exact element the caller's click/keydown
   * handler fired on (e.g. `event.currentTarget`) — see lastTriggerRef
   * below for why this must never be inferred from `document.activeElement`
   * inside the handler.
   */
  openPreferences: (trigger?: HTMLElement | null) => void;
  closePreferences: () => void;
  hasConsent: (category: ConsentCategory) => boolean;
  /**
   * The element to restore focus to when the preferences modal closes
   * (banner button or footer button — there are two possible openers).
   *
   * Deliberately populated from the `trigger` argument each caller passes
   * to openPreferences(), NOT from reading `document.activeElement` inside
   * the click handler. Real cross-browser testing (a minimal plain-HTML
   * control experiment, no React/Radix involved) proved why the latter is
   * unreliable: in Chromium and Firefox, `.focus()` immediately followed
   * by `.click()` on the same <button> leaves it focused through the
   * click, so `document.activeElement` inside the resulting click handler
   * correctly reports that button — but in WebKit, the `.click()` itself
   * blurs the button first (even though it was just programmatically
   * focused a moment earlier), so `document.activeElement` inside the
   * handler is already `<body>`/null by the time the handler runs. This
   * is proven native WebKit `<button>` click-focus behavior (also
   * reproduced with a plain, unstyled, React-free HTML page), not
   * something caused by this app's CSS, Tailwind, or Radix — but the
   * capture mechanism itself was a real, fixable application defect:
   * `event.currentTarget` is always the exact element clicked, independent
   * of whichever way a given browser chooses to manage focus around the
   * click, so it works identically in all three engines.
   *
   * Radix Dialog's own default onCloseAutoFocus was also evaluated and
   * found unreliable here for the same underlying reason (it also derives
   * the "return to" element from focus tracking around open/close) — same
   * reason interest-modal.tsx already tracks its own trigger ref rather
   * than relying on the default. The modal reads this ref and focuses it
   * explicitly in its own `onCloseAutoFocus`.
   */
  lastTriggerRef: React.RefObject<HTMLElement | null>;
}

const CookieConsentContext = React.createContext<CookieConsentContextValue | null>(null);

function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  // Unresolved until the client-side cookie read completes — see the
  // effect below. Nothing consent-gated (banner, modal, optional scripts)
  // may render before `resolved` is true, so server and first-client-paint
  // markup always agree (no hydration mismatch) and no optional script can
  // ever race ahead of a real consent decision.
  const [consent, setConsent] = React.useState<CookieConsentState | null>(null);
  const [resolved, setResolved] = React.useState(false);
  const [bannerVisible, setBannerVisible] = React.useState(false);
  const [preferencesOpen, setPreferencesOpen] = React.useState(false);
  const lastTriggerRef = React.useRef<HTMLElement | null>(null);

  // `document.cookie` does not exist during SSR and cannot be read during
  // render without risking a hydration mismatch, so this one-time
  // mount-only resolution genuinely belongs in an effect — same reasoning
  // (and same lint suppression) as the initial favorites fetch in
  // src/components/providers/favorites-provider.tsx.
  React.useEffect(() => {
    // Any legacy-named consent cookie (a schema predating policyFingerprint)
    // is deleted outright and its flags are never read — no silent
    // migration of old "Accept All" phantom-true values into the new
    // schema (task requirement).
    for (const legacyName of LEGACY_COOKIE_CONSENT_NAMES) {
      if (readCookieValue(document.cookie, legacyName) !== null) {
        document.cookie = buildCookieClearString(legacyName, { secure: isSecureContext() });
      }
    }

    const stored = readConsentFromCookieHeader(document.cookie, CURRENT_POLICY_FINGERPRINT, ACTIVE_OPTIONAL_CATEGORIES);
    if (stored) {
      // parseConsentState may have normalized a category flag down to
      // false (e.g. a tampered or stale-but-fingerprint-matching cookie
      // claiming true for a category that isn't actually active). Without
      // this, the corrected value would only live in React state — the
      // raw browser cookie would keep the phantom `true` bytes forever.
      // Re-serializing here (a harmless no-op when nothing changed) keeps
      // the persisted cookie and the effective in-memory consent in sync.
      document.cookie = buildConsentCookieString(stored, { secure: isSecureContext() });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(stored);
    setBannerVisible(stored === null);
    setResolved(true);
  }, []);

  const persist = React.useCallback((next: CookieConsentState) => {
    document.cookie = buildConsentCookieString(next, { secure: isSecureContext() });
    setConsent(next);
  }, []);

  // Deletes any cookie the integration registry declares (per category) for
  // a category that just transitioned from granted to revoked, and reports
  // whether a reload is required per categoryRequiresReloadOnRevoke — both
  // derived from src/lib/consent-integrations.ts, never a separately
  // hand-maintained list.
  const revokeCategories = React.useCallback((previous: CookieConsentState | null, next: CookieConsentState): boolean => {
    if (!previous) return false;
    let needsReload = false;
    for (const category of ALL_OPTIONAL_CATEGORIES) {
      const wasGranted = previous[category] === true;
      const isGranted = next[category] === true;
      if (wasGranted && !isGranted) {
        for (const cookieName of getRemovableCookiesForCategory(category)) {
          document.cookie = buildCookieClearString(cookieName, { secure: isSecureContext() });
        }
        if (categoryRequiresReloadOnRevoke(category)) needsReload = true;
      }
    }
    return needsReload;
  }, []);

  const acceptAll = React.useCallback(() => {
    persist(createAcceptAllConsent(ACTIVE_OPTIONAL_CATEGORIES, CURRENT_POLICY_FINGERPRINT));
    setBannerVisible(false);
    setPreferencesOpen(false);
  }, [persist]);

  const rejectNonEssential = React.useCallback(() => {
    const previous = consent;
    const next = createRejectNonEssentialConsent(CURRENT_POLICY_FINGERPRINT);
    const needsReload = revokeCategories(previous, next);
    persist(next);
    setBannerVisible(false);
    setPreferencesOpen(false);
    toast({
      title: "Οι προτιμήσεις σας αποθηκεύτηκαν",
      description: "Χρησιμοποιούνται μόνο τα αναγκαία cookies.",
      variant: "success",
    });
    if (needsReload) window.location.reload();
  }, [consent, persist, revokeCategories]);

  const savePreferences = React.useCallback(
    (selection: OptionalCategorySelection) => {
      const previous = consent;
      // createCustomState normalizes against ACTIVE_OPTIONAL_CATEGORIES
      // internally — a switch the modal never should have shown (or a
      // tampered payload) can never be persisted as true here.
      const next = createCustomState(selection, ACTIVE_OPTIONAL_CATEGORIES, CURRENT_POLICY_FINGERPRINT);
      const needsReload = revokeCategories(previous, next);
      persist(next);
      setBannerVisible(false);
      setPreferencesOpen(false);
      toast({
        title: "Οι προτιμήσεις σας αποθηκεύτηκαν",
        variant: "success",
      });
      if (needsReload) window.location.reload();
    },
    [consent, persist, revokeCategories],
  );

  const openPreferences = React.useCallback((trigger?: HTMLElement | null) => {
    lastTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setPreferencesOpen(true);
  }, []);
  // Escape / close-icon / backdrop click: closes the UI only. The consent
  // cookie is untouched — a browsed-but-not-saved switch state must never
  // silently become the stored decision (task section 12).
  const closePreferences = React.useCallback(() => setPreferencesOpen(false), []);

  const hasConsent = React.useCallback((category: ConsentCategory) => hasCategoryConsent(consent, category), [consent]);

  const value = React.useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      resolved,
      hasValidConsent: consent !== null,
      bannerVisible,
      preferencesOpen,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openPreferences,
      closePreferences,
      hasConsent,
      lastTriggerRef,
    }),
    [consent, resolved, bannerVisible, preferencesOpen, acceptAll, rejectNonEssential, savePreferences, openPreferences, closePreferences, hasConsent],
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent() {
  const ctx = React.useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  return ctx;
}
