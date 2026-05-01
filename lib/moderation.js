import OpenAI from "openai";

const ANTI_FURRY_TERMS = [
  /\banti[-\s]?furr(?:y|ies)\b/i,
  /\bfurr(?:y|ies)[-_]?(?:hater|killer|hunter)\b/i,
  /\bfurr(?:y|ies)[-_]?(?:hate|haters|hunt|hunter|hunters|killer|killers)\b/i,
  /\bfurry[-_\s]?(?:hunt|hunter|hunters|killer|killers|exterminator|exterminators)\b/i,
  /\b(?:anti|hate|kill|hurt|ban|attack|bully|harass)[-_\s]?furr(?:y|ies)\b/i,
  /\bfurr(?:y|ies)\s+(?:are|r)\s+(?:gross|disgusting|degenerate|degenerates|trash|freaks?|cringe)\b/i,
  /\bfursuit(?:er)?s?\s+(?:are|r)\s+(?:gross|disgusting|degenerate|degenerates|trash|freaks?|cringe)\b/i,
  /\b(?:all\s+)?furr(?:y|ies)\s+(?:are|r)\s+(?:zoophiles?|pedos?|predators|vermin|subhuman|diseased|mentally\s+ill)\b/i,
  /\bfurr(?:y|ies)\s+(?:deserve|need)\s+to\s+(?:die|suffer|be\s+hurt|be\s+gone)\b/i,
  /\b(?:hate|hating)\s+furr(?:y|ies)\b/i,
  /\b(?:kill|hurt|attack|harass|bully)\s+(?:all\s+)?furr(?:y|ies)\b/i,
  /\b(?:eradicate|exterminate|purge|remove|wipe\s*out|get\s*rid\s*of)\s+(?:all\s+)?furr(?:y|ies)\b/i,
  /\bfurr(?:y|ies)\s+(?:should|must|need\s+to)\s+(?:be\s+)?(?:purged|removed|exterminated|eradicated|wiped\s*out)\b/i,
  /\bfurr(?:y|ies)\s+should\s+(?:die|disappear|be\s+banned|get\s+hurt)\b/i,
  /\bno\s+furr(?:y|ies)\s+allowed\b/i,
  /\bfurr(?:y|ies)\s+(?:dni|do\s+not\s+interact|aren'?t\s+welcome|not\s+welcome)\b/i,
  /\bfurry[-\s]?free\s+zone\b/i,
  /\bfurr?y?f(?:a|@)g(?:s)?\b/i
];

const COMPACT_ANTI_FURRY_TERMS = [
  /antifurr(?:y|ies)/i,
  /furr(?:y|ies)(?:hater|killer|hunter|exterminator)s?/i,
  /(?:hate|kill|hurt|attack|bully|harass|ban)furr(?:y|ies)/i,
  /(?:kill|hurt|attack|bully|harass|ban)(?:all)?furr(?:y|ies)/i,
  /(?:eradicate|exterminate|purge|remove|wipeout|getridof)(?:all)?furr(?:y|ies)/i,
  /furr(?:y|ies)(?:should|must|needto)(?:die|disappear|bebanned|gethurt|bepurged|beremoved|beexterminated)/i,
  /nofurr(?:y|ies)allowed/i,
  /furr(?:y|ies)(?:dni|donotinteract|notwelcome|arentwelcome)/i,
  /furryfreezone/i,
  /furr?y?f(?:a|@)gs?/i
];

const HATE_COMMENT_TERMS = [
  /\bgo\s+kill\s+yourself\b/i,
  /\bkys\b/i,
  /\b(?:you|u|they|them|everyone|people)\s+should\s+(?:die|disappear|suffer)\b/i,
  /\b(?:you|u)\s+(?:are|r)\s+(?:trash|disgusting|worthless|vermin|subhuman|degenerate|degenerates)\b/i,
  /\b(?:all|every)\s+[a-z][a-z\s-]{1,40}\s+(?:are|r)\s+(?:trash|disgusting|vermin|subhuman|degenerate|degenerates|diseased)\b/i,
  /\b(?:kill|hurt|attack|harass|bully|eradicate|exterminate)\s+(?:all|every)\s+[a-z][a-z\s-]{1,40}\b/i,
  /\b[a-z][a-z\s-]{1,40}\s+should\s+(?:die|disappear|be\s+hurt|be\s+eradicated|be\s+exterminated)\b/i
];

let openai;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  openai ||= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

function normalizeModerationText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t");
}

function compactModerationText(text) {
  return normalizeModerationText(text).replace(/[^a-z0-9]/gi, "");
}

function likelyReportingContext(text) {
  return /\b(?:report(?:ed|ing)?|quoted?|screenshot|example|someone\s+(?:said|posted|wrote)|they\s+(?:said|posted|wrote)|user\s+(?:said|posted|wrote))\b/i.test(text);
}

function heuristicAntiFurryCheck(text) {
  const normalized = normalizeModerationText(text);
  const compact = compactModerationText(text);
  const likelyQuoteOrReport = likelyReportingContext(normalized);
  if (likelyQuoteOrReport) return false;

  return ANTI_FURRY_TERMS.some((pattern) => pattern.test(normalized))
    || COMPACT_ANTI_FURRY_TERMS.some((pattern) => pattern.test(compact));
}

function heuristicHateCommentCheck(text) {
  const normalized = normalizeModerationText(text);
  if (likelyReportingContext(normalized)) return false;

  return heuristicAntiFurryCheck(normalized)
    || HATE_COMMENT_TERMS.some((pattern) => pattern.test(normalized));
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
          content: [
            "You are DenSpace's anti-harassment classifier. Decide whether this account should be permanently banned for clear anti-furry hostility.",
            "Ban when the username or content targets furries, fursuiters, fursonas, or the furry community with: hate, demeaning harassment, dehumanizing labels, slurs, threats, encouragement of harm, raids, coordinated harassment, or exclusionary anti-furry intent.",
            "Also catch coded or misspelled versions, sarcasm with hostile intent, and broad claims that all furries are predators, diseased, subhuman, or should be removed.",
            "Do not ban for neutral mentions, self-identification, safety discussion, reporting someone else's harassment, clearly quoted examples, boundaries that are not hateful, or criticism of a specific behavior without attacking the community."
          ].join(" ")
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
              category: {
                type: "string",
                enum: ["none", "slur", "demeaning_harassment", "threat_or_harm", "exclusion", "coded_harassment", "quoted_or_reporting"]
              },
              reason: { type: "string" }
            },
            required: ["should_ban", "confidence", "category", "reason"]
          }
        }
      }
    });

    const verdict = JSON.parse(classification.output_text || "{}");
    const minimumConfidence = context === "comment" ? 0.68 : 0.78;
    const aiBan = Boolean(verdict.should_ban) && Number(verdict.confidence || 0) >= minimumConfidence;
    const shouldBan = aiBan || heuristicFlag;

    return shouldBan
      ? {
        shouldBan: true,
        reason: aiBan
          ? verdict.reason || "Automatic ban: anti-furry harassment detected."
          : "Automatic ban: anti-furry harassment detected.",
        source: aiBan ? "openai-classifier" : "heuristic-with-ai"
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

export async function evaluateCommentHateBan({ username = "", text = "" }) {
  const input = [
    username ? `Username: ${username}` : "",
    text ? `Comment: ${text}` : ""
  ].filter(Boolean).join("\n").trim();

  if (!input) {
    return { shouldBan: false, reason: "", source: "empty" };
  }

  const heuristicFlag = heuristicHateCommentCheck(input);
  const client = getClient();

  if (!client) {
    return heuristicFlag
      ? {
        shouldBan: true,
        reason: "Automatic permanent ban: hateful or harassing comment detected.",
        source: "hate-heuristic"
      }
      : { shouldBan: false, reason: "", source: "hate-heuristic" };
  }

  try {
    const moderation = await client.moderations.create({
      model: "omni-moderation-latest",
      input
    });
    const result = moderation.results?.[0];
    const categories = result?.categories || {};
    const moderationBan = Boolean(
      categories.hate
      || categories["hate/threatening"]
      || categories.harassment
      || categories["harassment/threatening"]
      || categories["self-harm/instructions"]
    );

    if (result?.flagged && moderationBan) {
      return {
        shouldBan: true,
        reason: "Automatic permanent ban: hateful or harassing comment detected.",
        source: "openai-moderation"
      };
    }

    const classification = await client.responses.create({
      model: process.env.OPENAI_MODERATION_MODEL || "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: [
            "You are DenSpace's comment safety classifier. Decide whether a comment should permanently ban the author for hateful or harassing behavior.",
            "Ban for direct hate, slurs, identity attacks, demeaning harassment, threats, encouragement of self-harm, encouragement of violence, bullying, or broad attacks on a person or group.",
            "Do not ban for neutral disagreement, criticism without abuse, mild negativity, self-identification, safety discussion, quoted/reporting context, or educational examples."
          ].join(" ")
        },
        {
          role: "user",
          content: input
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "comment_hate_auto_ban",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              should_ban: { type: "boolean" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              category: {
                type: "string",
                enum: ["none", "hate", "harassment", "threat_or_harm", "self_harm_encouragement", "slur", "quoted_or_reporting"]
              },
              reason: { type: "string" }
            },
            required: ["should_ban", "confidence", "category", "reason"]
          }
        }
      }
    });

    const verdict = JSON.parse(classification.output_text || "{}");
    const aiBan = Boolean(verdict.should_ban) && Number(verdict.confidence || 0) >= 0.7;
    const shouldBan = aiBan || heuristicFlag;

    return shouldBan
      ? {
        shouldBan: true,
        reason: aiBan
          ? verdict.reason || "Automatic permanent ban: hateful or harassing comment detected."
          : "Automatic permanent ban: hateful or harassing comment detected.",
        source: aiBan ? "openai-hate-classifier" : "hate-heuristic-with-ai"
      }
      : { shouldBan: false, reason: "", source: "openai-hate-classifier" };
  } catch {
    return heuristicFlag
      ? {
        shouldBan: true,
        reason: "Automatic permanent ban: hateful or harassing comment detected.",
        source: "hate-heuristic-fallback"
      }
      : { shouldBan: false, reason: "", source: "hate-heuristic-fallback" };
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
          content: [
            "Classify whether this DenSpace content targets furries, fursuiters, fursonas, or the furry community with anti-furry harassment.",
            "Flag demeaning harassment, dehumanizing stereotypes, slurs, hostile exclusion, raid language, threats, encouragement of self-harm or physical harm, or coded/misspelled anti-furry hostility.",
            "Do not flag neutral mentions, self-identification, educational discussion, safety discussion, quoted/reporting context, or criticism of one specific behavior without attacking the community."
          ].join(" ")
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
              severity: {
                type: "string",
                enum: ["none", "low", "medium", "high"]
              },
              category: {
                type: "string",
                enum: ["none", "slur", "demeaning_harassment", "threat_or_harm", "exclusion", "coded_harassment", "quoted_or_reporting"]
              },
              reason: { type: "string" }
            },
            required: ["anti_furry_harassment", "confidence", "severity", "category", "reason"]
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
        reason: shouldBlock
          ? verdict.reason || "This post appears to target the furry community with harassment."
          : "This post appears to target the furry community with harassment.",
        source: shouldBlock ? "openai-classifier" : "heuristic-with-ai"
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
