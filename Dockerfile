# syntax=docker/dockerfile:1
# EduSpark static site — nginx (non-root). Build: docker build -t eduspark:dev .   Run: docker run -p 8080:8080 eduspark:dev
FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.inc /etc/nginx/snippets/security-headers.inc
# .dockerignore se tests/scripts/secrets/infra bahar rehte hain — sirf site ki files image me jaati hain
COPY . /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
