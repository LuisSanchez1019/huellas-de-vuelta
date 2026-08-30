# Huellas de Vuelta

Base de desarrollo de la plataforma web para ayudar a las mascotas a volver a casa.

## Requisitos

- Node.js 20 o superior.
- npm.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` en el navegador.

## Verificación

```bash
npm run lint
npm run build
```

Ambos comandos deben finalizar sin errores antes de subir cambios.

## Documentación

- [PROJECT.md](PROJECT.md): propósito, alcance y decisiones de producto.
- [ROADMAP.md](ROADMAP.md): hitos en orden.
- [ARCHITECTURE.md](ARCHITECTURE.md): arquitectura, Supabase y secretos.

## Variables de entorno

No hay claves configuradas todavía. Cuando se conecte Supabase, las variables locales estarán en un archivo `.env.local`, que Git ignora. No incluyas secretos en el código ni en commits.
