
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Hero = () => {
  return (
    <section id="home" className="min-h-screen pt-16 flex items-center bg-gradient-to-b from-white to-psyche-gray-light">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col lg:flex-row items-center">
          <div className="lg:w-1/2 lg:pr-8 mb-12 lg:mb-0">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Modern Psychology Diagnosis{" "}
              <span className="bg-gradient-to-r from-psyche-purple to-psyche-blue bg-clip-text text-transparent">
                Powered by AI
              </span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 md:pr-10">
              Experience a revolutionary approach to psychological assessment that combines artificial intelligence, voice interaction, and emotion recognition to provide insightful diagnostics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                className="bg-gradient-to-r from-psyche-purple to-psyche-blue text-white hover:opacity-90 transition-all px-8 py-6 text-lg"
                onClick={() => document.getElementById('diagnosis')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Start Diagnosis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                className="border-psyche-purple text-psyche-purple hover:bg-psyche-purple-light transition-all px-8 py-6 text-lg"
                onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Demo
              </Button>
            </div>
          </div>
          <div className="lg:w-1/2 relative">
            <div className="rounded-2xl overflow-hidden shadow-xl transform hover:scale-105 transition-transform duration-300">
              <div className="relative bg-gradient-to-br from-psyche-purple to-psyche-blue p-1 rounded-2xl">
                <div className="absolute inset-0 bg-white rounded-2xl m-[3px]"></div>
                <div className="relative z-10 p-6">
                  <div className="h-64 bg-psyche-purple-light rounded-xl flex items-center justify-center">
                    <div className="text-center p-6">
                      <div className="w-20 h-20 rounded-full bg-psyche-purple mx-auto flex items-center justify-center mb-4">
                        <div className="text-white text-3xl">AI</div>
                      </div>
                      <h3 className="text-lg font-medium mb-2 text-psyche-purple">Voice-Powered Assessment</h3>
                      <p className="text-gray-600">Interact naturally with our AI voice agent to receive a comprehensive psychological assessment</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-psyche-blue-light rounded-full -z-10 animate-pulse-subtle"></div>
            <div className="absolute -left-4 -top-4 w-24 h-24 bg-psyche-purple-light rounded-full -z-10 animate-pulse-subtle" style={{ animationDelay: "1s" }}></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
