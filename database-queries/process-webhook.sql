CREATE OR REPLACE FUNCTION public.process_webhook_payload()
RETURNS TRIGGER AS $$
DECLARE
    event_item JSONB;
    parsed_content JSONB;
    fetched_industry TEXT;
    fetched_country TEXT;
BEGIN
    -- 🌟 1. FETCH FROM MONITORS TABLE SAFELY
    -- FIX: Target the parallel_monitor_id column instead of the primary UUID id!
    SELECT industry, country INTO fetched_industry, fetched_country 
    FROM public.monitors 
    WHERE parallel_monitor_id = NEW.monitor_id;

    -- 2. Ensure the incoming payload is a valid JSON array
    IF jsonb_typeof(NEW.payload) = 'array' THEN
        
        -- 3. Iterate through each job event in the payload
        FOR event_item IN SELECT * FROM jsonb_array_elements(NEW.payload) LOOP
            
            parsed_content := event_item->'result'->'content';

            IF parsed_content IS NOT NULL THEN
                INSERT INTO job_alerts (
                    webhook_event_id,
                    event_group_id,
                    event_date,
                    source_urls,
                    
                    job_title,
                    company_name,
                    job_description,
                    industry,
                    experience,        
                    location_city,     
                    location_country,
                    work_mode,         
                    job_type           
                ) VALUES (
                    NEW.id,
                    event_item->>'event_group_id',
                    (event_item->>'event_date')::date,
                    
                    (SELECT array_agg(x::text) FROM jsonb_array_elements_text(event_item->'source_urls') t(x)),

                    -- 🧹 Cleaned up: Just handling the AI 'NULL' string now!
                    NULLIF(parsed_content->>'job_title', 'NULL'),
                    NULLIF(parsed_content->>'company_name', 'NULL'),
                    NULLIF(parsed_content->>'job_description', 'NULL'), 
                    
                    fetched_industry,   
                    
                    NULLIF(parsed_content->>'experience', 'NULL'),
                    
                    NULLIF(parsed_content->'job_details'->>'location_city', 'NULL'),
                    fetched_country,   
                    NULLIF(parsed_content->'job_details'->>'work_mode', 'NULL'),
                    NULLIF(parsed_content->'job_details'->>'job_type', 'NULL')
                );
            END IF;
            
        END LOOP;
    END IF;

    UPDATE webhook_events SET status = 'PROCESSED' WHERE id = NEW.id;
    
    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    UPDATE webhook_events 
    SET status = 'FAILED', error_log = SQLERRM 
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
