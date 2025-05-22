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
#   ROUTE AJOUTER RECETTES
# ==========================================

@app.route("/ajouter_recette", methods=["POST"])
def ajouter_recette():
    """
    Crée une nouvelle recette avec ses compositions.
    Si une matière (base ou oxyde) n'existe pas, elle est créée automatiquement
    avec un stock à 0.
    Accepte en plus deux liens optionnels :
      - description_url       : URL vers la description web de la recette
      - production_doc_url    : URL Google Doc journalisant la production
    """
    # ─── 1. Lecture du payload JSON ────────────────────────────────────────────
    data = request.get_json() or {}
    nom                 = data.get("nom", "").strip()
    base                = data.get("base", {})
    oxydes              = data.get("oxydes", {})
    description_url     = data.get("description_url",  "").strip() or None
    production_doc_url  = data.get("production_doc_url", "").strip() or None

    # ─── 2. Validations de base ───────────────────────────────────────────────
    # 2.1. Nom requis et unique
    if not nom:
        return jsonify({"message": "Le champ 'nom' est requis."}), 400
    if Recette.query.filter_by(nom=nom).first():
        return jsonify({"message": f"Recette '{nom}' existe déjà."}), 400

    # 2.2. La base doit être un dict non vide et totaliser 100%
    if not isinstance(base, dict) or not base:
        return jsonify({"message": "Le champ 'base' doit être un dictionnaire non vide."}), 400
    total_base = sum(base.values())
    if total_base != 100:
        return jsonify({
            "message": f"La somme des pourcentages de base doit être 100 %, obtenu : {total_base} %."
        }), 400

    # 2.3. Les oxydes doivent être un dict (peut être vide)
    if not isinstance(oxydes, dict):
        return jsonify({"message": "Le champ 'oxydes' doit être un dictionnaire (peut être vide)."}), 400

    # ─── 3. Création de l'objet Recette ────────────────────────────────────────
    recette = Recette(
        nom=nom,
        description_url=description_url,
        production_doc_url=production_doc_url
    )
    db.session.add(recette)
    db.session.flush()  # pour obtenir recette.id immédiatement

    # ─── 4. Utilitaire : récupérer ou créer une Matiere ──────────────────────
    def get_or_create_matiere(nom_mat, type_matiere):
        key = nom_mat.strip().lower()
        mat = Matiere.query.filter_by(nom=key).first()
        if not mat:
            mat = Matiere(nom=key, type=type_matiere, unite="g", quantite=0.0)
            db.session.add(mat)
            db.session.flush()  # pour obtenir mat.id
        return mat

    created = []  # liste des matières créées automatiquement

    # ─── 5. Ajout des compositions de base ────────────────────────────────────
    for nom_mat, pct in base.items():
        mat = get_or_create_matiere(nom_mat, "base")
        if mat.quantite == 0.0 and mat.nom not in created:
            created.append(mat.nom)
        comp = Composition(
            recette_id = recette.id,
            matiere_id = mat.id,
            type       = "base",
            pourcentage= float(pct)
        )
        db.session.add(comp)

    # ─── 6. Ajout des compositions d'oxydes ─────────────────────────────────
    for nom_mat, pct in oxydes.items():
        mat = get_or_create_matiere(nom_mat, "oxyde")
        if mat.quantite == 0.0 and mat.nom not in created:
            created.append(mat.nom)
        comp = Composition(
            recette_id = recette.id,
            matiere_id = mat.id,
            type       = "oxyde",
            pourcentage= float(pct)
        )
        db.session.add(comp)

    # ─── 7. Enregistrement final en base ─────────────────────────────────────
    db.session.commit()

    # ─── 8. Construction de la réponse ───────────────────────────────────────
    return jsonify({
        "message":               f"Recette '{nom}' créée avec {len(base)} base(s) et {len(oxydes)} oxyde(s).",
        "matières_créées":       created,
        "description_url":       description_url,
        "production_doc_url":    production_doc_url
    }), 201


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
            "quantite": m.quantite,
            "unite": m.unite  # ← On ajoute l’unité (par défaut "g")
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
#   ROUTE HISTORIQUE ACHATS
# ==========================================
@app.route("/historique_achats", methods=["GET"])
def historique_achats():
    # 1. On récupère toutes les lignes Achat + Matiere
    rows = (
        db.session.query(
            Achat.quantite,
            Achat.prix,
            Achat.fournisseur,
            Achat.date,
            Matiere.nom,
            Matiere.type
        )
        .join(Matiere, Achat.matiere_id == Matiere.id)
        .order_by(Achat.date.desc())
        .all()
    )

    # 2. Préparation du résultat
    result = {
        "bases": {
            "achats": [],
            "prix_par_matiere": {},
            "total_prix": 0.0
        },
        "oxydes": {
            "achats": [],
            "prix_par_matiere": {},
            "total_prix": 0.0
        }
    }

    # 3. Remplissage
    for quantite, prix, fournisseur, date, nom_mat, m_type in rows:
        cat = "bases" if m_type == "base" else "oxydes"

        # 3a. Détail de l'achat
        result[cat]["achats"].append({
            "nom": nom_mat,
            "quantite": quantite,
            "prix": prix,
            "fournisseur": fournisseur,
            "date": date.isoformat()
        })

        # 3b. Cumul prix par matière
        prix_pm = result[cat]["prix_par_matiere"].get(nom_mat, 0.0) + prix
        result[cat]["prix_par_matiere"][nom_mat] = round(prix_pm, 2)

        # 3c. Cumul total
        result[cat]["total_prix"] += prix

    # 4. Arrondir les totaux
    result["bases"]["total_prix"] = round(result["bases"]["total_prix"], 2)
    result["oxydes"]["total_prix"] = round(result["oxydes"]["total_prix"], 2)

    return jsonify(result), 200


# ==========================================
#              AFFICHE LES RECETTES
# ==========================================
from flask import jsonify
from extensions import db
from models import Recette, Composition, Matiere

@app.route("/recettes", methods=["GET"])
def get_recettes():
    """
    Retourne la liste de toutes les recettes,
    avec leurs compositions (bases / oxydes) et les URLs optionnelles.
    """
    recettes = Recette.query.order_by(Recette.nom).all()

    result = []
    for r in recettes:
        # Construire deux dicts : base et oxydes
        base = {}
        oxydes = {}
        for comp in r.compositions:
            mat_nom = comp.matiere.nom
            if comp.type == "base":
                base[mat_nom] = comp.pourcentage
            else:
                oxydes[mat_nom] = comp.pourcentage

        result.append({
            "nom": r.nom,
            "base": base,
            "oxydes": oxydes,
            "description_url": r.description_url,
            "production_doc_url": r.production_doc_url
        })

    return jsonify(result), 200


# ==========================================
#   ROUTE SIMULE + PRODUIRE
# ==========================================

# ─── 1) SIMULATION ───────────────────────────────────────────────────────────
@app.route("/simuler_production", methods=["POST"])
def simuler_production():
    data = request.get_json() or {}
    nom_recette = data.get("recette")
    masse_totale = data.get("masse")

    # validation
    if not nom_recette or masse_totale is None:
        return jsonify({"message": "Champs requis : 'recette' et 'masse'"}), 400

    # charger la recette et ses compositions
    recette = Recette.query.filter_by(nom=nom_recette).first()
    if not recette:
        return jsonify({"message": f"Recette '{nom_recette}' introuvable."}), 404

    # construire dict {matière: pourcentage}
    comps = {c.matiere.nom: c.pourcentage for c in recette.compositions}

    details = []
    min_ratio = float("inf")
    any_black = False

    for nom_mat, pct in comps.items():
        mt = Matiere.query.filter_by(nom=nom_mat).first()
        massa_req = round((pct/100)*masse_totale, 2)

        if not mt:
            # matière absente → noir
            details.append({
                "matiere": nom_mat,
                "quantite_necessaire": massa_req,
                "disponible": 0,
                "reste_apres_production": 0,
                "statut": "**INSUFFISANT** (absente)",
                "couleur": "noir",
                "manquant": massa_req
            })
            any_black = True
            continue

        dispo = mt.quantite
        seuil_orange = 300 if mt.type=="base" else 30
        seuil_rouge  = 200 if mt.type=="base" else 20
        seuil_noir   = 100 if mt.type=="base" else 5

        reste = round(dispo - massa_req, 2)
        # déterminer statut
        if reste < seuil_noir:
            statut, couleur = "**INSUFFISANT**", "noir"
            any_black = True
        elif reste < seuil_rouge:
            statut, couleur = "**OK**", "rouge"
        elif reste < seuil_orange:
            statut, couleur = "**OK**", "orange"
        else:
            statut, couleur = "**OK**", "vert"

        # calcul ratio pour quantité max
        if massa_req > 0:
            ratio = dispo / massa_req
            min_ratio = min(min_ratio, ratio)

        details.append({
            "matiere": nom_mat,
            "quantite_necessaire": massa_req,
            "disponible": dispo,
            "reste_apres_production": reste,
            "statut": statut,
            "couleur": couleur,
            "manquant": round(max(0, massa_req - dispo), 2)
        })

    prod_max = round(min_ratio * masse_totale, 2) if min_ratio > 0 and min_ratio != float("inf") else 0

    return jsonify({
        "recette": nom_recette,
        "demande": masse_totale,
        "production_possible": not any_black,
        "production_maximale_possible": prod_max,
        "details": details
    }), 200


# ─── 2) PRODUCTION RÉELLE ────────────────────────────────────────────────────
@app.route("/produire", methods=["POST"])
def produire():
    """
    Applique une production réelle :
    - Reprend la simulation via simuler_production()
    - Bloque si seuil noir atteint
    - Avertit si seuil orange/rouge (override requis)
    - Décrémente le stock si confirmé
    """
    data = request.get_json() or {}
    nom_recette = data.get("recette")
    masse_totale = data.get("masse")
    override = data.get("override", False)

    # 1) Validation
    if not nom_recette or masse_totale is None:
        return jsonify({"message": "Champs requis : 'recette' et 'masse'"}), 400

    # 2) Appel à la simulation (renvoie un tuple (response, status))
    sim_response, sim_status = simuler_production()
    if sim_status != 200:
        return sim_response, sim_status

    sim_data = sim_response.get_json()
    details = sim_data["details"]

    # 3) Vérification seuil noir
    black = [d for d in details if d["couleur"] == "noir"]
    if black:
        return jsonify({
            "message": "Production impossible : stock trop bas pour certaines matières (seuil noir).",
            "details": black
        }), 400

    # 4) Alerte orange/rouge
    low = [d for d in details if d["couleur"] in ("rouge", "orange")]
    if low and not override:
        return jsonify({
            "message": "Attention : stock bas pour certaines matières. Passez 'override': true pour confirmer.",
            "details": low
        }), 200

    # 5) Application de la production (décrémentation)
    for d in details:
        mt = Matiere.query.filter_by(nom=d["matiere"]).first()
        mt.quantite -= d["quantite_necessaire"]

    db.session.commit()

    # 6) Construction de la réponse finale avec le stock après prod
    stock_post = []
    for d in details:
        mt = Matiere.query.filter_by(nom=d["matiere"]).first()
        stock_post.append({
            "matiere": d["matiere"],
            "nouveau_stock": round(mt.quantite, 2)
        })

    return jsonify({
        "message": f"Production de {masse_totale}g de '{nom_recette}' réalisée avec succès.",
        "stock_apres": stock_post
    }), 200
    
# ==========================================
#   def init_db
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
