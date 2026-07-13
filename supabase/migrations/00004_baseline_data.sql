-- Production baseline data (not demo data): the platform policy template
-- library (SPEC §4.3) and version 1 of the unified application form (§4.2.1).

insert into public.policy_templates (name, description, tiers) values
  ('Siblings First', 'Siblings of currently enrolled children are prioritized.',
   '[{"kind": "sibling", "label": "Siblings of enrolled children"}]'),
  ('Indigenous Community Priority', 'Members of a named Indigenous group are prioritized.',
   '[{"kind": "indigenous", "label": "Indigenous community members"}]'),
  ('Staff Children', 'Children of daycare employees receive priority.',
   '[{"kind": "staff_child", "label": "Children of staff"}]'),
  ('Neighbourhood Residents', 'Families within a defined area are prioritized.',
   '[{"kind": "neighbourhood", "label": "Neighbourhood residents"}]'),
  ('General FIFO', 'First-come, first-served with no special tiers.',
   '[{"kind": "general", "label": "General waitlist"}]');

insert into public.form_schemas (version, fields) values (1, '[
  {"id": "name", "label": "Child''s full name", "type": "text", "required": true, "system": true},
  {"id": "dob", "label": "Date of birth", "type": "date", "required": true, "system": true},
  {"id": "desiredStartDate", "label": "Desired start date", "type": "date", "required": true, "system": true},
  {"id": "indigenous", "label": "Member of an Indigenous community (self-declared)", "type": "checkbox", "required": false, "system": true},
  {"id": "sibling", "label": "Sibling currently enrolled at a daycare you are applying to", "type": "checkbox", "required": false, "system": true},
  {"id": "staffChild", "label": "Parent works at a daycare you are applying to", "type": "checkbox", "required": false, "system": true},
  {"id": "neighbourhood", "label": "Resident of the daycare''s neighbourhood (e.g. Apex)", "type": "checkbox", "required": false, "system": true},
  {"id": "notes", "label": "Anything else the daycares should know? (optional)", "type": "text", "required": false}
]');
