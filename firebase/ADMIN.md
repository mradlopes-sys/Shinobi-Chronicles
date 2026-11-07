# Modo ADM — Shinobi Chronicles

## Entrada rápida, sem configurar um documento admins

O site agora possui **Entrar como ADM** na página de login.

**Login-base:** `mestre_shinobi`

**Senha mestra:** na primeira entrada, digite a senha forte que você escolheu para a conta de mestre. Se a conta ainda não existir, o site cria automaticamente o usuário `mestre_shinobi@players.shinobi-chronicles.invalid` no Firebase Authentication e usa a senha informada. Nas próximas entradas, é obrigatório usar a mesma senha.

A senha **não aparece no index.html, no GitHub nem no Firestore**.

### Uma etapa ainda obrigatória no Firebase

Para permitir que a conta de mestre leia e edite as fichas dos outros jogadores, abra **Firebase Console → Firestore Database → Rules**, substitua o texto pelo conteúdo atualizado de [firestore.rules](./firestore.rules) e clique **Publish**.

Essa publicação não pode ser feita apenas com o GitHub Pages, que hospeda arquivos estáticos. As regras de permissão vivem no Firebase.

## Atenção à segurança do modo rápido

O modo rápido é apropriado apenas para um projeto privado e de confiança. A conta reservada `mestre_shinobi` ganha privilégios pelas regras do Firestore. **É essencial fazer o primeiro cadastro de mestre antes de divulgar o link do site**, pois o primeiro usuário que registrar esse identificador controlará a conta.

Para implantação pública, prefira administradores autorizados manualmente com documentos `admins/{uid}`, integração administrativa no servidor e autenticação multifator. Os documentos `admins/{uid}` existentes continuam funcionando.

## Permissões do mestre

- Ver todas as fichas de personagens.
- Editar fichas de outros jogadores: identidade, NC, atributos, perícias, poderes, jutsus e inventário.
- Salvar alterações no Firebase preservando `ownerUid`.
- Entrar/sair da área administrativa usando os botões do site.

O mestre não pode excluir personagens de outros jogadores pela interface. As regras permanecem restritivas para a exclusão.

## Tema de cada jogador

Todas as abas usam o mesmo fundo de papel japonês com aquarela. A tonalidade principal acompanha o clã da última ficha **criada** pelo jogador. A paleta é privada a cada conta, sem interferir nas outras.

## Se o acesso falhar

1. Verifique se **Authentication → E-mail/senha** está ativado.
2. Publique as novas regras do Firestore.
3. Confira o nome reservado `mestre_shinobi` e a senha usada na primeira entrada.
4. Se alguém tiver criado esse usuário antes, será necessário recuperar a conta no **Firebase Authentication**. Não compartilhe a senha mestra.

