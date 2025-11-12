import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
      }
    });
  }

  try {
    // Get Resend API key from environment - REQUIRED
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('🚨 CRITICAL: RESEND_API_KEY not configured in Supabase secrets');
      console.error('Set it via Supabase Dashboard → Project Settings → Edge Functions → Secrets');
      console.error('Or via CLI: npx supabase secrets set RESEND_API_KEY=your_key --project-ref YOUR_REF');
      return new Response(JSON.stringify({
        success: false,
        error: 'Email service not configured. Contact administrator.'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log(`Processing password reset request for: ${email}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate reset token and store in database
    const { data: tokenData, error: tokenError } = await supabase.rpc('generate_reset_token', {
      p_email: email.toLowerCase()
    });

    if (tokenError) {
      console.error('Token generation error:', tokenError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to generate reset code'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!tokenData?.success) {
      return new Response(JSON.stringify({
        success: false,
        error: tokenData?.error || 'Failed to generate reset code'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const code = tokenData.code;

    console.log(`Generated reset code for ${email}`);

    // Send email using Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Subbu Innovative Classes <onboarding@resend.dev>',
        to: [email],
        subject: 'Password Reset Code - Subbu Innovative Classes',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background: #E31E24; color: white; padding: 30px 20px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; }
                .content { padding: 40px 30px; }
                .code-box { background: #f8f9fa; border: 2px solid #E31E24; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
                .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #E31E24; font-family: 'Courier New', monospace; }
                .info { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎓 Subbu Innovative Classes</h1>
                </div>
                <div class="content">
                  <h2 style="color: #E31E24;">Password Reset Request</h2>
                  <p>Hello,</p>
                  <p>We received a request to reset your password for your Subbu Innovative Classes CRM account.</p>
                  <p><strong>Your verification code is:</strong></p>
                  <div class="code-box">
                    <div class="code">${code}</div>
                  </div>
                  <div class="info">
                    <strong>⏰ Important:</strong> This code will expire in <strong>15 minutes</strong>.
                  </div>
                  <p>Enter this code on the password reset page to continue.</p>
                  <p><strong>If you didn't request this password reset,</strong> please ignore this email or contact support if you have concerns.</p>
                </div>
                <div class="footer">
                  <p>© 2025 Subbu Innovative Classes. All rights reserved.</p>
                  <p style="margin-top: 10px; color: #999;">This is an automated email, please do not reply.</p>
                </div>
              </div>
            </body>
          </html>
        `
      })
    });

    const responseText = await emailResponse.text();
    console.log('Resend API response status:', emailResponse.status);

    if (!emailResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { message: responseText };
      }
      console.error('Resend API Error:', errorData);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to send email',
        details: errorData
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const emailData = JSON.parse(responseText);
    console.log('Email sent successfully:', emailData.id);

    return new Response(JSON.stringify({
      success: true,
      messageId: emailData.id
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
