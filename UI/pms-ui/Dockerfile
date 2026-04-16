# Serve pre-built production output with nginx
FROM nginx:alpine
COPY dist/pms-ui/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
