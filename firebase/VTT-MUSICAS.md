# Músicas no VTT — Shinobi Chronicles

## Como funciona
- Abas **Músicas** na barra esquerda e no painel direito; a biblioteca aparece para todos.
- Mestre adiciona arquivos do computador (MP3, OGG, WAV, M4A, AAC, FLAC, WebM, até 35 MB) ou URLs HTTPS **diretas** para arquivos de áudio.
- Os arquivos ficam no Firebase Storage, em `vttMusic/shinobi-chronicles/{trackId}/...`.
- Biblioteca e estado de reprodução ficam no Firestore sob `vttRooms/shinobi-chronicles/musicTracks` e `musicState/current`.
- Mestre controla play/pause, parar, anterior/próxima, repetir, posição, volume da sessão e exclusão. Jogadores têm controle do volume individual.
- O navegador de cada jogador exige clicar uma vez em **Ativar áudio neste dispositivo** para permitir reprodução. Se o navegador bloquear novamente, clique outra vez.
- Um link de YouTube/Spotify **não** é um link direto de áudio; esses serviços não são suportados.

## Preparação do Firebase (obrigatória para upload e sincronização)
1. Confira se o **Firebase Storage** está habilitado no projeto `shinobi-chronicles-b9635`. O bucket configurado no site é `shinobi-chronicles-b9635.firebasestorage.app`.
2. No Console Firebase > Firestore Database > Regras, publique o conteúdo atualizado de `firebase/firestore.rules`.
3. Em Firebase Console > Storage > Regras, **mescle** as permissões de `firebase/storage.rules` com as regras existentes e publique. Não apague outras regras do Storage que já estejam em uso.
4. Faça login como mestre, abra VTT > Músicas e selecione um áudio já baixado no computador. O arquivo é enviado pelo navegador, não precisa ser adicionado ao GitHub.
5. Em outra conta, acesse VTT > Músicas, clique em **Ativar áudio neste dispositivo** e teste tocar/pausar pelo mestre.

## Observações
- GitHub Pages publica o código, mas não consegue guardar arquivos enviados pelos usuários; por isso o upload usa Firebase Storage.
- O Firestore e o Storage precisam permitir o mesmo usuário ADM. Os documentos em `admins/{uid}` são lidos nas regras; não exponha permissões de escrita aos jogadores.
- URLs diretas devem permitir reprodução em navegadores; servidores externos podem bloquear por política CORS ou não disponibilizar o arquivo.
- O player de músicas é independente dos sons de técnicas/jutsus existentes. Os controles de volume são separados.
- O reprodutor usa relógios locais e marcação de início do Firestore para aproximar a posição entre participantes. Pequenos desvios de alguns segundos podem ocorrer.
- A nova aba não modifica o código de névoa, paredes, iniciativa, cenas, teatro ou chat.
