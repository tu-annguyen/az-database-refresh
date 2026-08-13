ALTER TABLE final_decisions
ADD COLUMN one_search_icon INTEGER NOT NULL DEFAULT 0 CHECK (one_search_icon IN (0, 1));

UPDATE final_decisions
SET one_search_icon = 1
WHERE instr(
  final_description_html,
  'https://libapps.s3.amazonaws.com/accounts/7085/images/SmallOneSearchO.png'
) > 0;
