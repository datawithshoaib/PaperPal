import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";
import { Cta, Features, Footer, HowItWorks } from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <main className="relative">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Cta />
      <Footer />
    </main>
  );
}
