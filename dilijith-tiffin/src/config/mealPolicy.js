// Centralised, editable meal cancellation policy. The dashboard UI and the cancel command both read this file.
//
// dayOffset: 0 = same day as the meal, -1 = the evening before.   time: 24h "HH:MM" (local time).
// Policy: a meal cancelled BEFORE its deadline keeps its credit (it is never counted as consumed).
//         After the deadline the meal can no longer be cancelled.
export const MEAL_POLICY = {
  cancellation: {
    breakfast: { dayOffset: -1, time: '21:00' }, // 9:00 PM the evening before
    lunch: { dayOffset: 0, time: '10:00' },      // 10:00 AM on the day
    dinner: { dayOffset: 0, time: '19:00' },     // 7:00 PM on the day
  },
};
