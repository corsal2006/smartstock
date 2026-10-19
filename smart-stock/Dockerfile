# ==============================================================================
# Production Dockerfile for SmartStock AI (Subdirectory mirror)
# ==============================================================================

FROM nginx:1.27-alpine

LABEL maintainer="Prathamesh Phutane <phutaneprathamesh829@gmail.com>" \
      org.opencontainers.image.title="SmartStock AI" \
      org.opencontainers.image.source="https://github.com/phutaneprathamesh829-lang/smart-stock"

RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid \
                         /var/cache/nginx \
                         /var/log/nginx \
                         /etc/nginx/conf.d \
                         /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 8080

USER nginx

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]