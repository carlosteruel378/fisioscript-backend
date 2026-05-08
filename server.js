import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const rateLimitMap = new Map();
function rateLimit(maxReqs, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const reqs = (rateLimitMap.get(ip) || []).filter(t => t > now - windowMs);
    if (reqs.length >= maxReqs) return res.status(429).json({ error: "Demasiadas peticiones. Espera un momento." });
    reqs.push(now); rateLimitMap.set(ip, reqs); next();
  };
}

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// CORS
const allowedOrigins = [
  "http://localhost:3000", "http://localhost:5500",
  "http://127.0.0.1:5500", "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error("CORS no permitido")),
}));

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now()-start}ms`));
  next();
});

app.get("/", (req, res) => res.json({ status: "ok", service: "FisioScript API v2.0" }));

// ── POST /api/generate ───────────────────────────────────────────────────────
app.post("/api/generate", rateLimit(20, 60_000), async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") return res.status(400).json({ error: "El campo 'text' es requerido." });
  if (text.trim().length < 10) return res.status(400).json({ error: "Transcripción demasiado corta." });
  if (text.length > 15_000) return res.status(400).json({ error: "Transcripción demasiado larga." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Servidor mal configurado." });

  const system = `Eres un fisioterapeuta clínico experto en documentación y razonamiento clínico.
Analiza la transcripción de una consulta de fisioterapia y extrae TODA la información posible.
Devuelve ÚNICAMENTE este JSON exacto, sin markdown ni texto adicional:

{
  "historia": {
    "motivo": "motivo de consulta detallado con localización, inicio y características",
    "edad": "edad y datos demográficos relevantes (profesión, situación laboral)",
    "antecedentes": "antecedentes médicos, lesiones previas, cirugías, enfermedades crónicas",
    "medicacion": "medicación actual con dosis si se menciona, alergias, suplementos",
    "deporte": "actividad física, nivel, frecuencia, postura laboral, ergonomía",
    "exploracion": "exploración física: postura, ROM, tests, palpación, fuerza, EVA",
    "tratamiento": "técnicas aplicadas, ejercicios prescritos, pautas domiciliarias",
    "observaciones": "evolución, pronóstico, factores psicosociales, objetivos"
  },
  "soap": {
    "S": "síntomas subjetivos: queja principal, dolor (tipo, EVA, localización, irradiación, agravantes/aliviantes), historia del problema",
    "O": "hallazgos objetivos: postura, ROM con grados si disponibles, tests ortopédicos/neurológicos y resultado, palpación, fuerza",
    "A": "evaluación: diagnóstico fisioterápico, estructuras afectadas, hipótesis clínica, severidad, estadio (agudo/subagudo/crónico)",
    "P": "plan: técnicas con dosis, ejercicios con series/repeticiones, objetivos corto/largo plazo, educación, próxima cita"
  },
  "banderas_rojas": [
    {
      "titulo": "nombre corto de la bandera roja",
      "descripcion": "explicación clínica de por qué es una bandera roja en este caso",
      "severidad": "alta | media",
      "accion": "acción recomendada (ej: derivación médica urgente, prueba complementaria)"
    }
  ],
  "banderas_amarillas": [
    {
      "titulo": "nombre corto de la bandera amarilla",
      "descripcion": "explicación clínica del factor psicosocial o de riesgo de cronificación",
      "severidad": "media | baja",
      "accion": "enfoque recomendado (ej: explorar creencias, educación en dolor, apoyo psicológico)"
    }
  ],
  "hipotesis": {
    "principal": "nombre del diagnóstico fisioterápico principal más probable",
    "confianza": 0.75,
    "razonamiento": "explicación clínica breve del razonamiento diagnóstico basado en los hallazgos",
    "diferenciales": [
      {"nombre": "diagnóstico diferencial 1", "probabilidad": "30%"},
      {"nombre": "diagnóstico diferencial 2", "probabilidad": "15%"}
    ]
  },
  "tests": [
    {
      "nombre": "nombre completo del test ortopédico o neurológico",
      "zona": "zona anatómica o articulación evaluada",
      "estructura": "estructura que evalúa el test (ej: ligamento cruzado anterior, nervio ciático)",
      "resultado": "positivo | negativo"
    }
  ]
}

REGLAS IMPORTANTES:
- Si algo no se menciona en la transcripción, usa array vacío [] para listas o "No mencionado" para campos de texto.
- Para banderas_rojas: busca síntomas de alarma como pérdida de peso inexplicada, dolor nocturno que no cede, déficit neurológico progresivo, traumatismo de alta energía, antecedentes oncológicos, fiebre, disfunción de esfínteres, etc.
- Para banderas_amarillas: busca factores psicosociales como catastrofismo, kinesiofobia, baja autoeficacia, factores laborales, depresión/ansiedad, dolor crónico, baja adherencia al tratamiento.
- Para hipotesis: la confianza es un número entre 0 y 1 basado en la cantidad y calidad de información disponible. Sé conservador si la información es escasa.
- Para tests: incluye TODOS los tests mencionados aunque sea de forma implícita (ej: "le hago el Lasègue" → nombre: "Test de Lasègue", estructura: "Nervio ciático / raíz nerviosa lumbar").
- Usa terminología clínica de fisioterapia en español.
- Extrae TODA la información posible aunque esté implícita en la conversación.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 3000,
        temperature: 0.15,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Transcripción de la consulta:\n\n${text}` },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Groq error:", err);
      if (response.status === 429) return res.status(429).json({ error: "Servicio saturado. Inténtalo en unos segundos." });
      return res.status(502).json({ error: "Error al procesar con IA." });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("No JSON found in:", raw.substring(0, 300));
      return res.status(502).json({ error: "Respuesta inesperada de la IA." });
    }

    let parsed;
    try { parsed = JSON.parse(match[0]); }
    catch (e) { console.error("JSON parse error:", e.message); return res.status(502).json({ error: "Error al parsear la respuesta." }); }

    // Ensure all keys exist with defaults
    parsed.historia = parsed.historia || {};
    parsed.soap = parsed.soap || {};
    parsed.banderas_rojas = Array.isArray(parsed.banderas_rojas) ? parsed.banderas_rojas : [];
    parsed.banderas_amarillas = Array.isArray(parsed.banderas_amarillas) ? parsed.banderas_amarillas : [];
    parsed.hipotesis = parsed.hipotesis || {};
    parsed.tests = Array.isArray(parsed.tests) ? parsed.tests : [];

    // Normalize test results to lowercase
    parsed.tests = parsed.tests.map(t => ({
      ...t,
      resultado: (t.resultado || '').toLowerCase().includes('pos') ? 'positivo'
        : (t.resultado || '').toLowerCase().includes('neg') ? 'negativo'
        : t.resultado || '',
    }));

    console.log(`✓ Generated: ${parsed.banderas_rojas.length} red flags, ${parsed.banderas_amarillas.length} yellow flags, ${parsed.tests.length} tests`);
    return res.json(parsed);

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return res.status(504).json({ error: "La IA tardó demasiado. Inténtalo de nuevo." });
    console.error("Error:", err.message);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: "Error interno." }); });

app.listen(PORT, () => {
  console.log(`\n✅  FisioScript API v2.0 en http://localhost:${PORT}`);
  console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? "✓" : "✗ FALTA"}`);
  console.log(`   Nuevos campos: banderas rojas/amarillas, hipótesis, tests clínicos\n`);
});
