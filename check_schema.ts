import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + process.env.VITE_SUPABASE_ANON_KEY }});
  const json = await res.json();
  const schemas = json.definitions || (json.components && json.components.schemas);
  console.log(Object.keys(schemas.schools.properties));
  console.log("global_settings details:", schemas.schools.properties.global_settings);
}
run();
