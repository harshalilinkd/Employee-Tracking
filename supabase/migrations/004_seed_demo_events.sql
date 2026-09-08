-- =====================================================================
-- 004: demo performance events  ** REMOVABLE **
--
-- 55 events across the last 90 days, weighted so every signal band is
-- represented and at least one employee falls below the 3-event floor.
--
-- These are FABRICATED and attached to real colleagues. Every row carries
-- the 'demo-seed' tag. To remove all trace before go-live:
--
--   delete from employee_tracking.audit_log
--    where entity_type = 'performance_events'
--      and entity_id in (select id from employee_tracking.performance_events
--                        where 'demo-seed' = any(tags));
--   delete from employee_tracking.performance_events where 'demo-seed' = any(tags);
--
-- (DELETE is deliberately not granted to `authenticated`, so this must be
-- run from the SQL editor or a service-role connection — a normal user of
-- the app cannot destroy history, seeded or real.)
-- =====================================================================

with s(emp_name, ev_type, title, descr, days_ago, cat_name, sev, rec_email, fu_req, fu_days, fu_status) as (
  values
  -- Kavita Rane — Strong: sustained recognition, no issues
  ('Kavita Rane','positive','Reworked Anokhi print repeat overnight for Monday approval','Buyer moved the approval meeting forward. Repeat was redrawn and colour-separated the same night, approval cleared first pass.',5,'Exceptional Performance','high','raghavtibrewala96@gmail.com',false,null::int,null::text),
  ('Kavita Rane','positive','Caught colour separation error before screen making','Spotted that two greens had merged in separation. Flagged before screens were exposed, saved a full set.',20,'Quality','medium','naushi.linkdprints@gmail.com',false,null,null),
  ('Kavita Rane','positive','Trained two new designers on repeat layout standards','Sat with Krupesh and Manav for three sessions on repeat matching and file naming.',40,'Leadership','high','raghavtibrewala96@gmail.com',false,null,null),
  ('Kavita Rane','positive','Delivered six urgent design corrections in one day','Party wanted colour changes across six designs before dispatch. All returned same day.',65,'Productivity','medium','alishakathe99@gmail.com',false,null,null),

  -- Aditya Lohar — Attention: heavy Data Entry load plus an overdue follow-up
  ('Aditya Lohar','goofup','Wrong lot numbers entered in daily production sheet','Fusing lots recorded against Printing. Production count did not tally at day end.',3,'Data Entry','medium','alishakathe99@gmail.com',true,-4,'open'),
  ('Aditya Lohar','goofup','Duplicate entries in fusing output report','Same lot counted twice, inflating the weekly fusing output figure.',8,'Data Entry','medium','alishakathe99@gmail.com',false,null,null),
  ('Aditya Lohar','goofup','SAB entry for four challans posted to wrong party','Challans booked under a similar party name. Corrected after accounts flagged it.',15,'Data Entry','medium','alishakathe99@gmail.com',false,null,null),
  ('Aditya Lohar','goofup','MIS report circulated with previous week figures','Weekly MIS went to all HODs with last week numbers. Had to be recalled and reissued.',25,'Process Error','high','naushi.linkdprints@gmail.com',false,null,null),
  ('Aditya Lohar','goofup','Missed updating dispatch tracker for two days','Sales had no visibility on dispatch status for Tuesday and Wednesday.',38,'Data Entry','medium','alishakathe99@gmail.com',false,null,null),
  ('Aditya Lohar','positive','Built reconciliation sheet for SAB versus manual counts','Pivot that flags mismatches between SAB entries and floor counts automatically.',55,'Problem Solving','medium','raghavtibrewala96@gmail.com',false,null,null),

  -- Krishna Aade — Watch: two goofups in the same category
  ('Krishna Aade','goofup','SAB challan entry mismatch on three bills','Rate and quantity did not match the physical challan. Accounts caught it at billing.',10,'Data Entry','medium','alishakathe99@gmail.com',false,null,null),
  ('Krishna Aade','goofup','Party code entered incorrectly in SAB','Entry made against a dormant party code, ledger had to be reversed.',30,'Data Entry','medium','alishakathe99@gmail.com',false,null,null),
  ('Krishna Aade','goofup','Delayed SAB entries by two days during month end','Backlog built up in the last week of the month when volume peaked.',48,'Delay','low','naushi.linkdprints@gmail.com',false,null,null),
  ('Krishna Aade','positive','Cleared month-end SAB backlog without overtime','Reorganised entry sequence and finished the pending queue within regular hours.',60,'Reliability','medium','raghavtibrewala96@gmail.com',false,null,null),

  -- Satyendra Napit — Attention: a critical safety event in window
  ('Satyendra Napit','goofup','Operated fusing machine with the guard removed','Guard had been taken off for cleaning and not refitted before the machine was restarted.',18,'Safety','critical','naushi.linkdprints@gmail.com',true,-6,'open'),
  ('Satyendra Napit','goofup','Fusing temperature not logged for a full shift','Temperature log sheet blank for the evening shift, so rejections could not be traced.',45,'Process Error','medium','alishakathe99@gmail.com',false,null,null),
  ('Satyendra Napit','positive','Covered a double shift during the Ganpati rush','Stayed back to keep the fusing line running when the evening operator was absent.',70,'Reliability','medium','raghavtibrewala96@gmail.com',false,null,null),

  -- Pradeep Kumar — Watch: real issue load, but genuine contributions too
  ('Pradeep Kumar','goofup','Fusing batch handed to printing three hours late','Printing table stayed idle waiting for fused fabric.',6,'Delay','medium','alishakathe99@gmail.com',false,null,null),
  ('Pradeep Kumar','goofup','Fusing rejection of 180 metres from wrong temperature','Temperature set for a heavier interlining than the one actually loaded.',12,'Production Error','high','alishakathe99@gmail.com',true,5,'in_progress'),
  ('Pradeep Kumar','positive','Identified roller misalignment causing repeat rejections','Traced a recurring rejection pattern to a misaligned roller nobody had checked.',22,'Problem Solving','high','raghavtibrewala96@gmail.com',false,null,null),
  ('Pradeep Kumar','goofup','Bubbling on fused interlining not flagged','Defect passed to the next stage instead of being stopped at the machine.',35,'Quality Issue','medium','alishakathe99@gmail.com',false,null,null),
  ('Pradeep Kumar','positive','Suggested a pre-shift temperature check sheet','Simple sheet signed off before each shift start. Adopted on both machines.',58,'Initiative','medium','naushi.linkdprints@gmail.com',false,null,null),

  -- Kailash Singh — Stable: consistent, no issues, not headline recognition
  ('Kailash Singh','positive','Reduced fusing setup time by twenty minutes per lot','Reordered the setup steps so the machine heats while fabric is being staged.',14,'Process Improvement','high','raghavtibrewala96@gmail.com',false,null,null),
  ('Kailash Singh','positive','Trained Rakesh and Ram Napit on machine cleaning','Both can now do the end-of-shift clean without supervision.',33,'Teamwork','medium','naushi.linkdprints@gmail.com',false,null,null),
  ('Kailash Singh','positive','Zero rejections across fourteen consecutive lots','Sustained clean run through a high-volume fortnight.',52,'Reliability','medium','raghavtibrewala96@gmail.com',false,null,null),

  -- Anand Kumar — Watch: print alignment and shade issues
  ('Anand Kumar','goofup','Print alignment off by 4mm across 60 metres','Registration drifted mid-table and was not caught until the run finished.',9,'Quality Issue','high','alishakathe99@gmail.com',true,3,'open'),
  ('Anand Kumar','goofup','Did not inform coordinator about a screen change','Screen swapped mid-run without telling the process coordinator, so the log was wrong.',20,'Communication','low','naushi.linkdprints@gmail.com',false,null,null),
  ('Anand Kumar','goofup','Screen not cleaned between colours, shade patch on fabric','Residual colour carried into the next screen and patched the fabric.',28,'Production Error','medium','alishakathe99@gmail.com',false,null,null),
  ('Anand Kumar','positive','Spotted colour drift early and stopped the table','Stopped the run at 8 metres instead of letting the full length print off-shade.',42,'Quality','medium','raghavtibrewala96@gmail.com',false,null,null),

  -- Tanveer Ahmed — Stable
  ('Tanveer Ahmed','positive','Completed three extra tables during peak dispatch week','Absorbed extra load without the schedule slipping.',11,'Productivity','medium','raghavtibrewala96@gmail.com',false,null,null),
  ('Tanveer Ahmed','positive','Helped Shivam Sen set up for the evening shift','Stayed past his own shift to hand over a fully prepared table.',30,'Teamwork','low','naushi.linkdprints@gmail.com',false,null,null),
  ('Tanveer Ahmed','goofup','Late start on the morning table','Table started forty minutes behind schedule.',50,'Delay','low','alishakathe99@gmail.com',false,null,null),

  -- Nandkishor Desai — Strong: HOD-level contributions, one minor lapse
  ('Nandkishor Desai','positive','Reorganised the production board so delays surface daily','Board now shows pending dispatch by day, so slippage is visible the morning it happens.',7,'Leadership','high','raghavtibrewala96@gmail.com',false,null,null),
  ('Nandkishor Desai','positive','Resolved the Kata and Fusing clash over shared trolleys','Long-running friction between two departments settled with a simple allocation rule.',26,'Problem Solving','high','naushi.linkdprints@gmail.com',false,null,null),
  ('Nandkishor Desai','positive','Cut interlining wastage by changing the cutting sequence','Measurable drop in offcut waste across the month.',44,'Cost Saving','high','raghavtibrewala96@gmail.com',false,null,null),
  ('Nandkishor Desai','goofup','Did not circulate the revised production plan to Sales','Sales quoted delivery dates from the superseded plan for two days.',60,'Communication','low','alishakathe99@gmail.com',false,null,null),

  -- Anand Saraswat — Watch: two Customer Issue goofups, one overdue follow-up
  ('Anand Saraswat','goofup','Committed a delivery date without checking the production plan','Date promised to the party was not achievable against the running schedule.',16,'Customer Issue','high','naushi.linkdprints@gmail.com',true,-2,'open'),
  ('Anand Saraswat','positive','Recovered the Surat party order after a quality complaint','Visited the party, agreed a replacement lot, retained the account.',21,'Customer Service','high','raghavtibrewala96@gmail.com',false,null,null),
  ('Anand Saraswat','goofup','Sample dispatched to the wrong party address','Courier sent to an old address on file, sample returned after a week.',34,'Customer Issue','medium','alishakathe99@gmail.com',false,null,null),
  ('Anand Saraswat','goofup','Party not informed about shade variation before dispatch','Variation was known internally but not communicated, so it surfaced as a complaint.',40,'Communication','medium','alishakathe99@gmail.com',false,null,null),
  ('Anand Saraswat','positive','Started a weekly follow-up list for pending enquiries','Enquiries no longer sit untouched between visits.',62,'Initiative','medium','naushi.linkdprints@gmail.com',false,null,null),

  -- Nikita Dhawde — Strong
  ('Nikita Dhawde','positive','Introduced a daily DEO handover sheet','Re-entry errors between shifts dropped noticeably after the sheet started.',10,'Process Improvement','high','raghavtibrewala96@gmail.com',false,null,null),
  ('Nikita Dhawde','positive','Coordinated three departments during the Diwali dispatch push','Kept Fusing, Printing and Sampling sequenced through the heaviest week of the quarter.',20,'Leadership','high','naushi.linkdprints@gmail.com',false,null,null),
  ('Nikita Dhawde','positive','Backed up the SAB team during an absence','Picked up SAB entry alongside her own work so the queue did not build.',49,'Teamwork','high','raghavtibrewala96@gmail.com',false,null,null),

  -- Jagruti Padwal — Watch: repeated Data Entry
  ('Jagruti Padwal','goofup','Rate entered without GST on five SAB bills','Bills had to be cancelled and reissued to the party.',4,'Data Entry','medium','alishakathe99@gmail.com',true,7,'open'),
  ('Jagruti Padwal','goofup','Challan numbers repeated for two parties','Two parties issued the same challan number in the same series.',19,'Data Entry','medium','alishakathe99@gmail.com',false,null,null),
  ('Jagruti Padwal','positive','Cleared over two hundred pending SAB entries in a week','Took the backlog down to zero ahead of month end.',46,'Reliability','medium','raghavtibrewala96@gmail.com',false,null,null),

  -- Appa Sule — Stable
  ('Appa Sule','positive','Sampling fabric issued on time for all nine requests','No sampling request waited on fabric during the fortnight.',13,'Reliability','medium','raghavtibrewala96@gmail.com',false,null,null),
  ('Appa Sule','goofup','Sample fabric issue delayed by half a day','Sampling team idle for half a shift waiting on fabric.',24,'Delay','low','alishakathe99@gmail.com',false,null,null),
  ('Appa Sule','positive','Caught wrong GSM fabric before sampling started','Fabric issued from the wrong roll, spotted before it was cut.',37,'Quality','medium','naushi.linkdprints@gmail.com',false,null,null),

  -- Sheetal Prajapati — Stable
  ('Sheetal Prajapati','goofup','Design codes entered against the wrong buyer','Codes booked to a different buyer, corrected during the weekly check.',22,'Data Entry','medium','alishakathe99@gmail.com',false,null,null),
  ('Sheetal Prajapati','positive','Reorganised design file naming for faster retrieval','Designers now find past artwork without asking, saving repeated interruptions.',36,'Initiative','medium','naushi.linkdprints@gmail.com',false,null,null),
  ('Sheetal Prajapati','goofup','Missed backing up the weekly design folder','Backup skipped for one week, no data lost but the gap was unnoticed.',55,'Process Error','low','alishakathe99@gmail.com',false,null,null),

  -- Aksa Mallap — deliberately only two events, so she must render
  -- "Not enough data" and never "Stable". SPEC §5 makes this mandatory.
  ('Aksa Mallap','positive','Handled three party follow-ups during a colleague absence','Covered Pramod''s follow-ups alongside her own for the week.',15,'Customer Service','medium','raghavtibrewala96@gmail.com',false,null,null),
  ('Aksa Mallap','goofup','Order confirmation sent a day late','Party chased before the confirmation reached them.',41,'Delay','low','alishakathe99@gmail.com',false,null,null)
)
insert into employee_tracking.performance_events (
  employee_id, type, title, description, event_date, category_id,
  severity, recorded_by, tags, follow_up_required, follow_up_date, follow_up_status
)
select
  e.id,
  s.ev_type::employee_tracking.event_type,
  s.title,
  s.descr,
  current_date - s.days_ago,
  c.id,
  s.sev::employee_tracking.severity_level,
  au.id,
  array['demo-seed'],
  s.fu_req,
  case when s.fu_req then current_date + s.fu_days else null end,
  case when s.fu_req then s.fu_status::employee_tracking.followup_status else null end
from s
join employee_tracking.employees  e  on e.full_name = s.emp_name
join employee_tracking.categories c  on c.name = s.cat_name
                                    and c.applies_to = s.ev_type::employee_tracking.event_type
join employee_tracking.app_users  au on au.email = s.rec_email;
