# Shinobi Chronicles — Mesa Virtual e Teatro (v5)

## O que mudou
- A Mesa Virtual ocupa a altura disponível da janela. O menu interno pode ser recolhido e existe um comando de tela cheia (⛶).
- O **Modo Teatro** é um palco fixo, diferente do mapa tático. Personagens não arrastam e não trocam de expressão por clique acidental.
- Cada retrato é apresentado **inteiro**, sem corte, máscara, fundo branco removido nem redimensionamento destrutivo. A apresentação ajusta a escala pela altura visual da arte, alinhando a base entre os personagens.
- Os nomes aparecem sobre os personagens; o mestre pode clicar no nome para abrir a direção do Teatro.
- O painel Teatro permite adicionar/remover personagens, escolher o visual explicitamente e atualizar imagens publicadas anteriormente.
- Galeria de **cinco retratos** por ficha: Casual, Traje ninja, Triste, Ferido e Gravemente ferido.
- O modo **Visual automático conforme HP** é ligado por padrão. Com Vitalidade <= 50% é exibido Ferido; com <= 25%, Gravemente ferido. Ao recuperar HP, volta ao visual base. O mestre pode desligar o automático e escolher manualmente.
- As fichas continuam privadas; só o par numérico atual/máximo da Vitalidade de personagens no Teatro é publicado em `vttRooms/shinobi-chronicles/theatreVitals/{fichaId}`.
- No mapa **tático**, o mestre continua posicionando tokens e usuários autorizados podem mover os seus próprios tokens.

## Publicar as regras obrigatórias
1. Abrir Firebase Console do projeto Shinobi Chronicles.
2. Acessar Firestore Database → Regras.
3. Copiar **o arquivo inteiro** `firebase/firestore.rules` deste repositório e substituir o conteúdo das regras.
4. Publicar no Console, aguardar a atualização e recarregar o site com Ctrl+F5.

Arquivo espelho: `firebase/firestore.vtt.rules`.
Esses arquivos são a **configuração pronta**, mas um commit no GitHub **não publica** as regras no Firebase automaticamente.

## Revisão inicial das artes antigas
No painel Teatro, para cada personagem adicionado antes desta versão, clique **Atualizar artes** uma vez. Assim todas as expressões disponíveis na ficha passam a estar sincronizadas para os jogadores. Os retratos ausentes continuam usando um retrato existente como alternativa; não são fabricados.

## Teste com duas contas
- Entrar como mestre, adicionar um personagem com Casual, Traje ninja e Ferido; confirmar a mesma altura visual sem recorte.
- Abrir uma sessão de jogador e conferir a mesma arte e o nome.
- Clicar no corpo da imagem: nada deve mudar; clicar no nome como mestre: o editor do personagem abre.
- Alterar a Vitalidade da ficha para <=50%, depois <=25%, e recuperar para acima de 50%.
- Confirmar que o palco muda a expressão sem que um jogador possa alterar a ficha de outro usuário.
- Testar a visão ampla da mesa com a barra principal recolhida e com o botão de tela cheia.

## Limitações
- O estado do HP é sincronizado pelo navegador do dono da ficha enquanto a Mesa Virtual está aberta ou pelo navegador do mestre conectado à mesa. Se todos estiverem fora da VTT durante uma edição da ficha, o resumo é publicado na próxima entrada.
- As regras precisam ser publicadas no Firebase para que os documentos de retratos e HP funcionem.
- Não foi executada uma sessão de navegador com duas contas nem teste do Firebase Emulator neste commit.
- A geração de rolagens ainda é feita no navegador.
