const express = require("express");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment-timezone");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());

// In-memory store for reminders
const reminders = [];
const chrono = require("chrono-node");

// Discord bot webhook
const BOT_WEBHOOK_URL =
	"https://discord.com/api/webhooks/1388451875958951967/3tvhggGs_u1CqYgEnwkSJ9EMPkwNi_inbulFnKHkWfex0FrwAlvWPuRlim_laEapAnMM";
const API_KEY = "your-api-key";

// Add global error handlers
process.on("uncaughtException", (error) => {
	console.error("Uncaught Exception:", error);
	process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
	process.exit(1);
});

// POST /reminders endpoint
app.post("/reminders", async (req, res) => {
	console.log("Received request:", req.body);

	const { userId, message, time } = req.body;

	if (!userId || !message) {
		console.log("Missing fields:", { userId, message });
		return res.status(400).json({ error: "Missing required fields" });
	}

	if (req.headers.authorization !== `Bearer ${API_KEY}`) {
		console.log("Unauthorized request");
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		console.log("Parsing time from message or time field...");

		const inputText = time || message;
		const results = chrono.parse(inputText, new Date(), {
			timezone: "Asia/Singapore",
		});

		if (!results || results.length === 0) {
			return res.status(400).json({
				error:
					"Could not understand the time. Try phrases like 'in 10 minutes', 'tomorrow at 8am', etc.",
			});
		}

		const parsedDate = results[0].start.date();
		if (parsedDate < new Date()) {
			return res.status(400).json({ error: "Time must be in the future." });
		}

		// Optional: clean up message to remove the time portion
		let cleanedMessage = message;
		const { index, text: timeText } = results[0];
		if (index !== undefined && timeText) {
			cleanedMessage =
				message.slice(0, index) + message.slice(index + timeText.length);
			cleanedMessage = cleanedMessage.replace(/^remind me to/i, "").trim();
		}

		const reminder = {
			id: uuidv4(),
			userId,
			message: cleanedMessage || message,
			time: parsedDate,
		};
		reminders.push(reminder);

		console.log("Stored reminder:", reminder);

		const cronTime = `${parsedDate.getMinutes()} ${parsedDate.getHours()} * * *`;

		if (!cron.validate(cronTime)) {
			console.log("Invalid cron expression:", cronTime);
			return res
				.status(400)
				.json({ error: "Invalid cron expression generated" });
		}

		const task = cron.schedule(
			cronTime,
			async () => {
				try {
					console.log("Sending reminder to webhook:", reminder);

					await axios.post(
						BOT_WEBHOOK_URL,
						{
							content: `REMIND|${userId}|${cleanedMessage}`,
						},
						{ timeout: 10000 }
					);

					console.log("Reminder sent successfully:", reminder.id);

					const index = reminders.findIndex((r) => r.id === reminder.id);
					if (index !== -1) reminders.splice(index, 1);

					task.stop(); // Stop after running
				} catch (error) {
					console.error("Failed to send reminder:", error.message);
				}
			},
			{ scheduled: false }
		);

		task.start();

		res.status(201).json({
			message: "Reminder set",
			id: reminder.id,
			scheduledFor: parsedDate.toISOString(),
			cronExpression: cronTime,
			cleanedMessage,
		});
	} catch (error) {
		console.error("Server error:", error.message, error.stack);
		res.status(500).json({ error: error.message });
	}
});

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({
		status: "OK",
		reminders: reminders.length,
		uptime: process.uptime(),
	});
});

// Start server with error handling
const PORT = process.env.PORT || 3000;

const server = app
	.listen(PORT, () => {
		console.log(`Server running on port ${PORT}`);
		console.log(`Health check available at http://localhost:${PORT}/health`);
	})
	.on("error", (err) => {
		console.error("Server failed to start:", err);
		process.exit(1);
	});
