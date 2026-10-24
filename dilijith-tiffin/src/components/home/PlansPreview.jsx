import { MessageCircle } from 'lucide-react';
import { WHATSAPP_URL } from '../../config/brand';
import SectionHeading from '../common/SectionHeading';
import MealPricingCard from '../pricing/MealPricingCard';
import { useAppData } from '../../context/AppDataContext';
import { MEAL_RATES } from '../../data/mockPlans';

export default function PlansPreview() {
  const { mealRates = MEAL_RATES } = useAppData();

  return (
    <section className="section scroll-mt-24" id="rates">
      <div className="container-x">
        <SectionHeading
          title="Our Meal Rates"
          subtitle="Authentic North Indian meals prepared fresh for everyday dining. Free delivery and meal carry-forward included."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {mealRates.map((rate) => (
            <MealPricingCard key={rate.id} rate={rate} />
          ))}
        </div>
        <div className="mt-10 rounded-3xl border border-line bg-gradient-to-br from-bg2 to-white p-8 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Order &amp; Enquire Directly on WhatsApp</h2>
              <p className="mt-2 max-w-xl text-muted">Subscriptions, renewals, and daily preferences are coordinated directly on WhatsApp for seamless, personal service.</p>
            </div>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-md transition-all hover:bg-brand/90 hover:shadow-lg"
              aria-label="Chat with Diljit Tiffin Service on WhatsApp (opens in new tab)">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              <span>Message Us on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

