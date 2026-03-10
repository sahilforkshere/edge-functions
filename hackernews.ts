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

      // Run it through the universal validator just in case!
      const { finalCity: validatedCity, finalCountry: validatedCountry } = processLocation(rawCity, rawCountry);

      const sourceUrl = job.url ? job.url : `https://news.ycombinator.com/item?id=${job.objectID}`;

      let cleanDesc = '';
      if (job.story_text) {
        cleanDesc = job.story_text
          .replace(/<[^>]*>?/gm, '') 
          .replace(/\s+/g, ' ')      
          .trim();
      }

      return {
        job_title: title.substring(0, 200),
        company_name: company.substring(0, 100),
        job_description: cleanDesc, 
        source_urls: [sourceUrl],
        location_city: validatedCity, 
        location_country: validatedCountry, 
        work_mode: isRemote ? 'REMOTE' : 'ONSITE', 
        job_type: 'FULLTIME', 
        industry: 'Sector Agnostic', // Fallback for your Word Overlap engine
        experience: /senior/i.test(fullTitle) ? 'SENIOR' : 'ENTRY', 
        event_date: job.created_at ? job.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
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