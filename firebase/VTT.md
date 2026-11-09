# Shinobi Chronicles — Mesa Virtual imersiva

A Mesa Virtual é uma campanha permanente, integrada à interface do site. Todos os shinobi autenticados entram automaticamente; não há salas, códigos ou convites por UID.

## Navegação e interface

O VTT ocupa a janela inteira e evita a duplicação de menus do site. O botão de retorno volta aos Arquivos Shinobi, preservando a experiência de navegação. A barra de ferramentas à esquerda e o painel à direita podem ser ocultados separadamente; há também botão de tela cheia, zoom, centralização e grade opcional.

- **Mapa:** cena atual e informações da campanha.
- **Biblioteca:** aba exclusiva do mestre, com cadastro, edição, ativação, ocultação e exclusão de mapas por URL HTTPS. Não exige medidas manuais em pixels; a imagem é adaptada automaticamente à área do mapa.
- **Atores:** mostra fichas permitidas. O mestre arrasta uma ficha para o mapa ou usa o botão de adicionar. O duplo clique em uma figura abre a ficha original em modal.
- **Combate:** turnos, rolagem demonstrativa de d20 e efeitos visuais do mestre.
- **Teatro:** palco **independente dos tokens do mapa**. O mestre escolhe livremente até seis fichas, posiciona os retratos arrastando pelo palco, define quem fala e transmite diálogos em tempo real.

## Imagens sem círculo

A exportação dos tokens mantém o retrato inteiro e sua proporção, preservando o canal alfa de PNG/WebP. Não há conversão para JPEG recortado nem moldura circular. O tamanho do sprite é ajustado automaticamente à escala da cena.

Arquivos PNG enviados nas fichas são normalmente comprimidos para WebP com transparência em navegadores modernos. Retratos anteriormente convertidos para JPEG quadrado podem ser atualizados pelo mestre com **Atualizar PNG** em Atores. Se o próprio arquivo já tiver um fundo opaco, o VTT não consegue remover esse fundo.

## Firebase

Esta atualização **não precisa de novas regras do Firebase** se já estão publicadas as regras da Mesa Permanente. O Firestore continua controlando o acesso autenticado, as permissões do mestre, cenas privadas, fichas dos jogadores e tokens. Os arquivos de regras completas do projeto permanecem na pasta firebase, incluindo os caminhos de perfis públicos e observações privadas.

## Teste com mestre e jogador

1. O mestre abre o VTT no site e ativa um mapa da Biblioteca.
2. O mestre arrasta uma ficha com PNG transparente para o mapa e confirma a imagem inteira e o duplo clique na ficha.
3. No Teatro, o mestre escolhe um personagem fora do mapa, posiciona e publica uma fala.
4. Um jogador conectado em outro navegador confirma que vê mapa e Teatro, mas não a Biblioteca.
5. Ambos testam esconder a barra esquerda, ocultar o painel direito e ampliar a mesa.

## Limitações

- Mapas por URL HTTPS, sem upload no Firebase Storage.
- Ainda não há fog of war, paredes, iluminação, medição avançada ou automação completa dos jutsus e HP/chakra.
- Rolagem d20 client-side não é antifraude.
- **Não houve validação real de multiplayer no Firebase nem teste em dois navegadores**. Os controles precisam ser verificados antes do uso público.
