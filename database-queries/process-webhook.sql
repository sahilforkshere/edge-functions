CREATE OR REPLACE FUNCTION process_webhook_payload()
RETURNS TRIGGER AS $$
DECLARE
    event_item JSONB;
    parsed_content JSONB;
BEGIN
    -- 1. Ensure the incoming payload is a valid JSON array
    IF jsonb_typeof(NEW.payload) = 'array' THEN
        -- 2. Iterate through each job event in the payload
        FOR event_item IN SELECT * FROM jsonb_array_elements(NEW.payload) LOOP
            BEGIN
                -- Extract data from 'result' -> 'content'
                parsed_content := event_item->'result'->'content';

                -- 4. Only insert if the content exists
                IF parsed_content IS NOT NULL THEN
                    INSERT INTO job_alerts (
                        webhook_event_id,
                        
                        -- : Extracting top-level metadata
                        event_group_id,
                        event_date,
                        source_urls,
                        
                        -- Standard parsed content
                        job_title,
                        company_name,
                        industry,          
                        experience,        
                        location_city,     
                        location_country,  
                        work_mode,         
                        job_type           
                    ) VALUES (
                        NEW.id,
                        
                        -- 🌟 NEW: Grabbing directly from event_item instead of parsed_content
                        event_item->>'event_group_id',
                        (event_item->>'event_date')::date, -- Casts the string to a proper SQL DATE
                        
                        -- Safely converts the JSON array of URLs into a PostgreSQL TEXT array
                        (SELECT array_agg(x::text) FROM jsonb_array_elements_text(event_item->'source_urls') t(x)),

                        -- Standard parsed content
                        parsed_content->>'job_title',
                        parsed_content->>'company_name',
                        parsed_content->>'industry',
                        parsed_content->>'experience',
                        parsed_content->'job_details'->>'location_city',
                        parsed_content->'job_details'->>'location_country',
                        parsed_content->'job_details'->>'work_mode',
                        parsed_content->'job_details'->>'job_type'
                    );
                END IF;

            EXCEPTION WHEN OTHERS THEN
                -- Skip individual errors to keep the process running 
                CONTINUE;
            END;
        END LOOP;
    END IF;

    -- 5. Finalize the status as PROCESSED 
    UPDATE webhook_events SET status = 'PROCESSED' WHERE id = NEW.id;
    
    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- 6. Log critical failures to the error_log 
    UPDATE webhook_events 
    SET status = 'FAILED', error_log = SQLERRM 
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;