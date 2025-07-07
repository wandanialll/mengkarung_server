// server.js
const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const axios = require("axios");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.post("/notify", upload.single("image"), async (req, res) => {
	const { timestamp, track_id } = req.body;
	const file = req.file;

	if (!file) return res.status(400).send("No image provided.");

	const form = new FormData();
	form.append("file", fs.createReadStream(file.path));
	form.append(
		"payload_json",
		JSON.stringify({
			content: `Person **ID ${track_id}** entered ROI at **${timestamp}**`,
		})
	);

	try {
		await axios.post(DISCORD_WEBHOOK_URL, form, {
			headers: form.getHeaders(),
		});
		fs.unlinkSync(file.path); // Cleanup
		res.send("Notification sent");
	} catch (err) {
		console.error("Discord error:", err.message);
		res.status(500).send("Failed to send to Discord");
	}
});

// health check endpoint
app.get("/health", (req, res) => {
	res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
