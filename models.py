from extensions import db
from datetime import datetime

class Matiere(db.Model):
    __tablename__ = 'matiere'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String, unique=True, nullable=False)
    type = db.Column(db.String, nullable=False)
    unite = db.Column(db.String, default="g")
    quantite = db.Column(db.Float, default=0.0)

    achats = db.relationship("Achat", backref="matiere", lazy=True)
    compositions = db.relationship("Composition", backref="matiere", lazy=True)

class Achat(db.Model):
    __tablename__ = 'achat'
    id = db.Column(db.Integer, primary_key=True)
    matiere_id = db.Column(db.Integer, db.ForeignKey("matiere.id"), nullable=False)
    quantite = db.Column(db.Float, nullable=False)
    prix = db.Column(db.Float, nullable=False)
    fournisseur = db.Column(db.String)
    date = db.Column(db.Date, default=datetime.utcnow)

class Recette(db.Model):
    __tablename__ = 'recette'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String, unique=True, nullable=False)
    compositions = db.relationship("Composition", backref="recette", lazy=True)

class Composition(db.Model):
    __tablename__ = 'composition'
    id = db.Column(db.Integer, primary_key=True)
    recette_id = db.Column(db.Integer, db.ForeignKey("recette.id"), nullable=False)
    matiere_id = db.Column(db.Integer, db.ForeignKey("matiere.id"), nullable=False)
    type = db.Column(db.String, nullable=False)
    pourcentage = db.Column(db.Float, nullable=False)
