import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =====================================================
// AUTO-SUMMARY EDGE FUNCTION WITH CUMULATIVE LOGIC
// Version: 3.0 - Cumulative Summaries
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const INACTIVITY_THRESHOLD_MINUTES = 15;
const MAX_SESSIONS_PER_RUN = 50;
const OPENAI_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;

Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    console.log('🚀 Starting auto-summary processing with cumulative logic...');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Detect inactive sessions
    console.log('🔍 Detecting inactive sessions...');
    const { data: inactiveSessions, error: detectError } = await supabase.rpc(
      'auto_detect_inactive_sessions',
      { inactivity_minutes: INACTIVITY_THRESHOLD_MINUTES }
    );

    if (detectError) throw new Error(`Detection failed: ${detectError.message}`);

    if (!inactiveSessions || inactiveSessions.length === 0) {
      console.log('✅ No inactive sessions found');
      return successResponse({
        message: 'No inactive sessions to process',
        processed: 0,
        processing_time_ms: Date.now() - startTime
      });
    }

    const sessionsToProcess = inactiveSessions.slice(0, MAX_SESSIONS_PER_RUN);
    console.log(`📊 Processing ${sessionsToProcess.length} sessions`);

    const results = [];
    for (const session of sessionsToProcess) {
      const result = await processSessionWithCumulativeSummary(supabase, session);
      results.push(result);
      await sleep(100); // Rate limiting
    }

    const stats = generateStatistics(results);
    console.log(`✅ Complete: ${stats.successful} successful, ${stats.failed} failed`);

    return successResponse({
      success: true,
      processed: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      processing_time_ms: Date.now() - startTime,
      results
    });

  } catch (error) {
    console.error('❌ Critical error:', error);
    return errorResponse(error.message, 500);
  }
});

// =====================================================
// MAIN PROCESSING WITH CUMULATIVE SUMMARY
// =====================================================
async function processSessionWithCumulativeSummary(supabase: any, session: any, retryCount = 0) {
  try {
    console.log(`\n🔄 Processing session: ${session.session_id}`);
    console.log(`   Lead: ${session.lead_id}, Messages: ${session.message_count}`);

    if (session.message_count < 2) {
      console.log('⏭️  Skipped: Too few messages');
      return {
        session_id: session.session_id,
        lead_id: session.lead_id,
        success: true,
        skipped: true
      };
    }

    // Get ALL conversation data for cumulative summary
    const { data: conversationData, error: dataError } = await supabase.rpc(
      'get_all_lead_conversation_data',
      {
        p_lead_id: session.lead_id,
        p_current_session_id: session.session_id
      }
    );

    if (dataError) throw new Error(`Failed to get conversation data: ${dataError.message}`);
    if (!conversationData || !conversationData.all_messages) {
      throw new Error('No conversation data found');
    }

    // Generate AI summary using GPT-4o-mini
    const aiSummary = await generateCumulativeAISummary(conversationData);
    const nextAction = determineNextAction(conversationData);

    // Save cumulative summary using new function
    const { data: saveResult, error: saveError } = await supabase.rpc(
      'save_cumulative_summary',
      {
        p_lead_id: session.lead_id,
        p_session_id: session.session_id,
        p_new_summary: aiSummary,
        p_next_action: nextAction
      }
    );

    if (saveError) {
      console.warn('⚠️  Warning: Failed to save cumulative summary:', saveError.message);
    }

    // Process session-specific insights and reports
    const { data: processResult, error: processError } = await supabase.rpc(
      'auto_process_session_summary',
      { p_session_id: session.session_id }
    );

    if (processError) throw new Error(`Session processing failed: ${processError.message}`);

    console.log(`✅ Successfully processed with cumulative summary`);
    console.log(`   Total sessions: ${conversationData.session_count}`);

    return {
      session_id: session.session_id,
      lead_id: session.lead_id,
      success: true,
      total_sessions: conversationData.session_count,
      cumulative: true
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${errorMessage}`);

    if (retryCount < MAX_RETRIES) {
      console.log(`🔁 Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(1000 * (retryCount + 1));
      return processSessionWithCumulativeSummary(supabase, session, retryCount + 1);
    }

    return {
      session_id: session.session_id,
      lead_id: session.lead_id,
      success: false,
      error: errorMessage
    };
  }
}

// =====================================================
// AI SUMMARY GENERATION (CUMULATIVE)
// =====================================================
async function generateCumulativeAISummary(conversationData: any) {
  try {
    const allMessages = conversationData.all_messages || [];
    const currentSessionMessages = conversationData.current_session_messages || [];
    const previousSummary = conversationData.previous_summary;
    const sessionCount = conversationData.session_count || 1;
    const leadInfo = conversationData.lead_info || {};

    if (allMessages.length === 0) return 'No messages to summarize.';

    // Use last 30 messages to avoid token limits
    const recentMessages = allMessages.slice(-30);
    const conversationText = recentMessages.map((m: any) =>
      `${m.sender}: ${m.message}`
    ).join('\n');

    // Build prompt with previous context
    let prompt = `You are an AI assistant for Subbu Innovative Classes (educational coaching).

**Lead Information:**
- Parent: ${leadInfo.parent_name || 'Unknown'}
- Student: ${leadInfo.student_name || 'Unknown'}
- Class: ${leadInfo.class || 'Unknown'}
- Language: ${leadInfo.language_pref || 'en'}
- Sentiment: ${leadInfo.current_sentiment || 'neutral'}
- Engagement Score: ${leadInfo.engagement_score || 0}/100

**Conversation History:**
- Total Sessions: ${sessionCount}
- Total Messages: ${allMessages.length}
- Current Session Messages: ${currentSessionMessages.length}
`;

    if (previousSummary) {
      prompt += `\n**Previous Summary:**\n${previousSummary}\n\n`;
    }

    prompt += `\n**Recent Conversation (last ${recentMessages.length} messages):**\n${conversationText}\n\n`;

    prompt += `**Instructions:**
${sessionCount > 1 ? 'Update the summary with new information from this session.' : 'Create a summary for this first session.'}

Focus on:
1. Main topics and student's academic situation
2. Parent's key concerns or expectations
3. Budget/timeline hints if mentioned
4. Specific next action for counselor

Be concise (3-4 sentences), factual, and actionable.`;

    // Call OpenAI
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational counselor analyzer. Create concise, cumulative summaries that preserve context across sessions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 300
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API failed: ${response.status}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content;

      if (!summary) throw new Error('Empty summary from OpenAI');

      console.log('✅ AI Summary generated');
      return summary.trim();

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error generating AI summary:', error);
    return `Summary generation failed. Manual review required. Session ${conversationData.session_count || 1}`;
  }
}

function determineNextAction(conversationData: any) {
  const topics = conversationData.topics_discussed || [];
  const sentiment = conversationData.lead_info?.current_sentiment;
  const engagementScore = conversationData.lead_info?.engagement_score || 0;

  if (sentiment === 'angry' || sentiment === 'stressed') {
    return 'URGENT: Personal follow-up call needed - customer stressed/upset';
  }

  if (engagementScore > 70) {
    return 'HOT LEAD: Schedule call within 24h to discuss enrollment';
  }

  if (topics.includes('fees') || topics.includes('admission')) {
    return 'Schedule call to discuss pricing and enrollment';
  }

  return 'Follow up via WhatsApp within 24-48 hours';
}

function generateStatistics(results: any[]) {
  return {
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    total: results.length
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function successResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
