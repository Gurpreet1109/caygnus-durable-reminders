# Caygnus Durable Reminders

Caygnus Durable Reminders is a backend service for creating and managing scheduled reminders.

The main goal of this project is to make reminders **reliable even when something goes wrong**. Reminder data is stored in PostgreSQL, so scheduled work is not lost when the application restarts. The system also handles retries, idempotency, timezones, cancellation, and delivery history.

## What this project does

The service supports:

- Creating scheduled reminders
- Updating existing reminders
- Cancelling reminders
- Processing reminders when they become due
- Recovering reminders after an application restart
- Retrying failed deliveries
- Keeping track of every delivery attempt
- Preventing duplicate requests with idempotency keys
- Working with IANA timezones
- Testing time-dependent logic with an injectable clock

## Tech Stack

- **Node.js**
- **Express.js**
- **PostgreSQL**
- **JavaScript**
- **Jest**
- **Supertest**
- **dotenv**
- **Nodemon**

## How the project is structured

The project is split into a few simple layers so that scheduling, database access, and delivery logic are not tightly coupled.

```text
caygnus-durable-reminders/
│
├── src/
│   ├── server.js
│   ├── config.js
│   │
│   ├── routes/
│   │   └── reminderRoutes.js
│   │
│   ├── controllers/
│   │   └── reminderController.js
│   │
│   ├── services/
│   │   ├── reminderService.js
│   │   ├── schedulerService.js
│   │   ├── deliveryService.js
│   │   └── reminderProcessor.js
│   │
│   ├── db/
│   │   ├── database.js
│   │   └── schema.sql
│   │
│   └── utils/
│       ├── clock.js
│       ├── timezone.js
│       └── retry.js
│
├── tests/
│   ├── scheduling.test.js
│   ├── restart.test.js
│   ├── retry.test.js
│   ├── retryProcessor.test.js
│   ├── idempotency.test.js
│   └── timezone.test.js
│
├── scripts/
│   └── benchmark.js
│
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── SUBMISSION.md
```

## Basic architecture

At a high level, the application works like this:

```text
Client
  |
  v
Express API
  |
  v
Reminder Service
  |
  v
PostgreSQL
  |
  +--> reminders
  |
  +--> reminder_attempts

Scheduler
  |
  v
Find due reminders
  |
  v
Claim reminder
  |
  v
Reminder Processor
  |
  +--> Delivery
  |
  +--> Success
  |
  +--> Retry
  |
  +--> Failed
```

The API is responsible for accepting and managing reminders, while the scheduler is responsible for finding reminders that are ready to be processed.

## Reminder lifecycle

A reminder normally moves through these states:

```text
scheduled
    |
    v
processing
    |
    +----> delivered
    |
    +----> scheduled (retry)
    |
    +----> failed
```

A reminder can also be cancelled:

```text
scheduled / processing
        |
        v
    cancelled
```

The state is stored in PostgreSQL rather than only in application memory.

## Database

There are two main tables.

### `reminders`

This table contains the current state of every reminder.

Some of the important fields are:

- `id`
- `user_id`
- `message`
- `scheduled_at`
- `timezone`
- `status`
- `retry_count`
- `max_retries`
- `idempotency_key`
- `last_error`
- `next_attempt_at`
- timestamps

### `reminder_attempts`

This table keeps the history of delivery attempts.

For each attempt we store:

- reminder ID
- attempt number
- status
- attempt timestamp
- error message, if the attempt failed

There is a unique constraint on:

```text
(reminder_id, attempt_number)
```

This prevents the same attempt from accidentally being recorded twice.

## Scheduling and concurrency

The scheduler checks the database at a configurable interval and looks for reminders that are due.

When a reminder is picked up, PostgreSQL row locking is used:

```sql
FOR UPDATE SKIP LOCKED
```

This is useful if multiple scheduler workers are running because one worker can claim a reminder while another worker skips the locked row instead of processing it at the same time.

## Restart recovery

One of the important requirements of this project is that a reminder should not simply disappear if the application stops while processing it.

When a reminder is being handled, it can have the status:

```text
processing
```

The scheduler checks for old/stale processing records and makes them eligible for processing again.

This gives the system a basic restart recovery mechanism without depending on an in-memory queue.

## Retry handling

If delivery fails, the reminder can be retried.

The project uses exponential backoff. With a base delay of 1 second, the delays are:

```text
Attempt 1 → 1 second
Attempt 2 → 2 seconds
Attempt 3 → 4 seconds
```

The number of retries is limited by `max_retries`.

Once the retry limit has been reached, the reminder is marked as:

```text
failed
```

The error is also stored so that the failure can be inspected later.

## Idempotency

The API supports an `idempotencyKey`.

For example:

```json
{
  "userId": "user-001",
  "message": "Call the client",
  "scheduledAt": "2026-09-22T12:00:00Z",
  "timezone": "Asia/Kolkata",
  "idempotencyKey": "client-call-001"
}
```

If the same request is sent again with the same key, the database prevents another reminder from being created.

The uniqueness is enforced at the PostgreSQL level rather than relying only on application memory.

## Timezones

The API accepts IANA timezone names such as:

```text
Asia/Kolkata
America/New_York
Europe/London
```

The timezone is validated before the reminder is stored.

The scheduled time is stored as a PostgreSQL `TIMESTAMPTZ`, while the original IANA timezone is also saved with the reminder.

This keeps the actual scheduled timestamp and the user's intended timezone available to the system.

## API endpoints

### Create a reminder

```http
POST /api/reminders
```

Example request:

```json
{
  "userId": "user-001",
  "message": "Call the client",
  "scheduledAt": "2026-09-22T12:00:00Z",
  "timezone": "Asia/Kolkata",
  "idempotencyKey": "client-call-001",
  "maxRetries": 3
}
```

### Get all reminders

```http
GET /api/reminders
```

### Get one reminder

```http
GET /api/reminders/:id
```

### Update a reminder

```http
PATCH /api/reminders/:id
```

Example:

```json
{
  "message": "Updated reminder message"
}
```

### Cancel a reminder

```http
DELETE /api/reminders/:id
```

### Health check

```http
GET /health
```

## Running the project locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure `.env`

Create a `.env` file with your PostgreSQL credentials:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=caygnus_reminders
DB_USER=postgres
DB_PASSWORD=your_password
SCHEDULER_INTERVAL_MS=1000
MAX_RETRIES=3
RETRY_BASE_DELAY_MS=1000
```

### 3. Create the database

Create a PostgreSQL database named:

```text
caygnus_reminders
```

Then run the SQL from:

```text
src/db/schema.sql
```

### 4. Start the application

For development:

```bash
npm run dev
```

Or:

```bash
npm start
```

The API will be available at:

```text
http://localhost:3000
```

## Testing

Run the automated tests with:

```bash
npm test
```

Current result:

```text
17/17 tests passed
```

The project also includes a 20-item benchmark:

```bash
npm run benchmark
```

Current result:

```text
20/20 benchmark checks passed
```

The tests cover areas such as:

- Injectable clock
- Scheduling logic
- Retry calculations
- Retry processing
- Restart recovery
- Timezone validation
- Idempotency behavior

## Why I made these design choices

### PostgreSQL

The reminders need to survive application restarts, so keeping the state only in memory would not be enough. PostgreSQL provides the persistence and constraints needed for this.

### Database locking

`FOR UPDATE SKIP LOCKED` was used to make reminder claiming safer when multiple workers are involved.

### Injectable clock

Time-based code can be difficult to test if it always uses the real system clock. The clock is therefore injectable so tests can use a fixed time.

### Separate attempt history

The current reminder status and its delivery history serve different purposes, so they are stored separately.

### Database-level idempotency

The idempotency key has a database uniqueness constraint. This means duplicate requests are protected even if multiple requests arrive close together.

## Delivery implementation

The delivery service is currently a small simulated adapter.

For a successful delivery it logs something like:

```text
[DELIVERY] user-001: Call the client
```

The important part is that the delivery logic is kept separate from the scheduler and database code.

Because of this separation, a real email, SMS, push notification, webhook, or other provider could be connected later without rewriting the scheduling system.

## Things I would improve for a production system

There are a few areas that could be expanded in a larger production environment:

- Add a real notification provider
- Add authentication and authorization
- Add a message queue such as Redis/BullMQ
- Add distributed scheduler coordination
- Add structured logging and metrics
- Add a dead-letter queue
- Add rate limiting
- Add provider response tracking
- Add an admin/monitoring dashboard
- Add more detailed processing leases

These are intentionally outside the current scope so the core reminder and reliability requirements remain simple and testable.

## Final verification

The final local verification completed successfully:

```text
Automated tests: 17/17 passed
Benchmark:       20/20 passed
```

The API and PostgreSQL flow were also manually tested during development.

## License

This project was created as part of the Caygnus Product Engineering Challenge.
