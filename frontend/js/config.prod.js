// Configuracion de PRODUCCION (PAG-25).
// docker-compose.prod.yml monta este archivo como js/config.js dentro del
// contenedor del frontend. La cadena vacia hace que las peticiones sean
// RELATIVAS (/api/students): pasan por Nginx hacia el backend.
const API_BASE_URL = "";
