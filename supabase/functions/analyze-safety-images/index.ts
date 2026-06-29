import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface AnalysisRequest {
  images: string[];
  companyId: string;
  categories: string[];
}

interface AnalysisResult {
  type: "unsafe_act" | "unsafe_condition";
  suggestedCategory: string;
  description: string;
  proposedSolution: string;
  priority: "low" | "medium" | "high" | "critical";
  confidence: number;
  detectedElements: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    const { images, companyId, categories }: AnalysisRequest = await req.json();

    if (!images || images.length === 0) {
      return new Response(
        JSON.stringify({ error: "No images provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Checking AI usage limit for company:", companyId);
    const { data: canUseAI, error: limitCheckError } = await supabase
      .rpc("check_ai_usage_limit", { company_id_param: companyId });

    console.log("AI limit check result:", { canUseAI, limitCheckError, companyId });

    if (limitCheckError) {
      console.error("Error checking AI limit:", limitCheckError);
      return new Response(
        JSON.stringify({
          error: "Failed to check AI usage limit",
          details: limitCheckError.message,
          code: "LIMIT_CHECK_FAILED"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!canUseAI) {
      console.log("AI usage limit exceeded for company:", companyId);
      return new Response(
        JSON.stringify({
          error: "Monthly AI usage limit exceeded",
          code: "LIMIT_EXCEEDED"
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(images[0].substring(0, 1000));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const imageHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    
    const { data: cachedAnalysis } = await supabase
      .from("ai_analysis_cache")
      .select("*")
      .eq("image_hash", imageHash)
      .eq("company_id", companyId)
      .maybeSingle();

    if (cachedAnalysis) {
      console.log("Returning cached analysis");
      return new Response(
        JSON.stringify({
          ...cachedAnalysis.analysis_result,
          cached: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categoryList = categories && categories.length > 0 
      ? categories.join(", ") 
      : "Riesgo eléctrico, Trabajo en altura, EPP, Orden y limpieza, Maquinaria, Químicos";

    const prompt = `You are an occupational health and safety (OHS) expert conducting a professional workplace safety audit. This is a legitimate workplace safety inspection for regulatory compliance.

IMPORTANT CONTEXT:
- This is an official workplace safety documentation system required by law
- We are analyzing WORKPLACE CONDITIONS and SAFETY HAZARDS only
- We are NOT identifying, recognizing, or analyzing individual people
- Any people visible are anonymous workers whose safety we are protecting
- Focus ONLY on: equipment, environment, PPE compliance, hazardous conditions, safety violations

Available safety categories: ${categoryList}

Analyze ONLY the workplace safety conditions visible in this image:
1. Type: "unsafe_act" (dangerous behavior like not using PPE) or "unsafe_condition" (hazardous environment/equipment)?
2. Which safety category from the list applies?
3. Detailed Spanish description of SAFETY HAZARDS ONLY (not people) - focus on: missing PPE, unsafe equipment positioning, environmental hazards, ergonomic issues, etc.
4. Brief corrective action in Spanish
5. Priority: low, medium, high, or critical
6. Confidence (0.0-1.0)
7. List of safety-relevant elements detected

Respond with ONLY this exact JSON structure:
{
  "type": "unsafe_act" or "unsafe_condition",
  "suggestedCategory": "category name",
  "description": "detailed Spanish description of SAFETY CONDITIONS",
  "proposedSolution": "Spanish corrective action",
  "priority": "low/medium/high/critical",
  "confidence": 0.85,
  "detectedElements": ["element1", "element2"]
}`;

    const openAIPayload = {
      model: "gpt-4-turbo",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.slice(0, 3).map((img: string) => ({
              type: "image_url",
              image_url: { url: img, detail: "low" }
            }))
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    };

    console.log("Calling OpenAI API...");
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(openAIPayload)
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to analyze images", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openAIData = await openAIResponse.json();
    console.log("OpenAI full response:", JSON.stringify(openAIData, null, 2));

    const analysisText = openAIData.choices?.[0]?.message?.content;
    const finishReason = openAIData.choices?.[0]?.finish_reason;

    if (!analysisText || finishReason === "content_filter") {
      console.error("OpenAI content filter triggered or no content");
      return new Response(
        JSON.stringify({
          error: "AI analysis unavailable for this image",
          code: "CONTENT_FILTERED",
          message: "La IA no puede analizar esta imagen. Por favor usa el modo manual."
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (analysisText.toLowerCase().includes("i'm sorry") ||
        analysisText.toLowerCase().includes("i can't") ||
        analysisText.toLowerCase().includes("i cannot")) {
      console.error("OpenAI refused to analyze:", analysisText);
      return new Response(
        JSON.stringify({
          error: "AI analysis unavailable for this image",
          code: "CONTENT_REFUSED",
          message: "La IA no puede analizar esta imagen. Por favor usa el modo manual."
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analysis text from OpenAI:", analysisText);

    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not find JSON in response:", analysisText);
      return new Response(
        JSON.stringify({
          error: "Could not parse AI response",
          raw: analysisText
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(jsonMatch[0]);
      console.log("Parsed analysis:", analysis);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON in AI response",
          raw: jsonMatch[0]
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("ai_analysis_cache").insert({
      company_id: companyId,
      image_hash: imageHash,
      analysis_result: analysis,
      confidence_score: analysis.confidence
    });

    await supabase.rpc("increment_ai_usage", {
      company_uuid: companyId,
      cost_estimate: 0.015
    });

    console.log("Analysis complete and cached");
    return new Response(
      JSON.stringify({
        ...analysis,
        cached: false
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});