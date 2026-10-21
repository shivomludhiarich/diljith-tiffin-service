import { Bike, RotateCcw, SlidersHorizontal, Soup } from 'lucide-react';
import SectionHeading from '../common/SectionHeading';

const ITEMS = [
  {
    icon: RotateCcw,
    title: 'Meal Carry-Forward',
    text: "Unused eligible meals can be carried forward according to the service's existing carry-forward policy.",
  },
  {
    icon: Bike,
    title: 'Free Delivery',
    text: 'Enjoy free delivery with the service.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Meal Customization',
    text: 'Customize meals according to the options supported by the service.',
  },
  {
    icon: Soup,
    title: 'Authentic North Indian Food',
    text: 'Traditional home-style recipes prepared fresh every day for wholesome everyday dining.',
  },
];

export default function WhyUs() {
  return (
    <section className="section border-y border-line bg-bg2">
      <div className="container-x">
        <SectionHeading
          title="Why choose us"
          subtitle="Wholesome everyday dining with authentic flavors and customer-first flexibility."
        />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-line/60 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
