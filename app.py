from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

# ✅ Configuration PostgreSQL via Railway
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DATABASE_URL")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ✅ Initialisation de SQLAlchemy
db = SQLAlchemy(app)
from models import Matiere, Achat, Recette, Composition

# ❗ Code JSON existant (à supprimer plus tard)
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
    nouvelle_recette = request.json

    # Charger les recettes existantes
    with open(DATA_FILE, "r") as f:
        data = json.load(f)

    # Aplatir les recettes si liste imbriquée
    recettes_flat = []
    for r in data:
        if isinstance(r, list):
            recettes_flat.extend(r)
        elif isinstance(r, dict):
            recettes_flat.append(r)

    # Vérifier les doublons (même nom)
    if any(r.get("nom") == nouvelle_recette.get("nom") for r in recettes_flat):
        return jsonify({"message": "Une recette avec ce nom existe déjà."}), 400

    # Ajouter et sauvegarder proprement
    recettes_flat.append(nouvelle_recette)
    with open(DATA_FILE, "w") as f:
        json.dump(recettes_flat, f, indent=2)

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

    unite = "g" if data.get("unite") == "kg" else data.get("unite", "g")

    if not os.path.exists("stock.json"):
        stock = {}
    else:
        with open("stock.json", "r") as f:
            stock = json.load(f)

    if nom in stock:
        return jsonify({"message": "La matière existe déjà."}), 400

    stock[nom] = {
        "unite": unite,
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
    quantite = data["quantite"]                        # quantité en grammes (saisie en grammes dans le frontend)
    prix_unitaire = data["prix"]                       # prix en €/kg (et non pas le total)
    fournisseur = data.get("fournisseur", "")
    date = data.get("date", "")
    unite = data.get("unite", "g")
    mat_type = data.get("type", "base")
    
    # Validation du type
    if mat_type not in ["base", "oxyde"]:
        return jsonify({"message": "Type invalide. Utilisez 'base' ou 'oxyde'."}), 400

    if unite == "kg":
        quantite *= 1000                              # conversion en grammes
        
    # calcul du prix total basé sur le prix/kg
    prix_total = round(prix_unitaire * (quantite / 1000), 2)

    # Chargement du fichier stock
    if not os.path.exists("stock.json"):
        stock = {}
    else:
        with open("stock.json", "r") as f:
            stock = json.load(f)
            
    # Initialisation de la matière si absente
    if nom not in stock:
        stock[nom] = {
            "unite": "g",
            "type": mat_type,
            "quantite": 0,
            "achats": []
        }
    # Mise à jour de la quantité
    stock[nom]["quantite"] += quantite
    
    # enregistrement détaillé de l'achat
    stock[nom]["achats"].append({
        "quantite": quantite,              # en g
        "prix": prix_total,                # prix total payé (calculé)
        "prix_unitaire": prix_unitaire,    # prix par kg (référence)
        "unite_prix": "€/kg",              # unité du prix
        "fournisseur": fournisseur,
        "date": date
    })
    
    # Sauvegarde
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
#              SIMULE UNE PRODUCTION
# ==========================================

@app.route("/simuler_production", methods=["POST"])
def simuler_production():
    data = request.get_json()
    nom_recette = data["recette"]
    masse_totale = data["masse"]

    # Charger les recettes
    if not os.path.exists("recettes.json"):
        return jsonify({"message": "Fichier recettes.json introuvable."}), 500

    with open("recettes.json", "r") as f:
        recettes = json.load(f)

# Chercher la recette demandée

    # Aplatir les recettes si besoin
    recettes_flat = []
    for r in recettes:
        if isinstance(r, list):
            recettes_flat.extend(r)
        elif isinstance(r, dict):
            recettes_flat.append(r)

    # Chercher la bonne recette
    recette = next((r for r in recettes_flat if r.get("nom") == nom_recette), None)
    if not recette:
        return jsonify({"message": f"Recette '{nom_recette}' introuvable."}), 404

    # Charger le stock
    if not os.path.exists("stock.json"):
        return jsonify({"message": "Fichier stock.json introuvable."}), 500

    with open("stock.json", "r") as f:
        stock = json.load(f)

    resultats = []
    stock_insuffisant = False
    min_ratio = float("inf")  # pour calculer la prod max possible

    # Fusionner base et oxydes dans une seule dict {nom: pourcentage}
    composants = recette["base"].copy()
    composants.update(recette["oxydes"])

    for matiere, pourcentage in composants.items():
        masse_necessaire = round((pourcentage / 100) * masse_totale, 2)

        infos_stock = stock.get(matiere)
        if not infos_stock:
            resultats.append({
                "matiere": matiere,
                "quantite_necessaire": masse_necessaire,
                "disponible": 0,
                "statut": "**INSUFFISANT** (matière absente)",  # noir
                "couleur": "noir",
                "manquant": masse_necessaire
            })
            stock_insuffisant = True
            min_ratio = 0
            continue

        quantite_disponible = infos_stock["quantite"]
        type_matiere = infos_stock.get("type", "base")

        # Seuils selon type
        seuil_orange = 300 if type_matiere == "base" else 30
        seuil_rouge = 200 if type_matiere == "base" else 20
        seuil_noir = 100 if type_matiere == "base" else 10

        reste_apres_prod = quantite_disponible - masse_necessaire

        # Calcul du statut
        if reste_apres_prod < seuil_noir:
            statut = "**INSUFFISANT**"
            couleur = "noir"
            stock_insuffisant = True
        elif reste_apres_prod < seuil_rouge:
            statut = "**OK**"
            couleur = "rouge"
        elif reste_apres_prod < seuil_orange:
            statut = "**OK**"
            couleur = "orange"
        else:
            statut = "**OK**"
            couleur = "vert"

        if masse_necessaire > 0:
            ratio = quantite_disponible / masse_necessaire
            min_ratio = min(min_ratio, ratio)


        resultats.append({
            "matiere": matiere,
            "quantite_necessaire": masse_necessaire,
            "disponible": quantite_disponible,
            "reste_apres_production": round(reste_apres_prod, 2),
            "statut": statut,
            "couleur": couleur,
            "manquant": round(max(0, masse_necessaire - quantite_disponible), 2)
        })

    prod_max = round(min_ratio * masse_totale, 2) if min_ratio > 0 else 0

    return jsonify({
        "recette": nom_recette,
        "demande": masse_totale,
        "production_possible": not stock_insuffisant,
        "production_maximale_possible": prod_max,
        "details": resultats
    }), 200

# ==========================================
#   ROUTE PRODUIRE
# ==========================================

@app.route("/produire", methods=["POST"])
def produire():
    data = request.get_json()
    nom_recette = data.get("recette")
    masse_totale = data.get("masse")
    confirmer = data.get("confirmer", False)  # 🔁 Frontend doit renvoyer true ici pour confirmer

    if not nom_recette or not masse_totale:
        return jsonify({"message": "Champs 'recette' et 'masse' requis."}), 400

    # 🔁 Charger les recettes
    if not os.path.exists("recettes.json"):
        return jsonify({"message": "Fichier recettes.json introuvable."}), 500

    with open("recettes.json", "r") as f:
        recettes = json.load(f)

    # 🔁 Aplatir le cas où les recettes sont dans une liste imbriquée
    recettes_flat = []
    for r in recettes:
        if isinstance(r, list):
            recettes_flat.extend(r)
        elif isinstance(r, dict):
            recettes_flat.append(r)

    # ✅ Cherche la bonne recette
    recette = next((r for r in recettes_flat if r.get("nom") == nom_recette), None)
    if not recette:
        return jsonify({"message": f"Recette '{nom_recette}' introuvable."}), 404

    # 🔁 Charger le stock
    if not os.path.exists("stock.json"):
        return jsonify({"message": "Fichier stock.json introuvable."}), 500

    with open("stock.json", "r") as f:
        stock = json.load(f)

    # ✅ Fusionne base et oxydes
    composants = recette["base"].copy()
    composants.update(recette["oxydes"])

    details = []
    stock_negatif = False
    alerte = False

    # 🔁 Vérifie chaque ingrédient
    for matiere, pourcentage in composants.items():
        masse_necessaire = round((pourcentage / 100) * masse_totale, 2)
        infos_stock = stock.get(matiere)

        if not infos_stock:
            return jsonify({"message": f"Matière '{matiere}' absente du stock."}), 400

        quantite_disponible = infos_stock["quantite"]
        reste_apres = round(quantite_disponible - masse_necessaire, 2)

        type_matiere = infos_stock.get("type", "base")
        seuil_noir = 100 if type_matiere == "base" else 10

        # ✅ Statut de la matière
        if reste_apres < 0:
            niveau = "negatif"
            stock_negatif = True
        elif reste_apres < seuil_noir:
            niveau = "noir"
            alerte = True
        else:
            niveau = "ok"

        details.append({
            "matiere": matiere,
            "quantite_necessaire": masse_necessaire,
            "disponible": quantite_disponible,
            "reste_apres": reste_apres,
            "niveau": niveau
        })

    # ❌ Blocage uniquement si le stock tomberait négatif
    if stock_negatif:
        return jsonify({
            "production_possible": False,
            "details": details,
            "message": "Production impossible. Le stock serait négatif. Révisez d'abord les quantités."
        }), 400

    # ⚠️ Si pas encore confirmé, renvoyer une alerte (mais pas bloquer)
    if not confirmer:
        return jsonify({
            "production_possible": True,
            "alerte": alerte,
            "details": details,
            "message": "Stock très bas sur certaines matières. Vérifiez avant de confirmer."
        }), 200

    # ✅ Si confirmé → on applique la production
    for item in details:
        matiere = item["matiere"]
        stock[matiere]["quantite"] = round(stock[matiere]["quantite"] - item["quantite_necessaire"], 2)

    with open("stock.json", "w") as f:
        json.dump(stock, f, indent=2)

    return jsonify({
        "message": f"Production de {masse_totale}g enregistrée pour '{nom_recette}'. Stock mis à jour.",
        "mise_a_jour": True
    }), 200


# ==========================================
# 🚀 Point d'entrée : lance le serveur Flask
# Utilise le port fourni par Railway ou 5000 en local
# ==========================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
    
@app.route("/init_db", methods=["POST"])
def init_db():
    try:
        db.create_all()
        return jsonify({"message": "Base de données initialisée avec succès."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
