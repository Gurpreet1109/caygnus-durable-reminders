# Product Engineering Challenge Submission

## Candidate

- **Name:** Gurpreet Singh
- **Email:** [gurpreetchahal1009@gmail.com](mailto:gurpreetchahal1009@gmail.com)
- **GitHub:** https://github.com/Gurpreet1109
- **Selected problem:** Problem 3 — Durable Reminders
- **Demo video:** TODO — 3–5 minute demo video

## Run the project

### Prerequisites

- Node.js 18+
- PostgreSQL
- npm

### Setup

Clone the repository:

```bash
git clone https://github.com/Gurpreet1109/caygnus-durable-reminders.git
cd caygnus-durable-reminders
npm install
```

Create a `.env` file using `.env.example` and add the required PostgreSQL connection details.

Required environment variable:

```env
DATABASE_URL=your_postgresql_connection_string
PORT=3000
```

Set up the database using the SQL file:

```text
src/db/schema.sql
```

Start the project:

```bash
npm start
```

For development:

```bash
npm run dev
```

### Successful scenario

A reviewer can create a reminder with a future scheduled time and an IANA timezone.

When the reminder becomes due, the processor picks it up and sends it through the test delivery destination. The reminder is then marked as delivered and its delivery attempt is stored.

### Failure/recovery scenario

A temporary delivery failure can be simulated during the benchmark. The reminder is not lost; it is scheduled for another attempt and can be delivered successfully later.

The system also handles restart recovery. If work was left in a processing state, it can be recovered and processed again after a restart.

## Run the tests

Run all automated tests:

```bash
npm test
```

Run the problem-specific benchmark:

```bash
npm run benchmark
```

The tests cover important cases such as editing, cancellation, retries, recovery, idempotency, race conditions, and timezone/DST handling.

## Acceptance scenarios and verification

I implemented the main scenarios required for the Durable Reminders problem:

- Create and store reminders with stable IDs.
- Store the reminder content and scheduled time.
- Support IANA timezones.
- Handle timezone and DST behavior.
- Edit scheduled reminders safely.
- Prevent old reminder versions from being delivered.
- Cancel scheduled reminders.
- Handle edit/cancel race conditions deterministically.
- Claim reminders when they become due.
- Recover reminders that were left processing after a restart.
- Retry temporary delivery failures.
- Stop retrying permanent failures.
- Store delivery attempt history.
- Use stable idempotency keys.
- Prevent duplicate logical deliveries.
- Use an injectable clock for deterministic tests.
- Use a local/test delivery destination.
- Make sure successful reminder occurrences result in one logical notification.

### Verification benchmark

Run:

```bash
npm run benchmark
```

The observed result was:

```text
20/20 checks passed
```

The benchmark finished with these terminal states:

```text
cancelled: 1
delivered: 18
failed:    1
```

There were:

```text
Successful occurrences: 18
Logical deliveries: 18
```

The benchmark also confirmed that duplicate execution was suppressed and all 20 reminders reached a terminal state.

### Failure/recovery scenario

The benchmark includes a temporary delivery failure followed by a retry and successful delivery.

It also tests restart recovery by leaving work in a processing state, recovering it, and then allowing it to be processed again.

A reviewer can reproduce these scenarios with:

```bash
npm run benchmark
```

No external paid delivery service is required.

## Architecture and data flow

This is a Node.js/Express backend with PostgreSQL for persistent storage.

The basic flow is:

```text
Client
  ↓
REST API
  ↓
Reminder Service
  ↓
PostgreSQL
  ↓
Reminder Processor
  ↓
Delivery Service
  ↓
Success / Retry / Failed
```

The main parts of the application are:

- **Routes:** Handle the reminder API endpoints.
- **Controllers:** Receive requests, validate input, and send responses.
- **Reminder Service:** Handles creating, editing, cancelling, and storing reminders.
- **Reminder Processor:** Finds due reminders, claims them, handles recovery, and starts delivery.
- **Delivery Service:** Handles delivery attempts and records their results.
- **Retry logic:** Decides when a temporary failure should be tried again.
- **PostgreSQL:** Stores reminder state, versions, attempts, and idempotency information.
- **Injectable clock:** Makes time-dependent behavior easier to test reliably.

A reminder normally moves through:

```text
scheduled
    ↓
processing
   / | \
  /  |  \
 ↓   ↓   ↓
delivered  retry  failed
             ↓
         processing
```

If a reminder is cancelled, it moves to `cancelled`.

For edits, the reminder version is checked so that already-claimed old work cannot deliver outdated content.

## Technology choices

### Node.js and Express

I used Node.js and Express because the project is mainly a backend/API system and I am already comfortable building REST APIs with this stack.

Another option would have been something like Java/Spring Boot, but Node.js allowed me to keep the implementation smaller and focus on the reliability requirements.

### PostgreSQL

I chose PostgreSQL because the project needs durable state, transactions, attempt history, versioning, and safe concurrent processing.

A simpler in-memory solution would not be suitable because reminders need to survive application restarts.

I also considered MongoDB, but PostgreSQL felt like a better fit for the state transitions and transactional parts of this problem.

### Jest and Supertest

I used Jest for automated testing and Supertest for testing the API without needing a separate frontend.

### Local/test delivery

I kept the delivery destination local and injectable instead of depending on an external notification service.

This makes the benchmark easier to reproduce and avoids requiring API keys or paid services.

The trade-off is that the delivery layer is mainly designed for this challenge rather than being a complete production notification integration.

## Important decisions

### 1. Versioning for safe edits

One issue I wanted to avoid was an old reminder being delivered after the user had already edited it.

I therefore used reminder versions and check the version before delivery. This prevents stale work from delivering outdated reminder content.

### 2. Idempotency

Retries and duplicate processing can potentially cause the same reminder to be delivered more than once.

I used a stable delivery idempotency key so the system can recognize duplicate execution and suppress the second logical delivery.

This gives exactly-once behavior at the application's delivery boundary rather than assuming that every external network operation can provide physical exactly-once delivery.

### 3. Temporary vs permanent failures

Not every failure should be retried.

Temporary failures can be retried, while permanent failures are moved to a final failed state. This prevents recoverable work from being lost while also avoiding unnecessary retries.

## Assumptions and limitations

- PostgreSQL is required for persistent storage.
- The project uses a local/test delivery destination rather than a real notification provider.
- The retry policy is designed for the challenge and is not intended to be a complete production retry platform.
- There is no frontend UI because the main focus of this problem is backend reliability.
- Production monitoring, tracing, alerting, and deployment infrastructure are outside the scope of this submission.
- The system does not claim absolute physical exactly-once delivery across arbitrary external network failures. Idempotency is used to provide exactly-once logical delivery at the application boundary.
- The project is focused on the required challenge scenarios rather than being a complete commercial reminder product.

## Production and scale

The current implementation is focused mainly on correctness, durability, failure handling, and deterministic testing.

If this needed to run at a much larger production scale, I would first improve the background processing architecture.

Some changes I would consider are:

- Using a durable job queue/message broker for higher volumes.
- Running multiple workers with stronger distributed coordination.
- Adding proper database indexes and query optimization.
- Improving connection pooling and database capacity planning.
- Making retry and backoff policies more configurable.
- Adding dead-letter handling for permanently problematic jobs.
- Adding structured logs, metrics, tracing, and monitoring.
- Tracking scheduler delays, retry rates, failed deliveries, and worker health.
- Integrating real notification providers behind the existing delivery abstraction.
- Adding deployment and scaling automation.

These are future production improvements; they are not being claimed as part of the current implementation.

## AI usage

I used ChatGPT as an AI development assistant while working on this project.

It helped me with:

- Breaking the problem into smaller implementation tasks.
- Thinking through edge cases.
- Reviewing the architecture and state transitions.
- Suggesting test scenarios.
- Debugging issues during development.
- Improving the documentation and submission.

I reviewed the suggestions myself and made the final implementation decisions.

I also verified the implementation using the automated tests and the required 20-item benchmark. I am responsible for the submitted code and can explain the architecture, state transitions, retry handling, recovery, idempotency, timezone handling, and testing decisions.

## Credibility note

### QuillStack

**Problem it solved:**
QuillStack is a full-stack note-taking application where users can create, update, delete, and manage their notes after authentication.

**My contribution:**
I worked on both the frontend and backend. I built the React interface, Node.js/Express APIs, authentication flow, CRUD functionality, database integration, and frontend-backend communication.

**Scale / operational complexity:**
This was a personal project rather than a large production system. The main complexity was managing authentication, persistent data, REST APIs, frontend state, and deployment between separate frontend and backend applications.

**One difficult engineering decision:**
I separated the frontend and backend responsibilities and exposed the application functionality through REST APIs. This made the project easier to test, deploy, and extend.

**Evidence:**
GitHub: https://github.com/Gurpreet1109

The current Caygnus submission is also publicly available:

https://github.com/Gurpreet1109/caygnus-durable-reminders
