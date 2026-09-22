# Caygnus Durable Reminders — Submission

## Overview

This project implements a durable reminder system focused on reliable scheduling and delivery.

## Key Engineering Decisions

* **Versioning:** edits create a safe version boundary so stale work cannot deliver an outdated reminder.
* **Idempotency:** every delivery occurrence has a stable idempotency key to prevent duplicate logical notifications.
* **Race safety:** edit and cancellation races are handled deterministically.
* **Retries:** temporary delivery failures are retried, while permanent failures become terminal.
* **Recovery:** abandoned processing work can be recovered after a restart.
* **Timezones:** IANA timezone data is retained and DST behavior is explicitly tested.
* **Testing:** the system uses an injectable clock and deterministic delivery destination for repeatable tests.

## Verification

The required 20-item benchmark passes completely:

**20/20 checks passed**

The test suite also covers editing, cancellation, race conditions, retries, idempotency, and timezone/DST behavior.

## Run

```bash
npm install
npm test
npm run benchmark
```

The project is designed to be easy to run locally with PostgreSQL and provides `.env.example` for configuration.
