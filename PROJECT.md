# Huellas de Vuelta

## Propósito

Plataforma web sin ánimo de lucro para reunir mascotas perdidas con sus familias, canalizar reportes de mascotas encontradas y, más adelante, facilitar adopciones responsables en Colombia.

## Alcance actual: V0.1

Es una base de desarrollo estable, no el lanzamiento público:

- Next.js con TypeScript y ESLint.
- Base visual responsive y documentación de decisiones.
- Repositorio Git local listo para publicar en GitHub.

Quedan fuera por ahora mapas, QR, notificaciones, adopciones, IA, imágenes y datos reales.

## Principios

- Privacidad primero: nunca publicar contactos o dirección privada sin autorización.
- Útil desde móvil y con conexiones comunes.
- Moderación y seguridad antes de abrir contenido al público.
- Servicios administrados y planes gratuitos mientras sean suficientes.

## Servicios acordados

| Necesidad | Servicio inicial |
| --- | --- |
| Aplicación web | Next.js en Vercel |
| Código | GitHub |
| Datos, Auth e imágenes | Supabase |
| Mapas futuros | Leaflet + OpenStreetMap |
| Dominio y DNS futuros | Registrador + Cloudflare DNS |

## Decisiones vigentes

- Web responsive primero; PWA y móvil después.
- Supabase proveerá PostgreSQL, Auth y Storage.
- Las fotos irán a Storage; PostgreSQL guardará únicamente metadatos y rutas.
- Los QR públicos enlazarán a un perfil seguro, nunca a datos privados.
- La IA no pertenece a V0.1 ni al MVP inicial.
