import type { Metadata } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import { ThemeProvider, themeInitScript } from "@/components/theme/ThemeProvider";
import "./globals.css";

const heading = Lexend({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Huellas de Vuelta",
    template: "%s · Huellas de Vuelta",
  },
  description: "Una plataforma para ayudar a las mascotas a volver a casa.",
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Huellas de Vuelta",
    title: "Huellas de Vuelta",
    description: "Una plataforma para ayudar a las mascotas a volver a casa.",
  },
  twitter: {
    card: "summary",
    title: "Huellas de Vuelta",
    description: "Una plataforma para ayudar a las mascotas a volver a casa.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Script en línea: fija el tema antes del primer pintado. El `type`
            cambia entre servidor y cliente para evitar el aviso de React en
            desarrollo por renderizar <script>; `suppressHydrationWarning`
            absorbe esa diferencia. Ver docs de Next "Preventing Flash". */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className={`${heading.variable} ${body.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
