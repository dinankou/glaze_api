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
    # on normalise nom et type
    nom = data.get("nom", "").strip().lower()
    mat_type = data.get("type", "base").strip().lower()
    unite = data.get("unite", "g").strip()
    # validation
    if not nom:
        return jsonify({"message": "Le nom est requis."}), 400
    if mat_type not in ["base", "oxyde"]:
        return jsonify({"message": "Type invalide. Utilisez 'base' ou 'oxyde'."}), 400
    # détection d'existence en minuscules
    existante = Matiere.query.filter_by(nom=nom).first()
    if existante:
        return jsonify({"message": "La matière existe déjà."}), 400
    # création
    nouvelle = Matiere(nom=nom, type=mat_type, unite=unite, quantite=0.0)
    db.session.add(nouvelle)
    db.session.commit()
    return jsonify({"message": f"Matière '{nom}' ajoutée avec succès."}), 201

# ==========================================
#              ROUTE ACHATS
# ==========================================
from datetime import datetime
from flask import request, jsonify
from extensions import db
from models import Matiere, Achat

@app.route("/achat", methods=["POST"])
def enregistrer_achat():
    data = request.get_json()
    print("DEBUG /achat payload:", data)  # pour voir le JSON reçu
    try:
        nom = data.get("nom", "").strip().lower()
        quantite = data.get("quantite")
        prix = data.get("prix")
        fournisseur = data.get("fournisseur", "").strip()
        date_str = data.get("date")
        type_matiere = data.get("type")  # facultatif si matière existante

        # Champs obligatoires
        if not nom or quantite is None or prix is None:
            return jsonify({"message": "Champs requis : nom, quantite, prix"}), 400

        # Recherche ou création de la Matière
        matiere = Matiere.query.filter_by(nom=nom).first()
        if not matiere:
            # new: type obligatoire pour création
            if not type_matiere or type_matiere.strip().lower() not in ["base", "oxyde"]:
                return jsonify({
                    "message": "Matière inconnue. Précisez 'type' = 'base' ou 'oxyde'."
                }), 400
            tm = type_matiere.strip().lower()
            matiere = Matiere(
                nom=nom,
                type=tm,
                unite=data.get("unite", "g").strip(),
                quantite=0.0
            )
            db.session.add(matiere)
            db.session.flush()

        # Date
        if date_str:
            date = datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            date = datetime.utcnow().date()

        # Création de l'achat
        achat = Achat(
            matiere_id = matiere.id,
            quantite    = quantite,
            prix        = prix,
            fournisseur = fournisseur,
            date        = date
        )
        db.session.add(achat)

        # Mise à jour stock
        matiere.quantite += quantite

        db.session.commit()

        return jsonify({
            "message": f"Achat de {quantite}g pour '{matiere.nom}' enregistré.",
            "stock_restant": matiere.quantite
        }), 201

    except Exception as e:
        # Log l'erreur dans les logs Railway
        print("ERROR /achat:", str(e))
        return jsonify({"error": str(e)}), 500


# ==========================================
#              AFFICHE LE STOCK
# ==========================================

@app.route("/stock", methods=["GET"])
def consulter_stock():
    # 1. Requête : toutes les matières triées par quantité décroissante
    matieres = Matiere.query.order_by(Matiere.quantite.desc()).all()

    # 2. Séparation et formatage
    bases = []
    oxydes = []
    for m in matieres:
        entry = {
            "nom": m.nom,
            "type": m.type,
            "quantite": m.quantite
        }
        if m.type == "base":
            bases.append(entry)
        else:
            oxydes.append(entry)

    # 3. Retour JSON
    return jsonify({
        "bases": bases,
        "oxydes": oxydes
    }), 200

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
