# Mesa Virtual — Rolagens e chat (v20)

## Ordem do painel
A Mesa Virtual abre na aba **Rolagens**, seguida de **Campanha**. No início do painel Rolagens ficam o **Chat** e o histórico; o rolador de dados aparece em seguida. O texto introdutório e o antigo módulo **Solicitar rolagem** foram removidos.

## Modos de rolagem
| Opção | Leitura do resultado no banco | Cálculo |
| --- | --- | --- |
| **Pública** | Todos os participantes autenticados | Navegador de quem rolou |
| **Para o mestre** | Somente conta(s) ADM | Navegador de quem rolou; não aparece na interface do jogador |
| **Privada** | Somente o próprio autor (ADM não tem acesso) | Navegador do autor |
| **Cega (mestre)** | Somente conta(s) ADM | Navegador do mestre, após ler um pedido sem resultado |

**Cega**: se não houver uma conta ADM com a Mesa Virtual aberta, o pedido permanece pendente e será resolvido quando o mestre acessar o VTT. É uma implementação cliente + Firestore, sem Cloud Functions; não é uma prova independente de honestidade das rolagens do navegador. As rolagens públicas, para o mestre e privadas usam `crypto.getRandomValues`.

Os resultados secretos **não são publicados** em `vttRooms/shinobi-chronicles/events`. O Firestore os separa:
- `privateRolls/{uid}/entries/{id}` — somente o UID do autor pode ler;
- `gmRolls/{id}` — somente ADM pode ler;
- `blindRequests/{id}` — pedidos pendentes, legíveis e resolvíveis apenas por ADM;
- `blindRolls/{id}` — somente ADM pode ler os resultados.

## Apagar o chat
- **Limpar chat** aparece apenas para o ADM, pede confirmação e exclui mensagens e rolagens públicas, rolagens para o mestre e cegas, além dos pedidos cegos pendentes.
- O histórico de efeitos cinematográficos é preservado.
- Mensagens públicas individuais podem ser apagadas pelo autor ou ADM.
- As rolagens exclusivamente privadas ficam sob controle do próprio autor e podem ser apagadas individualmente pelo `×`. O ADM não pode lê-las ou apagá-las pelo painel.

## Regras obrigatórias
**Os commits no GitHub não publicam regras do Firebase automaticamente.**

No Console Firebase: **Firestore Database → Regras**. Substitua **todo** o texto existente pelo arquivo completo `firebase/firestore.rules` do branch main, desde `rules_version = '2';` até as duas chaves finais, e clique em **Publicar**.

Espelho idêntico: `firebase/firestore.vtt.rules`. Não adicione fragmentos manualmente ao final de regras antigas.

Enquanto as novas regras não estiverem publicadas, a rolagem pública continua disponível pelas permissões atuais, mas os modos privados, as rolagens cegas e a exclusão individual de mensagens podem falhar com `permission-denied`.

## Checklist de teste com 2 contas
1. Abrir a VTT como mestre e como jogador. Em ambas, confirmar **Rolagens → Campanha** e **Chat acima dos Dados**.
2. Jogador publicar um dado: ambos veem o resultado.
3. Jogador escolher **Para o mestre**: só o ADM vê o registro.
4. Jogador escolher **Privada**: somente o próprio jogador vê (não aparece no mestre).
5. Jogador enviar **Cega**: sem resultado no jogador; o mestre recebe o resultado quando conectado.
6. Mestre usar **Limpar chat**: mensagens e rolagens compartilhadas somem para os dois clientes; resultados privados do jogador permanecem.
7. Jogador apagar sua mensagem com `×`; outro jogador não deve conseguir apagar a mensagem de terceiros.
8. Confirmar que o Teatro e os efeitos continuam operacionais.

## Escopo de validação
Sintaxe dos módulos JavaScript, referências HTML, dependências da VTT e paridade entre arquivos de regras verificadas em código. Ainda é necessária validação funcional no Firebase publicado e com duas contas.
