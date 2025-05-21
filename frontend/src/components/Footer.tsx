
import { Button } from "@/components/ui/button";

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center mb-4">
              <span className="text-2xl font-bold bg-gradient-to-r from-psyche-purple to-psyche-blue bg-clip-text text-transparent">
                Psyche<span className="text-psyche-blue">AI</span>
              </span>
            </div>
            <p className="text-gray-600 mb-4 max-w-md">
              An innovative approach to psychological assessment using artificial intelligence, voice interaction, and emotion recognition technology.
            </p>
            <div className="space-x-4">
              <Button variant="ghost" size="sm" className="text-psyche-purple hover:bg-psyche-purple-light">
                Terms of Service
              </Button>
              <Button variant="ghost" size="sm" className="text-psyche-purple hover:bg-psyche-purple-light">
                Privacy Policy
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li><a href="#home" className="text-gray-600 hover:text-psyche-purple">Home</a></li>
              <li><a href="#about" className="text-gray-600 hover:text-psyche-purple">About</a></li>
              <li><a href="#demo" className="text-gray-600 hover:text-psyche-purple">Demo</a></li>
              <li><a href="#diagnosis" className="text-gray-600 hover:text-psyche-purple">Diagnosis</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium mb-4">Contact</h3>
            <ul className="space-y-2">
              <li className="text-gray-600">info@psycheai.dz</li>
              <li className="text-gray-600">+213 123456789</li>
              <li className="text-gray-600">123 psychology Boulevard, AI City</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm mb-4 md:mb-0">
            © {new Date().getFullYear()} PsycheAI. All rights reserved.
          </p>
          
        </div>
      </div>
    </footer>
  );
};

export default Footer;
