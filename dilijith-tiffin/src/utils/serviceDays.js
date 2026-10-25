// Meal dates are business calendar dates in IST, not the server's local weekday.
export const isServiceDay = date => new Date(`${date}T00:00:00Z`).getUTCDay() !== 0;

// Preserve stored accounting for audit; never present a Sunday as a delivery.
export const mealHistoryStatus = meal => isServiceDay(meal.date) ? meal.status : 'No service on Sundays';
export const needsSundayCreditReview = meal => !isServiceDay(meal.date) && (meal.status === 'Consumed' || meal.creditReviewRequired === true);
