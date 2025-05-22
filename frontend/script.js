// script.js
// Front-end principal pour la production, la gestion du stock et des achats

// URL de l'API (Railway)
const apiBase = 'https://glazeapi-production.up.railway.app';

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISATION ET GESTION DE LA PRODUCTION
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // 1. Cache des éléments du DOM pour la production
  const recetteSelect    = document.getElementById('recette-select');
  const masseInput       = document.getElementById('masse-input');
  const simulateBtn      = document.getElementById('simulate-btn');
  const simulationResult = document.getElementById('simulation-result');
  const produceBtn       = document.getElementById('produce-btn');
  const productionResult = document.getElementById('production-result');

  // 2. Chargement des recettes pour la liste déroulante
  fetch(`${apiBase}/recettes`)
    .then(r => r.json())
    .then(data => {
      recetteSelect.innerHTML = '<option value="">-- Choisir --</option>';
      data.forEach(r => {
        const opt = document.createElement('option');
        opt.value       = r.nom;
        opt.textContent = r.nom;
        recetteSelect.append(opt);
      });
    })
    .catch(err => {
      console.error('Erreur chargement recettes :', err);
      recetteSelect.innerHTML = '<option>Erreur de chargement</option>';
    });

  // 3. Gestion du bouton “Simuler”
  simulateBtn.addEventListener('click', () => {
    simulationResult.innerHTML = 'Chargement…';
    productionResult.innerHTML = '';
    produceBtn.style.display   = 'none';

    const payload = {
      recette: recetteSelect.value,
      masse: parseFloat(masseInput.value)
    };

    fetch(`${apiBase}/simuler_production`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(displaySimulation)
    .catch(err => {
      console.error('Erreur simulation :', err);
      simulationResult.textContent = 'Erreur lors de la simulation.';
    });
  });

  // 4. Gestion du bouton “Produire”
  produceBtn.addEventListener('click', () => {
    productionResult.innerHTML = '';
    const payload = {
      recette: recetteSelect.value,
      masse: parseFloat(masseInput.value)
    };

    // Premier appel à l’endpoint “produire”
    fetch(`${apiBase}/produire`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      // En cas d’alerte stock bas (orange/rouge)
      if (data.message && data.message.startsWith('Attention')) {
        if (confirm(data.message)) {
          payload.override = true;
          return fetch(`${apiBase}/produire`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
          })
          .then(r => r.json());
        }
      }
      return data;
    })
    .then(showProduction)
    .catch(err => {
      console.error('Erreur production :', err);
      productionResult.textContent = 'Erreur lors de la production.';
    });
  });

  // 5. Fonction d’affichage des résultats de simulation
  function displaySimulation(data) {
    // Efface l’ancien résultat
    simulationResult.innerHTML = '';

    // 5.1 Affiche la production maximale possible
    const maxPara = document.createElement('p');
    maxPara.textContent      = `Production maximale possible : ${data.production_maximale_possible} g`;
    maxPara.style.fontWeight = 'bold';
    maxPara.style.marginBottom = '0.5em';
    simulationResult.append(maxPara);

    // 5.2 Tableau des détails par matière
    const table = document.createElement('table');
    table.style.width          = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginBottom   = '1em';

    // En-têtes
    const hdr = table.insertRow();
    ['Matière','Nécessaire','Dispo','Reste','Statut'].forEach(txt => {
      const th = document.createElement('th');
      th.textContent        = txt;
      th.style.padding      = '0.5em';
      th.style.borderBottom = '2px solid #333';
      th.style.textAlign    = 'left';
      hdr.append(th);
    });

    // Remplissage des lignes
    let canProduce = true;
    data.details.forEach(d => {
      const row = table.insertRow();
      Object.values({matiere:d.matiere, necessaire:d.necessaire, dispo:d.disponible, reste:d.reste}).forEach(val => {
        const cell = row.insertCell();
        cell.textContent = val;
        cell.style.padding = '0.5em';
      });
      const statusCell = row.insertCell();
      statusCell.textContent = d.status;
      statusCell.style.padding = '0.5em';
      // Couleurs selon statut
      switch(d.status) {
        case 'vert':   statusCell.style.color = '#2a9d8f'; break;
        case 'orange': statusCell.style.color = '#e9c46a'; break;
        case 'rouge':  statusCell.style.color = '#e76f51'; break;
        case 'noir':   statusCell.style.color = '#264653'; canProduce = false; break;
      }
    });
    simulationResult.append(table);

    // 5.3 Affiche le bouton “Produire” si autorisé
    if (canProduce) {
      produceBtn.style.display = 'inline-block';
    }
  }

  // 6. Fonction d’affichage du résultat de production
  function showProduction(data) {
    productionResult.textContent = data.message || 'Production terminée.';
    produceBtn.style.display     = 'none';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GESTION DU STOCK & DES ACHATS
  // ───────────────────────────────────────────────────────────────────────────

  // 7. Initialisation Stock & Achats
  loadStock();
  loadHistorique();
  const formMatiere = document.getElementById('form-add-matiere');
  const formAchat   = document.getElementById('form-add-achat');
  if (formMatiere) formMatiere.addEventListener('submit', handleAddMatiere);
  if (formAchat)   formAchat.addEventListener('submit', handleAddAchat);
});

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions pour Stock & Achats (hors DOMContentLoaded)
// ─────────────────────────────────────────────────────────────────────────────

/** Affiche un message de notification */
function showMessage(selector, text, isError = false) {
  const el = document.querySelector(selector);
  el.textContent = text;
  el.classList.toggle('error', isError);
  setTimeout(() => { el.textContent = ''; }, 5000);
}

/** Charge et affiche le stock (bases & oxydes) */
async function loadStock() {
  try {
    const res  = await fetch('/stock');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const fill = (items, selector) => {
      const tbody = document.querySelector(selector + ' tbody');
      tbody.innerHTML = '';
      items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.nom}</td><td>${Number(item.quantite).toFixed(2)}</td>`;
        tbody.appendChild(tr);
      });
    };
    fill(data.bases, '#table-stock-bases');
    fill(data.oxydes, '#table-stock-oxydes');
  } catch (err) {
    console.error('Erreur loadStock:', err);
  }
}

/** Charge et affiche l’historique des achats */
async function loadHistorique() {
  try {
    const res  = await fetch('/historique_achats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const fill = (entries, selector) => {
      const tbody = document.querySelector(selector + ' tbody');
      tbody.innerHTML = '';
      entries.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.date}</td><td>${item.nom}</td><td>${item.quantite}</td><td>${Number(item.prix).toFixed(2)}</td><td>${item.fournisseur||''}</td>`;
        tbody.appendChild(tr);
      });
    };
    fill(data.bases.achats, '#table-histo-bases');
    fill(data.oxydes.achats, '#table-histo-oxydes');
  } catch (err) {
    console.error('Erreur loadHistorique:', err);
  }
}

/** Gestion du formulaire d’ajout de matière */
async function handleAddMatiere(event) {
  event.preventDefault();
  const payload = {
    nom:   document.getElementById('matiere-nom').value.trim(),
    type:  document.getElementById('matiere-type').value,
    unite: document.getElementById('matiere-unite').value.trim()
  };
  try {
    const res    = await fetch('/ajouter_matiere', {
      method:  'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      showMessage('#msg-matiere', result.message);
      loadStock();
    } else {
      showMessage('#msg-matiere', result.message||result.error, true);
    }
  } catch (err) {
    console.error('Erreur addMatiere:', err);
  }
}

/** Gestion du formulaire d’enregistrement d’achat */
async function handleAddAchat(event) {
  event.preventDefault();
  const payload = {
    nom:        document.getElementById('achat-nom').value.trim(),
    type:       document.getElementById('achat-type').value || undefined,
    quantite:   parseFloat(document.getElementById('achat-quantite').value),
    prix:       parseFloat(document.getElementById('achat-prix').value),
    fournisseur:document.getElementById('achat-fournisseur').value.trim() || undefined,
    date:       document.getElementById('achat-date').value || undefined
  };
  try {
    const res    = await fetch('/achat', {
      method:  'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      showMessage('#msg-achat', result.message);
      loadStock(); loadHistorique();
    } else {
      showMessage('#msg-achat', result.message||result.error, true);
    }
  } catch (err) {
    console.error('Erreur addAchat:', err);
  }
}
