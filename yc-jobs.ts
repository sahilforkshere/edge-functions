import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ==========================================
// --- UNIVERSAL LOCATION HELPER (V7 - LIBRARY + PRIORITY OVERRIDE) ---
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
  "US": "United States", "USA": "United States", "UNITED STATES OF AMERICA": "United States", "AMERICA": "United States",
  "UK": "United Kingdom", "ENGLAND": "United Kingdom", "GREAT BRITAIN": "United Kingdom",
  "UAE": "United Arab Emirates", "KOREA": "South Korea", "FR": "France", "DE": "Germany"
};

const TECH_HUB_OVERRIDES: Record<string, string> = {
  "cambridge": "United Kingdom", 
  "paris": "France",
  "london": "United Kingdom",
  "berlin": "Germany",
  "san francisco": "United States", "sf": "United States", "bay area": "United States", "silicon valley": "United States",
  "new york": "United States", "nyc": "United States",
  "boston": "United States",
  "austin": "United States",
  "toronto": "Canada",
  "sydney": "Australia",
  "dublin": "Ireland",
  "amsterdam": "Netherlands",
  "bangalore": "India", "bengaluru": "India",
  "san jose": "United States", "dallas": "United States", "redwood city": "United States", 
  "menlo park": "United States", "palo alto": "United States", "mountain view": "United States"
};

function processLocation(arg1: string | null | undefined, arg2?: string | null | undefined) {
    let fullString = [arg1, arg2].filter(Boolean).map(s => String(s).trim()).join(', ');
    
    if (!fullString || fullString.toLowerCase() === 'remote' || fullString === 'NULL') {
        return { finalCity: 'NULL', finalCountry: 'NULL' };
    }

    let validCountries: string[] = [];
    const delimiters = /[,;||\/]/;
    let tokens = fullString.split(delimiters).map(t => t.trim()).filter(Boolean);

    for (let token of tokens) {
        let c = token.replace(/remote|worldwide|anywhere|[-()]/ig, '').trim();
        if (c && COUNTRY_ALIASES[c.toUpperCase()]) c = COUNTRY_ALIASES[c.toUpperCase()];
        
        if (c) {
            c = c.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            if (VALID_COUNTRIES.has(c)) validCountries.push(c);
        }
    }

    let potentialCity = fullString.split(delimiters)[0].trim().replace(/remote|worldwide|anywhere/ig, '').trim();
    let finalCity = 'NULL';

    if (potentialCity) {
        let checkCityAsCountry = potentialCity.toUpperCase();
        if (COUNTRY_ALIASES[checkCityAsCountry]) checkCityAsCountry = COUNTRY_ALIASES[checkCityAsCountry].toUpperCase();
        else checkCityAsCountry = potentialCity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        if (VALID_COUNTRIES.has(checkCityAsCountry)) {
            finalCity = 'NULL'; 
            validCountries.push(checkCityAsCountry);
        } else {
            finalCity = potentialCity;
        }
    }

    if (validCountries.length === 0 && finalCity !== 'NULL') {
        const checkKey = finalCity.toLowerCase();
        if (TECH_HUB_OVERRIDES[checkKey]) {
            validCountries.push(TECH_HUB_OVERRIDES[checkKey]);
        }
    }

    if (validCountries.length === 0 && finalCity !== 'NULL') {
        const foundCity = City.getAllCities().find((c: any) => c.name.toLowerCase() === finalCity.toLowerCase());
        if (foundCity) {
            const countryObj = Country.getCountryByCode(foundCity.countryCode);
            if (countryObj) validCountries.push(countryObj.name);
        }
    }

    validCountries = [...new Set(validCountries)]; 

    return { 
        finalCity: finalCity || 'NULL', 
        finalCountry: validCountries.length > 0 ? validCountries.join(', ') : 'NULL' 
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
      
      if (!apiData || apiData.length === 0) {
        break;
      }
      
      allRawJobs = allRawJobs.concat(apiData);
    }

    if (allRawJobs.length > 0) {
      console.log(`Success: Fetched a total of ${allRawJobs.length} jobs from RapidAPI.`);
    } else {
      console.log("no fetched");
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

      const title = job.title || 'Unknown Title';
      const company = job.organization || 'Unknown Company';
      const mappedWorkMode = job.remote_derived ? 'REMOTE' : 'ONSITE';
      const mappedType = (job.employment_type && job.employment_type.length > 0) 
            ? (String(job.employment_type[0]).toLowerCase().includes('contract') ? 'CONTRACT' 
               : String(job.employment_type[0]).toLowerCase().includes('intern') ? 'INTERNSHIP' 
               : 'FULLTIME') 
            : 'FULLTIME';
      const mappedIndustry = title ? String(title) : 'Sector Agnostic';

      // --- KEYWORD EXTRACTOR ---
      const combinedText = `${title} ${company} ${mappedIndustry} ${mappedType} ${mappedWorkMode}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const stopWords = new Set(['and', 'or', 'the', 'in', 'of', 'for', 'a', 'to', 'with']);
      const rawKeywords = combinedText.split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
      const finalKeywords = [...new Set(rawKeywords)];

      return {
        job_title: title,
        company_name: company,
        job_description: finalDesc, 
        source_urls: job.url ? [job.url] : [], 
        location_city: city,
        location_country: country,
        work_mode: mappedWorkMode,
        job_type: mappedType,
        industry: mappedIndustry, 
        experience: title.toLowerCase().includes('senior') ? 'SENIOR' : 'ENTRY',    
        event_date: job.date_posted ? job.date_posted.split('T')[0] : new Date().toISOString().split('T')[0],
        webhook_event_id: null,
        keywords: finalKeywords // 🌟 Feeds the new array column!
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