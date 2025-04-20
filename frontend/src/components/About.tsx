
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const About = () => {
  const features = [
    {
      title: "Voice Analysis",
      description: "Our AI analyzes voice patterns, tone, and speech cadence to detect underlying emotional states."
    },
    {
      title: "Emotional Recognition",
      description: "Advanced computer vision technology recognizes facial expressions and micro-expressions in real-time."
    },
    {
      title: "Adaptive Questioning",
      description: "Our AI adjusts questions based on your responses for a personalized assessment experience."
    },
    {
      title: "Conversation Transcript",
      description: "Receive a complete record of your session, including AI observations and preliminary insights."
    }
  ];

  return (
    <section id="about" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">
            How <span className="bg-gradient-to-r from-psyche-purple to-psyche-blue bg-clip-text text-transparent">PsycheAI</span> Works
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Combining cutting-edge artificial intelligence with established psychological assessment methodologies
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border border-psyche-gray-light hover:border-psyche-purple transition-all duration-300 animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-psyche-purple-light rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-psyche-purple" />
                </div>
                <h3 className="text-xl font-medium mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 bg-psyche-gray-light rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-6 md:mb-0 md:pr-8">
              <h3 className="text-2xl font-bold mb-4">Privacy & Ethics</h3>
              <p className="text-gray-600 mb-4">
                We prioritize your privacy and adhere to the highest ethical standards. All sessions are encrypted, and data is handled according to strict privacy protocols.
              </p>
              <p className="text-gray-600">
                PsycheAI is designed as a preliminary assessment tool and does not replace professional psychological evaluation. Always consult with healthcare professionals for clinical diagnosis.
              </p>
            </div>
            <div className="md:w-1/2 bg-white p-6 rounded-xl shadow-md">
              <h4 className="text-lg font-medium mb-3 text-psyche-purple">Our Commitment</h4>
              <ul className="space-y-2">
                {[
                  "End-to-end encryption for all sessions",
                  "Compliance with healthcare privacy standards",
                  "Optional anonymized data collection",
                  "Transparent AI decision-making process",
                  "Regular third-party ethical audits"
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-psyche-purple mr-2 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
