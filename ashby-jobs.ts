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

    // 1. Alias translation (e.g., USA -> United States)
    if (country && COUNTRY_ALIASES[country.toUpperCase()]) {
        country = COUNTRY_ALIASES[country.toUpperCase()];
    }

    // 2. The Library Mapper: If we have a City but no Country, find it!
    if (city && !country) {
        const foundCities = City.getAllCities().filter((c: any) => c.name.toLowerCase() === city.toLowerCase());
        if (foundCities.length > 0) {
            // Grab the first match's country code and translate it to the full name
            const countryObj = Country.getCountryByCode(foundCities[0].countryCode);
            if (countryObj) country = countryObj.name;
        }
    }

    // 3. The Strict Array Bouncer: Validate the country
    if (country) {
        // Capitalize first letters so it matches the Set properly
        const formattedCountry = country.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        if (!VALID_COUNTRIES.has(formattedCountry)) {
            // If the API sent "EMEA" or "Anywhere", kill it.
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
  // 1. DEFINE YOUR TARGET ASHBY COMPANIES
  const companies = [
    { token: 'openai', name: 'OpenAI' },
    { token: 'notion', name: 'Notion' },
    { token: 'anthropic', name: 'Anthropic' },
    { token: 'linear', name: 'Linear' },
    { token: 'ashby', name: 'Ashby' },
    { token: 'perplexity', name: 'Perplexity AI' },
    { token: 'cohere', name: 'Cohere' },
    { token: 'rad-ai', name: 'Rad AI' },
    { token: 'vercel', name: 'Vercel' },
    { token: 'supabase', name: 'Supabase' },
    { token: 'replit', name: 'Replit' },
    { token: 'retool', name: 'Retool' },
    { token: 'hackerone', name: 'HackerOne' },
    { token: 'ramp', name: 'Ramp' },
    { token: 'deel', name: 'Deel' },
    { token: 'cryptio', name: 'Cryptio' },
    { token: '1password', name: '1Password' },
    { token: 'quora', name: 'Quora' },
    { token: 'helpscout', name: 'Help Scout' },
    { token: 'scribe', name: 'Scribe' },
    { token: 'deliveroo', name: 'Deliveroo' },
    { token: 'gamechanger', name: 'GameChanger' }
  ];

  let allFormattedJobs: any[] = [];

  try {
    for (const company of companies) {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${company.token}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Skipping ${company.name} - Board might not exist or errored: ${response.status}`);
        continue; 
      }

      const apiPayload = await response.json();
      const rawJobs = apiPayload.jobs || []; 

      console.log(`Fetched ${rawJobs.length} jobs for ${company.name}`);

      const mappedJobs = rawJobs.map((job: any) => {
        const rawDesc = job.descriptionHtml || job.descriptionPlain || '';
        const cleanDesc = rawDesc
          .replace(/<[^>]*>?/gm, '') 
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();

        let mappedWorkMode = 'ONSITE';
        if (job.workplaceType) {
            const wt = String(job.workplaceType).toUpperCase();
            if (wt.includes('REMOTE')) mappedWorkMode = 'REMOTE';
            else if (wt.includes('HYBRID')) mappedWorkMode = 'HYBRID';
        } else if (job.isRemote) { 
            mappedWorkMode = 'REMOTE';
        }

        let mappedType = 'FULLTIME';
        if (job.employmentType) {
            const et = String(job.employmentType).toUpperCase();
            if (et.includes('CONTRACT')) mappedType = 'CONTRACT';
            else if (et.includes('INTERN')) mappedType = 'INTERNSHIP';
            else if (et.includes('PART')) mappedType = 'PARTTIME';
        }

        // --- ASHBY LOCATION ---
        let rawCity = 'NULL';
        let rawCountry = 'NULL';

        if (job.address && job.address.postalAddress) {
            rawCity = job.address.postalAddress.addressLocality || 'NULL';
            rawCountry = job.address.postalAddress.addressCountry || 'NULL';
        } else if (job.location) {
            const parts = job.location.split(',');
            if (parts.length > 0) rawCity = parts[0].trim();
            if (parts.length > 1) rawCountry = parts[parts.length - 1].trim();
        }

        const { finalCity: city, finalCountry: country } = processLocation(rawCity, rawCountry);

        let mappedExp = 'ENTRY';
        const titleLower = (job.title || '').toLowerCase();
        if (titleLower.includes('senior') || titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff')) {
            mappedExp = 'SENIOR';
        } else if (titleLower.includes('mid')) {
            mappedExp = 'MIDLEVEL';
        } else if (titleLower.includes('head') || titleLower.includes('director') || titleLower.includes('vp')) {
            mappedExp = 'EXECUTIVE';
        }

        return {
          job_title: job.title ? job.title.substring(0, 200) : 'Unknown Title', 
          company_name: company.name, 
          job_description: cleanDesc,
          source_urls: job.jobUrl ? [job.jobUrl] : [], 
          location_city: city,
          location_country: country,
          work_mode: mappedWorkMode,
          job_type: mappedType, 
          industry: job.department ? String(job.department) : 'Sector Agnostic',
          experience: mappedExp,
          event_date: job.publishedAt ? job.publishedAt.split('T')[0] : new Date().toISOString().split('T')[0],
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

    console.log(`Success: Inserted ${data ? data.length : 0} Ashby jobs.`);

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