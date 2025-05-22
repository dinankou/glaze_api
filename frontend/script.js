// script.js

// URL du projet Railway
const apiBase = 'https://glazeapi-production.up.railway.app';

document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. Cache des éléments du DOM ─────────────────────────────────────────
  const recetteSelect    = document.getElementById('recette-select');
  const masseInput       = document.getElementById('masse-input');
  const simulateBtn      = document.getElementById('simulate-btn');
  const simulationResult = document.getElementById('simulation-result');
  const produceBtn       = document.getElementById('produce-btn');
  const productionResult = document.getElementById('production-result');

  // ─── 2. Chargement des recettes pour la liste déroulante ───────────────────
  fetch(`${apiBase}/recettes`)
    .then(r => r.json())
    .then(data => {
      recetteSelect.innerHTML = '';
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

  // ─── 3. Gestion du bouton “Simuler” ────────────────────────────────────────
  simulateBtn.addEventListener('click', () => {
    // Réinitialiser l’affichage et masquer Produire
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

  // ─── 4. Fonction d’affichage des résultats de simulation ───────────────────
  function displaySimulation(data) {
    simulationResult.innerHTML = '';

    // 4.1 Afficher la production maximale possible
    const maxPara = document.createElement('p');
    maxPara.textContent    = `Production maximale possible : ${data.production_maximale_possible} g`;
    maxPara.style.fontWeight    = 'bold';
    maxPara.style.marginBottom  = '0.5em';
    simulationResult.append(maxPara);

    // 4.2 Création et style du tableau
    const table = document.createElement('table');
    table.style.width           = '100%';
    table.style.borderCollapse  = 'collapse';
    table.style.marginBottom    = '1em';

    // En-tête
    const hdr = table.insertRow();
    ['Matière', 'Nécessaire', 'Dispo', 'Reste', 'Statut'].forEach(txt => {
      const th = document.createElement('th');
      th.textContent               = txt;
      th.style.padding             = '0.5em';
      th.style.borderBottom        = '2px solid #333';
      th.style.textAlign           = 'left';
      hdr.append(th);
    });

    let canProduce = true;

    // Lignes
    data.details.forEach(d => {
      const row = table.insertRow();
      [ d.matiere,
        d.quantite_necessaire,
        d.disponible,
        d.reste_apres_production
      ].forEach(val => {
        const cell = row.insertCell();
        cell.textContent         = val;
        cell.style.padding       = '0.5em';
        cell.style.borderBottom  = '1px solid #ddd';
      });

      // Cellule statut en gras + couleur selon l’état
      const statusCell = row.insertCell();
      statusCell.textContent       = d.statut.replace(/\*\*/g, '');
      statusCell.style.fontWeight  = 'bold';
      statusCell.style.padding     = '0.5em';
      statusCell.style.borderBottom= '1px solid #ddd';

      switch (d.couleur) {
        case 'vert':
          statusCell.style.color = '#2a9d8f'; break;
        case 'orange':
          statusCell.style.color = '#e9c46a'; break;
        case 'rouge':
          statusCell.style.color = '#f4a261'; break;
        case 'noir':
          statusCell.style.color = '#264653';
          canProduce = false;
          break;
      }
    });

    simulationResult.append(table);

    // 4.3 Afficher le bouton “Produire” si tout est vert/ouvert
    if (canProduce) {
      produceBtn.style.display = 'inline-block';
    }
  }

  // ─── 5. Gestion du bouton “Produire” ───────────────────────────────────────
  produceBtn.addEventListener('click', () => {
    productionResult.innerHTML = '';

    const payload = {
      recette: recetteSelect.value,
      masse: parseFloat(masseInput.value)
    };

    // 5.1 Premier appel production
    fetch(`${apiBase}/produire`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      // Alerte stock bas (orange/rouge)
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

  // ─── 6. Fonction d’affichage du résultat de production ────────────────────
  function showProduction(data) {
    productionResult.textContent = data.message || 'Production terminée.';
    produceBtn.style.display     = 'none';
  }
});
