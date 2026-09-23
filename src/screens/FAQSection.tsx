import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const faqs = [
  {
    question: "How long does it take to get up and running with Bysen?",
    answer: "Setup is fast and self-serve. Bysen provides standard instructional materials so you can set up your venue independently at no additional cost. If you prefer hands-on configuration by our team, we offer a dedicated setup service for a one-time fee."
  },
  {
    question: "Does Bysen charge monthly subscription fees or transaction fees?",
    answer: "Bysen does not charge recurring monthly software subscription fees. Instead, we charge a tiered platform fee per transaction based on the order total (from 1.00 GHS for orders up to 50 GHS, up to 5.00 GHS for orders over 200 GHS). Digital payments via Paystack carry a separate 2% processing fee."
  },
  {
    question: "Can guests use the QR ordering without downloading an app?",
    answer: "Yes, our entire QR ordering flow is web-based. Guests simply scan the table QR code with their smartphone camera and order immediately through their mobile browser without downloading any apps."
  },
  {
    question: "Which POS hardware does Bysen work with?",
    answer: "Bysen is exclusively a cloud-based software provider (Bring Your Own Device). You can run Kitchen Displays, Waiter Workspaces, and Manager Dashboards on any existing tablet, iPad, laptop, smartphone, or touchscreen device with an active internet connection."
  },
  {
    question: "What happens to my data if I decide to leave Bysen?",
    answer: "Your data is always yours. There are no minimum lock-in periods (7 days cancellation notice). Upon request, Bysen will export a comprehensive copy of your sales records within 30 days. Staff account data is deleted within 30 days of account closure, while transaction records are retained for 5 years to fulfill legal accounting obligations under Ghana law."
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
        <h2 className="font-brand text-[35px] font-bold mb-12 text-center md:text-left">
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
                  <span className="font-brand text-[16px] font-bold group-hover:text-[#c9935a] transition-colors pr-8">
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
