import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import OrgBanner from "@/components/landing/OrgBanner";
import Hero from "@/components/landing/Hero";
import LostPetsSection from "@/components/landing/LostPetsSection";
import AdoptionsSection from "@/components/landing/AdoptionsSection";
import SponsorPetsSection from "@/components/landing/SponsorPetsSection";
import OrgsSection from "@/components/landing/OrgsSection";
import MapSection from "@/components/landing/MapSection";
import PostersSection from "@/components/landing/PostersSection";
import SponsorsSection from "@/components/landing/SponsorsSection";
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
        <OrgBanner />
        <Hero />
        <LostPetsSection />
        <AdoptionsSection />
        <SponsorPetsSection />
        <MapSection />
        <PostersSection />
        <OrgsSection kind="veterinaria" />
        <OrgsSection kind="fundacion" />
        <SponsorsSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
