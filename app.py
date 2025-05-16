from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

DATA_FILE = "recettes.json"

if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump([], f)

@app.route("/recettes", methods=["GET"])
def get_recettes():
    with open(DATA_FILE, "r") as f:
        data = json.load(f)
    return jsonify(data)

@app.route("/ajouter_recette", methods=["POST"])
def ajouter_recette():
    recette = request.json
    with open(DATA_FILE, "r") as f:
        data = json.load(f)
    data.append(recette)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)
    return jsonify({"message": "Recette ajoutée"}), 201

@app.route("/", methods=["GET"])
def home():
    return "API Émaux en ligne", 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
