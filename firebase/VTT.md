# Mesa Virtual Permanente — Shinobi Chronicles

## Como funciona

Existe **uma única campanha**, compartilhada automaticamente entre as contas autenticadas. Não há mais criação de salas, códigos de sala ou convite por UID. O VTT continua dentro do site, mantendo as fichas acessíveis.

- **Mestre:** basta abrir `Mesa Virtual` no site com a conta ADM. Na primeira entrada, a campanha `vttRooms/shinobi-chronicles` será inicializada no Firestore automaticamente (se ainda não existir). O mestre pode salvar, editar, ativar e ocultar cenas, arrastar fichas para gerar tokens, gerenciar combates e usar o Modo Teatro.
- **Jogadores:** entram em `Mesa Virtual` com suas contas, são conectados automaticamente à campanha e enxergam somente a cena ativa. Podem mover os próprios tokens e abrir suas fichas com duplo clique. Não podem adicionar mapas, gerenciar cenas ou criar/excluir tokens.
- **Jogadores conectados antes do mestre:** verão a tela de espera; quando o mestre acessar e preparar a campanha, a conexão é atualizada em tempo real.

O projeto conserva a estrutura `vttRooms` para compatibilidade técnica, **mas não expõe salas ao usuário**. A campanha permanente usa sempre o documento fixo `vttRooms/shinobi-chronicles`.

## Regras obrigatórias do Firebase

O GitHub Pages não publica regras do Firestore. Depois da atualização do código, o administrador deve atualizar as regras no Firebase Console:

1. Abra Firebase Console → Firestore Database → Regras.
2. Faça backup das regras atuais.
3. Substitua pelo conteúdo **completo** de `firebase/firestore.rules` da branch principal. O arquivo inclui os caminhos `users`, `fichas`, `admins`, `perfisPublicos`, `observacoesShinobi` e VTT.
4. Valide permissões com Rules Playground ou preferencialmente Firebase Emulator Suite.
5. Publique as regras; recarregue o site.

A alteração principal está na função `vttMember(roomId)`: a campanha permanente passa a permitir acesso de leitura a qualquer usuário **autenticado**, sem convite por UID, mantendo controle de escrita nas mãos do mestre. As salas antigas continuam protegidas por seus antigos membros.

## Testes essenciais

| Ação | Resultado |
| --- | --- |
| ADM abre a Mesa Virtual pela primeira vez | Inicializa automaticamente o documento permanente |
| Jogador logado abre VTT sem mestre online | Visualiza estado de espera, sem criar sala |
| ADM prepara e ativa uma cena | Atualização vista por todos os jogadores |
| Jogador tenta cadastrar mapa ou editar sala | Negado na interface e pelo Firestore |
| Jogador tenta ler a coleção privada de cenas | Negado |
| Jogador tenta ler token de cena inativa | Negado |
| Jogador move token de outro jogador | Negado |
| Jogador abre sua ficha pelo token | Permitido |
| Jogador não autenticado tenta acessar | Negado |

## Sobre mesas antigas

Nenhuma sala ou cena antiga é excluída. O documento permanente é novo e **não importa automaticamente** mapas e tokens salvos nas salas anteriores. Se houver conteúdo importante nelas, será necessário migrar os documentos separadamente.

## Recursos atuais e limitações

- Biblioteca visual de cenas com URLs HTTPS, grade configurável e ativação pelo mestre.
- Diretório de personagens vinculado a `fichas`, retratos e tokens; duplo clique abre a ficha dentro do VTT.
- Posição dos tokens, turnos, rolagem d20 demonstrativa, efeitos visuais básicos e Modo Teatro.
- Não é um clone completo do Foundry: ainda faltam paredes, iluminação dinâmica, neblina de guerra, automação de jutsus e integração plena de HP/chakra.
- A rolagem é client-side e não tem comprovação antifraude.
- **Teste real com múltiplos navegadores e Firebase ainda é necessário.**
