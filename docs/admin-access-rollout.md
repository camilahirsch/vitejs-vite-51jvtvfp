# Painel administrativo de acessos — Elo

## Objetivo

Somente a administração Hirsch pode escolher quem usa o Elo gratuitamente, por cortesia, durante um período de teste, por autorização comercial paga ou fica bloqueado. A unidade de licença é a **organização**: integrantes da mesma organização compartilham o acesso. Isso não concede automaticamente assinatura/cobrança financeira.

## Segurança

- Acesso administrativo é confirmado no banco por \`elo_admins\`, não pelo nome/e-mail no JavaScript.
- O frontend chama \`elo_my_access()\` para decidir o acesso da conta; o Supabase aplica o controle com política **RESTRICTIVE** de RLS nos contatos, tarefas e históricos existentes.
- Os usuários não podem escrever diretamente nas tabelas \`elo_access_grants\`, \`elo_admins\` e \`elo_access_audit\`. O único caminho de escrita é a função \`elo_admin_set_access\`, que verifica o usuário autenticado.
- Cada mudança de acesso fica registrada em \`elo_access_audit\`.
- Contatos e tarefas são preservados quando uma organização fica bloqueada.
- Cortesias e testes expiram na data configurada, usando \`current_date\` do servidor PostgreSQL. Confirme o fuso usado no banco na revisão.

## Configuração no Supabase (exige acesso ao SQL Editor)

1. Faça um **backup** do banco e confira os nomes de colunas \`organizations\` (\`id\`, \`name\`, \`subscription_status\`, \`trial_ends_at\`) e \`profiles\` (\`id\`, \`full_name\`, \`organization_id\`).
2. Analise as políticas existentes de RLS para \`contacts\`, \`tasks\`, \`deal_stage_history\`, \`contact_interactions\` (se existir) e \`organizations\`. Não execute a migração se as políticas atuais forem incompatíveis.
3. Revise o SQL \`scripts/elo-admin-access.sql\` e execute no **projeto Supabase correto**. O SQL **não cria administradora automaticamente**.
4. No SQL Editor, identifique primeiro o login real da administradora:

\`\`\`sql
select id, email from auth.users
where lower(email) = lower('camila.hirsch@hirschgrowth.com.br');
\`\`\`

5. Se e somente se o usuário encontrado for o login administrador desejado, conceda o perfil (ajuste o e-mail se for outro):

\`\`\`sql
insert into public.elo_admins(user_id)
select id from auth.users
where lower(email) = lower('camila.hirsch@hirschgrowth.com.br')
on conflict do nothing;
\`\`\`

6. Confira com \`select user_id from public.elo_admins;\` e faça um novo login no Elo.

7. Antes do merge/deploy, rode \`npm test\`, \`npm run test:render\`, \`npm run lint\` e \`npm run build\`; experimente com organizações de teste isoladas e usuários sem privilégios.

## Como usar

- Menu \`Configurações → Gestão de acessos\` (somente administradores).
- Busque empresa/integrantes, escolha o tipo de licença, informe o vencimento quando necessário e salve.
- \`Gratuito permanente\`: acesso sem prazo.
- \`Cortesia temporária\`: acesso até a data escolhida.
- \`Pago (controle manual)\`: acesso liberado pela administração; **não realiza cobrança**.
- \`Período de teste\`: acesso até a data escolhida.
- \`Bloqueado\`: bloqueia operações de CRM, mas não apaga dados.
- Contas ainda sem concessão manual seguem a regra de teste/assinatura legada, por compatibilidade.

## Limites desta implementação

- Não há criação automática de cobranças, renovação ou comprovação de pagamento no modo \`paid\`.
- A associação de **novas integrantes com login próprio à mesma organização** requer fluxo seguro de convites (Auth + associação ao perfil) e migração separados. Criar conta pela aba \`Criar conta\` do Elo não é equivalente a ingressar na mesma organização.
- Verifique os componentes de dados adicionais do CRM caso sejam criados futuramente: novas tabelas devem receber políticas RLS de acesso, não apenas controles visuais.
- Este branch não faz alterações no banco ou no site publicado: o SQL e o código precisam ser revisados e aplicados conscientemente.
