# ⭐⚽ Rumo ao Estrelato

Jogo de navegador que simula uma carreira de jogador de futebol, da base até a aposentadoria.
Cada escolha muda o rumo da carreira — e **toda escolha mostra a chance de dar certo**.

Sem login, sem servidor: é só abrir o `index.html` no navegador (ou publicar no GitHub Pages).
O progresso fica salvo automaticamente no próprio navegador (`localStorage`), com a opção "Continuar carreira".

## Como jogar

1. **Nacionalidade** — 18 países com liga profissional (Brasil, Argentina, Uruguai, Colômbia, Chile, Paraguai, México, EUA, Portugal, Espanha, Inglaterra, Itália, Alemanha, França, Holanda, Turquia, Arábia Saudita e Japão).
2. **Estado (só Brasil)** — 18 estados, cada um com seus clubes tradicionais (ex.: Goiás → Goiás, Atlético Goianiense, Vila Nova, Aparecidense, Anápolis, Goiânia).
3. **Base** — clube grande = mais estrutura (potencial), porém menos chance de jogar; clube pequeno = mais minutos.
4. **Nome e posição** — Goleiro, Zagueiro, Meio-campista ou Atacante (cada posição tem jogadas diferentes).

A primeira temporada é na base (Copinha / Sub-17). Depois disso você sobe para o profissional e disputa
liga, copa nacional, estadual (Brasil), torneios continentais (Libertadores, Champions…) e Mundial de Clubes.

## Sistemas

| Sistema | Como funciona |
|---|---|
| **Fase, Humor, Equipe, Técnico** | Barras de 0 a 100. Influenciam a **chance de titularidade** e a **% de sucesso** de cada jogada na partida. |
| **Titularidade** | Overall vs. nível do time + relação com o técnico + fase + humor + entrosamento. A chance aparece antes de cada jogo. |
| **Escolhas fora de campo** | Coletivas ("colocar a culpa no técnico", "culpar a arbitragem"…), festas, treinos, redes sociais, lesões, empresários — cada opção mostra a % de dar certo. |
| **Partidas** | 1 a 4 lances decisivos por jogo, com opções e % (chute, cavadinha, carrinho, defesa…). Botão **Simular** escolhe automaticamente a opção mais provável. |
| **Pênaltis e faltas** | Você escolhe o canto em um gol dividido em 6 zonas, cada uma com sua %. O analista dá uma dica do lado preferido do goleiro. Goleiros escolhem para onde pular. Mata-mata empatado vai para disputa de pênaltis. |
| **Seleção** | Ao atingir **overall 85 em grande fase (Fase ≥ 70)** você recebe a convocação. Convocado, joga Eliminatórias, Copa do Mundo (anos 2030, 2034…) e o torneio continental (Copa América, Eurocopa, Copa Ouro, Copa da Ásia). |
| **Mercado** | No fim de cada temporada chegam propostas (inclusive do exterior e empréstimos para jovens com pouco tempo de jogo). Dá para tentar negociar salário — com risco de a proposta ser retirada. |
| **Prêmios** | Bola de Ouro, Artilheiro, Craque do campeonato, Goleiro menos vazado, Revelação. |
| **Fim de carreira** | A partir dos 33 anos você pode se aposentar (aos 40 é obrigatório). A tela final mostra **todos os títulos**, prêmios, números e trajetória, com botão para copiar o resumo. |

## Estrutura

```
index.html      → página única
css/style.css   → visual (responsivo, mobile first)
js/data.js      → países, ligas, estados e clubes (força e divisão)
js/events.js    → eventos de carreira com probabilidades
js/game.js      → motor: temporada, partidas, pênaltis, mercado, seleção, tela final
```

Para adicionar clubes, países ou eventos basta editar `js/data.js` ou `js/events.js`.
