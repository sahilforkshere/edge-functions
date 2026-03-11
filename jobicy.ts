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
  const url = 'https://jobicy.com/api/v2/remote-jobs?count=50';
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Jobicy API Error: ${response.status}`);
    }
    
    const apiPayload = await response.json();
    const allRawJobs = apiPayload.jobs || [];

    if (allRawJobs.length === 0) {
      return new Response(JSON.stringify({ message: "No jobs fetched" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    console.log(`Success: Fetched ${allRawJobs.length} jobs from Jobicy.`);

    const formattedJobs = allRawJobs.map((job: any) => {
      
      const rawDesc = job.jobDescription || '';
      const cleanDesc = rawDesc
        .replace(/<[^>]*>?/gm, '') 
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      // --- JOBICY LOCATION PARSER ---
      // We pass the raw string straight to V7! No need to manually split by comma anymore.
      const rawGeo = job.jobGeo || '';
      const { finalCity: city, finalCountry: country } = processLocation(rawGeo);

      let mappedExp = 'ENTRY';
      const rawLevel = String(job.jobLevel || '').toLowerCase();
      if (rawLevel.includes('senior') || rawLevel.includes('lead') || rawLevel.includes('principal')) {
          mappedExp = 'SENIOR';
      } else if (rawLevel.includes('mid')) {
          mappedExp = 'MIDLEVEL';
      } else if (rawLevel.includes('management') || rawLevel.includes('exec') || rawLevel.includes('director')) {
          mappedExp = 'EXECUTIVE';
      }

      let mappedType = 'FULLTIME';
      const rawType = String(job.jobType || '').toLowerCase();
      if (rawType.includes('contract') || rawType.includes('freelance')) {
          mappedType = 'CONTRACT';
      } else if (rawType.includes('intern')) {
          mappedType = 'INTERNSHIP';
      } else if (rawType.includes('part')) {
          mappedType = 'PARTTIME';
      }

      let mappedIndustry = 'Sector Agnostic'; 
      let cleanIndustryStr = String(job.jobIndustry || '')
                                .replace(/&amp;/g, '&')
                                .replace(/&nbsp;/g, ' ')
                                .trim();
      
      const rawIndustry = cleanIndustryStr.toLowerCase();
      
      if (rawIndustry.includes('crypto') || rawIndustry.includes('web3')) {
          mappedIndustry = 'Cryptocurrency & Web3';
      } else if (rawIndustry.includes('marketing') || rawIndustry.includes('seo') || rawIndustry.includes('advertising') || rawIndustry.includes('pr')) {
          mappedIndustry = 'Advertising & PR';
      } else if (rawIndustry.includes('commerce') || rawIndustry.includes('seller')) {
          mappedIndustry = 'E-commerce';
      } else if (rawIndustry.includes('data') || rawIndustry.includes('analytics') || rawIndustry.includes('intelligence')) {
          mappedIndustry = 'Business Intelligence';
      } else if (rawIndustry.includes('design') || rawIndustry.includes('ui/ux')) {
          mappedIndustry = 'Design & UI/UX';
      } else if (rawIndustry.includes('software') || rawIndustry.includes('programming') || rawIndustry.includes('developer')) {
          mappedIndustry = 'Enterprise Software'; 
      } else if (rawIndustry.includes('education') || rawIndustry.includes('learning')) {
          mappedIndustry = 'EdTech'; 
      } else if (rawIndustry.includes('sales') || rawIndustry.includes('business development') || rawIndustry.includes('account')) {
          mappedIndustry = 'CRM & Sales Tech'; 
      } else if (rawIndustry.includes('finance') || rawIndustry.includes('accounting')) {
          mappedIndustry = 'Capital Markets';
      } else if (rawIndustry.includes('security')) {
          mappedIndustry = 'Cybersecurity';
      } else {
          mappedIndustry = 'Sector Agnostic';
      }

      // --- KEYWORD EXTRACTOR ---
      const rawTitle = job.jobTitle || '';
      const mappedWorkMode = 'REMOTE'; // Jobicy is exclusively remote
      
      // We combine the raw title, raw industry string, our mapped industry, and the job type
      const combinedText = `${rawTitle} ${cleanIndustryStr} ${mappedIndustry} ${mappedType} ${mappedWorkMode}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const stopWords = new Set(['and', 'or', 'the', 'in', 'of', 'for', 'a', 'to', 'with']);
      const rawKeywords = combinedText.split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
      const finalKeywords = [...new Set(rawKeywords)];

      return {
        job_title: job.jobTitle ? job.jobTitle.substring(0, 200) : 'Unknown Title',
        company_name: job.companyName ? job.companyName.substring(0, 100) : 'Unknown Company',
        job_description: cleanDesc, 
        source_urls: job.url ? [job.url] : [],
        location_city: city, 
        location_country: country, 
        work_mode: mappedWorkMode,
        job_type: mappedType, 
        industry: mappedIndustry, 
        experience: mappedExp, 
        event_date: job.pubDate ? job.pubDate.split(' ')[0] : new Date().toISOString().split('T')[0],
        webhook_event_id: null,
        keywords: finalKeywords // 🌟 Added array for the Postgres index
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

    console.log(`Success: Inserted ${data ? data.length : 0} Jobicy jobs.`);

    return new Response(JSON.stringify({ 
      success: true, 
      jobs_inserted: data ? data.length : 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})