-- Matching function without keyword array support, for use in contexts where keyword matching is not needed or available (e.g., certain edge function environments).
-- This version retains the enhanced location handling and industry/sector matching logic, but simplifies the title
-- matching to only use the job_title_keywords array without full-text search, and removes the input_keywords parameter.

drop function IF exists public.find_matching_users (TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

create or replace function public.find_matching_users (
  input_job_title TEXT,
  input_industry TEXT,
  input_experience TEXT,
  input_location_city TEXT,
  input_location_country TEXT,
  input_work_mode TEXT,
  input_job_type TEXT
) RETURNS table (user_id UUID, email TEXT) LANGUAGE plpgsql as $$
DECLARE
  mapped_experience TEXT;
  mapped_work_mode TEXT;
  mapped_job_type TEXT;
  combined_location TEXT;
  raw_country TEXT;
  normalized_country TEXT;
  is_remote_job BOOLEAN := FALSE;
BEGIN
  -- Normalize blanks
  input_job_title := NULLIF(trim(coalesce(input_job_title, '')), '');
  input_industry  := NULLIF(trim(coalesce(input_industry,  '')), '');
  input_experience:= NULLIF(trim(coalesce(input_experience,'')), '');
  input_location_city := NULLIF(trim(coalesce(input_location_city,'')), '');
  input_location_country := NULLIF(trim(coalesce(input_location_country,'')), '');
  input_work_mode := NULLIF(trim(coalesce(input_work_mode,'')), '');
  input_job_type  := NULLIF(trim(coalesce(input_job_type, '')), '');

  -- Map common variants to canonical UI text
  mapped_experience := CASE
    WHEN input_experience IS NULL THEN NULL
    WHEN UPPER(input_experience) IN ('ENTRY','ENTRYLEVEL','ENTRY LEVEL') THEN 'Entry level'
    WHEN UPPER(input_experience) IN ('MID','MIDLEVEL','MID-CAREER') THEN 'Mid-career'
    WHEN UPPER(input_experience) IN ('SENIOR','SR') THEN 'Senior'
    WHEN UPPER(input_experience) IN ('EXECUTIVE','C-LEVEL','CLEVEL') THEN 'Executive'
    ELSE trim(input_experience)
  END;

  mapped_work_mode := CASE
    WHEN input_work_mode IS NULL THEN NULL
    WHEN UPPER(input_work_mode) LIKE 'REMOTE%' THEN 'Remote'
    WHEN UPPER(input_work_mode) = 'HYBRID' THEN 'Hybrid'
    WHEN UPPER(input_work_mode) IN ('ONSITE','ON-SITE','IN OFFICE') THEN 'On-Site'
    ELSE trim(input_work_mode)
  END;

 mapped_job_type := CASE
    WHEN input_job_type IS NULL THEN NULL
    -- Added 'FULL-TIME' and the German 'BERUFSERFAHREN' (usually implies full-time professional)
    WHEN UPPER(input_job_type) IN ('FULLTIME','FULL TIME','FULL-TIME','FT','BERUFSERFAHREN') THEN 'Full time'
    -- Added 'FREELANCE' to the contract bucket
    WHEN UPPER(input_job_type) IN ('CONTRACT','CONTRACTOR','FREELANCE') THEN 'Contract'
    WHEN UPPER(input_job_type) IN ('INTERNSHIP','INTERN') THEN 'Internship'
    WHEN UPPER(input_job_type) IN ('PARTTIME','PART TIME','PT') THEN 'Part time'
    -- Added 'HOURLY' as its own bucket matching your UI
    WHEN UPPER(input_job_type) = 'HOURLY' THEN 'Hourly'
    ELSE trim(input_job_type)
  END;

  -- Detect remote markers either from location_country OR work_mode
  IF mapped_work_mode = 'Remote' THEN
    is_remote_job := TRUE;
  END IF;

  IF input_location_country IS NOT NULL THEN
    IF input_location_country ILIKE '%remote%' THEN
      is_remote_job := TRUE;
      -- strip `remote` and common separators to try to extract country/region part
      raw_country := trim(
        regexp_replace(input_location_country, '(?i)remote[[:space:]\-–,;:]*', '', 'g')
      );
      IF raw_country = '' THEN
        raw_country := NULL;
      END IF;
    ELSE
      raw_country := input_location_country;
    END IF;
  ELSE
    raw_country := NULL;
  END IF;

  -- Normalize common aliases for countries/regions (especially US / UK)
  IF raw_country IS NOT NULL THEN
    normalized_country := CASE
      WHEN raw_country ILIKE 'us' OR raw_country ILIKE 'usa' OR raw_country ILIKE 'u.s.%' OR raw_country ILIKE 'united states%' THEN 'United States'
      WHEN raw_country ILIKE 'uk' OR raw_country ILIKE 'united kingdom' THEN 'United Kingdom'
      WHEN raw_country ILIKE 'emea' THEN 'EMEA'
      WHEN raw_country ILIKE 'apac' THEN 'APAC'
      ELSE initcap(lower(raw_country))
    END;
  ELSE
    normalized_country := NULL;
  END IF;

  -- Build combined location if both city and country available
  IF input_location_city IS NOT NULL AND normalized_country IS NOT NULL THEN
    combined_location := trim(input_location_city) || ', ' || normalized_country;
  ELSE
    combined_location := NULL;
  END IF;

  RETURN QUERY
  SELECT p.id, p.email
  FROM public.profiles p
  JOIN public.jobs_preferences jp ON jp.user_id = p.id
  WHERE p.has_access = TRUE

    -- 1) TITLE MATCH: if job_title provided, require any single stored keyword to match the title
    AND (
      input_job_title IS NULL
      OR (
        jp.job_title_keywords IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(jp.job_title_keywords) AS k
          WHERE k IS NOT NULL
            AND to_tsvector('english', coalesce(input_job_title,'')) @@ plainto_tsquery('english', k)
        )
      )
      OR jp.job_title_keywords IS NULL -- preference didn't restrict title
    )

    -- 2) EXPERIENCE (wildcard if user hasn't set experience)
    AND (
      mapped_experience IS NULL
      OR (jp.experience_levels IS NOT NULL AND jp.experience_levels @> ARRAY[mapped_experience]::text[])
      OR jp.experience_levels IS NULL
    )

    /* 3) LOCATION: handle Remote variants robustly:
       - If job is Remote without country: match users who accept Remote OR wildcard locations OR listed Remote in target_locations
       - If job is Remote with country (Remote - US): match users who accept Remote OR who accept that country or All Cities, country OR wildcard
       - If job is non-remote: match by combined city+country or country-only or wildcard
    */
    AND (
      -- no location constraints at all
      (combined_location IS NULL AND normalized_country IS NULL AND NOT is_remote_job)

      -- remote job, global remote (e.g., 'Remote' or mapped_work_mode='Remote' with no country)
      OR (
        is_remote_job = TRUE
        AND normalized_country IS NULL
        AND (
          (jp.work_mode IS NOT NULL AND jp.work_mode @> ARRAY['Remote']::text[]) -- user accepts Remote
          OR (jp.target_locations IS NOT NULL AND jp.target_locations @> ARRAY['Remote']::text[]) -- user listed Remote in locations
          OR jp.target_locations IS NULL -- wildcard: user didn't restrict locations
        )
      )

      -- remote job limited to a country/region (e.g., 'Remote - US' or 'Remote, US')
      OR (
        is_remote_job = TRUE
        AND normalized_country IS NOT NULL
        AND (
          (jp.work_mode IS NOT NULL AND jp.work_mode @> ARRAY['Remote']::text[]) -- accepts remote
          OR (jp.target_locations IS NOT NULL AND (
               jp.target_locations @> ARRAY[normalized_country]::text[]
               OR jp.target_locations @> ARRAY['All Cities, ' || normalized_country]::text[]
               OR (combined_location IS NOT NULL AND jp.target_locations @> ARRAY[combined_location]::text[])
             ))
          OR jp.target_locations IS NULL -- wildcard
        )
      )

      -- non-remote job with city+country
      OR (
        is_remote_job = FALSE
        AND combined_location IS NOT NULL
        AND (
          jp.target_locations IS NULL
          OR (jp.target_locations IS NOT NULL AND jp.target_locations @> ARRAY[combined_location]::text[])
          OR (normalized_country IS NOT NULL AND jp.target_locations IS NOT NULL AND (jp.target_locations @> ARRAY[normalized_country]::text[] OR jp.target_locations @> ARRAY['All Cities, ' || normalized_country]::text[]))
        )
      )

      -- non-remote job with country only
      OR (
        is_remote_job = FALSE
        AND combined_location IS NULL
        AND normalized_country IS NOT NULL
        AND (
          jp.target_locations IS NULL
          OR (jp.target_locations IS NOT NULL AND (jp.target_locations @> ARRAY[normalized_country]::text[] OR jp.target_locations @> ARRAY['All Cities, ' || normalized_country]::text[]))
        )
      )
    )

    -- 4) INDUSTRY / SECTOR (treat 'Sector Agnostic' as wildcard)
    AND (
      input_industry IS NULL
      OR (jp.target_sectors IS NOT NULL AND (jp.target_sectors @> ARRAY[trim(input_industry)]::text[] OR jp.target_sectors @> ARRAY['Sector Agnostic']::text[]))
      OR jp.target_sectors IS NULL
    )

    -- 5) WORK MODE (if job has explicit work_mode provided)
    AND (
      mapped_work_mode IS NULL
      OR (jp.work_mode IS NOT NULL AND jp.work_mode @> ARRAY[mapped_work_mode]::text[])
      OR jp.work_mode IS NULL
    )

    -- 6) JOB TYPE
    AND (
      mapped_job_type IS NULL
      OR (jp.job_types IS NOT NULL AND jp.job_types @> ARRAY[mapped_job_type]::text[])
      OR jp.job_types IS NULL
    )
  ;
END;
$$;