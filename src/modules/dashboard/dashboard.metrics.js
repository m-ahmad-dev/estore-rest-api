import DashboardRepository from './dashboard.repository.js';
import { calculateTrend } from './dashboard.utils.js';

const BASE_ORDER_FILTER = {
  status: 'DELIVERED',
  payment_status: 'PAID',
};
const TOP_CATEGORIES_LIMIT = 5;

// Summary metrics for the main dashboard report.

// Return revenue and average order value across all time, today, and this month.
export const getSalesMetrics = async (
  client,
  { startOfToday, startOfThisMonth }
) => {
  const [allTime, today, month] = await Promise.all([
    DashboardRepository.orders.aggregateRevenue(
      BASE_ORDER_FILTER,
      client
    ),
    DashboardRepository.orders.aggregateRevenue(
      { ...BASE_ORDER_FILTER, placed_at: { gte: startOfToday } },
      client
    ),
    DashboardRepository.orders.aggregateRevenue(
      { ...BASE_ORDER_FILTER, placed_at: { gte: startOfThisMonth } },
      client
    ),
  ]);

  return {
    totalRevenue: allTime.totalRevenue,
    todayTotalRevenue: today.totalRevenue,
    monthTotalRevenue: month.totalRevenue,
    averageOrderValue: allTime.averageOrderValue,
  };
};

// Return order counts grouped by status.
export const getOrderMetrics = async (client) => {
  const [total, pending, processing, shipped, delivered, cancelled] =
    await Promise.all([
      DashboardRepository.orders.count({}, client),
      DashboardRepository.orders.count({ status: 'PENDING' }, client),
      DashboardRepository.orders.count(
        { status: 'PROCESSING' },
        client
      ),
      DashboardRepository.orders.count({ status: 'SHIPPED' }, client),
      DashboardRepository.orders.count(
        { status: 'DELIVERED' },
        client
      ),
      DashboardRepository.orders.count(
        { status: 'CANCELLED' },
        client
      ),
    ]);
  return {
    total,
    pending,
    processing,
    shipped,
    delivered,
    cancelled,
  };
};

// Return customer totals, new signups this month, and active accounts.
export const getCustomerMetrics = async (
  client,
  { startOfThisMonth }
) => {
  const [total, newThisMonth, active] = await Promise.all([
    DashboardRepository.customers.count({ deleted_at: null }, client),
    DashboardRepository.customers.count(
      { deleted_at: null, created_at: { gte: startOfThisMonth } },
      client
    ),
    DashboardRepository.customers.count(
      { deleted_at: null, is_active: true },
      client
    ),
  ]);
  return { total, newThisMonth, active };
};

// Return product totals and active product counts.
export const getProductMetrics = async (client) => {
  const [total, active] = await Promise.all([
    DashboardRepository.products.count({ deleted_at: null }, client),
    DashboardRepository.products.count(
      { deleted_at: null, is_active: true },
      client
    ),
  ]);
  return { total, active };
};

// Read stock availability details for product variants.
const getStockBreakdown = (client) =>
  DashboardRepository.productVariants.stockBreakdown(client);

// Return inventory summary values for the dashboard.
export const getInventoryMetrics = async (client) => {
  const { total, inStock, lowStock, outOfStock } =
    await getStockBreakdown(client);
  return { variants: total, inStock, lowStock, outOfStock };
};

// Return review totals, pending approvals, and average rating.
export const getReviewMetrics = async (client) => {
  const [total, pending, approved, averageRating] = await Promise.all(
    [
      DashboardRepository.reviews.count({}, client),
      DashboardRepository.reviews.count(
        { status: 'PENDING' },
        client
      ),
      DashboardRepository.reviews.count(
        { status: 'APPROVED' },
        client
      ),
      DashboardRepository.reviews.averageRating(client),
    ]
  );
  return { total, pending, approved, averageRating };
};

// Return coupon activity totals by state.
export const getCouponMetrics = async (client, now) =>
  DashboardRepository.coupons.statusBreakdown(now, client);

// Return category counts and root category counts.
export const getCategoryMetrics = async (client) => {
  const [total, rootCategories] = await Promise.all([
    DashboardRepository.categories.count({}, client),
    DashboardRepository.categories.count({ parent_id: null }, client),
  ]);
  return { total, rootCategories };
};

// Trend values for KPI cards.

// Return the revenue change between the current and previous periods.
export const getRevenueTrend = async (client, periodRange) => {
  const { current, previous } =
    await DashboardRepository.orders.revenueForPeriods(
      periodRange,
      client
    );
  return calculateTrend(current, previous);
};

// Return the order-count change between the current and previous periods.
export const getOrdersTrend = async (client, periodRange) => {
  const { current, previous } =
    await DashboardRepository.orders.countForPeriods(
      periodRange,
      client
    );
  return calculateTrend(current, previous);
};

// Return the new-customer change between the current and previous periods.
export const getNewCustomersTrend = async (client, periodRange) => {
  const { current, previous } =
    await DashboardRepository.customers.countForPeriods(
      periodRange,
      client
    );
  return calculateTrend(current, previous);
};

// Return the number of reviews waiting for approval.
export const getPendingReviewsAlert = async (client) => {
  const value = await DashboardRepository.reviews.count(
    { status: 'PENDING' },
    client
  );
  return { value };
};

// Return the count of low-stock and out-of-stock variants.
export const getLowStockAlert = async (client) => {
  const { lowStock, outOfStock } = await getStockBreakdown(client);
  return { value: lowStock + outOfStock };
};

// Series data for chart endpoints.

// Return revenue and order series for the selected period.
export const getRevenueAndOrdersSeries = async (
  client,
  periodRange
) => {
  return DashboardRepository.orders.revenueSeries(
    periodRange,
    client
  );
};

// Return order counts by status for the selected period.
export const getOrderStatusDistribution = async (
  client,
  periodRange
) => {
  return DashboardRepository.orders.statusDistributionForPeriod(
    periodRange,
    client
  );
};

// Return top categories ranked by revenue for the selected period.
export const getTopCategoriesByRevenue = async (
  client,
  periodRange
) => {
  return DashboardRepository.categories.topByRevenue(
    periodRange,
    TOP_CATEGORIES_LIMIT,
    client
  );
};

// Helpers for period-based summaries.

// Return revenue totals and average order value for a specific period.
export const getPeriodSalesMetrics = async (
  client,
  { currentStart, currentEnd }
) => {
  const data = await DashboardRepository.orders.aggregateRevenue(
    {
      ...BASE_ORDER_FILTER,
      placed_at: { gte: currentStart, lte: currentEnd },
    },
    client
  );
  return {
    totalRevenue: data.totalRevenue,
    averageOrderValue: data.averageOrderValue,
  };
};

// Return the order count for a specific period.
export const getPeriodOrdersCount = async (
  client,
  { currentStart, currentEnd }
) => {
  return DashboardRepository.orders.count(
    { placed_at: { gte: currentStart, lte: currentEnd } },
    client
  );
};

// Return the customer count for a specific period.
export const getPeriodCustomersCount = async (
  client,
  { currentStart, currentEnd }
) => {
  return DashboardRepository.customers.count(
    { created_at: { gte: currentStart, lte: currentEnd } },
    client
  );
};

// Return product totals and stock status for the current period.
export const getPeriodProductsMetrics = async (client) => {
  const [total, stock] = await Promise.all([
    DashboardRepository.products.count({ deleted_at: null }, client),
    getStockBreakdown(client),
  ]);
  return {
    total,
    variants: stock.total,
    lowStock: stock.lowStock,
    outOfStock: stock.outOfStock,
  };
};

export const getCustomerSeries = async (client, periodRange) => {
  return DashboardRepository.customers.series(periodRange, client);
};

export const getPaymentMethodDistribution = async (
  client,
  periodRange
) => {
  return DashboardRepository.orders.paymentMethodsForPeriod(
    periodRange,
    client
  );
};
