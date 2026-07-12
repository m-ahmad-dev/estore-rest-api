import * as dashboardService from './dashboard.service.js';
import { asyncWrapper } from '../../core/utils/trycatch.js';

// Return the main dashboard summary payload.
export const viewDashboard = asyncWrapper(async (req, res) => {
  const result = await dashboardService.makeDashboardReport();
  res.status(200).json(result);
});

// Return KPI stats for the requested period.
export const viewStats = asyncWrapper(async (req, res) => {
  const { period } = req.query;
  const result = await dashboardService.makeDashboardStats(period);

  res.status(200).json(result);
});

// Return chart datasets for the requested period.
export const viewCharts = asyncWrapper(async (req, res) => {
  const { period } = req.query;
  const result = await dashboardService.makeDashboardCharts(period);

  res.status(200).json(result);
});

// Return actionable alerts for the dashboard.
export const viewAlerts = asyncWrapper(async (req, res) => {
  const result = await dashboardService.makeDashboardAlerts();
  res.status(200).json(result);
});

export const viewActivity = asyncWrapper(async (req, res) => {
  const result = await dashboardService.makeDashboardActivity();
  res.status(200).json(result);
});
