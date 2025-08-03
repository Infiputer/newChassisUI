-- Setup OLLAMA Models and Endpoints
-- Run this script after the main database setup

-- Insert OLLAMA models
INSERT INTO models (model_id, name, description, short_description, long_description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Llama 2', 'Meta''s Llama 2 model running locally via OLLAMA', 'Meta Llama 2', 'Llama 2 is a large language model by Meta, capable of understanding and generating human-like text across a wide range of topics. Running locally via OLLAMA for privacy and speed.'),
  ('00000000-0000-0000-0000-000000000002', 'Mistral', 'Mistral-7B model running locally via OLLAMA', 'Mistral 7B', 'Mistral-7B is a powerful open-source model known for its efficiency and performance. Running locally via OLLAMA for fast, private conversations.'),
  ('00000000-0000-0000-0000-000000000003', 'Phi-3', 'Microsoft Phi-3 model running locally via OLLAMA', 'Phi-3', 'Phi-3 is a compact, high-quality model by Microsoft, optimized for reasoning and coding tasks. Running locally via OLLAMA.'),
  ('00000000-0000-0000-0000-000000000004', 'CodeLlama', 'Code-focused Llama model running locally via OLLAMA', 'CodeLlama', 'CodeLlama is specialized for code generation, debugging, and programming tasks. Running locally via OLLAMA.'),
  ('00000000-0000-0000-0000-000000000005', 'Gemma', 'Google Gemma model running locally via OLLAMA', 'Gemma', 'Gemma is Google''s lightweight, open model designed for efficiency and safety. Running locally via OLLAMA.'),
  ('00000000-0000-0000-0000-000000000006', 'Neural Chat', 'Intel Neural Chat model running locally via OLLAMA', 'Neural Chat', 'Neural Chat is optimized for conversational AI with strong reasoning capabilities. Running locally via OLLAMA.')
ON CONFLICT (model_id) DO NOTHING;

-- Insert OLLAMA endpoints (all use the same endpoint URL but different model names in payload)
INSERT INTO model_endpoints (id, model_id, url, is_active, weight)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'http://localhost:11434/api/chat', true, 1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'http://localhost:11434/api/chat', true, 1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'http://localhost:11434/api/chat', true, 1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'http://localhost:11434/api/chat', true, 1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'http://localhost:11434/api/chat', true, 1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'http://localhost:11434/api/chat', true, 1)
ON CONFLICT DO NOTHING;

-- Add some sample usage analytics to make models appear in trending
INSERT INTO model_usage_analytics (model_id, user_id, conversation_id, usage_type, usage_count, tokens_used, session_duration)
SELECT 
  m.model_id,
  u.user_id,
  c.conversation_id,
  'conversation_start',
  1,
  100,
  300
FROM models m
CROSS JOIN (SELECT user_id FROM users LIMIT 1) u
CROSS JOIN (SELECT conversation_id FROM conversations LIMIT 1) c
WHERE m.model_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
)
ON CONFLICT DO NOTHING;

-- Print confirmation
SELECT 'OLLAMA models and endpoints setup completed!' as status; 