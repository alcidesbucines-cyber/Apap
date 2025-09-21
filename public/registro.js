document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const registrationForm = document.getElementById('registrationForm');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    const canalSelect = document.getElementById('canal');
    const canalTextoInput = document.getElementById('canalTexto');

    // Actualizar placeholder según el canal seleccionado
    canalSelect.addEventListener('change', function() {
        const placeholder = this.value === 'email' 
            ? 'ejemplo@correo.com' 
            : this.value === 'whatsapp' 
                ? '+1 (xxx) xxx-xxxx' 
                : 'Número de teléfono';
        
        const type = this.value === 'email' ? 'email' : 'tel';
        
        canalTextoInput.placeholder = `Ingrese su ${this.value === 'email' ? 'correo electrónico' : 'número de teléfono'}`;
        canalTextoInput.type = type;
        canalTextoInput.value = '';
    });

    // Mostrar/ocultar contraseña
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        this.innerHTML = type === 'password' ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
    });

    // Mostrar/ocultar confirmación de contraseña
    toggleConfirmPassword.addEventListener('click', function() {
        const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
        confirmPasswordInput.type = type;
        this.innerHTML = type === 'password' ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
    });

    // Validar formulario
    registrationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const canal = canalSelect.value;
        const canalTexto = canalTextoInput.value.trim();
        
        // Validaciones
        if (password !== confirmPassword) {
            showError('Las contraseñas no coinciden');
            return;
        }
        
        if (password.length < 6) {
            showError('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        
        if (canal === 'email' && !isValidEmail(canalTexto)) {
            showError('Por favor ingrese un correo electrónico válido');
            return;
        }
        
        if ((canal === 'sms' || canal === 'whatsapp') && !isValidPhone(canalTexto)) {
            showError('Por favor ingrese un número de teléfono válido');
            return;
        }
        
        // Mostrar carga
        showLoading('Registrando cuenta...');
        
        try {
            // Enviar datos al servidor
            const response = await fetch('/api/apap_registro', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    usuario: username,
                    password: password,
                    canal: canal,
                    canal_texto: canalTexto
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Error al registrar');
            }
            
            // Guardar usuario en localStorage para el siguiente paso
            localStorage.setItem('currentUser', username);
            
            // Redirigir a verificación OTP
            window.location.href = 'otp.html';
            
        } catch (error) {
            showError(error.message || 'Error al registrar. Por favor intente nuevamente.');
        } finally {
            hideLoading();
        }
    });
    
    // Funciones de ayuda
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    function isValidPhone(phone) {
        // Validación simple de teléfono (puedes ajustar según necesidades)
        const re = /^[0-9\-\+\(\)\s]{8,20}$/;
        return re.test(phone);
    }
    
    function showError(message) {
        // Implementar lógica para mostrar mensajes de error
        alert(message);
    }
    
    function showLoading(message) {
        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
    }
    
    function hideLoading() {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
});
