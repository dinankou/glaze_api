// URL de base de l'API (hébergée sur Railway)
const API_URL = "https://glazeapi-production.up.railway.app";
console.log("✅ script.js chargé");
//////////////////////////////////////////////
// Fonction pour charger et afficher le stock
/////////////////////////////////////////////

async function chargerStock() {
  try {
    const res = await fetch(`${API_URL}/stock`);
    const stock = await res.json();

    const tbody = document.querySelector("#table-stock tbody");
    tbody.innerHTML = ""; // vide le tableau

    for (const [nom, matiere] of Object.entries(stock)) {
      const tr = document.createElement("tr");

      // Quantité toujours en grammes
      const quantite = matiere.unite === "kg"
        ? matiere.quantite * 1000
        : matiere.quantite;

      tr.innerHTML = `
        <td>${nom}</td>
        <td>${quantite} g</td>
        <td>${matiere.type}</td>
        <td>${matiere.achats.length}</td>
      `;

      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error("Erreur :", err);
    alert("Erreur lors du chargement du stock.");
  }
}


// Attache les événements une fois le DOM chargé
document.addEventListener("DOMContentLoaded", () => {
  const btnStock = document.getElementById("btn-stock");
  if (btnStock) {
    btnStock.addEventListener("click", chargerStock);
  }

  const btnRecettes = document.getElementById("btn-recettes");
  if (btnRecettes) {
    btnRecettes.addEventListener("click", chargerRecettes);
  }

  const formProduction = document.getElementById("form-production");
  if (formProduction) {
    formProduction.addEventListener("submit", e => {
      e.preventDefault();
      const recette = document.getElementById("prod-recette").value.trim();
      const masse = parseFloat(document.getElementById("prod-masse").value);
      if (recette && masse > 0) {
        lancerProduction(recette, masse);
      }
    });
  }
});

//////////////////////////////////////////////
// affiche la liste des recettes
//////////////////////////////////////////////

async function chargerRecettes() {
  try {
    const res = await fetch(`${API_URL}/recettes`);
    const recettes = await res.json();

    const ul = document.getElementById("liste-recettes");
    ul.innerHTML = ""; // vide la liste

    recettes.forEach(recette => {
      const li = document.createElement("li");

      const base = Object.entries(recette.base)
        .map(([nom, val]) => `${nom}: ${val}%`)
        .join(", ");

      const oxydes = Object.entries(recette.oxydes || {})
        .map(([nom, val]) => `${nom}: ${val}%`)
        .join(", ");

      li.textContent = `${recette.nom} → Base: [${base}] | Oxydes: [${oxydes}]`;
      ul.appendChild(li);
    });

  } catch (err) {
    console.error("Erreur :", err);
    alert("Erreur lors du chargement des recettes.");
  }
}


//////////////////////////////////////////////
// ajoute une recette
//////////////////////////////////////////////

// Convertit un texte comme "Silice:40, kaolin:30" ou lignes séparées
// en un objet { silice: 40, kaolin: 30 } avec noms forcés en minuscules
function parseComposition(text) {
  const obj = {};

  // 🔁 Sépare les lignes ou entrées par : virgule, point-virgule, retour à la ligne
  const lignes = text.split(/[\n\r,;]+/);

  lignes.forEach(entry => {
    // 🔁 Sépare "nom:valeur" et supprime les espaces autour
    const [cle, val] = entry.split(":").map(e => e.trim());

    // ✅ Si la clé existe et que la valeur est un nombre → ajoute à l'objet
    if (cle && !isNaN(parseFloat(val))) {
      obj[cle.toLowerCase()] = parseFloat(val); // nom en minuscule
    }
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

  const nom = document.getElementById("recette-nom").value.trim().toLowerCase();
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
  const nom = document.getElementById("nom").value.trim().toLowerCase();
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
    nom: document.getElementById("achat-nom").value.trim().toLowerCase(),
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

  const couleurMap = {
  "vert": "green",
  "orange": "orange",
  "rouge": "red",
  "noir": "black"
};

  data.details.forEach(item => {
  const statutHTML = `<strong style="color:${couleurMap[item.couleur]}">${item.statut}</strong>`;

  sortie += `${item.matiere} — ${item.quantite_necessaire} g requis\n`;
  sortie += `Disponible : ${item.disponible} g\n`;
  sortie += `Statut : ${statutHTML}\n\n`;
});


    sortie += `Production possible : ${data.production_possible ? "✅ OUI" : "❌ NON"}\n`;
    sortie += `Quantité max possible : ${data.production_maximale_possible} g`;

    document.getElementById("resultat-simulation").innerHTML = sortie;

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
// lance une production réelle (avec confirmation)
//////////////////////////////////////////////
//
//async function lancerProduction(recette, masse, confirmer = false) {
//  try {
//    const res = await fetch(`${API_URL}/produire`, {
//      method: "POST",
//      headers: { "Content-Type": "application/json" },
//      body: JSON.stringify({ recette, masse, confirmer })
//    });
//console.log("Tentative de production", recette, masse, confirmer);
//    const data = await res.json();
//    console.log("Réponse production :", data); // 🔍 debug
//
//    // Cas : stock trop bas → proposer de confirmer
//    if (data.alerte && !confirmer) {
//      const ok = confirm(`${data.message}\n\nSouhaitez-vous produire quand même ?`);
//      if (ok) {
//        // Relance la production avec confirmation
//        return lancerProduction(recette, masse, true);
//      } else {
//        document.getElementById("resultat-production").textContent = "Production annulée par l'utilisateur.";
//        return;
//      }
//    }
//
//    // Message final (OK ou erreur)
//    document.getElementById("resultat-production").textContent = data.message || "Production effectuée.";
//
//  } catch (err) {
//    console.error("Erreur production :", err);
//    alert("Erreur lors de la production.");
//  }
//}
//////////////////////////////////////////////
// lance une production réelle (sans confirmation)
//////////////////////////////////////////////

async function lancerProduction(recette, masse) {
  try {
    const res = await fetch(`${API_URL}/produire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recette, masse, confirmer: true }) // ⬅️ forçage direct
    });

    const data = await res.json();
    console.log("🧪 Réponse production :", data);

    document.getElementById("resultat-production").textContent = data.message || "Production effectuée.";

  } catch (err) {
    console.error("Erreur production :", err);
    alert("Erreur lors de la production.");
  }
}
