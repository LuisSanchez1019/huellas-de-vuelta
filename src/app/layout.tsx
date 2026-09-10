import type { Metadata } from "next";
import { Caveat, Lexend, Source_Sans_3 } from "next/font/google";
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

// Tipografía manuscrita, solo para frases de marca puntuales del Landing.
const script = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-script",
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
  // El pack de favicons vive en `public/` (16x16, 32x32, apple-touch). El
  // `favicon.ico` multi-tamaño lo enlaza Next por la convención de archivo
  // (`src/app/favicon.ico`) y el manifest por `src/app/manifest.ts`.
  icons: {
    icon: [
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
      <body className={`${heading.variable} ${body.variable} ${script.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
