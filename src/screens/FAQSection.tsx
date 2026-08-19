import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const faqs = [
  {
    question: "How long does it take to get up and running with Bysen?",
    answer: "Implementation typically takes 1-2 weeks depending on your venue size. Our team handles your menu import and floor plan setup, so you can focus on operations."
  },
  {
    question: "Does Bysen charge transaction fees on top of the monthly subscription?",
    answer: "No, Bysen charges a flat monthly software subscription. We don't take a percentage of your sales or add hidden transaction fees."
  },
  {
    question: "Can guests use the QR ordering without downloading an app?",
    answer: "Yes, our entire QR ordering flow is web-based. Guests simply scan the code with their camera and order immediately through their browser without any downloads."
  },
  {
    question: "Which POS hardware does Bysen work with?",
    "answer": "Bysen is hardware agnostic and cloud-based. You can run our Kitchen Displays and Manager Dashboards on any modern tablet, iPad, or touchscreen device."
  },
  {
    question: "What happens to my data if I decide to leave Bysen?",
    answer: "Your data is always yours. On request, we export a full archive of your transaction history, menu configurations, and customer records in standard CSV and JSON formats within 5 business days. Data is deleted from our servers within 30 days of account closure."
  }
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="w-full bg-white text-[#1a110b] py-24 px-8 md:px-16 lg:px-24 flex justify-center">
      <div className="w-full max-w-3xl">
        <h2 className="font-['Plus_Jakarta_Sans'] text-[35px] font-bold mb-12 text-center md:text-left">
          Frequently Asked Questions
        </h2>
        
        <div className="flex flex-col border-t border-[#1a110b]/10">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="border-b border-[#1a110b]/10">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full py-6 flex items-center justify-between text-left focus:outline-none group"
                >
                  <span className="font-['Plus_Jakarta_Sans'] text-[16px] font-bold group-hover:text-[#c9935a] transition-colors pr-8">
                    {faq.question}
                  </span>
                  <div className="flex-shrink-0 ml-4">
                    <ChevronDownIcon 
                      className={`w-5 h-5 transition-transform duration-300 ease-spring ${isOpen ? 'rotate-180 text-[#c9935a]' : 'text-[#1a110b]'}`} 
                    />
                  </div>
                </button>
                
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-spring ${isOpen ? 'max-h-96 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}
                >
                  <p className="font-['Inter'] text-[15px] font-normal leading-relaxed text-[#1a110b]/80 pr-8 md:pr-12">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
