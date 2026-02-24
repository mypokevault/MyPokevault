let collection = JSON.parse(localStorage.getItem("collection")) || [];

function saveCollection() {
    localStorage.setItem("collection", JSON.stringify(collection));
}

function showPage(page) {
    const content = document.getElementById("content");

    if (page === "dashboard") {
        content.innerHTML = `
            <h2>Dashboard</h2>
            <p>Total cartes : ${collection.length}</p>
        `;
    }

    if (page === "collection") {
        let html = "<h2>Ma collection</h2>";

        if (collection.length === 0) {
            html += "<p>Aucune carte ajoutée.</p>";
        } else {
            collection.forEach((card, index) => {
                html += `
                    <div class="card">
                        ${card.name} x${card.quantity}
                        <button onclick="deleteCard(${index})">❌</button>
                    </div>
                `;
            });
        }

        content.innerHTML = html;
    }

    if (page === "add") {
        content.innerHTML = `
            <h2>Ajouter une carte</h2>
            <input type="text" id="name" placeholder="Nom">
            <input type="number" id="quantity" placeholder="Quantité">
            <button onclick="addCard()">Ajouter</button>
        `;
    }

    if (page === "search") {
        content.innerHTML = `
            <h2>Recherche</h2>
            <p>Fonction recherche à venir...</p>
        `;
    }
}

function addCard() {
    const name = document.getElementById("name").value;
    const quantity = document.getElementById("quantity").value;

    if (!name || !quantity) return;

    collection.push({ name, quantity });
    saveCollection();
    showPage("collection");
}

function deleteCard(index) {
    collection.splice(index, 1);
    saveCollection();
    showPage("collection");
}

// Page par défaut
showPage("dashboard");
