# QR de Huellas de Vuelta: de la placa al perfil público

Alcance de este módulo (aclaración definitiva): que exista un **QR funcional** que apunte a Huellas y que el
propietario pueda **asociar a su mascota**. Nada más. El futuro e-commerce solo fabrica/vende la placa que contiene
ese QR; no participa en la asociación, no recibe datos de mascotas y no se diseña ahora.

```
PLACA FÍSICA → QR → https://<dominio de Huellas>/m/<public_id> → Huellas → mascota asociada → perfil público limitado
```

Migración: `supabase/migrations/20260929000000_qr_source_of_truth_hardening.sql`. Pruebas:
`supabase/tests/qr_source_of_truth.test.sql`, `scripts/qr-base-url.test.mjs`.

## 1. Responsabilidad de Huellas

QR, `public_id`, relación QR ↔ mascota, autenticación, validación de propiedad, claim, activación, estados del QR y
perfil público que aparece al escanear. **Fuente de verdad:** `qr_tags → owner_pet_id → pets`.

El e-commerce (futuro, independiente) no es fuente de verdad de mascota, propietario, asociación, activación ni
perfil público, y no es intermediario del QR.

## 2. El QR

- `qr_tags.public_id`: 12 caracteres aleatorios (≈ 60 bits, `gen_random_bytes`). No es secreto ni contiene datos personales.
- URL codificada: `<NEXT_PUBLIC_SITE_URL>/m/<public_id>`, construida solo por `qrPublicUrl()` (`src/lib/qr/qrBaseUrl.ts`):
  https obligatorio, dominio público, sin ruta; si falta o es inválido **no se genera ningún QR**. Nunca depende del navegador.
- `short_code` (código impreso legible) es administrativo: no identifica ni resuelve nada.
- `public_id` es inmutable y único entre `pets`, `organization_pets` y `qr_tags`. Escanear un QR activo devuelve el id
  del QR (no el de la mascota).

## 3. Asociación QR ↔ mascota (solo dentro de Huellas)

1. `/m/<public_id>` detecta un QR `available` → "Iniciar sesión para asignar".
2. El usuario inicia sesión y Huellas lista **sus** mascotas; elige una.
3. `qr_claim_tag(p_public_id, p_pet_id)` valida en servidor: sesión (`auth.uid()`), rol (**solo `usuario`**: aliado, fundación, veterinaria y proveedor no reclaman), propiedad real
   (`pets.owner_id = auth.uid()`), mascota no archivada, `FOR UPDATE` sobre el QR, estado `available` y placa viva previa.
4. Transacción única → QR `active` + eventos `assigned` y `activated` con actor. El índice único parcial es la garantía final ante carreras.

Ni el e-commerce, ni el proveedor, ni la producción, ni el envío participan ni activan (`ROLE_NOT_ALLOWED`; el pedido y la
entrega ya no vinculan ni activan). Solo lo activan el propietario (claim) o el equipo de Huellas.

## 4. Estados

| Estado | Al escanear | Quién lo produce |
|---|---|---|
| `available` | Reclamo con inicio de sesión | generación del lote; admin `unassign` |
| `active` | Perfil público | claim del propietario; reanudar suspensión propia; admin |
| `suspended` | Mensaje de suspensión, **sin datos** | propietario (`qr_owner_set_pet_tag_state`) o admin |
| `replaced` | Mensaje de reemplazo, sin datos | reclamar una placa nueva teniendo la anterior suspendida; `qr_admin_replace` |
| `annulled` | Mensaje de anulación, sin datos (terminal) | admin; eliminar la mascota |
| `assigned` (solo admin) | "Registrada, sin activar" | `qr_admin_assign` sin activar |

El propietario reactiva solo una suspensión hecha por él. Eliminar una mascota anula su placa (no queda reutilizable).
La **campaña** de mascota perdida/encontrada/adopción es un concepto separado: se abre por el id de campaña de la mascota
(`pets.public_id`, inmutable) solo mientras está publicada, con su propia lógica; una mascota en casa no se abre por ese id.

## 5. Perfil público (`get_public_pet`, una sola función)

Muestra: foto **solo si es realmente pública** (si no, `null`), nombre, especie, raza, sexo, colores, edad derivada (no la
fecha de nacimiento), descripción, estado, datos del reporte de pérdida/adopción (ciudad, barrio, detalles, fecha), teléfono
**solo** con reporte activo y autorización expresa del dueño, `plate_code` (el código impreso) y la alerta médica pública
**solo** si el dueño la autorizó (dos booleanos, nunca el contenido).

No muestra: propietario, correo, dirección, teléfono privado, historia clínica, vacunas, tratamientos, diagnósticos, grants,
auditoría, `pets.public_id` ni UUID de usuario/mascota. Excepción funcional conocida: mientras exista un reporte de pérdida
activo se devuelve `report_id`, que el asistente "Encontré esta mascota" necesita para adjuntar evidencia; y la ruta de una
foto pública contiene el UUID del dueño (la política de Storage es por carpeta).

## 6. Seguridad (resumen)

- **RLS / privilegios:** `qr_tags`, `qr_tag_events`, `qr_batches`: solo lectura filtrada (admin y creador del lote); toda
  escritura por RPC `SECURITY DEFINER` con `search_path=''`, sin `EXECUTE` para `anon` (salvo `get_public_pet`). Sin
  TRUNCATE/TRIGGER/REFERENCES/MAINTAIN para `anon`/`authenticated`.
- **Quién escribe estados:** solo `qr_admin_*`, `qr_claim_tag` y `qr_owner_set_pet_tag_state`.
- **Foto:** `pets.photo_path` / `organization_pets.photo_path` deben estar en la carpeta de su propietario (trigger `PHOTO_PATH_FOREIGN`); así nadie puede volver firmable la foto privada de otra persona apuntando su mascota a esa ruta.
- **Protegido contra:** IDOR (`pet_id`, `public_id`, `owner_id`, `qr_tag_id`), mascota ajena, QR ajeno/inexistente/activo/
  suspendido/reemplazado/anulado, proveedor o veterinaria intentando reclamar o cambiar estados, cambio de `public_id`,
  escrituras directas, sesión anónima.
- **Concurrencia:** `FOR UPDATE` + índice único parcial (ver verificación).

## 7. Única relación futura con el e-commerce

Solo lo necesario para que la placa física lleve un QR válido: **disponer de QR (`public_id`) generados por Huellas e
imprimir `<dominio de Huellas>/m/<public_id>`**. Hoy eso lo cubren los mecanismos existentes de generación de lotes
(administración y `qr_provider_batch_create`); cómo se conectará se decidirá cuando se diseñe la tienda. No se diseña ahora
ninguna integración de datos de mascotas, pedidos, pagos, producción ni logística. El código actual de pedidos/envíos
(`plate_orders`, `shipments`, sus RPC y pantallas) es previo a esta aclaración, no se toca y se revisará cuando exista la tienda.

## 8. Verificación (clasificada)

| Punto | Estado |
|---|---|
| Claim, IDOR, roles, estados, perfil por estado, campaña, privilegios, entrega/pedido no activan, eliminar mascota | VERIFICADO EN BD (115 comprobaciones con rollback) |
| Acceso anónimo por la API real (PostgREST) | VERIFICADO EN BD/API (401 en RPC de escritura y tablas; 200 solo `get_public_pet`) |
| Dominio del QR (https público, sin origen del navegador) y generación real (SVG → píxeles → lector ZXing decodifica `<dominio>/m/<public_id>`) | VERIFICADO POR TEST |
| `FOR UPDATE` + índice único ante dos sesiones | VERIFICADO POR CÓDIGO; índice y carrera secuencial verificados en BD; **dos sesiones simultáneas: NO VERIFICADO** |
| Flujo con una sesión real de usuario (interfaz) | NO VERIFICADO (sin credenciales; solo JWT simulado en BD) |
| Los 2 QR existentes | En BD `active`, resuelven por HTTP; **NO VERIFICADO FÍSICAMENTE** (son placas heredadas de la migración; el dominio impreso, si existe, no consta) |

## 9. Riesgos y decisiones pendientes

1. **Claim anticipado.** Mientras un QR está `available`, quien conozca su `public_id` (imprenta, mensajería, foto del lote,
   hallador) y tenga una cuenta puede reclamarlo. Queda auditado y el admin puede anular/reemplazar. Alternativas analizadas:
   - **A. Actual:** sin complejidad; riesgo abierto.
   - **B. Código de activación** generado por Huellas junto con el QR (hash en BD; se imprime con la placa/empaque): 100 %
     dentro de Huellas, sin identidad del comprador; no protege de quien imprime el código; añade fricción y soporte.
   - **C. Reserva por comprador** (`reserved_for_user_id`): la más fuerte, pero **exige que la tienda le diga a Huellas quién
     compró** — un acoplamiento que la aclaración descarta. **Queda descartada.**
   Recomendación revisada: mantener **A** ahora (documentada) y, si el producto lo exige, añadir **B** después; no implementado.
2. Dominio oficial sin definir: hay que fijar `NEXT_PUBLIC_SITE_URL` (Producción, Preview y local) antes de generar QR.
3. Foto al escanear: las mascotas en casa no la muestran (no es pública). Decisión de privacidad pendiente.
4. Id de campaña: sigue abriendo la campaña de una mascota publicada aunque su QR esté suspendido/anulado (por diseño).
5. Una mascota archivada con QR activo muestra "no encontramos ninguna mascota". Un id inexistente responde HTTP 200 (soft 404).
6. Pendientes de auditorías previas (contraseñas filtradas, cabeceras de seguridad, migraciones sin archivo).
