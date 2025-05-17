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

# ==========================================
#   ROUTE RECETTES
# ==========================================

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

# ==========================================
#   PAGE D'ACCUEIL DE l'API
# ==========================================

@app.route("/", methods=["GET"])
def home():
    return "API Émaux en ligne", 200

# ==========================================
#   ROUTE AJOUTER MATIERES
# ==========================================

@app.route("/ajouter_matiere", methods=["POST"])
def ajouter_matiere():
    data = request.get_json()
    nom = data["nom"]
    mat_type = data.get("type", "base")
    
    if mat_type not in ["base", "oxyde"]:
        return jsonify({"message": "Type invalide. Utilisez 'base' ou 'oxyde'."}), 400

    if not os.path.exists("stock.json"):
        stock = {}
    else:
        with open("stock.json", "r") as f:
            stock = json.load(f)

    if nom in stock:
        return jsonify({"message": "La matière existe déjà."}), 400

    stock[nom] = {
        "unite": data.get("unite", "kg"),
        "type": mat_type,
        "quantite": 0,
        "achats": []
    }

    with open("stock.json", "w") as f:
        json.dump(stock, f, indent=2)

    return jsonify({"message": f"{nom} ajoutée au stock."}), 201

# ==========================================
#              ROUTE ACHATS
# ==========================================

@app.route("/achat", methods=["POST"])
def enregistrer_achat():
    data = request.get_json()

    nom = data["nom"]
    quantite = data["quantite"]
    prix = data["prix"]
    fournisseur = data.get("fournisseur", "")
    date = data.get("date", "")
    unite = data.get("unite", "kg")
    mat_type = data.get("type", "base")

    if mat_type not in ["base", "oxyde"]:
        return jsonify({"message": "Type invalide. Utilisez 'base' ou 'oxyde'."}), 400

    if not os.path.exists("stock.json"):
        stock = {}
    else:
        with open("stock.json", "r") as f:
            stock = json.load(f)

    if nom not in stock:
        stock[nom] = {
            "unite": "kg",
            "type": mat_type,
            "quantite": 0,
            "achats": []
        }

    stock[nom]["quantite"] += quantite
    stock[nom]["achats"].append({
        "quantite": quantite,
        "prix": prix,
        "fournisseur": fournisseur,
        "date": date
    })

    with open("stock.json", "w") as f:
        json.dump(stock, f, indent=2)

    return jsonify({"message": f"Achat enregistré pour {nom}."}), 201

# ==========================================
#              AFFICHE LE STOCK
# ==========================================

@app.route("/stock", methods=["GET"])
def consulter_stock():
    if not os.path.exists("stock.json"):
        return jsonify({"message": "Le fichier stock.json n'existe pas."}), 404

    with open("stock.json", "r") as f:
        stock = json.load(f)

    return jsonify(stock), 200

# ==========================================
# 🚀 Point d'entrée : lance le serveur Flask
# Utilise le port fourni par Railway ou 5000 en local
# ==========================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
