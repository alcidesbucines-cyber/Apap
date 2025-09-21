document.getElementById('registrationForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const serviceType = document.getElementById('serviceType').value;
    const fullName = document.getElementById('fullName').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;

    if (!serviceType || !fullName || !phone || !email) {
        alert('Por favor, completa todos los campos.');
        return;
    }

    fetch('/api/apap_registro', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            serviceType,
            fullName,
            phone,
            email
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'ok') {
            alert('Registro exitoso.');
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ocurrió un error al registrar.');
    });
});