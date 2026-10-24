import { reconcileMeals } from '../services/automaticConsumption.js';
import express from 'express';
import {
  getUserDashboard,
  getTodaysMeals,
  getRecentMealActivity,
  cancelUserMeal,
} from '../controllers/userController.js';
import { updateAddress, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(reconcileMeals);

router.get('/dashboard', getUserDashboard);
router.get('/meals/today', getTodaysMeals);
router.get('/meals/recent', getRecentMealActivity);
router.post('/meals/:id/cancel', cancelUserMeal);

// Address management
router.get('/me', getMe);
router.patch('/me/address', updateAddress);

export default router;
