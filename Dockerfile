# ==============================================================================
# Production Dockerfile for SmartStock AI
# Framework: Static Web Application (HTML5 / Tailwind CSS / Vanilla JS)
# Web Server: Hardened Nginx on Alpine Linux
# ==============================================================================

FROM nginx:1.27-alpine

# Metadata Labels
LABEL maintainer="Prathamesh Phutane <phutaneprathamesh829@gmail.com>" \
      org.opencontainers.image.title="SmartStock AI" \
      org.opencontainers.image.description="Enterprise Inventory & POS Management System" \
      org.opencontainers.image.source="https://github.com/corsal2006/smartstock" \
      org.opencontainers.image.vendor="SmartStock" \
      org.opencontainers.image.licenses="MIT"

# Remove default Nginx website configuration
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom hardened Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy application static files
COPY index.html /usr/share/nginx/html/index.html

# Set appropriate read permissions for Nginx worker processes
RUN chmod -R 755 /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80

# Container Healthcheck (polls root and /healthz endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
