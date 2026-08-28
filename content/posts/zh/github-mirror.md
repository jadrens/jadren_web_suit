---
title: 搭建了一个 GitHub 镜像站
description: 使用 Nginx 搭建 GitHub 镜像站，加速访问
tags:
  - website
  - mirror
date: '2026-06-16T16:37:27.438Z'
---

尝试搭建了一个 GitHub 镜像站，带宽不大，可供一般加速访问：

> **地址：** <https://github.rayou.me>

---

## ⚠️ 安全提示

虽然网站支持登录，但是**强烈不建议登录**，防止凭证泄露！

---

## 使用工具

- [Nginx](https://nginx.org/)

## Nginx 配置

这是本服务器配置,如果要搭建可以参考本配置,请将域名与证书替换为自己的

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

    # SSL 证书
    ssl_certificate      /home/dragonren/.tls/cert-rayou;
    ssl_certificate_key  /home/dragonren/.tls/key-rayou;

    # SSL 协议与加密套件
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 日志
    access_log  /var/log/nginx/github_proxy_access.log;
    error_log   /var/log/nginx/github_proxy_error.log info;

    # DNS 解析 - 用 IPv4 DNS 服务器
    resolver         8.8.8.8 1.1.1.1 valid=600s ipv6=off;
    resolver_timeout 10s;

    # =================== 主站代理 ===================
    location / {
        proxy_pass  https://github.com;

        # 增大缓冲区解决 "too big header" 问题
        proxy_buffer_size          256k;
        proxy_buffers              8 256k;
        proxy_busy_buffers_size    512k;
        proxy_buffering            off;

        # SSL 代理设置
        proxy_ssl_server_name on;
        proxy_ssl_name        github.com;
        proxy_ssl_protocols   TLSv1.2 TLSv1.3;
        proxy_ssl_session_reuse on;

        # 请求头设置
        proxy_set_header Host            github.com;
        proxy_set_header Origin          https://github.com;
        proxy_set_header Referer         $http_referer;
        proxy_set_header X-Real-IP       "";
        proxy_set_header X-Forwarded-For "";
        proxy_set_header X-Forwarded-Proto  "";
        proxy_set_header X-Forwarded-Host   "";
        proxy_set_header User-Agent      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        proxy_set_header Accept-Encoding "";

        # 重定向改写
        proxy_redirect     https://github.com/                          https://github.rayou.me/;
        proxy_redirect     https://release-assets.githubusercontent.com/ https://github.rayou.me/assets/;
        proxy_redirect     https://objects.githubusercontent.com/       https://github.rayou.me/objects/;
        proxy_redirect     https://codeload.github.com/                 https://github.rayou.me/codeload/;
        proxy_redirect     https://raw.githubusercontent.com/           https://github.rayou.me/raw/;
        proxy_redirect     https://avatars.githubusercontent.com/       https://github.rayou.me/avatars/;

        # Cookie 域名改写
        proxy_cookie_domain github.com github.rayou.me;

        # 超时
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;

        # 内容替换
        sub_filter         'github.com'                           'github.rayou.me';
        sub_filter         'release-assets.githubusercontent.com' 'github.rayou.me/assets';
        sub_filter         'objects.githubusercontent.com'        'github.rayou.me/objects';
        sub_filter         'codeload.github.com'                  'github.rayou.me/codeload';
        sub_filter         'raw.githubusercontent.com'            'github.rayou.me/raw';
        sub_filter         'avatars.githubusercontent.com'        'github.rayou.me/avatars';
        sub_filter_once    off;
        sub_filter_types   text/css text/xml application/javascript application/json;
    }

    # =================== Release 资源代理 ===================
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

        # 大文件下载优化
        proxy_buffering            on;
        proxy_max_temp_file_size   2048m;
        proxy_temp_file_write_size 256k;
        proxy_request_buffering    off;

        proxy_connect_timeout 60s;
        proxy_read_timeout    3600s;
        proxy_send_timeout    3600s;
    }

    # =================== Git LFS 大文件代理 ===================
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

    # =================== 源码下载代理 ===================
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

    # =================== Raw 文件代理 ===================
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

    # =================== 头像代理 ===================
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
