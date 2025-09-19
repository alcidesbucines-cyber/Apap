# APAP Web App (Flask + Apache)

Aplicación Flask con frontend estático y backend detrás de Apache (Reverse Proxy) pensada para despliegue en Amazon EC2.

## Estructura

- Backend Flask en `Server.py` (exporta `app`).
- Entrada para Gunicorn en `wsgi.py` (`from Server import app`).
- Frontend estático servido por Apache: `index.html`, `login.html`, `registro.html`, `otp.html`, `exito.html`, `styles.css`, `script.js`, `registro.js`, `otp.js`.
- Las llamadas de frontend van a `"/api"` y Apache las reenvía a Gunicorn (`127.0.0.1:5000`).

## Requisitos

- Ubuntu 22.04+ (o similar)
- Python 3.10+
- Apache2 con módulos proxy

## 1. Clonado e instalación

```bash
# En tu instancia EC2 (usuario ubuntu o similar)
sudo apt update && sudo apt install -y python3-venv python3-pip apache2

# Clonar tu repositorio
cd ~
git clone <TU_REPO_GITHUB_URL> Apap
cd Apap

# Crear y activar venv
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

## 2. Variables de entorno

`Server.py` lee las variables `TELEGRAM_TOKEN` y `CHAT_ID`.

Opciones:

- Exportarlas en la shell antes de lanzar Gunicorn:

```bash
export TELEGRAM_TOKEN="<tu-bot-token>"
export CHAT_ID="<tu-chat-id>"
```

- O crear un archivo `/etc/apap.env` y usar Systemd (recomendado). Ver sección Systemd.

También puedes usar `.env` local para desarrollo; hay una plantilla en `.env.example`.

## 3. Ejecutar Gunicorn (manual)

```bash
cd ~/Apap
source venv/bin/activate
nohup gunicorn -w 4 -b 127.0.0.1:5000 wsgi:app > app.log 2>&1 &
```

- Asegúrate de haber exportado `TELEGRAM_TOKEN` y `CHAT_ID` en la misma sesión.

## 4. Configurar Apache (Reverse Proxy + estáticos)

Habilitar módulos necesarios:

```bash
sudo a2enmod proxy proxy_http headers
sudo systemctl reload apache2
```

Crear un VirtualHost (ejemplo en `apache.conf.example`). Por ejemplo:

```apache
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html

    ProxyPreserveHost On
    ProxyPass        /api/ http://127.0.0.1:5000/
    ProxyPassReverse /api/ http://127.0.0.1:5000/

    <Directory /var/www/html/>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

Copiar el frontend al DocumentRoot:

```bash
sudo cp -r index.html login.html registro.html otp.html exito.html styles.css script.js registro.js otp.js /var/www/html/
```

Aplicar el VirtualHost (si usas un archivo nuevo):

```bash
sudo cp apache.conf.example /etc/apache2/sites-available/apap.conf
sudo a2ensite apap.conf
sudo systemctl reload apache2
```

## 5. Ejecutar Gunicorn con Systemd (opcional recomendado)

Archivo de entorno `/etc/apap.env`:

```ini
TELEGRAM_TOKEN=<tu-bot-token>
CHAT_ID=<tu-chat-id>
```

Servicio `/etc/systemd/system/apap.service`:

```ini
[Unit]
Description=Gunicorn APAP Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/home/ubuntu/Apap
EnvironmentFile=/etc/apap.env
ExecStart=/home/ubuntu/Apap/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 wsgi:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Activar y arrancar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable apap
sudo systemctl start apap
sudo systemctl status apap
```

## 6. Seguridad y buenas prácticas

- No publiques tu `TELEGRAM_TOKEN` ni tu `CHAT_ID` en el repo. Usa variables de entorno.
- Deja el puerto 5000 sólo local (`127.0.0.1`). Expón al público únicamente el 80/443 de Apache.
- Si pones HTTPS detrás de un Load Balancer, considera habilitar `ProxyFix` en `wsgi.py` (está comentado como ejemplo).

## 7. Troubleshooting

- Ver logs de Apache:
  - `/var/log/apache2/error.log`
  - `/var/log/apache2/access.log`
- Ver log de la app:
  - `~/Apap/app.log` (si usaste nohup)
  - `journalctl -u apap -f` (si usas systemd)
- Probar backend directo vs proxy:

```bash
curl -i http://127.0.0.1:5000/apap_estado/test_user
curl -i http://localhost/api/apap_estado/test_user
```

- El frontend debe hacer fetch a `/api/...` (ya configurado en `script.js`, `registro.js`, `otp.js`).

## 8. Despliegue en GitHub

1) Crear el repositorio en GitHub.
2) Asegúrate de tener `.gitignore` (ya incluido) para evitar subir `venv/`, logs y `.env`.
3) Subir el código:

```bash
git init
git remote add origin <TU_REPO_GITHUB_URL>
git add .
git commit -m "Proyecto APAP listo para EC2"
git push -u origin main
```

Listo. Con esto, tu proyecto está preparado para GitHub y para desplegarse en EC2 con Apache + Gunicorn.
