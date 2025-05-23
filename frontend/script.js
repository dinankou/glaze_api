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
  console.log('▶︎ handleSimulate() appelé');
  const recetteSelect = document.getElementById('recette-select');
  const masseInput    = document.getElementById('masse-input');
  const msgEl         = document.getElementById('simulation-result');
  const produceBtn    = document.getElementById('produce-btn');

  // masque d’emblée le bouton
  produceBtn.style.display   = 'none';
  produceBtn.textContent     = 'Produire';

  try {
    // 1) Requête
    const recette = recetteSelect.value;
    const masse   = parseFloat(masseInput.value);
    const res     = await fetch(`${apiBase}/simuler_production`, {
      method:  'POST',
      headers: {'Content-Type':'application/json'},
      body:    JSON.stringify({ recette, masse })
    });
    const data = await res.json();

    if (!res.ok) {
      // en cas d’erreur serveur, on vide la table et on cache le bouton
      document.querySelector('#simulation-result tbody').innerHTML = '';
      produceBtn.style.display = 'none';
      showMessage(msgEl, data.message || 'Erreur de simulation', true);
      return;
    }

    // 2) Injection des résultats dans le <tbody>
    const tbodySim = document.querySelector('#simulation-result tbody');
    tbodySim.innerHTML = (data.details || []).map(d => {
      const cleanStatut = d.statut.replace(/\*/g, '');
      const cssClass    = `status-${d.couleur.toLowerCase()}`;
      return `
        <tr>
          <td>${d.matiere}</td>
          <td>${d.quantite_necessaire.toFixed(2)}</td>
          <td class="${cssClass}"><strong>${cleanStatut}</strong></td>
        </tr>
      `;
    }).join('');

    // 3) Détection unique des cas “noir” / “rouge‐orange” / “vert”
    const couleurs = (data.details || []).map(d => d.couleur.toLowerCase());
    const hasBlack = couleurs.includes('noir');
    const hasLow   = couleurs.some(c => c === 'rouge' || c === 'orange');

    if (hasBlack) {
      // cas critique “noir”
      const simMsg = document.getElementById('simulation-message');
      showMessage(
        simMsg,
        'Stock trop bas. Vérifiez et ajustez le stock avant de continuer.',
        true
      );
      produceBtn.style.display = 'none';
    } else {
      // on affiche le bouton
      produceBtn.style.display = 'block';

      if (hasLow) {
        // ** Nouveau message d’alerte avant override **
        const simMsg = document.getElementById('simulation-message');
        showMessage(
          simMsg,
          'Stock faible pour certains composants. Voulez-vous forcer la production ?',
          false    // false = message de type info/plutôt qu’erreur
        );
        // override requis
        produceBtn.textContent      = 'Forcer la production';
        produceBtn.dataset.override = 'true';
      } else {
        // tout vert
        produceBtn.textContent      = 'Produire';
        produceBtn.dataset.override = 'false';
      }
    }

  } catch (err) {
    console.error('Échec simulation :', err);
    showMessage(msgEl, 'Échec simulation', true);
  }
}
async function handleProduce() {
  const recetteSelect = document.getElementById('recette-select');
  const masseInput    = document.getElementById('masse-input');
  const msgEl         = document.getElementById('production-result');
  const produceBtn    = document.getElementById('produce-btn');
  try {
    const recette = recetteSelect.value;
    const masse   = parseFloat(masseInput.value);
    const override = produceBtn.dataset.override === 'true';
    console.log('Override envoyé ?', override);
    const res     = await fetch(`${apiBase}/produire`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ recette, masse, override })
    });
    const json    = await res.json();
    showMessage(msgEl, json.message, !res.ok);
    if (res.ok && json.stock_apres) {
  const tbodyProd = document.querySelector('#production-result tbody');
  tbodyProd.innerHTML = json.stock_apres.map(s => `
    <tr>
      <td>${s.matiere}</td>
      <td>${s.nouveau_stock.toFixed(2)}</td>
    </tr>
  `).join('');
}
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

// ─── 3. Fonctions Recettes ───────────────────────────────────────────────────
// ─── 3.1. Parser libre de composition ────────────────────────────────────────

/**
 * Transforme une chaîne du type "clé:valeur clé, valeur2 clé valeur3"
 * en objet { clé: valeur, ... }
 */
function parseComposition(input) {
  const obj = {};
  const regex = /([^\s,:]+)\s*[:\s,]\s*([\d.]+)/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    obj[match[1]] = parseFloat(match[2]);
  }
  return obj;
}

/**
 * Récupère la liste des recettes et l'affiche dans recettes.html
 */
async function loadRecettesList() {
  try {
    const res  = await fetch(`${apiBase}/recettes`);
    const data = await res.json();
    if (!res.ok) {
      console.error('Erreur chargement recettes :', data.message);
      return;
    }
    const tbody = document.querySelector('#table-recettes tbody');
    // On stringify pour afficher facilement l’objet JSON
    tbody.innerHTML = data
      .map(r => `
        <tr>
          <td>${r.nom}</td>
          <td><code>${JSON.stringify(r.bases)}</code></td>
          <td><code>${JSON.stringify(r.oxydes || {})}</code></td>
          <td>${r.description_url ? `<a href="${r.description_url}" target="_blank">Voir</a>` : ''}</td>
          <td>${r.production_doc_url ? `<a href="${r.production_doc_url}" target="_blank">Voir</a>` : ''}</td>
        </tr>`)
      .join('');
  } catch (err) {
    console.error('Échec loadRecettesList :', err);
  }
}

/**
 * Traite l'envoi du formulaire de création de recette
 */
async function handleAddRecette(e) {
  e.preventDefault();
  const nomInput     = document.getElementById('recette-nom');
  const basesInput   = document.getElementById('recette-base');
  const oxydesInput  = document.getElementById('recette-oxydes');
  const descInput    = document.getElementById('recette-description-url');
  const prodDocInput = document.getElementById('recette-production-doc-url');
  const msgEl        = document.getElementById('msg-recette');

  // ─── Parsing des compositions ───────────────────────────────────────────
  let bases, oxydes;
  try {
    const rawBases = basesInput.value.trim();
    if (rawBases.startsWith('{')) {
      bases = JSON.parse(rawBases);
    } else {
      bases = parseComposition(rawBases);
    }
    if (Object.keys(bases).length === 0) {
      throw new Error("Aucune base détectée");
    }

    const rawOx = oxydesInput.value.trim();
    if (!rawOx) {
      oxydes = {};
    } else if (rawOx.startsWith('{')) {
      oxydes = JSON.parse(rawOx);
    } else {
      oxydes = parseComposition(rawOx);
    }
  } catch (err) {
    // Affiche l’erreur selon l’étape
    const msg = err.message.includes('base') 
      ? "Format de bases invalide : JSON ou 'composant:xx'" 
      : "Format d’oxydes invalide : JSON ou 'composant xx'";
    return showMessage(msgEl, msg, true);
  }

  // ─── Envoi au serveur ──────────────────────────────────────────────────
  try {
    const payload = {
      nom: nomInput.value.trim(),
      base: bases,
      oxydes,
      description_url: descInput.value.trim(),
      production_doc_url: prodDocInput.value.trim()
    };

    const res  = await fetch(`${apiBase}/ajouter_recette`, {
      method:  'POST',
      headers: {'Content-Type':'application/json'},
      body:    JSON.stringify(payload)
    });
    const data = await res.json();
    showMessage(msgEl, data.message, !res.ok);

    if (res.ok) {
      e.target.reset();
      loadRecettesList();
    }
  } catch (err) {
    console.error('Erreur réseau handleAddRecette :', err);
    showMessage(msgEl, 'Erreur réseau', true);
  }
}

// ─── 4. DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const recetteSelect = document.getElementById('recette-select');
  const simulateBtn   = document.getElementById('simulate-btn');
  const productionBtn = document.getElementById('produce-btn');

  // 1) Si on est bien sur la page de production (on a le select + le bouton Simuler)
  if (recetteSelect && simulateBtn) {
    console.log('▶︎ Init partie production');

    // On vide l'option de chargement (optionnel)
    recetteSelect.innerHTML = '';

    // Charge la liste des recettes
    loadRecettes()
      .then(recettes => {
        recettes.forEach(r => {
          recetteSelect.insertAdjacentHTML('beforeend',
            `<option value="${r.nom}">${r.nom}</option>`);
        });
      })
      .catch(err => console.error('Erreur loadRecettes:', err));

    // Attache le simulateur
    simulateBtn.addEventListener('click', handleSimulate);
  }

  // 2) Si le bouton Produire existe, on lui attache son listener
  if (productionBtn) {
    console.log('▶︎ J’attache handleProduce au bouton Produire');
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
  // ==== Bloc RECETTES ====
  // Ne s'exécute que sur recettes.html
  const formRecette     = document.getElementById('form-add-recette');
  const recettesTable   = document.getElementById('table-recettes');

  if (formRecette && recettesTable) {
    loadRecettesList();                     // charger la liste au chargement
    formRecette.addEventListener('submit', handleAddRecette);
  }
});
