# Caygnus Durable Reminders

A small backend service for creating, scheduling, editing, cancelling, and reliably delivering reminders.

## Features

* Durable reminder storage with PostgreSQL
* IANA timezone support with DST handling
* Safe reminder edits using versioning
* Deterministic edit/cancel race handling
* Retry handling for temporary delivery failures
* Permanent failures become terminal
* Delivery-boundary idempotency
* Restart recovery for abandoned work
* Injectable clock and test delivery destination
* Ordered delivery attempt history

## Tech Stack

* Node.js
* Express.js
* PostgreSQL
* Jest
* Supertest

## Setup

```bash
npm install
```

Create `.env` from `.env.example` and configure the PostgreSQL connection.

Run the test suite:

```bash
npm test
```

Run the verification benchmark:

```bash
npm run benchmark
```

## Benchmark

The project includes a deterministic 20-item benchmark covering:

* Timezones and DST
* Scheduling
* Editing and cancellation
* Processing and recovery
* Retries and failures
* Idempotency
* Terminal states

Current result:

**20/20 checks passed**

## Timezone Policy

Reminders store the IANA timezone together with the scheduled time.

DST behavior is handled explicitly and is covered by deterministic tests.

## Reliability

A reminder is not considered successfully delivered until the delivery boundary is reached. Idempotency keys prevent duplicate logical notifications when the same work is executed more than once.
