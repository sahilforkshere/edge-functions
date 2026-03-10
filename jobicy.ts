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

      // --- JOBICY LOCATION ---
      let rawCity = 'NULL';
      let rawCountry = (job.jobGeo || '').replace(/[-()]/g, '').trim();
      
      // If it contains a comma, assume it's "City, Country"
      if (rawCountry.includes(',')) {
          const parts = rawCountry.split(',');
          rawCity = parts[0].trim();
          rawCountry = parts[1].trim();
      }

      const { finalCity: city, finalCountry: country } = processLocation(rawCity, rawCountry);

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

      return {
        job_title: job.jobTitle ? job.jobTitle.substring(0, 200) : 'Unknown Title',
        company_name: job.companyName ? job.companyName.substring(0, 100) : 'Unknown Company',
        job_description: cleanDesc, 
        source_urls: job.url ? [job.url] : [],
        location_city: city, 
        location_country: country, 
        work_mode: 'REMOTE',
        job_type: mappedType, 
        industry: mappedIndustry, 
        experience: mappedExp, 
        event_date: job.pubDate ? job.pubDate.split(' ')[0] : new Date().toISOString().split('T')[0],
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