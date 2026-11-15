# VTT: Combate simplificado e condições no token

## Alterações (15 de novembro de 2026)

A interface da aba Combate fica dedicada ao **painel de iniciativa** e ao **controle rápido de HP/Chakra** das fichas já existentes. Os componentes antigos abaixo foram retirados da tela:

- "Combate assistido" (rolagem de confronto, custo de Chakra e efeito no mapa)
- "Condições & duração" como formulário lateral
- "Jutsus no mapa" / ataque visual sobre tokens
- "Efeitos do mestre", efeitos rápidos, animações, testes e áudio de jutsu
- "Diretor de cenas" com chuva/raio/fumaça/pulso de chakra e sons artificiais

## Como aplicar condições

1. O mestre posiciona o personagem em um **mapa ativo**.
2. Clica com botão direito sobre o **token**.
3. Na seção **Aplicar condição**, escolhe o estado e a duração em rodadas.
4. Clica em **+ Aplicar**. O estado fica salvo em `theatre.conditions`, no documento da Mesa Permanente.
5. A condição aparece como **ícone acima do token** e na iniciativa. Pode ser removida pelo **×** no mesmo menu.
6. A duração segue expirando quando o mestre conclui novas rodadas na iniciativa.

As condições existentes foram preservadas. Jogadores não podem alterá-las; a escrita é restrita a administrador pelas regras existentes do Firestore.

## Preservado

- Biblioteca de mapas, pastas, cenas ativas, cenário no canvas
- Névoa de guerra, paredes, portas, visão dinâmica e ferramentas de ambiente
- Chat, rolagens e iniciativa
- Fichas, retratos, teatro, tokens, tamanho de token
- Controle rápido de HP/Chakra e áudio das **playlists do YouTube**

## Implementação

O VTT não importa nem instancia mais os módulos de efeitos de jutsus ou do diretor cinematográfico. Eventos antigos do tipo `effect` são ignorados em vez de reproduzidos; eventos de `door` continuam atendidos.

Os dados históricos de cenas, conditions e eventos não foram excluídos do Firebase. Nenhuma regra de segurança foi substituída.

## Validação manual recomendada

- Confirmar que o mestre consegue abrir o menu clicando com botão direito sobre um token no mapa.
- Aplicar "Atordoado" por duas rodadas, conferir o ícone acima do token e o badge da iniciativa.
- Avançar duas rodadas e confirmar a expiração; aplicar novamente e remover pelo ×.
- Confirmar que o jogador visualiza o ícone mas não altera condições.
- Testar navegação por mapas, névoa, paredes, iniciativa, chat e playlist de músicas.
