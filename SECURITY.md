# Инструкция по обеспечению безопасности развертывания (Security Deployment Guide)

Для обеспечения безопасности персональных данных абитуриентов (ФЗ-152) и защиты от несанкционированного доступа, настоятельно рекомендуется развертывать данное приложение за защищенным HTTPS-прокси (Reverse Proxy).

## 1. Рекомендованная архитектура
В рабочей среде Node.js-сервер (`server.ts` / `dist/server.cjs`) должен слушать исключительно локальный адрес `127.0.0.1` вместо `0.0.0.0`. Это предотвратит прямой доступ к бэкенду снаружи в обход защитного прокси-сервера.

*   **Node.js порт:** `3000` (слушает только `127.0.0.1`)
*   **Reverse Proxy:** `Nginx` или `Caddy` (принимает внешний HTTPS-трафик на порту `443` и проксирует его локально)

---

## 2. Конфигурация Nginx (пример защищенного прокси с SSL)

Ниже приведен эталонный пример конфигурации Nginx с включением заголовков безопасности, HSTS и ограничением доступа к служебным файлам:

```nginx
server {
    listen 80;
    server_name portal.nemk.ru;
    return 301 https://$host$request_uri; # Принудительный редирект на HTTPS
}

server {
    listen 443 ssl http2;
    server_name portal.nemk.ru;

    # Конфигурация SSL сертификатов (Let's Encrypt / Почта России / Минцифры)
    ssl_certificate /etc/letsencrypt/live/portal.nemk.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.nemk.ru/privkey.pem;
    
    # Рекомендованные параметры SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA256:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA256';

    # Заголовки безопасности (Security Headers)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: referrer; connect-src 'self';" always;

    # Защита от перебора и ограничение размера запроса
    client_max_body_size 5M;

    # Запрет доступа к скрытым файлам и бэкапам
    location ~ /\.(?!well-known) {
        deny all;
    }
    location ~* \.(json|bak|sql|log)$ {
        deny all;
    }

    # Проксирование запросов на локальный Node.js сервер
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Поддержка WebSockets и проброс реального IP пользователя для Rate Limiting
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 3. Требования к переменным окружения (ФЗ-152)

Перед запуском приложения в рабочей среде обязательно установите переменные окружения в конфигурации контейнера или `.env` файле:

1.  `ADMIN_LOGIN` — имя пользователя для доступа к панели администратора.
2.  `ADMIN_PASSWORD_HASH` — SHA-512 хэш администратора с солью (`nemk_salt_2026`).
3.  `SERVER_SECRET` — длинная случайная строка для криптографического подписания JWT/сессионных токенов.
4.  `ENCRYPTION_SECRET` — уникальная фраза-пароль для шифрования хранящихся персональных данных абитуриентов (AES-256).
5.  `APP_URL` — полный адрес домена (например, `https://portal.nemk.ru`), необходим бэкенду для строгой проверки CORS-заголовков.
