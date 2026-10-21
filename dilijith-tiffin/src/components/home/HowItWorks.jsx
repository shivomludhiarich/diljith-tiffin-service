import { CalendarCheck, ListChecks, UtensilsCrossed } from 'lucide-react';
import SectionHeading from '../common/SectionHeading';

const STEPS = [
  {
    icon: ListChecks,
    title: 'Choose Your Meal Option',
    text: 'Select Lunch Only, Dinner Only, Breakfast Only, or Individual Meals that fit your dining routine.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Enquire & Customize',
    text: 'Connect with us on WhatsApp to set your meal preferences, start date, and delivery details.',
  },
  {
    icon: CalendarCheck,
    title: 'Enjoy Fresh Tiffins',
    text: 'Receive authentic North Indian meals delivered fresh to your doorstep with free delivery.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section border-y border-line bg-bg2">
      <div className="container-x">
        <SectionHeading title="How it works" subtitle="Three simple steps from sign-up to your first tiffin." />
        <ol className="grid gap-8 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-white text-brand">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl"><span className="sr-only">Step {i + 1}: </span>{title}</h3>
                <p className="mt-1 text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
