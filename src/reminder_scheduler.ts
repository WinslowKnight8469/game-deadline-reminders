import { z } from "zod";
import { InfraiClient } from "./infrai.ts";

export const deadlineSchema = z.object({
  playerId: z.string().min(1),
  assetId: z.string().min(1),
  eventName: z.string().min(1),
  deadline: z.coerce.date(),
  moderationQueue: z.string().min(1)
});
export type DeadlineRequest = z.infer<typeof deadlineSchema>;
export type Reminder = { playerId: string; assetId: string; eventName: string; deadline: string; queue: string };

export function reminderFor(input: DeadlineRequest, now: Date): Reminder | null {
  const hours = (input.deadline.getTime() - now.getTime()) / 3_600_000;
  if (hours < 0 || hours > 24) return null;
  return { playerId: input.playerId, assetId: input.assetId, eventName: input.eventName, deadline: input.deadline.toISOString(), queue: input.moderationQueue };
}

export async function scheduleDeadline(input: unknown, client: InfraiClient, now = new Date()): Promise<Reminder | null> {
  const request = deadlineSchema.parse(input);
  const reminder = reminderFor(request, now);
  if (reminder) await client.publish(request.moderationQueue, reminder);
  return reminder;
}

export async function registerReminderWorker(client: InfraiClient, taskUrl: string): Promise<string> {
  const job = await client.createCron(taskUrl);
  return job.job_id;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the example");
  const client = new InfraiClient(key);
  const input = { playerId: "player-17", assetId: "skin-204", eventName: "winter showcase", deadline: new Date(Date.now() + 2 * 3_600_000), moderationQueue: "deadline-reminders" };
  console.log(await scheduleDeadline(input, client));
}
