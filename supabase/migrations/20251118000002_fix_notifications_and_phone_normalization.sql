-- Migration: Fix admin_notifications RLS and normalize phone numbers
-- Created: 2025-11-18
-- Purpose: Enable RLS on admin_notifications and fix phone number formatting

-- ===== 1. ENABLE RLS ON admin_notifications =====
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate them properly)
DROP POLICY IF EXISTS "Allow anon to read admin notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Allow authenticated to read admin notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Allow anon to update admin notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Allow authenticated to update admin notifications" ON admin_notifications;

-- Recreate policies with proper permissions
CREATE POLICY "Allow anon to read admin notifications"
ON admin_notifications FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow authenticated to read admin notifications"
ON admin_notifications FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow anon to update admin notifications"
ON admin_notifications FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated to update admin notifications"
ON admin_notifications FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow service_role full access (needed for backend operations)
CREATE POLICY "Allow service_role full access to admin notifications"
ON admin_notifications FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE admin_notifications IS 'Admin notifications with RLS enabled. Accessible by anon/authenticated for read/update.';

-- ===== 2. NORMALIZE PHONE NUMBERS IN leads TABLE =====
-- Create a function to normalize phone numbers
CREATE OR REPLACE FUNCTION normalize_phone_number(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN NULL;
  END IF;

  -- Remove all non-digit characters
  cleaned := regexp_replace(phone_input, '[^0-9]', '', 'g');

  -- Remove duplicate 91 prefixes (e.g., 919191... -> 91...)
  WHILE length(cleaned) > 12 AND substring(cleaned from 1 for 2) = '91' LOOP
    cleaned := substring(cleaned from 3);
  END LOOP;

  -- If we have 12 digits starting with 91, keep it as is
  -- If we have 10 digits, add 91 prefix
  -- If we have more than 12 digits, take the last 10 and add 91
  IF length(cleaned) = 12 AND substring(cleaned from 1 for 2) = '91' THEN
    RETURN cleaned;
  ELSIF length(cleaned) = 10 THEN
    RETURN '91' || cleaned;
  ELSIF length(cleaned) > 12 THEN
    RETURN '91' || substring(cleaned from length(cleaned) - 9 for 10);
  ELSIF length(cleaned) > 10 AND substring(cleaned from 1 for 2) = '91' THEN
    RETURN '91' || substring(cleaned from length(cleaned) - 9 for 10);
  ELSE
    -- Return as is if we can't normalize
    RETURN cleaned;
  END IF;
END;
$$;

COMMENT ON FUNCTION normalize_phone_number IS 'Normalizes Indian phone numbers to format: 919876543210 (12 digits)';

-- Update all existing phone numbers in leads table
UPDATE leads
SET phone = normalize_phone_number(phone)
WHERE phone IS NOT NULL
  AND phone != normalize_phone_number(phone);

-- ===== 3. CREATE TRIGGER TO AUTO-NORMALIZE PHONE NUMBERS =====
CREATE OR REPLACE FUNCTION trigger_normalize_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := normalize_phone_number(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS normalize_phone_on_insert_update ON leads;

-- Create trigger for automatic normalization
CREATE TRIGGER normalize_phone_on_insert_update
BEFORE INSERT OR UPDATE OF phone ON leads
FOR EACH ROW
EXECUTE FUNCTION trigger_normalize_phone();

COMMENT ON TRIGGER normalize_phone_on_insert_update ON leads IS 'Automatically normalizes phone numbers on insert/update';

-- ===== 4. CREATE FUNCTION TO UPDATE PARENT NAME AND CLASS FROM AI MEMORY =====
CREATE OR REPLACE FUNCTION sync_lead_profile_from_ai_memory()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update parent_name from ai_memory profile where it's missing or 'Unknown Parent'
  UPDATE leads l
  SET parent_name = COALESCE(
    (am.profile->>'parent_name')::text,
    (am.profile->>'name')::text
  )
  FROM ai_memory am
  WHERE l.id = am.lead_id
    AND (l.parent_name IS NULL OR l.parent_name = 'Unknown Parent' OR l.parent_name = '')
    AND (am.profile->>'parent_name' IS NOT NULL OR am.profile->>'name' IS NOT NULL);

  -- Update class from ai_memory profile where it's missing
  UPDATE leads l
  SET class = (am.profile->>'class')::text
  FROM ai_memory am
  WHERE l.id = am.lead_id
    AND (l.class IS NULL OR l.class = '')
    AND am.profile->>'class' IS NOT NULL;

  -- Update student_name from ai_memory profile where it's missing
  UPDATE leads l
  SET student_name = (am.profile->>'student_name')::text
  FROM ai_memory am
  WHERE l.id = am.lead_id
    AND (l.student_name IS NULL OR l.student_name = '')
    AND am.profile->>'student_name' IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION sync_lead_profile_from_ai_memory IS 'Syncs parent_name, class, and student_name from ai_memory to leads table';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_lead_profile_from_ai_memory() TO authenticated, anon, service_role;

-- Run the sync function to update existing leads
SELECT sync_lead_profile_from_ai_memory();

-- ===== 5. CREATE FUNCTION TO GET FORMATTED PHONE NUMBER =====
CREATE OR REPLACE FUNCTION get_formatted_phone(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
  digits_only TEXT;
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN 'N/A';
  END IF;

  -- Normalize first
  normalized := normalize_phone_number(phone_input);

  -- Extract just the 10 digits (remove country code 91)
  IF length(normalized) = 12 AND substring(normalized from 1 for 2) = '91' THEN
    digits_only := substring(normalized from 3 for 10);
  ELSE
    digits_only := normalized;
  END IF;

  -- Format as +91 XXXXX XXXXX
  IF length(digits_only) = 10 THEN
    RETURN '+91 ' || substring(digits_only from 1 for 5) || ' ' || substring(digits_only from 6 for 5);
  ELSE
    RETURN phone_input;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_formatted_phone IS 'Returns formatted phone number: +91 XXXXX XXXXX';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_formatted_phone(TEXT) TO authenticated, anon, service_role;
