import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import CommunitySection from "@/components/landing/CommunitySection";
import HelpSection from "@/components/landing/HelpSection";
import AdoptionsSection from "@/components/landing/AdoptionsSection";
import MapSection from "@/components/landing/MapSection";
import PartnersSection from "@/components/landing/PartnersSection";
import InfoSection from "@/components/landing/InfoSection";
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
        <CommunitySection />
        <HelpSection />
        <AdoptionsSection />
        <MapSection />
        <PartnersSection />
        <InfoSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
