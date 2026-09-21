require("dotenv").config();

const express = require("express");
const config = require("./config");
const { checkDatabaseConnection } = require("./db/database");
const { runScheduler } = require("./services/schedulerService");
const reminderRoutes = require("./routes/reminderRoutes");

const app = express();

app.use(express.json());
app.use("/api/reminders", reminderRoutes);

app.get("/health", async (req, res) => {
  try {
    const database = await checkDatabaseConnection();

    res.json({
      status: "ok",
      database: "connected",
      time: database.current_time,
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

async function startServer() {
  try {
    await checkDatabaseConnection();

    console.log("PostgreSQL connected");

    app.listen(config.port, () => {
      console.log(`Caygnus Durable Reminders running on port ${config.port}`);
    });

    setInterval(() => runScheduler(), config.schedulerIntervalMs);

    console.log(
      `Scheduler started with ${config.schedulerIntervalMs}ms interval`,
    );
  } catch (error) {
    console.error("Failed to start server:", error);

    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
