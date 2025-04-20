
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageCircle, Video, Info } from "lucide-react";

const DemoSection = () => {
  const demoCards = [
    {
      title: "Depression Screening",
      description: "AI-powered depression assessment using PHQ-9 methodology enhanced with emotional recognition.",
      icon: <MessageCircle className="w-10 h-10 text-psyche-purple" />,
      duration: "5-7 minutes",
      questions: 12
    },
    {
      title: "Anxiety Analysis",
      description: "Evaluate anxiety levels through specialized questioning and non-verbal cue detection.",
      icon: <Video className="w-10 h-10 text-psyche-purple" />,
      duration: "6-8 minutes",
      questions: 14
    },
    {
      title: "General Mental Health",
      description: "Comprehensive mental wellness checkup covering multiple psychological dimensions.",
      icon: <Info className="w-10 h-10 text-psyche-purple" />,
      duration: "10-15 minutes",
      questions: 20
    }
  ];

  return (
    <section id="demo" className="py-24 bg-gradient-to-b from-psyche-gray-light to-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">
            Demo <span className="bg-gradient-to-r from-psyche-purple to-psyche-blue bg-clip-text text-transparent">Assessment Types</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Explore the different types of psychological assessments available through our AI platform
          </p>
        </div>

        <Tabs defaultValue="cards" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="cards">Assessment Options</TabsTrigger>
            <TabsTrigger value="details">How It Works</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cards" className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {demoCards.map((card, index) => (
                <Card key={index} className="overflow-hidden border border-psyche-gray hover:border-psyche-purple transition-all duration-300">
                  <CardHeader className="bg-gradient-to-r from-psyche-purple-light to-psyche-blue-light pb-6">
                    <div className="mb-4">{card.icon}</div>
                    <CardTitle>{card.title}</CardTitle>
                    <CardDescription className="text-gray-700">{card.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Duration</p>
                        <p className="font-medium">{card.duration}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Questions</p>
                        <p className="font-medium">{card.questions}</p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-gray-100 pt-4">
                    <Button 
                      className="w-full bg-psyche-purple hover:bg-psyche-purple-dark text-white transition-colors"
                      onClick={() => document.getElementById('diagnosis')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      Try Demo
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="details" className="animate-fade-in">
            <Card className="border border-psyche-gray-light">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-medium mb-2">1. Select an Assessment Type</h3>
                    <p className="text-gray-600">Choose from our specialized assessment options based on your needs.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-medium mb-2">2. Begin Voice Interaction</h3>
                    <p className="text-gray-600">Our AI voice agent will guide you through a series of questions, dynamically adapting based on your responses.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-medium mb-2">3. Facial Analysis</h3>
                    <p className="text-gray-600">With your permission, our system analyzes facial expressions to enhance assessment accuracy.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-medium mb-2">4. Receive Insights</h3>
                    <p className="text-gray-600">After completion, you'll receive a preliminary assessment summary and conversation transcript.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};

export default DemoSection;
