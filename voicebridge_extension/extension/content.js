let recognition = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_VOICE") {
    startVoice();
  }
});

function startVoice() {
  if (recognition) {
    console.log("Voice already running...");
    return;
  }

  recognition = new (
    window.SpeechRecognition || window.webkitSpeechRecognition
  )();

  // recognition.lang = "ta-IN";
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = async function (event) {
    const text = event.results[event.results.length - 1][0].transcript;

    console.log("User said:", text);

    if(detectFormFill(text)) return;
    if(detectElement(text)) return;
    
    try {
      const response = await fetch("http://localhost:5000/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();

      console.log("Backend response ", data);

      if(!data) executeAction(data);
    } catch (error) {
      console.error("Backend error:", error);
    }
  };

  recognition.start();

  console.log("🎤 Voice Recognition Started");
}

function executeAction(data) {
  if (data.action === "NAVIGATE") {
    window.location.href = data.page;
  }

  if (data.action === "FILL_FIELD") {
    const field = document.querySelector(`#${data.field}`);
    if (field) field.value = data.value;
  }

  if (data.action === "CLICK_BUTTON") {
    const btn = document.querySelector(data.selector);
    if (btn) btn.click();
  }
}

let pageElements = [];

window.addEventListener("load", () => {
  pageElements = scanPage();

  setInterval(() => {
    pageElements = scanPage();
  }, 5000);
});

function scanPage() {
  const elements = [];

  const candidates = document.querySelectorAll(
    "a[href], button, [role='button']",
  );

  candidates.forEach((el) => {
    const text = el.innerText.trim();
    if (text.length > 0 && el.offsetParent !== null) {
      elements.push({
        text: text.toLowerCase(),
        element: el,
      });
    }
  });

  console.log("Detected elements: ", elements);

  return elements;
}

function detectElement(command){

    command = command.toLowerCase();

    command = command.replace(/open|go|to|the|navigate|show|please/g,"").trim();

    const words = command.split(" ");

    for (let item of pageElements){

        for(let word of words){

            if(item.text === word || item.text.includes(word)){

                console.log("Matched element:", item.text);

                item.element.click();

                return true;
            }
        }
    }

    console.log("No matching commands");

    return false;
}


function detectFormFill(command){

    command = command.toLowerCase();

    const inputs = document.querySelectorAll("input, textarea, [contenteditable]");

    for(let input of inputs){

        const label =
            input.placeholder ||
            input.name ||
            input.id ||
            "";

        if(command.includes(label.toLowerCase())){

            const words = command.split(label.toLowerCase());

            if(words.length > 1){

                const value = words[1].trim();

                input.focus();
                input.value = value;

                console.log("Filled", label, value);

                return true;
            }
        }
    }
    return false;
}