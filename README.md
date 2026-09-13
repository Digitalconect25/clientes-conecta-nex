# Clientes Conecta Nex

Plataforma web de gestion de clientes y generacion de contratos para Conecta Nex.

## Stack

- Frontend: React + Vite
- Backend: Vercel Serverless Functions
- Base de datos: Neon Postgres
- Hosting: Vercel
- Subdominio: clientes.conectanex.com

## Funcionalidades

- Gestion completa de clientes (CRUD)
- Catalogo de servicios editable
- Generacion automatica de 3 documentos legales:
  - Hoja de Encargo (con politica de privacidad)
  - Cesion de derechos y proteccion de datos
  - Contrato de prestacion de servicios
- Numeracion automatica de cliente (CL-2026-XXXX) y contrato (CN-2026-XXXX)
- Subida de archivos por cliente (logos, briefings, materiales)
- Firma digital del cliente con canvas
- Descarga PDF individual o ZIP con los 3 documentos
- Dashboard con metricas
- **Diseno de oferta y brief del agente de IA** (por prospecto, en `/diseno/:id`, se entra
  desde la ficha del prospecto en Captacion en frio):
  - Brief del agente: 8 bloques comunes (encargo, como habla, que sabe, con que se conecta,
    modelo economico, escalado a persona, cumplimiento y KPI) + las preguntas propias de
    cada sector (10 sectores en `src/lib/nichos.js`; anadir uno es editar esa lista).
    Avisa de los campos sin los que no se puede construir el agente.
  - Scorecard: puntua cada elemento de 1 a 5 en 4 criterios.
  - Reparto Front Offer / Back Offer con conteo y suma por columna.
  - Mapa de avatares por anillo de afinidad (dolor, sueno, que le hace decir NO y que SI).
  - **No es una isla**: el brief entra en el prompt de la propuesta con IA (`generar_ia`) y
    en el del email de captacion individual; el boton "Crear propuesta con esto" vuelca los
    elementos como lineas de propuesta ordenados por scorecard; y al aceptar la propuesta el
    diseno pasa al cliente para que no quede huerfano.
  - Tabla `diseno_oferta` (migracion v21). Se crea sola al primer uso.
- **Fichas de implementacion del agente IA de WhatsApp** (pantalla `Fichas`):
  el cuestionario tecnico que rellena y firma el cliente antes de montarle el
  agente. Son datos DISTINTOS de la ficha de cliente (alta y contrato), por eso
  van en su propia tabla y no se mezclan.
  - 13 apartados (datos, negocio, oferta, conversacion, operaciones, logistica,
    limites, sistemas, proteccion de datos, privacidad, seguridad, entrenamiento
    y autorizacion). Se eligen al crearla; estan en `src/lib/fichas.js`.
  - Al crearla nace su **enlace privado**, asi que se puede copiar y mandar por
    WhatsApp sin pasar por el email. "Enviar" reutiliza ese mismo enlace.
  - El cliente lo abre sin contrasena, lo rellena por apartados (se guarda solo
    mientras escribe) y **lo firma**: dibujo + codigo de un solo uso por email +
    hash SHA-256, IP y fecha de servidor como evidencia.
  - El codigo de firma va SIEMPRE al email que registro la agencia, nunca al que
    teclee quien abre el enlace: si no, cualquiera con el enlace podria pedirselo
    a su propio correo y firmar en nombre del cliente.
  - Al firmar recibes un email con los datos y la ficha firmada adjunta, y un
    segundo codigo para dar tu validacion.
  - Tabla `fichas` (migracion v22). Se crea sola al primer uso.

## Despliegue

### 1. Base de datos

Ya creada en Neon (proyecto "Clientes Conecta Nex").

`db/schema.sql` es el esquema completo y al dia: las 24 tablas con las columnas
que fueron anadiendo las migraciones v2 a v22 ya integradas. Se puede pegar
entero en el SQL Editor de Neon tantas veces como haga falta: va todo con
IF NOT EXISTS, no hay ni un DROP, y lleva al final un bloque de ALTER que pone
al dia una base que ya existia (un CREATE TABLE IF NOT EXISTS no anade columnas
nuevas a una tabla que ya esta creada; esos ALTER si).

Las migraciones `db/migration_v*.sql` se quedan como historial. Al anadir una
tabla nueva, crea su migracion Y refleja la tabla tambien en `schema.sql`, o el
esquema vuelve a quedarse atras.

### 2. Variables de entorno en Vercel

Configurar en Vercel Settings -> Environment Variables:

Imprescindibles:

- `DATABASE_URL`: connection string de Neon (con la contrasena ya rotada)
- `APP_PASSWORD`: contrasena para entrar a la app (eliges la que quieras)

**Correo (sin esto no se puede firmar nada).** `enviarEmail` mira estas dos y, si
falta cualquiera, no envia: ni el enlace de la ficha, ni el codigo de firma, ni el
aviso de que el cliente ha firmado. Y como el codigo de firma va por email, sin
ellas el cliente NO PUEDE FIRMAR ni la ficha ni los contratos:

- `RESEND_API_KEY`: API key de resend.com
- `RESEND_FROM_EMAIL`: remitente verificado en Resend (ej. `hola@conectanex.com`)
- `RESEND_FROM_NAME`: nombre visible del remitente (por defecto "Conecta NEX")
- `AGENCY_EMAIL`: donde recibes los avisos (ficha firmada, con los datos y el
  documento adjunto). Si no la pones, usa el email de "Mis datos" del emisor.
- `REPLY_TO_EMAIL`: direccion a la que responde el cliente
- `PUBLIC_BASE_URL`: base de los enlaces publicos (por defecto
  `https://clientes.conectanex.com`). Si esta mal, los enlaces que recibe el
  cliente no abren.

Otras:

- `ACCESS_ENCRYPTION_KEY`: hex de 64 caracteres para cifrar las contrasenas de
  los accesos de cliente. **Si la cambias, lo ya guardado no se puede descifrar.**
- `CRON_SECRET`: para las tareas programadas
- `GROQ_API_KEY`: redaccion con IA (propuestas y captacion)

### 3. Deploy

```
git push origin main
```

Vercel despliega automaticamente.

### 4. Subdominio

En Hostinger DNS de conectanex.com, anadir registro CNAME:

- Nombre: `clientes`
- Valor: `cname.vercel-dns.com`

En Vercel Settings -> Domains, anadir `clientes.conectanex.com`.

## Desarrollo local

```
npm install
npm run dev
```

App en http://localhost:3000

Crear archivo `.env.local` con:

```
DATABASE_URL=postgresql://...
APP_PASSWORD=tu-password
```
