# Contatos — importação em lote e histórico de interações

Esta melhoria adiciona à tela Contatos:
- Botão **Importar contatos** ao lado de **Novo contato**.
- Modelo CSV UTF-8 (exportável do Excel e Google Planilhas), com Nome, Telefone, E-mail, Data de entrada, Primeiro contato, Último contato, Próximo contato, Status, Observação, Empresa, Origem e Valor.
- Pré-visualização antes de importar, rejeição de linhas inválidas e contatos duplicados por telefone/e-mail, sem sobrescrever registros existentes.
- Datas opcionais no cadastro individual.
- Histórico de conversas por contato. Cada registro traz data, canal/tipo (inclusive **Cobrança / financeiro**), observação, status anterior, novo status e data de próximo contato. Registros não substituem os anteriores.
- A data de entrada importada também é usada em filtros e métricas históricas; na falta dela, o sistema usa a data de cadastro.

## Limitações

- A primeira versão lê **CSV**, não `.xlsx` diretamente. No Excel/Sheets exporte como CSV UTF-8.
- **Cobrança / financeiro** é apenas uma categoria para conversas; não emite boleto, nota, cobrança, pagamento ou recorrência.
- Importações são feitas em lotes de até 50, com relatório de linhas ignoradas ou erros; não substituem contatos existentes.
- O histórico antigo contido no campo Notas permanece no cadastro; novas interações passam a ser registradas em sequência cronológica.
- Novos contatos criados manualmente precisam ser salvos antes de começar a registrar interações.

## Implantação

1. Fazer/confirmar backup e contagens das tabelas de Contatos, Organização, Histórico, Tarefas.
2. Aplicar `scripts/elo-contact-import-timeline.sql` (adição de duas datas e tabela de histórico com RLS e função transacional).
3. Executar `npm test && npm run test:render && npm run lint && npm run build`.
4. Verificar autorização de usuário autenticado da mesma organização, impedimento para quem não pertence à organização e bloqueio de conta expirada.
5. Somente depois fazer merge para main, aguardar Vercel e testar no navegador.

## Segurança

- `contact_interactions` tem RLS habilitada e **somente SELECT** concedido a usuários autenticados, com condição de organização e licença.
- Escritas são feitas somente via `elo_record_contact_interaction`, com autenticação, conferência de organização e autorização, mantendo contato e histórico em uma transação.
- A função de gravação não está acessível a anônimos, e alterações de status também ficam em `deal_stage_history`.
