# Caygnus Product Engineering Challenge

## Project: Durable Reminders

I built a backend service for creating and processing scheduled reminders with a focus on reliability and recovery.
The main idea was to make sure a reminder is not lost just because the application restarts or a delivery attempt fails.
The project uses Node.js, Express, and PostgreSQL.

## What is implemented

The current implementation covers the main requirements of the challenge:

- Durable reminder storage
- Scheduled processing
- Restart recovery
- IANA timezone validation
- Reminder editing
- Reminder cancellation
- Bounded retries
- Exponential backoff
- Delivery attempt history
- Idempotency
- Injectable clock
- Deterministic tests
- 20-item benchmark

## How it works

A reminder is first stored in PostgreSQL.

The scheduler periodically checks for reminders that are ready to run. When one is found, it is claimed and moved into the `processing` state.
After that, the reminder is passed to the delivery service.

The normal flow is:

```text
scheduled
    ↓
processing
    ↓
delivery
    ├── success → delivered
    ├── failure → retry
    └── retry limit reached → failed
```

If the application stops unexpectedly while a reminder is being processed, stale `processing` records can be recovered by the scheduler.

## Concurrency

The scheduler uses PostgreSQL row locking with:

```sql
FOR UPDATE SKIP LOCKED
```

The reason for using this is simple: if more than one scheduler worker is running, they should not all pick the same reminder.

The database is responsible for safely claiming the work.

## Retry behavior

Failed deliveries are retried using exponential backoff.

With a base delay of 1 second, the retry delays are:

```text
1 second
2 seconds
4 seconds
```

The maximum number of retries is configurable.
Every attempt is saved in the `reminder_attempts` table so that the history of what happened is not lost.

## Idempotency

The API accepts an idempotency key when creating a reminder.
The key has a unique constraint in PostgreSQL.

This means that if the client accidentally sends the same request more than once, the same idempotency key cannot create multiple reminder records.

## Timezone handling

The API accepts IANA timezone names such as:

```text
Asia/Kolkata
America/New_York
Europe/London
```

The timezone is validated before being stored.
The scheduled timestamp is stored using PostgreSQL `TIMESTAMPTZ`, while the supplied timezone is kept with the reminder.

## Testing

The project has an automated test suite covering the main pieces of the implementation.
Final test result:

```text
17/17 tests passed
```

The project also includes a 20-item benchmark covering database setup, indexes, timezone support, retry behavior, idempotency constraints, and persisted delivery state.

Final benchmark result:

```text
20/20 checks passed
```

## API

The implemented endpoints are:

```text
POST   /api/reminders
GET    /api/reminders
GET    /api/reminders/:id
PATCH  /api/reminders/:id
DELETE /api/reminders/:id
GET    /health
```

## Database

The project uses two main tables:

### reminders

Stores the current state of each reminder.

### reminder_attempts

Stores the history of delivery attempts.

The database also contains indexes for finding due reminders and retryable reminders efficiently.

## Delivery

The actual notification provider is represented by a simple delivery service in this implementation.

Currently, a successful delivery is simulated by logging the reminder:

```text
[DELIVERY] user-001: Call the client
```

I kept this part separate from the rest of the system so that a real email, SMS, push, or webhook provider could be added later without changing the scheduling and retry logic.

## Important implementation decisions

### Why PostgreSQL?

The reminder state needs to survive application restarts. PostgreSQL gives the application durable storage as well as useful constraints and locking support.

### Why an injectable clock?

Scheduling and retry code depends heavily on time. Injecting the clock makes those parts easier to test without depending on the actual current time.

### Why store attempts separately?

A reminder's current state tells us what is happening now, while the attempt table tells us what happened before. Keeping both makes debugging and auditing easier.

### Why enforce idempotency in the database?

Application-level checks alone can still have race conditions when requests arrive at the same time. A database uniqueness constraint provides a stronger guarantee.

## Current scope

The focus of this implementation was the core reliability requirements from the challenge.

Some production-level features could be added later, including:

- Real notification providers
- Authentication
- Distributed workers
- Queue-based processing
- Metrics and monitoring
- Structured logging
- Dead-letter handling
- Rate limiting
- Admin tooling

## Final verification

The project was tested locally with PostgreSQL and the complete application flow.

Final results:

```text
Tests:     17/17 passed
Benchmark: 20/20 passed
```

The reminder API was also manually tested for creation, retrieval, updating, cancellation, and idempotency.

## Running locally

```bash
npm install
npm run dev
```

The required environment variables are provided in `.env.example`.

The complete setup instructions are available in `README.md`.
