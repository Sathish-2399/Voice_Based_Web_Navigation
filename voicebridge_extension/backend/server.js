const express = require("express");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-type"],
  }),
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("VoiceBridge Backend is running");
});

app.post("/process", (req, res) => {
  const userText = req.body.message.toLowerCase();

  console.log("Received:", userText);

  if (userText.includes("google")) {
    return res.json({
      action: "NAVIGATE",
      page: "https://www.google.com",
    });
  }

  if (userText.includes("problem") || userText.includes("பிராப்ளம்")) {
    return res.json({
      action: "NAVIGATE",
      page: "https://leetcode.com/problemset/",
    });
  }

  if (userText.includes("name")) {
    return res.json({
      action: "FILL_FIELD",
      field: "name",
      value: "Sathish",
    });
  }

  if (userText.includes("click")) {
    return res.json({
      action: "CLICK_BUTTON",
      selector: "button",
    });
  }

  return res.json({ action: "UNKNOWN" });
});

app.listen(5000, () => {
  console.log("🚀 Backend running on http://localhost:5000");
});
