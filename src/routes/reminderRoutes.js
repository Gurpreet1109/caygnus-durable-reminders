const express = require("express");

const reminderController = require("../controllers/reminderController");

const router = express.Router();

router.post("/", reminderController.createReminder);

router.get("/", reminderController.getReminders);

router.get("/:id", reminderController.getReminderById);

router.patch("/:id", reminderController.updateReminder);

router.delete("/:id", reminderController.cancelReminder);

module.exports = router;
