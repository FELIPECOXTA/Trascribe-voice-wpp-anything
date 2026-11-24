# Arquitetura: Transcreva Tudo AI

- `apps/web`: React, Vite, TypeScript, interface inspirada no Stitch e parser de conversas.
- `apps/api`: Express, controle de acesso existente e integrações de IA.
- `apps/api/providers/elevenlabs.ts`: Scribe v2, prioridade para transcrição de áudio.
- `GEMINI_API_KEY`: fallback para áudio e provedor atual para imagens e vídeos.
- `design/stitch`: referências do design.

## Transcrição

1. O frontend recebe ZIP/TXT/áudios e associa arquivos a mensagens.
2. O De-Para tenta correspondência explícita pelo nome e depois por proximidade de horário **do mesmo tipo de mídia**.
3. Mídias sem vínculo seguro permanecem como remetente não identificado, sem associação automática pela ordem do ZIP.
4. O endpoint `POST /api/transcribe` tenta ElevenLabs com `ELEVENLABS_API_KEY`; se faltar credencial ou houver erro/cota, usa Gemini, caso configurado.
5. A resposta inclui `provider`, `modelUsed` e o texto. A transcrição não deve afirmar quem enviou o arquivo quando não há confirmação.

## Segurança e implantação

Chaves ficam no ambiente do servidor. Não faça upload de conversas privadas em repositórios públicos.
O rate-limit e a quota por IP existentes são voláteis em memória, portanto não são suficientes para SaaS em várias instâncias.
É necessário revisar os passcodes fixos legados, custos, privacidade e autorização antes de publicar comercialmente.
O fallback pode gerar custo em dois provedores se o primeiro consumir créditos antes de falhar.
