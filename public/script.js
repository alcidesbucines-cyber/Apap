// script.js - Módulo principal de la aplicación
const API_BASE_URL = window.location.hostname === 'localhost' ? '/api' : '/api';

// Mostrar/ocultar loading
function showLoading(message = 'Cargando...') {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    if (overlay && messageEl) {
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.role = 'alert';
    
    notification.innerHTML = `
        <strong>${type === 'error' ? 'Error' : type === 'success' ? 'Éxito' : 'Información'}</strong>
        <span>${message}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Agregar al body
    document.body.appendChild(notification);
    
    // Eliminar después de 5 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Función para manejar el inicio de sesión
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validaciones
    if (!username || !password) {
        showNotification('Por favor ingresa usuario y contraseña', 'error');
        return;
    }
    
    showLoading('Verificando credenciales...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/apap_login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                usuario: username, 
                password: password 
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error al iniciar sesión');
        }
        
        // Guardar usuario en localStorage para el siguiente paso
        localStorage.setItem('currentUser', username);
        
        // Redirigir a la página de verificación OTP
        window.location.href = 'otp.html';
        
    } catch (error) {
        console.error('Error en el inicio de sesión:', error);
        showNotification(error.message || 'Usuario o contraseña incorrectos', 'error');
    } finally {
        hideLoading();
    }
}

// Función para verificar el estado de autenticación
function checkAuth() {
    const currentUser = localStorage.getItem('currentUser');
    const currentPath = window.location.pathname;
    
    // Si el usuario está autenticado y está en la página de inicio de sesión, redirigir
    if (currentUser && currentPath.endsWith('index.html')) {
        window.location.href = 'otp.html';
    }
    
    // Si el usuario no está autenticado y está en una página protegida, redirigir al inicio
    if (!currentUser && !currentPath.endsWith('index.html') && !currentPath.endsWith('registro.html')) {
        window.location.href = 'index.html';
    }
}

// Función para alternar visibilidad de contraseña
function setupPasswordToggle() {
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            this.innerHTML = type === 'password' ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
        });
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Configurar el formulario de inicio de sesión
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Configurar toggle de contraseña
    setupPasswordToggle();
    
    // Verificar estado de autenticación
    checkAuth();
});
