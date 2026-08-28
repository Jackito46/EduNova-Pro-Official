import https from 'https';

const req = https.get('https://iymzthjkucvhyjnxpslg.supabase.co/rest/v1/', (res) => {
  console.log('statusCode:', res.statusCode);
  process.exit(0);
}).on('error', (e) => {
  console.error(e);
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.log('Timeout');
  req.abort();
  process.exit(1);
});
