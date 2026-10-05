-- ARTICLE_METADATA: gera os metadados (summary/keywords/SEO) de um artigo já
-- existente. `items` fica com uma entrada por campo pedido (o `format` de cada
-- item é o nome do campo: 'summary', 'keywords', 'seoTitle', 'seoDescription').
ALTER TYPE "GenerationJobType" ADD VALUE IF NOT EXISTS 'ARTICLE_METADATA';