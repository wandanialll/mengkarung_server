const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const port = process.env.PORT || 3000;

// Use memory storage instead of disk
const upload = multer({ storage: multer.memoryStorage() });

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.post("/notify", upload.single("image"), async (req, res) => {
	try {
		const { track_id, entry_time, exit_time } = req.body;
		const file = req.file;

		if (!file) return res.status(400).send("Image not provided.");

		// Prepare payload for Discord
		const form = new FormData();
		form.append("file", file.buffer, {
			filename: `person_${track_id}.jpg`,
			contentType: "image/jpeg",
		});

		form.append(
			"payload_json",
			JSON.stringify({
				content: `🕵️ Person **ID ${track_id}** detected in ROI\n🕓 **Entry: ${entry_time}**\n🕔 **Exit: ${exit_time}**`,
			})
		);

		const headers = form.getHeaders();

		// Send to Discord webhook
		const discordRes = await axios.post(DISCORD_WEBHOOK_URL, form, { headers });

		res.sendStatus(discordRes.status);
	} catch (err) {
		console.error(err);
		res.status(500).send("Error relaying to Discord");
	}
});

app.get("/", (req, res) => res.send("👀 Memory-only tracking relay is live"));

app.get("/health", (req, res) => res.send("OK"));

app.listen(port, () => {
	console.log(`🚀 Listening on port ${port}`);
});
