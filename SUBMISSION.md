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
- PostgreSQL 14+
- npm

### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/Gurpreet1109/caygnus-durable-reminders.git
cd caygnus-durable-reminders
npm install
```

Create a `.env` file using `.env.example` and provide the PostgreSQL connection details.

Required environment variables:

```env
DATABASE_URL=your_postgresql_connection_string
PORT=3000
```

Create the database/schema using the SQL provided in:

```text
src/db/schema.sql
```

Start the application:

```bash
npm start
```

For development:

```bash
npm run dev
```

### Successful scenario

Create a scheduled reminder through the reminder API with a valid future time and IANA timezone.

The scheduler/processor detects the reminder when it becomes due, claims it, delivers it through the local/test destination, and records the successful delivery and attempt history.

### Failure/recovery scenario

The system can be tested with a temporary delivery failure. The reminder remains recoverable, a retry is scheduled, and the next processing attempt can successfully deliver it.

Restart recovery is also supported: work that was left in processing state can be recovered and claimed again instead of being permanently lost.

## Run the tests

Run the complete automated test suite:

```bash
npm test
```

Run the required problem-specific verification benchmark:

```bash
npm run benchmark
```

The tests cover scheduling, editing, cancellation, race conditions, retries, recovery, timezone/DST handling, and delivery idempotency.

## Acceptance scenarios and verification

The submitted implementation covers the required durable reminder scenarios, including:

- Creating reminders with stable IDs.
- Storing reminder content and scheduled time.
- Storing and using IANA timezones.
- Handling timezone/DST behavior deterministically.
- Editing scheduled reminders safely.
- Preventing stale scheduled work from delivering old reminder versions.
- Cancelling scheduled reminders.
- Handling edit/cancel races deterministically.
- Claiming due reminders for processing.
- Recovering abandoned processing work after restart.
- Retrying temporary delivery failures.
- Marking permanent delivery failures as terminal.
- Maintaining ordered delivery attempt history.
- Using stable delivery idempotency keys.
- Suppressing duplicate logical deliveries.
- Using an injectable clock for deterministic testing.
- Using a local/test delivery destination instead of a paid external service.
- Ensuring successful reminder occurrences result in one logical notification.

### Verification benchmark

Run:

```bash
npm run benchmark
```

### Observed benchmark result

The verification benchmark completed successfully:

```text
20/20 checks passed
```

Observed terminal state counts:

```text
cancelled: 1
delivered: 18
failed:    1
```

Observed successful occurrences:

```text
18
```

Observed logical deliveries:

```text
18
```

The benchmark also confirmed that duplicate execution was suppressed and all 20 benchmark reminders reached terminal states.

### Failure/recovery scenario

The benchmark demonstrates a temporary delivery failure followed by retry and successful delivery. It also demonstrates abandoned processing work being recovered after restart and made available for processing again.

A reviewer can reproduce the verification by running:

```bash
npm run benchmark
```

The benchmark performs these scenarios deterministically without requiring an external paid delivery provider.

## Architecture and data flow

The application is a Node.js/Express backend backed by PostgreSQL.

Main flow:

```text
Client
  |
  v
REST API
  |
  v
Reminder Service
  |
  v
PostgreSQL
  |
  v
Reminder Processor
  |
  +--> Claim due reminder
  |
  v
Delivery Service
  |
  +--> Success --> delivered
  |
  +--> Temporary failure --> retry
  |
  +--> Permanent failure --> failed
```

Main components:

- **Routes:** expose reminder API endpoints.
- **Controllers:** validate requests and return HTTP responses.
- **Reminder Service:** handles reminder creation, editing, cancellation, versioning, and persistence logic.
- **Reminder Processor:** finds due reminders, claims work, handles recovery, and coordinates delivery.
- **Delivery Service:** performs the delivery operation and records delivery outcomes.
- **Retry logic:** determines retry timing and bounded retry behavior.
- **PostgreSQL:** provides durable reminder state, attempt history, versions, and idempotency records.
- **Injectable clock/test destination:** makes scheduling and delivery behavior deterministic in tests.

The reminder lifecycle is primarily:

```text
scheduled
    |
    v
processing
   / | \
  /  |  \
 v   v   v
delivered retry failed
          |
          v
       processing
```

Cancellation moves a reminder to `cancelled`, while edits create a new valid version so stale processing cannot deliver outdated content.

## Technology choices

### Node.js + Express

I chose Node.js and Express because the project is primarily a backend/API and Node.js provides a simple environment for implementing HTTP APIs, background processing, asynchronous delivery, and tests.

An alternative would have been another backend framework such as Java/Spring Boot. I chose Node.js because it allowed me to focus more directly on the reliability requirements without adding unnecessary framework complexity.

### PostgreSQL

PostgreSQL was chosen because the problem requires durable state, transactions, attempt history, versioning, and concurrency-safe processing.

An in-memory database would be simpler but would not provide the durability and restart behavior required by the problem.

MongoDB was another possible option, but the relational state transitions and transactional requirements made PostgreSQL a good fit.

### Jest + Supertest

Jest provides deterministic unit/integration testing, while Supertest allows HTTP API behavior to be tested without requiring a separate frontend.

### Local/test delivery destination

Instead of depending on an external paid notification service, the implementation uses an injectable/local delivery mechanism. This keeps the benchmark deterministic, reproducible, and free of external service credentials.

The main trade-off is that the submitted delivery mechanism is designed for the challenge rather than being a complete production notification provider integration.

## Important decisions

### 1. Versioning for safe edits

Reminder edits can race with already-claimed work. I used version-aware processing so stale work cannot deliver an older reminder version after the reminder has been edited.

This protects the delivery boundary from outdated data.

### 2. Stable idempotency keys

Retries and duplicate execution can cause the same logical reminder to be processed more than once.

A stable delivery idempotency key is used so duplicate execution can be detected and suppressed. This provides exactly-once behavior at the logical delivery boundary rather than assuming that an external network can guarantee physical exactly-once delivery.

### 3. Explicit failure classification

Temporary and permanent delivery failures are handled differently.

Temporary failures can schedule another attempt, while permanent failures move the reminder to a terminal failed state.

This avoids both losing recoverable work and retrying failures that cannot succeed.

## Assumptions and limitations

- The challenge uses a local/test delivery destination instead of a real external notification provider.
- PostgreSQL is required for durable persistence.
- The submitted retry policy is bounded and designed around the challenge requirements rather than a fully configurable production retry platform.
- The system is designed to demonstrate reliable scheduling and delivery semantics rather than provide a complete user-facing notification product.
- Production deployment, monitoring, distributed tracing, and operational alerting are outside the scope of the challenge.
- The implementation does not claim absolute physical exactly-once delivery across arbitrary external network failures. Idempotency provides exactly-once logical delivery at the application's delivery boundary.
- The project currently focuses on the required backend behavior and does not include a frontend UI.

## Production and scale

The submitted implementation currently focuses on correctness, durability, deterministic testing, and the required benchmark.

For significantly larger production scale, I would first strengthen the processing architecture around the database-backed scheduler.

Potential improvements would include:

- A dedicated durable job queue or message broker for high-volume scheduling.
- Multiple worker processes with stronger distributed coordination.
- Database indexing and query optimization for large reminder volumes.
- Connection pooling and database capacity planning.
- More configurable retry/backoff policies.
- Dead-letter handling for permanently problematic deliveries.
- Metrics, structured logging, tracing, and operational dashboards.
- Monitoring for scheduler lag, retry rates, failed deliveries, and worker health.
- A real notification provider abstraction with provider-specific idempotency support.
- Horizontal scaling and deployment automation.

These are proposed production improvements; they are not being claimed as part of the submitted implementation.

## AI usage

I used ChatGPT as an AI development assistant during the project.

It helped with:

- Breaking the problem into implementation tasks.
- Thinking through reliability and edge cases.
- Reviewing architecture and state transitions.
- Designing focused test scenarios.
- Debugging implementation issues.
- Improving documentation and submission material.

I reviewed the suggestions, adapted the implementation to the project requirements, and verified the resulting behavior myself.

The submitted code was tested using the automated test suite and the required 20-item verification benchmark. I remain responsible for understanding and explaining the implementation and its engineering decisions.

## Credibility note

### QuillStack

**Problem solved:**
QuillStack is a full-stack note-taking application designed to provide users with authentication and CRUD-based note management.

**My contribution:**
I worked on the frontend and backend, including React UI development, Node.js/Express APIs, authentication, CRUD operations, database integration, and connecting the frontend with the backend.

**Scale / operational complexity:**
It is a personal full-stack project rather than a large production system. Its main complexity was coordinating authentication, API behavior, persistent data, frontend state, and deployment across separate frontend and backend environments.

**Difficult engineering decision:**
One important decision was separating the frontend and backend responsibilities and exposing the required functionality through REST APIs. This made the application easier to develop, test, deploy, and extend.

**Evidence:**
GitHub: https://github.com/Gurpreet1109

The Caygnus project repository is also publicly available:

https://github.com/Gurpreet1109/caygnus-durable-reminders
