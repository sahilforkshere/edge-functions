-- Create GIN indexes on the jobs_preferences table to optimize queries that filter by job title keywords, target locations, sectors, experience levels, work mode, and job types.
-- These indexes will significantly improve the performance of the matching function when filtering based on these criteria.

CREATE INDEX idx_pref_titles
ON jobs_preferences USING GIN (job_title_keywords);

CREATE INDEX idx_pref_locations
ON jobs_preferences USING GIN (target_locations);

CREATE INDEX idx_pref_sectors
ON jobs_preferences USING GIN (target_sectors);

CREATE INDEX idx_pref_experience
ON jobs_preferences USING GIN (experience_levels);

CREATE INDEX idx_pref_work_mode
ON jobs_preferences USING GIN (work_mode);

CREATE INDEX idx_pref_job_types
ON jobs_preferences USING GIN (job_types);