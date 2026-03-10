import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ==========================================
// --- LIGHTWEIGHT LOCATION HELPER (V3) ---
// ==========================================
const VALID_COUNTRIES = new Set([
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
]);

const COUNTRY_ALIASES: Record<string, string> = {
  "US": "United States",
  "USA": "United States",
  "UK": "United Kingdom",
  "UAE": "United Arab Emirates",
  "AMERICA": "United States",
  "ENGLAND": "United Kingdom",
  "KOREA": "South Korea",
};

function processLocation(rawLocationString: string | null | undefined) {
    let input = (rawLocationString && rawLocationString !== 'NULL') ? String(rawLocationString).trim() : '';
    let validCountries: string[] = [];
    let primaryCity = 'NULL';

    if (!input || input.toLowerCase() === 'remote') {
        return { finalCity: 'NULL', finalCountry: 'NULL' };
    }

    // 1. Grab the first potential city (usually before the first comma or semicolon)
    if (input.includes(',')) primaryCity = input.split(',')[0].trim();
    else if (input.includes(';')) primaryCity = input.split(';')[0].trim();
    else primaryCity = input;

    primaryCity = primaryCity.replace(/remote|worldwide|anywhere/ig, '').trim();
    if(!primaryCity) primaryCity = 'NULL';

    // 2. Multi-Country Splitter: Chop the string by ANY delimiter to find ALL countries
    const delimiters = /[,;||\/]/;
    let tokens = input.split(delimiters).map(t => t.trim()).filter(Boolean);

    for (let token of tokens) {
        let c = token.replace(/remote|worldwide|anywhere|[-()]/ig, '').trim();
        
        if (c && COUNTRY_ALIASES[c.toUpperCase()]) {
             c = COUNTRY_ALIASES[c.toUpperCase()];
        }
        
        if (c) {
            c = c.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            if (VALID_COUNTRIES.has(c)) {
                validCountries.push(c); // Add to our list if it passes the bouncer!
            }
        }
    }

    validCountries = [...new Set(validCountries)]; // Deduplicate just in case

    return { 
        finalCity: primaryCity, 
        // Feed the SQL engine a beautifully clean string like: "Belgium, Austria, Denmark"
        finalCountry: validCountries.length > 0 ? validCountries.join(', ') : 'NULL' 
    };
}
// ==========================================

serve(async (req) => {
  const companies = [
    { token: 'twitch', name: 'Twitch' },
    { token: 'discord', name: 'Discord' },
    { token: 'figma', name: 'Figma' },
    { token: 'stripe', name: 'Stripe' },
    { token: 'notion', name: 'Notion' },
    { token: 'airbnb', name: 'Airbnb' },
    { token: 'reddit', name: 'Reddit' },
    { token: 'robinhood', name: 'Robinhood' },
    { token: 'coinbase', name: 'Coinbase' },
    { token: 'databricks', name: 'Databricks' },
    { token: 'openai', name: 'OpenAI' },
    { token: 'huggingface', name: 'Hugging Face' },
    { token: 'cloudflare', name: 'Cloudflare' },
    { token: 'dropbox', name: 'Dropbox' },
    { token: 'flexport', name: 'Flexport' },
    { token: 'gusto', name: 'Gusto' },
    { token: 'instacart', name: 'Instacart' },
    { token: 'plaid', name: 'Plaid' },
    { token: 'scaleai', name: 'Scale AI' },
    { token: 'segment', name: 'Segment' },
    { token: 'zapier', name: 'Zapier' },
    { token: 'hashicorp', name: 'HashiCorp' },
    { token: 'gitlab', name: 'GitLab' },
    { token: 'unity', name: 'Unity' },
    { token: 'intercom', name: 'Intercom' }
  ];

  let allFormattedJobs: any[] = [];

  try {
    for (const company of companies) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=true`;
      
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Skipping ${company.name} - Board might not exist or errored: ${response.status}`);
        continue; 
      }

      const apiPayload = await response.json();
      const rawJobs = apiPayload.jobs || [];

      console.log(`Fetched ${rawJobs.length} jobs for ${company.name}`);

      const mappedJobs = rawJobs.map((job: any) => {
        const title = job.title || 'Unknown Title';
        const locationString = (job.location && job.location.name) ? job.location.name : '';

        const isRemote = /remote/i.test(title) || /remote/i.test(locationString);

        let cleanDesc = '';
        if (job.content) {
          const unescapedContent = job.content
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');

          cleanDesc = unescapedContent
            .replace(/<[^>]*>?/gm, '') 
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        // Just pass the entire raw string straight into our new V3 Scanner
        const { finalCity: city, finalCountry: country } = processLocation(locationString);

        return {
          job_title: title.substring(0, 200),
          company_name: company.name, 
          job_description: cleanDesc,
          source_urls: job.absolute_url ? [job.absolute_url] : [],
          location_city: city,
          location_country: country,
          work_mode: isRemote ? 'REMOTE' : 'ONSITE',
          job_type: 'FULLTIME', 
          industry: title ? String(title) : 'Sector Agnostic',
          experience: /senior|lead|principal|staff|manager/i.test(title) ? 'SENIOR' : 'ENTRY',
          event_date: job.updated_at ? job.updated_at.split('T')[0] : new Date().toISOString().split('T')[0],
          webhook_event_id: null
        };
      });

      allFormattedJobs.push(...mappedJobs.slice(0, 5));
    }

    if (allFormattedJobs.length === 0) {
      return new Response(JSON.stringify({ message: "No jobs found across selected boards" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('job_alerts')
      .insert(allFormattedJobs)
      .select();

    if (error) {
      console.error("Database Insert Error:", error.message);
      throw error;
    }

    console.log(`Success: Inserted ${data ? data.length : 0} Greenhouse jobs.`);

    return new Response(JSON.stringify({ 
      success: true, 
      boards_scanned: companies.length,
      jobs_inserted: data ? data.length : 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})