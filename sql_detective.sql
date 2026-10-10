-- =====================================================================
-- Part 2: SQL Detective Challenge
-- Written in standard SQL; runs on SQLite, MySQL 8+ and PostgreSQL.
-- (Schema + seed INSERTs from the brief are loaded first, unchanged.)
-- =====================================================================


-- ---------------------------------------------------------------------
-- Q1. All currently open job postings with the owning recruiter's name.
-- ---------------------------------------------------------------------
SELECT jp.id            AS job_posting_id,
       jp.title,
       jp.department,
       jp.opened_date,
       r.name           AS recruiter_name
FROM   job_postings jp
JOIN   recruiters   r ON r.id = jp.recruiter_id
WHERE  jp.status = 'open'
ORDER  BY jp.id;


-- ---------------------------------------------------------------------
-- Q2. For each job posting, how many applicants reached the Final stage?
-- "Reached Final" = has a Final interview row (regardless of outcome).
-- LEFT JOIN keeps postings with zero Final interviews (count = 0).
-- DISTINCT guards against an applicant having two Final rows for one job.
-- ---------------------------------------------------------------------
SELECT jp.id    AS job_posting_id,
       jp.title,
       COUNT(DISTINCT i.applicant_id) AS applicants_reaching_final
FROM   job_postings jp
LEFT   JOIN interviews i
       ON  i.job_posting_id = jp.id
       AND i.stage = 'Final'
GROUP  BY jp.id, jp.title
ORDER  BY jp.id;


-- ---------------------------------------------------------------------
-- Q3. People who effectively applied to more than one job posting.
-- The mess: Ananya Rao exists twice (ids 1 and 2) with e-mails that differ
-- only by letter case. So identity = LOWER(email), not applicants.id.
-- "Applied to a posting" is evidenced by an interview row, and we count
-- DISTINCT postings so repeated interviews for one job are not double counted.
-- ---------------------------------------------------------------------
SELECT LOWER(a.email)                    AS person_email,
       MIN(a.full_name)                  AS full_name,
       COUNT(DISTINCT a.id)              AS applicant_records,
       COUNT(DISTINCT i.job_posting_id)  AS distinct_postings
FROM   applicants a
JOIN   interviews i ON i.applicant_id = a.id
GROUP  BY LOWER(a.email)
HAVING COUNT(DISTINCT i.job_posting_id) > 1
ORDER  BY full_name;


-- ---------------------------------------------------------------------
-- Q4. Final-stage conversion rate per recruiter (passed / total Final),
-- only for recruiters with at least 3 Final-stage interviews.
-- no_show and pending (NULL) Finals count in the denominator, not the numerator.
-- 100.0 * ... forces decimal division (avoids integer division).
-- ---------------------------------------------------------------------
SELECT r.id   AS recruiter_id,
       r.name AS recruiter_name,
       COUNT(*) AS final_interviews,
       SUM(CASE WHEN i.outcome = 'passed' THEN 1 ELSE 0 END) AS finals_passed,
       ROUND(100.0 * SUM(CASE WHEN i.outcome = 'passed' THEN 1 ELSE 0 END) / COUNT(*), 2) AS final_conversion_pct
FROM   interviews   i
JOIN   job_postings jp ON jp.id = i.job_posting_id
JOIN   recruiters   r  ON r.id  = jp.recruiter_id
WHERE  i.stage = 'Final'
GROUP  BY r.id, r.name
HAVING COUNT(*) >= 3
ORDER  BY final_conversion_pct DESC;


-- ---------------------------------------------------------------------
-- Q5 (Bonus). Recruiter with the most successful placements (Final passed)
-- per department, using a window function.
-- RANK() (not ROW_NUMBER) so that ties for first place are all returned.
-- ---------------------------------------------------------------------
WITH placements AS (
    SELECT jp.department,
           r.id   AS recruiter_id,
           r.name AS recruiter_name,
           COUNT(*) AS placements
    FROM   interviews   i
    JOIN   job_postings jp ON jp.id = i.job_posting_id
    JOIN   recruiters   r  ON r.id  = jp.recruiter_id
    WHERE  i.stage = 'Final' AND i.outcome = 'passed'
    GROUP  BY jp.department, r.id, r.name
),
ranked AS (
    SELECT p.*,
           RANK() OVER (PARTITION BY department ORDER BY placements DESC) AS rnk
    FROM   placements p
)
SELECT department, recruiter_name, placements
FROM   ranked
WHERE  rnk = 1
ORDER  BY department;
