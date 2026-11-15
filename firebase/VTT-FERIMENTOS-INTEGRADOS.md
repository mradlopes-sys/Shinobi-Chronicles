# Ferimentos integrados — VTT / Shinobi Chronicles

## Mesma Vitalidade da ficha, sem duplicar regras
A condição visual do personagem segue os limites já usados na ficha:
- HP acima de 50%: retrato normal.
- HP entre 26% e 50% (inclusive 50%): retrato **ferido**.
- HP de 25% ou menos: retrato **gravemente ferido**.
- Ao curar, a aparência retorna automaticamente à faixa correspondente.

## Mapa
Cada token preserva sua arte original (`portrait`), posição, escala e permissões. O mestre publica junto ao token versões compactas de `retratos.ferido` e `retratos.grave` em `injuryPortraits`, mantendo a transparência. A renderização escolhe a variante conforme o HP e mostra um selo discreto **FERIDO** ou **GRAVE** acima do token, sem sobrepor os ícones das condições.

Tokens antigos são atualizados gradualmente pelo mestre ao entrar na cena; os retratos ausentes simplesmente retornam à arte original. Não são criados arquivos no Storage nem efeitos sonoros.

## Teatro
O Teatro mantém a troca de expressões que já existia (50%/25%), alimentada por `theatreVitals`. Inclui um pequeno indicador de ferimento e percentual de HP, preservando a animação suave já existente. A publicação dos retratos passou a comprimir imagens excessivamente grandes até o limite já aceito pelas regras do Firestore, em vez de simplesmente descartá-las. O mestre tenta complementar versões feridas ausentes de atores já no Teatro.

## Sincronização e privacidade
Os documentos `vttRooms/shinobi-chronicles/theatreVitals/{fichaId}` guardam somente `current` e `max` (mais proprietário e data), sem expor a ficha privada. Agora são usados pelos tokens da cena **e** pelo elenco do Teatro, usando permissões existentes: mestre/dono escreve, participantes autenticados da mesa leem.

O mestre pode ajustar HP pela ficha ou pelo controle rápido do Combate. A mesma atualização da ficha alimenta o mapa, o Teatro e os retratos do painel. Os jogadores só veem o resumo de Vitalidade dos personagens pertinentes à mesa.

## Selecionar fichas no Combate
A seleção, a lista de iniciativa e o carrossel usam miniaturas preparadas a partir das imagens da ficha. Arquivos grandes são reduzidos localmente para prévias leves, evitando que apareça apenas o símbolo genérico. Os retratos acompanham ferido/grave e têm um contorno discreto quando há ferimento.

## Verificação manual em sessão
1. Colocar um personagem com imagens normal, ferido e grave no mapa e Teatro.
2. Testar HP 100%, 50%, 25%, 0% e cura de volta a 100%.
3. Conferir arte e indicação no mapa, Teatro e seleção de Combate em conta de mestre.
4. Confirmar as mesmas mudanças em outra conta de jogador, sem poder editar HP de terceiros.
5. Verificar que cenas, iniciativa, condições, névoa, música e tokens antigos permanecem funcionando.

O código passou por testes de sintaxe e da lógica dos limiares; ainda precisa de validação visual e de sincronização em uma sessão real autenticada.
