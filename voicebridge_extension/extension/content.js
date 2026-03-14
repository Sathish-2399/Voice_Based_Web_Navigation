let recognition = null;
let pageElements = [];
let isProcessing = false;

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "START_VOICE") startVoice();
  if (request.action === "STOP_VOICE") stopVoice();
});

window.addEventListener("load", () => {
  pageElements = scanPage();
  setInterval(() => { pageElements = scanPage(); }, 3000);
});

// ─── TRANSLATION (Free MyMemory API — No key needed) ──────────────────────
async function translateToEnglish(text) {
  try {
    // Detect if text has Tamil characters
    const hasTamil = /[\u0B80-\u0BFF]/.test(text);

    // If pure English already, return as is
    if (!hasTamil && isEnglish(text)) {
      console.log("Already English:", text);
      return text;
    }

    const sourceLang = hasTamil ? "ta" : "en";
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|en`;

    const response = await fetch(url);
    const data = await response.json();

    const translated = data.responseData?.translatedText || text;
    console.log(`🔄 Translated: "${text}" → "${translated}"`);
    return translated.toLowerCase().trim();

  } catch (err) {
    console.error("Translation error:", err);
    return text; // fallback to original
  }
}

function isEnglish(text) {
  // Returns true if text is mostly English (ASCII characters)
  const englishChars = text.replace(/[^a-zA-Z]/g, "").length;
  const totalChars = text.replace(/\s/g, "").length;
  return totalChars === 0 || (englishChars / totalChars) > 0.7;
}

// ─── VOICE SETUP ──────────────────────────────────────────────────────────
function startVoice() {
  if (recognition) {
    console.log("Voice already running...");
    return;
  }

  pageElements = scanPage();

  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

  // Accepts Tamil script, Tanglish, and English all at once
  recognition.lang = "ta-IN";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = async function (event) {
    if (isProcessing) return;
    isProcessing = true;

    const rawText = event.results[event.results.length - 1][0].transcript.trim();
    console.log("🎤 Raw input:", rawText);

    // Translate everything to English first
    const englishText = await translateToEnglish(rawText);
    console.log("✅ English command:", englishText);

    // Now pass English text to all functions
    if (await detectFormFill(englishText)) { isProcessing = false; return; }
    if (detectDropdown(englishText)) { isProcessing = false; return; }
    if (detectElement(englishText)) { isProcessing = false; return; }
    await sendToBackend(englishText);

    isProcessing = false;
  };

  recognition.onerror = (e) => {
    console.error("Speech error:", e.error);
    isProcessing = false;
  };

  recognition.onend = () => {
    if (recognition) recognition.start(); // Auto-restart
  };

  recognition.start();
  console.log("🎤 Voice Recognition Started (Tamil + English)");
}

function stopVoice() {
  if (recognition) {
    recognition.stop();
    recognition = null;
    console.log("🛑 Voice Stopped");
  }
}

// ─── SCAN PAGE ELEMENTS ───────────────────────────────────────────────────
function scanPage() {
  const elements = [];
  const seen = new Set();

  const candidates = document.querySelectorAll(
    "a[href], button, [role='button'], [role='menuitem'], [role='tab'], input[type='submit'], input[type='button'], nav a, li a"
  );

  candidates.forEach((el) => {
    const text = (
      el.innerText ||
      el.value ||
      el.getAttribute("aria-label") || ""
    ).trim();

    if (text.length > 0 && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      elements.push({ text: text.toLowerCase(), element: el });
    }
  });

  console.log(`📄 Scanned ${elements.length} elements`);
  return elements;
}

// ─── DETECT DROPDOWN AND SELECT ───────────────────────────────────────────
function detectDropdown(command) {
  command = command.toLowerCase().trim();

  // Keywords that indicate filtering/selecting
  const filterKeywords = ["select", "choose", "filter", "sort", "pick", "set", "change"];
  const hasFilterWord = filterKeywords.some(k => command.includes(k));

  // ── Handle <select> dropdowns ──────────────────────────────────────────
  const selects = document.querySelectorAll("select");
  for (let select of selects) {
    const selectLabel = getFieldLabel(select).toLowerCase();

    // Check if command mentions this dropdown
    if (command.includes(selectLabel) || hasFilterWord) {
      const options = Array.from(select.options);

      // Find which option the user wants
      for (let option of options) {
        const optionText = option.text.toLowerCase();
        if (command.includes(optionText)) {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          console.log(`✅ Selected dropdown [${selectLabel}] → "${option.text}"`);
          return true;
        }
      }
    }
  }

  // ── Handle custom dropdowns (div/ul based) ────────────────────────────
  const dropdownTriggers = document.querySelectorAll(
    "[data-toggle='dropdown'], [aria-haspopup='listbox'], [aria-haspopup='true'], .dropdown-toggle, .select-trigger"
  );

  for (let trigger of dropdownTriggers) {
    const triggerText = (trigger.innerText || trigger.getAttribute("aria-label") || "").toLowerCase();
    if (command.includes(triggerText) || hasFilterWord) {
      trigger.click(); // open the dropdown

      setTimeout(() => {
        // Now find matching option inside opened dropdown
        const dropdownItems = document.querySelectorAll(
          "[role='option'], [role='menuitem'], .dropdown-item, .select-option, li[data-value]"
        );

        for (let item of dropdownItems) {
          const itemText = item.innerText.toLowerCase();
          if (command.includes(itemText)) {
            item.click();
            console.log(`✅ Custom dropdown selected: "${item.innerText}"`);
            return;
          }
        }
      }, 300);

      return true;
    }
  }

  // ── Handle sort/filter buttons (price, rating, date etc.) ─────────────
  const sortKeywords = {
    "price low to high": ["price-asc", "price_asc", "low-to-high", "lowtohigh"],
    "price high to low": ["price-desc", "price_desc", "high-to-low", "hightolow"],
    "newest":            ["newest", "latest", "new-arrivals", "date-desc"],
    "oldest":            ["oldest", "date-asc"],
    "rating":            ["rating", "top-rated", "best-rated"],
    "popularity":        ["popular", "popularity", "trending"],
    "relevance":         ["relevance", "relevant"],
  };

  for (let [phrase, selectors] of Object.entries(sortKeywords)) {
    if (command.includes(phrase)) {
      // Try clicking a button/link with matching text or data attribute
      const allClickable = document.querySelectorAll("button, a, li, [role='option']");
      for (let el of allClickable) {
        const elText = el.innerText?.toLowerCase() || "";
        const elValue = el.getAttribute("data-value")?.toLowerCase() || "";
        const elId = el.id?.toLowerCase() || "";

        if (
          elText.includes(phrase) ||
          selectors.some(s => elValue.includes(s) || elId.includes(s) || elText.includes(s))
        ) {
          el.click();
          console.log(`✅ Sort/Filter applied: "${phrase}"`);
          return true;
        }
      }
    }
  }

  return false;
}

// ─── DETECT AND CLICK PAGE ELEMENTS ──────────────────────────────────────
function detectElement(command) {
  let cleaned = command.toLowerCase()
    .replace(/\b(open|go to|click on|click|press|tap|navigate to|the|a|an)\b/g, "")
    .trim();

  console.log("🔍 Looking for element:", cleaned);

  // Exact match
  for (let item of pageElements) {
    if (item.text === cleaned) { triggerElement(item); return true; }
  }

  // Contains match
  for (let item of pageElements) {
    if (cleaned.includes(item.text) || item.text.includes(cleaned)) {
      triggerElement(item);
      return true;
    }
  }

  // Word-by-word match
  const words = cleaned.split(" ").filter(w => w.length > 2);
  for (let item of pageElements) {
    for (let word of words) {
      if (item.text.includes(word)) { triggerElement(item); return true; }
    }
  }

  console.log("❌ No matching element");
  return false;
}

function triggerElement(item) {
  console.log("✅ Triggered:", item.text);
  if (item.element.href) {
    window.location.href = item.element.href;
  } else {
    item.element.click();
  }
  setTimeout(() => { pageElements = scanPage(); }, 800);
}

// ─── VOICE FORM FILLING ───────────────────────────────────────────────────
async function detectFormFill(command) {
  command = command.toLowerCase();

  const inputs = document.querySelectorAll(
    "input:not([type='submit']):not([type='button']):not([type='checkbox']):not([type='radio']), textarea"
  );

  for (let input of inputs) {
    const identifiers = [
      input.placeholder,
      input.name,
      input.id,
      input.getAttribute("aria-label"),
      getFieldLabel(input),
    ].filter(Boolean).map(s => s.toLowerCase());

    for (let label of identifiers) {
      if (!label || label.length < 2) continue;

      if (command.includes(label)) {
        const parts = command.split(label);
        const value = parts[parts.length - 1].trim();

        if (value.length > 0) {
          fillInput(input, value);
          console.log(`✅ Filled [${label}] → "${value}"`);
          return true;
        }
      }
    }
  }

  // ── Checkbox / Radio by voice ─────────────────────────────────────────
  const checkboxes = document.querySelectorAll("input[type='checkbox'], input[type='radio']");
  for (let box of checkboxes) {
    const label = getFieldLabel(box).toLowerCase();
    if (label && command.includes(label)) {
      box.checked = !box.checked;
      box.dispatchEvent(new Event("change", { bubbles: true }));
      console.log(`✅ Toggled checkbox: "${label}"`);
      return true;
    }
  }

  return false;
}

function getFieldLabel(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.innerText.trim();
  }
  const parent = input.closest("label");
  if (parent) return parent.innerText.trim();
  const prev = input.previousElementSibling;
  if (prev && prev.tagName === "LABEL") return prev.innerText.trim();
  return "";
}

function fillInput(input, value) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

// ─── SEND TO BACKEND ──────────────────────────────────────────────────────
async function sendToBackend(text) {
  try {
    const response = await fetch("http://localhost:5000/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, url: window.location.href }),
    });
    const data = await response.json();
    console.log("🤖 Backend:", data);
    executeAction(data);
  } catch (err) {
    console.error("❌ Backend error:", err);
  }
}

// ─── EXECUTE BACKEND ACTIONS ──────────────────────────────────────────────
function executeAction(data) {
  switch (data.action) {
    case "NAVIGATE": window.location.href = data.page; break;
    case "SCROLL":
      window.scrollBy({ top: data.direction === "down" ? 400 : -400, behavior: "smooth" });
      break;
    case "GO_BACK": window.history.back(); break;
    case "RELOAD":  window.location.reload(); break;
    case "UNKNOWN": console.warn("⚠️ Unknown:", data.reason); break;
  }
}
