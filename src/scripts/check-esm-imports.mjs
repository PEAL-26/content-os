#!/usr/bin/env node
// =============================================================================
// Guard de imports ESM para as Vercel Functions.
//
// Porque este script existe
// -----------------------
// As functions em `api/*.ts` correm em Node ESM nativo na Vercel (o
// `package.json` tem `"type": "module"`). O loader ESM do Node não resolve
// specifiers relativos sem extensão — `import './ai-api'` rebenta com
// `ERR_MODULE_NOT_FOUND`, ao contrário do Vite (dev/build) e do `tsc` com
// `moduleResolution: "bundler"`, que aceitam as duas formas.
//
// Ou seja: um import sem extensão passa em TODOS os gates locais e só falha em
// produção, depois do deploy. Este script fecha essa porta: percorre o grafo real
// das functions e falha o build, com `ficheiro:linha`, se encontrar um specifier
// relativo sem `.js`.
//
// A segunda regra é o modo de falha seguinte: a Vercel NÃO resolve o alias `@/`
// em código de função (o `tsc` só o usa para type checking; o specifier chega
// intacto ao Node). Um `import type` de um ficheiro alcançável que passe a ser
// um import de valor rebenta o deploy. Imports `import type` são permitidos
// porque são eliminados no emit.
//
// Uso: `node scripts/check-esm-imports.mjs` (ligado ao `npm run build`).
// =============================================================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = join(ROOT, 'api');

/** Caminho de código gerado — não é nosso, não corrigimos (`prisma generate`). */
const GENERATED_PREFIX = join('src', 'generated');

/**
 * Extrai os `{ specifier, line, isTypeOnly }` de um ficheiro, com o número de
 * linha CORRECTO mesmo em statements multilinha (`} from './x';`).
 */
function readImports(absPath) {
    const lines = readFileSync(absPath, 'utf8').split('\n');
    const results = [];

    for (let i = 0; i < lines.length; i++) {
        const first = lines[i];
        if (!/^\s*(?:import|export)\b/.test(first)) continue;

        // Acumula linhas até ao fim do statement (heurística: `;` no fim, ou
        // logo que um specifier aparece — `import './side-effect'` não tem `;`).
        let statement = first;
        let j = i;
        while (j + 1 < lines.length && !extractSpecifier(statement)) {
            j += 1;
            statement += `\n${lines[j]}`;
        }

        const extracted = extractSpecifier(statement);
        if (extracted) {
            results.push({
                specifier: extracted.specifier,
                // A linha do `from` é onde o specifier está — é o que o
                // utilizador precisa de ver no editor.
                line: j + 1,
                isTypeOnly: /^\s*import\s+type\b/.test(first),
            });
        }

        i = j; // salta o statement
    }

    return results;
}

/** Extrai o specifier de um statement import/export (completo ou parcial). */
function extractSpecifier(statement) {
    // `from '...'` — forma normal, com `import type`, `export ... from`, etc.
    const fromMatch = statement.match(/\bfrom\s*['"]([^'"]+)['"]/);
    if (fromMatch) return { specifier: fromMatch[1] };
    // `import '...'` / `export '...'` — side-effect, sem `from`.
    const bareMatch = statement.match(/^\s*(?:import|export)\s+['"]([^'"]+)['"]/);
    if (bareMatch) return { specifier: bareMatch[1] };
    return null;
}

/** Resolve um specifier relativo para o caminho do `.ts` correspondente. */
function resolveRelative(specifier, importerAbsPath) {
    const withoutExt = specifier.replace(/\.(m?js|m?ts|jsx|tsx|cjs|cts)$/, '');
    const base = resolve(dirname(importerAbsPath), withoutExt);
    const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function walkTsFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const abs = join(dir, entry);
        if (statSync(abs).isDirectory()) out.push(...walkTsFiles(abs));
        else if (entry.endsWith('.ts')) out.push(abs);
    }
    return out;
}

// -----------------------------------------------------------------------------
// Percorre o grafo alcançável a partir das entrypoints das functions.
// -----------------------------------------------------------------------------

if (!existsSync(API_DIR)) {
    console.log('[check:esm] src/api não existe — nada a verificar.');
    process.exit(0);
}

const entrypoints = walkTsFiles(API_DIR);
const visited = new Map(); // absPath -> { relPath, problems: [] }
let importCount = 0;
const queue = [...entrypoints];

while (queue.length > 0) {
    const absPath = queue.pop();
    if (visited.has(absPath)) continue;

    const relPath = relative(ROOT, absPath);
    // Código gerado pelo Prisma: os specifiers dele já vêm correctos (`.js`).
    if (relPath.split(sep).slice(0, 2).join('/') === GENERATED_PREFIX.split(sep).join('/')) {
        continue;
    }

    const problems = [];
    let imports;
    try {
        imports = readImports(absPath);
    } catch (err) {
        visited.set(absPath, { relPath, problems: [`não foi possível ler: ${err.message}`] });
        continue;
    }

    for (const { specifier, line, isTypeOnly } of imports) {
        importCount += 1;

        if (specifier.startsWith('.')) {
            // Regra 1 — specifier relativo tem de levar extensão `.js`.
            if (!/\.(?:js|mjs|cjs)$/.test(specifier)) {
                problems.push(
                    `linha ${line}: import relativo sem extensão — '${specifier}'. ` +
                        `O Node em ESM não resolve isto (ERR_MODULE_NOT_FOUND em produção). ` +
                        `Escrever '${specifier}.js' — o Vite e o tsc resolvem para o .ts.`
                );
            }
            const resolvedAbs = resolveRelative(specifier, absPath);
            if (resolvedAbs) queue.push(resolvedAbs);
        } else if (specifier.startsWith('@/') && !isTypeOnly) {
            // Regra 2 — alias `@/` num import de VALOR (não `import type`).
            problems.push(
                `linha ${line}: import de valor com o alias '${specifier}'. ` +
                    `A Vercel não resolve path aliases em functions — usar caminho relativo. ` +
                    `(num 'import type' é seguro: é eliminado no emit.)`
            );
        }
    }

    visited.set(absPath, { relPath, problems });
}

// -----------------------------------------------------------------------------
// Relatório
// -----------------------------------------------------------------------------

const failing = [...visited.values()].filter((entry) => entry.problems.length > 0);

if (failing.length === 0) {
    console.log(
        `[check:esm] OK — ${entrypoints.length} function(s), ` +
            `${visited.size} ficheiro(s) alcançável(is), ${importCount} import(s) verificado(s).`
    );
    process.exit(0);
}

console.error('[check:esm] FALHOU — imports que não resolvem em produção:\n');
for (const { relPath, problems } of failing) {
    console.error(`  ${relPath}`);
    for (const problem of problems) console.error(`      ${problem}`);
    console.error('');
}
console.error(
    'As functions correm em Node ESM nativo na Vercel, que não aceita specifiers\n' +
        'relativos sem extensão. O Vite e o tsc ("bundler") aceitam os dois estilos,\n' +
        'por isso isto passa em todos os gates locais e só falha em produção.'
);
process.exit(1);
