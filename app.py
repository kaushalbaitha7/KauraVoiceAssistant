
import os
import logging

from flask import Flask, render_template, request, jsonify, send_from_directory
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = Flask(__name__, static_folder=None)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

KAURA_SYSTEM_INSTRUCTION = """
You are KAURA, a warm, capable, helpful personal voice assistant.

Speak naturally, like a thoughtful assistant. Be friendly, respectful,
clear and practical.

Your first response to a greeting should greet the user and ask how
you can help.

Understand normal conversational language and follow-up questions.

Help with programming, engineering, study, career planning,
technology, entertainment and general knowledge.

Explain step by step when asked.

For voice responses, be concise unless the user asks for detail.

Never claim you performed an action you did not perform.

Your name is KAURA.
"""


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/style.css")
def serve_css():
    return send_from_directory("public", "style.css")


@app.route("/script.js")
def serve_js():
    return send_from_directory("public", "script.js")


@app.route("/health")
def health():
    return jsonify({
        "status": "online",
        "assistant": "KAURA",
        "provider": "Google Gemini" if client else "Browser-only fallback",
        "api_configured": bool(client),
        "model": GEMINI_MODEL
    })

@app.route("/ask", methods=["POST"])
def ask():

    data = request.get_json(silent=True) or {}

    messages = data.get("messages")

    if messages is None:
        message = data.get("message", "")
        messages = [
            {"role": "user", "content": message}
        ]

    if not isinstance(messages, list) or not messages:
        return jsonify({
            "success": False,
            "error": "Please enter a message."
        }), 400

    history = []

    for item in messages[-16:]:

        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")

        if role not in ("user", "assistant"):
            continue

        if not isinstance(content, str):
            continue

        content = content.strip()

        if not content:
            continue

        history.append(
            types.Content(
                role="user" if role == "user" else "model",
                parts=[
                    types.Part.from_text(
                        text=content[:5000]
                    )
                ]
            )
        )

    if not history or history[-1].role != "user":
        return jsonify({
            "success": False,
            "error": "The last message must be from the user."
        }), 400

    if not client:
        return jsonify({
            "success": False,
            "error": "Gemini API key is not configured. Add GEMINI_API_KEY to your .env file."
        }), 503

    try:

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=KAURA_SYSTEM_INSTRUCTION,
                temperature=0.7,
                max_output_tokens=900
            )
        )

        answer = (response.text or "").strip()

        if not answer:
            answer = "I'm here with you. Could you say that another way?"

        return jsonify({
            "success": True,
            "reply": answer,
            "response": answer
        })

    except Exception:

        logging.exception("Gemini request failed")

        return jsonify({
            "success": False,
            "error": "Gemini could not answer right now. Check your API key, model access, quota and server terminal."
        }), 502


@app.errorhandler(404)
def not_found(_error):
    return jsonify({
        "error": "Route not found."
    }), 404


if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )
