
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import DemoSection from "@/components/DemoSection";
import DiagnosisSection from "@/components/DiagnosisSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <About />
        <DemoSection />
        <DiagnosisSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
