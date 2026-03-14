console.log("VoiceBridge background running");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "START_VOICE") {

    // Forward START_VOICE to the active tab's content.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;

      chrome.tabs.sendMessage(tabs[0].id, { action: "START_VOICE" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Forward error:", chrome.runtime.lastError.message);
        }
      });
    });
  }

});