# Supabase

Esta carpeta guarda cambios versionables de base de datos. No contiene claves.

## Primera configuración

1. Crea un proyecto en Supabase.
2. Copia `.env.example` como `.env.local` en la raíz de la aplicación.
3. En Supabase, abre el SQL Editor y ejecuta el contenido de `migrations/202608290001_initial_profiles_and_pets.sql`.
4. En Authentication, habilita el proveedor Email. Para desarrollo, puedes desactivar temporalmente la confirmación de correo; antes de producción debe estar habilitada.

Cuando exista el proyecto, se añadirá la interfaz de registro e inicio de sesión. No se debe usar ni compartir la clave `service_role` en este proyecto web.
