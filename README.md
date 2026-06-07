# Pulveriza Safra

Aplicativo web responsivo para produtores rurais e operadores registrarem aplicações agrícolas com controle de dosagem, clima, cultura, talhão, produto, estoque, custo, reaplicação, carência e risco de perda de eficiência.

## Como abrir

Como é um aplicativo estático, basta abrir `index.html` no navegador ou servir a pasta com um servidor local:

```bash
python3 -m http.server 4173
```

Depois acesse `http://127.0.0.1:4173`.

## Funcionalidades

- Dashboard "Hoje no Campo" com reaplicações, atrasos, riscos, estoque baixo e custos da safra.
- Cadastro de culturas, talhões/locais e produtos com estoque.
- Cálculo automático de custo unitário, quantidade calculada, custo total, custo por hectare e diferença percentual de dose.
- Baixa automática do estoque ao salvar uma aplicação.
- Alertas para estoque baixo, produto insuficiente, chuva, vento, carência e reaplicações.
- Registro manual ou por voz/texto, sempre com revisão antes de salvar.
- Histórico com filtros e relatórios gerenciais.

## Aviso

Este aplicativo registra e organiza dados de manejo. Produtos, doses e carências devem seguir bula, receituário agronômico e orientação profissional habilitada.
