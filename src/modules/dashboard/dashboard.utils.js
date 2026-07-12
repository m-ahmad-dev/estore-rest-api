// Return the percent change between two values for trend cards.
export const calculateTrend = (current, previous) => {
  if (previous === 0) {
    return {
      value: current,
      changePercent: current === 0 ? 0 : null,
      isNew: current > 0,
    };
  }

  const changePercent = ((current - previous) / previous) * 100;

  return {
    value: current,
    changePercent: Number(changePercent.toFixed(2)),
    isNew: false,
  };
};

export const VALID_PERIODS = ['today', '7d', '30d', 'last_year'];
const DEFAULT_PERIOD = 'today';

// Resolve a dashboard period into start/end boundaries and chart granularity.
export const resolvePeriodRange = (period) => {
  const resolvedPeriod = VALID_PERIODS.includes(period)
    ? period
    : DEFAULT_PERIOD;

  const now = new Date();

  switch (resolvedPeriod) {
    case 'today': {
      const currentStart = startOfUTCDay(now);
      const previousStart = new Date(currentStart);
      previousStart.setUTCDate(previousStart.getUTCDate() - 1);
      return {
        period: resolvedPeriod,
        granularity: 'hour',
        now,
        currentStart,
        currentEnd: now,
        previousStart,
        previousEnd: currentStart,
      };
    }
    case '7d': {
      const currentStart = startOfUTCDay(now);
      currentStart.setUTCDate(currentStart.getUTCDate() - 6);
      const previousStart = new Date(currentStart);
      previousStart.setUTCDate(previousStart.getUTCDate() - 7);
      return {
        period: resolvedPeriod,
        granularity: 'day',
        now,
        currentStart,
        currentEnd: now,
        previousStart,
        previousEnd: currentStart,
      };
    }
    case '30d': {
      const currentStart = startOfUTCDay(now);
      currentStart.setUTCDate(currentStart.getUTCDate() - 29);
      const previousStart = new Date(currentStart);
      previousStart.setUTCDate(previousStart.getUTCDate() - 30);
      return {
        period: resolvedPeriod,
        granularity: 'day',
        now,
        currentStart,
        currentEnd: now,
        previousStart,
        previousEnd: currentStart,
      };
    }
    case 'last_year': {
      const currentStart = startOfUTCMonth(now);
      currentStart.setUTCMonth(currentStart.getUTCMonth() - 11);
      const previousStart = new Date(currentStart);
      previousStart.setUTCMonth(previousStart.getUTCMonth() - 12);
      return {
        period: resolvedPeriod,
        granularity: 'month',
        now,
        currentStart,
        currentEnd: now,
        previousStart,
        previousEnd: currentStart,
      };
    }
  }
};

// Return the start of the current UTC day.
function startOfUTCDay(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}

// Return the start of the current UTC month.
function startOfUTCMonth(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
  );
}
