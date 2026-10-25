# PAG

Monorepo con backend en Spring Boot y frontend en HTML/CSS/JS puro, orquestado con Docker Compose.

## Estructura

```
pag-project/
├── backend/             # API REST (Spring Boot 3, Java 21, Maven)
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/
├── frontend/            # Sitio estático servido con Nginx
│   ├── Dockerfile
│   ├── index.html
│   ├── css/
│   └── js/
├── docker-compose.yml   # PostgreSQL + backend + frontend
├── .env.example
└── .gitignore
```

## Ejecutar todo con un solo comando

```bash
cp .env.example .env      # opcional, hay valores por defecto
docker compose up --build
```

| Servicio   | URL                                  |
|------------|--------------------------------------|
| Frontend   | http://localhost:3000                |
| Backend    | http://localhost:8080/api/health     |
| PostgreSQL | localhost:5432                       |

Para detener: `docker compose down` (agrega `-v` para borrar también los datos de la base).

## Desarrollo local sin Docker

Backend con H2 en memoria (no requiere PostgreSQL):

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```

Frontend: abre `frontend/index.html` con Live Server (puerto 5500) o cualquier servidor estático.

## CORS

Los controladores usan `@CrossOrigin` con los orígenes locales del frontend
(`localhost:3000`, `localhost:5500`). Si cambias el puerto o despliegas en otro dominio,
actualiza esa lista y la constante `API_BASE_URL` en `frontend/js/config.js`.

## Tickets de Jira cubiertos

- PAG-15 Inicializar carpetas del monorepo
- PAG-16 Crear API de Spring Boot con CORS
- PAG-17 Configurar Dockerfile y Docker Compose
