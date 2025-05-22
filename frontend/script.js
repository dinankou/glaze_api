// URL de base de l'API (hébergée sur Railway)
const API_URL = "https://glazeapi-production.up.railway.app";
console.log("✅ script.js chargé");
// script.js

document.addEventListener('DOMContentLoaded', () => {
  const apiBase = '';
  const recetteSelect = document.getElementById('recette-select');
  const masseInput = document.getElementById('masse-input');
  const simulateBtn = document.getElementById('simulate-btn');
  const simulationResult = document.getElementById('simulation-result');
  const produceBtn = document.getElementById('produce-btn');
  const productionResult = document.getElementById('production-result');

  // Charger les recettes
  fetch(apiBase + '/recettes')
    .then(r => r.json())
    .then(data => {
      recetteSelect.innerHTML = '';
      data.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.nom;
        opt.textContent = r.nom;
        recetteSelect.append(opt);
      });
    });

  // Simulation
  simulateBtn.addEventListener('click', () => {
    simulationResult.innerHTML = 'Chargement...';
    productionResult.innerHTML = '';
    produceBtn.style.display = 'none';
    const payload = { recette: recetteSelect.value, masse: parseFloat(masseInput.value) };

    fetch(apiBase + '/simuler_production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => displaySimulation(data));
  });

  function displaySimulation(data) {
    simulationResult.innerHTML = '';
    const table = document.createElement('table');
    const hdr = table.insertRow();
    ['Matière', 'Nécessaire', 'Dispo', 'Reste', 'Statut'].forEach(t => {
      const th = document.createElement('th');
      th.textContent = t;
      hdr.append(th);
    });

    let canProduce = true;
    data.details.forEach(d => {
      const row = table.insertRow();
      row.insertCell().textContent = d.matiere;
      row.insertCell().textContent = d.quantite_necessaire;
      row.insertCell().textContent = d.disponible;
      row.insertCell().textContent = d.reste_apres_production;
      const statusCell = row.insertCell();
      statusCell.textContent = d.statut.replace(/\*\*/g, '');
      statusCell.className =
        d.couleur === 'vert' ? 'ok' :
        d.couleur === 'orange' ? 'warning' :
        d.couleur === 'rouge' ? 'warning' : 'danger';
      if (d.couleur === 'noir') canProduce = false;
    });
    simulationResult.append(table);
    if (canProduce) produceBtn.style.display = 'inline-block';
  }

  // Production
  produceBtn.addEventListener('click', () => {
    productionResult.innerHTML = '';
    const payload = { recette: recetteSelect.value, masse: parseFloat(masseInput.value) };

    fetch(apiBase + '/produire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      if (data.message && data.message.startsWith('Attention')) {
        if (confirm(data.message)) {
          payload.override = true;
          fetch(apiBase + '/produire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          .then(r => r.json())
          .then(showProduction);
        }
      } else showProduction(data);
    });
  });

  function showProduction(data) {
    productionResult.textContent = data.message;
    produceBtn.style.display = 'none';
  }
});

