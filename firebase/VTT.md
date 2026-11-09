# Shinobi Chronicles — Mesa Permanente / versão Teatro e Combate

O VTT é uma campanha permanente dentro do Shinobi Chronicles. Todos os jogadores autenticados entram automaticamente, sem criar salas ou informar códigos. O mapa ocupa a janela, com barra esquerda visível por padrão e recolhível pela seta ❮ / ❯.

## Teatro — baseado na referência enviada pelo mestre

- **Retratos recortados, grandes e alinhados pela base da tela**, com o mapa visível atrás; sem caixas de diálogo.
- Elenco independente dos tokens táticos. Pode colocar até seis personagens e arrastar cada figura horizontalmente pelo palco. Ao acrescentar personagens, a distribuição inicial é centralizada e proporcional.
- O mestre escolhe **Fichas dos jogadores** ou **NPCs do mestre**. Uma ficha é NPC quando seu `ownerUid` é igual ao `masterUid` da conta `mestre_shinobi`, salvo no documento permanente.
- Em cada ficha, o mestre escolhe a imagem disponível em **Casual**, **Ninja**, **Ferido** ou **Gravemente ferido**. Opções ainda não enviadas na ficha não são exibidas.
- O retrato original salvo no documento da ficha (data WebP/PNG ou URL HTTPS) é publicado em um documento de mídia separado, sem recompressão para token. Isso evita perda adicional de resolução e não enche o documento compartilhado da sala.
- Para que jogadores não precisem ler as fichas privadas uns dos outros, o ADM publica somente a **imagem escolhida** em `vttRooms/shinobi-chronicles/theatrePortraits/{fichaId}`; cada participante recebe apenas essa imagem por ID, quando o personagem está no palco.
- O novo Teatro não altera fichas nem tokens. Apenas a versão escolhida do retrato é compartilhada com a mesa.

## Exclusão de fichas de jogadores pelo ADM

Em **Central do Mestre → Fichas dos jogadores**, cada linha tem o botão **Excluir**. O mestre precisa confirmar digitando `EXCLUIR <nome exato do personagem>` e passar por uma segunda confirmação antes da operação. A exclusão é permanente e pode destruir anotações guardadas na própria ficha. O botão **Gerenciar e excluir fichas na Central do Mestre** em **VTT → Atores** retorna ao painel ADM do site.

As regras do Firestore autorizam `delete` na coleção `fichas` para proprietário ou ADM. Jogadores comuns não ganham poderes adicionais.

## Efeitos visuais e combate

A aba **Combate** oferece 15 animações sincronizadas para o mestre, com alvo central ou token selecionado. Veja o documento [VTT_EFEITOS.md](VTT_EFEITOS.md) para a lista, descrições e instruções.

A rolagem de d20 continua demonstrativa. A animação é apenas visual e não altera HP, chakra, status, iniciativa ou técnicas automaticamente.

## Atualização obrigatória das regras Firebase

A versão **requer** publicar o conteúdo integral de `firebase/firestore.rules` no Console Firebase. As mudanças adicionam:
- `masterUid` ao documento da Mesa Permanente;
- `theatrePortraits/{fichaId}` com leitura por participantes autenticados, sem listagem pública, e escrita exclusiva do ADM;
- exclusão de fichas por conta ADM.

O arquivo preserva `users`, `admins`, `fichas`, `perfisPublicos` e `observacoesShinobi`. Faça backup das regras atuais, valide no Rules Playground ou Emulator Suite e só então publique.

## Testes essenciais

1. ADM acessa o VTT, confirma que a barra esquerda aparece e pode recolhê-la com a seta.
2. ADM abre Teatro, adiciona um NPC e um personagem de jogador que não estão no mapa. Confere alinhamento pela parte inferior da tela.
3. ADM alterna as quatro imagens de uma ficha que possua as quatro variantes.
4. Jogador vê os retratos exibidos pelo mestre, mas não consegue ler a coleção `fichas` de outras contas nem publicar retratos.
5. ADM executa cada efeito e alterna entre centro da mesa e token selecionado, confirmando que jogadores veem os efeitos.
6. ADM abre a Central do Mestre e exclui uma ficha de teste usando confirmação digitada; o jogador não consegue excluir fichas alheias.
7. Teste em dois navegadores reais. Ainda não foi executado um teste end-to-end no Firebase por esta ferramenta.

## Limitações

- Retratos só têm a resolução que foi armazenada na ficha original; recuperar detalhes que já foram comprimidos não é possível.
- Imagens de mapas usam URLs HTTPS, sem upload por Firebase Storage.
- Ainda não existem paredes, neblina de guerra, iluminação dinâmica, automação de dano/chakra, medição avançada ou antifraude nas rolagens.
