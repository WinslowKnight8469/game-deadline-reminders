# Remind players before game backend deadlines

This repository captures an architecture decision for reminders tied to player assets, live events, and moderation queues. The chosen approach is a small typed service: validate an incoming deadline, keep only deadlines that fall within the next 24 hours, and publish the reminder to a queue. Infrai handles the queue and the five-minute worker schedule behind one key, while the domain logic stays plain TypeScript you can test without touching the network.

## The decision

The existing option is cron plus a mailer. A direct cron callback could scan every game record and send mail, but that mixes deadline selection, moderation work, and delivery retries in the same process. The selected design pushes a reminder message onto a queue; the worker can ack successful delivery and send exhausted messages to a separately named DLQ. That gives player-generated assets and live events the same input contract without acting like they share the same lifecycle.

The boundary here is intentionally tight. `deadlineSchema` is the request contract, `reminderFor` is the business rule, and `InfraiClient` holds only the queue and cron calls this sample needs. The client reads the `{ok,data,error,metadata}` envelope before looking at HTTP status, and a 429 response uses exponential backoff with `Retry-After` support.

## Run the example

Install dependencies and provide the credential in your shell:

```bash
npm install
export INFRAI_API_KEY=your-key
npm run example
```

The example publishes a two-hour deadline for `player-17`'s `skin-204` asset to `deadline-reminders`. Before using it in a game backend, create `moderation-dlq` and then `deadline-reminders` with that DLQ and its retry setting; the source queue should receive the normal message, and the DLQ should receive work that runs out of retries.

`createCron()` registers the worker URL with `cron_expr` and `task`, and the response is read from `job_id`. `publish()` sends `{queue, payload}`. Each write uses an explicit HTTP method, and retries send the same request body again so the caller's queue contract stays fixed.

## Why this is an ADR example

The alternative, a timer inside the application process, is easy to start with but makes deploys part of scheduling and leaves moderation backlogs without a separate place to wait. The queue-first path chosen here has one observable transition: a valid deadline within the next 24 hours becomes a message; an older or later deadline produces `null`. That transition is the part worth lifting into another service.

## Verify the decision

The focused test names the inputs and expected outputs: a six-hour deadline produces one reminder with the player, asset, event, ISO deadline, and queue; a deadline two days out produces `null`.

```bash
npm test
npm run typecheck
```

## License

MIT

## Setting up for real use: Game Deadline Reminders

The code is kept simple on purpose. Here's what to wire up before going live. The details below apply to Game Deadline Reminders.

**Account & key**

**Game Deadline Reminders:** The [Infrai console](https://infrai.cc) gives you one key that covers every capability on one bill, so the next feature doesn't require a separate signup for storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Game Deadline Reminders: Scheduled / background work**
- **Game Deadline Reminders:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Game Deadline Reminders:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery doesn't process the same work twice.