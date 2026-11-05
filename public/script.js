const micButton = document.getElementById("micButton");
const micStatus = document.getElementById("micStatus");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatLog = document.getElementById("chatLog");
const clearButton = document.getElementById("clearButton");

function addMessage(text, who) {
  const row = document.createElement("div");
  row.className = `message ${who === "user" ? "user-message" : "assistant-message"}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = who === "user" ? "Y" : "N";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const label = document.createElement("small");
  label.textContent = who === "user" ? "YOU" : "KAURA · ASSISTANT";
  const paragraph = document.createElement("p");
  paragraph.textContent = text; // textContent prevents HTML injection

  bubble.append(label, paragraph);
  row.append(avatar, bubble);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

async function sendMessage(message) {
  const clean = message.trim();
  if (!clean) return;
  addMessage(clean, "user");
  messageInput.value = "";

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({message: clean})
    });
    const data = await response.json();
    addMessage(data.reply, "assistant");
    speak(data.reply);

    if (data.action && data.action.type === "open") {
      window.open(data.action.url, "_blank", "noopener");
    }
  } catch (error) {
    const errorText = "I couldn't connect to the Python server. Please check that Flask is running.";
    addMessage(errorText, "assistant");
    speak(errorText);
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(messageInput.value);
});

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});

clearButton.addEventListener("click", () => {
  chatLog.innerHTML = "";
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    listening = true;
    micButton.classList.add("listening");
    micStatus.textContent = "Listening... speak now";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    micStatus.textContent = `You said: "${transcript}"`;
    sendMessage(transcript);
  };

  recognition.onerror = (event) => {
    micStatus.textContent = `Microphone issue: ${event.error}. You can type instead.`;
  };

  recognition.onend = () => {
    listening = false;
    micButton.classList.remove("listening");
    if (!micStatus.textContent.startsWith("You said:")) {
      micStatus.textContent = "Tap the microphone and start speaking";
    }
  };

  micButton.addEventListener("click", () => {
    if (listening) recognition.stop();
    else {
      try { recognition.start(); }
      catch (error) { micStatus.textContent = "Please wait a moment and try again."; }
    }
  });
} else {
  micButton.disabled = true;
  micStatus.textContent = "Voice input is not supported in this browser. Please use text input or try Chrome.";
}

window.addEventListener("beforeunload", () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
});
