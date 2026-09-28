// Mapeamento de DDD -> região, usado no gráfico "Leads por região" do painel Elo.

const MAPA_DDD = {
  "11": { nome: "São Paulo capital", faixaDDD: "DDD 11" },
  "12": { nome: "Interior de SP", faixaDDD: "DDD 12–19" },
  "13": { nome: "Interior de SP", faixaDDD: "DDD 12–19" },
  "14": { nome: "Interior de SP", faixaDDD: "DDD 12–19" },
  "15": { nome: "Interior de SP", faixaDDD: "DDD 12–19" },
  "16": { nome: "Interior de SP", faixaDDD: "DDD 12–19" },
  "17": { nome: "Interior de SP", faixaDDD: "DDD 12–19" },
  "18": { nome: "Interior de SP", faixaDDD: "DDD 12–19" },
  "19": { nome: "Interior de SP", faixaDDD: "DDD 12–19" },

  "21": { nome: "Rio de Janeiro", faixaDDD: "DDD 21–24" },
  "22": { nome: "Rio de Janeiro", faixaDDD: "DDD 21–24" },
  "24": { nome: "Rio de Janeiro", faixaDDD: "DDD 21–24" },
  "27": { nome: "Espírito Santo", faixaDDD: "DDD 27–28" },
  "28": { nome: "Espírito Santo", faixaDDD: "DDD 27–28" },

  "31": { nome: "Minas Gerais", faixaDDD: "DDD 31–38" },
  "32": { nome: "Minas Gerais", faixaDDD: "DDD 31–38" },
  "33": { nome: "Minas Gerais", faixaDDD: "DDD 31–38" },
  "34": { nome: "Minas Gerais", faixaDDD: "DDD 31–38" },
  "35": { nome: "Minas Gerais", faixaDDD: "DDD 31–38" },
  "37": { nome: "Minas Gerais", faixaDDD: "DDD 31–38" },
  "38": { nome: "Minas Gerais", faixaDDD: "DDD 31–38" },

  "41": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "42": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "43": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "44": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "45": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "46": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "47": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "48": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "49": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 41–49" },
  "51": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 51–55" },
  "53": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 51–55" },
  "54": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 51–55" },
  "55": { nome: "Sul (PR/SC/RS)", faixaDDD: "DDD 51–55" },

  "61": { nome: "Centro-Oeste", faixaDDD: "DDD 61–67" },
  "62": { nome: "Centro-Oeste", faixaDDD: "DDD 61–67" },
  "64": { nome: "Centro-Oeste", faixaDDD: "DDD 61–67" },
  "65": { nome: "Centro-Oeste", faixaDDD: "DDD 61–67" },
  "66": { nome: "Centro-Oeste", faixaDDD: "DDD 61–67" },
  "67": { nome: "Centro-Oeste", faixaDDD: "DDD 61–67" },

  "63": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "68": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "69": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "91": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "92": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "93": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "94": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "95": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "96": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "97": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "98": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },
  "99": { nome: "Norte", faixaDDD: "DDD 63, 91–99" },

  "71": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "73": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "74": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "75": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "77": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "79": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "81": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "82": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "83": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "84": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "85": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "86": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "87": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "88": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
  "89": { nome: "Nordeste", faixaDDD: "DDD 71–89" },
};

const REGIAO_NAO_IDENTIFICADA = { nome: "Não identificado", faixaDDD: "sem DDD" };

/**
 * Extrai o DDD de um telefone brasileiro em qualquer formato comum
 * ("+55 11 98888-7777", "5511988887777", "11988887777"...).
 * Retorna null se não conseguir identificar.
 */
export function extrairDDD(telefoneBruto) {
  if (!telefoneBruto) return null;

  const somenteDigitos = String(telefoneBruto).replace(/\D/g, "");
  if (somenteDigitos.length < 10) return null;

  let numero = somenteDigitos;
  if (numero.startsWith("55") && numero.length >= 12) {
    numero = numero.slice(2);
  }

  const ddd = numero.slice(0, 2);
  return MAPA_DDD[ddd] ? ddd : null;
}

/** Dado um DDD (2 dígitos), retorna a região correspondente. */
export function regiaoPorDDD(ddd) {
  if (!ddd) return REGIAO_NAO_IDENTIFICADA;
  return MAPA_DDD[ddd] ?? REGIAO_NAO_IDENTIFICADA;
}

/**
 * Agrupa uma lista de telefones em contagem por região, ordenada do maior
 * pro menor volume — formato pronto pro gráfico "Leads por região".
 */
export function agruparPorRegiao(telefones) {
  const contagem = new Map();

  for (const telefone of telefones) {
    const ddd = extrairDDD(telefone);
    const regiao = regiaoPorDDD(ddd);
    const atual = contagem.get(regiao.nome);
    if (atual) {
      atual.total += 1;
    } else {
      contagem.set(regiao.nome, { nome: regiao.nome, faixaDDD: regiao.faixaDDD, total: 1 });
    }
  }

  return Array.from(contagem.values()).sort((a, b) => b.total - a.total);
}
