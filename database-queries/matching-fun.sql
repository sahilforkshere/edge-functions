-- Matching function to find users based on job criteria with enhanced keyword matching and flexible location handling.
DROP FUNCTION IF EXISTS public.find_matching_users(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.find_matching_users(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.find_matching_users (
  input_job_title TEXT,
  input_industry TEXT,
  input_experience TEXT,
  input_location_city TEXT,
  input_location_country TEXT,
  input_work_mode TEXT,
  input_job_type TEXT,
  input_keywords TEXT[] DEFAULT NULL 
) RETURNS table (user_id UUID, email TEXT) LANGUAGE plpgsql AS $$
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
    WHEN UPPER(input_job_type) IN ('FULLTIME','FULL TIME','FULL-TIME','FT','BERUFSERFAHREN') THEN 'Full time'
    WHEN UPPER(input_job_type) IN ('CONTRACT','CONTRACTOR','FREELANCE') THEN 'Contract'
    WHEN UPPER(input_job_type) IN ('INTERNSHIP','INTERN') THEN 'Internship'
    WHEN UPPER(input_job_type) IN ('PARTTIME','PART TIME','PT') THEN 'Part time'
    WHEN UPPER(input_job_type) = 'HOURLY' THEN 'Hourly'
    ELSE trim(input_job_type)
  END;

  IF mapped_work_mode = 'Remote' THEN
    is_remote_job := TRUE;
  END IF;

  IF input_location_country IS NOT NULL THEN
    IF input_location_country ILIKE '%remote%' THEN
      is_remote_job := TRUE;
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

  IF input_location_city IS NOT NULL AND raw_country IS NOT NULL THEN
    combined_location := trim(input_location_city) || ', ' || trim(split_part(raw_country, ',', 1));
  ELSE
    combined_location := NULL;
  END IF;

  RETURN QUERY
  SELECT p.id, p.email
  FROM public.profiles p
  JOIN public.jobs_preferences jp ON jp.user_id = p.id
  WHERE p.has_access = TRUE

    -- ==========================================
    -- 🌟 1) THE NEW "SMART" TITLE MATCHER 🌟
    -- ==========================================
    AND (
      (input_job_title IS NULL AND input_keywords IS NULL)
      OR (jp.job_title_keywords IS NULL OR jp.job_title_keywords = '{}')
      OR EXISTS (
        SELECT 1 FROM unnest(jp.job_title_keywords) AS k
        WHERE k IS NOT NULL
          AND (
            -- Substring match on the raw title
            (input_job_title IS NOT NULL AND input_job_title ILIKE '%' || k || '%')
            
            -- OR Word Overlap on keywords (Ignoring generic titles!)
            OR (input_keywords IS NOT NULL AND EXISTS (
                 SELECT 1
                 FROM unnest(string_to_array(lower(regexp_replace(k, '[^a-zA-Z0-9]+', ' ', 'g')), ' ')) AS sw
                 JOIN unnest(input_keywords) AS kw ON sw = lower(kw)
                 -- This filter reduces "Backend Engineer" to just "Backend"
                 WHERE sw NOT IN ('', 'and', 'or', 'the', 'engineer', 'developer', 'manager', 'lead', 'staff', 'director', 'specialist', 'head')
            ))
          )
      )
    )

    -- 2) EXPERIENCE
    AND (
      mapped_experience IS NULL
      OR (jp.experience_levels IS NULL OR jp.experience_levels = '{}')
      OR (jp.experience_levels IS NOT NULL AND jp.experience_levels @> ARRAY[mapped_experience]::text[])
    )

    -- 3) LOCATION
    AND (
      (combined_location IS NULL AND raw_country IS NULL AND NOT is_remote_job)
      OR (
        is_remote_job = TRUE
        AND raw_country IS NULL
        AND (
          (jp.work_mode IS NOT NULL AND jp.work_mode @> ARRAY['Remote']::text[]) 
          OR (jp.target_locations IS NOT NULL AND jp.target_locations @> ARRAY['Remote']::text[]) 
          OR (jp.target_locations IS NULL OR jp.target_locations = '{}')
        )
      )
      OR (
        is_remote_job = TRUE
        AND raw_country IS NOT NULL
        AND (
          (jp.work_mode IS NOT NULL AND jp.work_mode @> ARRAY['Remote']::text[]) 
          OR (jp.target_locations IS NULL OR jp.target_locations = '{}')
          OR EXISTS (
             SELECT 1 FROM unnest(string_to_array(raw_country, ',')) AS single_country
             WHERE jp.target_locations @> ARRAY[trim(single_country)]::text[]
                OR jp.target_locations @> ARRAY['All Cities, ' || trim(single_country)]::text[]
                OR (combined_location IS NOT NULL AND jp.target_locations @> ARRAY[combined_location]::text[])
          )
        )
      )
      OR (
        is_remote_job = FALSE
        AND raw_country IS NOT NULL
        AND (
          (jp.target_locations IS NULL OR jp.target_locations = '{}')
          OR EXISTS (
             SELECT 1 FROM unnest(string_to_array(raw_country, ',')) AS single_country
             WHERE jp.target_locations @> ARRAY[trim(single_country)]::text[]
                OR jp.target_locations @> ARRAY['All Cities, ' || trim(single_country)]::text[]
                OR (combined_location IS NOT NULL AND jp.target_locations @> ARRAY[combined_location]::text[])
          )
        )
      )
    )

    -- 4) INDUSTRY / SECTOR
    AND (
      (input_industry IS NULL AND input_keywords IS NULL)
      OR (jp.target_sectors IS NULL OR jp.target_sectors = '{}')
      OR jp.target_sectors @> ARRAY['Sector Agnostic']::text[]
      OR EXISTS (
        SELECT 1 FROM unnest(jp.target_sectors) AS user_sector
        WHERE
          (input_industry IS NOT NULL AND (
             user_sector ILIKE '%' || trim(input_industry) || '%'
             OR trim(input_industry) ILIKE '%' || user_sector || '%'
          ))
          OR (input_keywords IS NOT NULL AND EXISTS (
             SELECT 1
             FROM unnest(string_to_array(lower(regexp_replace(user_sector, '[^a-zA-Z0-9]+', ' ', 'g')), ' ')) AS sw
             JOIN unnest(input_keywords) AS kw ON sw = lower(kw)
             WHERE sw NOT IN ('', 'and', 'or', 'the', 'of', 'in', 'a', 'team', 'department', 'industry', 'sector')
          ))
      )
    )

    -- 5) WORK MODE 
    AND (
      mapped_work_mode IS NULL
      OR (jp.work_mode IS NULL OR jp.work_mode = '{}')
      OR (jp.work_mode IS NOT NULL AND jp.work_mode @> ARRAY[mapped_work_mode]::text[])
    )

    -- 6) JOB TYPE
    AND (
      mapped_job_type IS NULL
      OR (jp.job_types IS NULL OR jp.job_types = '{}')
      OR (jp.job_types IS NOT NULL AND jp.job_types @> ARRAY[mapped_job_type]::text[])
    )
  ;
END;
$$;