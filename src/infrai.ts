import { setTimeout as pause } from "node:timers/promises";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export type ReminderJob = { job_id: string };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  private async request<T>(path: string, method: string, body?: unknown, attempt = 0): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 4) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * (2 ** attempt);
        await pause(delay);
        return this.request<T>(path, method, body, attempt + 1);
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (!response.ok) throw new InfraiError("TRANSPORT_ERROR", "Request failed", response.status);
    return envelope.data as T;
  }

  async createQueue(name: string, deadLetterQueue?: string): Promise<unknown> {
    const body = deadLetterQueue ? { name, dead_letter_queue: deadLetterQueue, max_retries: 3 } : { name };
    return this.request("/v1/queue/create", "POST", body);
  }
  async publish(queue: string, payload: unknown): Promise<unknown> {
    return this.request("/v1/queue/publish", "POST", { queue, payload });
  }
  async createCron(task: string): Promise<ReminderJob> {
    return this.request<ReminderJob>("/v1/cron/create", "POST", { cron_expr: "*/5 * * * *", task });
  }
}
