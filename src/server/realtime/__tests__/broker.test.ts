import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryRealtimeBroker } from "@/server/realtime/broker";
import type { PublicRealtimeEvent } from "@/lib/realtime/types";

function makeEvent(overrides: Partial<PublicRealtimeEvent> = {}): PublicRealtimeEvent {
  return {
    version: 1,
    id: "evt-1",
    type: "vehicles.changed",
    scopes: ["vehicles"],
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

test("subscribe: a subscribed listener receives a published event", () => {
  const broker = new InMemoryRealtimeBroker();
  const received: PublicRealtimeEvent[] = [];
  broker.subscribe((event) => received.push(event));

  const event = makeEvent();
  broker.publish(event);

  assert.deepEqual(received, [event]);
});

test("publish: fans out to multiple subscribers", () => {
  const broker = new InMemoryRealtimeBroker();
  const a: PublicRealtimeEvent[] = [];
  const b: PublicRealtimeEvent[] = [];
  broker.subscribe((event) => a.push(event));
  broker.subscribe((event) => b.push(event));

  const event = makeEvent();
  broker.publish(event);

  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(broker.listenerCount, 2);
});

test("unsubscribe: the returned function stops further delivery to that listener only", () => {
  const broker = new InMemoryRealtimeBroker();
  const a: PublicRealtimeEvent[] = [];
  const b: PublicRealtimeEvent[] = [];
  const unsubscribeA = broker.subscribe((event) => a.push(event));
  broker.subscribe((event) => b.push(event));

  unsubscribeA();
  assert.equal(broker.listenerCount, 1);

  broker.publish(makeEvent());
  assert.equal(a.length, 0, "unsubscribed listener must not receive events published after unsubscribe");
  assert.equal(b.length, 1, "the other subscriber must be unaffected");
});

test("no call after unsubscribe, even across multiple publishes", () => {
  const broker = new InMemoryRealtimeBroker();
  let callCount = 0;
  const unsubscribe = broker.subscribe(() => {
    callCount += 1;
  });

  broker.publish(makeEvent());
  unsubscribe();
  broker.publish(makeEvent());
  broker.publish(makeEvent());

  assert.equal(callCount, 1);
});

test("duplicate subscribers (the same listener function subscribed twice) are handled safely: Set semantics collapse it to one registration", () => {
  const broker = new InMemoryRealtimeBroker();
  let callCount = 0;
  const listener = () => {
    callCount += 1;
  };

  broker.subscribe(listener);
  broker.subscribe(listener);
  assert.equal(broker.listenerCount, 1, "a Set-backed broker naturally de-duplicates the identical function reference");

  broker.publish(makeEvent());
  assert.equal(callCount, 1);
});

test("calling the same unsubscribe function twice is a safe no-op", () => {
  const broker = new InMemoryRealtimeBroker();
  const unsubscribe = broker.subscribe(() => {});
  assert.equal(broker.listenerCount, 1);

  unsubscribe();
  assert.equal(broker.listenerCount, 0);
  assert.doesNotThrow(() => unsubscribe());
  assert.equal(broker.listenerCount, 0);
});

test("one subscriber throwing does not prevent delivery to other subscribers, and does not corrupt the broker", () => {
  const broker = new InMemoryRealtimeBroker();
  const received: PublicRealtimeEvent[] = [];
  broker.subscribe(() => {
    throw new Error("simulated subscriber bug");
  });
  broker.subscribe((event) => received.push(event));

  const originalConsoleError = console.error;
  const loggedErrors: unknown[] = [];
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  try {
    assert.doesNotThrow(() => broker.publish(makeEvent()));
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(received.length, 1, "the healthy subscriber must still receive the event");
  assert.equal(broker.listenerCount, 2, "the throwing subscriber must remain subscribed, not silently dropped");
  assert.ok(loggedErrors.length >= 1, "the failure should be logged");

  // The broker must still work correctly for a second publish.
  broker.publish(makeEvent({ id: "evt-2" }));
  assert.equal(received.length, 2);
});

test("no event history/replay: a listener that subscribes AFTER a publish never receives that earlier event", () => {
  const broker = new InMemoryRealtimeBroker();
  broker.publish(makeEvent());

  const received: PublicRealtimeEvent[] = [];
  broker.subscribe((event) => received.push(event));

  assert.equal(received.length, 0, "the broker must not replay history to a late subscriber");
});

test("publish with zero subscribers is a safe no-op", () => {
  const broker = new InMemoryRealtimeBroker();
  assert.doesNotThrow(() => broker.publish(makeEvent()));
});
