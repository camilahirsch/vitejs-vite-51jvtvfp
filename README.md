# Elo CRM

CRM em React/Vite com autenticação e dados no Supabase. Organiza contatos, etapas, tarefas e lembretes.

## Desenvolvimento

Use Node.js 22.12 ou superior compatível com Vite 8.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com a URL e a chave **publicável/anon** do projeto Supabase. Nunca use a chave `service_role` no frontend. As políticas RLS do Supabase continuam necessárias; os filtros de organização da interface não as substituem.

O pagamento só aparece quando `VITE_STRIPE_PAYMENT_LINK` contém a URL HTTPS de um Payment Link configurado. Sem esse link, a interface informa que as assinaturas ainda não estão disponíveis. A regra de expiração do teste foi mantida.

## Verificação

```sh
npm test
npm run test:render
npm run lint
npm run build
```

`test:render` usa configuração fictícia e renderização no servidor. Verifica textos, métricas, estados vazios e semântica; não realiza login nem grava dados no Supabase. O Vite abre um socket local durante esse comando. Testes no navegador ainda são necessários para conferir layout, teclado e integração com o backend real.

## Definições das métricas

- Conversão: ganhos / (ganhos + perdas). Sem encerrados, mostra `—`.
- Distribuição por etapa: estado atual de cada contato. Não calcula avanço histórico.
- Gráficos mensais: agrupamento por **data de entrada**, com seleção de 6 ou 12 meses. O valor ganho considera contatos atualmente ganhos; não é receita por data de fechamento.
- Região: inferência do DDD do número, não localização atual da pessoa.
- Tarefas pendentes no painel: total da organização, independentemente do filtro de entrada dos contatos.

## Melhorias desta branch

Métricas consistentes, gráficos responsivos com dados em tabela, contraste do login, CSS próprio do Elo, título em português, validação de nome/e-mail/telefone/valor, aviso de duplicidade com confirmação, busca por e-mail/telefone, nomes acessíveis, foco e Escape no modal, erros visíveis para operações de dados e pagamento sem link falso.

As validações desta versão são do frontend. A criação automática pelo WhatsApp e as restrições do banco precisam ser verificadas no serviço responsável pela integração. Nenhuma alteração de schema ou migração foi aplicada.
