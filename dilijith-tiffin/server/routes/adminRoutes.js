import express from 'express';
import {
  getAdminState,
  getUsers,
  createUser,
  allocateSubscription,
  adjustCredits,
  renewSubscription,
  cancelSubscription,
  getDashboardMetrics,
  getMealSummary,
  getMealDeliveries,
} from '../controllers/adminController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/state', getAdminState);
router.get('/dashboard', getDashboardMetrics);
router.get('/users', getUsers);
router.post('/users', createUser);
router.post('/subscriptions/allocate', allocateSubscription);
router.post('/subscriptions/:id/adjust', adjustCredits);
router.post('/subscriptions/:id/renew', renewSubscription);
router.post('/subscriptions/:id/cancel', cancelSubscription);

// Delivery workflow
router.get('/meals/summary', getMealSummary);
router.get('/meals/deliveries', getMealDeliveries);

export default router;
