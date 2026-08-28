async function run() {
  const url = 'https://iymzthjkucvhyjnxpslg.supabase.co/rest/v1/global_settings?select=value&key=eq.system_status';
  const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
  
  try {
    console.log('Fetching from Supabase REST API...');
    const response = await fetch(url, {
      headers: {
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
    const text = await response.text();
    console.log('Body:', text);
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

run();
