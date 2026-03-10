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
  const baseUrl = 'https://free-y-combinator-jobs-api.p.rapidapi.com/active-jb-7d';
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': Deno.env.get('RAPIDAPI_KEY') ?? '', 
      'x-rapidapi-host': 'free-y-combinator-jobs-api.p.rapidapi.com'
    }
  };

  try {
    let allRawJobs: any[] = [];

    // --- PAGINATION LOOP: Fetching 20 jobs total (offset 0, then offset 10) ---
    for (let offset = 0; offset < 20; offset += 10) {
      const paginatedUrl = `${baseUrl}?offset=${offset}`;
      
      const response = await fetch(paginatedUrl, options);
      if (!response.ok) {
          throw new Error(`RapidAPI Error on offset ${offset}: ${response.status}`);
      }
      
      const apiData = await response.json();
      
      // If a page comes back empty, break the loop early
      if (!apiData || apiData.length === 0) {
        break;
      }
      
      // Add this page's jobs to our master array
      allRawJobs = allRawJobs.concat(apiData);
    }

    // --- CHECK FETCH SUCCESS ---
    if (allRawJobs.length > 0) {
      console.log(`Success: Fetched a total of ${allRawJobs.length} jobs from RapidAPI.`);
    } else {
      console.log("no fetched");
      // Stop the function completely if there's no data to insert
      return new Response(JSON.stringify({ message: "no fetched" }), { status: 200 });
    }

    // --- MAP TO DATABASE COLUMNS ---
    const formattedJobs = allRawJobs.map((job: any) => {
      
      const rawDesc = job.description || job.job_description || job.text_description || job.summary || '';
      
      const finalDesc = rawDesc.trim() !== '' 
        ? rawDesc 
        : `Explore the full role requirements, benefits, and apply directly at ${job.organization || 'this YC startup'} by clicking the link above.`;

      // --- YC LOCATION PARSING ---
      let rawCity = job.cities_derived && job.cities_derived.length > 0 ? job.cities_derived[0] : 'NULL';
      let rawCountry = job.countries_derived && job.countries_derived.length > 0 ? job.countries_derived[0] : 'NULL';

      const { finalCity: city, finalCountry: country } = processLocation(rawCity, rawCountry);

      return {
        job_title: job.title || 'Unknown Title',
        company_name: job.organization || 'Unknown Company',
        job_description: finalDesc, 
        source_urls: job.url ? [job.url] : [], 
        
        location_city: city,
        location_country: country,
        
        work_mode: job.remote_derived ? 'REMOTE' : 'ONSITE',
        
        // Safely parse the messy YC job_type strings into ALL CAPS UI buckets
        job_type: (job.employment_type && job.employment_type.length > 0) 
            ? (String(job.employment_type[0]).toLowerCase().includes('contract') ? 'CONTRACT' 
               : String(job.employment_type[0]).toLowerCase().includes('intern') ? 'INTERNSHIP' 
               : 'FULLTIME') 
            : 'FULLTIME',
        
        // Feed the title directly to the Postgres Fuzzy Matcher instead of a hardcoded string
        industry: job.title ? String(job.title) : 'Sector Agnostic', 
        
        experience: job.title && job.title.toLowerCase().includes('senior') ? 'SENIOR' : 'ENTRY',    
        event_date: job.date_posted ? job.date_posted.split('T')[0] : new Date().toISOString().split('T')[0],
        webhook_event_id: null  
      };
    });

    // --- DATABASE INSERTION ---
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