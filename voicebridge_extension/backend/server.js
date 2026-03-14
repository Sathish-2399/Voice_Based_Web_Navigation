const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-type"] }));
app.use(express.json());

app.get("/", (req, res) => res.send("VoiceBridge Backend is running"));

// Known websites list — easily extendable
const SITES = [
  { keywords: ["google"],         url: "https://www.google.com" },
  { keywords: ["youtube"],        url: "https://www.youtube.com" },
  { keywords: ["github"],         url: "https://www.github.com" },
  { keywords: ["leetcode"],       url: "https://leetcode.com" },
  { keywords: ["stackoverflow", "stack overflow"], url: "https://stackoverflow.com" },
  { keywords: ["twitter", "x"],   url: "https://www.twitter.com" },
  { keywords: ["instagram"],      url: "https://www.instagram.com" },
  { keywords: ["facebook"],       url: "https://www.facebook.com" },
  { keywords: ["linkedin"],       url: "https://www.linkedin.com" },
  { keywords: ["amazon"],         url: "https://www.amazon.in" },
  { keywords: ["flipkart"],       url: "https://www.flipkart.com" },
  { keywords: ["gmail", "mail"],  url: "https://mail.google.com" },
  { keywords: ["maps", "google maps"], url: "https://maps.google.com" },
  { keywords: ["wikipedia"],      url: "https://www.wikipedia.org" },
  { keywords: ["chatgpt"],        url: "https://chat.openai.com" },
  { keywords: ["claude"],         url: "https://claude.ai" },
  { keywords: ["netflix"],        url: "https://www.netflix.com" },
  { keywords: ["spotify"],        url: "https://www.spotify.com" },
];

app.post("/process", (req, res) => {
  const text = req.body.message.toLowerCase().trim();
  console.log("🎤 Received:", text);

  // ── Website navigation ──────────────────────────────
  for (let site of SITES) {
    for (let keyword of site.keywords) {
      if (text.includes(keyword)) {
        console.log("🌐 Navigate to:", site.url);
        return res.json({ action: "NAVIGATE", page: site.url });
      }
    }
  }

  // ── Scroll commands ─────────────────────────────────
  if (text.includes("scroll down") || text.includes("go down") || text.includes("move down")) {
    return res.json({ action: "SCROLL", direction: "down" });
  }
  if (text.includes("scroll up") || text.includes("go up") || text.includes("move up")) {
    return res.json({ action: "SCROLL", direction: "up" });
  }

  // ── Navigation commands ─────────────────────────────
  if (text.includes("go back") || text.includes("back")) {
    return res.json({ action: "GO_BACK" });
  }
  if (text.includes("reload") || text.includes("refresh")) {
    return res.json({ action: "RELOAD" });
  }

  // ── Search command — open Google with query ─────────
  if (text.includes("search for") || text.includes("search ")) {
    const query = text.replace(/search for|search/g, "").trim();
    return res.json({
      action: "NAVIGATE",
      page: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
  }

  console.log("⚠️ Unknown command:", text);
  return res.json({ action: "UNKNOWN", reason: "Command not recognized" });
});

app.listen(5000, () => console.log("🚀 Backend running on http://localhost:5000"));