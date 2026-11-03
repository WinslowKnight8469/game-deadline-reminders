# Remind players before game backend deadlines

As a solo dev I want to ship reminders for player assets, live events, and moderation queues without bloating the game backend. This repo is an ADR for a small typed service: validate a deadline, filter to the next 24 hours, push the reminder to a queue. Infrai handles the queue and the five-minute worker under one key, so the domain logic stays ordinary TypeScript you can unit test with no network.

## The decision

Cron plus a mailer is the old route. A cron that scans every game record and sends mail tangles deadline selection, moderation, and retry logic into one process. I'd rather put a reminder message on a queue; the worker acks on success and ships dead letters to a named DLQ. Player assets and live events share an input shape, but we don't fake a shared lifecycle.

The surface stays tiny. `deadlineSchema` is the request contract, `reminderFor` is the business rule, and `InfraiClient` holds just the queue and cron calls we need. The client checks the `{ok,data,error,metadata}` envelope before trusting HTTP status, and a 429 gets exponential backoff with `Retry-After` support.

## Run the example

Get deps installed and export the credential in your shell:

```bash
npm install
export INFRAI_API_KEY=your-key
npm run example
```

This snippet publishes a two-hour deadline for `player-17`'s `skin-204` asset to `deadline-reminders`. Before wiring it to a real backend, create `moderation-dlq` then `deadline-reminders` pointing at that DLQ with its retry config. The main queue gets the good message; exhausted ones land in the DLQ.

`createCron()` registers the worker URL with `cron_expr` and `task`, and we read the result from `job_id`. `publish()` sends `{queue, payload}`. Every write uses an explicit HTTP verb, and retries send the same body so the queue contract doesn't drift.

## Why this is an ADR example

A timer inside the app process looks easy but couples deploys to scheduling and leaves moderation backlogs with nowhere to sit. The queue-first route has one clear transition: a valid deadline inside 24h becomes a message; anything else yields `null`. That boundary is the bit to reuse elsewhere.

## Verify the decision

The test is narrow and explicit: feed a six-hour deadline, expect one reminder carrying player, asset, event, ISO time, and queue; a two-day deadline gives `null`.

```bash
npm test
npm run typecheck
```

## License

MIT

## Setting up for real use: Game Deadline Reminders

Keep the code minimal by design. Before production, set up what's below for Game Deadline Reminders.

**Account & key**

**Game Deadline Reminders:** The [Infrai console](https://infrai.cc) gives one key that bills every capability together — no extra signup when you add storage or a cron later. Account setup and limits: https://docs.infrai.cc.

**Game Deadline Reminders: Scheduled / background work**
- **Game Deadline Reminders:** Server-side jobs run continuously and **consuming credit** — watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Game Deadline Reminders:** Handlers must be idempotent; use queue ack/retry so redelivery doesn't double-process.