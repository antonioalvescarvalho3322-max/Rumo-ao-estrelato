# ⭐⚽ Rumo ao Estrelato

Jogo de navegador que simula uma carreira de jogador de futebol, da base até a aposentadoria.
Cada escolha muda o rumo da carreira e a sua relação com o técnico, o elenco e a torcida.

Sem login e sem servidor: basta abrir o `index.html` no navegador (ou publicar no GitHub Pages).
O progresso fica salvo no próprio navegador (`localStorage`), com a opção "Continuar carreira".

## Como jogar

1. **Nacionalidade**: 18 países com liga profissional.
2. **Estado (só Brasil)**: 18 estados, cada um com seus clubes tradicionais.
3. **Base**: clube grande dá mais estrutura (potencial); clube pequeno dá mais minutos.
4. **Seu jogador**: nome, número da camisa e posição. A camisa usa as cores do clube.

## Regras

| Sistema | Como funciona |
|---|---|
| **Relacionamentos** | Fase, Técnico, Elenco e Torcida (0 a 100). Definem a titularidade e o rendimento nos lances. |
| **Escolhas** | Sem porcentagem: cada opção tem consequência definida, que pode depender do seu momento. |
| **Entrevistas** | Uma por temporada, sorteada entre 18 perguntas, cada uma com respostas próprias (sem repetir até esgotar). O resultado depende de três fatores juntos: relação com o **elenco**, relação com a **torcida** e os seus **números** na temporada. "Toca em mim que é gol" só funciona se você estiver marcando e com moral. |
| **Temporada** | Liga e fases iniciais das copas são simuladas e aparecem no resumo. Nos mata-matas você joga a partir das **oitavas**: oitavas, quartas e semifinal têm um lance decisivo; a **final** tem dois lances e pênaltis interativos. Vale para a copa nacional, o torneio continental, o Mundial de Clubes e a Copa do Mundo (o torneio continental de seleções começa nas quartas). |
| **Overall** | Natural pela idade (até o potencial; cai a partir dos 27). **Treino de pré-temporada**: +2 até 77, +1 de 78 a 87 (a partir de 88 só mantém). **Título**: +1 na temporada em que for campeão. **Artilheiro** ou **líder de assistências do campeonato**: +2. **Artilheiro** ou **líder de assistências do time**: +1. Goleiro menos vazado e melhor zagueiro: +2. |
| **Seleção** | Overall 85 em grande fase (Fase ≥ 70) garante a convocação. |
| **Legado** | Pelo overall máximo da carreira: **Entre os GOATs** (96+), **Craque** (90 a 95), **Bom jogador** (85 a 89), Jogador profissional (abaixo). **Superou o REI** exige 800 gols, 200 assistências, 3 Copas do Mundo, 6+ Bolas de Ouro e 6+ Champions League na mesma carreira. |
| **Recordes** | Recordista de Bolas de Ouro (9+), Maior campeão da história (44+ títulos), Maior artilheiro da história (950+ gols), Senhor da Champions (7+), Lenda da Libertadores (6+), recordes pela seleção e **O Totti de uma nova era** (500+ jogos por um clube). |
| **Conselho do ídolo** | Só nos clubes com ídolo histórico (Flamengo/Zico, Barcelona/Messi, Bayern/Kahn, Roma/Totti etc.). |

## Escudos oficiais

O jogo já sabe mostrar o escudo de cada clube (na escolha da base, no topo da tela, nos placares,
nas propostas e na tabela). Para ativar um escudo:

1. Coloque a imagem em `assets/escudos/` com o nome do clube sem acentos, em minúsculas e com hífens
   (ex.: `assets/escudos/flamengo.png`, `assets/escudos/sao-paulo.png`).
2. Cadastre o arquivo em `js/data/crests.js`. As cores são opcionais e, se informadas, passam a valer para a camisa:

```js
const CRESTS = {
  'Flamengo': { src: 'assets/escudos/flamengo.png', colors: ['#c8102e', '#111111'] },
};
```

Clubes sem escudo cadastrado aparecem só com o nome. Os escudos são marcas dos clubes: use-os apenas em projetos pessoais e sem fins comerciais.

## Estrutura do código

O jogo é HTML, CSS e JavaScript puro, sem build. Os scripts são carregados em ordem pelo `index.html`,
e cada arquivo expõe um único objeto (namespace) com as suas funções. Todas as funções têm comentários JSDoc.

```
index.html               página única; carrega os scripts na ordem abaixo
css/style.css            visual (tema escuro, responsivo)
assets/escudos/          imagens dos escudos (ver acima)

js/core/utils.js         Util: sorteios, matemática, formatação, escape de HTML
js/data/world.js         países, ligas, estados, clubes, posições e seleções
js/data/idols.js         ídolos que dão o conselho
js/data/club-colors.js   cores dos clubes (camisa)
js/data/crests.js        escudos oficiais cadastrados
js/data/events.js        eventos de carreira, convocação e conselho do ídolo
js/data/interviews.js    perguntas e atitudes das entrevistas
js/core/state.js         estado da carreira (G), criação do jogador e salvamento (Store)
js/core/world.js         World: consultas sobre clubes, ligas, adversários e torneios
js/core/progression.js   Progression: overall, treinos, prêmios, legado e recordes
js/engine/simulation.js  Sim: jogos simulados, titularidade e tabela da liga
js/engine/interview.js   Interview: escolha da pergunta e avaliação da resposta
js/engine/match.js       Match: regras dos jogos de mata-mata lance a lance
js/engine/season.js      Season: agenda da temporada e o que acontece em cada passo
js/ui/components.js      UI: renderização, cabeçalho, camisa, escudo, resumo e tabela
js/ui/match-view.js      MatchView: telas da partida
js/ui/screens.js         Screens: demais telas (criação, escolhas, fim de temporada, mercado, final)
js/main.js               liga os cliques (data-act) às ações e abre a tela inicial
```

### Fluxo

Cada temporada é uma lista de passos em `G.agenda` (bloco simulado da liga, evento, mata-mata, entrevista,
fim de temporada, mercado). `Season.next()` executa o próximo passo. Os botões não usam `onclick`:
cada um tem `data-act` (e `data-arg`), e `js/main.js` chama a ação correspondente no objeto `ACTIONS`.

Para adicionar conteúdo:
- **Clube**: uma linha em `js/data/world.js` (e a cor em `js/data/club-colors.js`).
- **Evento**: um item em `CAREER_EVENTS` (`js/data/events.js`).
- **Pergunta de entrevista**: um item em `INTERVIEW_QUESTIONS` (`js/data/interviews.js`).
