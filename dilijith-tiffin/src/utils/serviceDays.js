// Meal dates are business calendar dates in IST, not the server's local weekday.
export const isServiceDay = date => new Date(`${date}T00:00:00Z`).getUTCDay() !== 0;
