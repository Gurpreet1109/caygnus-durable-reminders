CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY,

    user_id VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    scheduled_at TIMESTAMPTZ NOT NULL,

    timezone VARCHAR(100) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'scheduled',

    retry_count INTEGER NOT NULL DEFAULT 0,

    max_retries INTEGER NOT NULL DEFAULT 3,

    idempotency_key VARCHAR(255) UNIQUE,

    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    next_attempt_at TIMESTAMPTZ,

    version INTEGER NOT NULL DEFAULT 1
);


CREATE TABLE IF NOT EXISTS reminder_attempts (
    id BIGSERIAL PRIMARY KEY,

    reminder_id UUID NOT NULL
        REFERENCES reminders(id)
        ON DELETE CASCADE,

    attempt_number INTEGER NOT NULL,

    status VARCHAR(30) NOT NULL,

    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    error_message TEXT,

    UNIQUE(reminder_id, attempt_number)
);


CREATE INDEX IF NOT EXISTS idx_reminders_due
ON reminders(status, scheduled_at);


CREATE INDEX IF NOT EXISTS idx_reminders_user
ON reminders(user_id);


CREATE INDEX IF NOT EXISTS idx_reminders_next_attempt
ON reminders(status, next_attempt_at);


CREATE INDEX IF NOT EXISTS idx_attempts_reminder
ON reminder_attempts(reminder_id);