// Supabase Edge Function: Send Auto Follow-ups
// Runs daily to send follow-up messages to leads after 24 hours of inactivity

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Get leads needing follow-up (24 hours since last message)
    const { data: leads, error: leadsError } = await supabase
      .rpc('get_leads_needing_followup', {
        p_hours_since_last_message: 24
      })

    if (leadsError) {
      console.error('Error fetching leads:', leadsError)
      throw leadsError
    }

    console.log(`Found ${leads?.length || 0} leads needing follow-up`)

    const results = []
    let sentCount = 0

    // 2. Process each lead
    for (const lead of leads || []) {
      // Skip if shouldn't follow up
      if (!lead.should_follow_up) {
        console.log(`Skipping lead ${lead.lead_id} - shouldn't follow up`)
        continue
      }

      console.log(`Generating follow-up for lead ${lead.lead_id}`)

      // Generate follow-up message
      const { data: followupData, error: followupError } = await supabase
        .rpc('generate_followup_message', {
          p_lead_id: lead.lead_id
        })

      if (followupError) {
        console.error(`Error generating follow-up for ${lead.lead_id}:`, followupError)
        results.push({
          lead_id: lead.lead_id,
          success: false,
          error: followupError.message
        })
        continue
      }

      // Send WhatsApp message
      if (whatsappToken && whatsappPhoneId) {
        try {
          const whatsappResponse = await fetch(
            `https://graph.facebook.com/v17.0/${whatsappPhoneId}/messages`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${whatsappToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: followupData.phone,
                type: 'text',
                text: {
                  body: followupData.message
                }
              })
            }
          )

          if (whatsappResponse.ok) {
            console.log(`Follow-up sent to ${lead.phone}`)
            sentCount++

            results.push({
              lead_id: lead.lead_id,
              phone: lead.phone,
              success: true,
              message: followupData.message
            })
          } else {
            const errorText = await whatsappResponse.text()
            console.error(`WhatsApp API error for ${lead.phone}:`, errorText)
            results.push({
              lead_id: lead.lead_id,
              success: false,
              error: `WhatsApp API error: ${errorText}`
            })
          }
        } catch (whatsappError) {
          console.error(`Error sending WhatsApp to ${lead.phone}:`, whatsappError)
          results.push({
            lead_id: lead.lead_id,
            success: false,
            error: whatsappError.message
          })
        }
      } else {
        // No WhatsApp credentials - just log
        console.log(`Follow-up message prepared for ${lead.phone}: ${followupData.message}`)
        results.push({
          lead_id: lead.lead_id,
          phone: lead.phone,
          success: true,
          message: followupData.message,
          note: 'Not sent - WhatsApp credentials not configured'
        })
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_leads: leads?.length || 0,
        followups_sent: sentCount,
        results: results
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
