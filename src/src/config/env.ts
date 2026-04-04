export function envConfig() {
    return {
        NODE_ENV: import.meta.env.NODE_ENV,
        DATABASE_URL: import.meta.env.VITE_DATABASE_URL,
        SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ANTHROPIC_API_KEY: import.meta.env.VITE_ANTHROPIC_API_KEY,
        OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY,
    }
}
