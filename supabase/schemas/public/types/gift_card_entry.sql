CREATE TYPE "public"."gift_card_entry" AS ENUM (
  'sale',
  'spend',
  'undo',
  'adjust',
  'top_up'
);
