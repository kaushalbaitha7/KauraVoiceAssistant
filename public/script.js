
"use strict";

/* =========================================
   KAURA AI - VOICE ASSISTANT

   FIRST CLICK:
   Start continuous listening.

   SECOND CLICK:
   Stop recording, send complete transcript
   to Gemini, and speak the answer.

   No wake phrase.
   No automatic recording stop.
========================================= */


// -----------------------------------------
// DOM ELEMENTS
// -----------------------------------------

const $ = (id) => document.getElementById(id);

const chatLog = $("chatLog");
const chatForm = $("chatForm");
const messageInput = $("messageInput");

const micButton = $("micButton");
const micStatus = $("micStatus");

const clearButton = $("clearButton");
const assistantOrb = $("assistantOrb");


// -----------------------------------------
// SPEECH RECOGNITION SUPPORT
// -----------------------------------------

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


// -----------------------------------------
// APPLICATION STATE
// -----------------------------------------

let conversation = [];

let listeningEnabled = false;

let recognition = null;

let busy = false;

let speaking = false;

let finalTranscript = "";

let interimTranscript = "";

let restartTimer = null;

let stopRequested = false;

let responseStarted = false;


// -----------------------------------------
// STATUS
// -----------------------------------------

function setStatus(message) {

    if (micStatus) {
        micStatus.textContent = message;
    }

}


// -----------------------------------------
// ORB ANIMATION
// -----------------------------------------

function setOrb(state = "") {

    if (!assistantOrb) return;

    assistantOrb.classList.remove(
        "listening",
        "speaking",
        "active"
    );

    if (state) {
        assistantOrb.classList.add(state);
    }

}


// -----------------------------------------
// UPDATE MICROPHONE BUTTON
// -----------------------------------------

function updateControls() {

    if (!micButton) return;

    micButton.classList.remove("hidden");

    micButton.textContent = listeningEnabled
        ? "■ Stop & Get Answer"
        : "🎙 Start talking";

    micButton.disabled = busy || speaking;

}


// -----------------------------------------
// DISPLAY CHAT MESSAGE
// -----------------------------------------

function addMessage(role, text) {

    if (!chatLog) return;

    const wrap = document.createElement("div");

    wrap.className =
        `message ${role === "user"
            ? "user-message"
            : "assistant-message"}`;

    const avatar = document.createElement("div");

    avatar.className = "message-avatar";

    avatar.textContent = role === "user" ? "Y" : "K";

    const content = document.createElement("div");

    content.className = "message-content";

    const heading = document.createElement("strong");

    heading.textContent =
        role === "user" ? "YOU" : "KAURA";

    const paragraph = document.createElement("p");

    paragraph.textContent = text;

    content.append(heading, paragraph);

    wrap.append(avatar, content);

    chatLog.appendChild(wrap);

    chatLog.scrollTop = chatLog.scrollHeight;

}


// -----------------------------------------
// TEXT TO SPEECH
// -----------------------------------------

function speak(text) {

    if (!("speechSynthesis" in window)) {

        setStatus(
            "Answer received. Speech output is unavailable."
        );

        setOrb("");

        updateControls();

        return;

    }

    window.speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(text);

    utterance.lang = "en-IN";

    utterance.rate = 1;

    utterance.pitch = 1.02;

    utterance.onstart = () => {

        speaking = true;

        setOrb("speaking");

        setStatus("KAURA is speaking...");

        updateControls();

    };

    utterance.onend = () => {

        speaking = false;

        setOrb("");

        setStatus(
            "KAURA has answered. Click the microphone to speak again."
        );

        updateControls();

    };

    utterance.onerror = (event) => {

        console.error(
            "Speech synthesis error:",
            event.error
        );

        speaking = false;

        setOrb("");

        setStatus(
            "Answer received, but voice playback failed."
        );

        updateControls();

    };

    speaking = true;

    updateControls();

    window.speechSynthesis.speak(utterance);

}


// -----------------------------------------
// CREATE RECOGNITION
// -----------------------------------------

function createRecognition() {

    if (!SpeechRecognition) {

        setStatus(
            "Speech recognition is not supported. Use Chrome."
        );

        return null;

    }

    const r = new SpeechRecognition();

    r.lang = "en-IN";

    // Keep listening until the user clicks Stop.
    r.continuous = true;

    // Display words while the user is speaking.
    r.interimResults = true;

    r.maxAlternatives = 1;

    return r;

}


// -----------------------------------------
// START RECOGNITION SESSION
// -----------------------------------------

function startRecognition() {

    if (
        !listeningEnabled ||
        busy ||
        speaking ||
        recognition ||
        document.hidden
    ) {
        return;
    }

    const r = createRecognition();

    if (!r) return;

    recognition = r;

    r.onstart = () => {

        if (recognition !== r) return;

        console.log("KAURA microphone started.");

        setOrb("listening");

        setStatus(
            "Listening continuously. Speak everything, then click Stop & Get Answer."
        );

    };


    // -------------------------------------
    // LIVE SPEECH TRANSCRIPTION
    // -------------------------------------

    r.onresult = (event) => {

        if (recognition !== r) return;

        interimTranscript = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const result = event.results[i];

            const transcript =
                result[0].transcript.trim();

            if (result.isFinal) {

                finalTranscript += transcript + " ";

                console.log(
                    "KAURA final speech:",
                    transcript
                );

            } else {

                interimTranscript += transcript + " ";

            }

        }

        const completeText =
            (
                finalTranscript +
                interimTranscript
            ).trim();

        if (completeText) {

            setStatus(
                "Listening: " + completeText
            );

            console.log(
                "KAURA transcription:",
                completeText
            );

        }

    };


    // -------------------------------------
    // RECOGNITION ERRORS
    // -------------------------------------

    r.onerror = (event) => {

        console.error(
            "KAURA recognition error:",
            event.error
        );

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed" ||
            event.error === "audio-capture" ||
            event.error === "language-not-supported"
        ) {

            listeningEnabled = false;

            stopRequested = false;

            recognition = null;

            updateControls();

            setOrb("");

            const errors = {

                "not-allowed":
                    "Microphone permission denied. Allow microphone access.",

                "service-not-allowed":
                    "Speech recognition service is blocked.",

                "audio-capture":
                    "No microphone detected.",

                "language-not-supported":
                    "English recognition is unavailable."

            };

            setStatus(errors[event.error]);

        }

        // no-speech is not fatal:
        // the user may simply be pausing.

    };


    // -------------------------------------
    // SESSION ENDED
    // -------------------------------------

    r.onend = () => {

        console.log("KAURA recognition session ended.");

        if (recognition === r) {

            recognition = null;

        }

        // If the user clicked Stop,
        // process the complete transcript.

        if (stopRequested) {

            processCollectedSpeech();

            return;

        }

        // Otherwise keep listening.
        // Chrome may end a recognition session
        // even when continuous mode is enabled.

        if (listeningEnabled) {

            scheduleRecognitionRestart();

        }

    };


    // -------------------------------------
    // START
    // -------------------------------------

    try {

        r.start();

    } catch (error) {

        console.error(
            "Recognition start failed:",
            error
        );

        if (recognition === r) {
            recognition = null;
        }

        setStatus(
            "Could not start the microphone. Please retry."
        );

        scheduleRecognitionRestart();

    }

}


// -----------------------------------------
// RESTART IF CHROME ENDS A SESSION
// -----------------------------------------

function scheduleRecognitionRestart() {

    clearTimeout(restartTimer);

    if (
        !listeningEnabled ||
        stopRequested ||
        busy ||
        speaking ||
        recognition ||
        document.hidden
    ) {
        return;
    }

    restartTimer = setTimeout(() => {

        startRecognition();

    }, 700);

}


// -----------------------------------------
// START LISTENING
// -----------------------------------------

function startListening() {

    if (!SpeechRecognition) {

        setStatus(
            "Speech recognition is not supported. Please use Chrome."
        );

        return;

    }

    if (!window.isSecureContext) {

        setStatus(
            "Microphone requires HTTPS or localhost."
        );

        return;

    }

    if (busy || speaking) return;

    clearTimeout(restartTimer);

    finalTranscript = "";

    interimTranscript = "";

    stopRequested = false;

    responseStarted = false;

    listeningEnabled = true;

    updateControls();

    setStatus("Starting microphone...");

    startRecognition();

}


// -----------------------------------------
// STOP LISTENING
// -----------------------------------------

function stopListening() {

    if (!listeningEnabled) return;

    // Do not restart recognition after this point.

    listeningEnabled = false;

    stopRequested = true;

    clearTimeout(restartTimer);

    setOrb("");

    setStatus("Finishing your recording...");

    updateControls();

    if (recognition) {

        const current = recognition;

        try {

            // stop() allows final recognition results
            // to arrive before onend.

            current.stop();

        } catch (error) {

            console.warn(
                "Recognition stop:",
                error
            );

            if (recognition === current) {
                recognition = null;
            }

            processCollectedSpeech();

        }

    } else {

        processCollectedSpeech();

    }

}


// -----------------------------------------
// PROCESS COMPLETE SPEECH
// -----------------------------------------

async function processCollectedSpeech() {

    if (responseStarted) return;

    responseStarted = true;

    stopRequested = false;

    listeningEnabled = false;

    clearTimeout(restartTimer);

    const completeText =
        finalTranscript.trim();

    finalTranscript = "";

    interimTranscript = "";

    updateControls();

    setOrb("");

    if (!completeText) {

        setStatus(
            "I couldn't recognize any complete speech. Click the microphone and try again."
        );

        return;

    }

    console.log(
        "Complete KAURA recording:",
        completeText
    );

    // Send the entire recording as one question.

    await sendMessage(completeText, true);

}


// -----------------------------------------
// SEND MESSAGE TO GEMINI
// -----------------------------------------

async function sendMessage(rawText, shouldSpeak = false) {

    const text = String(rawText || "").trim();

    if (!text || busy) return;

    busy = true;

    updateControls();

    addMessage("user", text);

    conversation.push({

        role: "user",

        content: text

    });

    setStatus("KAURA is thinking...");

    setOrb("active");

    try {

        const response = await fetch("/ask", {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                messages: conversation

            })

        });

        const data =
            await response.json().catch(() => ({}));

        if (!response.ok) {

            throw new Error(
                data.error ||
                `Server error ${response.status}`
            );

        }

        const answer =
            data.reply ||
            data.response ||
            "I couldn't prepare a response.";

        conversation.push({

            role: "assistant",

            content: answer

        });

        addMessage("assistant", answer);

        busy = false;

        if (shouldSpeak) {

            speak(answer);

        } else {

            setStatus(
                "KAURA replied. Click the microphone to speak."
            );

            setOrb("");

            updateControls();

        }

    } catch (error) {

        console.error(
            "KAURA request failed:",
            error
        );

        conversation.pop();

        const message =
            error.message ||
            "Could not reach the server.";

        addMessage(
            "assistant",
            "I'm sorry, I couldn't connect. " + message
        );

        setStatus(message);

        setOrb("");

        busy = false;

        updateControls();

    }

}


// -----------------------------------------
// MICROPHONE BUTTON
// -----------------------------------------

if (micButton) {

    micButton.addEventListener("click", () => {

        if (listeningEnabled) {

            // Second click:
            // Stop recording and get the answer.

            stopListening();

        } else {

            // First click:
            // Start continuous recording.

            startListening();

        }

    });

}



// -----------------------------------------
// TYPED CHAT
// -----------------------------------------

if (chatForm) {

    chatForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const text =
                messageInput?.value.trim();

            if (!text) return;

            messageInput.value = "";

            // Stop any active recording before typed chat.
            if (listeningEnabled) {
                stopListening();
            }

            // true = KAURA speaks the answer aloud.
            await sendMessage(text, true);

        }
    );

}



// -----------------------------------------
// QUICK PROMPTS
// -----------------------------------------

document.querySelectorAll("[data-prompt]").forEach(
    (button) => {

        button.addEventListener("click", () => {

            const prompt =
                button.dataset.prompt || "";

            if (messageInput) {
                messageInput.value = prompt;
            }

            sendMessage(prompt, true);

        });

    }
);


// -----------------------------------------
// CLEAR CHAT
// -----------------------------------------

if (clearButton) {

    clearButton.addEventListener("click", () => {

        conversation = [];

        if (listeningEnabled) {

            listeningEnabled = false;

            stopRequested = false;

            clearTimeout(restartTimer);

            if (recognition) {

                const current = recognition;

                recognition = null;

                try {
                    current.abort();
                } catch (_) {}

            }

        }

        if ("speechSynthesis" in window) {

            window.speechSynthesis.cancel();

        }

        speaking = false;

        busy = false;

        finalTranscript = "";

        interimTranscript = "";

        responseStarted = false;

        if (chatLog) {

            chatLog.replaceChildren();

            const message = document.createElement("p");

            message.className = "empty-message";

            message.textContent =
                "A fresh conversation. Ask KAURA anything.";

            chatLog.appendChild(message);

        }

        setOrb("");

        setStatus("Conversation cleared.");

        updateControls();

    });

}


// -----------------------------------------
// PAGE VISIBILITY
// -----------------------------------------

document.addEventListener(
    "visibilitychange",
    () => {

        if (document.hidden && listeningEnabled) {

            stopListening();

        }

    }
);


// -----------------------------------------
// PAGE CLEANUP
// -----------------------------------------

window.addEventListener(
    "pagehide",
    () => {

        listeningEnabled = false;

        clearTimeout(restartTimer);

        if (recognition) {

            try {
                recognition.abort();
            } catch (_) {}

        }

        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

    }
);


// -----------------------------------------
// INITIALIZE KAURA
// -----------------------------------------

updateControls();

setStatus(
    "KAURA is ready. Click the microphone to start speaking."
);

console.log(
    "KAURA continuous recording assistant ready."
);
