import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    const { email, source } = await req.json();

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

    const sourceText = source === 'forgot-password' ? 'password reset' : 'settings page';
    console.log(`Sending password changed notification to: ${email} (source: ${source})`);

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
        subject: '✅ Password Changed - Subbu Innovative Classes CRM',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background: #16a34a; color: white; padding: 30px 20px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; }
                .content { padding: 40px 30px; }
                .success-icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
                .info { background: #dcfce7; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
                .timestamp { color: #666; font-size: 14px; margin-top: 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎓 Subbu Innovative Classes</h1>
                </div>
                <div class="content">
                  <div class="success-icon">✅</div>
                  <h2 style="color: #16a34a; text-align: center;">Password Changed Successfully</h2>
                  <p>Hello,</p>
                  <p>Your password for your Subbu Innovative Classes CRM account has been successfully changed via the <strong>${sourceText}</strong>.</p>
                  <div class="info">
                    <strong>✅ Confirmed:</strong> Your password has been updated and is now active.
                  </div>
                  <p class="timestamp">Changed on: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
                  <div class="warning">
                    <strong>⚠️ Security Alert:</strong> If you did not make this change, please contact your system administrator immediately to secure your account.
                  </div>
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
