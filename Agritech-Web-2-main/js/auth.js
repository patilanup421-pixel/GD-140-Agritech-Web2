/**
 * AUTH.JS
 * Requires utils.js. Handles login and registration through backend APIs
 * and toggles the role selector on the signup page.
 */

const API_BASE_URL = window.FC_API_BASE_URL || Utils.getStorage('fc_api_base_url', 'http://localhost:5000/api');
function getLocation() {
    const locationStatus = document.getElementById('locationStatus');
    const locationBtn = document.querySelector('.location-btn');

    if (navigator.geolocation) {
        if (locationStatus) {
            locationStatus.style.color = 'var(--text-muted)';
            locationStatus.innerText = 'Fetching location...';
        }
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const latitudeInput = document.getElementById('latitude');
                const longitudeInput = document.getElementById('longitude');
                if (latitudeInput) latitudeInput.value = position.coords.latitude;
                if (longitudeInput) longitudeInput.value = position.coords.longitude;
                if (locationStatus) {
                    locationStatus.style.color = 'green';
                    locationStatus.innerText = 'Location fetched successfully!';
                }
                if (locationBtn) {
                    locationBtn.disabled = true;
                    locationBtn.innerText = 'Location Added';
                }
            },
            function() {
                if (locationStatus) {
                    locationStatus.style.color = 'var(--danger)';
                    locationStatus.innerText = 'Failed to fetch location.';
                }
                if (locationBtn) {
                    locationBtn.disabled = false;
                    locationBtn.innerText = 'Use My Current Location';
                }
            }
        );
    } else {
        alert('Geolocation is not supported by this browser.');
    }
}

function setButtonLoading(button, loadingHtml) {
    if (!button) return;
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = loadingHtml;
}

function resetButton(button) {
    if (!button) return;
    button.disabled = false;
    button.innerHTML = button.dataset.originalHtml || button.innerHTML;
}

function extractErrorMessage(responseData, fallback = 'Something went wrong. Please try again.') {
    if (!responseData) return fallback;
    if (responseData.message) return responseData.message;
    if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
        return responseData.errors[0].msg || fallback;
    }
    return fallback;
}

async function postJson(path, payload) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    let json = null;
    try {
        json = await response.json();
    } catch (error) {
        json = null;
    }

    if (!response.ok) {
        throw new Error(extractErrorMessage(json, 'Request failed. Please check backend server.'));
    }

    return json;
}

function showError(msg) {
    const errBox = document.getElementById('errorBox') || document.createElement('div');
    if (errBox.id !== 'errorBox') {
        errBox.id = 'errorBox';
        errBox.style.color = 'var(--danger)';
        errBox.style.marginTop = '15px';
        errBox.style.textAlign = 'center';
        if (document.querySelector('.auth-container')) document.querySelector('.auth-container').appendChild(errBox);
    }
    errBox.textContent = msg;
    errBox.style.display = 'block';
}

function clearError() {
    const errBox = document.getElementById('errorBox');
    if (errBox) errBox.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    
    // 2. Role Selector Logic for Registration
    const signupRole = document.getElementById('signupRole');
    const addressInput = document.getElementById('address');
    if (signupRole && addressInput) {
        const updateAddressRequirement = () => {
            const isBuyer = signupRole.value === 'buyer';
            addressInput.required = isBuyer;
            if (!isBuyer) {
                const latitudeInput = document.getElementById('latitude');
                const longitudeInput = document.getElementById('longitude');
                const locationStatus = document.getElementById('locationStatus');
                if (latitudeInput) latitudeInput.value = '';
                if (longitudeInput) longitudeInput.value = '';
                if (locationStatus) locationStatus.innerText = '';
                const locationBtn = document.querySelector('.location-btn');
                if (locationBtn) {
                    locationBtn.disabled = false;
                    locationBtn.innerText = 'Use My Current Location';
                }
            }
        };
        signupRole.addEventListener('change', updateAddressRequirement);
        updateAddressRequirement();
    }

    // 3. Signup Submission
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();
            const btn = signupForm.querySelector('button[type="submit"]');
            setButtonLoading(btn, '<i class="fa-solid fa-spinner fa-spin"></i> Processing...');

            try {
                const name = document.getElementById('signupName') ? document.getElementById('signupName').value.trim() : '';
                const email = document.getElementById('signupEmail') ? document.getElementById('signupEmail').value.trim().toLowerCase() : '';
                const password = document.getElementById('signupPassword') ? document.getElementById('signupPassword').value : '';
                const roleSelect = document.getElementById('signupRole');
                const selectedRole = roleSelect ? roleSelect.value : 'buyer';
                const address = document.getElementById('address') ? document.getElementById('address').value.trim() : '';
                const latitude = document.getElementById('latitude') ? document.getElementById('latitude').value.trim() : '';
                const longitude = document.getElementById('longitude') ? document.getElementById('longitude').value.trim() : '';

                if (selectedRole === 'buyer' && !address) {
                    showError('Address is required for buyers.');
                    resetButton(btn);
                    return;
                }

                const payload = {
                    name,
                    email,
                    password,
                    role: selectedRole,
                    address: address || null
                };

                if (latitude) payload.latitude = parseFloat(latitude);
                if (longitude) payload.longitude = parseFloat(longitude);

                if ((latitude && Number.isNaN(payload.latitude)) || (longitude && Number.isNaN(payload.longitude))) {
                    showError('Location coordinates are invalid. Please fetch location again.');
                    resetButton(btn);
                    return;
                }

                const response = await postJson('/auth/signup', payload);
                const authData = response.data || {};

                Utils.logAction('User Registered', { role: selectedRole, email });
                Utils.setStorage('fc_session', {
                    isLoggedIn: true,
                    token: authData.token,
                    user: authData.user
                });

                Utils.showToast('Signup successful!');
                window.location.href = 'dashboard.html';
            } catch (error) {
                showError(error.message);
                resetButton(btn);
            }
        });
    }

    // 4. Login Submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();
            const btn = loginForm.querySelector('button[type="submit"]');
            setButtonLoading(btn, '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...');

            try {
                const email = document.getElementById('loginEmail') ? document.getElementById('loginEmail').value.trim().toLowerCase() : '';
                const password = document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : '';

                const response = await postJson('/auth/login', { email, password });
                const authData = response.data || {};

                Utils.logAction('User Logged In', { role: authData.user ? authData.user.role : 'unknown', email });
                Utils.setStorage('fc_session', {
                    isLoggedIn: true,
                    token: authData.token,
                    user: authData.user
                });

                Utils.showToast('Login successful!');
                window.location.href = 'dashboard.html';
            } catch (error) {
                showError(error.message);
                resetButton(btn);
            }
        });
    }
});
