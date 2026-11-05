from flask import Flask, render_template, request, jsonify
from datetime import datetime
import ast
import operator
import re

app = Flask(__name__)

# Safe arithmetic evaluator: supports only numbers and basic arithmetic operators.
_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

def safe_calculate(expression):
    expression = expression.lower().replace("×", "*").replace("÷", "/")
    expression = expression.replace("plus", "+").replace("minus", "-")
    expression = expression.replace("multiplied by", "*").replace("times", "*")
    expression = expression.replace("divided by", "/")
    expression = re.sub(r"[^0-9.+\-*/()% ]", "", expression).strip()

    if not expression:
        raise ValueError("No calculation found")

    tree = ast.parse(expression, mode="eval")

    def evaluate(node):
        if isinstance(node, ast.Expression):
            return evaluate(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _OPERATORS:
            left, right = evaluate(node.left), evaluate(node.right)
            if isinstance(node.op, ast.Pow) and abs(right) > 8:
                raise ValueError("Power is too large")
            return _OPERATORS[type(node.op)](left, right)
        if isinstance(node, ast.UnaryOp) and type(node.op) in _OPERATORS:
            return _OPERATORS[type(node.op)](evaluate(node.operand))
        raise ValueError("Unsupported calculation")

    result = evaluate(tree)
    if isinstance(result, float) and result.is_integer():
        return int(result)
    return round(result, 6) if isinstance(result, float) else result


def assistant_reply(message):
    text = message.strip()
    q = text.lower()
    now = datetime.now()

    if not text:
        return "I didn't catch that. Please type or say something."

    if any(word in q for word in ["hello", "hi", "hey", "good morning", "good evening"]):
        return "Hello! I'm Kaura, your Python voice assistant. How can I help you today?"

    if "your name" in q or "who are you" in q:
        return "I'm Kaura, a voice assistant built with Python Flask, HTML, CSS and browser speech technology."

    if "time" in q:
        return f"The current time is {now.strftime('%I:%M %p')}."

    if "date" in q or "today" in q or "day is it" in q:
        return f"Today is {now.strftime('%A, %d %B %Y')}."

    if q.startswith("calculate ") or q.startswith("what is ") or q.startswith("solve "):
        candidate = re.sub(r"^(calculate|what is|solve)\s+", "", q)
        try:
            answer = safe_calculate(candidate)
            return f"The answer is {answer}."
        except Exception:
            pass

    if "how are you" in q:
        return "I'm functioning perfectly and ready to assist you. Thank you for asking!"

    if "thank" in q:
        return "You're welcome! It's my pleasure to help."

    if "help" in q or "what can you do" in q:
        return ("I can tell you the time and date, greet you, solve basic arithmetic, "
                "and help you open popular websites. Try saying, 'What time is it?' "
                "or 'Calculate 25 times 4'.")

    if "open youtube" in q:
        return "Opening YouTube for you."
    if "open google" in q:
        return "Opening Google for you."
    if "open github" in q:
        return "Opening GitHub for you."
    if "open wikipedia" in q:
        return "Opening Wikipedia for you."

    if q.startswith("search for ") or q.startswith("search "):
        return "I'll open a web search for that."

    return ("I heard you say: " + text +
            ". I'm still learning that skill. Try asking for the time, date, "
            "a calculation, or say 'help' to see my commands.")


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "")
    reply = assistant_reply(message)
    q = message.strip().lower()

    action = None
    if "open youtube" in q:
        action = {"type": "open", "url": "https://www.youtube.com"}
    elif "open google" in q:
        action = {"type": "open", "url": "https://www.google.com"}
    elif "open github" in q:
        action = {"type": "open", "url": "https://github.com"}
    elif "open wikipedia" in q:
        action = {"type": "open", "url": "https://www.wikipedia.org"}
    elif q.startswith("search for ") or q.startswith("search "):
        term = re.sub(r"^search( for)?\s+", "", message.strip(), flags=re.I)
        from urllib.parse import quote_plus
        action = {"type": "open", "url": "https://www.google.com/search?q=" + quote_plus(term)}

    return jsonify({"reply": reply, "action": action})


if __name__ == "__main__":
    app.run(debug=True)
