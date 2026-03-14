const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const FormData = require("form-data");
const fetch = require("node-fetch");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-type"] }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("VoiceBridge Backend is running");
});

// ─── /transcribe — forwards audio to local Python Whisper server ─────────────

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const filePath = req.file.path;

    const formData = new FormData();
    formData.append("audio", fs.createReadStream(filePath), {
      filename: "audio.webm",
      contentType: "audio/webm",
    });

    // Call local Python whisper server on port 5001
    const response = await fetch("http://localhost:5001/transcribe", {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });

    const data = await response.json();

    fs.unlinkSync(filePath); // cleanup temp file

    console.log("Whisper transcription:", data.text);

    res.json({ text: data.text || "" });

  } catch (error) {
    console.error("Transcribe error:", error);
    res.json({ text: "" });
  }
});

// ─── /translate — LibreTranslate Tamil/Tanglish → English ────────────────────

async function translateToEnglish(text) {
  try {
    const response = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: "en",
        format: "text",
        api_key: ""
      }),
    });

    const data = await response.json();
    if (data.translatedText) return data.translatedText.toLowerCase();
    return text;

  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

app.post("/translate", async (req, res) => {
  const rawText = req.body.message;

  console.log("User said (original):", rawText);

  const translated = await translateToEnglish(rawText);

  console.log("After translation:", translated);

  res.json({ translated });
});

// ─── /process — External Navigation Fallback ─────────────────────────────────

app.post("/process", async (req, res) => {
  const userText = req.body.message.toLowerCase();

  console.log("Processing:", userText);

  if (userText.includes("google")) {
    return res.json({ action: "NAVIGATE", page: "https://www.google.com" });
  }
  if (userText.includes("youtube")) {
    return res.json({ action: "NAVIGATE", page: "https://www.youtube.com" });
  }
  if (userText.includes("problem")) {
    return res.json({ action: "NAVIGATE", page: "https://leetcode.com/problemset/" });
  }
  if (userText.includes("click")) {
    return res.json({ action: "CLICK_BUTTON", selector: "button" });
  }

  return res.json({ action: "UNKNOWN" });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(5000, () => {
  console.log("🚀 Node backend running on http://localhost:5000");
});