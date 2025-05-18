// URL de base de l'API (hébergée sur Railway)
const API_URL = "https://glazeapi-production.up.railway.app";

//////////////////////////////////////////////
// Fonction pour charger et afficher le stock
/////////////////////////////////////////////

async function chargerStock() {
  try {
    // Appel GET à l'API /stock
    const res = await fetch(`${API_URL}/stock`);
    const data = await res.json();

    // Affiche les données formatées dans la balise <pre>
    document.getElementById("affichage-stock").textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    // En cas d'erreur : log + message d'alerte
    console.error("Erreur :", err);
    alert("Erreur lors du chargement du stock.");
  }
}

// Attache l'événement "click" au bouton une fois la page chargée
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-stock").addEventListener("click", chargerStock);
});

//////////////////////////////////////////////
// ajoute une recette
//////////////////////////////////////////////

// Convertit un texte "silice:40, kaolin:30" → {silice: 40, kaolin: 30}
function parseComposition(text) {
  const obj = {};
  text.split(",").forEach(entry => {
    const [cle, val] = entry.split(":").map(e => e.trim());
    if (cle && !isNaN(parseFloat(val))) obj[cle] = parseFloat(val);
  });
  return obj;
}

async function ajouterRecette(data) {
  try {
    const res = await fetch(`${API_URL}/ajouter_recette`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const retour = await res.json();
    document.getElementById("resultat-recette").textContent = retour.message;
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'ajout de la recette.");
  }
}

document.getElementById("form-recette").addEventListener("submit", e => {
  e.preventDefault();

  const nom = document.getElementById("recette-nom").value.trim();
  const base = parseComposition(document.getElementById("recette-base").value);
  const oxydes = parseComposition(document.getElementById("recette-oxydes").value);

  if (nom && Object.keys(base).length) {
    ajouterRecette({ nom, base, oxydes });
  } else {
    alert("Nom et base requis.");
  }
});

//////////////////////////////////////////////
// Envoie une matière à l'API /ajouter_matiere
//////////////////////////////////////////////
async function ajouterMatiere(nom, type) {
  try {
    const res = await fetch(`${API_URL}/ajouter_matiere`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, type })
    });

    const data = await res.json();
    document.getElementById("resultat-ajout").textContent = data.message;
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'ajout.");
  }
}

// Intercepte le formulaire
document.getElementById("form-ajout").addEventListener("submit", e => {
  e.preventDefault();
  const nom = document.getElementById("nom").value.trim();
  const type = document.getElementById("type").value;
  if (nom) ajouterMatiere(nom, type);
});

//////////////////////////////////////////////
// enregistre un achat
//////////////////////////////////////////////

async function enregistrerAchat(data) {
  try {
    const res = await fetch(`${API_URL}/achat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const retour = await res.json();
    document.getElementById("resultat-achat").textContent = retour.message;
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'enregistrement de l'achat.");
  }
}

document.getElementById("form-achat").addEventListener("submit", e => {
  e.preventDefault();
  const data = {
    nom: document.getElementById("achat-nom").value.trim(),
    quantite: parseFloat(document.getElementById("achat-quantite").value),
    prix: parseFloat(document.getElementById("achat-prix").value),
    fournisseur: document.getElementById("achat-fournisseur").value.trim(),
    date: document.getElementById("achat-date").value,
    type: document.getElementById("achat-type").value
  };
  enregistrerAchat(data);
});

//////////////////////////////////////////////
// simule une production
//////////////////////////////////////////////

async function simulerProduction(recette, masse) {
  try {
    const res = await fetch(`${API_URL}/simuler_production`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recette, masse })
    });

    const data = await res.json();

    // Affichage formaté
    let sortie = `Recette : ${data.recette}\nMasse demandée : ${data.demande} g\n\n`;

    data.details.forEach(item => {
      sortie += `${item.matiere} — ${item.quantite_necessaire} g requis\n`;
      sortie += `Disponible : ${item.disponible} g\n`;
      sortie += `Statut : ${item.statut} (${item.couleur})\n\n`;
    });

    sortie += `Production possible : ${data.production_possible ? "✅ OUI" : "❌ NON"}\n`;
    sortie += `Quantité max possible : ${data.production_maximale_possible} g`;

    document.getElementById("resultat-simulation").textContent = sortie;

  } catch (err) {
    console.error(err);
    alert("Erreur lors de la simulation.");
  }
}

document.getElementById("form-simulation").addEventListener("submit", e => {
  e.preventDefault();
  const recette = document.getElementById("simul-recette").value.trim();
  const masse = parseFloat(document.getElementById("simul-masse").value);
  if (recette && masse > 0) simulerProduction(recette, masse);
});

//////////////////////////////////////////////
// lance une production réelle
//////////////////////////////////////////////

async function lancerProduction(recette, masse) {
  try {
    const res = await fetch(`${API_URL}/produire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recette, masse })
    });

    const data = await res.json();
    document.getElementById("resultat-production").textContent = data.message || "Production enregistrée.";
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la production.");
  }
}

document.getElementById("form-production").addEventListener("submit", e => {
  e.preventDefault();
  const recette = document.getElementById("prod-recette").value.trim();
  const masse = parseFloat(document.getElementById("prod-masse").value);
  if (recette && masse > 0) lancerProduction(recette, masse);
});
