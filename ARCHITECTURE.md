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

## Secretos

- `.env*` está ignorado por Git.
- Solo se compartirá `.env.example` sin valores reales.
- Las variables de producción se configurarán en Vercel.
- RLS será la protección de datos, no solo la interfaz.

Mapas, PostGIS, fotos, QR, mensajería, notificaciones, pagos, adopciones e IA se abordarán en etapas posteriores.
