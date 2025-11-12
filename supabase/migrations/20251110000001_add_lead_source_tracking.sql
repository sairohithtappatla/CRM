-- Migration: Add Lead Source Tracking
-- Description: Adds columns to track where leads come from (marketing attribution)
-- Date: 2025-11-10

-- Add source tracking columns to leads table
ALTER TABLE public.leads
ADD COLUMN ref_source text,
ADD COLUMN utm_campaign text,
ADD COLUMN utm_medium text,
ADD COLUMN utm_source text,
ADD COLUMN utm_content text,
ADD COLUMN utm_term text,
ADD COLUMN referrer_url text,
ADD COLUMN landing_page text,
ADD COLUMN device_type text,
ADD COLUMN browser text,
ADD COLUMN source_metadata jsonb DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.leads.ref_source IS 'Primary source category: whatsapp, facebook, instagram, google, referral, direct, etc.';
COMMENT ON COLUMN public.leads.utm_campaign IS 'UTM Campaign parameter for marketing attribution';
COMMENT ON COLUMN public.leads.utm_medium IS 'UTM Medium parameter (e.g., social, email, cpc)';
COMMENT ON COLUMN public.leads.utm_source IS 'UTM Source parameter (e.g., facebook, google, newsletter)';
COMMENT ON COLUMN public.leads.utm_content IS 'UTM Content parameter for A/B testing';
COMMENT ON COLUMN public.leads.utm_term IS 'UTM Term parameter for paid search keywords';
COMMENT ON COLUMN public.leads.referrer_url IS 'Full referrer URL if available';
COMMENT ON COLUMN public.leads.landing_page IS 'First page visited on the website';
COMMENT ON COLUMN public.leads.device_type IS 'Device type: mobile, tablet, desktop';
COMMENT ON COLUMN public.leads.browser IS 'Browser used: chrome, safari, firefox, etc.';
COMMENT ON COLUMN public.leads.source_metadata IS 'Additional metadata about the source in JSON format';

-- Create index for analytics queries
CREATE INDEX idx_leads_ref_source ON public.leads(ref_source);
CREATE INDEX idx_leads_utm_campaign ON public.leads(utm_campaign);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);

-- Create a view for source analytics
CREATE OR REPLACE VIEW public.lead_source_analytics AS
SELECT
  ref_source,
  utm_campaign,
  utm_source,
  utm_medium,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE status = 'HOT') as hot_leads,
  COUNT(*) FILTER (WHERE status = 'ADMITTED') as converted_leads,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'ADMITTED')::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as conversion_rate,
  AVG(score) as avg_score,
  MIN(created_at) as first_lead_date,
  MAX(created_at) as last_lead_date
FROM public.leads
WHERE created_at > now() - interval '90 days'
GROUP BY ref_source, utm_campaign, utm_source, utm_medium
ORDER BY total_leads DESC;

COMMENT ON VIEW public.lead_source_analytics IS 'Analytics view showing lead source performance (last 90 days)';

-- Update get_or_create_lead_by_phone function to accept source parameters
CREATE OR REPLACE FUNCTION public.get_or_create_lead_by_phone(
    phone_input text,
    org_id_input uuid DEFAULT NULL,
    ref_source_input text DEFAULT NULL,
    utm_campaign_input text DEFAULT NULL,
    utm_source_input text DEFAULT NULL,
    utm_medium_input text DEFAULT NULL,
    source_metadata_input jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    id uuid,
    parent_name text,
    phone text,
    student_name text,
    class text,
    status text,
    score numeric,
    language_pref text,
    current_sentiment text,
    sentiment_confidence numeric,
    ref_source text,
    utm_campaign text,
    last_contact_at timestamp with time zone,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    lead_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.leads WHERE leads.phone = phone_input) INTO lead_exists;

    IF NOT lead_exists THEN
        INSERT INTO public.leads (
            phone,
            organization_id,
            status,
            language_pref,
            ref_source,
            utm_campaign,
            utm_source,
            utm_medium,
            source_metadata
        )
        VALUES (
            phone_input,
            org_id_input,
            'WARM',
            'en',
            ref_source_input,
            utm_campaign_input,
            utm_source_input,
            utm_medium_input,
            source_metadata_input
        );
    END IF;

    RETURN QUERY
    SELECT
        l.id,
        l.parent_name,
        l.phone,
        l.student_name,
        l.class,
        l.status,
        l.score,
        l.language_pref,
        l.current_sentiment,
        l.sentiment_confidence,
        l.ref_source,
        l.utm_campaign,
        l.last_contact_at,
        l.created_at
    FROM public.leads l
    WHERE l.phone = phone_input;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_lead_by_phone IS 'Gets existing lead by phone or creates new one with source tracking parameters';
