const reminderService = require("../services/reminderService");

const { isValidTimezone } = require("../utils/timezone");

async function createReminder(req, res) {
  try {
    const {
      userId,
      message,
      scheduledAt,
      timezone,
      idempotencyKey,
      maxRetries,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        error: "message is required",
      });
    }

    if (!scheduledAt) {
      return res.status(400).json({
        error: "scheduledAt is required",
      });
    }

    if (!timezone) {
      return res.status(400).json({
        error: "timezone is required",
      });
    }

    if (!isValidTimezone(timezone)) {
      return res.status(400).json({
        error: "Invalid IANA timezone",
      });
    }

    const hasExplicitOffset =
      typeof scheduledAt === "string" &&
      (scheduledAt.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(scheduledAt));

    if (!hasExplicitOffset) {
      return res.status(400).json({
        message: "scheduledAt must include an explicit timezone offset or Z",
      });
    }

    const scheduledDate = new Date(scheduledAt);

    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        message: "Invalid scheduledAt",
      });
    }

    if (
      maxRetries !== undefined &&
      (!Number.isInteger(maxRetries) || maxRetries < 0)
    ) {
      return res.status(400).json({
        error: "maxRetries must be a non-negative integer",
      });
    }

    const reminder = await reminderService.createReminder({
      userId,
      message,
      scheduledAt: scheduledDate,
      timezone,
      idempotencyKey,
      maxRetries,
    });

    res.status(201).json({
      message: "Reminder created successfully",
      reminder,
    });
  } catch (error) {
    console.error("Create reminder error:", error);

    res.status(500).json({
      error: "Failed to create reminder",
    });
  }
}

async function getReminders(req, res) {
  try {
    const reminders = await reminderService.getReminders();

    res.json({
      reminders,
    });
  } catch (error) {
    console.error("Get reminders error:", error);

    res.status(500).json({
      error: "Failed to fetch reminders",
    });
  }
}

async function getReminderById(req, res) {
  try {
    const reminder = await reminderService.getReminderById(req.params.id);

    if (!reminder) {
      return res.status(404).json({
        error: "Reminder not found",
      });
    }

    res.json({
      reminder,
    });
  } catch (error) {
    console.error("Get reminder error:", error);

    res.status(500).json({
      error: "Failed to fetch reminder",
    });
  }
}

async function updateReminder(req, res) {
  try {
    const { id } = req.params;

    const { message, scheduledAt, timezone, version } = req.body;

    if (!Number.isInteger(version) || version < 1) {
      return res.status(400).json({
        error: "version must be a positive integer",
      });
    }

    if (timezone !== undefined && !isValidTimezone(timezone)) {
      return res.status(400).json({
        error: "Invalid IANA timezone",
      });
    }

    if (scheduledAt !== undefined) {
      const parsedDate = new Date(scheduledAt);

      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: "Invalid scheduledAt",
        });
      }
    }

    const reminder = await reminderService.updateReminder(
      id,
      {
        message,
        scheduledAt,
        timezone,
      },
      version,
    );

    if (!reminder) {
      const existingReminder = await reminderService.getReminderById(id);

      if (!existingReminder) {
        return res.status(404).json({
          error: "Reminder not found",
        });
      }

      if (existingReminder.status !== "scheduled") {
        return res.status(409).json({
          error: "Reminder can only be edited while it is scheduled",
          status: existingReminder.status,
          version: existingReminder.version,
        });
      }

      return res.status(409).json({
        error: "Reminder version is stale",
        currentVersion: existingReminder.version,
      });
    }

    return res.json(reminder);
  } catch (error) {
    console.error("Update reminder error:", error);

    return res.status(500).json({
      error: "Failed to update reminder",
    });
  }
}

async function cancelReminder(req, res) {
  try {
    const reminder = await reminderService.cancelReminder(req.params.id);

    if (!reminder) {
      return res.status(404).json({
        error: "Reminder not found or cannot be cancelled",
      });
    }

    res.json({
      message: "Reminder cancelled successfully",
      reminder,
    });
  } catch (error) {
    console.error("Cancel reminder error:", error);

    res.status(500).json({
      error: "Failed to cancel reminder",
    });
  }
}

module.exports = {
  createReminder,
  getReminders,
  getReminderById,
  updateReminder,
  cancelReminder,
};
