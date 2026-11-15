# Trilha sonora do VTT — YouTube + Playlists

## Como usar
1. Entre no Shinobi Chronicles como mestre e abra VTT > **Músicas** (última aba).
2. No acervo de playlists, use **Geral** ou crie pastas como Combate, Exploração e Descanso.
3. Selecione a playlist e cole a URL de um vídeo do YouTube em **Adicionar link do YouTube**. Escreva um título opcional e clique em **Salvar música na playlist**.
4. Clique em **▶** ao lado da faixa ou **Tocar playlist**. O player do YouTube carrega dentro do painel.
5. Use os controles do mestre para pausa, próxima, anterior, parada e repetição da playlist.
6. Você pode renomear ou remover playlists, editar o título de faixas e mover músicas para outras playlists.

## Armazenamento e permissões
- **Nenhum upload de arquivo** é realizado. Este módulo não usa Firebase Storage.
- Links (normalizados por ID de vídeo) e playlists são guardados no documento já existente `vttRooms/shinobi-chronicles`, em `theatre.youtubePlaylists`.
- Estado compartilhado da reprodução é guardado em `theatre.youtubeState`.
- Todos os participantes autenticados da Mesa Permanente podem ler o estado; apenas mestre (mesma permissão já usada no VTT) pode alterar playlists e a reprodução.
- As atualizações usam campos aninhados e transações, sem substituir `theatre` ou a sala inteira. Não foi necessário alterar as regras atuais do Firestore.
- A biblioteca legada `musicTracks` e os arquivos antigos permanecem intocados para não perder dados. O novo player usa apenas playlists do YouTube.

## Links aceitos
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://music.youtube.com/watch?v=VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID` e `/live/VIDEO_ID`
- É necessário informar uma URL **de vídeo**. URL de playlist pública do YouTube sem ID de vídeo não importa automaticamente uma lista; as playlists são criadas dentro do Shinobi Chronicles.

## Reprodução e limitações conhecidas
- O VTT usa a **YouTube IFrame Player API**, incorporada como iframe visível, dentro do iframe do VTT. O iframe principal concede `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"`.
- A reprodução simultânea é coordenada pelos estados do Firestore. Como cada jogador acessa o YouTube diretamente, latência e diferentes condições de rede podem gerar pequenas diferenças de tempo.
- **Navegadores podem bloquear autoplay com som**, especialmente para jogadores que ainda não interagiram com o YouTube nessa sessão. O módulo não cria um botão artificial para habilitar som; cada jogador pode clicar em ▶ no player nativo do vídeo se o bloqueio ocorrer.
- O YouTube pode recusar a incorporação de determinados vídeos por restrições dos detentores dos direitos, idade, disponibilidade regional ou conta.
- A reprodução depende de conexão com o YouTube; links salvos não armazenam áudio.
- Os demais efeitos de áudio do VTT e sons de jutsus continuam independentes.

## Teste manual sugerido
- Mestre: criar uma playlist, salvar um link, tocar, pausar, avançar, renomear, mover faixa, recarregar página, confirmar persistência.
- Jogador autenticado: observar playlist e estado compartilhado; permitir áudio por clique no ▶ do vídeo se o navegador bloquear o início automático.
- Confirme que chat, mapa, fog of war, teatro, iniciativa e cenas continuam funcionando após a troca.

## Controles exclusivos do mestre
- Apenas o mestre pode reproduzir, pausar, parar, avançar, voltar, repetir, renomear, mover ou excluir faixas e playlists.
- Jogadores não recebem botões de controle do mestre; o iframe do YouTube também não recebe cliques nem foco do teclado, e o player é criado sem controles nativos.
- Como os navegadores podem bloquear autoplay, o jogador verá somente **Ouvir música da mesa** quando a música estiver ativa mas ainda não estiver tocando localmente. Esse botão apenas inicia a escuta e não pausa a música.
- O documento compartilhado `vttRooms/shinobi-chronicles` já exige `isAdmin()` para escrita nas regras do Firestore; jogador não consegue interromper a reprodução dos demais nem alterar playlists.
- Um usuário sempre pode silenciar o áudio do próprio navegador/sistema operacional: isso não é controlável pelo VTT.
