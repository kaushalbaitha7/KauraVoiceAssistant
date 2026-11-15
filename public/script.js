
"use strict";

/* =========================================
   KAURA AI - GEMINI VOICE ASSISTANT
   Speech recognition + wake phrase + TTS
========================================= */

// DOM ELEMENTS

const $ = (id) => document.getElementById(id);

const chatLog = $("chatLog");
const chatForm = $("chatForm");
const messageInput = $("messageInput");

const micButton = $("micButton");
const micStatus = $("micStatus");

const wakeModeButton = $("wakeModeButton");
const liveModeButton = $("liveModeButton");

const liveButton = $("liveButton");
const stopButton = $("stopButton");

const clearButton = $("clearButton");
const assistantOrb = $("assistantOrb");


// SPEECH RECOGNITION SUPPORT

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


// =========================================
// APPLICATION STATE
// =========================================

let conversation = [];

let mode = "wake";

let listeningEnabled = false;

let recognition = null;

let busy = false;

let speaking = false;

let restartTimer = null;

let commandAlreadySent = false;

// In wake mode, this becomes true after KAURA hears
// its wake phrase and asks the user for a command.
let waitingForCommand = false;

// Reset wake phrase state after KAURA finishes
// speaking an answer to a command.
let resetWakeAfterSpeech = false;


// =========================================
// STATUS AND ORB
// =========================================

function setStatus(text) {

    if (micStatus) {
        micStatus.textContent = text;
    }

}


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


// =========================================
// CHAT MESSAGE DISPLAY
// =========================================

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

    const p = document.createElement("p");

    p.textContent = text;

    content.append(heading, p);

    wrap.append(avatar, content);

    chatLog.appendChild(wrap);

    chatLog.scrollTop = chatLog.scrollHeight;

}


// =========================================
// TEXT TO SPEECH
// =========================================

function speak(text) {

    if (!("speechSynthesis" in window)) {

        speaking = false;

        afterSpeaking();

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

    };

    utterance.onend = () => {

        speaking = false;

        afterSpeaking();

    };

    utterance.onerror = (event) => {

        console.error("Speech synthesis error:", event.error);

        speaking = false;

        afterSpeaking();

    };

    window.speechSynthesis.speak(utterance);

}


// =========================================
// AFTER KAURA SPEAKS
// =========================================

function afterSpeaking() {

    if (resetWakeAfterSpeech) {

        waitingForCommand = false;

        resetWakeAfterSpeech = false;

    }

    if (!listeningEnabled) {

        setOrb("");

        return;

    }

    setStatus(
        mode === "wake"
            ? waitingForCommand
                ? "I'm listening. Tell me what you need."
                : 'Listening for "Hey KAURA"...'
            : "KAURA is listening. Speak when ready."
    );

    setOrb("listening");

    scheduleRecognitionRestart();

}


// =========================================
// RESTART MANAGEMENT
// =========================================

function scheduleRecognitionRestart() {

    clearTimeout(restartTimer);

    if (
        !listeningEnabled ||
        busy ||
        speaking ||
        recognition ||
        document.hidden
    ) {
        return;
    }

    restartTimer = setTimeout(() => {

        startRecognition();

    }, 900);

}


// =========================================
// CREATE RECOGNITION
// =========================================

function createRecognition() {

    if (!SpeechRecognition) {

        setStatus(
            "Speech recognition is not supported. Try Chrome."
        );

        return null;

    }

    const r = new SpeechRecognition();

    // One utterance per session is more predictable
    // across desktop and mobile Chrome.

    r.lang = "en-IN";

    r.continuous = false;

    r.interimResults = true;

    r.maxAlternatives = 3;

    return r;

}


// =========================================
// WAKE PHRASE DETECTION
// =========================================

function extractWakeCommand(transcript) {

    const cleaned = transcript
        .toLowerCase()
        .replace(/[.,!?;:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    /*
       Speech recognition sometimes interprets
       KAURA as Cora, Kara or Koura.

       These alternatives are accepted as wake phrases.
    */

    const wakePattern =
        /\bhey\s+(?:kaura|cora|kara|koura|coura|kaora)\b\s*(.*)$/i;

    return cleaned.match(wakePattern);

}


// =========================================
// START RECOGNITION
// =========================================

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

    commandAlreadySent = false;


    // RECOGNITION STARTED

    r.onstart = () => {

        if (recognition !== r) return;

        console.log("KAURA recognition started.");

        setOrb("listening");

        setStatus(
            mode === "wake"
                ? waitingForCommand
                    ? "I'm listening for your command."
                    : 'Listening... Say "Hey KAURA".'
                : "I'm listening. Speak now."
        );

    };


    // SPEECH RESULT

    r.onresult = (event) => {

        if (recognition !== r) return;

        let finalTranscript = "";

        let interimTranscript = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const result = event.results[i];

            const transcript =
                result[0].transcript.trim();

            // Never send interim results to Gemini.

            if (result.isFinal) {

                finalTranscript += transcript + " ";

            } else {

                interimTranscript += transcript + " ";

            }

        }


        // Show interim speech in the browser console.
        if (interimTranscript.trim()) {

            console.log(
                "KAURA hearing:",
                interimTranscript.trim()
            );

        }


        finalTranscript = finalTranscript.trim();

        if (!finalTranscript) return;

        if (commandAlreadySent) return;


        console.log(
            "KAURA final transcript:",
            finalTranscript
        );


        // VOICE CONVERSATION MODE

        if (mode === "conversation") {

            commandAlreadySent = true;

            stopRecognition();

            sendMessage(finalTranscript, true);

            return;

        }


        // WAKE MODE: ALREADY AWAKENED

        if (waitingForCommand) {

            commandAlreadySent = true;

            waitingForCommand = false;

            resetWakeAfterSpeech = true;

            stopRecognition();

            sendMessage(finalTranscript, true);

            return;

        }


        // WAKE MODE: DETECT WAKE PHRASE

        const match = extractWakeCommand(finalTranscript);

        if (!match) {

            console.log(
                "Wake phrase not detected:",
                finalTranscript
            );

            return;

        }

        const command = (match[1] || "").trim();

        commandAlreadySent = true;

        stopRecognition();


        // Wake phrase and command in the same sentence.

        if (command) {

            waitingForCommand = false;

            resetWakeAfterSpeech = true;

            sendMessage(command, true);

        } else {

            // User only said "Hey KAURA".

            waitingForCommand = true;

            resetWakeAfterSpeech = false;

            speak(
                "Yes, I'm listening. What can I do for you?"
            );

        }

    };


    // SPEECH ERROR

    r.onerror = (event) => {

        if (recognition !== r) return;

        console.error(
            "KAURA speech recognition error:",
            event.error
        );

        const errors = {

            "not-allowed":
                "Microphone permission denied. Allow microphone access.",

            "service-not-allowed":
                "Browser speech recognition service is blocked.",

            "no-speech":
                "I couldn't hear you. Please speak again.",

            "network":
                "Speech recognition network error. Check your internet.",

            "audio-capture":
                "No microphone detected.",

            "language-not-supported":
                "English recognition is unavailable.",

            "aborted":
                "Speech recognition interrupted."

        };

        setStatus(
            errors[event.error] ||
            "Speech recognition error: " + event.error
        );

    };


    // SESSION ENDED

    r.onend = () => {

        console.log("KAURA recognition session ended.");

        if (recognition === r) {

            recognition = null;

            scheduleRecognitionRestart();

        }

    };


    // START

    try {

        r.start();

    } catch (error) {

        if (recognition === r) {

            recognition = null;

        }

        console.error(
            "Recognition start failed:",
            error
        );

        setStatus(
            "Could not start microphone recognition. Please retry."
        );

        scheduleRecognitionRestart();

    }

}


// =========================================
// STOP CURRENT RECOGNITION SESSION
// =========================================

function stopRecognition() {

    clearTimeout(restartTimer);

    if (!recognition) return;

    const old = recognition;

    // Detach the session before stopping it.
    // Its onend event will not start another session.

    recognition = null;

    try {

        old.stop();

    } catch (error) {

        console.warn(
            "Recognition stop:",
            error.message
        );

    }

}


// =========================================
// ENABLE LISTENING
// =========================================

function enableListening() {

    if (!SpeechRecognition) {

        setStatus(
            "Speech recognition is not supported. Please use Chrome."
        );

        return;

    }

    if (listeningEnabled) {

        return;

    }

    if (!window.isSecureContext) {

        setStatus(
            "Microphone requires HTTPS or localhost."
        );

        return;

    }

    // Do not await getUserMedia here.
    // Start recognition directly from the button click.

    listeningEnabled = true;

    waitingForCommand = false;

    resetWakeAfterSpeech = false;

    updateControls();

    setStatus("Starting KAURA microphone...");

    startRecognition();

}


// =========================================
// STOP ALL LISTENING
// =========================================

function stopListening() {

    listeningEnabled = false;

    waitingForCommand = false;

    resetWakeAfterSpeech = false;

    clearTimeout(restartTimer);

    stopRecognition();

    if ("speechSynthesis" in window) {

        window.speechSynthesis.cancel();

    }

    speaking = false;

    busy = false;

    setOrb("");

    updateControls();

}


// =========================================
// UPDATE BUTTONS
// =========================================

function updateControls() {

    if (micButton) {

        micButton.classList.toggle(
            "hidden",
            mode !== "wake"
        );

        micButton.textContent =
            listeningEnabled && mode === "wake"
                ? "■ Stop Hey KAURA"
                : "🎙 Activate Hey KAURA";

    }


    if (liveButton) {

        liveButton.classList.toggle(
            "hidden",
            mode !== "conversation" || listeningEnabled
        );

        liveButton.textContent =
            "◉ Start conversation";

    }


    if (stopButton) {

        stopButton.classList.toggle(
            "hidden",
            !listeningEnabled || mode !== "conversation"
        );

    }


    if (wakeModeButton) {

        wakeModeButton.classList.toggle(
            "active",
            mode === "wake"
        );

    }


    if (liveModeButton) {

        liveModeButton.classList.toggle(
            "active",
            mode === "conversation"
        );

    }

}


// =========================================
// SEND MESSAGE TO GEMINI
// =========================================

async function sendMessage(rawText, shouldSpeak = false) {

    const text = String(rawText || "").trim();

    if (!text || busy) return;

    busy = true;

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


        if (
            shouldSpeak ||
            (listeningEnabled && mode === "wake")
        ) {

            speak(answer);

        } else {

            setStatus(
                "KAURA replied. Ask another question."
            );

            setOrb("");

        }

    } catch (err) {

        console.error(
            "KAURA request failed:",
            err
        );

        // Remove the failed user message from history.

        conversation.pop();

        const message =
            err.message ||
            "Could not reach the server.";

        addMessage(
            "assistant",
            `I'm sorry, I couldn't connect. ${message}`
        );

        setStatus(message);

        setOrb("");

        // Reset wake phrase state after a failed command.

        if (mode === "wake") {

            waitingForCommand = false;

            resetWakeAfterSpeech = false;

        }

    } finally {

        busy = false;

        if (listeningEnabled && !speaking) {

            scheduleRecognitionRestart();

        }

    }

}


// =========================================
// TYPED CHAT
// =========================================

if (chatForm) {

    chatForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const text =
                messageInput?.value.trim();

            if (!text) return;

            messageInput.value = "";

            await sendMessage(text, false);

        }
    );

}


// =========================================
// QUICK PROMPTS
// =========================================

document.querySelectorAll("[data-prompt]").forEach(
    (button) => {

        button.addEventListener("click", () => {

            const prompt =
                button.dataset.prompt || "";

            if (messageInput) {

                messageInput.value = prompt;

            }

            sendMessage(prompt, false);

        });

    }
);


// =========================================
// HEY KAURA BUTTON
// =========================================

if (micButton) {

    micButton.addEventListener("click", () => {

        if (listeningEnabled) {

            stopListening();

            setStatus("Hey KAURA mode stopped.");

        } else {

            mode = "wake";

            enableListening();

        }

    });

}


// =========================================
// VOICE CONVERSATION BUTTON
// =========================================

if (liveButton) {

    liveButton.addEventListener("click", () => {

        mode = "conversation";

        enableListening();

    });

}


// =========================================
// STOP CONVERSATION BUTTON
// =========================================

if (stopButton) {

    stopButton.addEventListener("click", () => {

        stopListening();

        setStatus("Voice conversation ended.");

    });

}


// =========================================
// MODE SELECTION
// =========================================

wakeModeButton?.addEventListener(
    "click",
    () => {

        if (listeningEnabled) {

            stopListening();

        }

        mode = "wake";

        updateControls();

        setStatus(
            'Tap Activate Hey KAURA, then say "Hey KAURA".'
        );

    }
);


liveModeButton?.addEventListener(
    "click",
    () => {

        if (listeningEnabled) {

            stopListening();

        }

        mode = "conversation";

        updateControls();

        setStatus(
            "Tap Start conversation to begin voice chat."
        );

    }
);


// =========================================
// CLEAR CHAT
// =========================================

if (clearButton) {

    clearButton.addEventListener("click", () => {

        conversation = [];

        if (chatLog) {

            chatLog.replaceChildren();

            const p = document.createElement("p");

            p.className = "empty-message";

            p.textContent =
                "A fresh conversation. Ask KAURA anything.";

            chatLog.appendChild(p);

        }

        if ("speechSynthesis" in window) {

            window.speechSynthesis.cancel();

        }

        speaking = false;

        setStatus("Conversation cleared.");

        setOrb("");

        if (listeningEnabled) {

            scheduleRecognitionRestart();

        }

    });

}


// =========================================
// PAGE VISIBILITY
// =========================================

document.addEventListener(
    "visibilitychange",
    () => {

        if (document.hidden && listeningEnabled) {

            stopListening();

            setStatus(
                "Voice listening stopped because the page is hidden."
            );

        }

    }
);


// =========================================
// PAGE CLEANUP
// =========================================

window.addEventListener(
    "pagehide",
    stopListening
);


// =========================================
// INITIALIZE KAURA
// =========================================

updateControls();

setStatus(
    "KAURA is ready. Type a message or activate voice mode."
);

console.log(
    "KAURA Gemini voice assistant ready."
);
