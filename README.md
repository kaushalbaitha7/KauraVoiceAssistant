
# KAURA Gemini Voice Assistant

## Features

- Gemini-powered AI chat
- Browser speech-to-text
- Browser text-to-speech
- Hey KAURA wake phrase mode
- Voice conversation mode
- Responsive laptop and mobile interface
- Conversation history during the current session

## Requirements

- Python 3.10 or newer
- Google Gemini API key
- Google Chrome or Microsoft Edge recommended

## Installation

### Step 1: Create virtual environment

python -m venv .venv

### Step 2: Activate environment

Windows PowerShell:

.venv\Scripts\Activate.ps1

### Step 3: Install dependencies

python -m pip install -r requirements.txt

### Step 4: Configure API key

Copy .env.example to .env.

Add your Gemini API key:

GEMINI_API_KEY=your_key_here

GEMINI_MODEL=gemini-2.5-flash

### Step 5: Start application

python app.py

### Step 6: Open application

http://127.0.0.1:5000

## Deployment

Configure these environment variables on your hosting platform:

GEMINI_API_KEY

GEMINI_MODEL

Do not upload your .env file.

Use HTTPS for microphone access on deployed websites.

## Important Notes

- Gemini free-tier quotas and model availability can change.
- The browser must remain open and active for wake-word listening.
- This is not an always-on operating-system assistant.
- Chrome and Edge generally provide the best speech-recognition support.
- Microphone permission is required.
- Browser speech recognition may use the browser vendor's speech service.
- Voice conversation mode uses browser speech recognition and Gemini text responses. It is not Gemini Live audio.
- Avoid sending confidential information through free-tier API services.