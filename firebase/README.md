## Acesso rápido do mestre (atualizado)

A opção **Entrar como ADM** utiliza o login reservado `mestre_shinobi`. A primeira entrada cria a conta no Firebase Authentication com a senha que o mestre digitar; as próximas entradas exigem a mesma senha.

**Obrigatório:** publique o arquivo atualizado `firebase/firestore.rules` no Firebase Console. O modo mestre reconhece esse e-mail reservado nas regras. Faça a primeira entrada antes de compartilhar o site com amigos. Para entender a segurança e o procedimento, consulte [ADMIN.md](./ADMIN.md).

---

## Atualização do painel administrativo (novembro de 2026)

A navegação **Administração** aparece apenas para contas cujo UID possui um documento em `admins/{uid}` no Firestore. Ao entrar, o site pede **a senha da própria conta** e valida essa senha novamente no Firebase Authentication. Depois de usar o painel, clique em **Bloquear painel**. A senha nunca é inserida no código do GitHub nem gravada no Firestore.

**Importante:** a verificação de senha é a proteção adicional da interface administrativa. O direito de ler as fichas de outros jogadores continua sendo dado pelas regras do Firestore, que verificam o documento `admins/{uid}`. A versão atual não possui uma segunda senha mestra independente.

## Seleção de NC

A ficha aceita qualquer **NC de 4 a 20**. Os valores publicados no resumo SNS 4.1b para NCs 4, 8, 10, 12, 16 e 20 foram mantidos. Os níveis intermediários foram preenchidos pela progressão de +6 pontos de atributos e +4 pontos de perícias por NC. Os poderes de NC 17 a 19 foram interpolados em +3 por NC para coincidir com os 40 pontos do NC 20 na tabela de referência. Essa interpolação é uma adaptação da plataforma, não uma tabela literalmente presente no resumo original.

---

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
- `fichas/{idUnico}`: cada personagem tem seu documento próprio, com `ownerUid`, `nome`, `clanId`, `nc`, `atributos`, `pericias`, `poderes`, `aptidoes`, `jutsus`, `inventario`, `historia` e outros campos. Uma mesma conta pode ter várias fichas.
- `admins/{uid}`: documento criado manualmente no Firebase Console.

As regras permitem que usuários leiam, criem, editem e excluam **somente as próprias fichas**, enquanto um administrador pode **visualizar todas**. A consulta de cada jogador filtra `ownerUid` pelo UID autenticado. **Depois da atualização do código, é obrigatório republicar `firestore.rules` no Console do Firebase**; as regras anteriores bloqueiam o carregamento de várias fichas.

## 7. GitHub Pages
Em **Settings → Pages**, selecione **Deploy from a branch**, branch **main**, pasta **/(root)**, e salve.

O endereço esperado é:
https://mradlopes-sys.github.io/Shinobi-Chronicles/

> Importante: o repositório se chama `Shinobi-Chronicles`, com letras maiúsculas. O GitHub Pages diferencia maiúsculas/minúsculas no caminho.

## 8. Imagens dos clãs
As 60 imagens (12 banners e 48 páginas de fichas) já foram enviadas pelo proprietário à **raiz do repositório**. O `index.html` está configurado para carregar arquivos como `uchiha.jpg` e `uchiha-1.jpg` diretamente da raiz. **Não exclua nem reenvie as imagens** para outras pastas. Se alguma imagem for removida, o editor detalhado continua disponível como alternativa.

## Observações
- No modo sem configuração Firebase, o site oferece uma **prévia local**, sem persistência entre sessões ou isolamento real entre jogadores.
- Algumas aptidões, poderes e requisitos específicos dos clãs ainda precisam de revisão no livro original; os campos podem ser registrados manualmente.
- Não é necessário servidor Node.js: o site é estático no GitHub Pages e usa os serviços do Firebase.

## 9. Instalação automática das imagens (GitHub Actions)

O repositório tem o workflow `.github/workflows/importar-imagens.yml`: quando você enviar um ZIP compatível para a **raiz da branch main**, o GitHub extrairá e publicará automaticamente as imagens nas pastas certas.

Você pode usar **uma destas opções**:
- Um ZIP completo chamado exatamente `Shinobi_Chronicles_Assets.zip` (12 banners + 48 páginas).
- Dois ZIPs menores: `Shinobi_Banners_12.zip` (banners) e `Shinobi_Fichas_48.zip` (páginas).

Passos: baixe o(s) ZIP(s) da conversa, abra o repositório → **Add file → Upload files**, selecione os ZIPs **sem extrair**, confirme o commit em `main` e acompanhe **Actions → Instalar imagens do Shinobi Chronicles**. O workflow publica `assets/clas/*.jpg` e `assets/fichas/*.jpg`; o GitHub Pages passa a carregá-los depois da publicação.

Se uma Action não puder enviar o commit, revise em **Settings → Actions → General** as permissões de gravação dos workflows e execute a importação novamente.

## 10. Upgrade para várias fichas

A partir da versão com múltiplos personagens por conta, **republique obrigatoriamente** o conteúdo de `firebase/firestore.rules` no Console do Firebase → Firestore Database → Rules → Publish. Sem esse passo, a consulta privada por `ownerUid` será bloqueada pelas regras antigas.

As fichas antigas continuam na coleção `fichas` com seu ID original, e as novas usam um ID exclusivo por personagem.
