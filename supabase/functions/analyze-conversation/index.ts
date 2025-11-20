import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface ConversationMessage {
  sender: string;
  message: string;
  role: string;
  timestamp: string;
}

interface AnalysisRequest {
  lead_id: string;
  session_id?: string;
  messages: ConversationMessage[];
  profile?: Record<string, any>;
  context?: Record<string, any>;
  lead_info?: {
    parent_name?: string;
    student_name?: string;
    class?: string;
    current_sentiment?: string;
    language_pref?: string;
  };
}

interface ConversationAnalysis {
  // Summary
  conversation_summary: string;
  key_takeaways: string[];
  emotional_journey: string;

  // Academic Insights
  academic_weaknesses: string[];
  subjects_of_interest: string[];
  exam_preparation_status: string | null;
  study_habits: Record<string, any>;
  academic_readiness_score: number;
  long_term_goals: string[];

  // Behavioral Insights
  parent_concerns: string[];
  budget_hints: string | null;
  timeline_references: string | null;
  location_constraints: string | null;
  child_performance_patterns: Record<string, any>;
  exam_stress_markers: string[];

  // Next Actions
  next_action_type: 'call' | 'email' | 'whatsapp_followup' | 'schedule_demo' | 'send_brochure' | 'none';
  next_action_deadline: string | null;
  conversation_quality_score: number;
  topics_discussed: string[];
  confidence_score: number;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: AnalysisRequest = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided for analysis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Format conversation for analysis
    const conversationText = body.messages
      .map(m => `${m.sender} (${m.role || 'unknown'}): ${m.message}`)
      .join('\n');

    const leadInfo = body.lead_info || {};
    const profile = body.profile || {};

    // Create comprehensive AI analysis prompt
    const analysisPrompt = `You are an expert educational counselor analyzing a conversation between Subbu Innovative Classes and a potential student/parent.

LEAD INFORMATION:
- Parent: ${leadInfo.parent_name || 'Unknown'}
- Student: ${leadInfo.student_name || 'Unknown'}
- Class: ${leadInfo.class || 'Unknown'}
- Current Sentiment: ${leadInfo.current_sentiment || 'neutral'}
- Language: ${leadInfo.language_pref || 'en'}

EXISTING PROFILE (if any):
${JSON.stringify(profile, null, 2)}

CONVERSATION (${body.messages.length} messages):
${conversationText}

TASK: Provide a comprehensive, intelligent analysis of this conversation in JSON format with the following structure:

{
  "conversation_summary": "A detailed 3-4 sentence summary capturing the essence of the conversation, key concerns raised, and solutions discussed",
  "key_takeaways": ["Array of 3-5 most important insights from the conversation"],
  "emotional_journey": "Brief description of the emotional progression through the conversation",

  "academic_weaknesses": ["Specific subjects or topics the student struggles with"],
  "subjects_of_interest": ["Subjects the student is interested in or wants to focus on"],
  "exam_preparation_status": "Current preparation stage (beginner/ongoing/advanced) or null",
  "study_habits": {
    "study_time_daily": "Mentioned study duration if any",
    "learning_style": "Visual/auditory/kinesthetic if indicated",
    "challenges": ["Specific study challenges mentioned"]
  },
  "academic_readiness_score": 0-100 (estimate based on conversation),
  "long_term_goals": ["Career goals, exam targets like JEE/NEET, college aspirations"],

  "parent_concerns": ["Specific concerns or worries expressed by parent"],
  "budget_hints": "Any budget/pricing sensitivity mentioned or null",
  "timeline_references": "Any urgency or timeline mentioned (e.g., 'exam in 2 months') or null",
  "location_constraints": "Any location/travel constraints mentioned or null",
  "child_performance_patterns": {
    "current_performance": "Good/average/struggling if mentioned",
    "improvement_areas": ["Areas needing improvement"]
  },
  "exam_stress_markers": ["Signs of exam pressure, stress, or anxiety"],

  "next_action_type": "call|email|whatsapp_followup|schedule_demo|send_brochure|none",
  "next_action_deadline": "ISO timestamp for when action should be taken, or null",
  "conversation_quality_score": 0-100 (quality of conversation - depth, engagement, clarity),
  "topics_discussed": ["Main topics covered"],
  "confidence_score": 0-100 (how confident are you in this analysis based on conversation depth)
}

IMPORTANT RULES:
1. Extract ONLY information explicitly mentioned or strongly implied in the conversation
2. Do NOT fabricate or assume details not present in the conversation
3. Use null or empty arrays for missing information
4. Be specific and actionable in insights
5. Set academic_readiness_score based on indicators like: class understanding, study habits, motivation, current performance
6. Set conversation_quality_score based on: depth of discussion, information gathered, rapport built
7. Recommend next_action_type based on conversation stage and lead warmth
8. Be culturally sensitive (Indian education context: JEE, NEET, boards, coaching)

Return ONLY valid JSON, no markdown, no explanations.`;

    // Call OpenAI for intelligent analysis
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational counselor with deep knowledge of the Indian education system. You analyze conversations to extract meaningful insights.',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature: 0.3, // Low temperature for consistent, factual analysis
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${error}`);
    }

    const openaiData = await openaiResponse.json();
    const analysisText = openaiData.choices[0].message.content;

    let analysis: ConversationAnalysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', analysisText);
      throw new Error('AI returned invalid JSON');
    }

    // Validate and ensure all required fields exist
    const validatedAnalysis: ConversationAnalysis = {
      conversation_summary: analysis.conversation_summary || 'No summary available',
      key_takeaways: Array.isArray(analysis.key_takeaways) ? analysis.key_takeaways : [],
      emotional_journey: analysis.emotional_journey || 'Not analyzed',

      academic_weaknesses: Array.isArray(analysis.academic_weaknesses) ? analysis.academic_weaknesses : [],
      subjects_of_interest: Array.isArray(analysis.subjects_of_interest) ? analysis.subjects_of_interest : [],
      exam_preparation_status: analysis.exam_preparation_status || null,
      study_habits: typeof analysis.study_habits === 'object' ? analysis.study_habits : {},
      academic_readiness_score: Math.max(0, Math.min(100, Number(analysis.academic_readiness_score) || 0)),
      long_term_goals: Array.isArray(analysis.long_term_goals) ? analysis.long_term_goals : [],

      parent_concerns: Array.isArray(analysis.parent_concerns) ? analysis.parent_concerns : [],
      budget_hints: analysis.budget_hints || null,
      timeline_references: analysis.timeline_references || null,
      location_constraints: analysis.location_constraints || null,
      child_performance_patterns: typeof analysis.child_performance_patterns === 'object' ? analysis.child_performance_patterns : {},
      exam_stress_markers: Array.isArray(analysis.exam_stress_markers) ? analysis.exam_stress_markers : [],

      next_action_type: ['call', 'email', 'whatsapp_followup', 'schedule_demo', 'send_brochure', 'none'].includes(analysis.next_action_type)
        ? analysis.next_action_type as any
        : 'none',
      next_action_deadline: analysis.next_action_deadline || null,
      conversation_quality_score: Math.max(0, Math.min(100, Number(analysis.conversation_quality_score) || 50)),
      topics_discussed: Array.isArray(analysis.topics_discussed) ? analysis.topics_discussed : [],
      confidence_score: Math.max(0, Math.min(100, Number(analysis.confidence_score) || 50)),
    };

    return new Response(
      JSON.stringify({
        success: true,
        analysis: validatedAnalysis,
        message: 'Conversation analyzed successfully',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in analyze-conversation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
