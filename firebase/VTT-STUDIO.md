# Mesa Virtual — Studio / integração com Shinobi Chronicles

## Interface
- Acesse **Mesa Virtual (VTT)** no menu do site principal: a mesa é exibida dentro do Shinobi Chronicles, sem abrir uma página externa.
- Painel direito dividido em **Cenas**, **Atores**, **Combate** e **Teatro**, com ferramentas à esquerda.
- Grade desligada por padrão; mapas carregados em escala ajustada à janela, zoom e panorâmica.
- **Apenas ADM**: criar salas, cadastrar/ativar/excluir cenas, convidar jogadores, arrastar fichas de qualquer jogador para gerar tokens, avançar turnos e dirigir o teatro.
- Jogadores convidados: visualizar a cena ativa, mover tokens próprios, rolar dados, efeitos, abrir fichas próprias.
- **Duplo clique** no token abre a ficha original em uma janela sobre o VTT, preservando o mapa. Para ADM com conta mestre desbloqueada, abre também fichas de outros jogadores.
- Retratos das fichas são reduzidos a 128x128 antes de serem armazenados no token. Não armazenar mapas em base64 no Firestore.
- As cenas da biblioteca são privadas do mestre. Apenas a cena ativa é enviada pelo documento da sala.

## Configuração obrigatória do Firestore
O código desta versão exige que `vttRooms/{roomId}` aceite os campos `sceneName` e `activeSceneId`, e que a subcoleção `scenes` permita somente acesso ADM. O arquivo atualizado está em `firebase/firestore.vtt.rules`. Ele preserva `perfisPublicos` e `observacoesShinobi`. Fazer backup e testar as regras antes de publicar.

## Limitações conhecidas
- Mapas são cadastrados por **URL HTTPS**; upload de arquivos de mapas exigirá Firebase Storage com regras próprias.
- Os tokens de cenas não ativas são filtrados na interface, mas todos os tokens da sala ainda são legíveis pelos participantes autorizados. Não use tokens para armazenar segredos do mestre.
- Rolagens ainda são geradas no navegador, sem antifraude.
- Não há visão por personagem, paredes, iluminação dinâmica, fog of war ou medição de alcance.
- A ficha original abre em um iframe da própria aplicação. Testar autenticação, acesso ADM e edição com duas contas antes de uso real.
- Ainda não há suíte automatizada de testes Firebase Emulator nem teste de navegador em produção. A implementação deve ser validada em uma sessão piloto.
