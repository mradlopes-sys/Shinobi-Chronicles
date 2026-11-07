# Configuração da conta administrativa — Shinobi Chronicles

O site tem uma opção **Entrar como ADM** na tela de login. Ela usa o mesmo Firebase Authentication das contas de jogador, mas só libera o painel para usuários autorizados no Firestore.

## Login-base sugerido
- **Nome de usuário:** `mestre_shinobi`
- **Senha:** escolha uma senha forte e exclusiva no Firebase; o ChatGPT não cria nem armazena essa senha.

> O nome acima é uma sugestão, **não uma conta já cadastrada**. O login só funcionará depois que você criar a conta e autorizar o UID.

## Como criar a conta ADM no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/) e abra o projeto `shinobi-chronicles-b9635`.
2. Em **Authentication → Users**, clique em **Add user / Adicionar usuário**.
3. No campo e-mail, use exatamente `mestre_shinobi@players.shinobi-chronicles.invalid` (o e-mail interno que a interface usa).
4. Defina sua própria senha forte; **não envie a senha para o ChatGPT**.
5. Salve e copie o **UID** da conta criada.
6. Abra **Firestore Database → Data**, crie a coleção `admins` (se ainda não existir) e um documento cujo **ID seja exatamente o UID**.
7. Nesse documento, você pode adicionar o campo `role` do tipo string, com o valor `admin`. A autorização é dada pela existência do documento; os usuários comuns não conseguem criar documentos em `admins` via navegador.
8. Entre em **Firestore Database → Rules** e publique o conteúdo atualizado do arquivo [firestore.rules](./firestore.rules). É necessário publicar estas regras para permitir que o mestre **edite** os documentos de terceiros.
9. No site, escolha **Entrar como ADM**, escreva `mestre_shinobi` e a senha que você acabou de criar.

Se você já tem uma conta de jogador e quer usá-la como mestre, basta criar o documento `admins/{UID_DESSA_CONTA}`; não é preciso criar uma conta nova.

## O que o mestre pode fazer

- **Ver todas as fichas**, inclusive de outros jogadores.
- **Abrir e editar** identidade, atributos, perícias, nível de campanha, poderes, técnicas, inventário e demais campos da ficha.
- **Salvar no Firestore** mantendo o `ownerUid` original: a ficha continua pertencendo ao jogador.
- Voltar ao painel e **bloquear a área administrativa**.

O painel não permite apagar fichas de outros jogadores. A exclusão continua exclusiva do proprietário.

## Segurança
- Não há senha mestra fixa nem senha gravada no `index.html`, GitHub ou Firestore.
- A tela ADM valida a senha com o Firebase Auth e confirma a existência do documento `admins/{uid}`.
- Se a conta do mestre tiver acesso às fichas pelo Firestore, a segurança real depende das regras publicadas e de manter sua senha privada.
- A tela de reautenticação protege o acesso ao painel quando um administrador já está conectado.

## Temas de clã
O tema da conta acompanha o clã da **última ficha criada**, pelo campo `criadoEm`. Editar ou abrir fichas antigas não altera o tema, e a seleção é recalculada após login ou exclusão de personagem. As fichas Canva preservam as artes originais.

## Sons
O site pode receber áudios em MP3, WAV ou OGG, depois que os arquivos forem enviados. Sons iniciados automaticamente dependem de permissão ou interação do usuário no navegador; o recomendado é disponibilizar controles de volume e silenciar.
