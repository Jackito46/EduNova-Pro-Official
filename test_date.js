const payments = [
  {
    id: '388fe040-c0da-425b-8186-7aa7ff798ace',
    created_at: '2026-05-09T13:24:42.932798+00:00',
    date: '2026-05-09',
    payment_method: 'Dépôt Bancaire',
    amount: 5000,
    status: 'VALIDE'
  }
];

const today = new Date();
// Simulate Haiti Time (UTC-4), but since my Node is here, it will use my current timezone (UTC).
// Wait, the agent's Node is in UTC!
today.setHours(0,0,0,0);

const todayValidPayments = payments.filter(p => {
  const pDate = new Date(p.created_at);
  pDate.setHours(0,0,0,0);
  return pDate.getTime() === today.getTime();
});

console.log("Today length:", todayValidPayments.length);
