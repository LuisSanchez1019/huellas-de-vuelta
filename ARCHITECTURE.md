# Arquitectura

```text
Persona usuaria → Dominio/DNS → Vercel (Next.js) → Supabase
                                                   ├─ PostgreSQL
                                                   ├─ Auth
                                                   └─ Storage (futuro)
```

El código vive en GitHub. Vercel despliega la aplicación y Supabase administra datos; V0.1 no requiere servidor propio.

## Aplicación

- Next.js App Router y React.
- TypeScript estricto y ESLint oficial de Next.js.
- CSS Modules por componente; estilos globales solo para tokens y base.

## Próxima integración: Supabase

Al comenzar V0.1.1 se instalará su SDK oficial. Variables previstas:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`NEXT_PUBLIC_` se limita a valores seguros para el navegador. Una clave `service_role` nunca se expone al cliente ni se sube al repositorio.

## Modelo inicial previsto

- `profiles`: extensión pública mínima de la cuenta autenticada.
- `pets`: mascota, responsable, especie, características y estado.

Estados: `at_home`, `lost`, `found`, `for_adoption`. Ambas tablas tendrán UUID, marcas de tiempo y Row Level Security. Cada persona solo gestionará sus propios datos; el contenido público se diseñará después con campos explícitos.

## Actividad y verificación diaria de Supabase

Vercel Cron llama una vez al día (`0 0 * * *`, es decir 00:00 UTC / 19:00 en Colombia) a `GET /api/cron/health` (definido en `vercel.json`). El endpoint exige `Authorization: Bearer <CRON_SECRET>` (nunca por query ni body), ejecuta la RPC `health_check()` con el cliente público del servidor (`serverPublic.ts`, rol `anon`) y responde `200` si Supabase contesta o `503` si falla (`401` si el secreto no coincide).

`health_check()` solo devuelve la hora del servidor: no toca tablas de negocio, Auth ni Storage.

Es un mecanismo de actividad y comprobación de disponibilidad; **no garantiza** que Supabase mantenga el proyecto activo indefinidamente (eso depende de las reglas y del plan vigentes de Supabase). Vercel Cron solo se ejecuta sobre el deployment de **producción**, y `CRON_SECRET` debe configurarse en Vercel.

## Correo transaccional

Dos sistemas de correo, separados a propósito:

- **Correos de Supabase Auth** (confirmación de registro, recuperación de contraseña): los sigue enviando Supabase directamente. Se configuran en el panel de Supabase (Authentication → Email Templates / SMTP Settings), no en este repositorio. Mientras no se configure un SMTP propio ahí, Supabase usa su SMTP de cortesía (límite bajo, no apto para producción).
- **Correos transaccionales de la aplicación** (futuras notificaciones de la propia plataforma, distintas de las de Auth): pasan por `sendEmail()` en `src/lib/email/sendEmail.ts`, que delega en un `EmailProvider` (`src/lib/email/types.ts`). Hoy solo existe `createSmtpEmailProvider()` (`src/lib/email/providers/smtp.ts`, usa `nodemailer`), pensado para **Brevo SMTP**. Cambiar de proveedor más adelante es implementar `EmailProvider` de nuevo, sin tocar quién llama a `sendEmail`. Es server-only: solo debe llamarse desde Route Handlers/Server Actions/Edge Functions, nunca desde un componente `"use client"`.

Variables server-only (sin `NEXT_PUBLIC_`, nunca llegan al navegador): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`. Ninguna tiene valor todavía; hay que crear las credenciales reales en Brevo y configurarlas en Vercel (Production), nunca en el repositorio.

Antes de enviar correo real en producción, el dominio de envío (`SMTP_FROM_EMAIL`) necesita, en el proveedor de DNS real del dominio: un registro **SPF** que autorice los servidores de Brevo, un registro **DKIM** (la clave exacta la genera Brevo al verificar el dominio — no se inventa aquí) y, idealmente, una política **DMARC**. Esto no se puede preparar con valores de ejemplo: se configura cuando exista el dominio y la cuenta Brevo reales.

## Identificación veterinaria, autorización e historia clínica (Bloque D)

**Regla: IDENTIFICACIÓN ≠ AUTORIZACIÓN.** Un QR, un código de barras, un `short_code`, un `public_id` o (a futuro) NFC solo *identifican* una placa (`qr_tags`). Nunca son una contraseña ni bastan para ver datos médicos. Alcance: solo mascotas de usuario (`pets`); `organization_pets` queda fuera y conserva su sistema (`pet_medical_*`).

**Una identificación, varias representaciones.** `qr_tags.short_code` es el identificador común: el QR lleva la URL `/m/<public_id>`, el código de barras (Code 128B, `src/lib/qr/barcode.ts`) se *deriva* del `short_code` (no se guarda en BD) y un NFC futuro resolvería al mismo tag. El método queda registrado como `qr | barcode | manual | nfc` (el `nfc` ya es válido en la BD, sin implementar).

**Capas (sin acoplar cámara con autorización):** `lib/scanner` (cámara + ZXing bajo demanda; solo devuelve texto) → `lib/vet/identification.ts` → `lib/vet/access.ts` → `lib/vet/medical.ts`. Un escáner nativo (Capacitor) o un lector HID reutilizan las tres capas y el mismo backend.

**Tres niveles de información**
1. *Público*: lo que ya muestra `get_public_pet` (sin cambios).
2. *Emergencia*: solo los ítems de `pet_medical_items` que el propietario marcó (`emergency_visible`, por defecto `false`). Motivo ≥ 10 caracteres, organización aprobada, límite de frecuencia, auditado y notificado al propietario. No crea grant ni muestra historia. **La revisión legal de este flujo es requisito antes de producción.**
3. *Historia clínica*: exige un grant (`vet_access_grants`) vigente con el permiso específico (`can_read_medical`, `can_create_consultation`, `can_add_diagnosis`, `can_add_treatment`, `can_generate_pdf`).

**Grants.** Vinculan mascota, propietario, organización y profesional (organización ≠ profesional, aunque hoy sea 1:1; el mapeo usuario→organización vive solo en `_vet_caller()`). Estados guardados: `pending | active | revoked | denied`. **`expired` no se guarda:** se deriva de `expires_at <= now()` en cada consulta, sin cron. Duraciones cerradas (`30m`, `1h`, `24h`); el servidor calcula `expires_at`. El propietario otorga un subconjunto de lo solicitado y puede revocar; cada RPC vuelve a leer el estado en BD, así que la revocación es inmediata. Solicitudes pendientes > 7 días se consideran vencidas.

**Historia clínica compartida.** Pertenece a la mascota: con `can_read_medical` se ven las consultas de todas las organizaciones (cada una conserva organización, profesional y fecha del servidor). `vet_consultations`, `vet_consultation_medications` y `vet_consultation_addenda` son **append-only** (sin UPDATE/DELETE por privilegios ni RPC); las correcciones son *addenda* de la organización autora. `client_request_id` UNIQUE hace idempotentes el doble clic y los reintentos.

**Auditoría** (`vet_access_audit`, append-only, sin contenido médico): `IDENTIFY`, `IDENTIFY_FAILED`, `ACCESS_REQUEST/GRANTED/DENIED/REVOKED`, `MEDICAL_VIEW` (compactada a 1 por minuto y grant), `MEDICAL_CREATE`, `MEDICAL_ADDENDUM`, `MEDICAL_PDF`, `EMERGENCY_ACCESS`, `EMERGENCY_FLAG_CHANGED`. La misma tabla alimenta el *rate limiting* en PostgreSQL (advisory locks por actor): identificación 30/10 min, 8 fallos/10 min y 300/día; solicitudes 10/h y 3/24 h por mascota y organización; emergencia 3/h por usuario, 10/día por organización y 3/día por mascota; PDF 10/h.

**Anti-enumeración.** Solo veterinarias aprobadas identifican. Códigos inexistentes, `available`, de mascotas de organización o archivadas devuelven la misma respuesta. Suspendido/reemplazado/anulado se distinguen sin devolver datos de mascota. El cliente nunca envía `pet_id`, `owner_id`, `organization_id`, `veterinarian_id` ni `expires_at`: se resuelven en servidor.

**PDF.** Se genera bajo demanda en el navegador (`lib/pdf/medicalHistory.ts`, jsPDF), sin Storage ni caché, tras `vet_pdf_authorize` / `owner_pdf_authorize` (autoriza, audita y limita). El envío por correo queda preparado para cuando el SMTP del Bloque A esté activo (no bloquea la descarga).

**Notificaciones.** Se reutiliza `notifications` (CHECK ampliado con `vet_access_requested`, `vet_access_decided`, `vet_access_revoked`, `vet_emergency_access`) y la misma campana/página; el texto nunca incluye datos médicos. La veterinaria usa `/veterinaria/notificaciones` (reexporta la misma página).

**Pruebas:** `npm test` (barcode ida y vuelta con ZXing, normalización HID, QR). Las pruebas contra la BD real se documentan en el informe del bloque.

**Eliminación de una mascota (política definitiva).** «La historia clínica pertenece al registro de la mascota y se elimina definitivamente cuando el propietario elimina la mascota. Huellas de Vuelta no conserva una copia histórica.» Un único `DELETE` transaccional sobre `pets` (protegido por RLS: solo el propietario) elimina en cascada: consultas, medicamentos, aclaraciones, accesos veterinarios (`vet_access_grants`), **toda su auditoría médica** (`vet_access_audit.pet_id` es `ON DELETE CASCADE`, incluidos los motivos de emergencia), el resumen médico y sus ítems, y los reportes de mascota perdida. Un trigger `BEFORE DELETE` libera sus placas QR vigentes (quedan `available`, con evento `unassigned`); antes de esta migración el `DELETE` fallaba con una placa activa (CHECK `qr_tags_linked_has_pet`). No hay tablas de archivo, soft-delete ni copia alguna. La foto se borra de Storage después (mejor esfuerzo). **Excepción vigente:** `plate_orders.owner_pet_id` sigue `RESTRICT` (registro comercial con datos de envío): una mascota con pedido de placa no se puede eliminar todavía. Solo quedan sin datos clínicos: el `uuid` de la mascota en `qr_tag_events` (bitácora técnica de la placa) y notificaciones que mencionan solo el nombre de la mascota.

**UX de eliminación y PDF.** `DeletePetDialog` (modal propio) ofrece «Descargar información y eliminar», «Eliminar sin descargar» y «Cancelar»; la descarga nunca es obligatoria. Con descarga, primero se genera el PDF «Información de mi mascota» (`lib/pdf/petInfo.ts`, reutiliza los bloques de `medicalHistory.ts`; datos vía `owner_pdf_authorize` + RPC/RLS del propietario) y **solo si eso sale bien** se elimina; si falla, no se elimina nada. El PDF solo existe en memoria del navegador: no va a Storage ni a la base de datos.

**Pendientes explícitos del Bloque D (no resueltos; no dar por cerrados):**
1. ~~Política de retención de la historia médica~~ — **DECIDIDA** (ver «Eliminación de una mascota»): no se conserva nada tras eliminar la mascota.
2. **Revisión legal del acceso de emergencia** (nivel 2). Que el propietario marque `emergency_visible` no da por resueltas las obligaciones legales; requisito antes de producción.
3. **Prueba física de la cámara.** Está probado el decodificador (ZXing con un flujo simulado de canvas) y los estados de error/permiso; falta probar el escáner en dispositivos reales (Android/iOS/webcam).
4. **Descarga PNG del código de barras.** Solo existe la salida SVG (`src/lib/qr/barcode.ts`); el PNG queda preparado pero sin implementar.
5. **Activación de SMTP para enviar el PDF por correo.** El envío por correo del PDF espera a que el SMTP del Bloque A (Brevo) esté configurado; la descarga local funciona sin él.

## Fecha de nacimiento, vacunación y saludo de cumpleaños (Bloque E)

Migración `20260927000000_pet_birthdate_vaccinations_birthday.sql` (aplicada en Supabase; aditiva).

- **Fecha de nacimiento** (`pets.birth_date`, `date`, opcional). Un trigger `SECURITY DEFINER` (`_pets_validate_birth_date`) rechaza fechas futuras o anteriores a 1980 (`BIRTH_DATE_INVALID`) y, si hay fecha, anula la edad aproximada (`age_value/age_unit`). **Nunca se guarda una edad fija:** la edad se calcula al mostrarla (`src/lib/pets/age.ts`, aritmética de calendario sobre cadenas `YYYY-MM-DD`, sin `Date`, sin desfase de zona horaria). Menos de 1 año se muestra en meses; menos de 1 mes, «Menos de 1 mes». No hay conversión a años humanos; solo la nota secundaria (`HUMAN_AGE_NOTE`).
- **Edad en RPC públicas** (`list_public_*`, `get_public_pet`, `vet_medical_overview`): se deriva con `_pet_age_value/_pet_age_unit` sin exponer `birth_date`.
- **Vacunación** (`pet_vaccinations`): `pet_id ... ON DELETE CASCADE` (verificado `confdeltype = 'c'`; no hay tabla de archivo/copia). Lectura por RLS solo del propietario; escritura solo por RPC (`pet_vaccination_add/update/delete`, comprueban `auth.uid()` y propiedad en el servidor). Índice único contra doble clic; máximo 200 por mascota. Misma privacidad que los datos médicos (no aparece en la vista pública ni en URLs).
- **Saludo de cumpleaños**: una sola vez por día y usuario, decidido en el servidor (`claim_birthday_greeting(p_local_date)` + tabla mínima `pet_birthday_greetings(user_id, last_greeted_on)`). El reclamo es un upsert atómico `where last_greeted_on < excluded` (solo gana una llamada aunque haya varias pestañas o dispositivos; mover el reloj hacia atrás no lo repite). Sin cumpleaños no se escribe nada. El 29-feb se celebra el 28-feb en años no bisiestos; el año de nacimiento da la edad y el propio día de nacimiento se excluye. No usa `localStorage`. Componente `BirthdayGreeting` montado en los layouts `dashboard` y `aliado`; una sola ventana para varias mascotas.
- **PDF «Información de mi mascota»**: incluye fecha de nacimiento, edad calculada al exportar y sección «Vacunación», además de la historia existente. Sigue generándose en el navegador, descargándose y **sin guardarse** en Storage ni en la base de datos.
- **Costo**: sin APIs, servicios, claves ni almacenamiento externos nuevos; solo Postgres/RLS/RPC ya existentes y jsPDF en el cliente.

**Notas y pendientes del Bloque E:**
1. La «fecha de hoy» del servidor para validar y derivar edades públicas es `America/Bogota` (constante `_pet_today()`); el cliente usa su fecha local. Un usuario muy al este de Colombia puede ver rechazada una fecha «de hoy» de madrugada. El reclamo del saludo acepta ±1 día respecto a UTC.
2. `vet_medical_overview` (vista veterinaria) no incluye vacunas todavía.
3. Prueba de interfaz autenticada (registrar/editar fecha, CRUD de vacunas, ventana de cumpleaños, PDF) pendiente de ejecución manual: no se automatizó porque exigiría escribir una contraseña en el formulario de acceso.
4. El nombre del archivo de migración (`20260927...`) puede no coincidir con la versión registrada por Supabase al aplicarla desde el MCP.

## Secretos

- `.env*` está ignorado por Git.
- Solo se compartirá `.env.example` sin valores reales.
- Las variables de producción se configurarán en Vercel.
- RLS será la protección de datos, no solo la interfaz.

Mapas, PostGIS, fotos, QR, mensajería, notificaciones, pagos, adopciones e IA se abordarán en etapas posteriores.
