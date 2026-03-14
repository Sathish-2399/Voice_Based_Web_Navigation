const statusEl = document.getElementById("status");

document.getElementById("start").addEventListener("click", async () => {

  statusEl.textContent = "Connecting...";
  statusEl.style.color = "orange";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    statusEl.textContent = "❌ No active tab";
    statusEl.style.color = "red";
    return;
  }

  // Inject content.js first silently
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  } catch (e) {
    console.log("Already injected:", e.message);
  }

  // Send directly to content.js in the tab
  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, { action: "START_VOICE" });
    statusEl.textContent = "🎤 Voice Active!";
    statusEl.style.color = "green";
  }, 500);

});