let collection = JSON.parse(localStorage.getItem("collection")) || [];

function saveCollection() {
    localStorage.setItem("collection", JSON.stringify(collection));
}

function showPage(page) {
    const content = document.getElementById("content");
    if (!content) return;

    // DASHBOARD
    if (page === "dashboard") {
        content.innerHTML = `
            <h2>Dashboard</h2>
            <p>Total cartes : ${collection.length}</p>
        `;
    }

    // COLLECTION
    if (page === "collection") {
        let html = "<h2>Ma collection</h2>";

        if (collection.length === 0) {
            html += "<p>Aucune carte.</p>";
        } else {
            collection.forEach((card, index) => {
                html += `
                    <div class="card">
                        <img src="${card.image}" width="80">
                        <div>
                            ${card.name}<br>
                            x${card.quantity}
                        </div>
                        <button onclick="deleteCard(${index})">❌</button>
                    </div>
                `;
            });
        }

        content.innerHTML = html;
    }

    // AJOUT MANUEL
    if (page === "add") {
        content.innerHTML = `
            <h2>Ajouter manuellement</h2>
            <input id="name" placeholder="Nom">
            <input id="quantity" type="number" placeholder="Quantité">
            <button onclick="addManual()">Ajouter</button>
        `;
    }

    // RECHERCHE API
    if (page === "search") {
        content.innerHTML = `
            <h2>Recherche carte Pokémon</h2>
            <input id="searchInput" placeholder="Nom de la carte">
            <button onclick="searchCard()">Rechercher</button>
            <div id="results"></div>
        `;
    }
}

// Recherche API Pokémon TCG
function searchCard() {
    const name = document.getElementById("searchInput").value;
    const resultsDiv = document.getElementById("results");

    resultsDiv.innerHTML = "Recherche...";

    fetch(`https://api.pokemontcg.io/v2/cards?q=name:${name}`)
        .then(res => res.json())
        .then(data => {
            if (!data.data || data.data.length === 0) {
                resultsDiv.innerHTML = "Aucun résultat";
                return;
            }

            let html = "";

            data.data.slice(0, 20).forEach(card => {
                html += `
                    <div class="card">
                        <img src="${card.images.small}">
                        <div>${card.name}</div>
                        <button onclick="addFromAPI('${card.name}', '${card.images.small}')">
                            Ajouter
                        </button>
                    </div>
                `;
            });

            resultsDiv.innerHTML = html;
        })
        .catch(() => {
            resultsDiv.innerHTML = "Erreur API";
        });
}

// Ajouter depuis API
function addFromAPI(name, image) {
    collection.push({
        name: name,
        image: image,
        quantity: 1
    });

    saveCollection();
    alert("Carte ajoutée !");
}

// Ajout manuel
function addManual() {
    const name = document.getElementById("name").value;
    const quantity = document.getElementById("quantity").value;

    if (!name || !quantity) return;

    collection.push({
        name: name,
        quantity: quantity,
        image: ""
    });

    saveCollection();
    showPage("collection");
}

// Supprimer
function deleteCard(index) {
    collection.splice(index, 1);
    saveCollection();
    showPage("collection");
}

// Page par défaut
document.addEventListener("DOMContentLoaded", () => {
    showPage("dashboard");
});
