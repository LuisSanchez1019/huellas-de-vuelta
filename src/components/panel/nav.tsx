import {
  BellIcon,
  HomeIcon,
  PawIcon,
  ReportIcon,
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
      { label: "Solicitar placa", href: "/dashboard/mascotas/solicitar-placa" },
      { label: "Mis pedidos", href: "/dashboard/pedidos" },
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
  { type: "link", label: "Mi perfil", href: "/dashboard/perfil", icon: <UserIcon size={20} /> },
  { type: "link", label: "Seguridad y privacidad", href: "/dashboard/configuracion/seguridad", icon: <ShieldIcon size={19} /> },
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
    { label: "Pedidos", href: "/admin/pedidos" },
    { label: "Envíos", href: "/admin/envios" },
    { label: "Posters", href: "/admin/posters" },
    { label: "QR / Placas", href: "/admin/qr" },
  ],
};

/**
 * Menú del panel. Es el MISMO Dashboard para todos; a un administrador se le
 * añade la sección "Administración". No hay un panel separado.
 */
export function buildPanelNav({ isAdmin }: { isAdmin: boolean }): NavEntry[] {
  return isAdmin ? [...BASE_NAV, ADMIN_GROUP] : BASE_NAV;
}
