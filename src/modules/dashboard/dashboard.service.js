import { resolvePeriodRange } from './dashboard.utils.js';
import * as dashboardMetrics from './dashboard.metrics.js';
import DashboardRepository from './dashboard.repository.js';

// Create the start timestamps needed for the dashboard report ranges.
const getReportBoundaries = () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  return {
    now,
    startOfToday: new Date(Date.UTC(y, m, d)),
    startOfThisMonth: new Date(Date.UTC(y, m, 1)),
  };
};

// Build the main dashboard summary payload for the report endpoint.
export const makeDashboardReport = async () => {
  const boundaries = getReportBoundaries();

  const [
    sales,
    orders,
    customers,
    products,
    inventory,
    reviews,
    coupons,
    categories,
  ] = await Promise.all([
    dashboardMetrics.getSalesMetrics(undefined, boundaries),
    dashboardMetrics.getOrderMetrics(),
    dashboardMetrics.getCustomerMetrics(undefined, boundaries),
    dashboardMetrics.getProductMetrics(),
    dashboardMetrics.getInventoryMetrics(),
    dashboardMetrics.getReviewMetrics(),
    dashboardMetrics.getCouponMetrics(undefined, boundaries.now),
    dashboardMetrics.getCategoryMetrics(),
  ]);

  return {
    success: true,
    message: 'Dashboard data retrieved successfully',
    data: {
      sales,
      orders,
      customers,
      products,
      inventory,
      reviews,
      coupons,
      categories,
    },
  };
};

// Build KPI stats for the requested time period.
export const makeDashboardStats = async (period) => {
  const periodRange = resolvePeriodRange(period);

  const [
    sales,
    ordersCount,
    customersCount,
    products,
    pendingReviews,
    couponStats,
  ] = await Promise.all([
    dashboardMetrics.getPeriodSalesMetrics(undefined, periodRange),
    dashboardMetrics.getPeriodOrdersCount(undefined, periodRange),
    dashboardMetrics.getPeriodCustomersCount(undefined, periodRange),
    dashboardMetrics.getPeriodProductsMetrics(),
    dashboardMetrics.getPendingReviewsAlert(),
    dashboardMetrics.getCouponMetrics(undefined, new Date()),
  ]);

  return {
    success: true,
    message: 'Dashboard stats retrieved successfully',
    data: {
      sales,
      orders: { total: ordersCount },
      customers: { total: customersCount },
      products,
      reviews: { pending: pendingReviews.value },
      coupons: { active: couponStats.active },
    },
  };
};

// Build chart series for the requested time period.
export const makeDashboardCharts = async (period) => {
  const periodRange = resolvePeriodRange(period);

  const [
    revenueAndOrders,
    orderStatusDist,
    paymentMethodDist,
    customersSeries,
  ] = await Promise.all([
    dashboardMetrics.getRevenueAndOrdersSeries(
      undefined,
      periodRange
    ),
    dashboardMetrics.getOrderStatusDistribution(
      undefined,
      periodRange
    ),
    dashboardMetrics.getPaymentMethodDistribution(
      undefined,
      periodRange
    ),
    dashboardMetrics.getCustomerSeries(undefined, periodRange),
  ]);

  // Format chart buckets as YYYY-MM-DD values.
  const formatDate = (dateObj) => dateObj.toISOString().split('T')[0];

  const revenue = revenueAndOrders.map((item) => ({
    date: formatDate(item.bucket),
    amount: item.revenue,
  }));

  const orders = revenueAndOrders.map((item) => ({
    date: formatDate(item.bucket),
    count: item.orderCount,
  }));

  const customers = customersSeries.map((item) => ({
    date: formatDate(item.bucket),
    count: item.count,
  }));

  return {
    success: true,
    message: 'Dashboard charts retrieved successfully',
    data: {
      period: periodRange.period,
      revenue,
      orders,
      customers,
      paymentMethods: paymentMethodDist,
      orderStatus: orderStatusDist,
    },
  };
};

export const makeDashboardAlerts = async () => {
  const now = new Date();

  // Fetch all required data concurrently
  const [
    stockStats,
    pendingReviews,
    couponStats,
    unpaidOrders,
    failedPayments,
  ] = await Promise.all([
    dashboardMetrics.getInventoryMetrics(),
    dashboardMetrics.getPendingReviewsAlert(),
    dashboardMetrics.getCouponMetrics(undefined, now),
    DashboardRepository.orders.count({ payment_status: 'UNPAID' }),
    DashboardRepository.orders.count({ payment_status: 'CANCELLED' }),
  ]);

  const alerts = [];

  if (stockStats.lowStock > 0) {
    alerts.push({
      type: 'LOW_STOCK',
      severity: 'warning',
      title: 'Low inventory',
      message: `${stockStats.lowStock} product variants are running low on stock.`,
      action: '/products',
    });
  }

  if (stockStats.outOfStock > 0) {
    alerts.push({
      type: 'OUT_OF_STOCK',
      severity: 'error',
      title: 'Out of stock',
      message: `${stockStats.outOfStock} product variants are out of stock.`,
      action: '/products',
    });
  }

  if (pendingReviews.value > 0) {
    alerts.push({
      type: 'PENDING_REVIEWS',
      severity: 'info',
      title: 'Reviews awaiting moderation',
      message: `${pendingReviews.value} reviews require approval.`,
      action: '/reviews',
    });
  }

  if (couponStats.expired > 0) {
    alerts.push({
      type: 'EXPIRED_COUPONS',
      severity: 'warning',
      title: 'Expired coupons',
      message: `${couponStats.expired} coupons have expired.`,
      action: '/coupons',
    });
  }

  if (unpaidOrders > 0) {
    alerts.push({
      type: 'UNPAID_ORDERS',
      severity: 'warning',
      title: 'Unpaid orders',
      message: `${unpaidOrders} orders are awaiting payment.`,
      action: '/orders',
    });
  }

  if (failedPayments > 0) {
    alerts.push({
      type: 'FAILED_PAYMENTS',
      severity: 'error',
      title: 'Failed payments',
      message: `${failedPayments} payments have failed or been cancelled.`,
      action: '/orders',
    });
  }

  return {
    success: true,
    message: 'Dashboard alerts retrieved successfully',
    data: { alerts },
  };
};

export const makeDashboardActivity = async () => {
  // We only request the 20 most recent from each entity type.
  const raw =
    await DashboardRepository.activity.getRecentEntities(20);
  const activities = [];

  // Orders
  raw.orders.forEach((o) => {
    const customerName = o.customer
      ? `${o.customer.first_name} ${o.customer.last_name}`
      : o.guest_name || 'A guest';

    activities.push({
      type: 'ORDER_CREATED',
      title: 'New order placed',
      description: `Order #${o.order_number} was placed by ${customerName.trim()}.`,
      entity: { type: 'order', id: o.id },
      created_at: o.placed_at,
    });
  });

  // Customers
  raw.customers.forEach((c) => {
    activities.push({
      type: 'CUSTOMER_REGISTERED',
      title: 'New customer registered',
      description: `${c.first_name} ${c.last_name} created an account.`,
      entity: { type: 'customer', id: c.id },
      created_at: c.created_at,
    });
  });

  // Products
  raw.products.forEach((p) => {
    activities.push({
      type: 'PRODUCT_CREATED',
      title: 'Product created',
      description: `Product "${p.name}" was added to the catalog.`,
      entity: { type: 'product', id: p.id },
      created_at: p.created_at,
    });
  });

  // Reviews (Created & Approved)
  raw.reviews.forEach((r) => {
    activities.push({
      type: 'REVIEW_SUBMITTED',
      title: 'Review submitted',
      description: `A new review was submitted for "${r.product?.name || 'a product'}".`,
      entity: { type: 'review', id: r.id },
      created_at: r.created_at,
    });

    if (r.status === 'APPROVED' && r.approved_at) {
      activities.push({
        type: 'REVIEW_APPROVED',
        title: 'Review approved',
        description: `Review for "${r.product?.name || 'a product'}" was approved.`,
        entity: { type: 'review', id: r.id },
        created_at: r.approved_at,
      });
    }
  });

  // Categories (Created & Updated)
  raw.categories.forEach((c) => {
    activities.push({
      type: 'CATEGORY_CREATED',
      title: 'Category created',
      description: `Category "${c.name}" was created.`,
      entity: { type: 'category', id: c.id },
      created_at: c.created_at,
    });

    // Avoid duplication if it was just created (buffer of 1000ms)
    if (
      c.updated_at &&
      c.updated_at.getTime() - (c.created_at?.getTime() || 0) > 1000
    ) {
      activities.push({
        type: 'CATEGORY_UPDATED',
        title: 'Category updated',
        description: `Category "${c.name}" was updated.`,
        entity: { type: 'category', id: c.id },
        created_at: c.updated_at,
      });
    }
  });

  // Coupons (Created & State Changed)
  raw.coupons.forEach((c) => {
    activities.push({
      type: 'COUPON_CREATED',
      title: 'Coupon created',
      description: `Coupon code "${c.code}" was created.`,
      entity: { type: 'coupon', id: c.id },
      created_at: c.created_at,
    });

    if (
      c.updated_at &&
      c.updated_at.getTime() - c.created_at.getTime() > 1000
    ) {
      const state = c.is_active ? 'activated' : 'deactivated';
      activities.push({
        type: 'COUPON_UPDATED',
        title: `Coupon ${state}`,
        description: `Coupon code "${c.code}" was ${state}.`,
        entity: { type: 'coupon', id: c.id },
        created_at: c.updated_at,
      });
    }
  });

  // Sort all merged activities by timestamp descending and slice the top 20
  const sortedActivities = activities
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .slice(0, 20);

  return {
    success: true,
    message: 'Dashboard activity retrieved successfully',
    data: { activities: sortedActivities },
  };
};
