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
  const url = 'https://hn.algolia.com/api/v1/search_by_date?tags=job&hitsPerPage=20';
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HackerNews API Error: ${response.status} - ${response.statusText}`);
    }
    
    const apiPayload = await response.json();
    const allRawJobs = apiPayload.hits || [];

    if (allRawJobs.length === 0) {
      return new Response(JSON.stringify({ message: "no jobs fetched" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    console.log(`Success: Fetched ${allRawJobs.length} jobs from Hacker News.`);

    const formattedJobs = allRawJobs.map((job: any) => {
      const fullTitle = job.title || '';
      let company = 'Unknown Startup';
      let title = fullTitle;

      const hiringRegex = /\s+is hiring\s+/i;
      let parts: string[] = [];

      if (hiringRegex.test(fullTitle)) {
        parts = fullTitle.split(hiringRegex);
      } else if (fullTitle.includes('|')) {
        parts = fullTitle.split('|');
      } else if (fullTitle.includes(' - ')) {
        parts = fullTitle.split(' - ');
      } else if (fullTitle.includes(':')) {
        parts = fullTitle.split(':');
      }

      if (parts.length > 1) {
        company = parts[0].trim();
        title = parts.slice(1).join(' ').trim(); 
      }

      company = company.replace(/\(YC\s+[A-Z0-9]+\)/i, '').trim();
      title = title.replace(/^(for|a|an|the|in)\s+/i, '').trim();
      
      if (title.length > 0) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
      }

      const isRemote = /remote/i.test(fullTitle);

      let rawCity = 'San Francisco'; 
      let rawCountry = 'United States';
      const titleLower = fullTitle.toLowerCase();

      if (titleLower.match(/\b(new york|nyc)\b/)) {
        rawCity = 'New York';
        rawCountry = 'United States';
      } else if (titleLower.match(/\b(london)\b/)) {
        rawCity = 'London';
        rawCountry = 'United Kingdom';
      } else if (titleLower.match(/\b(toronto)\b/)) {
        rawCity = 'Toronto';
        rawCountry = 'Canada';
      } else if (titleLower.match(/\b(berlin)\b/)) {
        rawCity = 'Berlin';
        rawCountry = 'Germany';
      } else if (titleLower.match(/\b(seattle)\b/)) {
        rawCity = 'Seattle';
        rawCountry = 'United States';
      } else if (titleLower.match(/\b(austin)\b/)) {
        rawCity = 'Austin';
        rawCountry = 'United States';
      } else if (titleLower.match(/\b(boston)\b/)) {
        rawCity = 'Boston';
        rawCountry = 'United States';
      } else if (titleLower.match(/\b(paris)\b/)) {
        rawCity = 'Paris';
        rawCountry = 'France';
      } else if (titleLower.match(/\b(amsterdam)\b/)) {
        rawCity = 'Amsterdam';
        rawCountry = 'Netherlands';
      } else if (titleLower.match(/\b(sydney)\b/)) {
        rawCity = 'Sydney';
        rawCountry = 'Australia';
      } else if (titleLower.match(/\b(san francisco|sf|bay area)\b/)) {
        rawCity = 'San Francisco';
        rawCountry = 'United States';
      }

      const { finalCity: validatedCity, finalCountry: validatedCountry } = processLocation(rawCity, rawCountry);

      const sourceUrl = job.url ? job.url : `https://news.ycombinator.com/item?id=${job.objectID}`;

      let cleanDesc = '';
      if (job.story_text) {
        cleanDesc = job.story_text
          .replace(/<[^>]*>?/gm, '') 
          .replace(/\s+/g, ' ')      
          .trim();
      }

      const mappedWorkMode = isRemote ? 'REMOTE' : 'ONSITE';
      const mappedType = 'FULLTIME';
      const mappedIndustry = 'Enterprise Software'; // HN is heavily skewed towards this

      // --- KEYWORD EXTRACTOR ---
      const combinedText = `${title} ${company} ${mappedIndustry} ${mappedType} ${mappedWorkMode}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const stopWords = new Set(['and', 'or', 'the', 'in', 'of', 'for', 'a', 'to', 'with', 'is', 'hiring', 'looking']);
      const rawKeywords = combinedText.split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
      const finalKeywords = [...new Set(rawKeywords)];

      return {
        job_title: title.substring(0, 200),
        company_name: company.substring(0, 100),
        job_description: cleanDesc, 
        source_urls: [sourceUrl],
        location_city: validatedCity, 
        location_country: validatedCountry, 
        work_mode: mappedWorkMode, 
        job_type: mappedType, 
        industry: mappedIndustry, 
        experience: /senior|lead|principal/i.test(fullTitle) ? 'SENIOR' : 'ENTRY', 
        event_date: job.created_at ? job.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
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

    console.log(`Success: Inserted ${data ? data.length : 0} HN jobs into job_alerts table.`);

    return new Response(JSON.stringify({ 
      success: true, 
      jobs_inserted: data ? data.length : 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})