-- Additive and repeatable: existing arms/legs records keep their original meaning.
ALTER TYPE public."BodyPart" ADD VALUE IF NOT EXISTS 'biceps';
ALTER TYPE public."BodyPart" ADD VALUE IF NOT EXISTS 'triceps';
