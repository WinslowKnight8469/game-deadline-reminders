import test from "node:test";
import assert from "node:assert/strict";
import { reminderFor } from "./reminder_scheduler.ts";

test("an asset deadline inside the next day becomes a queue reminder", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");
  const result = reminderFor({ playerId: "p1", assetId: "a7", eventName: "arena", deadline: new Date("2026-10-24T06:00:00.000Z"), moderationQueue: "moderation-dlq" }, now);
  assert.deepEqual(result, { playerId: "p1", assetId: "a7", eventName: "arena", deadline: "2026-10-24T06:00:00.000Z", queue: "moderation-dlq" });
});

test("a deadline beyond the reminder window is ignored", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");
  assert.equal(reminderFor({ playerId: "p1", assetId: "a7", eventName: "arena", deadline: new Date("2026-10-26T00:00:00.000Z"), moderationQueue: "moderation-dlq" }, now), null);
});
