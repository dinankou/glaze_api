// Front-end principal pour la production, la gestion du stock et des achats

// ─── 0. URL de l'API ───────────────────────────────────────────────────────────
const apiBase = 'https://glazeapi-production.up.railway.app';

// ─── 1. Helpers ────────────────────────────────────────────────────────────────
function showMessage(el, msg, isError = false) {
  el.textContent = msg;
  el.classList.toggle('error', isError);
  setTimeout(() => el.textContent = '', 3000);
}

// ─── 2. Fonctions Production ───────────────────────────────────────────────────
async function loadRecettes() {
  try {
    const res = await fetch(`${apiBase}/recettes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Erreur chargement recettes :', err);
    throw err;
  }
}

async function handleSimulate() {
const recetteSelect = document.getElementById('recette-select');
const masseInput    = document.getElementById('masse-input');
const msgEl         = document.getElementById('simulation-result');
try {
  const recette = recetteSelect.value;
  const masse   = parseFloat(masseInput.value);
  const res     = await fetch(`${apiBase}/simuler_production`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ recette, masse })
    });
    const data    = await res.json();
    // affichage simplifié : qualité + lignes
    msgEl.innerHTML = data.map(m =>
      `<div>${m.nom}: <strong>${m.quantite.toFixed(2)}</strong> (${m.statut})</div>`
    ).join('');
  } catch (err) {
    showMessage(msgEl, 'Échec simulation', true);
    console.error(err);
  }
}

async function handleProduce() {
  const recetteSelect = document.getElementById('recette-select');
  const masseInput    = document.getElementById('masse-input');
  const msgEl         = document.getElementById('production-result');
  try {
    const recette = recetteSelect.value;
    const masse   = parseFloat(masseInput.value);
    const res     = await fetch(`${apiBase}/produire`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ recette, masse })
    });
    const json    = await res.json();
    showMessage(msgEl, json.message, !res.ok);
  } catch (err) {
    showMessage(msgEl, 'Échec production', true);
    console.error(err);
  }
}

// ─── 3. Fonctions Stock & Achats ───────────────────────────────────────────────
async function loadStock() {
  try {
    const res = await fetch(`${apiBase}/stock`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { bases, oxydes } = await res.json();
    // Vider
    document.querySelector('#table-stock-bases tbody').innerHTML = '';
    document.querySelector('#table-stock-oxydes tbody').innerHTML = '';
    // Remplir
    bases.forEach(item => {
      document.querySelector('#table-stock-bases tbody')
        .insertAdjacentHTML('beforeend', `
          <tr><td>${item.nom}</td>
              <td>${item.quantite} ${item.unite}</td>
          </tr>`);
    });
    oxydes.forEach(item => {
      document.querySelector('#table-stock-oxydes tbody')
        .insertAdjacentHTML('beforeend', `
          <tr><td>${item.nom}</td>
              <td>${item.quantite} ${item.unite}</td>
          </tr>`);
    });
  } catch (err) {
    console.error('Erreur loadStock:', err);
  }
}

async function loadHistorique() {
  try {
    const res = await fetch(`${apiBase}/historique_achats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    ['bases','oxydes'].forEach(cat => {
  // On récupère une seule fois le <tbody>
  const tbody = document.querySelector(`#table-histo-${cat} tbody`);
  tbody.innerHTML = '';

  // Le JSON renvoie bien data[cat].achats, un tableau d’achats :contentReference[oaicite:0]{index=0}
  data[cat].achats.forEach(achat => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${achat.date}</td>
        <td>${achat.nom}</td>
        <td>${achat.quantite}</td>
        <td>${achat.prix}</td>
        <td>${achat.fournisseur}</td>
      </tr>
    `);
  });
});
  } catch (err) {
    console.error('Erreur loadHistorique:', err);
  }
}

async function handleAddMatiere(e) {
  e.preventDefault();
  const nom   = document.getElementById('matiere-nom').value.trim().toLowerCase();
  const type  = document.getElementById('matiere-type').value;
  const unite = document.getElementById('matiere-unite').value.trim();
  const msgEl = document.getElementById('msg-matiere');
  try {
    const res = await fetch(`${apiBase}/ajouter_matiere`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({nom, type, unite})
    });
    const json = await res.json();
    showMessage(msgEl, json.message, !res.ok);
    if (res.ok) loadStock();
  } catch (err) {
    showMessage(msgEl, 'Erreur réseau', true);
    console.error(err);
  }
}

async function handleAddAchat(e) {
  e.preventDefault();
  const nom         = document.getElementById('achat-nom').value.trim().toLowerCase();
  const typeInput   = document.getElementById('achat-type').value;
  const quantite    = parseFloat(document.getElementById('achat-quantite').value);
  const prix        = parseFloat(document.getElementById('achat-prix').value);
  const fournisseur = document.getElementById('achat-fournisseur').value.trim();
  const date        = document.getElementById('achat-date').value;
  const msgEl       = document.getElementById('msg-achat');
  try {
    const payload = {nom, quantite, prix, fournisseur, date};
    if (typeInput) payload.type = typeInput;
    const res = await fetch(`${apiBase}/achat`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    showMessage(msgEl, json.message, !res.ok);
    if (res.ok) {
      loadStock();
      loadHistorique();
    }
  } catch (err) {
    showMessage(msgEl, 'Erreur réseau', true);
    console.error(err);
  }
}

// ─── 4. DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // ==== Bloc PRODUCTION ====
  const recetteSelect = document.getElementById('recette-select');
  const masseInput    = document.getElementById('masse-input');
  const simulateBtn   = document.getElementById('simulate-btn');
  const productionBtn = document.getElementById('produce-btn');

  // On n'initialise la partie production QUE si on est sur la page production
  if (recetteSelect && masseInput && simulateBtn && productionBtn) {
    // Charger les recettes pour le select
    loadRecettes()
      .then(recettes => {
        recettes.forEach(r => {
          recetteSelect.insertAdjacentHTML('beforeend',
            `<option value="${r.nom}">${r.nom}</option>`);
        });
      })
      .catch(() => {/* erreur déjà loggée */});

    simulateBtn.addEventListener('click', handleSimulate);
    productionBtn.addEventListener('click', handleProduce);
  }

  // ==== Bloc STOCK & ACHATS ====
  // On n'initialise cette partie QUE si on est sur la page stock.html
  const formMatiere = document.getElementById('form-add-matiere');
  const formAchat   = document.getElementById('form-add-achat');
  const stockTable  = document.getElementById('table-stock-bases');

  if (formMatiere && formAchat && stockTable) {
    loadStock();
    loadHistorique();
    formMatiere.addEventListener('submit', handleAddMatiere);
    formAchat.addEventListener('submit', handleAddAchat);
  }
});
