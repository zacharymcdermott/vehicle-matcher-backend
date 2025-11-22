from flask import Flask, request, jsonify
import json

app = Flask(__name__)

# Load inventory from JSON file
try:
    with open("inventory.json") as f:
        INVENTORY = json.load(f)
except:
    INVENTORY = []

@app.route("/")
def home():
    return "Vehicle Matcher Backend Running"

@app.route("/match", methods=["POST"])
def match():
    data = request.json

    vehicle_type = data.get("vehicle_type", "").lower()
    price_range = data.get("price_range", "")
    seats = data.get("seats", "")
    usage = data.get("usage", "")
    exterior_color = data.get("exterior_color", "")

    matches = INVENTORY

    # SIMPLE MATCHING LOGIC FOR NOW
    for v in INVENTORY:
        if vehicle_type in v["body_style"].lower():
            matches.append(v)

    # Return top 3 for now
    return jsonify({"matches": matches[:3]})
