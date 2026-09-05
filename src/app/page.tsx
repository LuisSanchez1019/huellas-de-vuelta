import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import HelpSection from "@/components/landing/HelpSection";
import PartnersSection from "@/components/landing/PartnersSection";
import AdoptionsSection from "@/components/landing/AdoptionsSection";
import StatsSection from "@/components/landing/StatsSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import MapSection from "@/components/landing/MapSection";
import QRSection from "@/components/landing/QRSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const description =
  "Reporta mascotas perdidas o encontradas, conecta con veterinarias y fundaciones aliadas verificadas, y ayuda a que más familias se reencuentren con sus mascotas — gratis y seguro.";

export const metadata: Metadata = {
  title: "Huellas de Vuelta",
  description,
  alternates: { canonical: "/" },
  openGraph: { title: "Huellas de Vuelta", description, url: "/" },
  twitter: { title: "Huellas de Vuelta", description },
};

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HelpSection />
        <PartnersSection />
        <AdoptionsSection />
        <StatsSection />
        <HowItWorksSection />
        <MapSection />
        <QRSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
