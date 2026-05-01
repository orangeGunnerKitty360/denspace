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

function moderationCategoryHit(categories, scores, keys, minimumScore = 0.65) {
  return keys.some((key) => categories[key] || Number(scores[key] || 0) >= minimumScore);
}

function heuristicAntiFurryCheck(text) {
  const normalized = normalizeModerationText(text);
  const compact = compactModerationText(text);
  const likelyQuoteOrReport = likelyReportingContext(normalized);
  if (likelyQuoteOrReport) return false;

  return ANTI_FURRY_TERMS.some((pattern) => pattern.test(normalized))
    || COMPACT_ANTI_FURRY_TERMS.some((pattern) => pattern.test(compact));
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
    return {
      shouldBan: false,
      reason: "",
      source: heuristicFlag ? "ai-unavailable-heuristic-match" : "ai-unavailable"
    };
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

    return aiBan
      ? {
        shouldBan: true,
        reason: verdict.reason || "Automatic ban: anti-furry harassment detected.",
        source: "openai-classifier"
      }
      : { shouldBan: false, reason: "", source: "openai-classifier" };
  } catch {
    return {
      shouldBan: false,
      reason: "",
      source: heuristicFlag ? "ai-error-heuristic-match" : "ai-error"
    };
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

  const client = getClient();

  if (!client) {
    return { shouldBan: false, reason: "", source: "ai-unavailable" };
  }

  try {
    const moderation = await client.moderations.create({
      model: "omni-moderation-latest",
      input
    });
    const result = moderation.results?.[0];
    const categories = result?.categories || {};
    const scores = result?.category_scores || {};
    const immediateHateBan = moderationCategoryHit(
      categories,
      scores,
      ["hate", "hate/threatening", "harassment", "harassment/threatening", "self-harm/instructions"],
      0.65
    );
    const immediateViolenceBan = Boolean(result?.flagged) && moderationCategoryHit(
      categories,
      scores,
      ["violence"],
      0.9
    );

    if (immediateHateBan || immediateViolenceBan) {
      return {
        shouldBan: true,
        reason: "Automatic permanent ban: hateful or harassing comment detected.",
        source: "openai-moderation-immediate"
      };
    }

    const classification = await client.responses.create({
      model: process.env.OPENAI_MODERATION_MODEL || "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: [
            "You are DenSpace's comment safety classifier. Decide whether a comment should permanently ban the author for hateful or harassing behavior.",
            "Do not use a fixed keyword list. Judge the whole comment, the topic being discussed, the target, and the user's intent.",
            "Ban for these hate-comment types when they are clear and hostile: identity-based hate, slurs or epithets, dehumanization, degradation or contempt, harmful stereotypes, threats or violence, incitement or glorification of harm, encouragement of self-harm, targeted harassment or bullying, doxxing or real-world intimidation, broad group attacks, and coded or masked hateful abuse.",
            "Consider both directed attacks against one person and generalized attacks against a group or community. Protected traits include race, ethnicity, nationality, immigration status, caste, religion or belief, sex, gender identity or expression, sexual orientation, disability, health condition, and age. On DenSpace, also treat hostile attacks on community identities or topics as harassment even when they are not protected-class hate.",
            "Do not ban for neutral disagreement, criticism without abuse, mild negativity, self-identification, reclaimed/self-referential language, safety discussion, quoted/reporting context, educational examples, or merely offensive language that is not hate or harassment."
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
                enum: [
                  "none",
                  "identity_based_hate",
                  "slur_or_epithet",
                  "dehumanization",
                  "degradation_or_contempt",
                  "harmful_stereotype",
                  "threat_or_violence",
                  "incitement_or_glorification",
                  "self_harm_encouragement",
                  "targeted_harassment_or_bullying",
                  "doxxing_or_real_world_intimidation",
                  "directed_personal_attack",
                  "generalized_group_attack",
                  "coded_or_masked_hate",
                  "offensive_not_hate",
                  "quoted_or_reporting"
                ]
              },
              target_scope: {
                type: "string",
                enum: ["none", "individual", "group", "community", "unclear"]
              },
              target_basis: {
                type: "string",
                enum: [
                  "none",
                  "race_ethnicity",
                  "nationality_or_immigration",
                  "religion_or_belief",
                  "caste",
                  "sex_or_gender",
                  "gender_identity_or_expression",
                  "sexual_orientation",
                  "disability_or_health",
                  "age",
                  "body_or_appearance",
                  "community_identity_or_topic",
                  "other"
                ]
              },
              reason: { type: "string" },
              safe_to_allow_reason: { type: "string" }
            },
            required: ["should_ban", "confidence", "category", "target_scope", "target_basis", "reason", "safe_to_allow_reason"]
          }
        }
      }
    });

    const verdict = JSON.parse(classification.output_text || "{}");
    const aiBan = Boolean(verdict.should_ban) && Number(verdict.confidence || 0) >= 0.7;

    return aiBan
      ? {
        shouldBan: true,
        reason: verdict.reason || "Automatic permanent ban: hateful or harassing comment detected.",
        source: "openai-hate-classifier"
      }
      : { shouldBan: false, reason: "", source: "openai-hate-classifier" };
  } catch {
    return { shouldBan: false, reason: "", source: "ai-error" };
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
