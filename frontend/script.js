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
        opt.value       = r.nom;
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
    // Style du tableau pour plus d'aération
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.margin = '1rem 0';

    // Entêtes
    const hdr = table.insertRow();
    ['Matière','Nécessaire','Dispo','Reste','Statut'].forEach(txt => {
      const th = document.createElement('th');
      th.textContent = txt;
      th.style.padding = '8px';
      th.style.textAlign = 'left';
      th.style.borderBottom = '2px solid #ccc';
      hdr.append(th);
    });

    let canProduce = true;
    data.details.forEach(d => {
      const row = table.insertRow();
      [d.matiere, d.quantite_necessaire, d.disponible, d.reste_apres_production].forEach(text => {
        const cell = row.insertCell();
        cell.textContent = text;
        cell.style.padding = '8px';
        cell.style.borderBottom = '1px solid #eee';
      });
      const statusCell = row.insertCell();
      statusCell.textContent = d.statut.replace(/\*\*/g, '');
      statusCell.style.fontWeight = 'bold';
      statusCell.style.padding = '8px';
      statusCell.style.borderBottom = '1px solid #eee';
      // Couleurs selon alerte
      if (d.couleur === 'vert') {
        statusCell.style.color = 'green';
      } else if (d.couleur === 'orange') {
        statusCell.style.color = 'orange';
      } else if (d.couleur === 'rouge') {
        statusCell.style.color = 'red';
      } else {
        statusCell.style.color = 'black';
      }
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
      // Si alerte stock bas
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
