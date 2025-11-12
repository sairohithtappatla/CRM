-- Migration: Add Vector Embeddings for Semantic Search
-- Description: Enables vector extension and creates embeddings table for chat messages
-- Date: 2025-11-10

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table for messages
CREATE TABLE public.message_embeddings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  message_id bigint NOT NULL,
  lead_id uuid NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 embedding size
  content text NOT NULL, -- Stored for quick reference
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT message_embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT message_embeddings_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE,
  CONSTRAINT message_embeddings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE
);

-- Create index for vector similarity search (HNSW - faster but uses more memory)
CREATE INDEX idx_message_embeddings_vector ON public.message_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create index for filtering by lead
CREATE INDEX idx_message_embeddings_lead_id ON public.message_embeddings(lead_id);
CREATE INDEX idx_message_embeddings_created_at ON public.message_embeddings(created_at);

-- Enable RLS
ALTER TABLE public.message_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations (since backend will handle this)
CREATE POLICY msg_embeddings_all ON public.message_embeddings
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.message_embeddings IS 'Vector embeddings for semantic search across conversations';
COMMENT ON COLUMN public.message_embeddings.embedding IS 'Vector embedding (1536 dimensions for OpenAI ada-002)';

-- Create function for semantic search
CREATE OR REPLACE FUNCTION public.search_similar_messages(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_lead_id uuid DEFAULT NULL
)
RETURNS TABLE (
  message_id bigint,
  lead_id uuid,
  content text,
  similarity float,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    me.message_id,
    me.lead_id,
    me.content,
    1 - (me.embedding <=> query_embedding) as similarity,
    me.created_at
  FROM public.message_embeddings me
  WHERE
    (filter_lead_id IS NULL OR me.lead_id = filter_lead_id)
    AND 1 - (me.embedding <=> query_embedding) > match_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_similar_messages IS 'Semantic search for similar messages using vector similarity';

-- Create function to get conversation context with embeddings
CREATE OR REPLACE FUNCTION public.get_contextual_messages(
  lead_id_input uuid,
  query_embedding vector(1536),
  context_window int DEFAULT 5
)
RETURNS TABLE (
  message_id bigint,
  sender text,
  message text,
  timestamp timestamp with time zone,
  similarity_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.sender,
    m.message,
    m.timestamp,
    COALESCE(1 - (me.embedding <=> query_embedding), 0) as similarity_score
  FROM public.messages m
  LEFT JOIN public.message_embeddings me ON m.id = me.message_id
  WHERE m.lead_id = lead_id_input
  ORDER BY
    COALESCE(1 - (me.embedding <=> query_embedding), 0) DESC,
    m.timestamp DESC
  LIMIT context_window;
END;
$$;

COMMENT ON FUNCTION public.get_contextual_messages IS 'Gets relevant conversation context based on semantic similarity';

-- Create AI conversation insights table (stores embeddings of summaries)
CREATE TABLE public.conversation_insights (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  insight_type text NOT NULL CHECK (insight_type = ANY (ARRAY[
    'pain_point'::text,
    'goal'::text,
    'objection'::text,
    'interest'::text,
    'question'::text,
    'positive_signal'::text,
    'concern'::text
  ])),
  insight_text text NOT NULL,
  embedding vector(1536),
  confidence_score numeric CHECK (confidence_score >= 0 AND confidence_score <= 1),
  extracted_at timestamp with time zone DEFAULT now(),
  source_message_ids bigint[],
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT conversation_insights_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_insights_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE
);

-- Create index for semantic search on insights
CREATE INDEX idx_conversation_insights_vector ON public.conversation_insights
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_conversation_insights_lead_id ON public.conversation_insights(lead_id);
CREATE INDEX idx_conversation_insights_type ON public.conversation_insights(insight_type);

-- Enable RLS
ALTER TABLE public.conversation_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY insights_all ON public.conversation_insights
FOR ALL
TO public
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.conversation_insights IS 'AI-extracted insights from conversations with semantic search capability';
COMMENT ON COLUMN public.conversation_insights.insight_type IS 'Type of insight: pain_point, goal, objection, interest, question, positive_signal, concern';

-- Function to search insights
CREATE OR REPLACE FUNCTION public.search_conversation_insights(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  insight_type_filter text DEFAULT NULL,
  lead_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  lead_id uuid,
  insight_type text,
  insight_text text,
  similarity float,
  confidence_score numeric,
  extracted_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.lead_id,
    ci.insight_type,
    ci.insight_text,
    1 - (ci.embedding <=> query_embedding) as similarity,
    ci.confidence_score,
    ci.extracted_at
  FROM public.conversation_insights ci
  WHERE
    (lead_id_filter IS NULL OR ci.lead_id = lead_id_filter)
    AND (insight_type_filter IS NULL OR ci.insight_type = insight_type_filter)
    AND 1 - (ci.embedding <=> query_embedding) > match_threshold
  ORDER BY ci.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_conversation_insights IS 'Semantic search for conversation insights';

-- Create trigger to clean up embeddings when messages are deleted
CREATE OR REPLACE FUNCTION public.cleanup_message_embeddings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Embedding will be deleted automatically due to ON DELETE CASCADE
  RETURN OLD;
END;
$$;

-- Note: The actual trigger is not needed since we have ON DELETE CASCADE
-- But we keep the function for potential future use

COMMENT ON FUNCTION public.cleanup_message_embeddings IS 'Cleanup function for message embeddings (CASCADE handles this automatically)';
