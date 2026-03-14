let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_VOICE") {
    sendResponse({ status: "received" }); // ✅ prevent port closed error
    startVoice();
  }
  return true; // keep message port open
});

// ─── Whisper-based Voice Recording ───────────────────────────────────────────

async function startVoice() {
  if (isRecording) {
    console.log("Already recording...");
    return;
  }

  pageElements = scanPage();

  console.log("Requesting microphone...");

  // Check if getUserMedia is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error("❌ getUserMedia not supported on this page");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    console.log("✅ Microphone granted!");

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    isRecording = true;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      audioChunks = [];

      await processAudio(audioBlob);

      if (isRecording) {
        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 4000);
      }
    };

    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 4000);

    console.log("🎤 Whisper Voice Recognition Started");

  } catch (error) {
    if (error.name === "NotAllowedError") {
      console.error("❌ Microphone permission denied! Allow mic in Chrome settings.");
    } else if (error.name === "NotFoundError") {
      console.error("❌ No microphone found!");
    } else {
      console.error("❌ Microphone error:", error.name, error.message);
    }
  }
}

// ─── Process Audio → Whisper → Translate → Act ───────────────────────────────

async function processAudio(audioBlob) {
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob, "audio.webm");

    const transcribeRes = await fetch("http://localhost:5000/transcribe", {
      method: "POST",
      body: formData,
    });

    const transcribeData = await transcribeRes.json();
    const rawText = transcribeData.text;

    if (!rawText || rawText.trim() === "") {
      console.log("No speech detected in this segment");
      return;
    }

    console.log("User said (original):", rawText);

    // Translate Tamil/Tanglish → English
    let translatedText = rawText;
    try {
      const translateRes = await fetch("http://localhost:5000/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: rawText }),
      });
      const translateData = await translateRes.json();
      translatedText = translateData.translated || rawText;
      console.log("After translation:", translatedText);
    } catch (err) {
      console.error("Translation error:", err);
    }

    // Try local handlers
    if (detectFormFill(translatedText)) return;
    if (detectElement(translatedText)) return;

    // Backend fallback
    const processRes = await fetch("http://localhost:5000/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: translatedText }),
    });
    const processData = await processRes.json();
    console.log("Backend response:", processData);
    executeAction(processData);

  } catch (error) {
    console.error("processAudio error:", error);
  }
}

// ─── Execute Action ───────────────────────────────────────────────────────────

function executeAction(data) {
  if (data.action === "NAVIGATE") window.location.href = data.page;
  if (data.action === "FILL_FIELD") {
    const field = document.querySelector(`#${data.field}`);
    if (field) field.value = data.value;
  }
  if (data.action === "CLICK_BUTTON") {
    const btn = document.querySelector(data.selector);
    if (btn) btn.click();
  }
}

// ─── Page Scanning ────────────────────────────────────────────────────────────

let pageElements = [];

window.addEventListener("load", () => {
  pageElements = scanPage();
  setInterval(() => { pageElements = scanPage(); }, 3000);
});

function scanPage() {
  const elements = [];
  const candidates = document.querySelectorAll(
    "a[href], button, [role='button'], li a, div[role='menuitem'], nav a"
  );
  candidates.forEach((el) => {
    const text = el.innerText.trim();
    if (text.length > 0) elements.push({ text: text.toLowerCase(), element: el });
  });
  console.log("Detected elements:", elements);
  return elements;
}

// ─── Fuzzy Match (Levenshtein) ────────────────────────────────────────────────

function similarityScore(a, b) {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();

  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[b.length][a.length] / maxLen;
}

// ─── detectElement with Fuzzy Matching ───────────────────────────────────────

function detectElement(command) {
  command = command.toLowerCase();
  command = command.replace(/\bopen\b|\bgo\b|\bto\b|\bthe\b|\bpage\b/g, "").trim();

  let bestMatch = null;
  let bestScore = 0;
  const THRESHOLD = 0.6;

  for (let item of pageElements) {
    const score = similarityScore(command, item.text);
    console.log(`Comparing "${command}" vs "${item.text}" → score: ${score.toFixed(2)}`);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && bestScore >= THRESHOLD) {
    console.log(`✅ Fuzzy matched: "${bestMatch.text}" (score: ${bestScore.toFixed(2)})`);
    if (bestMatch.element.href) {
      window.location.href = bestMatch.element.href;
    } else {
      bestMatch.element.click();
    }
    setTimeout(() => { pageElements = scanPage(); }, 800);
    return true;
  }

  console.log("No matching element found");
  return false;
}

// ─── detectFormFill ───────────────────────────────────────────────────────────

function detectFormFill(command) {
  command = command.toLowerCase();
  const inputs = document.querySelectorAll("input, textarea");

  for (let input of inputs) {
    const label = input.placeholder || input.name || input.id || "";
    if (label.length < 3) continue;

    if (command.includes(label.toLowerCase())) {
      const parts = command.split(label.toLowerCase());
      if (parts.length > 1) {
        const value = parts[1].trim();
        if (!value) continue;
        input.focus();
        input.value = value;
        console.log("Filled:", label, "→", value);
        return true;
      }
    }
  }
  return false;
}