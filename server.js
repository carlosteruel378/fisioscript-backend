import express from "express";
import cors from "cors";
import Stripe from "stripe";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Base de conocimiento clínico ─────────────────────────────────────────────
const CLINICAL_DB = {"regions":{"hombro":"Hombro","cadera":"Cadera","lumbar":"Columna Lumbar","tobillo":"Tobillo","codo":"Codo","cervical":"Columna Cervical / Radiculopatía","rodilla":"Rodilla","cuadriceps":"Cuádriceps","aductor":"Aductor / Pubis / Ingle","isquiotibiales":"Isquiotibiales","gemelo":"Gemelo / Gastrocnemio"},"conditions":[{"id":"rct","n":"Rotura del Manguito Rotador","r":"hombro","p":["dolor con rotación externa","debilidad elevación","lag signs positivos"]},{"id":"sis","n":"Síndrome de Impingement Subacromial","r":"hombro","p":["dolor arco doloroso 60-120°","dolor anterosuperior","Neer/Hawkins positivos"]},{"id":"lhbt","n":"Tendinopatía Bíceps Largo (LHBT)","r":"hombro","p":["dolor anterior hombro","dolor surco bicipital","Speed/Yergason positivos"]},{"id":"subescapular","n":"Rotura Subescapular","r":"hombro","p":["debilidad rotación interna","IR lag sign positivo"]},{"id":"inestabilidad_gh","n":"Inestabilidad Glenohumeral","r":"hombro","p":["aprensión anterior","sensación inestabilidad","Apprehension test positivo"]},{"id":"fai","n":"Impingement Femoroacetabular (FAI)","r":"cadera","p":["dolor inguinal","↓ rotación interna","FADDIR positivo","dolor mecánico giro"]},{"id":"labrum_cadera","n":"Lesión Labrum Acetabular","r":"cadera","p":["dolor mecánico","click/chasquido","FADDIR positivo","catching/locking"]},{"id":"oa_cadera","n":"Osteoartritis de Cadera","r":"cadera","p":["rigidez","dolor IR","marcha alterada","limitación global ROM"]},{"id":"gtps","n":"Síndrome Dolor Trocantérico (GTPS)","r":"cadera","p":["dolor lateral cadera","Trendelenburg positivo","dolor palpación trocánter"]},{"id":"iliopsoas","n":"Tendinopatía/Lesión Iliopsoas","r":"cadera","p":["snapping anterior","dolor flexión resistida","palpación ASIS/AIIS dolorosa"]},{"id":"piriforme","n":"Síndrome Piriforme / Deep Gluteal","r":"cadera","p":["dolor glúteo profundo","dolor al sentarse","síntomas ciáticos"]},{"id":"radiculopatia_lumbar","n":"Radiculopatía Lumbar / Ciática","r":"lumbar","p":["dolor irradiado bajo rodilla","numbness dominante","déficit motor miotomal","SLR positivo"]},{"id":"disc_lumbar","n":"Patología Discal Lumbar","r":"lumbar","p":["dolor con flexión/sentado","lifting empeora","centralización/periferización McKenzie"]},{"id":"facetario_lumbar","n":"Dolor Facetario Lumbar","r":"lumbar","p":["dolor con extensión","dolor rotación","medial branch block positivo"]},{"id":"sij","n":"Disfunción Sacroiliaca (SIJ)","r":"lumbar","p":["FABER positivo","Fortin finger sign","cluster ≥3 tests positivos"]},{"id":"ces","n":"Síndrome Cauda Equina","r":"lumbar","p":["anestesia en silla de montar","retención urinaria","déficit motor progresivo"]},{"id":"esguince_atfl","n":"Esguince Lateral ATFL/CFL","r":"tobillo","p":["inversión traumática","dolor lateral","hematoma precoz","drawer positivo"]},{"id":"sindesmosis","n":"Lesión Sindesmosis (High Ankle Sprain)","r":"tobillo","p":["rotación externa trauma","dolor distal tibiofibular","squeeze positivo","marcha protectora"]},{"id":"deltoideo","n":"Esguince Deltoideo / Medial","r":"tobillo","p":["dolor medial","ER + valgus stress","medial clear space widening"]},{"id":"epicondilitis_lateral","n":"Epicondilitis Lateral (Tennis Elbow)","r":"codo","p":["dolor epicóndilo lateral","dolor extensión muñeca resistida","Cozen positivo"]},{"id":"epicondilitis_medial","n":"Epicondilitis Medial (Golfer's Elbow)","r":"codo","p":["dolor epicóndilo medial","dolor flexión/pronación resistida","Golfer test positivo"]},{"id":"cubital_tunnel","n":"Síndrome Túnel Cubital","r":"codo","p":["parestesias dedos 4-5","Tinel canal cubital positivo","debilidad mano"]},{"id":"plri","n":"Inestabilidad Rotatoria Posterolateral (PLRI)","r":"codo","p":["inestabilidad lateral","chair pushup test positivo","pivot shift positivo"]},{"id":"bursitis_olecraniana","n":"Bursitis Olecraniana","r":"codo","p":["tumefacción posterior visible","fluctuación","dolor posterior"]},{"id":"radiculopatia_cervical","n":"Radiculopatía Cervical","r":"cervical","p":["dolor irradiado brazo","parestesias","Spurling positivo","ULNT positivo"]},{"id":"menisco","n":"Rotura Meniscal","r":"rodilla","p":["dolor línea articular","click/bloqueo","Thessaly positivo"]},{"id":"lca","n":"Rotura LCA","r":"rodilla","p":["mecanismo trauma + pop","inestabilidad rotacional","Lachman positivo","pivot shift"]},{"id":"oa_rodilla","n":"Osteoartritis de Rodilla","r":"rodilla","p":["crepitación femorotibial","dolor con movimiento","rigidez","engrosamiento óseo"]},{"id":"pfj","n":"Síndrome Patelofemoral","r":"rodilla","p":["dolor anterior rodilla","lateral glide positivo","crepitación patelar"]},{"id":"rf_lesion","n":"Lesión Recto Femoral (Strain)","r":"cuadriceps","p":["dolor explosivo proximal","pop","dolor extensión resistida","dolor estiramiento pasivo"]},{"id":"rf_tendon_central","n":"Lesión Tendón Central Recto Femoral","r":"cuadriceps","p":["bullseye lesion en MRI","récuperación lenta","alto riesgo recidiva"]},{"id":"contusion_cuadriceps","n":"Contusión Cuádriceps","r":"cuadriceps","p":["golpe directo","limitación flexión rodilla","hematoma intramuscular"]},{"id":"myositis_ossificans","n":"Miositis Osificante (MO)","r":"cuadriceps","p":["inflamación persistente 2-3 semanas","pérdida progresiva ROM","contusión previa severa"]},{"id":"aductor_parcial","n":"Lesión Parcial Aductor Largo","r":"aductor","p":["dolor inguinal","dolor palpación origen aductor","squeeze positivo","dolor resistencia"]},{"id":"aductor_completo","n":"Rotura Completa Aductor","r":"aductor","p":["retracción tendinosa","hematoma significativo","déficit funcional marcado"]},{"id":"pubalgia","n":"Dolor Pubiano / Pubis Related Groin Pain","r":"aductor","p":["dolor palpación sínfisis","coexiste con dolor aductor","cambios degenerativos pubis en RM"]},{"id":"isquio_grado1","n":"Strain Isquiotibiales Grado I","r":"isquiotibiales","p":["dolor leve posterior muslo","sin déficit funcional importante"]},{"id":"isquio_grado2","n":"Strain Isquiotibiales Grado II","r":"isquiotibiales","p":["dolor moderado","déficit fuerza parcial","posible edema"]},{"id":"isquio_grado3","n":"Strain Isquiotibiales Grado III / Avulsión","r":"isquiotibiales","p":["dolor al sentarse","defecto palpable","hematoma severo","pérdida función marcada"]},{"id":"gemelo_leve","n":"Strain Gastrocnemio Medial Leve (Grado I)","r":"gemelo","p":["dolor posteromedial leve","puede caminar","hop test tolerable"]},{"id":"gemelo_moderado","n":"Strain Gastrocnemio Medial Moderado (Grado II)","r":"gemelo","p":["dolor marcha","déficit fuerza","edema/equimosis"]},{"id":"gemelo_severo","n":"Strain Gastrocnemio Medial Severo (Grado III)","r":"gemelo","p":["gap palpable","incapacidad funcional","gran hematoma"]},{"id":"soleo_lesion","n":"Lesión Sóleo","r":"gemelo","p":["dolor profundo posterolateral","sobreuso/running largo","dolor con rodilla flexionada"]}],"tests":[{"n":"External Rotation Lag Sign 90°","r":"hombro","s":"Infraspinoso / Supraespinoso","ro":"confirmar"},{"n":"Internal Rotation Lag Sign","r":"hombro","s":"Subescapular","ro":"confirmar"},{"n":"Drop Arm Test","r":"hombro","s":"Supraespinoso","ro":"apoyo"},{"n":"Jobe / Empty Can","r":"hombro","s":"Supraespinoso","ro":"apoyo"},{"n":"Bear Hug Test","r":"hombro","s":"Subescapular","ro":"apoyo"},{"n":"Lift-off Test","r":"hombro","s":"Subescapular inferior","ro":"apoyo"},{"n":"Neer Impingement Test","r":"hombro","s":"Espacio subacromial","se":0.72,"sp":0.66,"ro":"apoyo"},{"n":"Hawkins-Kennedy Test","r":"hombro","s":"Espacio subacromial","ro":"apoyo"},{"n":"Speed Test","r":"hombro","s":"Tendón bíceps largo","ro":"apoyo"},{"n":"Yergason Test","r":"hombro","s":"LHBT / Subescapular","ro":"apoyo"},{"n":"Apprehension Test Hombro","r":"hombro","s":"Cápsula anterior glenohumeral","ro":"confirmar"},{"n":"Relocation Test (Jobe)","r":"hombro","s":"Cápsula glenohumeral","ro":"confirmar"},{"n":"FADDIR (Flexión + ADD + IR)","r":"cadera","s":"Impingement anterosuperior / Labrum","ro":"confirmar"},{"n":"FABER Test","r":"cadera","s":"Intraarticular / SIJ / flexores","ro":"apoyo"},{"n":"Scour Test","r":"cadera","s":"Superficie acetabular","ro":"apoyo"},{"n":"Log Roll Test","r":"cadera","s":"Patología intraarticular pura","ro":"confirmar"},{"n":"Trendelenburg Test","r":"cadera","s":"Glúteo medio / abductores","ro":"confirmar"},{"n":"Thomas Test","r":"cadera","s":"Iliopsoas","ro":"apoyo"},{"n":"Deep Squat Test","r":"cadera","s":"FAI funcional","ro":"apoyo"},{"n":"SLR (Straight Leg Raise)","r":"lumbar","s":"Tensión radicular L4-S1","se":0.8,"sp":0.4,"ro":"descartar"},{"n":"Crossed SLR","r":"lumbar","s":"Hernia discal significativa","se":0.28,"sp":0.9,"ro":"confirmar"},{"n":"Slump Test","r":"lumbar","s":"Tensión neural global","ro":"apoyo"},{"n":"FABER (SIJ)","r":"lumbar","s":"Sacroiliaco","ro":"apoyo"},{"n":"Fortin Finger Sign","r":"lumbar","s":"SIJ","ro":"apoyo"},{"n":"Anterior Drawer Test Tobillo","r":"tobillo","s":"ATFL","ro":"confirmar"},{"n":"Anterolateral Drawer Test","r":"tobillo","s":"Inestabilidad rotatoria ATFL","ro":"confirmar"},{"n":"Inversion Stress / Talar Tilt","r":"tobillo","s":"CFL ± ATFL","ro":"confirmar"},{"n":"Ottawa Ankle Rules","r":"tobillo","s":"Hueso / fractura","se":0.99,"ro":"descartar"},{"n":"Squeeze Test (Sindesmosis)","r":"tobillo","s":"Sindesmosis tibiofibular","ro":"confirmar"},{"n":"External Rotation Test Tobillo","r":"tobillo","s":"Sindesmosis","ro":"confirmar"},{"n":"Cozen Test","r":"codo","s":"Epicóndilo lateral / ECRB","ro":"confirmar"},{"n":"Test de Golfer (Golfer's Elbow Test)","r":"codo","s":"Epicóndilo medial","ro":"confirmar"},{"n":"Tinel Canal Cubital","r":"codo","s":"Nervio cubital","ro":"apoyo"},{"n":"Valgus Stress Test Codo","r":"codo","s":"Ligamento colateral medial","ro":"apoyo"},{"n":"Chair Pushup Test","r":"codo","s":"PLRI","ro":"apoyo"},{"n":"Spurling Test","r":"cervical","s":"Raíz nerviosa cervical","se":0.6,"sp":0.94,"ro":"confirmar"},{"n":"ULNT1 (Mediano)","r":"cervical","s":"Nervio mediano / tensión neural","se":0.7,"sp":0.71,"ro":"apoyo"},{"n":"ULNT 4 Combinados (≥1 positivo)","r":"cervical","s":"Sensibilización neural global","se":0.97,"sp":0.51,"ro":"descartar"},{"n":"Shoulder Abduction Relief Test","r":"cervical","s":"Alivio radicular","se":0.49,"sp":0.76,"ro":"apoyo"},{"n":"Thessaly Test (20°)","r":"rodilla","s":"Menisco medial/lateral","ro":"apoyo"},{"n":"McMurray Test","r":"rodilla","s":"Menisco","ro":"apoyo"},{"n":"Lachman Test","r":"rodilla","s":"LCA","ro":"confirmar"},{"n":"Pivot Shift Test","r":"rodilla","s":"Inestabilidad rotacional LCA","ro":"confirmar"},{"n":"Lateral Glide Patelar","r":"rodilla","s":"Tracking patelar","ro":"apoyo"},{"n":"Dolor con extensión resistida (cuádriceps)","r":"cuadriceps","s":"Recto femoral / cuádriceps","ro":"apoyo"},{"n":"Resisted knee extension + hip flexion","r":"cuadriceps","s":"Recto femoral biarticular","ro":"confirmar"},{"n":"Flexión rodilla post-contusión","r":"cuadriceps","s":"Severidad contusión","ro":"confirmar"},{"n":"Squeeze Test 90°","r":"aductor","s":"Aductor relacionado","ro":"apoyo"},{"n":"Squeeze Test 0°","r":"aductor","s":"Aductor relacionado","ro":"apoyo"},{"n":"Resisted Adduction in Maximal Abduction","r":"aductor","s":"Aductor funcional","ro":"confirmar"},{"n":"Palpación origen adductor longus","r":"aductor","s":"Adductor longus proximal","ro":"confirmar"},{"n":"Bent-knee Stretch Test","r":"isquiotibiales","s":"Lesión proximal isquiotibiales","ro":"apoyo"},{"n":"Puranen-Orava Test","r":"isquiotibiales","s":"Tendinopatía/strain proximal","ro":"apoyo"},{"n":"Palpación dolorosa posterior muslo","r":"isquiotibiales","s":"Zona lesionada","ro":"apoyo"},{"n":"Dorsiflexión pasiva (rodilla extendida)","r":"gemelo","s":"Gastrocnemio / tensión muscular","ro":"confirmar"},{"n":"Heel Raise Rodilla Extendida","r":"gemelo","s":"Gastrocnemio","ro":"confirmar"},{"n":"Heel Raise Rodilla Flexionada","r":"gemelo","s":"Sóleo","ro":"confirmar"},{"n":"Thompson Test","r":"gemelo","s":"Tendón de Aquiles","ro":"confirmar"},{"n":"Single-leg Hop Test","r":"gemelo","s":"Función deportiva","ro":"apoyo"}],"red_flags":[{"n":"Anestesia en silla de montar","sug":"Síndrome Cauda Equina","urg":"emergencia","act":"Derivación urgente a urgencias hospitalarias"},{"n":"Retención urinaria aguda","sug":"Síndrome Cauda Equina","urg":"emergencia","act":"Derivación urgente a urgencias hospitalarias"},{"n":"Déficit motor progresivo","sug":"Compresión neural severa","urg":"urgente","act":"Derivación médica urgente"},{"n":"Fiebre + dolor lumbar","sug":"Infección espinal / Discitis","urg":"urgente","act":"Derivación médica"},{"n":"Cáncer previo + dolor nocturno + pérdida peso","sug":"Metástasis vertebral","urg":"urgente","act":"Derivación oncológica / médica urgente"},{"n":"Trauma + osteoporosis + edad avanzada","sug":"Fractura vertebral","urg":"urgente","act":"Radiografía urgente"},{"n":"Incapacidad absoluta de carga + Ottawa +","sug":"Fractura significativa","urg":"urgente","act":"Radiografía urgente (Ottawa Rules)"},{"n":"Dolor proximal peroné post-trauma tobillo","sug":"Fractura Maisonneuve","urg":"urgente","act":"Radiografía tibia-peroné completa"},{"n":"Bursitis + fiebre","sug":"Bursitis séptica","urg":"urgente","act":"Derivación médica urgente / antibioterapia"},{"n":"Hinchazón aguda post-trauma + deformidad","sug":"Luxación / fractura codo","urg":"emergencia","act":"Urgencias"},{"n":"Edema difuso + cordón + signos vasculares","sug":"TVP (Trombosis Venosa Profunda)","urg":"emergencia","act":"Derivación urgente a medicina interna / urgencias"},{"n":"Dolor desproporcionado + tensión compartimento","sug":"Síndrome compartimental","urg":"emergencia","act":"Urgencias quirúrgicas"},{"n":"Thompson positivo + pérdida plantarflexión","sug":"Rotura tendón Aquiles","urg":"urgente","act":"Derivación cirugía ortopédica"}],"recovery":{"esguince_atfl":[{"g":"grado_1","min":7,"max":14,"l":"1-2 semanas"},{"g":"grado_2","min":21,"max":42,"l":"3-6 semanas"},{"g":"grado_3","min":42,"max":84,"l":"6-12 semanas"}],"gemelo_leve":[{"g":"grado_1","min":7,"max":14,"l":"1-2 semanas"}],"gemelo_moderado":[{"g":"grado_2","min":14,"max":42,"l":"2-6 semanas"}],"gemelo_severo":[{"g":"grado_3","min":42,"max":120,"l":"6 semanas - 4 meses"}],"isquio_grado1":[{"g":"grado_1","min":7,"max":21,"l":"1-3 semanas"}],"isquio_grado2":[{"g":"grado_2","min":21,"max":56,"l":"3-8 semanas"}],"isquio_grado3":[{"g":"grado_3","min":60,"max":120,"l":"2-4 meses"},{"g":"avulsion","min":120,"max":200,"l":"4-7 meses"}],"rf_lesion":[{"g":"miofascial","min":14,"max":21,"l":"2-3 semanas"},{"g":"periférica","min":7,"max":12,"l":"~9 días"}],"rf_tendon_central":[{"g":"tendon_central","min":27,"max":35,"l":"27-35 días (mínimo)"},{"g":"tenodesis","min":84,"max":90,"l":"~12 semanas"}],"aductor_parcial":[{"g":"parcial","min":7,"max":48,"l":"1-7 semanas"}],"aductor_completo":[{"g":"completo","min":60,"max":65,"l":"~8-9 semanas"},{"g":"completo","min":90,"max":100,"l":"~14 semanas"}]},"rtp":{"isquio_grado1":["Marcha sin dolor","Fuerza ≥90% lado sano","Sprint sin síntomas"],"isquio_grado2":["Marcha sin dolor","Fuerza ≥90% lado sano","ROM bilateral simétrico","Tolerancia ejercicios excéntricos"],"isquio_grado3":["Fuerza ≥90% lado sano","Sprint sin síntomas","Ratio H/Q 50-60%"],"gemelo_leve":["Caminar sin cojera","15 heel raises tolerables"],"gemelo_moderado":["Heel raises simétricos","Running sin cojera","Fuerza <10% asimetría"],"gemelo_severo":["Hopping normal bilateral","Sprint y cambio dirección tolerados","Confianza psicológica adecuada"],"aductor_parcial":["Squeeze test sin dolor","Sprint y cambio dirección sin dolor"],"rf_lesion":["ROM completo","Fuerza casi simétrica","Sprint/kick sin dolor"]}};

// Precompute useful lookups
const conditionMap = {};
CLINICAL_DB.conditions.forEach(c => { conditionMap[c.id] = c; });
const testsByRegion = {};
CLINICAL_DB.tests.forEach(t => {
  if (!testsByRegion[t.r]) testsByRegion[t.r] = [];
  testsByRegion[t.r].push(t);
});

// ── Stripe ───────────────────────────────────────────────────────────────────
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// ── Rate limiting ────────────────────────────────────────────────────────────
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

// ── Security + CORS ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

const allowedOrigins = [
  "http://localhost:3000","http://localhost:5500",
  "http://127.0.0.1:5500","http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error("CORS no permitido")),
}));

app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now()-start}ms`));
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({
  status: "ok", service: "FisioScript API v3.0",
  clinical_db: { conditions: CLINICAL_DB.conditions.length, tests: CLINICAL_DB.tests.length, red_flags: CLINICAL_DB.red_flags.length },
}));

// ── Build clinical context for prompt ────────────────────────────────────────
function buildClinicalContext() {
  const regions = Object.entries(CLINICAL_DB.regions).map(([id, name]) => `${id}: ${name}`).join(', ');
  const conditions = CLINICAL_DB.conditions.map(c => `[${c.id}] ${c.n} (${c.r}) → patrones: ${(c.p||[]).join('; ')}`).join('\n');
  const tests = CLINICAL_DB.tests.map(t => {
    let s = `${t.n} (${t.r}) → ${t.s}`;
    if (t.se) s += ` | Sens:${t.se}`;
    if (t.sp) s += ` Spec:${t.sp}`;
    if (t.ro) s += ` | ${t.ro}`;
    return s;
  }).join('\n');
  const redFlags = CLINICAL_DB.red_flags.map(r => `${r.n} → ${r.sug} (${r.urg}) → ${r.act}`).join('\n');
  const recovery = Object.entries(CLINICAL_DB.recovery).map(([cid, rts]) => {
    const cond = conditionMap[cid];
    return `${cond ? cond.n : cid}: ${rts.map(r => `${r.g||''}:${r.min}-${r.max}d(${r.l})`).join(', ')}`;
  }).join('\n');

  return `
=== BASE DE CONOCIMIENTO CLÍNICO FISIOSCRIPT ===

REGIONES: ${regions}

CONDICIONES CLÍNICAS (${CLINICAL_DB.conditions.length}):
${conditions}

TESTS CLÍNICOS CON EVIDENCIA (${CLINICAL_DB.tests.length}):
${tests}

BANDERAS ROJAS (${CLINICAL_DB.red_flags.length}):
${redFlags}

TIEMPOS DE RECUPERACIÓN:
${recovery}
=================================================`;
}

const CLINICAL_CONTEXT = buildClinicalContext();

// ── POST /api/generate ───────────────────────────────────────────────────────
app.post("/api/generate", rateLimit(20, 60_000), async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") return res.status(400).json({ error: "El campo 'text' es requerido." });
  if (text.trim().length < 10) return res.status(400).json({ error: "Transcripción demasiado corta." });
  if (text.length > 15_000) return res.status(400).json({ error: "Transcripción demasiado larga." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Servidor mal configurado." });

  const system = `Eres un fisioterapeuta clínico experto con acceso a una base de conocimiento clínico validada.

${CLINICAL_CONTEXT}

INSTRUCCIONES:
Analiza la transcripción usando tu conocimiento clínico Y la base de datos anterior.
Para los tests detectados, busca si están en la lista y usa sus datos de sensibilidad/especificidad.
Para las banderas rojas, cruza los síntomas mencionados con la lista de red flags.
Para la hipótesis, usa los patrones clínicos de las condiciones para calcular la confianza.
Para recuperación, usa los tiempos de la base de datos si el diagnóstico coincide.

Devuelve ÚNICAMENTE este JSON exacto, sin markdown:
{
  "historia": {
    "motivo": "motivo detallado con localización, inicio y características",
    "edad": "edad y datos demográficos (profesión, actividad)",
    "antecedentes": "antecedentes médicos, lesiones previas, cirugías",
    "medicacion": "medicación actual, alergias, suplementos",
    "deporte": "actividad física, nivel, frecuencia, postura laboral",
    "exploracion": "exploración física: postura, ROM, palpación, fuerza, EVA",
    "tratamiento": "técnicas aplicadas, ejercicios, pautas domiciliarias",
    "observaciones": "evolución, pronóstico, factores psicosociales, objetivos"
  },
  "soap": {
    "S": "síntomas subjetivos: queja principal, dolor (EVA, localización, irradiación, agravantes/aliviantes)",
    "O": "hallazgos objetivos: postura, ROM con grados, tests y resultado, palpación, fuerza",
    "A": "evaluación: diagnóstico fisioterápico, estructuras afectadas, severidad, estadio",
    "P": "plan: técnicas con dosis, ejercicios, objetivos, próxima cita"
  },
  "banderas_rojas": [
    {
      "titulo": "nombre corto",
      "descripcion": "explicación clínica usando la base de datos si aplica",
      "severidad": "alta | media",
      "accion": "acción concreta recomendada"
    }
  ],
  "banderas_amarillas": [
    {
      "titulo": "nombre corto",
      "descripcion": "factor psicosocial o riesgo cronificación",
      "severidad": "media | baja",
      "accion": "enfoque recomendado"
    }
  ],
  "hipotesis": {
    "principal": "diagnóstico más probable (usa nombre exacto de condición si está en la base de datos)",
    "condition_id": "id de la condición si coincide con alguna en la base de datos, o null",
    "confianza": 0.75,
    "razonamiento": "razonamiento clínico basado en patrones y tests detectados",
    "diferenciales": [
      {"nombre": "diagnóstico diferencial 1", "probabilidad": "30%"},
      {"nombre": "diagnóstico diferencial 2", "probabilidad": "15%"}
    ]
  },
  "tests": [
    {
      "nombre": "nombre completo del test",
      "zona": "zona anatómica",
      "estructura": "estructura evaluada",
      "resultado": "positivo | negativo",
      "sensibilidad": "valor si está en base de datos o null",
      "especificidad": "valor si está en base de datos o null",
      "interpretacion": "qué significa clínicamente en este caso"
    }
  ],
  "recuperacion": {
    "estimacion": "tiempo estimado de recuperación basado en diagnóstico y base de datos",
    "fase_actual": "agudo | subagudo | crónico | rehabilitación | vuelta_actividad",
    "criterios_rts": ["criterio 1", "criterio 2", "criterio 3"],
    "factores_riesgo": ["factor de riesgo 1 si aplica"],
    "notas": "consideraciones específicas del caso"
  }
}

REGLAS:
- Si algo no se menciona: usa [] para listas o "No mencionado" para texto.
- condition_id: pon el id de la base de datos si el diagnóstico coincide, si no pon null.
- Para tests ya en la base de datos, incluye sensibilidad y especificidad.
- Para recuperación, si el condition_id coincide con la base de datos, usa esos tiempos.
- Sé exhaustivo y usa terminología clínica de fisioterapia en español.`;

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
        max_tokens: 3500,
        temperature: 0.1,
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
      if (response.status === 429) return res.status(429).json({ error: "Servicio saturado. Inténtalo en unos segundos." });
      return res.status(502).json({ error: "Error al procesar con IA." });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: "Respuesta inesperada de la IA." });

    let parsed;
    try { parsed = JSON.parse(match[0]); }
    catch (e) { return res.status(502).json({ error: "Error al parsear la respuesta." }); }

    // Defaults
    parsed.historia = parsed.historia || {};
    parsed.soap = parsed.soap || {};
    parsed.banderas_rojas = Array.isArray(parsed.banderas_rojas) ? parsed.banderas_rojas : [];
    parsed.banderas_amarillas = Array.isArray(parsed.banderas_amarillas) ? parsed.banderas_amarillas : [];
    parsed.hipotesis = parsed.hipotesis || {};
    parsed.tests = Array.isArray(parsed.tests) ? parsed.tests : [];
    parsed.recuperacion = parsed.recuperacion || {};

    // Enrich recovery from DB if condition_id matched
    const cid = parsed.hipotesis?.condition_id;
    if (cid && CLINICAL_DB.recovery[cid]) {
      parsed.recuperacion._db_times = CLINICAL_DB.recovery[cid];
    }
    if (cid && CLINICAL_DB.rtp[cid]) {
      parsed.recuperacion._db_rtp = CLINICAL_DB.rtp[cid];
    }

    // Normalize test results
    parsed.tests = parsed.tests.map(t => ({
      ...t,
      resultado: (t.resultado||'').toLowerCase().includes('pos') ? 'positivo'
        : (t.resultado||'').toLowerCase().includes('neg') ? 'negativo'
        : t.resultado || '',
    }));

    console.log(`✓ ${parsed.banderas_rojas.length} red flags | ${parsed.tests.length} tests | cond_id: ${cid||'null'}`);
    return res.json(parsed);

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return res.status(504).json({ error: "La IA tardó demasiado. Inténtalo de nuevo." });
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /api/clinical/condition/:id ─────────────────────────────────────────
app.get("/api/clinical/condition/:id", (req, res) => {
  const cid = req.params.id;
  const cond = conditionMap[cid];
  if (!cond) return res.status(404).json({ error: "Condición no encontrada." });
  const recovery = CLINICAL_DB.recovery[cid] || [];
  const rtp = CLINICAL_DB.rtp[cid] || [];
  const tests = CLINICAL_DB.tests.filter(t => {
    // find tests related to this condition via region
    return t.r === cond.r;
  });
  res.json({ condition: cond, recovery, rtp, tests: tests.slice(0,10) });
});

// ── GET /api/clinical/region/:id ────────────────────────────────────────────
app.get("/api/clinical/region/:id", (req, res) => {
  const rid = req.params.id;
  const conditions = CLINICAL_DB.conditions.filter(c => c.r === rid);
  const tests = testsByRegion[rid] || [];
  const redFlags = CLINICAL_DB.red_flags.filter(r => r.r === rid);
  res.json({ region: CLINICAL_DB.regions[rid], conditions, tests, red_flags: redFlags });
});

// ── POST /api/stripe/checkout ────────────────────────────────────────────────
app.post("/api/stripe/checkout", rateLimit(10, 60_000), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no está configurado." });
  const { priceId, email } = req.body;
  if (!priceId) return res.status(400).json({ error: "priceId requerido." });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL||"https://fisioscript.com"}/exito.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL||"https://fisioscript.com"}/precios.html`,
      locale: "es",
      allow_promotion_codes: true,
    });
    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: "Error al crear la sesión de pago." });
  }
});

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────
app.post("/api/stripe/webhook", async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no configurado." });
  const sig = req.headers["stripe-signature"];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send(`Webhook error: ${err.message}`); }
  console.log(`Stripe: ${event.type}`);
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.customer_email;
      const priceId = session.line_items?.data?.[0]?.price?.id || '';

      // Map price IDs to plan names
      const planMap = {
        'price_1TWFFrPOSeyVBgtaKHKpCA7T': 'individual_mensual',
        'price_1TWFFrPOSeyVBgta0XkvT9EZ': 'individual_anual',
        'price_1TWFFrPOSeyVBgtahQl9oQvJ': 'clinica_mensual',
        'price_1TWFFtPOSeyVBgtaN7yiBmPT': 'clinica_anual',
      };
      const plan = planMap[priceId] || 'individual_mensual';

      console.log(`✓ Pago completado: ${email} → ${plan}`);

      // Update user metadata in Supabase via Admin API
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        try {
          // Find user by email
          const usersRes = await fetch(
            `${process.env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
            { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
          );
          const usersData = await usersRes.json();
          const userId = usersData?.users?.[0]?.id;
          if (userId) {
            await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
              },
              body: JSON.stringify({ user_metadata: { plan } })
            });
            console.log(`✓ Plan actualizado en Supabase: ${userId} → ${plan}`);
          }
        } catch(e) {
          console.error('Error actualizando plan en Supabase:', e.message);
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      console.log(`✗ Suscripción cancelada: ${event.data.object.customer}`);
      break;
    }
  }
  return res.json({ received: true });
});

// ── Handlers ──────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: "Error interno." }); });

app.listen(PORT, () => {
  console.log(`\n✅  FisioScript API v3.0 → http://localhost:${PORT}`);
  console.log(`   GROQ_API_KEY:    ${process.env.GROQ_API_KEY ? "✓" : "✗ FALTA"}`);
  console.log(`   STRIPE:          ${process.env.STRIPE_SECRET_KEY ? "✓" : "✗ no configurado"}`);
  console.log(`   Clinical DB:     ${CLINICAL_DB.conditions.length} condiciones | ${CLINICAL_DB.tests.length} tests | ${CLINICAL_DB.red_flags.length} red flags\n`);
});
