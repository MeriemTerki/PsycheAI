
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      if (offset > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header 
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/90 backdrop-blur-md shadow-sm' 
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto flex items-center justify-between p-4">
        <div className="flex items-center">
          <span className="text-2xl font-bold bg-gradient-to-r from-psyche-purple to-psyche-blue bg-clip-text text-transparent">
            Psyche<span className="text-psyche-blue">AI</span>
          </span>
        </div>
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#home" className="text-foreground hover:text-psyche-purple transition-colors">
            Home
          </a>
          <a href="#about" className="text-foreground hover:text-psyche-purple transition-colors">
            About
          </a>
          <a href="#demo" className="text-foreground hover:text-psyche-purple transition-colors">
            Demo
          </a>
          <a href="#diagnosis" className="text-foreground hover:text-psyche-purple transition-colors">
            Diagnosis
          </a>
        </nav>
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            className="rounded-full border border-psyche-purple text-psyche-purple hover:bg-psyche-purple hover:text-white transition-all"
            onClick={() => document.getElementById('diagnosis')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Start Diagnosis
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
