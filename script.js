function renderCollection() {
  const grid = document.getElementById('coll-grid');
  grid.innerHTML = '';
  let total = 0;

  if (!collection.length) {
    grid.innerHTML = '<p>Aucune carte</p>';
    return;
  }

  collection.forEach(c => {
    total += c.value * c.qty;

    const div = document.createElement('div');
    div.className = 'card-item';

    div.innerHTML = `
      <div class="card-info">
        <div class="card-name">${c.name}</div>
        <div class="card-meta">${c.set} | x${c.qty}</div>
      </div>

      <div>
        <div class="card-value">${c.value} €</div>
        <button class="btn-del" onclick="removeCard(${c.id})">✕</button>
      </div>
    `;

    grid.appendChild(div);
  });

  document.getElementById('totalValue').textContent =
    total.toFixed(2) + ' €';
}
