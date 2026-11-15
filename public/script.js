
"use strict";

// KAURA: Gemini-powered AI + browser speech recognition and speech output.

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

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let conversation = [];

let mode = "wake";

let listeningEnabled = false;

let recognition = null;

let busy = false;

let speaking = false;

let restartTimer = null;

let commandAlreadySent = false;


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


function addMessage(role, text) {

    if (!chatLog) return;

    const wrap = document.createElement("div");

    wrap.className =
        `message ${role === "user" ? "user-message" : "assistant-message"}`;

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


function speak(text) {

    if (!("speechSynthesis" in window)) {

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

    utterance.onerror = () => {

        speaking = false;

        afterSpeaking();

    };

    window.speechSynthesis.speak(utterance);

}


function afterSpeaking() {

    if (!listeningEnabled) {

        setOrb("");

        return;

    }

    setStatus(
        mode === "wake"
            ? 'Listening for "Hey KAURA"...'
            : "KAURA is listening. Speak when ready."
    );

    setOrb("listening");

    scheduleRecognitionRestart();

}


function scheduleRecognitionRestart() {

    clearTimeout(restartTimer);

    if (
        !listeningEnabled ||
        busy ||
        speaking ||
        document.hidden
    ) {
        return;
    }

    restartTimer = setTimeout(
        startRecognition,
        700
    );

}


function createRecognition() {

    if (!SpeechRecognition) {

        setStatus(
            "Speech recognition is not supported here. Use Chrome or Edge."
        );

        return null;

    }

    const r = new SpeechRecognition();

    r.lang = "en-IN";

    r.continuous = mode === "wake";

    r.interimResults = true;

    return r;

}


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

    setOrb("listening");

    setStatus(
        mode === "wake"
            ? 'Listening for "Hey KAURA"...'
            : "Listening... speak naturally."
    );


    r.onresult = (event) => {

        let finalText = "";

        let interimText = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const transcript =
                event.results[i][0].transcript.trim();

            if (event.results[i].isFinal) {

                finalText += " " + transcript;

            } else {

                interimText += " " + transcript;

            }

        }


        if (mode === "wake") {

            const combined =
                (finalText + " " + interimText).trim();

            const match = combined.match(
                /\bhey\s+kaura\b[\s,.:;-]*(.*)/i
            );

            if (!match) return;

            const command = match[1].trim();

            stopRecognition();

            if (command.length > 1) {

                sendMessage(command, true);

            } else {

                setStatus(
                    "Yes, I'm listening. What can I do for you?"
                );

                speak(
                    "Yes, I'm listening. What can I do for you?"
                );

            }

            return;

        }


        if (
            finalText.trim() &&
            !commandAlreadySent
        ) {

            commandAlreadySent = true;

            const command = finalText.trim();

            stopRecognition();

            sendMessage(command, true);

        }

    };


    r.onerror = (event) => {

        console.warn(
            "Speech recognition error:",
            event.error
        );

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            stopListening();

            setStatus(
                "Microphone permission blocked. Allow microphone access in browser settings."
            );

        } else if (event.error === "no-speech") {

            setStatus(
                mode === "wake"
                    ? 'Still here. Say "Hey KAURA".'
                    : "I didn't hear anything. Try speaking again."
            );

        }

    };


    r.onend = () => {

        if (recognition === r) {
            recognition = null;
        }

        scheduleRecognitionRestart();

    };


    try {

        r.start();

    } catch (err) {

        recognition = null;

        console.warn(
            "Recognition start:",
            err
        );

        scheduleRecognitionRestart();

    }

}


function stopRecognition() {

    clearTimeout(restartTimer);

    if (!recognition) return;

    const old = recognition;

    recognition = null;

    old.onend = null;

    try {

        old.stop();

    } catch (_) {}

}


async function enableListening() {

    if (!navigator.mediaDevices?.getUserMedia) {

        setStatus(
            "Microphone requires HTTPS (or localhost)."
        );

        return;

    }

    if (!SpeechRecognition) {

        setStatus(
            "This browser does not support speech recognition. Try Chrome on desktop or Android."
        );

        return;

    }

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        stream.getTracks().forEach(
            (track) => track.stop()
        );

        listeningEnabled = true;

        updateControls();

        startRecognition();

    } catch (err) {

        console.error(err);

        setStatus(
            "Microphone permission denied. Allow it in your browser settings."
        );

    }

}


function stopListening() {

    listeningEnabled = false;

    stopRecognition();

    if ("speechSynthesis" in window) {

        window.speechSynthesis.cancel();

    }

    speaking = false;

    setOrb("");

    updateControls();

}


function updateControls() {

    if (micButton) {

        micButton.classList.toggle(
            "hidden",
            mode !== "wake"
        );

        micButton.textContent =
            listeningEnabled
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
                data.error || `Server error ${response.status}`
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

        conversation.pop();

        const message =
            err.message || "Could not reach the server.";

        addMessage(
            "assistant",
            `I'm sorry, I couldn't connect. ${message}`
        );

        setStatus(message);

        setOrb("");

        if (listeningEnabled) {
            scheduleRecognitionRestart();
        }

    } finally {

        busy = false;

        if (listeningEnabled && !speaking) {
            scheduleRecognitionRestart();
        }

    }

}


// Typed chat

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


// Quick prompts

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


// Hey KAURA button

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


// Voice conversation button

if (liveButton) {

    liveButton.addEventListener("click", () => {

        mode = "conversation";

        enableListening();

    });

}


// Stop conversation

if (stopButton) {

    stopButton.addEventListener("click", () => {

        stopListening();

        setStatus("Voice conversation ended.");

    });

}


// Mode selection

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


// Clear chat

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

        setStatus("Conversation cleared.");

    });

}


// Stop listening when page is hidden

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


window.addEventListener(
    "pagehide",
    stopListening
);


updateControls();

setStatus(
    "KAURA is ready. Type a message or activate voice mode."
);

console.log(
    "KAURA Gemini assistant ready."
);
