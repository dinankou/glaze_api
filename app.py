# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os, json

from extensions import db  # ← nouveau

app = Flask(__name__)
CORS(app)

# Config PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DATABASE_URL")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# On initialise SQLAlchemy **sans** le passer au constructeur
db.init_app(app)

# Ensuite seulement on importe les modèles
from models import Matiere, Achat, Recette, Composition


# ==========================================
#   ROUTE RECETTES
# ==========================================




# ==========================================
#   ROUTE AJOUTER MATIERES
# ==========================================
@app.route("/ajouter_matiere", methods=["POST"])
def ajouter_matiere():
    data = request.get_json()
    nom = data.get("nom")
    mat_type = data.get("type", "base").lower()
    unite = data.get("unite", "g")

    # Validation du type
    if mat_type not in ["base", "oxyde"]:
        return jsonify({"message": "Type invalide. Utilisez 'base' ou 'oxyde'."}), 400

    # Vérifier si la matière existe déjà
    existante = Matiere.query.filter_by(nom=nom).first()
    if existante:
        return jsonify({"message": "La matière existe déjà."}), 400

    # Création et insertion
    nouvelle = Matiere(nom=nom, type=mat_type, unite=unite, quantite=0.0)
    db.session.add(nouvelle)
    db.session.commit()

    return jsonify({"message": f"Matière '{nom}' ajoutée avec succès."}), 201

# ==========================================
#              ROUTE ACHATS
# ==========================================


# ==========================================
#              AFFICHE LE STOCK
# ==========================================


# ==========================================
#              SIMULE UNE PRODUCTION
# ==========================================


# ==========================================
#   ROUTE PRODUIRE
# ==========================================


# def init_db

@app.route("/init_db", methods=["POST"])
def init_db():
    with app.app_context():
        db.create_all()
    return jsonify({"message": "Base initialisée."}), 201

# point d’entrée
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
