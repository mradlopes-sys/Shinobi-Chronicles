# Shinobi Chronicles · Paredes, portas e visão dinâmica

## O que mudou
- Criar a primeira parede **não ativa a névoa nem a visão dinâmica**. O mestre deve habilitar a visão automática em **Ambiente → Paredes** e, caso queira encobrir o mapa, clicar explicitamente em **Encobrir mapa** em **Ambiente → Névoa**.
- A visão de cada jogador parte dos tokens que pertencem a ele e respeita o alcance em células definido pelo mestre.
- Paredes sólidas bloqueiam visão e movimento; portas fechadas também. Portas abertas liberam ambos.
- Janelas bloqueiam movimento e permitem enxergar de perto. Paredes invisíveis bloqueiam o movimento, sem ocultar a visão. Paredes ilusórias fazem o inverso.
- Portas secretas fechadas não aparecem como controles interativos para jogadores; portas trancadas exigem ação do mestre.
- A pintura manual de revelação não atravessa paredes enquanto a visão dinâmica estiver ativa. O mestre ainda pode reocultar áreas.
- Arrastar tokens e usar as setas respeita colisões. O mestre pode manter Shift pressionado para mover através das paredes.

## Como montar uma cena
1. Como mestre, entre no VTT, abra **Campanha** e selecione um mapa.
2. Abra **Ambiente → Paredes** pela barra lateral. O modo de seleção ativa ao entrar. Selecione **Parede sólida** e arraste segmentos sobre as divisórias.
3. **Não trace parede sólida por cima da abertura da porta.** Use um segmento do tipo **Porta** no vão entre as paredes.
4. Posicione tokens pertencentes aos jogadores. A visão é calculada a partir dos próprios tokens, sem expor o restante da cena.
5. Escolha o alcance da visão. Ao mudar a configuração, todos os jogadores recebem a atualização pela mesa compartilhada.
6. Para editar uma parede existente, clique nela e arraste o centro da linha para movê-la ou suas pontas para redimensionar. Use **Del** para removê-la e **Ctrl+Z** para desfazer. O mestre pode clicar diretamente no marcador da porta para abri-la/fechá-la.
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

## Interface simplificada do VTT
- O menu lateral principal agora separa **Chat**, **Elenco**, **Combate** e **Ambiente**. A aba de **Ambiente** concentra paredes e névoa, sem atrapalhar o chat nem o resto da campanha.
- A edição de paredes ocorre sobre o mapa, sem janelas flutuantes. Três tipos frequentes ficam visíveis primeiro (sólida, porta e janela). Paredes especiais ficam em **Mais tipos de parede**.
- No modo de edição de paredes, **Del** remove somente a parede selecionada e **Ctrl+Z** desfaz a última alteração de parede. Para encerrar a edição, use **Esc**, **✓ Sair da edição** ou o controle ✓ ao lado das ferramentas do mapa.
- O menu **Ambiente → Névoa** concentra encobrimento, retângulo e pincéis. A tecla **F** abre as ferramentas de névoa do mestre e alterna a seleção de áreas.
- Os estilos respeitam o tema claro/escuro e a cor do clã configurada no site. O espaço e a altura do chat não foram alterados.

## Correção: névoa somente com ativação manual
- Nenhuma operação de parede, porta, desenho, configuração de alcance ou visão automática ativa a névoa.
- O pincel e a ferramenta de retângulo não podem ligar a névoa implicitamente, inclusive após trocas de modo.
- A configuração da névoa pertence à cena e permanece desligada até o comando explícito do mestre. Cenas com névoa já ligada não são alteradas automaticamente, evitando modificar escolhas anteriores do mestre.
