# Shinobi Chronicles — Mesa Virtual v21

## Refinamento visual
- Paleta verde musgo/oliva e dourado fosco padronizada entre o palco, a lista de personagens, o chat, as rolagens e as janelas de ficha.
- Contraste e estados de hover/foco melhorados. Microinterações são discretas e respeitam a preferência do sistema por movimento reduzido.
- Trocas de cena com transição curta. A animação não altera o recorte ou as imagens dos personagens do Teatro.
- Mover a barra direita não redefine mais o zoom nem o ponto central do mapa.
- Efeitos de combate mais leves e limitados a três ativos simultaneamente. Botões rápidos: Chakra, Katon, Suiton, Raiton, Impacto, Cura, Fumaça e Shunshin.

## Régua em metros
O mapa pode ser sem grade. A VTT calcula automaticamente uma célula virtual a partir do tamanho da imagem para servir de referência; **não adiciona linhas de grade nem encaixa os tokens**.

- **↔** na barra inferior (ou tecla **R**): ativar ou desativar a régua. Arrastar na imagem mostra o comprimento direto em **metros (m)**.
- Ao **mover um token**, a distância do ponto inicial até a nova posição também aparece em metros.
- Canto inferior direito: escala visual em metros, atualizada com o zoom.
- Cada mapa pode ter uma escala diferente em **metros por célula virtual**. Valor inicial sugerido: **2 m/célula**, que é aproximado até ser calibrado pelo mestre.
- **Calibrar (⚙)**, apenas para o mestre: ativar mapa → abrir ⚙ → arrastar entre dois pontos cuja distância real é conhecida → digitar a distância em metros → **Salvar escala para esta cena**.
- A calibração salva o valor no documento da cena e no documento da sala, para que todos os jogadores vejam o mesmo resultado. Calibrar em cima de um desenho cujo comprimento real é incerto não garante precisão.
- Fórmula: `metros = distância_em_pixels_de_imagem / tamanho_da_célula_virtual_em_pixels × metros_por_célula`. Distância euclidiana (linha reta).

## Efeitos de um clique
Na aba **Rolagens**, abra **Combate e efeitos**. O mestre pode disparar efeitos comuns por botões de acesso rápido. Caso tenha um token selecionado, o efeito aparece nele; caso contrário, aparece no centro do palco. Os efeitos são sincronizados com os jogadores como antes.

## Firebase
**Necessário publicar novamente as regras do Firestore** porque a sala agora armazena o campo validado `metersPerCell` (0,05 a 1.000). O commit no GitHub não publica regras automaticamente.

No console: Firebase Console → Firestore Database → Regras → substituir o conteúdo inteiro pelo arquivo `firebase/firestore.rules` e clicar **Publicar**. A versão espelhada é `firebase/firestore.vtt.rules`.

Até a publicação, a leitura do mapa e as outras interações continuam como antes, mas mudanças da escala que escrevem `metersPerCell` podem falhar com **permission-denied**.

## Validações
Os scripts e importações JavaScript passaram na verificação de sintaxe; IDs da página e regras espelhadas foram verificados. Funções puras foram testadas com distâncias, zoom e calibrações conhecidas, inclusive a rejeição de escalas inválidas. A interação real no navegador e um teste com dois logins após publicação das regras ainda não foram executados.
