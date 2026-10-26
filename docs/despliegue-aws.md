# Guía de despliegue en AWS (PAG-25)

Cómo publicar el proyecto PAG (frontend + backend Spring Boot + PostgreSQL) en una instancia **EC2** de AWS usando **Docker Compose**.

> Esta guía se escribió **antes** de desplegar. Los pasos de AWS y Docker están basados en la documentación oficial y en el `docker-compose.yml` real del proyecto, pero los comandos de la instancia no se han ejecutado todavía en tu cuenta. Si algún paso te da un resultado distinto, está la tabla de problemas del [punto 12](#12-problemas-frecuentes).

---

## 1. Qué vamos a construir

```
Internet
   │  http://<IP-elástica>   (puerto 80)
   ▼
┌──────────────────────────── Instancia EC2 (Amazon Linux 2023) ───────────────────────────┐
│                                                                                           │
│   ┌──────────────┐   /api/*    ┌──────────────┐     ┌──────────────┐                      │
│   │  frontend    │ ──────────► │   backend    │ ──► │      db      │                      │
│   │ Nginx :80    │             │ Spring :8080 │     │ Postgres 5432│                      │
│   │ HTML/CSS/JS  │             │ (interno)    │     │ (interno)    │                      │
│   └──────────────┘             └──────────────┘     └──────┬───────┘                      │
│        ▲ único puerto público                              │                              │
│                                                     volumen postgres-data (disco EBS)     │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

Decisiones importantes:

| Decisión | Por qué |
|---|---|
| **EC2 + Docker Compose** (no App Runner) | Tu proyecto son **3 contenedores** que se hablan entre sí. App Runner ejecuta **un** servicio por contenedor y necesitarías además RDS para la base de datos y otro servicio para el frontend. EC2 permite ejecutar exactamente el `docker compose up -d` que pide el ticket. |
| **Solo el puerto 80 es público** | La base de datos (5432) y el backend (8080) quedan **dentro** de la red de Docker. Nadie de internet puede llegar a ellos. |
| **Nginx reenvía `/api/*` al backend** | El navegador habla con **un solo origen** (`http://tu-ip`). No hay CORS, y no hace falta cambiar el código Java. |
| **Configuración distinta para producción** | `docker-compose.prod.yml`, `deploy/nginx.conf` y `frontend/js/config.prod.js` son archivos **nuevos**. Tu entorno local (`docker-compose.yml`, `config.js`) **no cambia**. |

---

## 2. Qué archivos trae el ticket PAG-25

| Archivo | Para qué sirve |
|---|---|
| `docker-compose.prod.yml` | Compose de producción: solo el frontend publica puerto; la contraseña de la BD es obligatoria. |
| `deploy/nginx.conf` | Nginx: sirve el sitio y reenvía `/api/` al backend. |
| `frontend/js/config.prod.js` | `API_BASE_URL = ""` → las peticiones son relativas (`/api/students`). Compose lo monta como `js/config.js`. |
| `.env.example` (ya existe) | Se **amplía** con las variables de producción. La copia real `.env` **no** se sube a Git (ya está en `.gitignore`). |
| `docs/despliegue-aws.md` | Esta guía. |

### Variables que debe tener `.env.example`

Añade este bloque **al final** de tu `.env.example` actual (las tres primeras variables ya deberían estar):

```ini
# ---------- Produccion (docker-compose.prod.yml) ----------
# En el servidor: cp .env.example .env  y cambia los valores.
# POSTGRES_PASSWORD es obligatoria y debe ser larga y unica (minimo 16 caracteres).
# POSTGRES_DB=pagdb
# POSTGRES_USER=paguser
# POSTGRES_PASSWORD=CAMBIA_ESTA_CLAVE

# Puerto publico del frontend: 80 en AWS, 8081 para probar en tu PC.
HTTP_PORT=80

# Solo si publicas las imagenes en Docker Hub / ECR (opcion B):
# resultado <IMAGE_PREFIX>-backend:<IMAGE_TAG> y <IMAGE_PREFIX>-frontend:<IMAGE_TAG>
IMAGE_PREFIX=pag
IMAGE_TAG=latest
```

> El `.env` real (con claves) vive solo en tu PC y en el servidor, nunca en Git.

---

## 3. Antes de empezar: prueba todo en tu PC

**Nunca despliegues algo que no hayas probado localmente.** Primero apaga el entorno de desarrollo (usa los mismos nombres de contenedor): `docker compose down`. Con Docker Desktop abierto, en la raíz del proyecto (PowerShell):

```powershell
Copy-Item .env.example .env
notepad .env        # cambia POSTGRES_PASSWORD y añade HTTP_PORT=8081
docker compose -f docker-compose.prod.yml up -d --build
```

Abre `http://localhost:8081`. Debes ver la Página 1 y poder crear un estudiante. Comprobaciones:

```powershell
docker compose -f docker-compose.prod.yml ps
curl.exe http://localhost:8081/api/health        # debe responder con el estado del backend
curl.exe http://localhost:8080/api/health        # debe FALLAR: el backend ya no es público
```

Para apagarlo: `docker compose -f docker-compose.prod.yml down` (agrega `-v` solo si quieres **borrar** la base de datos).

> Si esto funciona en tu PC, en AWS funcionará igual; lo único que cambia es dónde corre.

---

## 4. Crear la cuenta y controlar el gasto

1. Crea la cuenta en <https://aws.amazon.com/free>. Pide tarjeta de crédito.
2. **Elige el plan gratuito ("Free plan")** cuando te lo ofrezca. Según el anuncio oficial de AWS, las cuentas nuevas reciben hasta **200 USD en créditos** (100 al registrarte y hasta 100 más al usar servicios como EC2), y el plan gratuito dura **6 meses o hasta agotar los créditos**, lo que ocurra primero.
3. **Qué no he podido verificar:** qué tipos de instancia consumen esos créditos y qué pasa con tus recursos cuando el plan termina. Míralo tú en la consola: **Billing and Cost Management → Free Tier**.
4. **Crea un presupuesto de alerta** (hazlo hoy): *Billing → Budgets → Create budget → Cost budget* con un límite bajo (por ejemplo 5 USD) y tu correo. Es la protección contra cobros inesperados.
5. **Seguridad de la cuenta:** activa MFA en el usuario raíz (*IAM → Add MFA*) y no uses el usuario raíz para el día a día.

---

## 5. Crear la instancia EC2

En la consola de AWS, arriba a la derecha elige una región cercana (por ejemplo **us-east-1** o **sa-east-1**; la de EE. UU. suele ser más barata). Luego *EC2 → Launch instance*:

| Campo | Valor |
|---|---|
| Name | `pag-server` |
| AMI | **Amazon Linux 2023** (Free tier eligible) |
| Tipo de instancia | **`t3.small` (2 GB RAM)** recomendado. Una `t3.micro` (1 GB) *puede* funcionar, pero Spring Boot + PostgreSQL van justos y **compilar el backend dentro de ella suele fallar por falta de memoria** (ver [swap](#62-memoria-swap-solo-si-usas-1-gb)). |
| Key pair | *Create new key pair* → nombre `pag-key`, tipo **RSA**, formato **`.pem`**. Se descarga **una sola vez**: guárdalo bien. |
| Network → Firewall | *Create security group* (ver tabla abajo) |
| Storage | **20 GiB gp3** (el valor por defecto de 8 GiB se llena con imágenes Docker) |

**Reglas del Security Group** (es el cortafuegos de la instancia):

| Tipo | Puerto | Origen | Para qué |
|---|---|---|---|
| SSH | 22 | **My IP** (solo tu IP) | Administrar el servidor |
| HTTP | 80 | `0.0.0.0/0` | Que cualquiera vea la web |
| HTTPS | 443 | `0.0.0.0/0` | Solo si activas HTTPS ([punto 9](#9-https-opcional-requiere-dominio)) |

> ❌ **Nunca** abras el 5432 (PostgreSQL) ni el 8080 (backend) a `0.0.0.0/0`. Con `docker-compose.prod.yml` ni siquiera se publican, pero el Security Group es la segunda barrera.
>
> Si tu IP de casa cambia, no podrás entrar por SSH: edita la regla y vuelve a poner *My IP*.

**IP fija (Elastic IP):** *EC2 → Elastic IPs → Allocate → Associate* a `pag-server`. Sin esto, la IP pública cambia cada vez que apagas y enciendes la instancia. AWS puede cobrar por IPv4 públicas, y una Elastic IP **sin asociar** sigue cobrándose: revisa *Billing* y libérala al terminar (punto 11).

---

## 6. Preparar el servidor

### 6.1 Conectarte por SSH

Desde PowerShell (Windows 10/11 trae `ssh`):

```powershell
# El .pem debe ser solo tuyo. Ajusta la ruta donde lo guardaste.
$pem = "$HOME\Downloads\pag-key.pem"
icacls $pem /inheritance:r
icacls $pem /grant:r "$($env:USERNAME):(R)"

ssh -i $pem ec2-user@<TU-IP-ELASTICA>
```

El usuario de Amazon Linux es `ec2-user`. La primera vez responde `yes` a la huella.

### 6.2 Memoria swap (solo si usas 1 GB)

Si elegiste `t3.micro`, crea 2 GB de swap **antes** de compilar:

```bash
sudo dd if=/dev/zero of=/swapfile bs=128M count=16
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h        # debe mostrar Swap: 2.0Gi
```

### 6.3 Instalar Docker y Git

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

**Cierra la sesión SSH y vuelve a entrar** (para que el grupo `docker` se aplique). Comprueba:

```bash
docker info | head -5
```

### 6.4 Instalar el plugin Docker Compose

```bash
mkdir -p ~/.docker/cli-plugins
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
docker compose version
```

Si `COMPOSE_VERSION` queda vacío (límite de la API de GitHub), fíjalo a mano con una versión estable que veas en <https://github.com/docker/compose/releases> (con el formato `vX.Y.Z`) y repite el `curl`.

---

## 7. Desplegar la aplicación

Hay dos formas. **Empieza por la A** (más simple). La B es la que menciona el ticket ("subir las imágenes") y sirve cuando quieras no compilar en el servidor.

### Opción A — Clonar el repositorio y construir en el servidor

El repositorio debe tener ya mergeadas las ramas de PAG-25 en `dev`/`main`. Si es **privado**, crea un *Personal Access Token* de GitHub (solo lectura del repositorio) y úsalo como contraseña al clonar.

```bash
cd ~
git clone https://github.com/<TU-USUARIO>/<TU-REPO>.git pag
cd pag
git checkout dev            # o la rama que quieras publicar

cp .env.example .env
nano .env        # cambia POSTGRES_PASSWORD; deja HTTP_PORT=80
chmod 600 .env

docker compose -f docker-compose.prod.yml up -d --build
```

La primera compilación del backend tarda varios minutos (descarga las dependencias de Maven). Sigue el progreso con:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

Cuando veas `Started PagApplication`, pulsa `Ctrl+C` (los contenedores siguen vivos).

### Opción B — Construir fuera y subir imágenes a Docker Hub

Útil si tu instancia es pequeña. **En tu PC:**

```powershell
docker login
# IMAGE_PREFIX = tu-usuario-dockerhub/pag  →  imágenes tu-usuario/pag-backend y tu-usuario/pag-frontend
$env:IMAGE_PREFIX = "tu-usuario/pag"
$env:POSTGRES_PASSWORD = "solo-para-construir"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml push backend frontend
```

**En el servidor** (necesita igualmente el repositorio para `docker-compose.prod.yml`, `deploy/` y `config.prod.js`; no compila nada):

```bash
cd ~/pag
nano .env            # añade IMAGE_PREFIX=tu-usuario/pag
docker compose -f docker-compose.prod.yml pull backend frontend
docker compose -f docker-compose.prod.yml up -d --no-build
```

> Si las imágenes son privadas en Docker Hub, haz `docker login` también en el servidor. Si prefieres el registro de AWS (**ECR**), el flujo es el mismo cambiando `IMAGE_PREFIX` por `<cuenta>.dkr.ecr.<región>.amazonaws.com/pag` y autenticando con `aws ecr get-login-password`. Pide ayuda cuando llegues a ese punto.

### Verificación

```bash
docker compose -f docker-compose.prod.yml ps     # los 3 en "Up", db "healthy"
curl -s http://localhost/api/health                                         # respuesta del backend
curl -s http://localhost/api/students                                       # []
```

Desde **tu PC**, abre `http://<TU-IP-ELASTICA>`:

- [ ] Se ve la Página 1 y puedes crear, editar y borrar un estudiante.
- [ ] Recargas la página y el estudiante sigue ahí (la base de datos persiste).
- [ ] La Página 2 carga personajes de Rick & Morty y la Pokédex.
- [ ] Desde tu celular (con datos móviles, no con tu Wi-Fi) también abre.
- [ ] `http://<TU-IP-ELASTICA>:8080` y `:5432` **no** responden (correcto).

---

## 8. Que arranque solo y sobreviva a reinicios

- Los servicios ya tienen `restart: unless-stopped`: se levantan solos si el contenedor falla o si la instancia se reinicia, porque Docker arranca con el sistema (`systemctl enable docker`).
- Prueba el reinicio: `sudo reboot`, espera 1-2 minutos, vuelve a entrar por SSH y ejecuta `docker compose ... ps`.
- Los datos viven en el volumen `postgres-data`. Se conserva con `down`, `up`, `--build` y reinicios; **solo se borra con `down -v`** o eliminando la instancia.

---

## 9. HTTPS (opcional, requiere dominio)

Con una IP sin dominio **no se puede** tener un certificado válido. Si registras un dominio (o usas uno gratuito tipo DuckDNS):

1. Crea un registro DNS **A** → tu Elastic IP.
2. Abre el puerto **443** en el Security Group.
3. La forma más corta es poner **Caddy** delante, que obtiene y renueva el certificado solo. Crea un `Caddyfile` con `tu-dominio.com { reverse_proxy frontend:80 }`, añade un servicio `caddy` al compose (puertos 80 y 443) y **quita** el `ports` del frontend.

Es un cambio de 15 líneas, pero déjalo para cuando el despliegue HTTP funcione. Si lo quieres, lo preparamos en un ticket aparte.

---

## 10. Operación diaria

### Publicar una nueva versión

```bash
cd ~/pag
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f           # limpia imágenes viejas y libera disco
```

(Con la opción B: `pull` en lugar de `--build`.)

### Ver estado y logs

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 backend
docker stats --no-stream        # memoria y CPU por contenedor
df -h /                         # espacio en disco
```

### Copia de seguridad de la base de datos

```bash
mkdir -p ~/backups
docker exec pag-db pg_dump -U paguser pagdb > ~/backups/pag-$(date +%F).sql
```

Restaurar:

```bash
cat ~/backups/pag-AAAA-MM-DD.sql | docker exec -i pag-db psql -U paguser -d pagdb
```

Descarga el respaldo a tu PC (desde PowerShell): `scp -i $pem ec2-user@<IP>:~/backups/*.sql .`

### Cambiar la contraseña de PostgreSQL

La contraseña solo se aplica **al crear** el volumen por primera vez. Si cambias `POSTGRES_PASSWORD` después, el backend dejará de conectar. Cámbiala también dentro de la BD:
`docker exec -it pag-db psql -U paguser -d pagdb -c "ALTER USER paguser PASSWORD 'nueva';"` y luego edita `.env` y reinicia con `up -d`.

---

## 11. Apagar y evitar cobros

| Acción | Efecto |
|---|---|
| **Stop** instancia | Detiene el cómputo. El disco EBS y la Elastic IP **siguen cobrando**. Los datos se conservan. |
| **Terminate** instancia | Borra la instancia y su disco (**y los datos**). Haz antes el respaldo. |
| **Release** Elastic IP | Obligatorio después de terminar, si no, sigue cobrando. |

Al terminar el proyecto: respaldo → *Terminate* → *Release Elastic IP* → revisa *Billing* al día siguiente.

---

## 12. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ssh: Connection timed out` | Tu IP cambió o el Security Group no permite el 22 | Edita la regla SSH → *My IP* |
| `Permission denied (publickey)` | Usuario o `.pem` incorrecto | Usuario `ec2-user`; revisa la ruta y los permisos del `.pem` |
| `permission denied ... docker.sock` | No reiniciaste la sesión tras `usermod` | Sal y entra de nuevo por SSH |
| La web no abre desde internet | Falta la regla del puerto 80 o `HTTP_PORT` mal | Revisa el Security Group y `docker ... ps` |
| El build del backend termina con `Killed` / exit 137 | Sin memoria (1 GB) | Crea swap ([6.2](#62-memoria-swap-solo-si-usas-1-gb)), usa `t3.small` o la opción B |
| `no space left on device` | Disco de 8 GiB lleno | Amplía el volumen EBS o `docker system prune -af` |
| La página carga pero no hay estudiantes / error de red | Nginx no llega al backend | `logs backend`; confirma que `config.js` dentro del contenedor tiene `API_BASE_URL = ""`: `docker exec pag-frontend cat /usr/share/nginx/html/js/config.js` |
| `502 Bad Gateway` en `/api/` | El backend aún arranca o se cayó | Espera 30 s; `logs backend` |
| `403 Invalid CORS request` | Spring no ve la petición como del mismo origen | Comprueba que `deploy/nginx.conf` conserva `proxy_set_header Host $http_host;` |
| El backend reinicia en bucle | Credenciales de BD no coinciden con el volumen | Ver "Cambiar la contraseña" (punto 10) |
| `required variable POSTGRES_PASSWORD is missing` | Falta la clave en `.env` o no estás en la carpeta del proyecto | Ejecuta el comando desde la raíz del repositorio y revisa que `.env` tenga `POSTGRES_PASSWORD` |

---

## 13. Lista de seguridad (revisar antes de entregar)

- [ ] `.env` **no** está en Git (`git check-ignore .env` imprime el nombre).
- [ ] `POSTGRES_PASSWORD` es larga y distinta a la de desarrollo.
- [ ] El Security Group abre solo 22 (tu IP), 80 y, si aplica, 443.
- [ ] Ningún puerto 5432 / 8080 accesible desde fuera.
- [ ] El archivo `.pem` no está dentro del repositorio.
- [ ] MFA activo en el usuario raíz y presupuesto de alerta creado.
- [ ] Hay al menos un respaldo `pg_dump` descargado.

---

## 14. Resumen de comandos del día del despliegue

```bash
# (1) En el servidor, una sola vez
sudo dnf update -y && sudo dnf install -y docker git
sudo systemctl enable --now docker && sudo usermod -aG docker ec2-user      # reconectar SSH
# + plugin compose (punto 6.4)

# (2) Desplegar
git clone https://github.com/<USUARIO>/<REPO>.git pag && cd pag && git checkout dev
cp .env.example .env && nano .env && chmod 600 .env
docker compose -f docker-compose.prod.yml up -d --build

# (3) Verificar
docker compose -f docker-compose.prod.yml ps
curl -s http://localhost/api/health
```
