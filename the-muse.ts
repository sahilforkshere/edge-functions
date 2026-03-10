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
  "US": "United States", "USA": "United States", "UNITED STATES OF AMERICA": "United States", "AMERICA": "United States",
  "UK": "United Kingdom", "ENGLAND": "United Kingdom", "GREAT BRITAIN": "United Kingdom",
  "UAE": "United Arab Emirates", "KOREA": "South Korea", "FR": "France", "DE": "Germany"
};

// V6 Accepts 1 or 2 arguments so it works globally across all your scripts
function processLocation(arg1: string | null | undefined, arg2?: string | null | undefined) {
    
    // Combine inputs into one string (e.g., "Germany, UK" or "San Francisco, USA")
    let fullString = [arg1, arg2].filter(Boolean).map(s => String(s).trim()).join(', ');
    
    if (!fullString || fullString.toLowerCase() === 'remote' || fullString === 'NULL') {
        return { finalCity: 'NULL', finalCountry: 'NULL' };
    }

    let validCountries: string[] = [];
    
    // 1. Extract ALL explicitly listed countries from anywhere in the string
    const delimiters = /[,;||\/]/;
    let tokens = fullString.split(delimiters).map(t => t.trim()).filter(Boolean);

    for (let token of tokens) {
        let c = token.replace(/remote|worldwide|anywhere|[-()]/ig, '').trim();
        if (c && COUNTRY_ALIASES[c.toUpperCase()]) c = COUNTRY_ALIASES[c.toUpperCase()];
        
        if (c) {
            c = c.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            if (VALID_COUNTRIES.has(c)) {
                validCountries.push(c);
            }
        }
    }

    // 2. Identify the potential City (usually the first item before a comma)
    let potentialCity = fullString.split(delimiters)[0].trim().replace(/remote|worldwide|anywhere/ig, '').trim();
    let finalCity = 'NULL';

    // 3. THE BOUNCER: Is the "City" actually a Country? (e.g., "Germany")
    if (potentialCity) {
        let checkCityAsCountry = potentialCity.toUpperCase();
        if (COUNTRY_ALIASES[checkCityAsCountry]) {
            checkCityAsCountry = COUNTRY_ALIASES[checkCityAsCountry].toUpperCase();
        } else {
            checkCityAsCountry = potentialCity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }

        if (VALID_COUNTRIES.has(checkCityAsCountry)) {
            // It is a country! Reject it from the city column.
            finalCity = 'NULL'; 
            validCountries.push(checkCityAsCountry); // Add it to countries instead!
        } else {
            // It is a real city!
            finalCity = potentialCity;
        }
    }

    // 4. THE LIBRARY MAPPER: If no countries were found, let the NPM library figure it out!
    if (validCountries.length === 0 && finalCity !== 'NULL') {
        // Using .find() instead of .filter() stops the search early, saving precious memory!
        const foundCity = City.getAllCities().find((c: any) => c.name.toLowerCase() === finalCity.toLowerCase());
        if (foundCity) {
            const countryObj = Country.getCountryByCode(foundCity.countryCode);
            if (countryObj) validCountries.push(countryObj.name);
        }
    }

    validCountries = [...new Set(validCountries)]; // Deduplicate just in case

    return { 
        finalCity: finalCity || 'NULL', 
        finalCountry: validCountries.length > 0 ? validCountries.join(', ') : 'NULL' 
    };
}
// ==========================================

serve(async (req) => {
  const baseUrl = 'https://www.themuse.com/api/public/jobs';
  let allRawJobs: any[] = [];

  try {
    for (let page = 1; page <= 2; page++) {
      const paginatedUrl = `${baseUrl}?page=${page}&descending=true`;
      
      const response = await fetch(paginatedUrl);
      if (!response.ok) {
          throw new Error(`The Muse API Error on page ${page}: ${response.status}`);
      }
      
      const apiData = await response.json();
      
      if (!apiData.results || apiData.results.length === 0) {
        break;
      }
      
      allRawJobs = allRawJobs.concat(apiData.results);
    }

    if (allRawJobs.length === 0) {
      return new Response(JSON.stringify({ message: "No jobs fetched" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    console.log(`Success: Fetched ${allRawJobs.length} jobs from The Muse.`);

    const formattedJobs = allRawJobs.map((job: any) => {
      
      const rawDesc = job.contents || '';
      const cleanDesc = rawDesc
        .replace(/<[^>]*>?/gm, '') 
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      // --- THE MUSE LOCATION PARSING ---
      let rawCity = 'NULL';
      let rawCountry = 'NULL';
      let mappedWorkMode = 'ONSITE'; 

      const locationString = job.locations && job.locations.length > 0 ? job.locations[0].name : '';
      const titleLower = job.name ? job.name.toLowerCase() : '';
      const descLower = cleanDesc.toLowerCase();

      if (locationString) {
          const parts = locationString.split(',');
          if (parts.length > 0) rawCity = parts[0].trim();
          if (parts.length > 1) rawCountry = parts[parts.length - 1].trim(); 
      }

      if (
        titleLower.includes('hybrid') || 
        locationString.toLowerCase().includes('hybrid') ||
        descLower.substring(0, 500).includes('hybrid')
      ) {
        mappedWorkMode = 'HYBRID';
      } 
      else if (
        titleLower.includes('remote') || 
        locationString.toLowerCase().includes('remote') || 
        locationString.toLowerCase().includes('flexible')
      ) {
        mappedWorkMode = 'REMOTE';
        rawCountry = 'United States'; 
      }

      const { finalCity: city, finalCountry: country } = processLocation(rawCity, rawCountry);

      let mappedExp = 'ENTRY';
      if (job.levels && job.levels.length > 0) {
          const rawLevel = job.levels[0].short_name.toLowerCase();
          if (rawLevel === 'senior') mappedExp = 'SENIOR';
          else if (rawLevel === 'mid') mappedExp = 'MIDLEVEL';
          else if (rawLevel === 'management') mappedExp = 'EXECUTIVE';
          else mappedExp = 'ENTRY'; 
      }

      let mappedIndustry = 'Sector Agnostic'; 

      if (job.categories && job.categories.length > 0) {
          const rawCategory = job.categories[0].name.toLowerCase();
          
          if (rawCategory.includes('software') || rawCategory.includes('engineering')) {
              mappedIndustry = 'Enterprise Software'; 
          } else if (rawCategory.includes('marketing') || rawCategory.includes('pr')) {
              mappedIndustry = 'Advertising & PR';
          } else if (rawCategory.includes('data') || rawCategory.includes('analytics')) {
              mappedIndustry = 'Business Intelligence';
          } else if (rawCategory.includes('design') || rawCategory.includes('creative')) {
              mappedIndustry = 'Design & UI/UX';
          } else if (rawCategory.includes('education')) {
              mappedIndustry = 'Education';
          } else if (rawCategory.includes('sales') || rawCategory.includes('account')) {
              mappedIndustry = 'CRM & Sales Tech';
          }
      }

      return {
        job_title: job.name ? job.name.substring(0, 200) : 'Unknown Title',
        company_name: job.company && job.company.name ? job.company.name.substring(0, 100) : 'Unknown Company',
        job_description: cleanDesc, 
        source_urls: job.refs && job.refs.landing_page ? [job.refs.landing_page] : [],
        location_city: city, 
        location_country: country, 
        work_mode: mappedWorkMode, 
        job_type: 'FULLTIME', 
        industry: mappedIndustry, 
        experience: mappedExp, 
        event_date: job.publication_date ? job.publication_date.split('T')[0] : new Date().toISOString().split('T')[0],
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

    console.log(`Success: Inserted ${data ? data.length : 0} The Muse jobs.`);

    return new Response(JSON.stringify({ 
      success: true, 
      jobs_inserted: data ? data.length : 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})