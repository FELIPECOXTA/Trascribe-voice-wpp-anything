# Pipeline de Transcrição: Gemini 3.5 Transcribe com Fallback Dinâmico para Gemini 3.1 Flash-Lite

Arquitetura e implementação para priorização do modelo especializado `gemini-3.5-transcribe` com fallback automático e transparente para `gemini-3.1-flash-lite`, garantindo alta precisão na transcrição fonética de áudios em português e máxima resiliência operacional contra oscilações de cota ou rede.

---

### Decisões Confirmadas com o Usuário

> [!IMPORTANT]
> **Definições alinhadas na etapa de planejamento:**
> 1. **Ordem de Execução dos Modelos**: O backend priorizará exclusivamente `gemini-3.5-transcribe` (modelo especializado oficial do Gemini para transcrição de áudio). Em caso de indisponibilidade, saturação de cota temporária ou erro 429/503, o sistema executará fallback dinâmico imediato para `gemini-3.1-flash-lite`.
> 2. **Tratamento de Exceções**: Se ambos os modelos da cadeia falharem, a interface exibirá um aviso amigável e contextual no card do áudio afetado, com um botão direto de ação rápida ("Tentar novamente") sem interromper o restante do lote.
> 3. **Indicação Visual do Modelo**: Apresentação discreta e minimalista via tipografia sutil (`· modelo usado`), respeitando a disciplina anti-slop (sem badges coloridos ou cápsulas estáticas).

---

## 1. Visão Geral & Conceito

O serviço de transcrição é o coração do aplicativo de extração e organização de conversas e áudios. Esta atualização otimiza a qualidade e a confiabilidade do processo:
- **Especialização de Áudio (`gemini-3.5-transcribe`)**: Processa gravações de voz (incluindo notas de voz compactadas do WhatsApp nos formatos `.opus`, `.ogg`, `.m4a`, `.mp3` e `.wav`), garantindo pontuação gramatical fiel, reconhecimento apurado de gírias e contexto em português brasileiro.
- **Resiliência com Fallback Dinâmico (`gemini-3.1-flash-lite`)**: Atua como contingência em milissegundos sem que o usuário note lentidão ou perda de dados.
- **Recuperação de Erros por Item**: Permite que falhas isoladas de rede ou áudios corrompidos sejam reprocessados individualmente com um clique, sem recarregar a conversa ou reiniciar a fila inteira.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos e Interações
1. **Processamento da Fila**:
   - Cada mensagem de áudio na conversa exibe seu estado (Aguardando, Transcrevendo, Concluído ou Necessita Revisão).
   - Enquanto transcreve, um indicador textual animado e discreto mostra o andamento.
2. **Exibição do Resultado**:
   - Ao concluir, o balão exibe o texto transcrito integrado à linha do tempo cronológica.
   - Um metadado textual limpo indica o modelo que gerou a transcrição (ex: `14:32 · gemini-3.5-transcribe`), garantindo transparência técnica sem sobrecarga visual.
3. **Card de Falha & Botão de Reprocessamento**:
   - Se ocorrer falha em toda a cadeia, o balão exibe um aviso claro em tom neutro suave com ação tátil generosa (hitbox $\ge 44\text{px}$ para celulares e desktops): `Não foi possível transcrever este áudio [Tentar novamente]`.
   - O clique no botão reenvia apenas o arquivo específico diretamente para a rota `/api/transcribe`.

### Diretrizes de Acessibilidade & Mobile Touch
- Totalmente utilizável em telas móveis compactas (375px a 430px) com espaçamentos confortáveis para polegar e botões de toque com altura mínima de 44px.
- Contraste WCAG AA garantido em todos os textos de transcrição e status de erro.

---

## 3. Decisões de Arquitetura & Diretrizes Técnicas

### Decisão 1: Ordem e Modelos Selecionados
- **Modelo Primário**: `gemini-3.5-transcribe`
  - *Motivo*: Modelo recomendado pela especificação oficial do Gemini para tarefas de transcrição de fala estática e pre-recorded audio, com precisão superior na reconstrução de diálogos.
- **Modelo de Fallback**: `gemini-3.1-flash-lite`
  - *Motivo*: Resposta rápida com consumo enxuto de cota, excelente para evitar travamentos durante rajadas de arquivos de voz em lotes.

### Decisão 2: Retentativa Local Isolada
- O estado de cada item na fila mantém o buffer do áudio em memória no cliente (`Blob`), possibilitando reexecutar a transcrição individualmente caso o usuário clique em "Tentar novamente", sem precisar reler o arquivo ZIP.

---

## 4. Arquitetura do Sistema & Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                      FLUXO DE TRANSCRIÇÃO DE ÁUDIO                     │
│                                                                        │
│   [Arquivo de Áudio (.opus, .ogg, .m4a)]                               │
│              │                                                         │
│              ▼                                                         │
│   POST /api/transcribe (Base64 + MimeType)                             │
│              │                                                         │
│              ▼                                                         │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Servidor Express: Motor de Tentativas em Cascata               │   │
│   │                                                                │   │
│   │  1ª Tentativa: gemini-3.5-transcribe                           │   │
│   │  ├─ Sucesso ──────────────────────► Resposta 200 { text, model }│   │
│   │  └─ Erro (404, 429, 503)                                       │   │
│   │        │                                                       │   │
│   │        ▼                                                       │   │
│   │  2ª Tentativa (Fallback): gemini-3.1-flash-lite                │   │
│   │  ├─ Sucesso ──────────────────────► Resposta 200 { text, model }│   │
│   │  └─ Erro em ambos                                              │   │
│   │        │                                                       │   │
│   │        ▼                                                       │   │
│   │  Resposta 500 { error, details }                               │   │
│   └────────────────────────────────────────────────────────────────┘   │
│              │                                                         │
│              ▼                                                         │
│   [Interface do Usuário / Card do Áudio]                               │
│   ├─ Sucesso: Exibe transcrição + sutil "gemini-3.5-transcribe"        │
│   └─ Erro: Exibe aviso amigável + botão "Tentar novamente" (44px)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Próximos Passos na Execução

1. Atualizar o array `candidateModels` em `server.ts` para ordenar especificamente `gemini-3.5-transcribe` seguido de `gemini-3.1-flash-lite`.
2. Incluir a propriedade `model` no payload de resposta de sucesso de `/api/transcribe` para que o frontend saiba qual modelo concluiu o processamento.
3. Adicionar no componente de exibição de áudio do chat a exibição discreta do modelo e o botão com handler funcional para "Tentar novamente" em caso de erro individual.
4. Validar o fluxo com compilação e testes de execução.
