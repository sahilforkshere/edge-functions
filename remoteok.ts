import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ==========================================
// --- UNIVERSAL LOCATION HELPER BLOCK ---
// ==========================================
import { City, Country } from 'npm:country-state-city';

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

function processLocation(rawCity: string | null | undefined, rawCountry: string | null | undefined) {
    let city = (rawCity && rawCity !== 'NULL') ? rawCity.trim() : '';
    let country = (rawCountry && rawCountry !== 'NULL') ? rawCountry.trim() : '';

    if (country && COUNTRY_ALIASES[country.toUpperCase()]) {
        country = COUNTRY_ALIASES[country.toUpperCase()];
    }

    if (city && !country) {
        const foundCities = City.getAllCities().filter((c: any) => c.name.toLowerCase() === city.toLowerCase());
        if (foundCities.length > 0) {
            const countryObj = Country.getCountryByCode(foundCities[0].countryCode);
            if (countryObj) country = countryObj.name;
        }
    }

    if (country) {
        const formattedCountry = country.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        if (!VALID_COUNTRIES.has(formattedCountry)) {
            country = 'NULL';
        } else {
            country = formattedCountry;
        }
    }

    return { 
        finalCity: city || 'NULL', 
        finalCountry: country || 'NULL' 
    };
}
// ==========================================

serve(async (req) => {
  const targetUrl = encodeURIComponent('https://remoteok.com/api');
  const proxyUrl = `https://api.allorigins.win/raw?url=${targetUrl}`;
  
  const options = {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  };

  try {
    const response = await fetch(proxyUrl, options);
    
    if (!response.ok) {
        throw new Error(`Proxy/RemoteOK Error: ${response.status} - ${response.statusText}`);
    }
    
    const apiData = await response.json();
    const validJobs = apiData.filter((job: any) => job.company && job.position);
    const jobsToInsert = validJobs.slice(0, 20);

    if (jobsToInsert.length > 0) {
      console.log(`Success: Fetched ${jobsToInsert.length} valid jobs from RemoteOK via Proxy.`);
    } else {
      console.log("no fetched");
      return new Response(JSON.stringify({ message: "no fetched" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const formattedJobs = jobsToInsert.map((job: any) => {
      const rawDesc = job.description || '';
      const cleanDesc = rawDesc
        .replace(/<[^>]*>?/gm, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      // --- REMOTEOK LOCATION PARSING ---
      let rawCity = 'NULL';
      let rawCountry = 'NULL';
      let cleanLoc = job.location || 'NULL';

      if (cleanLoc !== 'NULL') {
          cleanLoc = cleanLoc
              .replace(/remote/ig, '')
              .replace(/worldwide/ig, '')
              .replace(/anywhere/ig, '')
              .replace(/[-()]/g, '') 
              .trim();
          
          if (cleanLoc !== '') {
              // Try to split City and Country if comma exists
              if (cleanLoc.includes(',')) {
                  const parts = cleanLoc.split(',');
                  rawCity = parts[0].trim();
                  rawCountry = parts[parts.length - 1].trim();
              } else {
                  // Fallback: assume the whole string is the country
                  rawCountry = cleanLoc;
              }
          }
      }

      const { finalCity: city, finalCountry: country } = processLocation(rawCity, rawCountry);

      return {
        job_title: job.position || 'Unknown Title',
        company_name: job.company || 'Unknown Company',
        job_description: cleanDesc, 
        source_urls: job.apply_url ? [job.apply_url] : (job.url ? [job.url] : []),
        location_city: city, 
        location_country: country, 
        work_mode: 'REMOTE', 
        job_type: 'FULLTIME', 
        industry: job.tags && job.tags.length > 0 ? job.tags[0] : 'Technology', 
        experience: job.position && job.position.toLowerCase().includes('senior') ? 'SENIOR' : 'ENTRY', 
        event_date: job.date ? job.date.split('T')[0] : new Date().toISOString().split('T')[0],
        webhook_event_id: null  
      };
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('job_alerts')
      .insert(formattedJobs)
      .select();

    if (error) {
      console.error("Database Insert Error:", error.message);
      throw error;
    }

    console.log(`Success: Inserted ${data ? data.length : 0} jobs into job_alerts table.`);

    return new Response(JSON.stringify({ 
      success: true, 
      jobs_inserted: data ? data.length : 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})