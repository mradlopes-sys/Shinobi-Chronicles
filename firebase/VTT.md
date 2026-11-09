# VTT — instruções de instalação e teste

## Estado
Implementação em branch `feature/vtt-foundation`, PR #1 em rascunho. **Não publicada, não testada em dois navegadores e não pronta para produção.**

### O que está implementado
- Canvas com grid, zoom, pan, arrastar tokens e importar mapa local (modo offline).
- Autenticação Firebase e leitura das fichas do usuário.
- Salas Firestore criadas pelo ADM, membros adicionados por UID, acesso privado.
- Tokens online exibidos no canvas e movimentados por arrastar ou setas.
- URL HTTPS de mapa compartilhado configurável pelo ADM, turno compartilhado, d20 demonstrativo, flash de chakra/Katon/Raiton.
- Regras de Firestore separadas em `firebase/firestore.vtt.rules`.

### Como adicionar ao Firebase
1. Abra o **Firebase Console** do projeto `shinobi-chronicles-b9635`.
2. Acesse **Firestore Database → Regras**.
3. Abra no GitHub o arquivo `firebase/firestore.vtt.rules` da branch `feature/vtt-foundation`, copie o **arquivo inteiro** e substitua as regras atuais no Console. **Não use somente o trecho VTT**: o arquivo já contém as regras existentes de usuários e fichas.
4. Antes de publicar, use o **Rules Playground** ou preferencialmente o **Firebase Emulator Suite** para conferir: ADM pode criar sala e token; convidado pode ler sala e mover seu token; não convidado não pode ler; jogador não pode editar tokens alheios nem a sala.
5. Publique as regras apenas após confirmar esses casos.
6. Revise o PR #1 e faça merge para `main` para publicar os arquivos no GitHub Pages. O VTT estará em `/Shinobi-Chronicles/vtt.html`. O site principal ainda não ganhou um botão de navegação dedicado.
7. Faça login primeiro em `index.html` e depois abra `vtt.html` no mesmo navegador e domínio. Com ADM, clique em Criar sala. Compartilhe o ID e autorize o UID de cada jogador.

### Importante
- **Não é preciso criar manualmente as coleções**: `vttRooms`, `members`, `tokens` e `events` surgem com o primeiro uso.
- Para mapas compartilhados, use uma URL HTTPS de imagem pública com CORS adequado; upload local não é compartilhado.
- Não é preciso habilitar Firebase Storage para esta versão.
- Regras no Console não são aplicadas automaticamente pelo GitHub.
- Dados de `fichas/{id}` são somente lidos no protótipo. HP e chakra não são sincronizados com a mesa ainda.
- Os efeitos são visuais básicos; ainda faltam fog of war, medição, modelos de jutsu, sons e automação completa de combate.
- Rolagem de d20 é feita no navegador, sem garantia antifraude.
- As regras precisam ser auditadas e testadas antes de disponibilizar o multiplayer para usuários reais.

## Modo Teatro (atualização)
- O painel do mestre permite colocar até cinco tokens no palco, destacar quem fala e publicar diálogos.
- A camada de retratos fica sobre o mapa e não modifica as posições táticas.
- **Atualização obrigatória das regras**: a coleção `vttRooms` passa a aceitar o campo `theatre`. Publique a versão revisada das regras preservando `perfisPublicos` e `observacoesShinobi` antes de criar novas salas.
- Retratos são exibidos quando o token possui uma URL HTTPS ou imagem data válida. Sem retrato, aparece um marcador visual.
