// src/lib/queryAnalyzer.ts
// Query assessment and adaptive query generation using Gemini 2.5 Flash with Claude fallback
// Copied from lawgic_corp architecture

export interface QueryAnalysisResult {
  quality: 'sufficient' | 'needs_clarification';

  clarification?: {
    reason: string;
    suggestedQuestions: string[];
  };

  enhanced?: {
    originalQuery: string;
    detectedDomain: string;
    adaptedQueries: {
      vectorDb: string;
      youcom: string;
      perplexity: string;
    };
    searchParams: {
      youcom: {
        freshness?: string;
        country?: string;
      };
      perplexity: {
        search_domain_filter?: string[];
        search_recency_filter?: 'day' | 'week' | 'month' | 'year';
        search_context_size?: 'low' | 'medium' | 'high';
      };
    };
    amendmentTerms?: string[];
    legalField?: string;
    legalFieldConfidence?: number;
    keyPhrases?: string[];
    courtSearchHints?: {
      courtCategory?: string;
      subArea?: string;
      rulingType?: string;
      wantsCourtDecisions?: boolean;
    };
  };
}

interface LLMQueryResult {
  quality: 'sufficient' | 'needs_clarification';
  clarification?: {
    reason: string;
    suggestedQuestions: string[];
  };
  enhanced?: {
    originalQuery: string;
    detectedDomain: string;
    adaptedQueries: {
      vectorDb: string;
      youcom: string;
      perplexity: string;
    };
    legalField?: string;
    legalFieldConfidence?: number;
    keyPhrases?: string[];
    courtSearchHints?: {
      courtCategory?: string;
      subArea?: string;
      rulingType?: string;
      wantsCourtDecisions?: boolean;
    };
  };
}

function getSearchParamsForDomain(_domain: string, freshnessRange: string) {
  return {
    youcom: {
      freshness: freshnessRange,
      country: 'GR',
    },
    perplexity: {
      search_context_size: 'high' as const,
    },
  };
}

export async function analyzeQuery(
  userQuery: string,
  currentDate: string,
  conversationContext?: string
): Promise<QueryAnalysisResult> {

  const today = new Date(currentDate);
  const fourYearsAgo = new Date(today);
  fourYearsAgo.setFullYear(today.getFullYear() - 4);
  const freshnessRange = `${fourYearsAgo.toISOString().split('T')[0]}to${currentDate}`;

  if (conversationContext) {
    console.log(`💬 [QueryAnalyzer] Conversation context provided (${conversationContext.length} chars)`);
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  let llmResult: LLMQueryResult | null = null;

  // Try Gemini first
  if (geminiApiKey) {
    llmResult = await callGemini(userQuery, currentDate, geminiApiKey, conversationContext);
  } else {
    console.warn('⚠️ GEMINI_API_KEY not set');
  }

  // Fallback to Claude
  if (!llmResult) {
    console.log('⚠️ Trying Claude fallback...');
    llmResult = await callClaude(userQuery, currentDate, conversationContext);
  }

  // Final fallback - use basic enhancement
  if (!llmResult) {
    console.log('⚠️ All LLMs failed, using basic fallback');
    llmResult = createFallbackLLMResult(userQuery);
  }

  return mergeWithSearchParams(llmResult, freshnessRange);
}

function mergeWithSearchParams(llmResult: LLMQueryResult, freshnessRange: string): QueryAnalysisResult {
  if (llmResult.quality === 'needs_clarification' || !llmResult.enhanced) {
    return {
      quality: llmResult.quality,
      clarification: llmResult.clarification,
    };
  }

  const domain = llmResult.enhanced.detectedDomain || 'general';
  const searchParams = getSearchParamsForDomain(domain, freshnessRange);

  const legalField = llmResult.enhanced.legalField;
  const legalFieldConfidence = llmResult.enhanced.legalFieldConfidence;
  const keyPhrases = llmResult.enhanced.keyPhrases;
  const courtSearchHints = llmResult.enhanced.courtSearchHints;

  if (legalField) {
    console.log(`📋 [QueryAnalyzer] Legal field: "${legalField}" (confidence: ${legalFieldConfidence ?? 'N/A'})`);
  }
  if (keyPhrases && keyPhrases.length > 0) {
    console.log(`🔑 [QueryAnalyzer] Key phrases: [${keyPhrases.join(', ')}]`);
  }
  if (courtSearchHints?.wantsCourtDecisions) {
    console.log(`⚖️ [QueryAnalyzer] Court hints: category=${courtSearchHints.courtCategory || 'any'}, subArea=${courtSearchHints.subArea || 'any'}, ruling=${courtSearchHints.rulingType || 'any'}`);
  }

  return {
    quality: 'sufficient',
    enhanced: {
      ...llmResult.enhanced,
      searchParams,
      legalField,
      legalFieldConfidence,
      keyPhrases,
      courtSearchHints,
    },
  };
}

function repairAndParseJSON(raw: string): unknown | null {
  if (!raw) return null;

  let text = raw.trim();

  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  text = text.trim();

  text = text.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) text = jsonMatch[1];

  try {
    return JSON.parse(text);
  } catch {
    // Continue with repairs
  }

  text = text.replace(/\/\/[^\n]*/g, '');
  text = text.replace(/,\s*([\]}])/g, '$1');
  text = text.replace(
    /([{,]\s*)'([^']+)'\s*:/g,
    '$1"$2":'
  );

  try {
    return JSON.parse(text);
  } catch {
    let repaired = text;
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;

    const lastQuote = repaired.lastIndexOf('"');
    const afterLastQuote = repaired.substring(lastQuote + 1);
    if (lastQuote > 0 && !afterLastQuote.match(/["\]},:]/)) {
      repaired = repaired.substring(0, lastQuote + 1);
    }
    repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
    repaired = repaired.replace(/,\s*$/, '');

    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

    try {
      return JSON.parse(repaired);
    } catch (e2) {
      console.error('❌ JSON repair failed:', (e2 as Error).message, 'Raw (first 200 chars):', raw.substring(0, 200));
      return null;
    }
  }
}

async function callGemini(
  userQuery: string,
  currentDate: string,
  apiKey: string,
  conversationContext?: string
): Promise<LLMQueryResult | null> {
  const prompt = buildPrompt(userQuery, currentDate, conversationContext);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('❌ Gemini API error:', response.status);
      return null;
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      console.error('❌ Empty Gemini response');
      return null;
    }

    const parsed = repairAndParseJSON(resultText) as LLMQueryResult;
    if (!parsed) {
      console.error('❌ Gemini returned unparseable JSON');
      return null;
    }
    if (parsed.enhanced && 'searchParams' in parsed.enhanced) {
      delete (parsed.enhanced as any).searchParams;
    }
    if (parsed.enhanced?.legalFieldConfidence !== undefined) {
      parsed.enhanced.legalFieldConfidence = Math.max(0, Math.min(1, parsed.enhanced.legalFieldConfidence));
      if (parsed.enhanced.legalFieldConfidence < 0.4) {
        parsed.enhanced.legalField = undefined;
        parsed.enhanced.legalFieldConfidence = undefined;
      }
    }
    if (parsed.enhanced?.keyPhrases) {
      parsed.enhanced.keyPhrases = parsed.enhanced.keyPhrases.filter(
        (p: string) => typeof p === 'string' && p.trim().split(/\s+/).length >= 2
      );
    }
    console.log(`✅ [Gemini] Query analysis: quality=${parsed.quality}, domain=${parsed.enhanced?.detectedDomain || 'N/A'}, legalField=${parsed.enhanced?.legalField || 'N/A'} (${parsed.enhanced?.legalFieldConfidence ?? 'N/A'}), keyPhrases=[${parsed.enhanced?.keyPhrases?.join(', ') || 'none'}]`);
    return parsed;
  } catch (error) {
    console.error('❌ Gemini failed:', error);
    return null;
  }
}

async function callClaude(
  userQuery: string,
  currentDate: string,
  conversationContext?: string
): Promise<LLMQueryResult | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.warn('⚠️ ANTHROPIC_API_KEY not set - skipping Claude fallback');
    return null;
  }

  const prompt = buildPrompt(userQuery, currentDate, conversationContext);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('❌ Claude API error:', response.status);
      return null;
    }

    const data = await response.json();
    const resultText = data.content?.[0]?.text;

    if (!resultText) {
      console.error('❌ Empty Claude response');
      return null;
    }

    const parsed = repairAndParseJSON(resultText) as LLMQueryResult;
    if (!parsed) {
      console.error('❌ Claude returned unparseable JSON');
      return null;
    }
    if (parsed.enhanced && 'searchParams' in parsed.enhanced) {
      delete (parsed.enhanced as any).searchParams;
    }
    if (parsed.enhanced?.legalFieldConfidence !== undefined) {
      parsed.enhanced.legalFieldConfidence = Math.max(0, Math.min(1, parsed.enhanced.legalFieldConfidence));
      if (parsed.enhanced.legalFieldConfidence < 0.4) {
        parsed.enhanced.legalField = undefined;
        parsed.enhanced.legalFieldConfidence = undefined;
      }
    }
    if (parsed.enhanced?.keyPhrases) {
      parsed.enhanced.keyPhrases = parsed.enhanced.keyPhrases.filter(
        (p: string) => typeof p === 'string' && p.trim().split(/\s+/).length >= 2
      );
    }
    console.log(`✅ [Claude] Query analysis: quality=${parsed.quality}, domain=${parsed.enhanced?.detectedDomain || 'N/A'}, legalField=${parsed.enhanced?.legalField || 'N/A'} (${parsed.enhanced?.legalFieldConfidence ?? 'N/A'}), keyPhrases=[${parsed.enhanced?.keyPhrases?.join(', ') || 'none'}]`);
    return parsed;
  } catch (error) {
    console.error('❌ Claude fallback failed:', error);
    return null;
  }
}

function createFallbackLLMResult(userQuery: string): LLMQueryResult {
  return {
    quality: 'sufficient',
    enhanced: {
      originalQuery: userQuery,
      detectedDomain: 'general',
      adaptedQueries: {
        vectorDb: userQuery,
        youcom: userQuery,
        perplexity: userQuery,
      },
      legalField: undefined,
      legalFieldConfidence: undefined,
      keyPhrases: undefined,
    },
  };
}

function buildPrompt(userQuery: string, currentDate: string, conversationContext?: string): string {
  const contextSection = conversationContext
    ? `
=== CONVERSATION CONTEXT ===

This is a FOLLOW-UP question in an ongoing conversation. The previous user question was:
"${conversationContext}"

CRITICAL RULES FOR FOLLOW-UP QUESTIONS:
1. NEVER mark follow-up questions as "needs_clarification" — the conversation provides context.
2. You MUST enhance the follow-up query the SAME WAY you would enhance a first question:
   - Detect the legal field FROM THE CONVERSATION CONTEXT
   - Extract key phrases FROM THE CONVERSATION CONTEXT
   - Generate adapted queries that COMBINE the follow-up intent with the conversation topic
3. For adaptedQueries, merge the current question's intent with the previous topic:
   - vectorDb: Full sentence combining the follow-up question with the topic from context
   - youcom: Keywords from BOTH the current question and the previous topic
   - perplexity: Question combining the follow-up intent with the topic
4. The user may use references like "αυτή σου την απάντηση", "τους νομούς", "αυτό" — resolve these using the conversation context.
`
    : '';

  return `You are a Greek legal query analyzer.

CURRENT DATE: ${currentDate}
USER QUERY: "${userQuery}"
${contextSection}
TASK: Assess if query is clear enough, then REFORMAT it for different search systems and detect the legal field.

=== CRITICAL RULE ===

Use ONLY words and concepts that the user actually wrote. Do NOT add:
- Law numbers, article numbers, or legal references the user didn't mention
- Legal boilerplate phrases (e.g. "σύμφωνα με την ισχύουσα νομοθεσία")
- Geographic context (e.g. "στην Ελλάδα") unless the user wrote it
- Temporal qualifiers (e.g. "τρέχουσα", "ισχύουσα") unless the user implied them
- Legal terminology the user didn't use

The ONLY additions allowed are:
- Expanding well-known acronyms inline: e.g. "ΑΠΕ" → "ΑΠΕ (ανανεώσιμες πηγές ενέργειας)"
- Rephrasing the same words into a different format (sentence → keywords, or statement → question)
- When there is CONVERSATION CONTEXT, you may incorporate the topic from the previous exchange

When in doubt, keep the user's original wording.

=== ASSESSMENT ===

NEEDS CLARIFICATION when:
- "άδειες" alone (which type: work, building, energy, driving?)
- "σύμβαση" alone (employment, lease, sale, services?)
- "αποζημίωση" alone (dismissal, tort, contract?)
- Single generic word without legal context
- Multiple possible interpretations that context doesn't resolve

NEVER needs clarification when:
- There is CONVERSATION CONTEXT provided above
- The query references a previous answer
- Clear legal topic (even if brief)
- At least one specific element that makes the intent clear

=== QUERY REFORMATTING ===

VECTOR DB (vectorDb):
- Full natural sentence in Greek using the user's own words
- Only expand well-known acronyms inline
- NO operators, NO added legal terms

YOU.COM (youcom):
- Extract 4-6 keywords from the user's query
- Expand acronyms as separate words
- NO operators, NO sentences, NO added terms

PERPLEXITY (perplexity):
- Rephrase the user's query as a question in Greek
- Use only the user's own concepts
- NO operators, NO added context

=== DOMAIN DETECTION ===

Detect ONE of: energy, labor, corporate, tax, criminal, civil, education, environment, health, administrative, realestate, general

=== LEGAL FIELD DETECTION ===

Identify the primary legal field of the query IN GREEK.
Common values (use exactly these when they apply):
- "Φορολογικό Δίκαιο" (tax law)
- "Εργατικό Δίκαιο" (labor law)
- "Αστικό Δίκαιο" (civil law)
- "Ποινικό Δίκαιο" (criminal law)
- "Εμπορικό Δίκαιο" (commercial law)
- "Διοικητικό Δίκαιο" (administrative law)
- "Δημόσιο Δίκαιο" (public law)
- "Εκπαίδευση" (education)
- "Περιβαλλοντικό Δίκαιο" (environmental law)
- "Ενεργειακό Δίκαιο" (energy law)
- "Υγεία" (health)
- "Εμπράγματο Δίκαιο" (property law)
- "Κοινωνική Ασφάλιση" (social security)
- "Δίκαιο Πνευματικής Ιδιοκτησίας" (intellectual property)

Rate confidence from 0.0 to 1.0.
Below 0.4 = uncertain, set legalField to null.

=== KEY PHRASES ===

Extract 2-5 multi-word phrases (2-3 words each) from the user's query.
A phrase must be at least 2 words. Single words are NOT key phrases.

=== COURT DECISION SIGNALS ===

If the user's query relates to court decisions/jurisprudence, provide courtSearchHints:
- courtCategory: "Άρειος Πάγος", "ΣτΕ", "Εφετείο", "Πρωτοδικείο", or null
- subArea: Legal sub-area (e.g., "Συμβάσεις εργασίας", "Αστική Ευθύνη")
- rulingType: "acceptance", "rejection", "partial_acceptance", or null
- wantsCourtDecisions: true if the user explicitly or implicitly wants court jurisprudence

=== OUTPUT JSON ===

If needs clarification:
{
  "quality": "needs_clarification",
  "clarification": {
    "reason": "Explanation in Greek",
    "suggestedQuestions": ["Ερώτηση 1;", "Ερώτηση 2;"]
  }
}

If sufficient:
{
  "quality": "sufficient",
  "enhanced": {
    "originalQuery": "${userQuery}",
    "detectedDomain": "energy|labor|corporate|tax|criminal|civil|education|environment|health|administrative|realestate|general",
    "legalField": "Greek legal field name or null if uncertain",
    "legalFieldConfidence": 0.0-1.0,
    "keyPhrases": ["phrase1 phrase2", "phrase3 phrase4"],
    "courtSearchHints": {
      "courtCategory": "court level or null",
      "subArea": "legal sub-area or null",
      "rulingType": "acceptance|rejection|partial_acceptance or null",
      "wantsCourtDecisions": true
    },
    "adaptedQueries": {
      "vectorDb": "User's query as natural sentence...",
      "youcom": "keyword1 keyword2 keyword3",
      "perplexity": "User's query as question?"
    }
  }
}

Return ONLY valid JSON.`;
}
