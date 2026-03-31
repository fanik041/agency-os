-- Reset leads that were partially processed by n8n (status changed but never scored)
-- back to 'new' so the OpenAI scoring pipeline picks them up naturally
update leads
set status = 'new'
where pain_score is null
  and status != 'new';
