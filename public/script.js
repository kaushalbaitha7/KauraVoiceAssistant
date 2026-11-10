
/* ============================================
   KAURA VOICE ASSISTANT
   Hands-free wake word: "Hey Kaura"
   ============================================ */

const micButton = document.getElementById("micButton");
const micStatus = document.getElementById("micStatus");

const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatLog = document.getElementById("chatLog");

const clearButton = document.getElementById("clearButton");

/* ============================================
   STATE MANAGEMENT
   ============================================ */

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;

let handsFreeEnabled = false;
let listening = false;
let speaking = false;
let processingCommand = false;

let currentMode = "idle";

let restartTimer = null;

/* ============================================
   CHAT MESSAGE FUNCTION
   ============================================ */

function addMessage(text, who) {

    const row = document.createElement("div");

    row.className =
        `message ${who === "user" ? "user-message" : "assistant-message"}`;

    const avatar = document.createElement("div");

    avatar.className = "avatar";

    avatar.textContent = who === "user" ? "Y" : "K";

    const bubble = document.createElement("div");

    bubble.className = "bubble";

    const label = document.createElement("small");

    label.textContent =
        who === "user" ? "YOU" : "KAURA · ASSISTANT";

    const paragraph = document.createElement("p");

    paragraph.textContent = text;

    bubble.append(label, paragraph);

    row.append(avatar, bubble);

    chatLog.appendChild(row);

    chatLog.scrollTop = chatLog.scrollHeight;

}

/* ============================================
   TEXT TO SPEECH
   ============================================ */

function speak(text, callback = null) {

    if (!("speechSynthesis" in window)) {

        speaking = false;

        if (callback) callback();

        return;

    }

    window.speechSynthesis.cancel();

    speaking = true;

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "en-US";

    utterance.rate = 1;

    utterance.pitch = 1;

    utterance.onend = () => {

        speaking = false;

        if (callback) callback();

    };

    utterance.onerror = () => {

        speaking = false;

        if (callback) callback();

    };

    window.speechSynthesis.speak(utterance);

}

/* ============================================
   STOP CURRENT RECOGNITION
   ============================================ */

function stopRecognition() {

    if (restartTimer) {

        clearTimeout(restartTimer);

        restartTimer = null;

    }

    if (recognition) {

        try {

            recognition.onend = null;

            recognition.stop();

        } catch (error) {

            console.log("Recognition already stopped.");

        }

        recognition = null;

    }

    listening = false;

    currentMode = "idle";

}

/* ============================================
   UPDATE ASSISTANT STATUS
   ============================================ */

function updateStatus(text) {

    micStatus.textContent = text;

}

/* ============================================
   START WAKE WORD LISTENING
   ============================================ */

function startWakeListening() {

    if (!handsFreeEnabled) return;

    if (!SpeechRecognition) return;

    if (document.hidden) return;

    if (speaking || processingCommand) return;

    stopRecognition();

    currentMode = "wake";

    const wakeRecognition = new SpeechRecognition();

    recognition = wakeRecognition;

    wakeRecognition.lang = "en-US";

    wakeRecognition.continuous = true;

    wakeRecognition.interimResults = true;

    wakeRecognition.maxAlternatives = 1;

    wakeRecognition.onstart = () => {

        listening = true;

        currentMode = "wake";

        micButton.classList.add("listening");

        updateStatus('Listening... Say "Hey Kaura"');

    };

    wakeRecognition.onresult = (event) => {

        let transcript = "";

        for (
            let i = 0;
            i < event.results.length;
            i++
        ) {

            transcript += event.results[i][0].transcript + " ";

        }

        const normalized = transcript
            .toLowerCase()
            .replace(/[.,!?]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        console.log("KAURA Wake Detection:", normalized);

        // Detect wake phrase

        if (/\bhey\s+kaura\b/.test(normalized)) {

            console.log("WAKE WORD DETECTED!");

            currentMode = "transition";

            updateStatus("Hello! I'm listening...");

            stopRecognition();

            // Give the wake response before capturing command

            speak("Yes! I'm listening.", () => {

                if (
                    handsFreeEnabled &&
                    !document.hidden
                ) {

                    startCommandListening();

                }

            });

        }

    };

    wakeRecognition.onerror = (event) => {

        console.log("Wake recognition error:", event.error);

        if (event.error === "not-allowed") {

            handsFreeEnabled = false;

            stopRecognition();

            micButton.classList.remove("listening");

            updateStatus(
                "Microphone permission denied. Please allow access."
            );

            return;

        }

        if (event.error === "service-not-allowed") {

            handsFreeEnabled = false;

            stopRecognition();

            micButton.classList.remove("listening");

            updateStatus(
                "Speech recognition is blocked by your browser."
            );

        }

    };

    wakeRecognition.onend = () => {

        listening = false;

        micButton.classList.remove("listening");

        // Restart wake detection if the session ended normally

        if (
            handsFreeEnabled &&
            !document.hidden &&
            currentMode === "wake" &&
            !speaking &&
            !processingCommand
        ) {

            restartTimer = setTimeout(() => {

                startWakeListening();

            }, 700);

        }

    };

    try {

        wakeRecognition.start();

    } catch (error) {

        console.error("Could not start wake recognition:", error);

    }

}

/* ============================================
   LISTEN FOR USER COMMAND
   ============================================ */

function startCommandListening() {

    if (!handsFreeEnabled) return;

    if (document.hidden) return;

    stopRecognition();

    currentMode = "command";

    processingCommand = false;

    const commandRecognition = new SpeechRecognition();

    recognition = commandRecognition;

    commandRecognition.lang = "en-US";

    commandRecognition.continuous = false;

    commandRecognition.interimResults = false;

    commandRecognition.maxAlternatives = 1;

    commandRecognition.onstart = () => {

        listening = true;

        currentMode = "command";

        micButton.classList.add("listening");

        updateStatus("I'm listening. Speak your command.");

    };

    commandRecognition.onresult = (event) => {

        const transcript =
            event.results[0][0].transcript.trim();

        if (!transcript) return;

        console.log("KAURA Command:", transcript);

        processingCommand = true;

        updateStatus(`You said: "${transcript}"`);

        sendMessage(transcript);

    };

    commandRecognition.onerror = (event) => {

        console.log("Command recognition error:", event.error);

        updateStatus(
            "I couldn't hear that clearly. Please try again."
        );

    };

    commandRecognition.onend = () => {

        listening = false;

        micButton.classList.remove("listening");

        if (
            handsFreeEnabled &&
            !document.hidden &&
            !processingCommand &&
            currentMode === "command"
        ) {

            speak("I didn't catch that. Let's try again.", () => {

                startWakeListening();

            });

        }

    };

    try {

        commandRecognition.start();

    } catch (error) {

        console.error("Command recognition failed:", error);

        processingCommand = false;

        startWakeListening();

    }

}

/* ============================================
   SEND MESSAGE TO FLASK
   ============================================ */

async function sendMessage(message) {

    const clean = message.trim();

    if (!clean) return;

    // Stop wake recognition while processing

    if (recognition) {

        stopRecognition();

    }

    processingCommand = true;

    addMessage(clean, "user");

    messageInput.value = "";

    try {

        const response = await fetch("/ask", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                message: clean

            })

        });

        if (!response.ok) {

            throw new Error("Flask server error");

        }

        const data = await response.json();

        const reply =
            data.reply || "I couldn't generate a response.";

        addMessage(reply, "assistant");

        // Open website if the backend requested it

        if (
            data.action &&
            data.action.type === "open" &&
            typeof data.action.url === "string" &&
            /^https?:\/\//i.test(data.action.url)
        ) {

            window.open(
                data.action.url,
                "_blank",
                "noopener,noreferrer"
            );

        }

        // Speak, then return to wake-word listening

        speak(reply, () => {

            processingCommand = false;

            if (handsFreeEnabled && !document.hidden) {

                startWakeListening();

            } else {

                currentMode = "idle";

                updateStatus(
                    'Tap the microphone to activate "Hey Kaura" mode.'
                );

            }

        });

    } catch (error) {

        console.error("KAURA Error:", error);

        const errorText =
            "I couldn't connect to the Python server. Please check Flask.";

        addMessage(errorText, "assistant");

        speak(errorText, () => {

            processingCommand = false;

            if (handsFreeEnabled && !document.hidden) {

                startWakeListening();

            }

        });

    }

}

/* ============================================
   MICROPHONE BUTTON
   ACTIVATES HANDS-FREE MODE
   ============================================ */

micButton.addEventListener("click", () => {

    if (!SpeechRecognition) {

        updateStatus(
            "Please use Chrome or Edge for voice recognition."
        );

        return;

    }

    // Turn off hands-free mode

    if (handsFreeEnabled) {

        handsFreeEnabled = false;

        processingCommand = false;

        stopRecognition();

        window.speechSynthesis?.cancel();

        speaking = false;

        micButton.classList.remove("listening");

        updateStatus("Hands-free mode turned off.");

        return;

    }

    // Activate hands-free mode

    handsFreeEnabled = true;

    processingCommand = false;

    updateStatus("Activating KAURA...");

    startWakeListening();

});

/* ============================================
   TEXT MESSAGE SUBMISSION
   ============================================ */

chatForm.addEventListener("submit", (event) => {

    event.preventDefault();

    const message = messageInput.value.trim();

    if (!message) return;

    // Pause voice recognition while typing a message

    stopRecognition();

    processingCommand = true;

    sendMessage(message);

});

/* ============================================
   QUICK PROMPTS
   ============================================ */

document.querySelectorAll("[data-prompt]").forEach(button => {

    button.addEventListener("click", () => {

        stopRecognition();

        processingCommand = true;

        sendMessage(button.dataset.prompt);

    });

});

/* ============================================
   CLEAR CHAT
   ============================================ */

clearButton.addEventListener("click", () => {

    chatLog.innerHTML = "";

    const message = document.createElement("div");

    message.className = "message assistant-message";

    const avatar = document.createElement("div");

    avatar.className = "avatar";

    avatar.textContent = "K";

    const bubble = document.createElement("div");

    bubble.className = "bubble";

    const label = document.createElement("small");

    label.textContent = "KAURA · ASSISTANT";

    const paragraph = document.createElement("p");

    paragraph.textContent =
        "Fresh start! What would you like to do?";

    bubble.append(label, paragraph);

    message.append(avatar, bubble);

    chatLog.appendChild(message);

    if ("speechSynthesis" in window) {

        window.speechSynthesis.cancel();

    }

});

/* ============================================
   PAUSE WHEN TAB BECOMES INACTIVE
   ============================================ */

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {

        stopRecognition();

        if ("speechSynthesis" in window) {

            window.speechSynthesis.cancel();

        }

        speaking = false;

        return;

    }

    if (handsFreeEnabled && !processingCommand) {

        startWakeListening();

    }

});

/* ============================================
   CLEAN UP WHEN PAGE CLOSES
   ============================================ */

window.addEventListener("pagehide", () => {

    handsFreeEnabled = false;

    stopRecognition();

    if ("speechSynthesis" in window) {

        window.speechSynthesis.cancel();

    }

});