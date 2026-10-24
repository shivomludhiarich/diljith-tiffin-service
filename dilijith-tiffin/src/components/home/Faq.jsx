import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionHeading from '../common/SectionHeading';

const FAQS = [
  {
    q: 'What type of food does Diljit Tiffin Service provide?',
    a: 'We specialize in authentic North Indian food prepared fresh for wholesome everyday dining, cooked using high-quality ingredients and traditional recipes.',
  },
  {
    q: 'What meal options and rates are available?',
    a: 'We offer Lunch Only (₹2,600), Dinner Only (₹2,600), Breakfast Only (₹2,000), and Individual Meals (₹150). You can choose the meal option that best fits your daily routine.',
  },
  {
    q: 'How does meal carry-forward work?',
    a: "Unused eligible meals can be carried forward according to the service's existing carry-forward policy when cancelled in advance before the daily cutoff.",
  },
  {
    q: 'Is delivery included with the meal plans?',
    a: 'Yes, enjoy free delivery with the service right to your doorstep for every scheduled meal.',
  },
  {
    q: 'Can I customize my meals?',
    a: 'Yes, you can customize meals according to the options supported by the service. Coordinate your preferences directly with us on WhatsApp.',
  },
  {
    q: 'How do I start a meal plan or place an order?',
    a: 'Click "Message Us on WhatsApp" below the meal plans or reach out via our contact number. Subscriptions and daily delivery details are coordinated seamlessly through WhatsApp.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section">
      <div className="container-x max-w-3xl">
        <SectionHeading title="Frequently asked questions" />
        <div className="divide-y divide-line rounded-xl border border-line bg-bg2">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <h3>
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-lg font-semibold"
                  >
                    {f.q}
                    <ChevronDown className={`h-5 w-5 shrink-0 text-leaf transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                </h3>
                <div
                  id={`faq-${i}`}
                  role="region"
                  aria-hidden={!isOpen}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden"><p className="px-5 pb-5 text-muted">{f.a}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
