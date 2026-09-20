async function verifyAccountsAPIs() {
  const baseUrl = 'http://localhost:5000/api/v1';
  
  // 1. Login as Account User
  const loginRes = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'account@prozen.com', password: 'Prozen@123' }),
  });
  const loginData = (await loginRes.json()) as any;
  const token = loginData.data?.token;
  console.log('Login Status:', loginRes.status, 'Token received:', !!token);

  const authHeaders = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

  // 2. Test Dashboard Metrics
  const dashRes = await fetch(baseUrl + '/accounts/dashboard-metrics', { headers: authHeaders });
  const dashData = (await dashRes.json()) as any;
  console.log('\n--- DASHBOARD METRICS ---');
  console.log('Total Payables:', dashData.data?.totalPayables);
  console.log('Total Receivables:', dashData.data?.totalReceivables);
  console.log('Today Payments:', dashData.data?.todayPayments);
  console.log('Today Receipts:', dashData.data?.todayReceipts);
  console.log('Today Purchases:', dashData.data?.todayPurchases);
  console.log('Today Sales:', dashData.data?.todaySales);
  console.log('Total Expenses:', dashData.data?.totalExpenses);
  console.log('Total Income:', dashData.data?.totalIncome);
  console.log('Outstanding Amount:', dashData.data?.outstandingAmount);
  console.log('Active Parties:', dashData.data?.activeParties);
  console.log('Recent Transactions Count:', dashData.data?.recentTransactions?.length);

  // 3. Test Party Master List
  const partiesRes = await fetch(baseUrl + '/accounts/parties?limit=5', { headers: authHeaders });
  const partiesData = (await partiesRes.json()) as any;
  console.log('\n--- PARTY MASTER ---');
  console.log('Parties count:', partiesData.data?.length, 'Total:', partiesData.meta?.total);
  if (partiesData.data?.length) {
    const p = partiesData.data[0];
    console.log('Sample Party:', {
      code: p.code,
      name: p.name,
      type: p.type,
      mobile: p.mobile,
      store: p.store?.name,
      balance: p.balance,
      balanceType: p.balanceType,
      formattedBalance: p.formattedBalance,
    });
  }

  // 4. Test Party Ledger
  if (partiesData.data?.length) {
    const pId = partiesData.data[0].id;
    const ledgerRes = await fetch(baseUrl + '/accounts/parties/' + pId + '/ledger', { headers: authHeaders });
    const ledgerData = (await ledgerRes.json()) as any;
    console.log('\n--- PARTY LEDGER ---');
    console.log('Ledger Party:', ledgerData.data?.party?.name);
    console.log('Opening Balance:', ledgerData.data?.openingBalance);
    console.log('Closing Balance:', ledgerData.data?.closingBalance);
    console.log('Entries Count:', ledgerData.data?.entries?.length);
  }

  // 5. Test Submodules
  const [recRes, payRes, dayRes, cashRes, bankRes, repRes] = await Promise.all([
    fetch(baseUrl + '/accounts/receivables', { headers: authHeaders }).then(r => r.json()),
    fetch(baseUrl + '/accounts/payables', { headers: authHeaders }).then(r => r.json()),
    fetch(baseUrl + '/accounts/day-book', { headers: authHeaders }).then(r => r.json()),
    fetch(baseUrl + '/accounts/cash-book', { headers: authHeaders }).then(r => r.json()),
    fetch(baseUrl + '/accounts/bank-book', { headers: authHeaders }).then(r => r.json()),
    fetch(baseUrl + '/accounts/reports', { headers: authHeaders }).then(r => r.json()),
  ]);

  console.log('\n--- SUBMODULES VERIFICATION ---');
  console.log('Receivables total:', (recRes as any).data?.totalReceivables, 'Records:', (recRes as any).data?.records?.length);
  console.log('Payables total:', (payRes as any).data?.totalPayables, 'Records:', (payRes as any).data?.records?.length);
  console.log('Day Book entries:', (dayRes as any).data?.transactions?.length);
  console.log('Cash Book balance:', (cashRes as any).data?.balance, 'Entries:', (cashRes as any).data?.entries?.length);
  console.log('Bank Book balance:', (bankRes as any).data?.balance, 'Entries:', (bankRes as any).data?.entries?.length);
  console.log('Reports count:', (repRes as any).data?.availableReports?.length);
}

verifyAccountsAPIs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
