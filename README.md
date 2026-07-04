# SFL · FIHNEC — Sistema de Inscripción a Seminarios

Sistema web para el **Seminario para la Formación de Líderes (SFL)** de FIHNEC (Fraternidad Internacional
de Hombres de Negocios del Evangelio Completo). Administra la inscripción **secuencial y obligatoria** a los
cuatro niveles del seminario, valida elegibilidad por DNI, y ofrece un panel administrativo con estadísticas,
gestión de eventos y control de usuarios.

```
sfl-app/
├── backend/     API en Node.js + Express + PostgreSQL
└── frontend/    Sitio web en React (Vite) + Tailwind CSS
```

## Qué incluye

- **Flujo público de inscripción**: formulario completo en el Nivel I; solo DNI en los Niveles II, III y IV,
  con validación automática de que el nivel anterior fue completado.
- **Panel administrativo** con dos roles:
  - `admin`: control total (crear/editar/eliminar participantes, configurar eventos, gestionar usuarios).
  - `consulta`: solo lectura (ver participantes y estadísticas).
- **Gestión de eventos**: fecha, hora, lugar, fecha/hora tope de registro y bloqueo manual, por cada nivel.
- **Estadísticas y gráficas**: total de inscritos por nivel, embudo de avance, inscripciones por día, por
  zona, por departamento, por capítulo. Exportación a CSV.
- **Tus 500 registros existentes ya están importados**: se cargó tu archivo `Base_de_Datos_Actualizada_SFL.xlsx`
  (488 participantes válidos; 5 filas sin DNI y 7 filas duplicadas del archivo original se omitieron
  automáticamente — puedes revisarlas y agregarlas manualmente desde el panel si lo deseas).

## Usuarios de acceso creados (¡cámbialos apenas entres!)

| Rol       | Correo                  | Contraseña       |
|-----------|--------------------------|------------------|
| admin     | admin@fihnec.org         | Sfl2026Admin!    |
| consulta  | consulta@fihnec.org      | Sfl2026Consulta! |

---

## 1. Cómo probar el sitio en tu computadora

### Requisitos
- Node.js 20 o superior
- PostgreSQL (local, o una base gratuita en la nube — ver sección de despliegue)

### Backend
```bash
cd backend
cp .env.example .env        # edita DATABASE_URL con tu conexión de Postgres
npm install
npm run migrate             # crea las tablas y los 4 eventos base
npm run import-excel /ruta/a/tu/Base_de_Datos_Actualizada_SFL.xlsx   # ya lo hicimos una vez, opcional
node scripts/create_admin.js "Tu Nombre" tu@correo.com tuContraseña admin
npm run dev                 # http://localhost:4000
```

### Frontend
```bash
cd frontend
cp .env.example .env.local  # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                 # http://localhost:5173
```

---

## 2. Despliegue con hosting 100% gratuito (sin dominio propio por ahora)

Como acordamos, usaremos un subdominio gratuito (por ejemplo `sfl-fihnec.vercel.app`). Más adelante, si
compras un dominio propio, solo tendrás que apuntarlo — no requiere volver a programar nada.

**Piezas gratuitas recomendadas:**
1. **Neon** (https://neon.tech) → base de datos PostgreSQL gratuita y persistente.
2. **Render** (https://render.com) → hosting gratuito del backend (API).
3. **Vercel** (https://vercel.com) → hosting gratuito del frontend.

### Paso 1 — Base de datos (Neon)
1. Crea una cuenta gratuita en neon.tech y un proyecto nuevo.
2. Copia el `DATABASE_URL` que te dan (empieza con `postgres://...`).
3. Desde tu computadora, con ese `DATABASE_URL` en `backend/.env`, corre:
   ```bash
   npm run migrate
   npm run import-excel /ruta/a/Base_de_Datos_Actualizada_SFL.xlsx
   node scripts/create_admin.js "Tu Nombre" tu@correo.com tuContraseñaSegura admin
   ```
   Esto deja la base ya poblada con tus 500 registros en la nube.

### Paso 2 — Backend (Render)
1. Sube la carpeta `backend/` a un repositorio en GitHub.
2. En Render: **New → Web Service**, conecta el repositorio.
3. Build command: `npm install` — Start command: `npm start`.
4. Variables de entorno: `DATABASE_URL` (la de Neon), `JWT_SECRET` (una clave larga y aleatoria),
   `CORS_ORIGIN` (la URL de tu frontend en Vercel, la agregas después del paso 3).
5. Plan **Free**. Al desplegar tendrás una URL como `https://sfl-fihnec-api.onrender.com`.
   > Nota: en el plan gratuito, Render "duerme" el servicio tras inactividad y tarda unos segundos en
   > responder la primera vez. Es normal y no afecta los datos (que viven en Neon, no en Render).

### Paso 3 — Frontend (Vercel)
1. Sube la carpeta `frontend/` a un repositorio en GitHub (puede ser el mismo, en una subcarpeta).
2. En Vercel: **Add New → Project**, conecta el repositorio, indica `frontend` como carpeta raíz si aplica.
3. Variable de entorno: `VITE_API_URL` = `https://sfl-fihnec-api.onrender.com/api` (la URL de Render + `/api`).
4. Deploy. Vercel te da una URL gratuita como `https://sfl-fihnec.vercel.app`.
5. Vuelve a Render y actualiza `CORS_ORIGIN` con esa URL exacta de Vercel.

### Paso 4 (más adelante) — Conectar un dominio propio
Cuando compres un dominio (Namecheap, GoDaddy, etc., normalmente $10–15/año), en Vercel vas a
**Project → Settings → Domains**, agregas tu dominio y sigues las instrucciones de DNS (agregar un registro
tipo CNAME/A en tu proveedor). El hosting sigue siendo gratuito; solo el dominio tiene costo.

---

## 3. Seguridad — antes de usarlo con datos reales

- [ ] Cambia las contraseñas de `admin@fihnec.org` y `consulta@fihnec.org`.
- [ ] Genera un `JWT_SECRET` largo y aleatorio distinto al de ejemplo.
- [ ] Revisa los 12 registros omitidos en la importación (sin DNI o duplicados) y decide si deben
      agregarse manualmente.
- [ ] Define las fechas y horas tope de cada nivel desde **Panel → Eventos**.

## 4. Próximos ajustes

Este es un sistema funcional de base — dijiste que iremos afinando detalles. Algunas ideas para siguientes
iteraciones: notificaciones por correo/WhatsApp al inscribirse, código QR de confirmación, carga de
comprobantes de pago, reportes en PDF, registro de asistencia el día del evento, entre otros. Cuéntame
cuál quieres primero y lo construimos sobre esta misma base.
