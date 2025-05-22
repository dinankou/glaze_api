// script.js

// URL du projet Railway
const apiBase = 'https://glazeapi-production.up.railway.app';

document.addEventListener('DOMContentLoaded', () => {
  const recetteSelect    = document.getElementById('recette-select');
  const masseInput       = document.getElementById('masse-input');
  const simulateBtn      = document.getElementById('simulate-btn');
  const simulationResult = document.getElementById('simulation-result');
  const produceBtn       = document.getElementById('produce-btn');
  const productionResult = document.getElementById('production-result');

  // 1. Charger les recettes
  fetch(`${apiBase}/recettes`)
    .then(r => r.json())
    .then(data => {
      recetteSelect.innerHTML = '';
      data.forEach(r => {
        const opt = document.createElement('option');
        opt.value   = r.nom;
        opt.textContent = r.nom;
        recetteSelect.append(opt);
      });
    })
    .catch(err => {
      console.error('Erreur chargement recettes:', err);
      recetteSelect.innerHTML = '<option>Erreur de chargement</option>';
    });

  // 2. Simulation
  simulateBtn.addEventListener('click', () => {
    simulationResult.innerHTML = 'Chargement...';
    productionResult.innerHTML = '';
    produceBtn.style.display   = 'none';

    const payload = {
      recette: recetteSelect.value,
      masse: parseFloat(masseInput.value)
    };

    fetch(`${apiBase}/simuler_production`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(displaySimulation)
    .catch(err => {
      console.error('Erreur simulation:', err);
      simulationResult.textContent = 'Erreur lors de la simulation.';
    });
  });

  function displaySimulation(data) {
    simulationResult.innerHTML = '';
    const table = document.createElement('table');
    const hdr   = table.insertRow();
    ['Matière','Nécessaire','Dispo','Reste','Statut'].forEach(txt => {
      const th = document.createElement('th');
      th.textContent = txt;
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
      statusCell.textContent = d.statut.replace(/\*\*/g,'');
      statusCell.className = 
        d.couleur === 'vert'   ? 'ok' :
        d.couleur === 'orange' ? 'warning' :
        d.couleur === 'rouge'  ? 'warning' : 'danger';
      if (d.couleur === 'noir') canProduce = false;
    });
    simulationResult.append(table);
    if (canProduce) produceBtn.style.display = 'inline-block';
  }

  // 3. Production
  produceBtn.addEventListener('click', () => {
    productionResult.innerHTML = '';

    const payload = {
      recette: recetteSelect.value,
      masse: parseFloat(masseInput.value)
    };

    fetch(`${apiBase}/produire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      // si alerte stock bas
      if (data.message && data.message.startsWith('Attention')) {
        if (confirm(data.message)) {
          payload.override = true;
          return fetch(`${apiBase}/produire`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          .then(r => r.json());
        }
      }
      return data;
    })
    .then(showProduction)
    .catch(err => {
      console.error('Erreur production:', err);
      productionResult.textContent = 'Erreur lors de la production.';
    });
  });

  function showProduction(data) {
    productionResult.textContent = data.message || 'Production terminée.';
    produceBtn.style.display = 'none';
  }
});
