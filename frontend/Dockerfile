FROM nginx:1.27-alpine

# Sitio estático (HTML/CSS/JS puro)
COPY . /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
