/**
 * DASHBOARD.JS
 * Farmer dashboard supports product upload (image + name + price)
 * and buyer dashboard shows recommendations.
 */

document.addEventListener('DOMContentLoaded', () => {
    const session = Utils.getStorage('fc_session');
    if (!session || !session.isLoggedIn) {
        window.location.href = 'login.html';
        return;
    }

    const { user } = session;
    const isFarmer = user.role === 'farmer';

    populateSidebar(user);

    const allOrders = Utils.getStorage('fc_orders', []);
    let products = Utils.getStorage('fc_products', []);

    const relevantOrders = getRelevantOrders(allOrders, user, isFarmer);
    const myProducts = isFarmer ? getFarmerProducts(products, user) : [];

    renderStats(isFarmer, relevantOrders, myProducts.length);
    renderRecentOrders(relevantOrders);

    if (isFarmer) {
        const pSection = document.getElementById('farmerProductsSection');
        if (pSection) pSection.style.display = 'block';

        renderFarmerProducts(myProducts);
        bindFarmerProductForm(user, () => {
            products = Utils.getStorage('fc_products', []);
            const refreshedProducts = getFarmerProducts(products, user);
            renderFarmerProducts(refreshedProducts);
            updateActiveProductsStat(refreshedProducts.length);
        });
    } else {
        const rSection = document.getElementById('buyerRecommendationsSection');
        if (rSection) rSection.style.display = 'block';
        renderBuyerRecommendations(products);
    }
});

function populateSidebar(user) {
    const sImg = document.getElementById('dashSidebarImg');
    const sName = document.getElementById('dashSidebarName');
    const sRole = document.getElementById('dashSidebarRole');

    if (sImg) {
        sImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=2D6A4F&color=fff`;
    }
    if (sName) sName.textContent = user.name;
    if (sRole) sRole.textContent = user.role;
}

function getRelevantOrders(allOrders, user, isFarmer) {
    if (!Array.isArray(allOrders)) return [];

    if (!isFarmer) {
        return allOrders.filter((order) => order.userId === user.email);
    }

    const farmerOrders = allOrders.filter((order) => {
        if (!Array.isArray(order.items)) return false;
        return order.items.some((item) => isProductOwnedByFarmer(item, user));
    });

    // Keep demo behavior usable for older orders without ownership metadata
    return farmerOrders.length > 0 ? farmerOrders : allOrders;
}

function renderStats(isFarmer, orders, activeProductCount) {
    const stat1Title = document.getElementById('stat1Title');
    const stat1Val = document.getElementById('stat1Val');
    const stat1Icon = document.getElementById('stat1Icon');
    const stat2Title = document.getElementById('stat2Title');
    const stat2Val = document.getElementById('stat2Val');
    const stat2Icon = document.getElementById('stat2Icon');

    const totalValue = orders.reduce((acc, order) => acc + parseFloat(order.total || 0), 0);

    if (isFarmer) {
        if (stat1Title) stat1Title.textContent = 'Total Sales';
        if (stat1Val) stat1Val.textContent = Utils.formatCurrency(totalValue);
        if (stat1Icon) stat1Icon.className = 'fa-solid fa-sack-dollar';

        if (stat2Title) stat2Title.textContent = 'Active Products';
        if (stat2Val) stat2Val.textContent = activeProductCount.toString();
        if (stat2Icon) stat2Icon.className = 'fa-solid fa-wheat-awn';
    } else {
        if (stat1Title) stat1Title.textContent = 'Total Spent';
        if (stat1Val) stat1Val.textContent = Utils.formatCurrency(totalValue);
        if (stat1Icon) stat1Icon.className = 'fa-solid fa-wallet';

        if (stat2Title) stat2Title.textContent = 'Orders Placed';
        if (stat2Val) stat2Val.textContent = orders.length.toString();
        if (stat2Icon) stat2Icon.className = 'fa-solid fa-box-open';
    }
}

function updateActiveProductsStat(count) {
    const stat2Val = document.getElementById('stat2Val');
    if (stat2Val) stat2Val.textContent = count.toString();
}

function renderRecentOrders(orders) {
    const tableBody = document.getElementById('recentOrdersBody');
    if (!tableBody) return;

    if (!orders.length) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No recent orders found.</td></tr>';
        return;
    }

    const rows = orders
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map((order) => {
            const status = order.status || 'Pending';
            const statusClass = status.toLowerCase().replace(/[^a-z0-9-]/g, '');
            const itemCount = Array.isArray(order.items) ? order.items.length : 0;
            return `
                <tr>
                    <td><strong>${order.id}</strong></td>
                    <td>${new Date(order.date).toLocaleDateString()}</td>
                    <td>${itemCount} items</td>
                    <td>${Utils.formatCurrency(parseFloat(order.total || 0))}</td>
                    <td><span class="status-badge status-${statusClass}">${status}</span></td>
                </tr>
            `;
        })
        .join('');

    tableBody.innerHTML = rows;
}

function getFarmerProducts(products, user) {
    if (!Array.isArray(products)) return [];
    return products.filter((product) => isProductOwnedByFarmer(product, user));
}

function isProductOwnedByFarmer(product, user) {
    if (!product || !user) return false;

    const farmerEmail = String(product.farmerEmail || product.farmer_email || '').toLowerCase();
    const farmerName = String(product.farmer || product.farmerName || '').toLowerCase();

    return farmerEmail === String(user.email).toLowerCase() || farmerName === String(user.name).toLowerCase();
}

function renderFarmerProducts(products) {
    const grid = document.getElementById('farmerProductsGrid');
    if (!grid) return;

    if (!products.length) {
        grid.innerHTML = `
            <div class="empty-dashboard-card">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>No products yet. Add your first product above.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = products
        .map((product) => {
            const productTitle = product.title || product.name || 'Untitled Product';
            const productImage = product.image || product.image_url || 'https://via.placeholder.com/400x220?text=No+Image';
            const stockValue = product.stock || product.quantity || 0;
            const unit = product.unit || 'units';

            return `
                <div class="card dashboard-product-card">
                    <img src="${productImage}" alt="${productTitle}" class="dashboard-product-img">
                    <div class="dashboard-product-content">
                        <h4>${productTitle}</h4>
                        <p class="dashboard-product-stock">${stockValue} ${unit} in stock</p>
                        <div class="dashboard-product-price">${Utils.formatCurrency(parseFloat(product.price || 0))}</div>
                    </div>
                </div>
            `;
        })
        .join('');
}

function bindFarmerProductForm(user, onProductSaved) {
    const form = document.getElementById('farmerAddProductForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const imageInput = document.getElementById('farmerProductImage');
        const nameInput = document.getElementById('farmerProductName');
        const priceInput = document.getElementById('farmerProductPrice');

        const productName = nameInput ? nameInput.value.trim() : '';
        const productPrice = priceInput ? parseFloat(priceInput.value) : NaN;
        const file = imageInput && imageInput.files ? imageInput.files[0] : null;

        if (!file || !productName || Number.isNaN(productPrice) || productPrice <= 0) {
            Utils.showToast('Please add image, product name, and valid price.', 'info');
            return;
        }

        try {
            const imageDataUrl = await readFileAsDataUrl(file);

            const newProduct = {
                id: `fp-${Date.now()}`,
                title: productName,
                name: productName,
                category: 'Custom',
                price: parseFloat(productPrice.toFixed(2)),
                unit: 'item',
                farmer: user.name,
                farmerEmail: user.email,
                location: 'Local Farm',
                image: imageDataUrl,
                stock: 1,
                desc: ''
            };

            const products = Utils.getStorage('fc_products', []);
            products.unshift(newProduct);
            Utils.setStorage('fc_products', products);

            form.reset();
            Utils.showToast('Product added successfully!');

            if (typeof onProductSaved === 'function') {
                onProductSaved(newProduct);
            }
        } catch (error) {
            Utils.showToast('Unable to upload image. Please try another file.', 'info');
        }
    });
}

function renderBuyerRecommendations(products) {
    const grid = document.getElementById('buyerRecsGrid');
    if (!grid) return;

    const recommendations = Array.isArray(products)
        ? products.slice().sort(() => 0.5 - Math.random()).slice(0, 3)
        : [];

    if (!recommendations.length) {
        grid.innerHTML = `
            <div class="empty-dashboard-card">
                <i class="fa-solid fa-leaf"></i>
                <p>No recommendations available right now.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = recommendations
        .map((product) => {
            const productTitle = product.title || product.name || 'Untitled Product';
            const productImage = product.image || product.image_url || 'https://via.placeholder.com/400x220?text=No+Image';
            const farmerName = product.farmer || product.farmer_name || 'Local Farmer';
            return `
                <div class="card dashboard-product-card">
                    <img src="${productImage}" alt="${productTitle}" class="dashboard-product-img">
                    <div class="dashboard-product-content">
                        <h4><a href="product-details.html?id=${product.id}" style="color:inherit;">${productTitle}</a></h4>
                        <p class="dashboard-product-stock"><i class="fa-solid fa-wheat-awn"></i> ${farmerName}</p>
                        <div class="dashboard-product-price">${Utils.formatCurrency(parseFloat(product.price || 0))}</div>
                    </div>
                </div>
            `;
        })
        .join('');
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
