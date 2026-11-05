# Kaura — Python Voice Assistant

A mini-project built with Python Flask, HTML, CSS and JavaScript browser speech APIs.

## Features
- Voice input through the browser microphone (Web Speech API)
- Text input through the chat box
- Spoken responses through browser speech synthesis
- Time and date responses
- Basic arithmetic calculations
- Open YouTube, Google, GitHub and Wikipedia
- Google search command
- Responsive dark interface

## Requirements
- Python 3.9+
- Google Chrome or Microsoft Edge recommended
- Microphone permission for voice input

## Run on Windows
1. Extract the ZIP file.
2. Open the project folder in VS Code.
3. Open the terminal and create a virtual environment:

   `python -m venv venv`

4. Activate it:

   `venv\\Scripts\\activate`

5. Install dependencies:

   `pip install -r requirements.txt`

6. Start the Flask server:

   `python app.py`

7. Open this address in Chrome:

   `http://127.0.0.1:5000`

## Run on macOS / Linux
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then visit `http://127.0.0.1:5000`.

## Demo commands
- Hello Kaura
- What time is it?
- What is today's date?
- Calculate 25 times 4
- Calculate (50 + 20) / 2
- Open YouTube
- Open GitHub
- Search for artificial intelligence

## How it works
1. The browser captures speech and converts it into text using Web Speech API.
2. JavaScript sends the text to Flask using a POST request at `/ask`.
3. Python processes the command and returns a JSON response.
4. JavaScript displays the response and reads it aloud using SpeechSynthesis.

## Important notes
- Speech recognition support depends on the browser. Use a current version of Chrome or Edge and allow microphone access.
- Speech synthesis uses voices available on the user's device.
- Voice input and voice output are handled by browser APIs; Flask handles the assistant's command logic.
- This is an educational rule-based assistant, not a large language model. It does not understand every open-ended question.
- For a classroom demo, run it locally on `127.0.0.1`. Do not expose Flask debug mode to a public network.
