document.addEventListener('DOMContentLoaded', () => {
    // 1. Session Auth Check
    const session = Utils.getStorage('fc_session');
    if (!session || !session.isLoggedIn) {
        Utils.showToast('Please log in to view your orders', 'info');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }

    // 2. Load Orders Data
    const allOrders = Utils.getStorage('fc_orders', []);

    const isFarmer = session.user.role === 'farmer';
    updateOrdersPageCopy(isFarmer);

    // Filter orders for the logged-in user
    // Buyer -> own orders
    // Farmer -> orders containing products belonging to that farmer
    let userOrders = [];
    if (session.user.role === 'buyer') {
        userOrders = allOrders.filter(o => o.userId === session.user.email);
    } else {
        const farmerOrders = allOrders.filter((order) => orderHasFarmerItems(order, session.user));
        userOrders = farmerOrders.length > 0 ? farmerOrders : allOrders;
    }

    const container = document.getElementById('orders-list-container');
    const emptyState = document.getElementById('no-orders');

    if (userOrders.length === 0) {
        if(container) container.style.display = 'none';
        if(emptyState) emptyState.style.display = 'block';
        return;
    }

    // Sort by Date descending
    userOrders.sort((a,b) => new Date(b.date) - new Date(a.date));

    // Render Orders
    container.innerHTML = '';
    userOrders.forEach(order => {
        const d = new Date(order.date);
        const orderItems = Array.isArray(order.items) ? order.items : [];
        let itemsHtml = '';
        orderItems.forEach(item => {
            const itemTitle = item.title || item.name || 'Product';
            const itemImage = item.image || item.image_url || 'https://via.placeholder.com/70';
            const itemQty = item.quantity || 1;
            const itemPrice = parseFloat(item.price || 0);
            itemsHtml += `
                <div class="order-item">
                    <img src="${itemImage}" alt="${itemTitle}">
                    <div class="oi-details">
                        <span class="oi-title">${itemTitle}</span>
                        <span class="oi-meta">Qty: ${itemQty} | ${Utils.formatCurrency(itemPrice)} each</span>
                    </div>
                </div>
            `;
        });

        const statusClass = getStatusClass(order.status);
        const mapsUrl = buildGoogleMapsUrl(order);
        const locationLabel = order.shippingAddr || 'Location';

        let footerLeft = `<span>Shipping to: ${order.shippingAddr || 'Not provided'}</span>`;
        let footerAction = `<button class="btn btn-outline" onclick="Utils.showToast('Re-order functionality coming soon!')">Order Again</button>`;

        if (isFarmer) {
            footerLeft = mapsUrl
                ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="order-location-link"><i class="fa-solid fa-location-dot"></i> ${locationLabel}</a>`
                : '<span><i class="fa-solid fa-location-dot"></i> Location not available</span>';

            footerAction = mapsUrl
                ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline order-map-btn">Open in Google Maps</a>`
                : '<span></span>';
        }

        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-header">
                <div>
                    <span class="order-id">Order #${order.id}</span>
                    <span class="order-date">Placed on ${d.toLocaleDateString()}</span>
                </div>
                <div style="text-align: right;">
                    <span class="order-status ${statusClass}">${order.status || 'Processing'}</span>
                    <div class="order-total">Total: <strong>${Utils.formatCurrency(parseFloat(order.total || 0))}</strong></div>
                </div>
            </div>
            <div class="order-body">
                ${itemsHtml}
            </div>
            <div class="order-footer">
                ${footerLeft}
                ${footerAction}
            </div>
        `;
        container.appendChild(card);
    });
});

function getStatusClass(status) {
    if (!status) return 'status-processing';
    switch(status.toLowerCase()) {
        case 'pending': return 'status-processing';
        case 'accepted': return 'status-processing';
        case 'processing': return 'status-processing';
        case 'shipped': return 'status-shipped';
        case 'delivered': return 'status-delivered';
        case 'cancelled': return 'status-cancelled';
        default: return 'status-processing';
    }
}

function updateOrdersPageCopy(isFarmer) {
    const title = document.querySelector('.orders-header h1');
    const subtitle = document.querySelector('.orders-header p');
    const emptyTitle = document.querySelector('#no-orders h2');
    const emptyDesc = document.querySelector('#no-orders p');
    const emptyAction = document.querySelector('#no-orders a');

    if (!isFarmer) return;

    if (title) title.textContent = 'Farmer Orders';
    if (subtitle) subtitle.textContent = 'View customer orders and open delivery location in Google Maps';
    if (emptyTitle) emptyTitle.textContent = 'No Orders Yet';
    if (emptyDesc) emptyDesc.textContent = 'User orders will appear here when buyers place orders for your products.';
    if (emptyAction) {
        emptyAction.href = 'dashboard.html';
        emptyAction.textContent = 'Go to Dashboard';
    }
}

function orderHasFarmerItems(order, farmerUser) {
    if (!order || !Array.isArray(order.items)) return false;
    const farmerEmail = String(farmerUser.email || '').toLowerCase();
    const farmerName = String(farmerUser.name || '').toLowerCase();

    return order.items.some((item) => {
        const itemFarmerEmail = String(item.farmerEmail || item.farmer_email || '').toLowerCase();
        const itemFarmerName = String(item.farmer || item.farmerName || '').toLowerCase();

        return itemFarmerEmail === farmerEmail || itemFarmerName === farmerName;
    });
}

function buildGoogleMapsUrl(order) {
    const lat = parseFloat(order.buyerLatitude || order.buyer_latitude || order.shippingLatitude);
    const lng = parseFloat(order.buyerLongitude || order.buyer_longitude || order.shippingLongitude);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }

    if (order.shippingAddr) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.shippingAddr)}`;
    }

    return null;
}
