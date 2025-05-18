// URL de base de l'API (hébergée sur Railway)
const API_URL = "https://glazeapi-production.up.railway.app";

// Fonction pour charger et afficher le stock
async function chargerStock() {
  try {
    // Appel GET à l'API /stock
    const res = await fetch(`${API_URL}/stock`);
    const data = await res.json();

    // Affiche les données formatées dans la balise <pre>
    document.getElementById("affichage-stock").textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    // En cas d'erreur : log + message d'alerte
    console.error("Erreur :", err);
    alert("Erreur lors du chargement du stock.");
  }
}

// Attache l'événement "click" au bouton une fois la page chargée
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-stock").addEventListener("click", chargerStock);
});
