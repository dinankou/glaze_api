const API_URL = "https://glazeapi-production.up.railway.app"; // adapte si besoin

async function chargerStock() {
  try {
    const res = await fetch(`${API_URL}/stock`);
    const data = await res.json();
    document.getElementById("affichage-stock").textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error("Erreur :", err);
    alert("Impossible de charger le stock.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-stock").addEventListener("click", chargerStock);
});
