from Server import app

# Si en el futuro estás detrás de LB/HTTPS y quieres respetar X-Forwarded-*, descomenta:
# from werkzeug.middleware.proxy_fix import ProxyFix
# app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)
