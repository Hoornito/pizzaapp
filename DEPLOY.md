# Deploy — Pizzería Cambalache (AWS Lightsail + Docker + Caddy)

Guía para levantar la app en el VPS de Lightsail (Ubuntu 24.04).
Todo corre en Docker: **app** (Next.js) + **postgres** + **redis** + **caddy** (HTTPS automático).

- **Dominio:** `pizzacambalache.com.ar`
- **IP estática:** `18.229.240.43`

---

## 0. Requisitos previos (en la consola de Lightsail)

- [x] Instancia Ubuntu 24.04, dual-stack, 2 GB RAM.
- [x] IP estática adjunta → `18.229.240.43`.
- [ ] Firewall (Networking): puertos **80** y **443** abiertos, source = cualquiera (`0.0.0.0/0` y `::/0`).
- [ ] DNS: registros **A** `@` y `www` → `18.229.240.43`, y nameservers de Lightsail cargados en nic.ar.

> Verificá que el DNS ya propague antes de levantar Caddy (si no, no podrá sacar el certificado):
> ```bash
> dig +short pizzacambalache.com.ar   # debe devolver 18.229.240.43
> ```

---

## 1. Instalar Docker en el servidor (una sola vez)

Conectado por SSH:

```bash
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# cerrá la sesión SSH y volvé a entrar para que tome el grupo docker
```

Verificá:
```bash
docker --version && docker compose version
```

---

## 2. Subir el código al servidor

**Opción A — Git (recomendado):**
```bash
git clone <URL_DE_TU_REPO> pizzaapp
cd pizzaapp
```

**Opción B — sin repo remoto:** comprimí la carpeta del proyecto en tu PC (sin `node_modules` ni `.next`) y subila con `scp`.

---

## 3. Crear el `.env` de producción

```bash
cp .env.prod.example .env
nano .env
```

Completá **todos** los `CAMBIAR_...`:
- Generá cada secret con: `openssl rand -base64 32`
- La contraseña de Postgres debe ser **igual** en `POSTGRES_PASSWORD` y dentro de `DATABASE_URL`.
- Lo mismo para Redis (`REDIS_PASSWORD` y `REDIS_URL`).

---

## 4. Build + levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

La primera vez tarda unos minutos (compila Next.js). Seguí los logs:
```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy   # acá se ve cuando saca el certificado HTTPS
```

---

## 5. Migrar la base y cargar datos iniciales (una sola vez)

Con los contenedores arriba:
```bash
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

---

## 6. Probar

Abrí **https://pizzacambalache.com.ar** — debería cargar con candado (HTTPS válido).

---

## Comandos útiles

```bash
# Estado de los contenedores
docker compose -f docker-compose.prod.yml ps

# Reiniciar solo la app
docker compose -f docker-compose.prod.yml restart app

# Actualizar tras cambios de código (git pull + rebuild)
git pull
docker compose -f docker-compose.prod.yml up -d --build app

# Backup de la base
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U pizzaapp pizzaapp > backup_$(date +%F).sql
```

---

## Después del deploy (integraciones externas)

- **Google OAuth:** agregá `https://pizzacambalache.com.ar/api/auth/callback/google` a las URIs de redirección autorizadas.
- **WhatsApp/Meta:** Callback URL del webhook → `https://pizzacambalache.com.ar/api/whatsapp/webhook`, verify token = el de `.env`.
- **Estación de impresión (QZ Tray):** abrir `https://pizzacambalache.com.ar/admin/print-station` en la PC de la pizzería.
