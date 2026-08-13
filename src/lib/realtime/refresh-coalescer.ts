/**
 * Pure, DOM-free debounce/coalescing state machine for PublicRealtimeProvider
 * (src/components/providers/public-realtime-provider.tsx). Deliberately
 * framework-agnostic — no `document`/`window` reads, no React — so it's
 * directly unit-testable with the project's plain node:test runner and
 * carries no risk of drifting from what the component actually does.
 * The component owns reading `document.visibilityState` and calling
 * `router.refresh()`; this module only owns *when* to call the callback.
 *
 * Behavior (see the realtime spec's debounce/hidden-tab/reconnect sections):
 * - visible + relevant event(s): coalesce a burst into exactly one refresh,
 *   `debounceMs` after the last relevant event.
 * - hidden + relevant event: mark dirty, refresh nothing yet.
 * - becomes visible while dirty: exactly one immediate refresh, clears dirty
 *   and any pending debounce timer.
 * - reconcile(visible): an SSE reconnect after a previously-established
 *   connection. Deliberately routed through the EXACT SAME markRelevant()
 *   path as a normal event — a reconnect is just another "something may
 *   have changed, re-check relevance-adjacent state" signal, distinguished
 *   only by visibility, so it must obey the identical debounce-while-visible
 *   / mark-dirty-while-hidden rules rather than its own separate bypass.
 *   Concretely: reconcile(true) behaves exactly like
 *   notifyRelevantEventVisible() (one debounced refresh); reconcile(false)
 *   behaves exactly like notifyRelevantEventHidden() (mark dirty only, no
 *   immediate refresh — onVisible() is what turns it into the one refresh
 *   once the tab is actually visible again). This keeps every source of
 *   "maybe stale, should refresh" — bursts, hidden-tab events, and
 *   reconnects alike — flowing through one consistent model instead of
 *   several independent timers/flags.
 */

const DEFAULT_DEBOUNCE_MS = 200;

export interface RealtimeRefreshCoordinator {
  /** Call when a relevant realtime event arrives and the tab is currently visible. */
  notifyRelevantEventVisible(): void;
  /** Call when a relevant realtime event arrives while the tab is hidden. */
  notifyRelevantEventHidden(): void;
  /** Call when the tab's visibility transitions to visible. */
  onVisible(): void;
  /**
   * SSE reconnect after a previously-established connection (never the
   * very first connection — the caller owns that distinction). `visible`
   * is `document.visibilityState !== "hidden"` at the moment of reconnect.
   */
  reconcile(visible: boolean): void;
  /** Clears any pending timer. Call on unmount. */
  dispose(): void;
}

export function createRealtimeRefreshCoordinator(
  refresh: () => void,
  options: { debounceMs?: number } = {},
): RealtimeRefreshCoordinator {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function fire() {
    clearTimer();
    dirty = false;
    refresh();
  }

  // Shared by every "something may be stale" signal (normal events AND
  // reconnect reconciliation) — see the file-level comment above for why
  // reconcile() must not bypass this.
  function markRelevant(visible: boolean) {
    dirty = true;
    if (visible) {
      clearTimer();
      timer = setTimeout(fire, debounceMs);
    }
    // hidden: dirty=true only, no timer — onVisible() is the only thing
    // allowed to turn this into an actual refresh, and it does so exactly
    // once no matter how many hidden signals (events or reconnects)
    // arrived in the meantime.
  }

  return {
    notifyRelevantEventVisible() {
      markRelevant(true);
    },
    notifyRelevantEventHidden() {
      markRelevant(false);
    },
    onVisible() {
      if (dirty) fire();
    },
    reconcile(visible: boolean) {
      markRelevant(visible);
    },
    dispose() {
      clearTimer();
    },
  };
}
