/**
 * Lê a configuração de ambiente.
 *
 * No browser/Vite, `import.meta.env` é substituído em tempo de compilação — é
 * esse o caminho normal da app.
 *
 * O fallback para `process.env` existe para os scripts `tsx` em `scripts/`,
 * que correm em Node sem o Vite e sem `import.meta.env`. Sem isto, qualquer
 * probe que importe um serviço que toque em `@/lib/supabase` rebenta com
 * "Cannot read properties of undefined (reading 'NODE_ENV')" antes de correr
 * uma única linha de lógica.
 *
 * Sob Vite o `import.meta.env` está sempre definido, logo o comportamento da
 * app é idêntico ao de antes.
 */
export function envConfig() {
    const vite = import.meta.env ?? {};
    const node = typeof process !== 'undefined' ? process.env : {};

    // String vazia em vez de undefined: `createClient` do Supabase exige
    // strings, e uma env ausente deve falhar em runtime com uma URL vazia
    // (mais legível) em vez de num erro de tipos.
    const pick = (key: string): string =>
        vite[key] ?? node[key] ?? node[key.replace(/^VITE_/, '')] ?? '';

    return {
        NODE_ENV: pick('NODE_ENV'),
        DATABASE_URL: pick('VITE_DATABASE_URL'),
        DATABASE_DIRECT_URL: pick('VITE_DATABASE_DIRECT_URL'),
        SUPABASE_URL: pick('VITE_SUPABASE_URL') ?? pick('SUPABASE_URL'),
        SUPABASE_PUBLISHABLE_KEY:
            pick('VITE_SUPABASE_PUBLISHABLE_KEY') ??
            pick('SUPABASE_PUBLISHABLE_KEY') ??
            pick('SUPABASE_ANON_KEY'),
    };
}