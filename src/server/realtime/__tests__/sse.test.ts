import { test } from "node:test";
import assert from "node:assert/strict";
import { createRealtimeSseStream, encodeSsePublicChangeEvent, SSE_HEADERS, SSE_RETRY_HINT_MS } from "@/server/realtime/sse";
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

async function readAvailableChunks(reader: ReadableStreamDefaultReader<Uint8Array>, timeoutMs = 200): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const readPromise = reader.read();
    const timeoutPromise = new Promise<{ done: true; value: undefined }>((resolve) =>
      setTimeout(() => resolve({ done: true, value: undefined }), 10),
    );
    const result = await Promise.race([readPromise, timeoutPromise]);
    if (result.value) out += decoder.decode(result.value, { stream: true });
    if (out.length > 0) break;
  }
  return out;
}

test("SSE_HEADERS: sets the required streaming headers", () => {
  assert.equal(SSE_HEADERS["Content-Type"], "text/event-stream");
  assert.equal(SSE_HEADERS["Cache-Control"], "no-cache, no-transform");
  assert.equal(SSE_HEADERS["Connection"], "keep-alive");
  assert.equal(SSE_HEADERS["X-Accel-Buffering"], "no");
});

test("encodeSsePublicChangeEvent: serializes only the small event object, as a proper `public-change` SSE frame", () => {
  const event = makeEvent();
  const frame = encodeSsePublicChangeEvent(event);
  assert.equal(frame, `id: ${event.id}\nevent: public-change\ndata: ${JSON.stringify(event)}\n\n`);
});

test("createRealtimeSseStream: registers exactly one broker listener while the stream is open", async () => {
  const broker = new InMemoryRealtimeBroker();
  const controller = new AbortController();

  const stream = createRealtimeSseStream({ signal: controller.signal, broker, heartbeatMs: 60_000 });
  const reader = stream.getReader();
  await reader.read(); // consume the initial retry hint so the listener is definitely registered by now

  assert.equal(broker.listenerCount, 1);

  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(broker.listenerCount, 0, "aborting must unsubscribe");
});

test("createRealtimeSseStream: a published event reaches the stream as a public-change frame", async () => {
  const broker = new InMemoryRealtimeBroker();
  const controller = new AbortController();
  const stream = createRealtimeSseStream({ signal: controller.signal, broker, heartbeatMs: 60_000 });
  const reader = stream.getReader();
  await reader.read(); // retry hint

  const event = makeEvent({ id: "evt-published-1" });
  broker.publish(event);

  const chunk = await readAvailableChunks(reader);
  assert.match(chunk, /event: public-change/);
  assert.match(chunk, new RegExp(`id: ${event.id}`));
  assert.match(chunk, new RegExp(JSON.stringify(event).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  controller.abort();
});

test("createRealtimeSseStream: heartbeat is a bare comment line, never a public-change event", async () => {
  const broker = new InMemoryRealtimeBroker();
  const controller = new AbortController();
  const stream = createRealtimeSseStream({ signal: controller.signal, broker, heartbeatMs: 20 });
  const reader = stream.getReader();
  await reader.read(); // retry hint

  await new Promise((resolve) => setTimeout(resolve, 60)); // let a few heartbeats fire
  const chunk = await readAvailableChunks(reader, 50);

  assert.doesNotMatch(chunk, /event: public-change/, "a heartbeat must never be framed as a public-change event");
  assert.match(chunk, /^: heartbeat/m, "a heartbeat must be a bare SSE comment line");

  controller.abort();
});

test("createRealtimeSseStream: disconnect (abort) removes the listener and clears the heartbeat interval — no leak", async () => {
  const broker = new InMemoryRealtimeBroker();
  const controller = new AbortController();
  const stream = createRealtimeSseStream({ signal: controller.signal, broker, heartbeatMs: 15 });
  const reader = stream.getReader();
  await reader.read();

  assert.equal(broker.listenerCount, 1);
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(broker.listenerCount, 0);

  // If the heartbeat interval were still running, publishing/reading after
  // abort would eventually surface more chunks; assert the stream produces
  // nothing further once torn down.
  const afterAbort = await readAvailableChunks(reader, 80);
  assert.equal(afterAbort, "", "no further chunks (including heartbeats) may be produced after disconnect");
});

test("createRealtimeSseStream: an already-aborted signal at start-time tears down immediately without registering a listener", async () => {
  const broker = new InMemoryRealtimeBroker();
  const controller = new AbortController();
  controller.abort();

  const stream = createRealtimeSseStream({ signal: controller.signal, broker, heartbeatMs: 60_000 });
  const reader = stream.getReader();
  const result = await reader.read();

  assert.equal(result.done, true);
  assert.equal(broker.listenerCount, 0);
});

test("createRealtimeSseStream: includes the SSE retry hint as the first frame", async () => {
  const broker = new InMemoryRealtimeBroker();
  const controller = new AbortController();
  const stream = createRealtimeSseStream({ signal: controller.signal, broker, heartbeatMs: 60_000 });
  const reader = stream.getReader();

  const { value } = await reader.read();
  const text = new TextDecoder().decode(value);
  assert.equal(text, `retry: ${SSE_RETRY_HINT_MS}\n\n`);

  controller.abort();
});
