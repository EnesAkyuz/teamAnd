-- Add "memory" to bucket_items category check constraint
alter table bucket_items drop constraint if exists bucket_items_category_check;
alter table bucket_items add constraint bucket_items_category_check
  check (category in ('rule', 'skill', 'value', 'tool', 'memory'));
