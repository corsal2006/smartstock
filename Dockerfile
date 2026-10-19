# ==============================================================================
# Production Dockerfile for SmartStock AI
# Framework: Static Web Application (HTML5 / Tailwind CSS / Vanilla JS)
# Web Server: Hardened Nginx on Alpine Linux (Non-root unprivileged container)
# ==============================================================================

FROM nginx:1.27-alpine

# Metadata Labels
LABEL maintainer="Prathamesh Phutane <phutaneprathamesh829@gmail.com>" \
      org.opencontainers.image.title="SmartStock AI" \
      org.opencontainers.image.description="Enterprise Inventory & POS Management System" \
      org.opencontainers.image.source="https://github.com/phutaneprathamesh829-lang/smart-stock" \
      org.opencontainers.image.vendor="SmartStock" \
      org.opencontainers.image.licenses="MIT"

# Remove default Nginx website configuration
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom hardened Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy application static files
COPY index.html /usr/share/nginx/html/index.html

# Prepare file permissions for unprivileged non-root execution (UID 101 = nginx)
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid \
                         /var/cache/nginx \
                         /var/log/nginx \
                         /etc/nginx/conf.d \
                         /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose unprivileged HTTP port
EXPOSE 8080

# Run as non-root user
USER nginx

# Container Healthcheck (polls /healthz endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
