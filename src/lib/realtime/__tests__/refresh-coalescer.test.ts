import { test } from "node:test";
import assert from "node:assert/strict";
import { createRealtimeRefreshCoordinator } from "@/lib/realtime/refresh-coalescer";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("a burst of relevant events (visible) triggers exactly one refresh", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 30 });

  coordinator.notifyRelevantEventVisible();
  coordinator.notifyRelevantEventVisible();
  coordinator.notifyRelevantEventVisible();

  await wait(60);
  assert.equal(refreshCount, 1);
  coordinator.dispose();
});

test("a refresh already pending coalesces with a later relevant event rather than firing twice", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 40 });

  coordinator.notifyRelevantEventVisible();
  await wait(20); // still within the debounce window
  coordinator.notifyRelevantEventVisible(); // coalesces, resets the window

  await wait(60);
  assert.equal(refreshCount, 1);
  coordinator.dispose();
});

test("two separate, well-spaced bursts each produce their own refresh", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.notifyRelevantEventVisible();
  await wait(40);
  assert.equal(refreshCount, 1);

  coordinator.notifyRelevantEventVisible();
  await wait(40);
  assert.equal(refreshCount, 2);
  coordinator.dispose();
});

test("no events at all -> zero refreshes", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  await wait(40);
  assert.equal(refreshCount, 0);
  coordinator.dispose();
});

test("hidden tab: relevant events while hidden do not refresh immediately or repeatedly", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.notifyRelevantEventHidden();
  coordinator.notifyRelevantEventHidden();
  coordinator.notifyRelevantEventHidden();

  await wait(60);
  assert.equal(refreshCount, 0, "a hidden tab must not refresh, no matter how many relevant events arrive");
  coordinator.dispose();
});

test("hidden tab becoming visible with pending relevant events performs exactly one refresh", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.notifyRelevantEventHidden();
  coordinator.notifyRelevantEventHidden();
  assert.equal(refreshCount, 0);

  coordinator.onVisible();
  assert.equal(refreshCount, 1, "becoming visible with dirty state must refresh immediately, not after another debounce wait");

  // Dirty state must be cleared — a second onVisible() with nothing new must not refresh again.
  coordinator.onVisible();
  assert.equal(refreshCount, 1);
  coordinator.dispose();
});

test("becoming visible with no pending events does nothing", () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.onVisible();
  assert.equal(refreshCount, 0);
  coordinator.dispose();
});

test("reconcile(true): behaves like a visible relevant event — one debounced refresh", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.reconcile(true);
  assert.equal(refreshCount, 0, "must not refresh synchronously — it still obeys the debounce window like any visible event");

  await wait(40);
  assert.equal(refreshCount, 1);
  coordinator.dispose();
});

test("reconcile(false): reconnecting while hidden does NOT trigger an immediate refresh", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.reconcile(false);
  await wait(40);
  assert.equal(refreshCount, 0, "a hidden-tab reconnect must not defeat the hidden-tab optimization");
  coordinator.dispose();
});

test("reconcile(false) then becoming visible performs exactly one refresh", () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.reconcile(false);
  assert.equal(refreshCount, 0);

  coordinator.onVisible();
  assert.equal(refreshCount, 1, "the deferred reconcile must surface as exactly one refresh once visible");

  coordinator.onVisible();
  assert.equal(refreshCount, 1, "dirty state must be cleared after the first refresh");
  coordinator.dispose();
});

test("multiple reconcile(false) calls (repeated hidden reconnects) still produce only one refresh when visible", () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.reconcile(false);
  coordinator.reconcile(false);
  coordinator.reconcile(false);
  assert.equal(refreshCount, 0);

  coordinator.onVisible();
  assert.equal(refreshCount, 1);
  coordinator.dispose();
});

test("a hidden reconnect and ordinary hidden relevant events coalesce to a single refresh on becoming visible", () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.notifyRelevantEventHidden();
  coordinator.reconcile(false);
  coordinator.notifyRelevantEventHidden();
  assert.equal(refreshCount, 0);

  coordinator.onVisible();
  assert.equal(refreshCount, 1);
  coordinator.dispose();
});

test("dispose(): clears a pending debounce timer so it never fires after disposal", async () => {
  let refreshCount = 0;
  const coordinator = createRealtimeRefreshCoordinator(() => {
    refreshCount += 1;
  }, { debounceMs: 20 });

  coordinator.notifyRelevantEventVisible();
  coordinator.dispose();

  await wait(50);
  assert.equal(refreshCount, 0, "disposing must cancel the pending timer, not merely stop future scheduling");
});
