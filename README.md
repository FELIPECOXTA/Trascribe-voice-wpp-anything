# Transcreva Tudo AI

Aplicação de reconstrução cronológica de conversas, associação de áudios e transcrição.

## Monorepo

- `apps/web`: frontend React/Vite, visual adaptado de referência do Stitch.
- `apps/api`: API Express e provedores de transcrição.
- `design/stitch`: referência visual, não código de produção.
- `docs/ARCHITECTURE.md`: detalhes técnicos.

## Rodar

```sh
bun install
cp .env.example .env
# Configure ELEVENLABS_API_KEY e/ou GEMINI_API_KEY
bun run dev
bun run lint
bun run test
bun run build
```

**ElevenLabs Scribe v2** é a primeira tentativa para áudios. **Gemini** é o fallback e permanece responsável pela análise de imagens e vídeos. As chaves pertencem somente ao backend.
