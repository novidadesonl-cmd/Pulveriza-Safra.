# Pulveriza Safra

Aplicativo web responsivo para produtores rurais e operadores registrarem aplicações agrícolas com controle de dosagem, clima, cultura, talhão, produto, estoque, custo, reaplicação, carência e risco de perda de eficiência.

## Como usar

Abra `index.html` no navegador ou sirva a pasta com um servidor estático:

```bash
python3 -m http.server 4173
```

Depois acesse `http://127.0.0.1:4173/index.html`.

Os dados são salvos no `localStorage` do navegador, permitindo uso simples sem backend.

## Funcionalidades

- Dashboard **Hoje no Campo** com reaplicações, atrasos, riscos climáticos, estoque baixo e custos da safra.
- Cadastro livre de culturas e safras.
- Cadastro de talhões/locais vinculados às culturas.
- Cadastro de produtos e estoque com custo unitário automático, estoque mínimo e estimativa de hectares cobertos.
- Registro manual de aplicações com cálculo automático de quantidade, custo total, custo por hectare e diferença percentual.
- Nova aba **IA de Campo** para registrar aplicações por áudio ou texto, com pré-visualização editável e confirmação obrigatória antes de salvar.
- Botão destacado **🎙️ Falar aplicação** no Dashboard para abrir rapidamente a IA de Campo.
- Checklist climático com alertas por chuva, vento forte e neblina.
- Controle de reaplicação e carência.
- Tela de alertas operacionais.
- Histórico com filtros por cultura, talhão, produto, operador, período, risco e atraso.
- Relatórios de custos, uso de produtos, riscos e saldo de estoque.

## Aviso importante

Este aplicativo registra e organiza dados de manejo. Produtos, doses e carências devem seguir bula, receituário agronômico e orientação profissional habilitada.
