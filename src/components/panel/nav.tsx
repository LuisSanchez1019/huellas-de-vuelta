import {
  ActivityIcon,
  BellIcon,
  HomeIcon,
  PawIcon,
  ReportIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons/Icon";
import type { NavEntry } from "./types";

/** Opciones normales del Dashboard. Iguales para todos los usuarios. */
const BASE_NAV: NavEntry[] = [
  { type: "link", label: "Inicio", href: "/dashboard", icon: <HomeIcon size={20} /> },
  {
    type: "group",
    label: "Mis mascotas",
    icon: <PawIcon size={19} />,
    items: [
      { label: "Registrar mascota", href: "/dashboard/mascotas/nueva" },
      { label: "Mis mascotas", href: "/dashboard/mascotas" },
      { label: "QR / Placa", href: "/dashboard/mascotas/qr" },
    ],
  },
  {
    type: "group",
    label: "Mis reportes",
    icon: <ReportIcon size={20} />,
    items: [
      { label: "Activos", href: "/dashboard/reportes/activos" },
      { label: "Historial", href: "/dashboard/reportes/historial" },
    ],
  },
  { type: "link", label: "Notificaciones", href: "/dashboard/notificaciones", icon: <BellIcon size={20} /> },
  { type: "link", label: "Mi actividad", href: "/dashboard/actividad", icon: <ActivityIcon size={20} /> },
  { type: "link", label: "Mi perfil", href: "/dashboard/perfil", icon: <UserIcon size={20} /> },
  {
    type: "group",
    label: "Configuración",
    icon: <SettingsIcon size={20} />,
    items: [
      { label: "Cuenta", href: "/dashboard/configuracion/cuenta" },
      { label: "Apariencia", href: "/dashboard/configuracion/apariencia" },
      { label: "Seguridad", href: "/dashboard/configuracion/seguridad" },
      { label: "Notificaciones", href: "/dashboard/configuracion/notificaciones" },
      { label: "Privacidad", href: "/dashboard/configuracion/privacidad" },
    ],
  },
];

/** Sección extra que solo ve un administrador. Se añade al final del menú normal. */
const ADMIN_GROUP: NavEntry = {
  type: "group",
  label: "Administración",
  icon: <ShieldIcon size={19} />,
  items: [
    { label: "Inicio administrativo", href: "/admin" },
    { label: "Organizaciones", href: "/admin/organizaciones" },
    { label: "Usuarios", href: "/admin/usuarios" },
  ],
};

/**
 * Menú del panel. Es el MISMO Dashboard para todos; a un administrador se le
 * añade la sección "Administración". No hay un panel separado.
 */
export function buildPanelNav({ isAdmin }: { isAdmin: boolean }): NavEntry[] {
  return isAdmin ? [...BASE_NAV, ADMIN_GROUP] : BASE_NAV;
}
