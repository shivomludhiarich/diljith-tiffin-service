import { MessageCircle, ShieldCheck, Truck, RefreshCw, Sparkles } from 'lucide-react';
import MealPricingCard from '../components/pricing/MealPricingCard';
import { useAppData } from '../context/AppDataContext';
import { MEAL_RATES } from '../data/mockPlans';
import { BRAND, WHATSAPP_URL } from '../config/brand';
import { formatINR } from '../utils/pricing';

export default function Plans() {
  const { mealRates = MEAL_RATES } = useAppData();

  return (
    <div className="section">
      <div className="container-x">
        {/* Header */}
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/5 px-3.5 py-1 text-xs font-bold text-brand">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Authentic North Indian Food
          </span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Meal Rates &amp; Pricing
          </h1>
          <p className="mt-4 text-lg text-muted">
            Enjoy authentic North Indian meals prepared fresh for everyday dining. Choose the meal option that best fits your routine, with free delivery and meal carry-forward included.
          </p>
        </div>

        {/* 4 Meal-Based Pricing Cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {mealRates.map((rate) => (
            <MealPricingCard key={rate.id} rate={rate} />
          ))}
        </div>

        {/* Rate Summary Table for Quick Reference */}
        <section aria-labelledby="rate-table-heading" className="mt-16 rounded-2xl border border-line bg-bg2 p-6 sm:p-8">
          <h2 id="rate-table-heading" className="text-2xl font-bold">
            Rate List Overview
          </h2>
          <p className="mt-1 text-sm text-muted">
            Transparent pricing for everyday dining. Connect on WhatsApp to get started or customise your meals.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-muted">
                <tr>
                  <th scope="col" className="pb-3 font-bold">Meal Option</th>
                  <th scope="col" className="pb-3 font-bold">Description</th>
                  <th scope="col" className="pb-3 font-bold text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mealRates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-white/50 transition-colors">
                    <td className="py-4 font-semibold text-ink">
                      {rate.title}
                      {rate.recommended && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                          Popular
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-muted">{rate.description}</td>
                    <td className="py-4 text-right font-display text-lg font-bold text-ink">
                      {formatINR(rate.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Three Benefits Highlighted */}
        <section aria-labelledby="benefits-heading" className="mt-16">
          <h2 id="benefits-heading" className="text-2xl font-bold sm:text-3xl">
            Included with Every Meal Plan
          </h2>
          <p className="mt-2 text-muted">
            Everyday dining with flexibility, convenience, and home-style hospitality.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-bold">Meal Carry-Forward</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Unused eligible meals can be carried forward according to the service&apos;s existing carry-forward policy.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Truck className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-bold">Free Delivery</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Enjoy free delivery with the service right to your doorstep.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-bold">Meal Customization</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Customize meals according to the options supported by the service.
              </p>
            </div>
          </div>
        </section>

        {/* Ordering via WhatsApp Assistance */}
        <div className="mt-16 rounded-3xl border border-line bg-gradient-to-br from-bg2 to-white p-8 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Order &amp; Enquire Directly on WhatsApp</h2>
              <p className="mt-2 max-w-xl text-muted">
                Subscriptions, renewals, and daily preferences are coordinated directly on WhatsApp for seamless, personal service.
              </p>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-md transition-all hover:bg-brand/90 hover:shadow-lg"
              aria-label="Chat with Dilijith Tiffin Service on WhatsApp (opens in new tab)"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              <span>Message Us on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
