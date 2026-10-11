# ⭐⚽ Rumo ao Estrelato

Jogo de navegador que simula uma carreira de jogador de futebol, da base até a aposentadoria.
Cada escolha muda o rumo da carreira — e **toda escolha mostra a chance de dar certo**.

Sem login, sem servidor: é só abrir o `index.html` no navegador (ou publicar no GitHub Pages).
O progresso fica salvo automaticamente no próprio navegador (`localStorage`), com a opção "Continuar carreira".

## Como jogar

1. **Nacionalidade**: 18 países com liga profissional.
2. **Estado (só Brasil)**: 18 estados, cada um com seus clubes tradicionais.
3. **Base**: clube grande dá mais estrutura (potencial), clube pequeno dá mais minutos.
4. **Seu jogador**: nome, número e cor da camisa, e posição (Goleiro, Zagueiro, Meio-campista ou Atacante).

Uma carreira completa leva cerca de 10 a 14 minutos (de 110 a 150 cliques).

## Sistemas

| Sistema | Como funciona |
|---|---|
| **Relacionamentos** | Fase, Técnico, Elenco e Torcida (0 a 100). Definem a titularidade e o rendimento nos lances. |
| **Escolhas sem porcentagem** | Cada escolha tem consequência definida. Nas entrevistas o resultado depende dos seus números: "Toca em mim que é gol" só funciona se você estiver fazendo gols; xingar o rival e chamar a torcida só funciona se você estiver bem. |
| **Temporada rápida** | Liga e fases iniciais das copas são simuladas. Você joga só as **finais** (copa nacional, continental, Mundial de Clubes) e a **semifinal e final da Copa do Mundo** / final do torneio continental de seleções. |
| **Lances** | Nas decisões você escolhe chute, cavadinha, assistência, carrinho, defesa e o canto do pênalti ou da falta. |
| **Conselho do ídolo** | Só em clubes com ídolo histórico (Flamengo/Zico, Barcelona/Messi, Bayern/Kahn, Roma/Totti etc.). |
| **Seleção** | Overall 85 em grande fase (Fase ≥ 70) garante a convocação. |
| **Recordes** | Na tela final: "O GOAT" (9+ Bolas de Ouro), "O novo Rei do Futebol" (3+ Copas), "Maior campeão da história" (44+ títulos), "Maior artilheiro da história", "Senhor da Champions", "O Totti de uma nova era" (500+ jogos por um clube) e outros. |

## Estrutura

```
index.html      → página única
css/style.css   → visual (responsivo, mobile first)
js/data.js      → países, ligas, estados, clubes, ídolos e cores de camisa
js/events.js    → eventos de carreira, entrevistas e conselho do ídolo
js/game.js      → motor: temporada, partidas, pênaltis, mercado, seleção, tela final
```

Para adicionar clubes, países ou eventos basta editar `js/data.js` ou `js/events.js`.
