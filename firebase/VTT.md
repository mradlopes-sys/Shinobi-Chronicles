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


## Atualização: Rolagens, régua e VTT integrado — novembro de 2026

- **Rolagens:** o antigo painel Combate vira Rolagens com chat, dados livres (1d6, 1d8, 2d8, 3d8, 1d10, 1d12, 1d20, 1d100), modificador e animação. Rolagens de perícias e combate feitas na ficha são publicadas no histórico da Mesa Permanente. Perícias e ataques seguem 2d8; iniciativa segue 1d8 + atributos/perícias conforme a ficha.
- **Solicitações do mestre:** o ADM seleciona uma ficha e perícia; o jogador recebe no histórico um botão para lançar a rolagem com o modificador calculado da própria ficha.
- **Mapa sem grid:** removida a grade de todos os mapas e o encaixe em células ao arrastar tokens. A régua (⌁) mede distâncias em unidades relativas: 1 u = 1% da largura do mapa. Ela não presume metros nem deslocamentos oficiais.
- **Efeitos de jutsus:** nas fichas, o botão Usar no VTT dispara um efeito cinematográfico baseado no nome/descrição da técnica. Esse reconhecimento é uma correspondência aproximada de elementos e palavras-chave (Katon, Suiton, Raiton etc.); caso não reconheça, exibe chakra. Não causa dano nem desconta chakra automaticamente.
- **Teatro:** retratos com transparência recebem enquadramento pelo conteúdo visível da imagem, alinhando a base; um clique na figura alterna entre as quatro variantes disponíveis. Prévia local e transição suavizam a troca. Imagens sem transparência ou bloqueadas por CORS podem conservar bordas incorporadas.
- **Site integrado:** a Mesa Virtual continua dentro do Shinobi, ao lado da barra de navegação principal; a seta do lobby recolhe/expande esse menu sem recarregar o iframe. O banner da página inicial mantém o título Sua próxima sessão começa aqui e a ilustração enviada do Shikamaru com Naruto jogando shogi.
- **Segurança:** a versão precisa da publicação manual de `firebase/firestore.rules`, que mantém as coleções originais, acrescenta eventos de rolagem, chat e pedidos de perícia e autoriza somente eventos de jutsu associados a fichas pertencentes ao jogador. Isso **não** equivale a validação antifraude da rolagem ou da técnica usada.

**Testes:** verifique as regras com duas contas (mestre e jogador), o chat do VTT, a rolagem da ficha, o pedido de perícia, a troca de retrato, o disparo de um Katon e a régua sem grade. O código não foi testado em duas sessões reais do Firebase por esta ferramenta.
