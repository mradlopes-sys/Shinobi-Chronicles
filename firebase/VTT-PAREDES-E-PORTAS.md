# Shinobi Chronicles · Paredes, portas e visão dinâmica

## O que mudou
- A primeira parede criada ativa a visão dinâmica **e** a névoa de guerra na cena.
- A visão de cada jogador parte dos tokens que pertencem a ele e respeita o alcance em células definido pelo mestre.
- Paredes sólidas bloqueiam visão e movimento; portas fechadas também. Portas abertas liberam ambos.
- Janelas bloqueiam movimento e permitem enxergar de perto. Paredes invisíveis bloqueiam o movimento, sem ocultar a visão. Paredes ilusórias fazem o inverso.
- Portas secretas fechadas não aparecem como controles interativos para jogadores; portas trancadas exigem ação do mestre.
- A pintura manual de revelação não atravessa paredes enquanto a visão dinâmica estiver ativa. O mestre ainda pode reocultar áreas.
- Arrastar tokens e usar as setas respeita colisões. O mestre pode manter Shift pressionado para mover através das paredes.

## Como montar uma cena
1. Como mestre, entre no VTT, abra **Campanha** e selecione um mapa.
2. Em **Névoa de guerra → Arquitetura da cena**, selecione **Parede sólida** e arraste segmentos sobre as divisórias.
3. **Não trace parede sólida por cima da abertura da porta.** Use um segmento do tipo **Porta** no vão entre as paredes.
4. Posicione tokens pertencentes aos jogadores. A visão é calculada a partir dos próprios tokens, sem expor o restante da cena.
5. Escolha o alcance da visão. Ao mudar a configuração, todos os jogadores recebem a atualização pela mesa compartilhada.
6. Selecione uma parede para mudar tipo, direção ou estado, ou para remover. O mestre pode clicar diretamente no marcador da porta para abri-la/fechá-la.
7. O jogador que tiver um token próprio a até **1,75 célula** da porta, sem outra parede no caminho, verá o marcador e poderá clicar nele. A mudança é efetuada pelo mestre conectado e sincronizada com todos.

## Regras do Firebase — publicação necessária
Os arquivos `firebase/firestore.rules` e `firebase/firestore.vtt.rules` no GitHub foram atualizados para permitir eventos `door` com campos validados. **Isso não publica automaticamente regras no projeto Firebase.** Para que os jogadores abram portas, publique o conteúdo atualizado de `firebase/firestore.rules` no Firestore Rules do projeto. Mantenha o mestre conectado ao VTT enquanto os jogadores interagem; é o navegador do mestre que valida os pedidos e registra o estado da porta no banco de dados.

O jogador **não** recebe autorização para editar `theatre.wallsMap` nem para destrancar portas. Se as regras não estiverem publicadas, a tentativa de abrir a porta retornará erro de permissão.

## Testes de aceitação
- Com visão dinâmica ativa, posicione um jogador de cada lado de uma parede: nenhum deve enxergar o outro pelo mapa.
- Revele manualmente uma sala atrás de uma parede: a visão dinâmica deve continuar bloqueando a sala.
- Feche uma porta e tente atravessar com mouse e setas: o token deve parar. Abra a porta e tente novamente.
- Jogador próximo de uma porta destrancada: aparece marcador, o clique envia um pedido e o mestre conectado executa a mudança.
- Jogador distante, atrás de outra parede, ou diante de porta secreta fechada: não pode acioná-la.
- Jogador tenta alterar o estado da sala ou destrancar via requisição: as regras não autorizam a edição do documento da sala.

## Limitação de segurança
A névoa, as paredes e o bloqueio de movimento são principalmente controles de interface. O navegador ainda recebe a imagem/URL do mapa e dados da cena compartilhada; portanto, isso **não é uma barreira antifraude** contra inspeção de rede ou manipulação deliberada do cliente. Para sigilo real, servir mapas recortados por jogador e validar movimento com lógica confiável no servidor exige uma arquitetura adicional.


## Edição rápida no próprio mapa (novembro de 2026)
- O mestre encontra o botão **▤ Paredes** no canto inferior direito do mapa ativo, mesmo com o painel lateral fechado.
- Ao clicar, entra no modo **Selecionar**. Linhas existentes ficam visíveis só para o mestre. Clique no traço e arraste uma ponta para ajustá-la, ou arraste o meio para mover o segmento inteiro.
- Use o menu **Tipo da nova parede → Desenhar** para traçar qualquer um dos tipos: sólida, janela, porta, secreta, invisível, ilusória ou terreno.
- Com uma parede selecionada, pressione **Delete/Del** ou clique em **Apagar parede** no menu flutuante. Dentro do modo de paredes, esse atalho **nunca** remove um token.
- O menu flutuante permite alterar o tipo e o estado de uma porta sem voltar para a aba Campanha. **Esc** encerra a ferramenta e **Concluir** retorna ao modo normal.

## Inspeção de visão do jogador
- Fora do modo de edição, o mestre clica sobre um token pertencente a outro usuário (sem arrastá-lo). O mapa entra na **Visão do jogador**.
- A prévia respeita a névoa, as paredes, os tokens ocultos e o alcance. Se o jogador controla vários tokens, a área exibida combina a visão dos tokens dele, como acontece na interface dos participantes.
- Um segundo clique no mesmo token, um clique na área vazia, **Esc** ou o botão **✕ Sair** devolve a visão completa do mestre.
- A opção **◉ Visão** também aparece na lista de tokens para os personagens vinculados a jogadores.
- Quando a névoa está desativada, a prévia mostra o mapa inteiro, como a tela real do jogador; o indicador de inspeção avisa que não há restrição ativa.
- A inspeção é **local ao mestre**: não altera o documento da sala nem impõe visão a outros usuários.
