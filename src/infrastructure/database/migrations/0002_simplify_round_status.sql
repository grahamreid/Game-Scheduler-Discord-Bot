-- Phase one initially created sample rounds as "draft". A round is now open
-- immediately after creation because all collection activities can overlap.
UPDATE planning_rounds
SET status = 'open'
WHERE status IN ('draft', 'availability_open', 'activities_open', 'hosting_open');
