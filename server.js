const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const axios = require("axios");
require("dotenv").config();
const cors = require("cors");

const app = express();
const port = 5000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors()); // Enable CORS for frontend requests
app.use(express.json());

// Upload PDF and extract text
app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const pdfText = await pdfParse(req.file.buffer);
    res.json({ text: pdfText.text });
  } catch (error) {
    console.error("Error parsing PDF:", error);
    res.status(500).json({ error: "Failed to parse PDF" });
  }
});

// Generate Questions using OpenAI
app.post("/api/generate_questions", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    const prompt = `Create 3 multiple-choice questions based on this text:\n\n${text.substring(0, 1000)}\n\nFormat: JSON [{\"question\": \"...\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"correctAnswer\": \"A\"}]`;

    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [{ role: "system", content: "You generate quiz questions." }, { role: "user", content: prompt }],
      temperature: 0.7,
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const gptResponse = response.data.choices[0].message.content;
    const questions = JSON.parse(gptResponse);
    res.json({ questions });
  } catch (error) {
    console.error("Error generating questions:", error);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


