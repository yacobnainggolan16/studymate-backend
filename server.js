const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const axios = require("axios");
require("dotenv").config();
const cors = require("cors");

const app = express();
const port = process.env.PORT || 8080; // Use the provided PORT when available
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors()); // Enable CORS for frontend requests
app.use(express.json());

// Health Check Route
app.get("/", (req, res) => {
  res.status(200).json({ message: "🚀 Studymate Backend is running!" });
});

// Upload PDF and Extract Text
app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ No file uploaded.");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`📄 Received file: ${req.file.originalname}`);
    const pdfData = await pdfParse(req.file.buffer);

    if (!pdfData.text) {
      console.error("❌ PDF parsing failed.");
      return res.status(500).json({ error: "Failed to extract text from PDF" });
    }

    console.log("✅ PDF parsed successfully.");
    res.json({ text: pdfData.text });
  } catch (error) {
    console.error("❌ Error in PDF upload:", error);
    res.status(500).json({ error: "Failed to process the PDF" });
  }
});

// Generate Questions using OpenAI
app.post("/api/generate_questions", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      console.error("❌ No text provided.");
      return res.status(400).json({ error: "No text provided" });
    }

    console.log("🤖 Generating quiz questions from text...");

    const prompt = `Buatlah 3 pertanyaan pilihan ganda berdasarkan teks berikut:\n\n${text.substring(0, 1000)}\n\nFormat JSON: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}]`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You generate quiz questions based on given text." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.choices || response.data.choices.length === 0) {
      console.error("❌ OpenAI returned an empty response.");
      return res.status(500).json({ error: "OpenAI returned an empty response" });
    }

    let gptResponse = response.data.choices[0]?.message?.content?.trim();
    try {
      const questions = JSON.parse(gptResponse);
      console.log("✅ Quiz questions generated successfully.");
      res.json({ questions });
    } catch (parseError) {
      console.error("❌ Error parsing GPT response:", parseError);
      res.status(500).json({ error: "Invalid JSON response from OpenAI" });
    }
  } catch (error) {
    console.error("❌ Error generating questions:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

// Start the server on all network interfaces
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${port}`);
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`⚠️ Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("✅ Server closed.");
    process.exit(0);
  });
  // Force shutdown if graceful shutdown takes too long (e.g., after 10 seconds)
  setTimeout(() => {
    console.error("❌ Forcefully shutting down.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
  process.exit(1);
});
