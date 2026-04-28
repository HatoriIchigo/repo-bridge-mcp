import kuromoji from "kuromoji";

let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;

function getTokenizer(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

export async function extractKeywords(context: string): Promise<string[]> {
  const tokenizer = await getTokenizer();
  const tokens = tokenizer.tokenize(context);

  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const isTarget =
      token.pos === "名詞" ||
      token.pos === "動詞" ||
      token.pos === "英数" ||
      token.pos_detail_1 === "固有名詞";

    if (!isTarget) continue;

    const word =
      token.pos === "動詞"
        ? token.basic_form === "*" ? token.surface_form : token.basic_form
        : token.surface_form;

    if (!seen.has(word)) {
      seen.add(word);
      keywords.push(word);
    }
  }

  return keywords;
}
