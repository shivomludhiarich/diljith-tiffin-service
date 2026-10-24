import { reconcileMeals } from '../services/automaticConsumption.js';
import { allocateSubscription, adjustCredits, renewSubscription, cancelSubscription, consumeMeal } from '../controllers/creditController.js';
import express from 'express';
import { initiateCustomerReset } from '../controllers/passwordResetController.js';
import {
  getAdminState,
  getUsers,
  createUser,
  getDashboardMetrics,
  getMealSummary,
  getMealDeliveries,
} from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, adminOnly);
router.use(reconcileMeals);

router.get('/state', getAdminState);
router.get('/dashboard', getDashboardMetrics);
router.get('/users', getUsers);
router.post('/users', createUser);
router.post('/users/:id/reset-password', initiateCustomerReset);
router.post('/subscriptions/allocate', allocateSubscription);
router.post('/subscriptions/:id/adjust', adjustCredits);
router.post('/subscriptions/:id/renew', renewSubscription);
router.post('/subscriptions/:id/cancel', cancelSubscription);

// Delivery workflow
router.get('/meals/summary', getMealSummary);
router.get('/meals/deliveries', getMealDeliveries);
router.post('/meals/:id/consume', consumeMeal);

export default router;
