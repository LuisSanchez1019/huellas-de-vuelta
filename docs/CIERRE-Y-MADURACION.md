# Cierre y maduración — estado y pendientes

Documento de referencia del cierre del proyecto. Recoge lo que quedó conectado a
datos reales, lo que necesita estructura de base de datos que todavía no existe y
lo que hay que activar manualmente en el panel de Supabase (no accesible por
código).

---

## 1. Módulos que necesitan estructura de base de datos nueva

### 1.1 Fundación → Buscar hogar (`/fundacion/buscar-hogar`)

**Qué existe hoy**

- `organization_pets.needs_home` (boolean). La fundación marca/desmarca cada
  mascota como "busca hogar" desde `/fundacion/mascotas` (componente
  `BulkPetTable`, filtro "Buscan hogar").
- Lectura pública: política `org_pets_public_read` expone las filas con
  `needs_home OR needs_sponsor`.

**Qué falta para un flujo de solicitudes de adopción**

No hay ninguna tabla de solicitudes. Para implementar "seguimiento de
solicitudes y estado del proceso" haría falta, como mínimo:

| Elemento | Detalle |
| --- | --- |
| Tabla `adoption_requests` | `id uuid pk`, `org_pet_id uuid → organization_pets`, `org_id uuid`, `applicant_name text`, `applicant_contact text`, `applicant_user_id uuid null → auth.users`, `message text`, `status text check in ('received','in_review','approved','rejected','withdrawn')`, `created_at`, `updated_at` |
| RLS | La fundación dueña (`org_id = auth.uid()`) lee/actualiza; el solicitante lee las suyas; inserción vía RPC `SECURITY DEFINER` para permitir solicitantes anónimos desde la ficha pública |
| RPC `submit_adoption_request(p_org_pet_id, p_name, p_contact, p_message)` | Valida que la mascota tenga `needs_home = true` y cree la fila; opcionalmente notifica a la fundación |
| RPC `set_adoption_request_status(p_request_id, p_status, p_note)` | Valida `org_id = auth.uid()`, cambia estado, notifica al solicitante |
| Tipo de notificación | `adoption_request_received`, `adoption_request_status` en `notifications.type` |

**Estado actual de la pantalla:** informa del pendiente y enlaza al listado de
mascotas donde sí se gestiona el flag. No se improvisó el flujo.

### 1.2 Fundación → Padrinos (`/fundacion/padrinos`)

**Qué existe hoy**

- `organization_pets.needs_sponsor` (boolean), gestionado igual que `needs_home`.

**Qué falta**

Gestión de aportes = pasarela de pagos + contabilidad. No forma parte de esta
versión. Estructura mínima futura:

| Elemento | Detalle |
| --- | --- |
| Integración de pagos | Wompi / Mercado Pago / PayU (Colombia). Requiere claves, webhook server-side y verificación de firma |
| Tabla `sponsorships` | `id`, `org_pet_id`, `org_id`, `sponsor_name`, `sponsor_user_id null`, `amount numeric`, `currency text`, `interval text check in ('one_time','monthly')`, `status text check in ('pending','active','failed','cancelled')`, `provider_ref text`, `created_at` |
| Tabla `sponsorship_payments` | Un registro por cobro confirmado por el webhook (`sponsorship_id`, `amount`, `paid_at`, `provider_event_id unique`) |
| RLS | La fundación lee lo suyo; el padrino lee lo suyo; **solo el webhook server-side (service key) escribe pagos** |

**Estado actual de la pantalla:** informa del pendiente y del enlace al flag en el
listado. **No se muestran aportes ni transacciones simuladas.**

---

## 2. Configuración de Supabase que debe activarse manualmente

Estos ajustes están en el panel de Supabase (Authentication → Providers / Email
Templates / Policies) y **no se pueden cambiar por código ni por MCP**.

| Ajuste | Acción | Motivo |
| --- | --- | --- |
| **Leaked password protection** | Authentication → Policies → activar "Check against HaveIBeenPwned" | Hoy está desactivado (aviso `auth_leaked_password_protection` del linter). Bloquea contraseñas filtradas al registrarse o cambiarlas |
| **Confirmación de correo** | Authentication → Providers → Email → "Confirm email" ON | Que una cuenta nueva deba verificar el correo antes de operar. `admin_get_user`/`admin_list_users` ya exponen `confirmed_at` y la UI muestra "Correo sin confirmar" |
| **Recuperación de contraseña** | Authentication → URL Configuration → `Site URL` y `Redirect URLs` con el dominio real; plantilla "Reset password" | Las páginas `/auth/recuperar` y `/auth/restablecer` ya existen; falta que el enlace del correo apunte al dominio de producción |
| **Plantillas de correo** | Authentication → Email Templates → traducir al español y poner remitente/branding de "Huellas de Vuelta" | Hoy son las plantillas por defecto en inglés |
| **SMTP propio** | Authentication → SMTP Settings | El SMTP de cortesía de Supabase tiene límite bajo; producción necesita SMTP propio (Resend, SES, etc.) |

### 2.1 Funciones SECURITY DEFINER expuestas como RPC (avisos del linter)

El linter marca todas las funciones `SECURITY DEFINER` invocables por
`anon`/`authenticated`. La mayoría son **RPC intencionales** que validan permisos
por dentro (`is_admin()`, `auth.uid()`), por lo que el aviso es esperado y
aceptable: `admin_*`, `set_org_approval`, `set_org_active`, `set_pet_status`,
`set_user_admin`, `org_confirm_pet_receipt`, `submit_report_event`,
`get_public_pet`, `list_*`, `public_landing_stats`, `is_admin`,
`is_public_pet_photo`, `can_read_report_evidence`, `report_accepts_evidence`.

Corregido en este cierre:

- **`enforce_org_service_kind_matches()`** — era un trigger con `EXECUTE` para
  `PUBLIC` (no lo necesita ningún cliente). Migración
  `revoke_public_execute_on_trigger_fn`: `REVOKE EXECUTE ... FROM PUBLIC, anon,
  authenticated`. Queda igual que `enforce_org_kind_matches_role()`,
  `handle_new_user()` y `lock_profile_role()`, que ya tenían el `REVOKE`. No
  afecta el disparo del trigger (corre como owner de la tabla).

Tradeoff conocido y aceptado:

- **`account_role_for_email(p_email)`** es invocable por `anon` a propósito: el
  login la usa antes de autenticar para impedir el acceso cruzado entre tipos de
  cuenta (usuario / veterinaria / fundación). Permite enumerar si un correo está
  registrado y con qué rol. Se mantiene porque el flujo de login depende de ella;
  si se quisiera cerrar, habría que mover esa validación a un RPC que reciba
  también la contraseña o hacerla tras el primer `signInWithPassword`.

---

## 3. Producción (variables de entorno)

- **`NEXT_PUBLIC_SITE_URL`** — en desarrollo cae a `http://localhost:3000`. **En
  producción es obligatorio** fijarla al dominio real:
  `NEXT_PUBLIC_SITE_URL=https://tu-dominio.com`. La usan `metadataBase`,
  `alternates.canonical`, Open Graph, `sitemap.xml` y `robots.txt`
  (`src/app/layout.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`). Documentada
  en `.env.example`.
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — ya
  presentes.
- No hay `localhost` hardcodeado fuera del fallback de desarrollo descrito.
- `robots.ts` bloquea `/dashboard`, `/veterinaria`, `/fundacion`, `/admin`,
  `/auth`. `sitemap.ts` solo lista rutas públicas estables (`/`, `/ayuda`,
  `/mascota/demo`). Las fichas `/m/<publicId>` son `noindex` a propósito.

---

## 4. Arquitectura de autorización (nota de seguridad)

La app **no usa middleware ni SSR con cookies**. Los paneles
(`/dashboard`, `/veterinaria`, `/fundacion`, `/admin`) se protegen en cliente
(`usePanelGuard`, `useAdminGuard`, `usePanelSession`). La frontera real de
seguridad es **RLS + RPC `SECURITY DEFINER` con `is_admin()` / `auth.uid()`**:

- Un usuario que escriba `/admin` en la barra es redirigido a `/dashboard` por
  `useAdminGuard`; y aunque forzara el render, **todos los datos de admin pasan
  por RPC que exigen `is_admin()`**, así que no se filtra nada.
- `pets`, `pet_reports`, `pet_report_events`, `notifications`: RLS por
  `owner_id = auth.uid()` (con `WITH CHECK`). Un usuario no puede leer ni
  modificar mascotas/reportes de otro.
- `organization_pets`, `organization_profiles`, `organization_services`: RLS por
  organización (`org_id = auth.uid()` / `owner_id = auth.uid()`). Una veterinaria
  no puede administrar otra veterinaria; una fundación no puede administrar otra
  fundación.
- `org_confirm_pet_receipt` valida que quien confirma sea la organización
  `selected_org_id` del aviso (o admin). Una organización no puede confirmar la
  mascota de un reporte dirigido a otra.
- `profiles`: update solo del propio; `role` e `is_admin` los revierte el trigger
  `lock_profile_role` — la auto-elevación desde el cliente está bloqueada.
- `organization_profiles`: `approval_status` / `status` los revierte
  `lock_org_approval_columns`; solo `set_org_approval` (admin) los cambia.
- RLS activo en las 9 tablas.
