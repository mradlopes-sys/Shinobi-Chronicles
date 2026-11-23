# Forja Shinobi — backend (em desenvolvimento)

Função Firebase Callable que exige login e autorização em `admins/{uid}` (ou e-mail mestre configurado no servidor). A chave OpenAI permanece em Secret Manager.

## Preparação
1. Na pasta `functions`, execute `npm install`.
2. Configure `firebase functions:secrets:set OPENAI_API_KEY`.
3. Se a conta mestre não estiver em `admins/{uid}`, configure `SHINOBI_MASTER_EMAIL` no ambiente da função (não no cliente).
4. Configure o projeto Firebase e faça deploy da função `forjaShinobi` na região `southamerica-east1`.
5. Integre a chamada ao painel ADM e valide localmente cada alteração contra o esquema da ficha e as regras de jogo antes de salvar no Firestore.

**Atenção:** esta função apenas propõe mudanças, não salva fichas. Não está implantada nem conectada à interface atual. Não exponha chaves de API no GitHub Pages. Verifique os custos de Functions e da API.
