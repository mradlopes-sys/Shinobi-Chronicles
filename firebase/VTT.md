# Shinobi Chronicles — Mesa Virtual (VTT)

## Estado real
A Mesa Virtual é um módulo experimental, inspirado nos fluxos de **Scenes**, **Actors**, **Tokens** e no módulo **Theatre Inserts** do Foundry VTT. Ela funciona dentro da interface do Shinobi Chronicles, sem substituir as fichas originais. **Não é uma instalação do Foundry nem reproduz todas as funções dele.**

O código é publicado pelo GitHub Pages quando integrado à branch `main`. As regras de Firestore **não são publicadas pelo GitHub**.

## Funcionalidades
- Mestre: criar sala, convidar jogadores por UID, preparar/editar/ativar/ocultar/excluir cenas em uma biblioteca privada, com imagem HTTPS e tamanho de grade configurável.
- Jogadores: ver apenas a cena ativa, sem acesso às ferramentas de cadastro de mapas; no Firestore, a biblioteca de cenas é exclusiva do ADM.
- Mesa: mapa central, pan, zoom, grade opcional (desligada por padrão), diretório de fichas, miniaturas de tokens, arrastar a ficha ao mapa ou adicionar pelo botão, controle de posição por proprietário, retirar tokens sem apagar fichas.
- Fichas: duplo clique em um token autorizado (ou clique em Ficha no painel) abre o registro completo dentro de uma janela sobre a mesa.
- Fichas do diretório sincronizam pelo Firestore; as imagens `retratos.ninja`, `retratos.casual` e `foto` são reconhecidas. Uma miniatura é criada para o token sem armazenar a imagem original inteira novamente.
- Teatro: retratos com até cinco personagens em primeiro plano, destaque do falante e diálogo compartilhado, controlados pelo mestre.
- Atalhos: tecla `C` abre a ficha do token selecionado; Delete remove o token selecionado somente para ADM; tela cheia e zoom.
- Sala lembrada na mesma sessão do navegador, mesmo após acessar outras abas do site.

## Instalação das regras (etapa manual necessária)
1. Acesse [Firebase Console](https://console.firebase.google.com/), projeto `shinobi-chronicles-b9635`.
2. Vá a **Firestore Database → Regras**.
3. **Faça backup** das regras já publicadas.
4. Copie **todo** o arquivo `firebase/firestore.rules` desta atualização e substitua o conjunto das regras do Console. Ele inclui **fichas**, **usuários**, **admins**, **perfisPublicos**, **observacoesShinobi** e o **VTT**.
5. Antes de publicar, teste no Rules Playground ou no Emulator Suite os cenários abaixo.
6. Publique as regras e abra o site com `Ctrl+F5`.

Nunca copie só a coleção `vttRooms` em vez das regras completas, ou o Mural de Konoha pode perder acesso.

## Testes de acesso obrigatórios
| Teste | Esperado |
|---|---|
| ADM cria sala | Permitido |
| ADM cadastra/edita/ativa mapa | Permitido |
| Jogador convidado lê o documento da sala | Permitido |
| Jogador convidado lê `vttRooms/{sala}/scenes` | Negado |
| Jogador não convidado lê sala/tokens | Negado |
| Jogador tenta criar cena, token ou alterar sala | Negado |
| Jogador tenta ler token de cena inativa | Negado |
| Jogador consulta tokens da cena ativa com `where('sceneId','==',activeSceneId)` | Permitido |
| Jogador move seu token (x,y) na cena ativa | Permitido |
| Jogador tenta mover token alheio ou trocar `ownerUid` | Negado |
| Jogador cria efeito cinematográfico | Negado |
| Jogador edita sua ficha original | Permitido |
| ADM acessa ficha autorizada e mantém Mural/observações | Permitido conforme as regras existentes |

**Importante:** testes de sintaxe JavaScript e interface simulada não substituem o emulador e um teste real com mestre e jogador. Não houve validação com as contas Firebase reais.

## Fluxo recomendado para testar
1. Mestre entra no site, abre **Mesa Virtual**, cria a sala e copia o código.
2. Jogador entra com a própria conta, abre a Mesa Virtual, copia seu UID e envia ao mestre.
3. Mestre autoriza esse UID e compartilha o código da sala.
4. Mestre registra uma cena com URL HTTPS pública, escolhe grade (32 a 256 px) e a ativa.
5. Mestre abre **Atores** e arrasta a ficha ao mapa; alternativamente, usa **+ Colocar token**.
6. O jogador movimenta o token do personagem; o mestre testa o duplo clique e abre a ficha.
7. Mestre ativa outra cena, verifica que os tokens não aparecem na cena errada e testa o Teatro.

## Limitações
- As imagens de mapas são referenciadas por **URL HTTPS**. Esta versão não faz upload para Firebase Storage nem disponibiliza um gerenciador de arquivos.
- Dados completos de HP/chakra permanecem na ficha original; o token não mostra ainda barras de recursos sincronizadas.
- Sem fog of war, paredes, iluminação dinâmica, templates/medição avançada, iniciativa automatizada ou macro de jutsus.
- A rolagem d20 é feita no navegador (não é antifraude).
- Os documentos de tokens antigos, sem `sceneId`, podem precisar ser recriados para aparecer na consulta segura por cena.
- As regras do Firestore devem ser verificadas no console; publicar código no GitHub não atualiza regras.
