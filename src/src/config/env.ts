export function envConfig() {
    return {
        NODE_ENV: import.meta.env.NODE_ENV,
        DATABASE_URL: import.meta.env.VITE_DATABASE_URL,
        DATABASE_DIRECT_URL: import.meta.env.VITE_DATABASE_DIRECT_URL,
        SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ANTHROPIC_API_KEY: import.meta.env.VITE_ANTHROPIC_API_KEY,
        OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY,
        GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
        GROQ_API_KEY: import.meta.env.VITE_GROQ_API_KEY,
        DEEPSEEK_API_KEY: import.meta.env.VITE_DEEPSEEK_API_KEY,
        CEREBRAS_API_KEY: import.meta.env.VITE_CEREBRAS_API_KEY,
        TOGETHER_API_KEY: import.meta.env.VITE_TOGETHER_API_KEY,
        OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
        OLLAMA_URL: import.meta.env.VITE_OLLAMA_URL,
        AI_PROVIDER_PRIORITY: import.meta.env.VITE_AI_PROVIDER_PRIORITY,
        AI_DEFAULT_MODEL: import.meta.env.VITE_AI_DEFAULT_MODEL,
    };
}
