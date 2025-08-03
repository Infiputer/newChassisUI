const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const setupDatabase = async () => {
  try {
    console.log('Setting up ChassisUI database...');

    // Create tables
    await pool.query(`
      -- Users and Authentication
      CREATE TABLE IF NOT EXISTS public.users (
          user_id uuid DEFAULT gen_random_uuid() NOT NULL,
          email character varying(255) NOT NULL,
          password_hash character varying(255) NOT NULL,
          is_verified boolean DEFAULT false,
          created_at timestamp with time zone DEFAULT now(),
          updated_at timestamp with time zone DEFAULT now(),
          last_login timestamp with time zone,
          user_role character varying(20) DEFAULT 'user'::character varying,
          pfp_cid text,
          name text
      );

      CREATE TABLE IF NOT EXISTS public.refresh_tokens (
          token_id uuid NOT NULL,
          user_id uuid,
          expires_at timestamp with time zone NOT NULL,
          created_at timestamp with time zone DEFAULT now()
      );

      -- Conversations and Messages (Tree Structure)
      CREATE TABLE IF NOT EXISTS public.conversations (
          conversation_id uuid DEFAULT gen_random_uuid() NOT NULL,
          user_id uuid,
          model_id uuid,
          title text DEFAULT 'New chat'::text,
          created_at timestamp with time zone DEFAULT now(),
          updated_at timestamp with time zone DEFAULT now(),
          current_leaf_message_id uuid
      );

      CREATE TABLE IF NOT EXISTS public.messages (
          message_id uuid DEFAULT gen_random_uuid() NOT NULL,
          conversation_id uuid,
          parent_message_id uuid,
          role text NOT NULL,
          content text NOT NULL,
          created_at timestamp with time zone DEFAULT now(),
          order_index integer NOT NULL
      );

      -- Models and Endpoints
      CREATE TABLE IF NOT EXISTS public.models (
          model_id uuid DEFAULT gen_random_uuid() NOT NULL,
          name text NOT NULL,
          owner_user_id uuid,
          description text,
          created_at timestamp without time zone DEFAULT now(),
          short_description text,
          long_description text
      );

      CREATE TABLE IF NOT EXISTS public.model_endpoints (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          model_id uuid,
          url text NOT NULL,
          is_active boolean DEFAULT true,
          weight integer DEFAULT 1
      );

      -- Analytics and Usage Tracking
      CREATE TABLE IF NOT EXISTS public.model_usage_analytics (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          model_id uuid,
          user_id uuid,
          conversation_id uuid,
          usage_type text NOT NULL,
          usage_count integer DEFAULT 1,
          tokens_used integer,
          created_at timestamp without time zone DEFAULT now(),
          session_duration integer
      );
    `);

    // Add primary keys and constraints
    await pool.query(`
      ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);
      ALTER TABLE public.refresh_tokens ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (token_id);
      ALTER TABLE public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (conversation_id);
      ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (message_id);
      ALTER TABLE public.models ADD CONSTRAINT models_pkey PRIMARY KEY (model_id);
      ALTER TABLE public.model_endpoints ADD CONSTRAINT model_endpoints_pkey PRIMARY KEY (id);
      ALTER TABLE public.model_usage_analytics ADD CONSTRAINT model_usage_analytics_pkey PRIMARY KEY (id);
    `);

    // Add foreign key constraints
    await pool.query(`
      ALTER TABLE public.refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
      ALTER TABLE public.conversations ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
      ALTER TABLE public.conversations ADD CONSTRAINT conversations_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(model_id) ON DELETE SET NULL;
      ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(conversation_id) ON DELETE CASCADE;
      ALTER TABLE public.messages ADD CONSTRAINT messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages(message_id) ON DELETE CASCADE;
      ALTER TABLE public.models ADD CONSTRAINT models_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;
      ALTER TABLE public.model_endpoints ADD CONSTRAINT model_endpoints_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(model_id) ON DELETE CASCADE;
      ALTER TABLE public.model_usage_analytics ADD CONSTRAINT model_usage_analytics_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(model_id) ON DELETE CASCADE;
      ALTER TABLE public.model_usage_analytics ADD CONSTRAINT model_usage_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
      ALTER TABLE public.model_usage_analytics ADD CONSTRAINT model_usage_analytics_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(conversation_id) ON DELETE CASCADE;
    `);

    // Add indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON public.messages(parent_message_id);
      CREATE INDEX IF NOT EXISTS idx_model_usage_analytics_model_id ON public.model_usage_analytics(model_id);
      CREATE INDEX IF NOT EXISTS idx_model_usage_analytics_user_id ON public.model_usage_analytics(user_id);
    `);

    // Insert some default models
    await pool.query(`
      INSERT INTO public.models (name, description, short_description, long_description) VALUES
      ('GPT-4', 'OpenAI''s most advanced language model', 'Most capable GPT model', 'GPT-4 is OpenAI''s most advanced language model, capable of understanding and generating human-like text across a wide range of topics and tasks.'),
      ('Claude-3', 'Anthropic''s advanced AI assistant', 'Advanced reasoning and analysis', 'Claude-3 is Anthropic''s most advanced AI assistant, known for its strong reasoning capabilities and helpful, harmless, and honest responses.'),
      ('Gemini Pro', 'Google''s multimodal AI model', 'Multimodal understanding', 'Gemini Pro is Google''s advanced AI model that can understand and generate text, images, and other content types.')
      ON CONFLICT DO NOTHING;
    `);

    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

setupDatabase(); 