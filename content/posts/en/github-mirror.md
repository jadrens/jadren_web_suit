---
title: Set Up a GitHub Mirror Site
date: 2026-06-11T00:00:00.000Z
description: Using Nginx to set up a GitHub mirror site for faster access
tags: [website, mirror]
---

I've set up a GitHub mirror site with moderate bandwidth for general accelerated access:

> **URL:** <https://github.rayou.me>

---

## ⚠️ Security Notice

Although the site supports login, it is **strongly recommended NOT to log in** to prevent credential leaks!

---

## Tools Used

- [Nginx](https://nginx.org/)

## Nginx Configuration

This is the configuration for this server. If you want to set up your own mirror, feel free to reference this config — just replace the domain and certificate paths with your own.

```nginx
server {
    listen       80;
    listen       [::]:80;
    server_name  github.rayou.me;

    return 301 https://$host$request_uri;
}

server {
    listen       443 ssl http2;
    listen       [::]:443 ssl http2;
    server_name  github.rayou.me;

    # SSL Certificate
    ssl_certificate      /home/dragonren/.tls/cert-rayou;
    ssl_certificate_key  /home/dragonren/.tls/key-rayou;

    # SSL Protocols & Cipher Suites
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Logging
    access_log  /var/log/nginx/github_proxy_access.log;
    error_log   /var/log/nginx/github_proxy_error.log info;

    # DNS Resolution — use IPv4 DNS servers
    resolver         8.8.8.8 1.1.1.1 valid=600s ipv6=off;
    resolver_timeout 10s;

    # =================== Main Site Proxy ===================
    location / {
        proxy_pass  https://github.com;

        # Increase buffer to avoid "too big header" errors
        proxy_buffer_size          256k;
        proxy_buffers              8 256k;
        proxy_busy_buffers_size    512k;
        proxy_buffering            off;

        # SSL Proxy Settings
        proxy_ssl_server_name on;
        proxy_ssl_name        github.com;
        proxy_ssl_protocols   TLSv1.2 TLSv1.3;
        proxy_ssl_session_reuse on;

        # Request Headers
        proxy_set_header Host            github.com;
        proxy_set_header Origin          https://github.com;
        proxy_set_header Referer         $http_referer;
        proxy_set_header X-Real-IP       "";
        proxy_set_header X-Forwarded-For "";
        proxy_set_header X-Forwarded-Proto  "";
        proxy_set_header X-Forwarded-Host   "";
        proxy_set_header User-Agent      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        proxy_set_header Accept-Encoding "";

        # Redirect Rewriting
        proxy_redirect     https://github.com/                          https://github.rayou.me/;
        proxy_redirect     https://release-assets.githubusercontent.com/ https://github.rayou.me/assets/;
        proxy_redirect     https://objects.githubusercontent.com/       https://github.rayou.me/objects/;
        proxy_redirect     https://codeload.github.com/                 https://github.rayou.me/codeload/;
        proxy_redirect     https://raw.githubusercontent.com/           https://github.rayou.me/raw/;
        proxy_redirect     https://avatars.githubusercontent.com/       https://github.rayou.me/avatars/;

        # Cookie Domain Rewriting
        proxy_cookie_domain github.com github.rayou.me;

        # Timeouts
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;

        # Content Substitution
        sub_filter         'github.com'                           'github.rayou.me';
        sub_filter         'release-assets.githubusercontent.com' 'github.rayou.me/assets';
        sub_filter         'objects.githubusercontent.com'        'github.rayou.me/objects';
        sub_filter         'codeload.github.com'                  'github.rayou.me/codeload';
        sub_filter         'raw.githubusercontent.com'            'github.rayou.me/raw';
        sub_filter         'avatars.githubusercontent.com'        'github.rayou.me/avatars';
        sub_filter_once    off;
        sub_filter_types   text/css text/xml application/javascript application/json;
    }

    # =================== Release Assets Proxy ===================
    location /assets/ {
        rewrite ^/assets/(.*) /$1 break;
        proxy_pass https://release-assets.githubusercontent.com;

        proxy_buffer_size          256k;
        proxy_buffers              8 256k;
        proxy_busy_buffers_size    512k;

        proxy_ssl_server_name on;
        proxy_ssl_name        release-assets.githubusercontent.com;
        proxy_ssl_protocols   TLSv1.2 TLSv1.3;
        proxy_ssl_session_reuse on;

        proxy_set_header Host              release-assets.githubusercontent.com;
        proxy_set_header Origin            "";
        proxy_set_header Referer           "";
        proxy_set_header User-Agent        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        proxy_set_header Accept-Encoding   "identity";
        proxy_set_header Range             $http_range;
        proxy_set_header If-Range          $http_if_range;

        # Large File Download Optimization
        proxy_buffering            on;
        proxy_max_temp_file_size   2048m;
        proxy_temp_file_write_size 256k;
        proxy_request_buffering    off;

        proxy_connect_timeout 60s;
        proxy_read_timeout    3600s;
        proxy_send_timeout    3600s;
    }

    # =================== Git LFS Large File Proxy ===================
    location /objects/ {
        rewrite ^/objects/(.*) /$1 break;
        proxy_pass https://objects.githubusercontent.com;

        proxy_buffer_size          256k;
        proxy_buffers              8 256k;
        proxy_busy_buffers_size    512k;

        proxy_ssl_server_name on;
        proxy_ssl_name        objects.githubusercontent.com;
        proxy_ssl_protocols   TLSv1.2 TLSv1.3;
        proxy_ssl_session_reuse on;

        proxy_set_header Host              objects.githubusercontent.com;
        proxy_set_header Origin            "";
        proxy_set_header Referer           "";
        proxy_set_header User-Agent        "Mozilla/5.0";
        proxy_set_header Accept-Encoding   "identity";
        proxy_set_header Range             $http_range;
        proxy_set_header If-Range          $http_if_range;

        proxy_buffering            on;
        proxy_max_temp_file_size   2048m;
        proxy_temp_file_write_size 256k;
        proxy_request_buffering    off;

        proxy_connect_timeout 60s;
        proxy_read_timeout    3600s;
        proxy_send_timeout    3600s;
    }

    # =================== Source Code Download Proxy ===================
    location /codeload/ {
        rewrite ^/codeload/(.*) /$1 break;
        proxy_pass https://codeload.github.com;

        proxy_buffer_size          256k;
        proxy_buffers              8 256k;
        proxy_busy_buffers_size    512k;

        proxy_ssl_server_name on;
        proxy_ssl_name        codeload.github.com;
        proxy_ssl_protocols   TLSv1.2 TLSv1.3;
        proxy_ssl_session_reuse on;

        proxy_set_header Host              codeload.github.com;
        proxy_set_header Origin            "";
        proxy_set_header Referer           "";
        proxy_set_header User-Agent        "Mozilla/5.0";
        proxy_set_header Accept-Encoding   "identity";
        proxy_set_header Range             $http_range;
        proxy_set_header If-Range          $http_if_range;

        proxy_buffering            on;
        proxy_max_temp_file_size   2048m;
        proxy_temp_file_write_size 256k;
        proxy_request_buffering    off;

        proxy_connect_timeout 60s;
        proxy_read_timeout    3600s;
        proxy_send_timeout    3600s;
    }

    # =================== Raw File Proxy ===================
    location /raw/ {
        rewrite ^/raw/(.*) /$1 break;
        proxy_pass https://raw.githubusercontent.com;

        proxy_buffer_size          256k;
        proxy_buffers              8 256k;
        proxy_busy_buffers_size    512k;

        proxy_ssl_server_name on;
        proxy_ssl_name        raw.githubusercontent.com;
        proxy_ssl_protocols   TLSv1.2 TLSv1.3;
        proxy_ssl_session_reuse on;

        proxy_set_header Host              raw.githubusercontent.com;
        proxy_set_header Origin            "";
        proxy_set_header Referer           "";
        proxy_set_header User-Agent        "Mozilla/5.0";
        proxy_set_header Accept-Encoding   "identity";
        proxy_set_header Range             $http_range;
        proxy_set_header If-Range          $http_if_range;

        proxy_buffering            on;
        proxy_max_temp_file_size   2048m;
        proxy_temp_file_write_size 256k;
        proxy_request_buffering    off;

        proxy_connect_timeout 60s;
        proxy_read_timeout    3600s;
        proxy_send_timeout    3600s;
    }

    # =================== Avatar Proxy ===================
    location /avatars/ {
        rewrite ^/avatars/(.*) /$1 break;
        proxy_pass https://avatars.githubusercontent.com;

        proxy_buffer_size          256k;
        proxy_buffers              8 256k;
        proxy_busy_buffers_size    512k;

        proxy_ssl_server_name on;
        proxy_ssl_name        avatars.githubusercontent.com;
        proxy_ssl_protocols   TLSv1.2 TLSv1.3;
        proxy_ssl_session_reuse on;

        proxy_set_header Host              avatars.githubusercontent.com;
        proxy_set_header Origin            "";
        proxy_set_header Referer           "";
        proxy_set_header User-Agent        "Mozilla/5.0";
        proxy_set_header Accept-Encoding   "";

        proxy_buffering    off;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }
}
```
