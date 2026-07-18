# Plano: Painel de Operações Backoffice (Kanban) - A Forja do Anel

Este plano detalha todas as implementações necessárias para transformar a interface visual do Kanban (atualmente estática) em uma aplicação interativa e segura. As modificações estão separadas em etapas temáticas com referências à Terra Média. 

---

## User Review Required

> [!IMPORTANT]
> **Autenticação Padrão:** Iremos implementar um script no topo do `backoffice.html` que verifica se existe um token válido no navegador (salvo no localStorage). Caso o token não exista ou esteja expirado, o script barrará o carregamento e fará o redirecionamento imediato para `bo-login.html`. Concorda com essa abordagem simples e direta no Front-end?

> [!NOTE]
> **Planilha de Técnicos e Avatares:** Vou expor a pasta `data/avatares` no Express para carregar as fotos na Web (`http://localhost:3000/avatares/nome-tecnico.jpg`). O backend vai ler a planilha `tecnicos.xlsx` para mapear os cargos (FSE, CC, RSE) e enviar via API.

---

## 1. A Sociedade do Anel: A Construção dos Cards, Front-end e Autenticação
Esta etapa foca na estruturação visual interativa, e em "fechar os portões" de Moria (garantindo a segurança e autenticação).
Decidimos **manter o `backoffice.html`** como painel principal.

**Objetivos:**
- **Autenticação Segura:** Injetar o controle de sessão no `backoffice.html`. Qualquer tentativa de abrir a página sem login redirecionará imediatamente para o **`bo-login.html`**. Após login no `bo-login.html`, a página redirecionará para o `backoffice.html`.
- Criar o arquivo `public/js/kanban.js` para popular o DOM, criar os cartões e gerenciar o Drag and Drop.
- Expor os avatares (`data/avatares`) via `express.static` no `app.js`.

**Análise Visual do Card Normal (Mockup "Black Titanium"):**
- **Cabeçalho:** Ícone Prancheta | Pedido `#PD-XXXX` | *Badge de Status* (Ponto colorido + texto) | Menu "Três Pontinhos".
- **Meio (Técnico):** Avatar carregado de `/avatares/{nome_do_tecnico}.jpg` | "Técnico" e Nome | *Badge de Cargo (FSE, CC, RSE)*.
- **Meio (Detalhes):** Ícone Prédio + Nome do Cliente / Ícone Impressora + Modelo.
- **Rodapé:** Ícone Documento + "Nº Orçamento" / Ícone Escudo + "B.O." (Nome do responsável).

**Análise Visual do Card "Máquina Parada" (Machine Down / MD):**
Para solicitações prioritárias (MD), o card ganhará aparência de alerta:
- **Borda superior:** Listrada em tons de vermelho escuro (estilo fita de isolamento).
- **Cabeçalho (Esquerda):** Ícone de impressora vermelho brilhante.
- **Cabeçalho (Direita):** Badge vermelho "MACHINE DOWN".
- **Rodapé Extra:** Bloco em gradiente vermelho intenso exibindo: `⚠️ MACHINE DOWN | PRIORIDADE MÁXIMA`.

## 2. As Duas Torres: A Fundação do Backend (APIs e Banco)
Conectando os status do Kanban e o banco de dados de forma autêntica.

**Modificações no Backend:**
- `src/database/queries.js`: Modificar `registrarSolicitacao` para usar `PENDENTE` (em vez de `EM_ANALISE`) nas novas criações.
- `src/server/app.js`: A rota protegida `/api/pedidos` lerá a planilha `data/tecnicos.xlsx` para injetar o cargo (FSE, CC, RSE) ao enviar as informações para o painel.
- **Rota Drag & Drop:** Garantir que a rota `PUT /api/pedidos/:id/status` suporte exatamente as 6 etapas (`PENDENTE`, `EM_ANALISE`, `ORCAMENTO_ENVIADO`, `APROVADO`, `EM_PROCESSAMENTO`, `FINALIZADO`).

## 3. O Retorno do Rei: O Palco e as Notificações de WhatsApp
Sincronizando o Dashboard de TV e trazendo vida com o WhatsApp.

**Dashboard TV (`tv_api.js` e `app.js`):**
- Atualizar a API do dashboard e tooltips do front-end (`app.js`) para que funcionem com as chaves oficiais: `PENDENTE`, `EM_ANALISE`, `ORCAMENTO_ENVIADO`, `APROVADO`, `EM_PROCESSAMENTO`, `FINALIZADO`.

**Notificações Automáticas no WhatsApp:**
- Na rota protegida `PUT /api/pedidos/:id/status` no Backend:
  - Se status mudado para `'ORCAMENTO_ENVIADO'`: Disparar aviso via bot para o técnico (Orçamento enviado).
  - Se status mudado para `'FINALIZADO'`: Disparar aviso via bot para o técnico (Pedido faturado/liberado para aguardar peça).

---

## Verification Plan

### Manual Verification
1. Tentar acessar `localhost:3000/backoffice.html` em janela anônima -> Ser forçado para `bo-login.html`.
2. Fazer login em `bo-login.html` com sucesso e cair no painel Kanban.
3. Criar pedido Normal e pedido MD pelo WhatsApp; checar no Kanban se ambos carregam corretamente (MD com vermelho listrado).
4. Arrastar o Card para verificar o funcionamento do Drag & Drop e salvar banco (via API protegida).
5. Ao arrastar para "O. Env.", confirmar se o bot dispara notificação no WhatsApp.
6. Validar o Dashboard de TV.
