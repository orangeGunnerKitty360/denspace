import OpenAI from "openai";

const ANTI_FURRY_TERMS = [
  /\banti[-\s]?furr(?:y|ies)\b/i,
  /\bfurr(?:y|ies)[-_]?(?:hater|killer|hunter)\b/i,
  /\b(?:anti|hate|kill|hurt|ban)[-_]?furr(?:y|ies)\b/i,
  /\bfurr(?:y|ies)\s+(?:are|r)\s+(?:gross|disgusting|degenerate|degenerates|trash|freaks?|cringe)\b/i,
  /\b(?:hate|hating)\s+furr(?:y|ies)\b/i,
  /\b(?:kill|hurt|attack|harass|bully)\s+(?:all\s+)?furr(?:y|ies)\b/i,
  /\bfurr(?:y|ies)\s+should\s+(?:die|disappear|be\s+banned|get\s+hurt)\b/i
];

let openai;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  openai ||= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

function heuristicAntiFurryCheck(text) {
  return ANTI_FURRY_TERMS.some((pattern) => pattern.test(text));
}

export async function evaluateAntiFurryBan({ username = "", text = "", context = "content" }) {
  const input = [
    username ? `Username: ${username}` : "",
    text ? `${context}: ${text}` : ""
  ].filter(Boolean).join("\n").trim();

  if (!input) {
    return { shouldBan: false, reason: "", source: "empty" };
  }

  const heuristicFlag = heuristicAntiFurryCheck(input);
  const client = getClient();

  if (!client) {
    return heuristicFlag
      ? {
        shouldBan: true,
        reason: "Automatic ban: anti-furry harassment detected.",
        source: "heuristic"
      }
      : { shouldBan: false, reason: "", source: "heuristic" };
  }

  try {
    const classification = await client.responses.create({
      model: process.env.OPENAI_MODERATION_MODEL || "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: "Decide whether this DenSpace user should be automatically banned for clear anti-furry harassment. Ban only for usernames or content that clearly target furries/the furry community with hate, demeaning harassment, threats, calls to harm, or exclusionary anti-furry intent. Do not ban for neutral mentions, safety discussion, jokes without hostility, criticism of a specific behavior, or quoted/reporting context."
        },
        {
          role: "user",
          content: input
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "anti_furry_auto_ban",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              should_ban: { type: "boolean" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string" }
            },
            required: ["should_ban", "confidence", "reason"]
          }
        }
      }
    });

    const verdict = JSON.parse(classification.output_text || "{}");
    const shouldBan = (Boolean(verdict.should_ban) && Number(verdict.confidence || 0) >= 0.78) || heuristicFlag;

    return shouldBan
      ? {
        shouldBan: true,
        reason: verdict.reason || "Automatic ban: anti-furry harassment detected.",
        source: "openai-classifier"
      }
      : { shouldBan: false, reason: "", source: "openai-classifier" };
  } catch {
    return heuristicFlag
      ? {
        shouldBan: true,
        reason: "Automatic ban: anti-furry harassment detected.",
        source: "heuristic-fallback"
      }
      : { shouldBan: false, reason: "", source: "heuristic-fallback" };
  }
}

export async function moderatePostContent({ text, imageName }) {
  const input = [text, imageName].filter(Boolean).join("\n").trim();
  if (!input) {
    return { allowed: true, reason: "", source: "empty" };
  }

  const heuristicFlag = heuristicAntiFurryCheck(input);
  const client = getClient();

  if (!client) {
    return heuristicFlag
      ? {
        allowed: false,
        reason: "This post appears to target the furry community with harassment or threats.",
        source: "heuristic"
      }
      : { allowed: true, reason: "", source: "heuristic" };
  }

  try {
    const moderation = await client.moderations.create({
      model: "omni-moderation-latest",
      input
    });
    const result = moderation.results?.[0];
    const categories = result?.categories || {};

    if (result?.flagged || categories.harassment || categories["harassment/threatening"]) {
      return {
        allowed: false,
        reason: "This post was blocked because it looks like harassment or threatening content.",
        source: "openai-moderation"
      };
    }

    const classification = await client.responses.create({
      model: process.env.OPENAI_MODERATION_MODEL || "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: "Classify whether a social post targets furries or the furry community with demeaning, harassing, threatening, dehumanizing, or exclusionary anti-furry content. Do not flag neutral criticism, safety discussion, boundaries, self-identification, jokes without hostility, or educational discussion."
        },
        {
          role: "user",
          content: input
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "anti_furry_moderation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              anti_furry_harassment: { type: "boolean" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string" }
            },
            required: ["anti_furry_harassment", "confidence", "reason"]
          },
        }
      }
    });

    const raw = classification.output_text || "{}";
    const verdict = JSON.parse(raw);
    const shouldBlock = Boolean(verdict.anti_furry_harassment) && Number(verdict.confidence || 0) >= 0.68;

    if (shouldBlock || heuristicFlag) {
      return {
        allowed: false,
        reason: verdict.reason || "This post appears to target the furry community with harassment.",
        source: "openai-classifier"
      };
    }

    return { allowed: true, reason: "", source: "openai-classifier" };
  } catch {
    return heuristicFlag
      ? {
        allowed: false,
        reason: "This post appears to target the furry community with harassment.",
        source: "heuristic-fallback"
      }
      : { allowed: true, reason: "", source: "heuristic-fallback" };
  }
}
