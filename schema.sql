
CREATE TABLE public.conversations (
    conversation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    model_id uuid,
    title text DEFAULT 'New chat'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_leaf_message_id uuid
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    parent_message_id uuid,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    order_index integer NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: model_endpoints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_endpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid,
    url text NOT NULL,
    is_active boolean DEFAULT true,
    weight integer DEFAULT 1
);


ALTER TABLE public.model_endpoints OWNER TO postgres;

--
-- Name: model_usage_analytics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_usage_analytics (
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


ALTER TABLE public.model_usage_analytics OWNER TO postgres;

--
-- Name: models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.models (
    model_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_user_id uuid,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    short_description text,
    long_description text
);


ALTER TABLE public.models OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    token_id uuid NOT NULL,
    user_id uuid,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
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

CREATE TABLE ipfs_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cid TEXT NOT NULL,
    message_id UUID REFERENCES messages(message_id) ON DELETE CASCADE,
    password BYTEA NOT NULL, -- 32 raw bytes key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);