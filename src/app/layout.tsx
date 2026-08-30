import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Huellas de Vuelta",
  description: "Una plataforma para ayudar a las mascotas a volver a casa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
