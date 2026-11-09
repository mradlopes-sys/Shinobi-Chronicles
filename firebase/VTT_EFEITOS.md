# Shinobi Chronicles — Guia de Efeitos Visuais do VTT

## Como usar

1. Entre no Shinobi Chronicles com a conta do mestre, abra **Mesa Virtual → Combate**.
2. Escolha um dos **15 efeitos** no menu **Efeito visual do mestre**.
3. Em **Alvo da animação**, selecione **Centro da tela** ou **Personagem selecionado no mapa**. Para a segunda opção, primeiro clique sobre o personagem.
4. Clique em **Executar efeito para todos**. A animação aparece imediatamente para o mestre e é enviada pelo Firestore aos participantes conectados à Mesa Permanente.
5. O evento é transitório (aproximadamente 1–2 segundos). **Não aplica dano, cura, custo de chakra ou condições automaticamente**.

## Biblioteca disponível

| Efeito | ID técnico | Animação |
|---|---|---|
| Chakra | `chakra` | Aura luminosa de concentração de chakra. |
| Katon (fogo) | `katon` | Clarão alaranjado, brasas e ondas de calor. |
| Suiton (água) | `suiton` | Anéis de água e ondas circulares. |
| Fūton (vento) | `fuuton` | Rajada espiralada de partículas de vento. |
| Doton (terra) | `doton` | Estilhaços e poeira de impacto. |
| Raiton (raio) | `raiton` | Descargas rápidas de eletricidade. |
| Mokuton (madeira) | `mokuton` | Crescimento de raízes e partículas vegetais. |
| Hyōton (gelo) | `hyoton` | Cristais de gelo e flocos. |
| Genjutsu | `genjutsu` | Anéis distorcidos e efeito ilusório. |
| Iryō Ninjutsu (cura) | `iryo` | Luzes verdes de recuperação. |
| Taijutsu (impacto) | `taijutsu` | Choque físico e anéis de força. |
| Shunshin | `shunshin` | Clarão instantâneo que simula movimentação rápida. |
| Bomba de fumaça | `smoke` | Nuvem cinza temporária. |
| Explosão | `explosion` | Pulso luminoso e partículas de explosão. |
| Kekkai (barreira) | `kekkai` | Círculos de proteção e cúpula luminosa. |

## Notas importantes

- **Somente o ADM pode ativar efeitos**. Os jogadores podem rolar d20, mas não executar animações de mestre.
- O mestre pode escolher se a animação surge no centro do VTT ou perto do token selecionado. As coordenadas relativas ao mapa são compartilhadas quando um token é o alvo.
- O painel permite alternar o turno atual; o VTT ainda não oferece iniciativa automatizada nem cálculo de dano ou recursos.
- O dado d20 é gerado no navegador, portanto **não há garantia antifraude**.
- As animações têm duração breve e não alteram os documentos das fichas.
- Em caso de falha no Firestore, a animação pode aparecer apenas localmente no navegador do mestre. Confira a mensagem do painel.
- Para usuários com preferência por movimento reduzido, a duração das animações é encurtada.
- **Atualize as regras do Firebase** usando `firebase/firestore.rules` desta versão para habilitar a publicação segura das imagens do Teatro e a exclusão ADM de fichas.
- Teste com duas contas reais antes de usar em uma sessão completa. 
