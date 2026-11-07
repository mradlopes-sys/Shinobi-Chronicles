# Shinobi Chronicles — configuração do Firebase

O site inteiro está em **index.html**, publicado pelo **GitHub Pages**.  
Esta pasta contém apenas as instruções e as regras do banco de dados.

## 1. Criar o projeto
No [Firebase Console](https://console.firebase.google.com), crie o projeto e adicione um aplicativo **Web**. Ative:
- **Authentication → Sign-in method → E-mail/senha**
- **Firestore Database** (modo produção)

Em **Authentication → Settings → Authorized domains**, inclua `mradlopes-sys.github.io` caso ainda não apareça.

## 2. Preencher a configuração pública no index.html
Procure `const FIREBASE_CONFIG` e substitua os valores de exemplo pelos dados do aplicativo Web: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` e `appId`.

**Não inclua conta de serviço, chave privada, senha de usuário ou credencial administrativa no HTML**. A configuração Web do Firebase é pública e a segurança depende das regras do Firestore.

## 3. Instalar as regras
No Firebase Console, abra **Firestore Database → Rules** e cole todo o conteúdo de `firestore.rules`. Clique em **Publish**.

## 4. Criar o administrador
- Entre no site, crie um usuário com seu nome e senha.
- No Firebase Console, abra **Authentication → Users** e copie o **UID** desse usuário.
- Em **Firestore Database → Data**, crie a coleção `admins`.
- Crie um documento cujo **ID seja exatamente o UID** copiado.
- Adicione um campo `role` (string) com valor `admin` (o conteúdo não concede acesso por si só; o que importa é a existência do documento).
- Saia e entre novamente no site para atualizar o painel.

O próprio site **não pode criar documentos na coleção admins**.

## 5. Como o login só com usuário e senha funciona
A interface transforma o nome de usuário numa conta de e-mail interna, por exemplo `ninja_01@players.shinobi-chronicles.invalid`. É uma adaptação para usar Firebase Auth E-mail/Senha sem solicitar e-mail real.

**Limitação importante:** sem um e-mail verdadeiro para recuperação, não há redefinição de senha por e-mail. A recuperação precisará ser realizada pelo administrador usando ferramentas seguras no Firebase Console/Admin SDK. Não reutilize senhas pessoais neste sistema.

## 6. Estrutura dos documentos
- `users/{uid}`: `username`, `criadoEm`.
- `fichas/{uid}`: `ownerUid`, `nome`, `clanId`, `nc`, `atributos`, `pericias`, `poderes`, `aptidoes`, `jutsus`, `inventario`, `historia` e outros dados da ficha.
- `admins/{uid}`: documento criado manualmente no Firebase Console.

As regras permitem que usuários leiam e editem **somente suas próprias fichas**, enquanto um administrador pode **visualizar todas**.

## 7. GitHub Pages
Em **Settings → Pages**, selecione **Deploy from a branch**, branch **main**, pasta **/(root)**, e salve.

O endereço esperado é:
https://mradlopes-sys.github.io/Shinobi-Chronicles/

> Importante: o repositório se chama `Shinobi-Chronicles`, com letras maiúsculas. O GitHub Pages diferencia maiúsculas/minúsculas no caminho.

## 8. Imagens dos clãs
Envie as 12 imagens e elas serão incorporadas em `assets/clas/`. O site já prevê caminhos como `assets/clas/uchiha.jpg` e `assets/clas/senju.jpg`. É necessário converter formatos diferentes para os nomes indicados no código.

## Observações
- No modo sem configuração Firebase, o site oferece uma **prévia local**, sem persistência entre sessões ou isolamento real entre jogadores.
- Algumas aptidões, poderes e requisitos específicos dos clãs ainda precisam de revisão no livro original; os campos podem ser registrados manualmente.
- Não é necessário servidor Node.js: o site é estático no GitHub Pages e usa os serviços do Firebase.
