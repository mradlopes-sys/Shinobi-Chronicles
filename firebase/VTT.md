# VTT — integração experimental

Branch: `feature/vtt-foundation`. Não foi mesclado em `main`.

## Disponível no protótipo
- `vtt.html`: canvas 2D com zoom, grid, pan, tokens locais e upload local de mapa.
- `assets/vtt-online.js`: autenticação Firebase compartilhada com o domínio do site, criação de sala pelo ADM, entrada por ID, convite por UID, listagem de fichas próprias, tokens sincronizados por Firestore (movimento por setas), rolagem de d20.
- `firebase/firestore.vtt.rules`: regras completas candidatas, baseadas nas regras atuais mais as coleções de VTT.

## Publicação segura
1. Revisar e testar `firebase/firestore.vtt.rules` no emulador de Firestore, com usuários mestre, convidado e não convidado.
2. Publicar as regras no Firebase Console (substituir o conjunto completo de regras, **não** colar trechos isolados).
3. Revisar o pull request e mesclar na branch principal somente após os testes.
4. Abrir `vtt.html` no mesmo domínio do site e fazer login no site principal.
5. Criar sala com ADM, convidar UID de jogador, entrar na sala em dois navegadores.

## Limitações e próximos passos
- Tokens do canvas local e tokens sincronizados aparecem em controles diferentes; a integração de drag-and-drop online ainda precisa ser feita.
- Tokens criados pelo ADM nesta versão usam uma das fichas do próprio ADM; seleção de fichas de outros jogadores ainda precisa ser adicionada com autorização.
- Sem sincronização de mapa, turnos, HP/chakra, dados confiáveis do servidor, fog of war, efeitos de jutsu ou áudio cinematográfico.
- A rolagem d20 é gerada no cliente: adequada apenas como demonstração, não antifraude.
- Não usar uploads grandes em documentos Firestore; para mapas compartilhados, configurar Storage e regras específicas.
- Revisar as permissões de ADM do sistema existente antes de produção; a identidade não deve depender de segredo exposto no frontend.
