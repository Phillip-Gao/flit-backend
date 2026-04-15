/*
  Simple trade concurrency smoke test.

  Usage:
    API_BASE_URL=http://localhost:3000/api \
    AUTH_TOKEN=<clerk-jwt> \
    GROUP_ID=<group-id> \
    TICKER=SPY \
    SHARES=1 \
    REQUESTS=5 \
    node scripts/test-trade-concurrency.js
*/

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const GROUP_ID = process.env.GROUP_ID;
const TICKER = process.env.TICKER || 'SPY';
const SHARES = Number(process.env.SHARES || 1);
const REQUESTS = Number(process.env.REQUESTS || 5);

if (!AUTH_TOKEN || !GROUP_ID) {
  console.error('Missing required env vars: AUTH_TOKEN and GROUP_ID');
  process.exit(1);
}

async function run() {
  const startedAt = Date.now();

  const requests = Array.from({ length: REQUESTS }).map((_, index) => {
    return fetch(`${API_BASE_URL}/fantasy-portfolio/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
        'x-idempotency-key': `concurrency-test-${index}`,
      },
      body: JSON.stringify({
        groupId: GROUP_ID,
        ticker: TICKER,
        shares: SHARES,
        tradeType: 'buy',
      }),
    }).then(async (res) => ({
      status: res.status,
      body: await res.json().catch(() => ({})),
    }));
  });

  const results = await Promise.all(requests);
  const success = results.filter((r) => r.status >= 200 && r.status < 300).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  const failures = results.length - success - conflicts;

  console.log('Trade concurrency test complete');
  console.log(`Total requests: ${results.length}`);
  console.log(`Success: ${success}`);
  console.log(`Serialization conflicts (expected under contention): ${conflicts}`);
  console.log(`Failures: ${failures}`);
  console.log(`Elapsed: ${Date.now() - startedAt}ms`);

  if (failures > 0) {
    console.log('Sample failure:', results.find((r) => r.status >= 400 && r.status !== 409));
  }
}

run().catch((error) => {
  console.error('Concurrency test failed:', error);
  process.exit(1);
});
