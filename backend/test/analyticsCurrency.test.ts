import {
  computeAnalyticsCurrencyTotals,
  resolveAnalyticsUsdToMxnRate,
} from '../src/utils/analyticsCurrency';

describe('analyticsCurrency', () => {
  const originalRate = process.env.ANALYTICS_USD_TO_MXN_RATE;

  afterEach(() => {
    if (originalRate === undefined) {
      delete process.env.ANALYTICS_USD_TO_MXN_RATE;
    } else {
      process.env.ANALYTICS_USD_TO_MXN_RATE = originalRate;
    }
  });

  it('returns null rate when env is missing or invalid', () => {
    delete process.env.ANALYTICS_USD_TO_MXN_RATE;
    expect(resolveAnalyticsUsdToMxnRate()).toBeNull();

    process.env.ANALYTICS_USD_TO_MXN_RATE = '0';
    expect(resolveAnalyticsUsdToMxnRate()).toBeNull();

    process.env.ANALYTICS_USD_TO_MXN_RATE = 'abc';
    expect(resolveAnalyticsUsdToMxnRate()).toBeNull();
  });

  it('parses USD->MXN rate from env', () => {
    process.env.ANALYTICS_USD_TO_MXN_RATE = '17.2567894';
    expect(resolveAnalyticsUsdToMxnRate()).toBe(17.256789);
  });

  it('computes split totals and converted MXN with explicit rate', () => {
    const totals = computeAnalyticsCurrencyTotals({
      mxn: 350,
      usd: 20,
      other: 99,
      usdToMxnRate: 17.5,
    });

    expect(totals).toEqual({
      mxn: 350,
      usd: 20,
      other: 99,
      convertedMxn: 700,
      usdToMxnRate: 17.5,
    });
  });

  it('uses env rate when explicit rate is not provided', () => {
    process.env.ANALYTICS_USD_TO_MXN_RATE = '18';
    const totals = computeAnalyticsCurrencyTotals({
      mxn: 100,
      usd: 10,
    });

    expect(totals.convertedMxn).toBe(280);
    expect(totals.usdToMxnRate).toBe(18);
  });
});

