# APAP - Autenticación en dos pasos

Aplicación web de ejemplo que implementa un sistema de autenticación en dos pasos (2FA) con notificaciones a través de Telegram.

## Características

- Registro de usuarios con verificación por correo electrónico o SMS
- Inicio de sesión seguro
- Verificación en dos pasos (2FA) con códigos OTP
- Notificaciones en tiempo real a través de Telegram
- Interfaz de usuario responsiva
- Despliegue sencillo en Vercel

## Requisitos previos

- Node.js (versión 14 o superior)
- Cuenta en [Vercel](https://vercel.com/)
- Bot de Telegram (puedes crear uno con [@BotFather](https://t.me/botfather))
- Cuenta en [GitHub](https://github.com/)

## Configuración del entorno

1. Clona este repositorio:
   ```bash
   git clone https://github.com/tu-usuario/apap-vercel.git
   cd apap-vercel
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Crea un archivo `.env` basado en el ejemplo:
   ```bash
   cp .env.example .env
   ```

4. Configura las variables de entorno en el archivo `.env`:
   ```
   TELEGRAM_TOKEN=tu_token_de_telegram
   CHAT_ID=tu_chat_id
   VERCEL_URL=tu_url_de_vercel
   ```

## Configuración del bot de Telegram

1. Crea un nuevo bot con [@BotFather](https://t.me/botfather) y obtén el token.
2. Obtén tu ID de chat de Telegram (puedes usar [@userinfobot](https://t.me/userinfobot)).
3. Después de desplegar en Vercel, configura el webhook manualmente con:
   ```bash
   # Reemplaza TU_DOMINIO.vercel.app con tu dominio de Vercel
   node -e "require('./server').configurarWebhook('https://TU_DOMINIO.vercel.app')"
   ```
   
   O usando curl:
   ```bash
   # Reemplaza TU_DOMINIO.vercel.app con tu dominio de Vercel
   # Reemplaza TU_TOKEN con tu token de bot de Telegram
   curl -F "url=https://TU_DOMINIO.vercel.app/webhook/TU_TOKEN" https://api.telegram.org/botTU_TOKEN/setWebhook

## Despliegue en Vercel

1. Haz fork de este repositorio en tu cuenta de GitHub.
2. Inicia sesión en [Vercel](https://vercel.com/).
3. Haz clic en "New Project" y selecciona tu repositorio.
4. Configura las variables de entorno en la sección "Environment Variables".
5. Haz clic en "Deploy".

## Estructura del proyecto

```
.
├── public/                 # Archivos estáticos
│   ├── index.html          # Página de inicio de sesión
│   ├── registro.html       # Página de registro
│   ├── otp.html            # Página de verificación OTP
│   └── exito.html          # Página de éxito
├── server.js              # Servidor Node.js
├── vercel.json            # Configuración de Vercel
├── package.json           # Dependencias y scripts
└── README.md              # Este archivo
```

## Variables de entorno

| Variable       | Descripción                                  | Requerido |
|----------------|----------------------------------------------|-----------|
| TELEGRAM_TOKEN | Token de tu bot de Telegram                 | Sí        |
| CHAT_ID        | ID del chat de Telegram para notificaciones | Sí        |
| VERCEL_URL     | URL de tu aplicación en Vercel              | No        |

## Uso

1. **Registro**:
   - Los usuarios se registran con su nombre de usuario, contraseña y método de contacto.
   - Se envía una notificación al administrador a través de Telegram.

2. **Inicio de sesión**:
   - Los usuarios inician sesión con sus credenciales.
   - Se envía un código OTP al método de contacto registrado.

3. **Verificación OTP**:
   - Los usuarios ingresan el código recibido.
   - Si el código es correcto, se les redirige a la página de éxito.

## Desarrollo

Para ejecutar el servidor en modo desarrollo:

```bash
npm install -g nodemon  # Si no lo tienes instalado
git clone https://github.com/tu-usuario/apap-vercel.git
cd apap-vercel
npm install
npm run dev
```

El servidor estará disponible en `http://localhost:3000`.

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más información.

## Contribución

Las contribuciones son bienvenidas. Por favor, lee las [pautas de contribución](CONTRIBUTING.md) antes de enviar un pull request.

## Contacto

¿Tienes preguntas? Envíame un correo a [tu@email.com](mailto:tu@email.com) o abre un issue en GitHub.
