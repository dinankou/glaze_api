// Front-end principal pour la production, la gestion du stock et des achats

// ─── 0. URL de l'API ───────────────────────────────────────────────────────────
const apiBase = 'https://glazeapi-production.up.railway.app';

// ─── 1. Helpers ────────────────────────────────────────────────────────────────
function showMessage(el, msg, isError = false) {
  el.textContent = msg;
  el.classList.toggle('error', isError);
  setTimeout(() => el.textContent = '', 3000);
}

// ─── 2.1 Simulation multi-recettes & compromis (index.html) ────────────────────

/**
 * Charge toutes les recettes dans une liste de cases à cocher.
 * Nécessite dans index.html un <div id="list-recettes-index"></div>.
 */
async function loadRecettesCheckboxList() {
  try {
    const res = await fetch(`${apiBase}/recettes`);
    const data = await res.json();
    const container = document.getElementById('list-recettes-index');
    if (!container) return;
    container.innerHTML = data
      .map(r => `
        <label class="checkbox-inline">
          <input type="checkbox" value="${r.nom}"> ${r.nom}
        </label>
      `).join('');
  } catch (err) {
    console.error('Échec loadRecettesCheckboxList:', err);
  }
}

/**
 * Récupère les recettes cochées dans index.html.
 */
function getSelectedRecettesIndex() {
  return Array.from(
    document.querySelectorAll('#list-recettes-index input[type=checkbox]:checked')
  ).map(cb => cb.value);
}

/**
 * Simule la production groupée (n recettes) et affiche la quantité max commune.
 * Nécessite :
 *  - <button id="btn-simulate-group">…
 *  - <div id="msg-index"></div> pour les messages
 *  - <div id="result-index"></div> pour afficher le résultat
 */
async function handleSimulateGroupIndex() {
  const msg = document.getElementById('msg-index');
  msg.textContent = '';
  const selected = getSelectedRecettesIndex();
  if (!selected.length) {
    return showMessage(msg, 'Cochez au moins une recette.', true);
  }

  try {
    const res = await fetch(`${apiBase}/simuler_production_groupe`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ recettes: selected })
    });
    const data = await res.json();
    if (!res.ok) {
      return showMessage(msg, data.message || 'Erreur de simulation groupée', true);
    }

    // Affichage ultra-simple (à enrichir si tu veux un tableau)
    document.getElementById('result-index').innerHTML = `
      <h3>Quantité max commune</h3>
      <p>${data.quantite_max_commune.toFixed(2)}</p>
    `;
  } catch (err) {
    console.error('Erreur réseau simulate_group index:', err);
    showMessage(msg, 'Erreur réseau', true);
  }
}

/**
 * Simule le graphe de compromis pour exactement deux recettes.
 * Nécessite :
 *  - <button id="btn-compromise">…
 *  - #msg-index, #result-index comme ci-dessus
 */
async function handleCompromiseIndex() {
  const msg    = document.getElementById('msg-index');
  const result = document.getElementById('result-index');
  msg.textContent = '';
  result.innerHTML = ''; // on vide l'ancienne sortie

  const selected = getSelectedRecettesIndex();
  if (selected.length !== 2) {
    return showMessage(msg, 'Sélectionnez exactement deux recettes pour le compromis.', true);
  }
  const [recA, recB] = selected;

  try {
    // 1) Appel à l'API
    const res = await fetch(`${apiBase}/compromis_recettes`, {
      method:  'POST',
      headers: {'Content-Type':'application/json'},
      body:    JSON.stringify({ recetteA: recA, recetteB: recB })
    });

    // 2) Traitement de la réponse
    const data = await res.json();
    if (!res.ok) {
      return showMessage(msg, data.message || 'Erreur de compromis', true);
    }

    // 3) Préparer le canvas
    result.innerHTML = `
      <div class="chart-container">
        <canvas id="compromise-chart"></canvas>
      </div>
    `;
    const ctx = document.getElementById('compromise-chart').getContext('2d');

    // 4) Ne garder que les matières utilisées par au moins une des recettes
    const constraints = data.data.filter(d => d.pctA > 0 || d.pctB > 0);
    if (constraints.length === 0) {
      return showMessage(msg, 'Aucune matière dans ces recettes.', true);
    }

    // 5) Construire les datasets pour Chart.js (toutes les contraintes)
    const datasets = constraints.map(d => {
      const maxA = d.stock * 100 / d.pctA;
      const maxB = d.stock * 100 / d.pctB;
      return {
        label: d.matiere,
        data: [
          { x: 0,   y: maxB },
          { x: maxA, y: 0    }
        ],
        fill: false,
        borderWidth: 2,
        tension: 0
      };
    });

    // 6) Calculer les bornes min/max pour zoom
    const xs   = datasets.map(ds => ds.data[1].x).filter(v => v > 0);
    const ys   = datasets.map(ds => ds.data[0].y).filter(v => v > 0);
    const maxX = xs.length ? Math.min(...xs) : undefined;
    const maxY = ys.length ? Math.min(...ys) : undefined;

    // 7) (Re)créer le graphique
    if (window.compromiseChart) {
      window.compromiseChart.destroy();
    }
    window.compromiseChart = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            min: 0,
            ...(maxX !== undefined ? { max: maxX } : {}),
            title: {
              display: true,
              text: `Quantité de ${data.recetteA}`
            }
          },
          y: {
            min: 0,
            ...(maxY !== undefined ? { max: maxY } : {}),
            title: {
              display: true,
              text: `Quantité de ${data.recetteB}`
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Compromis : ${data.recetteA} vs ${data.recetteB}`
          },
          legend: {
            position: 'right'
          }
        }
      }
    });

  } catch (err) {
    console.error('Erreur réseau ou de tracé dans handleCompromiseIndex :', err);
    showMessage(msg, 'Erreur réseau ou inattendue', true);
  }
}

// ─── 2.2 Fonctions Production ───────────────────────────────────────────────────
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

// ─── 4. Fonctions Recettes ───────────────────────────────────────────────────
// ─── 4.1. Parser libre de composition ────────────────────────────────────────

/**
 * Transforme une chaîne du type
 *   "kaolin:70,feldspath 30\tCuO:5"
 * en objet { kaolin:70, feldspath:30, CuO:5 }
 *
 * Séparateur strict : deux-points (:), virgule (,) ou tabulation (\t)
 */
function parseComposition(input) {
  const obj = {};
  // 1) ([^\t:,]+) : capture le nom de la matière (tout caractère sauf tab, :, ,)
  // 2) \s*[:\,\t]\s* : un séparateur : ou , ou tab entouré d'espaces éventuels
  // 3) ([\d.]+) : la partie numérique (entier ou flottant)
  const regex = /([^\t:,]+)\s*[:\,\t]\s*([\d.]+)/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    const key   = match[1].trim().toLowerCase();
    const value = parseFloat(match[2]);
    obj[key] = value;
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
    tbody.innerHTML = data.map(r => {
      // Transformer { nom: pourcentage } → "nom: pourcentage%"
      const basesText  = Object.entries(r.base  || {})
                             .map(([k,v]) => `${k}: ${v}%`)
                             .join(', ') || '–';
      const oxydesText = Object.entries(r.oxydes || {})
                             .map(([k,v]) => `${k}: ${v}%`)
                             .join(', ') || '–';

      return `
        <tr>
          <td>${r.nom}</td>
          <td>${basesText}</td>        <!-- utilisation de r.base -->
          <td>${oxydesText}</td>
          <td>${r.description_url ? `<a href="${r.description_url}" target="_blank">Voir</a>` : '–'}</td>
          <td>${r.production_doc_url ? `<a href="${r.production_doc_url}" target="_blank">Voir</a>` : '–'}</td>
        </tr>`;
    }).join('');
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

  // ─── 4.2 Parsing des compositions ───────────────────────────────────────────
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

  // ─── 4.3 Envoi au serveur ──────────────────────────────────────────────────
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

// ===== 5. Fonctions Administration =====

/**
 * Charge et affiche toutes les recettes avec un bouton de suppression.
 */
async function loadAdminRecettes() {
  const res = await fetch(`${apiBase}/recettes`);
  const data = await res.json();
  const tbody = document.querySelector('#table-admin-recettes tbody');
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.nom}</td>
      <td><button class="btn-delete-recette" data-nom="${r.nom}">Supprimer</button></td>
    </tr>
  `).join('');
}

/**
 * Charge et affiche toutes les matières avec un bouton de suppression.
 */
async function loadAdminMatieres() {
  const res = await fetch(`${apiBase}/stock`);
  const { bases, oxydes } = await res.json();
  const all = [
    ...bases.map(m => ({...m, type:'base'})),
    ...oxydes.map(m => ({...m, type:'oxyde'}))
  ];
  const tbody = document.querySelector('#table-admin-matieres tbody');
  tbody.innerHTML = all.map(m => `
    <tr>
      <td>${m.nom}</td>
      <td>${m.type}</td>
      <td><button class="btn-delete-matiere" data-nom="${m.nom}">Supprimer</button></td>
    </tr>
  `).join('');
}

/**
 * Supprime une recette et recharge le tableau.
 */
async function handleDeleteRecette(e) {
  if (!e.target.matches('.btn-delete-recette')) return;
  const nom = e.target.dataset.nom;
  const msg = document.getElementById('msg-admin-recette');
  try {
    const res = await fetch(`${apiBase}/recettes/${encodeURIComponent(nom)}`, { method:'DELETE' });
    const data = await res.json();
    showMessage(msg, data.message, !res.ok);
    if (res.ok) loadAdminRecettes();
  } catch (err) {
    showMessage(msg, 'Erreur réseau', true);
  }
}

/**
 * Supprime une matière et recharge le tableau.
 * Attention : l'API doit refuser la suppression si la matière est encore utilisée dans une recette.
 */
async function handleDeleteMatiere(e) {
  if (!e.target.matches('.btn-delete-matiere')) return;
  const nom = e.target.dataset.nom;
  const msg = document.getElementById('msg-admin-matiere');
  try {
    const res = await fetch(`${apiBase}/matieres/${encodeURIComponent(nom)}`, { method:'DELETE' });
    const data = await res.json();
    showMessage(msg, data.message, !res.ok);
    if (res.ok) loadAdminMatieres();
  } catch (err) {
    showMessage(msg, 'Erreur réseau', true);
  }
}

// ─── 6. DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ==== Bloc INDEX (simulation groupée & compromis) ====
  const listIndex   = document.getElementById('list-recettes-index');
  const btnComp     = document.getElementById('btn-compromise');
  const btnGroup    = document.getElementById('btn-simulate-group');
  if (listIndex && btnComp && btnGroup) {
    console.log('▶︎ Init simulation groupée & compromis');
    loadRecettesCheckboxList();
    btnComp.addEventListener('click', handleCompromiseIndex);
    btnGroup.addEventListener('click', handleSimulateGroupIndex);
  }

  // ==== Bloc PRODUCTION (simulation 1 recette) ====
  const recetteSelect = document.getElementById('recette-select');
  const simulateBtn   = document.getElementById('simulate-btn');
  if (recetteSelect && simulateBtn) {
    console.log('▶︎ Init simulation simple');
    recetteSelect.innerHTML = '';
    loadRecettes()
      .then(recettes => {
        recettes.forEach(r => {
          recetteSelect.insertAdjacentHTML('beforeend',
            `<option value="${r.nom}">${r.nom}</option>`);
        });
      })
      .catch(err => console.error('Erreur loadRecettes:', err));
    simulateBtn.addEventListener('click', handleSimulate);
  }

  // ==== Bloc PRODUCE (lancer la production) ====
  const productionBtn = document.getElementById('produce-btn');
  if (productionBtn) {
    console.log('▶︎ Init production');
    productionBtn.addEventListener('click', handleProduce);
  }

  // ==== Bloc STOCK & ACHATS ====
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
  const formRecette   = document.getElementById('form-add-recette');
  const recettesTable = document.getElementById('table-recettes');
  if (formRecette && recettesTable) {
    loadRecettesList();
    formRecette.addEventListener('submit', handleAddRecette);
  }

  // ==== Bloc ADMINISTRATION ====
  if (document.getElementById('section-admin-recettes')) {
    loadAdminRecettes();
    document.querySelector('#table-admin-recettes tbody')
            .addEventListener('click', handleDeleteRecette);
    loadAdminMatieres();
    document.querySelector('#table-admin-matieres tbody')
            .addEventListener('click', handleDeleteMatiere);
  }

});
