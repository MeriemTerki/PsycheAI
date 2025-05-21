import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Mic, MessageCircle, FileText } from "lucide-react";

const DemoSection = () => {
  return (
    <section id="demo" className="py-24 bg-gradient-to-b from-psyche-gray-light to-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">
            Experience a <span className="bg-gradient-to-r from-psyche-purple to-psyche-blue bg-clip-text text-transparent">Live Preview</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            See how PsycheAI guides you through a personalized assessment in just a few steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="overflow-hidden border border-psyche-gray hover:border-psyche-purple transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-psyche-purple-light to-psyche-blue-light pb-6">
              <div className="mb-4">
                <Camera className="w-10 h-10 text-psyche-purple" />
              </div>
              <CardTitle>Grant Permissions</CardTitle>
              <CardDescription className="text-gray-700">
                Allow access to your webcam and microphone to begin.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="overflow-hidden border border-psyche-gray hover:border-psyche-purple transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-psyche-purple-light to-psyche-blue-light pb-6">
              <div className="mb-4">
                <Mic className="w-10 h-10 text-psyche-purple" />
              </div>
              <CardTitle>Start Your Session</CardTitle>
              <CardDescription className="text-gray-700">
                Click to begin your personalized AI-guided session.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="overflow-hidden border border-psyche-gray hover:border-psyche-purple transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-psyche-purple-light to-psyche-blue-light pb-6">
              <div className="mb-4">
                <MessageCircle className="w-10 h-10 text-psyche-purple" />
              </div>
              <CardTitle>Interact with the AI</CardTitle>
              <CardDescription className="text-gray-700">
                Answer questions via voice or text as the AI adapts to you.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="overflow-hidden border border-psyche-gray hover:border-psyche-purple transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-psyche-purple-light to-psyche-blue-light pb-6">
              <div className="mb-4">
                <FileText className="w-10 h-10 text-psyche-purple" />
              </div>
              <CardTitle>Receive Your Report</CardTitle>
              <CardDescription className="text-gray-700">
                Get a detailed report and transcript at the end of the session.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        {/* <div className="mt-12 text-center">
          <Button 
            className="bg-psyche-purple hover:bg-psyche-purple-dark text-white transition-colors px-8 py-3"
            disabled
          >
            Try a Demo Now (Coming Soon)
          </Button>
        </div> */}
        
      </div>
    </section>
  );
};

export default DemoSection;