import { Link } from 'react-router-dom';
import SectionHeading from '../common/SectionHeading';
import MealPricingCard from '../pricing/MealPricingCard';
import { useAppData } from '../../context/AppDataContext';
import { MEAL_RATES } from '../../data/mockPlans';

export default function PlansPreview() {
  const { mealRates = MEAL_RATES } = useAppData();

  return (
    <section className="section" id="rates">
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
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/plans"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-bg2 px-6 py-3 text-sm font-bold text-ink transition-colors hover:border-brand hover:bg-white"
          >
            <span>View All Rate Details &amp; Policies</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

