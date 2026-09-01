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
