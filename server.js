// Sentry se inicializa vía `node --import ./instrument.js` (ver package.json),
// lo que garantiza que instrumente Express ANTES de que arranque. Aquí solo
// importamos la API de Sentry para la captura manual de errores.
import * as Sentry from "@sentry/node";

import express from "express";
import cors from "cors";
import Stripe from "stripe";
import "dotenv/config";

const app = express();
app.set('trust proxy', 1); // Railway: req.ip = IP real del cliente, no la del proxy
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════════════════════════
// BASE DE CONOCIMIENTO CLÍNICO FISIOSCRIPT v4.0 (13 regiones, 34 patologías, 99 tests)
// Expandida con: fases clínicas, RTS, factores recaída, técnicas manuales, ejercicio, educación
const CLINICAL_KB = {"regions":{"hombro":"Hombro","cadera":"Cadera","lumbar":"Columna Lumbar","toracico":"Columna Torácica / Espalda Alta","tobillo":"Tobillo","pie":"Pie","codo":"Codo","cervical":"Columna Cervical / Radiculopatía","rodilla":"Rodilla","rodilla_akp":"Dolor Anterior de Rodilla (AKP/Patelofemoral)","cuadriceps":"Cuádriceps","aductor":"Aductor / Ingle","isquiotibiales":"Isquiotibiales","gemelo":"Gemelo / Pantorrilla"},"conditions":[{"id":"rct_manguito","r":"hombro","n":"Rotura Manguito Rotador","p":["dolor lateral hombro","dolor nocturno","debilidad rotación externa","incapacidad elevación"],"rts_days":[90,270],"fases":[{"n":"Aguda","c":"Dolor nocturno, debilidad marcada"},{"n":"Subaguda","c":"Dolor disminuye, fuerza limitada"},{"n":"Remodelación","c":"Recupera ROM y fuerza"},{"n":"Funcional","c":"Fuerza >90% lado sano"}],"criterios_rts":["ROM completo o funcional","Fuerza ≥90–95% contralateral","ER/IR ratio normalizado","Sin dolor nocturno","Sin compensaciones escapulares"],"factores_recaida":["Debilidad rotadores externos","Déficit escapular persistente","Retorno precoz","Diabetes","Tabaquismo","Mala adherencia"],"tecnicas_manuales":["Movilización GH posterior","Movilización inferior GH","Movilidad torácica","Liberación pectoral menor","Movilización escapular"],"ejercicio":{"inicial":["Pendulares","Isométricos ER/IR","Scapular setting"],"intermedio":["ER con banda","Remo","Elevaciones escapulares"],"avanzado":["Press","Lanzamientos","Trabajo pliométrico"]},"educacion":["El dolor no equivale a daño estructural","Muchas roturas son asintomáticas","La carga progresiva es segura","La fuerza predice mejor función que la imagen"],"tratamiento":"Fisioterapia progresiva: rotadores externos + estabilidad escapular. Cirugía si rotura completa en atleta élite o fallo conservador."},{"id":"sis_impingement","r":"hombro","n":"Síndrome Subacromial (SIS)","p":["dolor arco 60-120°","dolor con elevación","painful arc","déficit escapular"],"rts_days":[42,120],"fases":[{"n":"Irritable","c":"Dolor con elevación"},{"n":"Subaguda","c":"Mejor tolerancia"},{"n":"Funcional","c":"Dolor mínimo"}],"criterios_rts":["Elevación completa","Fuerza ≥90%","Dolor ≤2/10","Sin painful arc funcional"],"factores_recaida":["Sobrecarga repetitiva overhead","Escápula discinética","Debilidad manguito","Déficit torácico"],"tecnicas_manuales":["Movilidad torácica","GH posterior","Escapulotorácica","Liberación pectoral menor"],"ejercicio":{"inicial":["Serrato anterior","Scapular setting"],"intermedio":["Trapecio inferior","Rotadores externos","Wall slides"],"avanzado":["Push-up plus","Press funcional"]},"educacion":["Impingement no implica atrapamiento permanente","La mayoría mejora sin cirugía","El ejercicio es el tratamiento principal"],"tratamiento":"Ejercicio terapéutico, corrección postura escapular, evitar compresión. Terapia manual adyuvante."},{"id":"inestabilidad_gh","r":"hombro","n":"Inestabilidad Glenohumeral","p":["sensación luxación","apprehension","dolor joven deportista","trauma previo"],"rts_days":[90,270],"fases":[{"n":"Aguda","c":"Aprensión marcada"},{"n":"Recuperación","c":"Menor sensación de escape"},{"n":"Funcional","c":"Control dinámico"}],"criterios_rts":["Sin apprehension","Fuerza ≥90–95%","Control dinámico completo","CKCUEST normal"],"factores_recaida":["Edad <25 años","Deportes contacto","Hiperlaxitud","Déficit manguito","Déficit control escapular"],"tecnicas_manuales":["Movilizaciones suaves GH","Movilidad torácica","Escapulotorácica"],"ejercicio":{"inicial":["Isométricos","Scapular setting"],"intermedio":["ER/IR banda","Remo","Serrato anterior"],"avanzado":["Body blade","Lanzamientos","Pliometría"]},"educacion":["Evitar miedo al movimiento","Comprender mecanismos de luxación","Reintroducir carga progresivamente"],"tratamiento":"Estabilizadores dinámicos. Cirugía si recidivante o déficit estructural significativo."},{"id":"tendinopatia_biceps","r":"hombro","n":"Tendinopatía Bíceps Largo (LHBT)","p":["dolor anterior hombro","dolor surco bicipital","Speed positivo","dolor flexión codo resistida"],"rts_days":[42,120],"fases":[{"n":"Reactiva","c":"Dolor carga"},{"n":"Disrepair","c":"Dolor persistente"},{"n":"Degenerativa","c":"Crónica"}],"criterios_rts":["Sin dolor en Speed","Fuerza flexión/supinación ≥90%","Tolerancia overhead"],"factores_recaida":["Sobrecarga lanzamiento","Déficit escapular","Manguito débil"],"tecnicas_manuales":["Surco bicipital","Pectoral menor","Movilidad torácica"],"ejercicio":{"inicial":["Isométricos flexión"],"intermedio":["Curl progresivo","Supinación resistida"],"avanzado":["Heavy slow resistance"]},"educacion":["Tendón responde a carga progresiva","Reposo absoluto empeora capacidad"],"tratamiento":"Gestión carga, isométricos, Heavy Slow Resistance. Infiltración si crónico."},{"id":"fai_labrum","r":"cadera","n":"FAI / Lesión Labrum Acetabular","p":["dolor inguinal","dolor con flexión cadera","limitación rotación interna","dolor salida coche"],"rts_days":[60,180],"fases":[{"n":"Irritable","c":"Dolor actividades diarias"},{"n":"Subaguda","c":"Dolor mecánico intermitente"},{"n":"Funcional","c":"Síntomas con carga alta"},{"n":"Crónica","c":"Rigidez persistente"}],"criterios_rts":["ROM funcional completo","FADDIR negativo o mínimamente sintomático","Fuerza abductores ≥90%","Single-leg squat controlado","Tolerancia carrera/salto"],"factores_recaida":["Déficit rotación interna","Persistencia impingement óseo","Déficit glúteo medio","Retorno precoz","Hipermovilidad asociada"],"tecnicas_manuales":["Distracción coxofemoral","Movilización posterior","Movilización inferior","Movilidad cápsula posterior","Movilidad lumbar/torácica"],"ejercicio":{"inicial":["Isométricos abductores","Puentes","Control pélvico"],"intermedio":["Clamshell","Monster walks","Split squat"],"avanzado":["Sentadilla profunda","Carrera progresiva","Saltos"]},"educacion":["El FAI radiológico no siempre produce síntomas","La movilidad y la fuerza son modificables","La cirugía no siempre es necesaria"],"tratamiento":"Control motor cadera-core. Artroscopia si fallo conservador >6 meses."},{"id":"gtps_gluteo","r":"cadera","n":"Tendinopatía Glútea / GTPS (Glúteo Medio-Mínimo)","p":["dolor lateral cadera","dolor trocánter mayor","dolor nocturno al dormir de lado","dolor apoyo monopodal","empeora cruce piernas","dolor escaleras o cuestas","Trendelenburg positivo"],"rts_days":[42,365],"fases":[{"n":"Irritable","c":"Dolor frecuente, nocturno, baja tolerancia a la carga"},{"n":"Subaguda","c":"Dolor intermitente, mejor tolerancia"},{"n":"Crónica","c":">3 meses, debilidad abductora y alteración motora"}],"criterios_rts":["Dolor ≤2/10 durante actividad","Sin incremento de síntomas 24h después","Single Leg Stance ≥30s sin dolor significativo","Single-leg squat controlado sin caída pélvica","Fuerza abductores ≥90%","Carrera sin incremento de síntomas"],"factores_recaida":["Aducción excesiva de cadera persistente","Pelvic drop contralateral","Debilidad glúteo medio","Dominancia TFL/ITB","Incremento brusco de carga","Dormir sobre el lado afectado","Running crossover (cruce de línea media)","Coxa vara","Obesidad"],"tecnicas_manuales":["Movilización cadera","Movilización lumbopélvica","Tejidos blandos TFL","Educación postural"],"ejercicio":{"inicial":["Isométricos abductores","Puente bilateral","Puente unilateral asistido","Side plank modificado"],"intermedio":["Clamshell progresado","Step-down","Split squat","Marcha lateral"],"avanzado":["Single-leg squat","Carrera progresiva","Cambios de dirección","Saltos y pliometría"]},"educacion":["La 'bursitis trocantérica' suele ser en realidad una tendinopatía glútea","El mecanismo lesivo es compresión + tensión del tendón, no solo inflamación","Evitar cruzar las piernas y dormir sobre el lado doloroso","Evitar estiramientos agresivos de la banda iliotibial","Evitar 'colgarse' sobre una cadera en bipedestación","La carga progresiva de los abductores es el tratamiento principal","El control frontal de la pelvis (evitar la caída pélvica) es clave"],"tratamiento":"Carga progresiva de abductores (isométricos→funcional). Reducir compresión (evitar aducción mantenida). Reeducación del control pélvico frontal. Corticoide solo alivio corto plazo (no modifica la causa). Ondas de choque o cirugía si rotura/refractario. Single Leg Stance es el mejor test diagnóstico."},{"id":"oa_cadera","r":"cadera","n":"Osteoartritis de Cadera","p":["rigidez matutina","dolor IR y flexión","marcha antálgica","limitación ROM global"],"rts_days":[null,null],"fases":[{"n":"Temprana","c":"Dolor esfuerzo"},{"n":"Moderada","c":"Rigidez progresiva"},{"n":"Avanzada","c":"Limitación funcional"}],"criterios_rts":["Mantener independencia funcional","Caminar sin reagudización significativa"],"factores_recaida":["Sedentarismo","Obesidad","Déficit fuerza","Miedo al movimiento"],"tecnicas_manuales":["Movilidad articular","Distracción coxofemoral","Movilidad tejidos blandos"],"ejercicio":{"inicial":["Sit-to-stand","Sentadilla parcial"],"intermedio":["Bicicleta","Marcha"],"avanzado":["Ejercicio aeróbico progresivo"]},"educacion":["Movimiento seguro","Dolor no es daño progresivo inmediato","El ejercicio es primera línea"],"tratamiento":"Ejercicio aeróbico + fuerza. Pérdida peso. Artroplastia si incapacitante."},{"id":"radiculopatia_lumbar","r":"lumbar","n":"Radiculopatía Lumbar / Ciática","p":["dolor irradiado pierna","parestesias bajo rodilla","SLR positivo","déficit neurológico"],"rts_days":[42,180],"fases":[{"n":"Aguda (0–6 sem)","c":"Dolor irradiado intenso, neuroinflamación"},{"n":"Subaguda (6–12 sem)","c":"Mejora progresiva, persistencia neural"},{"n":"Crónica (>12 sem)","c":"Sensibilización, miedo al movimiento frecuente"}],"criterios_rts":["Dolor ≤2/10","SLR funcional sin empeoramiento","Fuerza ≥90% lado sano","Caminar/correr sin síntomas progresivos","Sin déficits neurológicos progresivos"],"factores_recaida":["Tabaquismo","Obesidad","Sedentarismo","Miedo al movimiento","Cargas mal gestionadas","Exposición repetida a flexión + carga"],"tecnicas_manuales":["Movilizaciones neurodinámicas","Movilización lumbar suave","Terapia manual adyuvante"],"ejercicio":{"inicial":["Walking program","McKenzie si centraliza"],"intermedio":["Estabilización lumbar"],"avanzado":["Fuerza progresiva global"]},"educacion":["Evitar reposo prolongado","La mayoría mejoran sin cirugía","Dolor no es daño","Mantener actividad graduada"],"tratamiento":"Neurodinamia, control motor, educación dolor. Epidural si severo. Cirugía si CES o déficit motor progresivo."},{"id":"dolor_lumbar_mecanico","r":"lumbar","n":"Dolor Lumbar Mecánico","p":["dolor lumbar posicional","sin irradiación","centralización McKenzie","mejora movimiento"],"rts_days":[14,56],"fases":[{"n":"Aguda","c":"Bloqueo y dolor movimiento"},{"n":"Subaguda","c":"Mejora ROM"},{"n":"Remodelación","c":"Recuperación funcional"}],"criterios_rts":["ROM funcional","Tolerancia sedestación","Levantar cargas sin reagudización","Capacidad laboral completa"],"factores_recaida":["Desacondicionamiento","Estrés","Trabajo sedentario","Baja fuerza tronco"],"tecnicas_manuales":["Movilización lumbar","Manipulación HVLA casos seleccionados","Movilización torácica"],"ejercicio":{"inicial":["McGill Big Three"],"intermedio":["Fuerza global","Bisagra cadera"],"avanzado":["Acondicionamiento aeróbico"]},"educacion":["Evitar miedo al movimiento","Promover exposición gradual","Fomentar autonomía"],"tratamiento":"Ejercicio activo, McKenzie si centralización. Manipulación en agudo. Evitar reposo."},{"id":"sij_sacroiliaco","r":"lumbar","n":"Disfunción Sacroiliaca (SIJ)","p":["dolor zona SIJ","Fortin sign","dolor glúteo","cluster 3 tests positivos"],"rts_days":[28,84],"fases":[{"n":"Irritación","c":"Dolor localizado"},{"n":"Subaguda","c":"Mejor tolerancia carga"},{"n":"Funcional","c":"Recuperación completa"}],"criterios_rts":["Caminar sin dolor","Tolerar carrera","Pruebas unipodales normales"],"factores_recaida":["Embarazo/postparto","Hipermovilidad","Déficit glúteo medio","Asimetrías de carga"],"tecnicas_manuales":["Movilización SIJ","Manipulación SIJ","Movilización cadera"],"ejercicio":{"inicial":["Glúteo medio","Estabilidad lumbopélvica"],"intermedio":["Control rotacional"],"avanzado":["Funcional específico"]},"educacion":["Evitar dependencia de cinturones o terapia pasiva","Progresión funcional"],"tratamiento":"Manipulación SIJ, estabilización cintura pélvica, ejercicio."},{"id":"dolor_toracico_mecanico","r":"toracico","n":"Dolor Torácico Mecánico / UBP","p":["dolor entre escápulas","dolor T1-T5","empeora sedestación","relación cuello-hombro","rigidez torácica"],"rts_days":[14,56],"fases":[{"n":"Aguda","c":"Dolor interescapular mecánico"},{"n":"Subaguda","c":"Rigidez torácica + limitación rotación"},{"n":"Crónica","c":"Sensibilidad + postura + estrés"}],"criterios_rts":["Dolor ≤1/10 en actividad prolongada","Rotación torácica completa sin dolor","Control escapular simétrico","Tolerancia sedestación prolongada"],"factores_recaida":["Sedestación prolongada","Estrés psicológico","Debilidad escapular","Rigidez torácica","Patrón cervical asociado"],"tecnicas_manuales":["Movilización torácica","Soft tissue paravertebral","HVLA torácica","Movilización costal","Trabajo miofascial escápula"],"ejercicio":{"inicial":["Extensión torácica","Rotación torácica","Respiración diafragmática"],"intermedio":["Y-T-W escapular","Retracción escapular"],"avanzado":["Patrones push/pull","Control sedestación"]},"educacion":["No es lesión estructural grave","El movimiento es tratamiento","La postura prolongada es el problema","Requiere tratamiento combinado"],"tratamiento":"Movilización torácica, ejercicio fuerza escapular, educación postural. Enfoque multimodal siempre."},{"id":"disfuncion_costovertebral","r":"toracico","n":"Disfunción Costovertebral","p":["dolor localizado costilla","dolor inspiración profunda","dolor unilateral espalda alta","reproducible palpación"],"rts_days":[7,21],"fases":[{"n":"Aguda","c":"Dolor localizado respiratorio"},{"n":"Resolución","c":"Mejora con movilización"}],"criterios_rts":["Sin dolor inspiración profunda","Rotación sin dolor","Movilidad normal"],"factores_recaida":["Postura mantenida","Mecanismos repetitivos"],"tecnicas_manuales":["Movilización costal","Respiración","HVLA si indicado"],"ejercicio":{"inicial":["Respiración diafragmática"],"intermedio":["Movilidad torácica"],"avanzado":["Control postural"]},"educacion":["Patrón funcional frecuente","El movimiento ayuda"],"tratamiento":"Movilización costal, respiración, HVLA si indicado."},{"id":"esguince_lateral","r":"tobillo","n":"Esguince Lateral (ATFL/CFL)","p":["inversión traumática","dolor lateral tobillo","hematoma precoz","incapacidad carga"],"rts_days":[7,84],"fases":[{"n":"Aguda (0–7d)","c":"Dolor, edema, incapacidad carga"},{"n":"Subaguda (1–3 sem)","c":"Mejora progresiva, control carga"},{"n":"Remodelación (3–12 sem)","c":"Estabilidad + fuerza"},{"n":"Crónica (>12 sem)","c":"Inestabilidad funcional"}],"criterios_rts":["Dolor ≤2/10 en carga completa","Salto monopodal sin dolor","Estabilidad cambios dirección","Test equilibrio unipodal simétrico","Fuerza eversores ≥90%","Ausencia giving way"],"factores_recaida":["Déficit de peroneos","Propiocepción pobre","Retorno precoz","Inestabilidad crónica ATFL","Historial esguinces previos"],"tecnicas_manuales":["Movilización talocrural (dorsiflexión)","Movilización subtalar","Drenaje edema","Movilización fibular"],"ejercicio":{"inicial":["Propiocepción BOSU/unipodal","Eversión con banda"],"intermedio":["Saltos progresivos","Marcha + carrera progresiva"],"avanzado":["Pliometría","Cambios dirección"]},"educacion":["Carga temprana acelera recuperación","Evitar inmovilización excesiva","Recaída = falta control neuromuscular no debilidad estructural"],"tratamiento":"POLICE agudo. Propiocepción precoz. Fuerza peroneos. Progresión funcional."},{"id":"sindesmosis","r":"tobillo","n":"Lesión Sindesmosis (High Ankle Sprain)","p":["rotación externa traumática","dolor distal tibiofibular","squeeze positivo","recuperación lenta"],"rts_days":[28,180],"fases":[{"n":"Aguda","c":"Dolor profundo + incapacidad carga"},{"n":"Subaguda","c":"Marcha alterada"},{"n":"Crónica","c":"Dolor persistente + inestabilidad"}],"criterios_rts":["Sprint sin dolor","Cambios dirección completos","Saltos sin dolor distal tibiofibular","Test ER negativo","Tolerancia carga excéntrica"],"factores_recaida":["Retorno precoz","Falta estabilidad mortaja","Dorsiflexión limitada","Deportes contacto precoz"],"tecnicas_manuales":["Movilización tibiofibular distal","Manipulación mortaja si indicado","Movilización dorsiflexión"],"ejercicio":{"inicial":["Dorsiflexión activa controlada"],"intermedio":["Carga progresiva cadena cerrada","Skipping progresivo"],"avanzado":["Estabilidad dinámica rotación externa"]},"educacion":["Recuperación más lenta que esguince lateral","No subestimar dolor profundo","Evitar retorno precoz"],"tratamiento":"Protección carga, control edema. Cirugía si diástasis. Rehab lenta y progresiva."},{"id":"rotura_aquiles","r":"tobillo","n":"Rotura / Tendinopatía Aquiles","p":["pop súbito","Thompson positivo","pérdida plantarflexión","incapacidad carga"],"rts_days":[180,365],"fases":[{"n":"Aguda","c":"Incapacidad funcional"},{"n":"Conservador/postquirúrgico","c":"Progresión carga lenta"},{"n":"Funcional","c":"Retorno deportivo"}],"criterios_rts":["Heel raise simétrico","Hopping sin dolor","Running progresivo tolerado","Fuerza ≥90%"],"factores_recaida":["Retorno precoz","Déficit excéntrico","Carga explosiva antes de recuperación"],"tecnicas_manuales":["Movilización talocrural","Liberación pantorrilla","Movilidad subtalar"],"ejercicio":{"inicial":["Isométricos plantarflexión"],"intermedio":["Heel raises bilaterales/unilaterales"],"avanzado":["Excéntricos Alfredson","Pliometría progresiva"]},"educacion":["Tendón necesita carga progresiva","Reposo absoluto empeora adaptación"],"tratamiento":"Ortesis funcional vs cirugía. Excéntricos fase tardía. RTS lento 9–12 meses."},{"id":"epicondilitis_lateral","r":"codo","n":"Epicondilalgia Lateral (Tennis Elbow)","p":["dolor epicóndilo lateral","Cozen positivo","dolor extensión muñeca resistida","actividad repetitiva"],"rts_days":[21,120],"fases":[{"n":"Reactiva","c":"Dolor carga > dolor reposo"},{"n":"Disrepair","c":"Dolor persistente"},{"n":"Degenerativa","c":"Crónica con sensibilización"}],"criterios_rts":["Dolor ≤2/10 en carga","Cozen negativo o mínimo","Grip strength ≥90%","Sin dolor post actividad 24h","Tolerancia extensores muñeca repetidos"],"factores_recaida":["Sobrecarga excéntrica repetitiva","Mala ergonomía","Déficit extensores muñeca","Falta progresión carga","Trabajo manual intenso sin adaptación"],"tecnicas_manuales":["Movilización radiohumeral","Liberación ECRB/extensores","Movilización cervical C6–C7 si referido","Neurodinamia radial"],"ejercicio":{"inicial":["Isométricos extensores muñeca"],"intermedio":["Excéntricos ECRB","Heavy Slow Resistance"],"avanzado":["Prono-supinación carga progresiva","Grip training"]},"educacion":["No es inflamación sino sobrecarga del tendón","Dolor no es daño estructural","Evitar reposo completo prolongado","Carga progresiva es tratamiento"],"tratamiento":"Excéntricos ECRB, corrección técnica, ortesis. Ondas de choque si crónico."},{"id":"epicondilitis_medial","r":"codo","n":"Epicondilalgia Medial (Golfer Elbow)","p":["dolor epicóndilo medial","golfer test positivo","dolor pronación resistida","posible parestesias cubital"],"rts_days":[42,120],"fases":[{"n":"Reactiva","c":"Dolor carga flexor-pronador"},{"n":"Disrepair","c":"Dolor persistente + posible neuropatía cubital"},{"n":"Crónica","c":"Sensibilización + debilidad"}],"criterios_rts":["Grip sin dolor","Flexión resistida ≤2/10","Sin parestesias cubitales","Resistencia pronación tolerada"],"factores_recaida":["Trabajo manual repetitivo","Pronación forzada continua","Falta control escapular","Irritación cubital no tratada"],"tecnicas_manuales":["Liberación flexor-pronador","Movilización cubital","Neurodinamia nervio cubital","Movilidad cervical C8–T1"],"ejercicio":{"inicial":["Isométricos flexores muñeca"],"intermedio":["Excéntricos pronación","Grip progresivo"],"avanzado":["Trabajo funcional agarre"]},"educacion":["No es inflamación del tendón","Evitar sobreprotección excesiva","Control del volumen de carga","Revisar ergonomía laboral"],"tratamiento":"Excéntricos flexores, corrección técnica. Valorar nervio cubital asociado."},{"id":"neuropatia_cubital","r":"codo","n":"Neuropatía Cubital (Cubital Tunnel)","p":["parestesias 4-5 dedo","Tinel cubital positivo","debilidad intrínseca mano","dolor medial codo con flexión"],"rts_days":[28,120],"fases":[{"n":"Irritativa","c":"Parestesias intermitentes"},{"n":"Moderada","c":"Parestesias + debilidad leve"},{"n":"Severa","c":"Déficit motor + atrofia"}],"criterios_rts":["Sin parestesias 48h post carga","Flexión sostenida tolerada","Fuerza intrínsecos OK"],"factores_recaida":["Flexión mantenida del codo","Apoyo prolongado","Sobrecarga flexores"],"tecnicas_manuales":["Liberación túnel cubital","Movilización cubital","Cervical C8–T1"],"ejercicio":{"inicial":["Deslizamientos nervio cubital"],"intermedio":["Control flexión codo"],"avanzado":["Fortalecimiento intrínsecos mano"]},"educacion":["Evitar flexión prolongada","Ergonomía nocturna","Evitar presión directa"],"tratamiento":"Almohada nocturna, ejercicios deslizamiento neural. Cirugía si severo o progresivo."},{"id":"radiculopatia_cervical","r":"cervical","n":"Radiculopatía Cervical","p":["dolor irradiado brazo","Spurling positivo","parestesias dermatomal","debilidad miotomal"],"rts_days":[14,180],"fases":[{"n":"Aguda irritativa","c":"Dolor + parestesias fluctuantes"},{"n":"Subaguda neural","c":"Dolor más estable + déficits leves"},{"n":"Sensibilización neural","c":"Síntomas amplificados, ULNT +"},{"n":"Crónica","c":"Dolor persistente + disfunción + miedo movimiento"}],"criterios_rts":["ULNT negativo o mínimo síntomas","Spurling negativo o no provocativo","Sin parestesias en carga funcional","Fuerza miotomal ≥90%","Tolerancia carga cervical repetida"],"factores_recaida":["Estenosis foraminal","Protrusión discal persistente","Mala movilidad cervicotorácica","Kinesiofobia","Estrés crónico"],"tecnicas_manuales":["Movilización segmentaria C4–C7","Técnicas descompresión foraminal","Tracción cervical","Movilización T1–T4","Neurodinamia mediano/radial/cubital"],"ejercicio":{"inicial":["Deep neck flexor activation (chin tuck)","Isométricos cervicales suaves","Neurodinamia tipo slider"],"intermedio":["Resistencia cervical progresiva","Control escapular serrato + trapecio inferior"],"avanzado":["Carga en cadena cerrada","Resistencia rotacional","Integración funcional"]},"educacion":["El nervio está sensible, no dañado permanentemente","Los síntomas pueden fluctuar sin daño real","Mover es parte del tratamiento","La postura no es causa única del problema"],"tratamiento":"Neurodinamia ULNT, tracción manual, collar si agudo. Cirugía si déficit motor progresivo."},{"id":"cervicalgia_mecanica","r":"cervical","n":"Cervicalgia Mecánica","p":["dolor cuello localizado","limitación ROM cervical","dolor postural","sin irradiación"],"rts_days":[7,42],"fases":[{"n":"Aguda","c":"Dolor + limitación ROM"},{"n":"Subaguda","c":"Mejora progresiva"},{"n":"Funcional","c":"Recuperación completa"}],"criterios_rts":["ROM completo sin dolor","Tolerancia carga","Sin limitación funcional"],"factores_recaida":["Postura mantenida","Estrés","Sedentarismo cervical"],"tecnicas_manuales":["Movilización cervical segmentaria","Movilización torácica","Tejidos blandos cervicales"],"ejercicio":{"inicial":["Movilidad cervical activa"],"intermedio":["Isométricos cervicales","Control escapular"],"avanzado":["Resistencia progresiva"]},"educacion":["Postura no es la causa única","Movimiento es tratamiento","Evitar sobreprotección"],"tratamiento":"Movilización cervical, ejercicio control motor, educación postural."},{"id":"menisco","r":"rodilla","n":"Lesión Meniscal","p":["dolor línea articular","Thessaly positivo","catching/locking","dolor carga rotacional"],"rts_days":[42,180],"fases":[{"n":"Aguda","c":"Derrame, dolor línea articular"},{"n":"Subaguda","c":"Menos inflamación"},{"n":"Crónica","c":"Catching recurrente"}],"criterios_rts":["Sin derrame","ROM completo","Thessaly negativo o asintomático","Saltos sin dolor","Fuerza ≥90%"],"factores_recaida":["Persistencia derrame","Déficit cuádriceps","Obesidad","Retorno precoz","OA coexistente"],"tecnicas_manuales":["Movilización tibiofemoral","Movilidad extensión","Control edema"],"ejercicio":{"inicial":["Cuádriceps","Glúteos"],"intermedio":["Propiocepción","Progresión impacto"],"avanzado":["Carrera progresiva","Cambios dirección"]},"educacion":["Evitar giros bruscos iniciales","Carga progresiva segura"],"tratamiento":"Ejercicio fuerza cuádriceps-isquios. Artroscopia si bloqueo o fallo conservador >12 semanas."},{"id":"lca","r":"rodilla","n":"Rotura LCA","p":["trauma rotacional","giving way","derrame rápido","Lachman positivo","pivot shift"],"rts_days":[270,540],"fases":[{"n":"Aguda (0–6 sem)","c":"Derrame + dolor"},{"n":"Fuerza (6 sem–4 m)","c":"Recuperación fuerza"},{"n":"Potencia (4–8 m)","c":"Pliometría + agilidad"},{"n":"RTS (9–12 m)","c":"Retorno deportivo completo"}],"criterios_rts":["LSI ≥90–95%","Hop tests ≥90%","Sin derrame","Sin giving way","ACL-RSI adecuado","Cambio dirección sin síntomas"],"factores_recaida":["RTS <9 meses","Déficit cuádriceps","Miedo movimiento","Mala mecánica aterrizaje"],"tecnicas_manuales":["Recuperación extensión","Movilización patelar","Manejo edema"],"ejercicio":{"inicial":["Fuerza cuádriceps","Fuerza isquios"],"intermedio":["Pliometría","Agilidad"],"avanzado":["Exposición deportiva completa"]},"educacion":["Injerto no es recuperación funcional","Criterio funcional es más importante que el tiempo"],"tratamiento":"Reconstrucción LCA + rehabilitación 9–12 meses. Fuerza + neuromuscular + confianza psicológica."},{"id":"oa_rodilla","r":"rodilla","n":"Osteoartritis de Rodilla","p":["dolor mecánico rodilla","crepitación","rigidez matutina <30min","limitación ROM"],"rts_days":[null,null],"fases":[{"n":"Temprana","c":"Dolor actividad"},{"n":"Moderada","c":"Rigidez y limitación"},{"n":"Avanzada","c":"Dolor frecuente"}],"criterios_rts":["Caminar sin aumento síntomas","Subir escaleras","Mejorar ROM","Mejorar capacidad funcional"],"factores_recaida":["Obesidad","Sedentarismo","Debilidad cuádriceps","Baja adherencia"],"tecnicas_manuales":["Movilizaciones tibiofemorales","PFJ","Tejidos blandos"],"ejercicio":{"inicial":["Fuerza cuádriceps","Fuerza cadera"],"intermedio":["Ejercicio aeróbico"],"avanzado":["Progresión funcional"]},"educacion":["OA no es desgaste inevitable","Movimiento protege articulación"],"tratamiento":"Ejercicio, pérdida peso, órtesis. Infiltración si dolor agudo. Prótesis si incapacitante."},{"id":"akp_patelofemoral","r":"rodilla_akp","n":"Dolor Patelofemoral (AKP)","p":["dolor anterior rodilla","dolor escaleras/sentadilla","movie theater sign","maltracking","debilidad cadera"],"rts_days":[42,180],"fases":[{"n":"Irritable","c":"Dolor frecuente, stairs pain, movie sign, baja tolerancia carga"},{"n":"Subaguda","c":"Dolor intermitente, mejora con reposo"},{"n":"Crónica","c":">3 meses, kinesiofobia, pérdida fuerza, alteración control motor"}],"criterios_rts":["Dolor ≤2/10 durante carga","Sin aumento síntomas 24h post actividad","Single-leg squat sin colapso dinámico","Step-down controlado","Fuerza cuádriceps ≥90%","Fuerza glúteo medio ≥90%"],"factores_recaida":["Debilidad glúteo medio","Debilidad rotadores externos cadera","Valgo dinámico","Incremento brusco carga","Kinesiofobia","Movie sign persistente","Patela alta","TT-TG aumentado"],"tecnicas_manuales":["Movilización PF medial","Liberación retináculo lateral","Movilización tibiofemoral","Movilización cadera","Terapia manual toracolumbar si déficit regional"],"ejercicio":{"inicial":["Isométricos cuádriceps","Puente","Clam shells","Side plank"],"intermedio":["Squat parcial","Step-down","Split squat"],"avanzado":["Single-leg squat","Salto","Aterrizaje","Cambios dirección"]},"educacion":["AKP no es daño estructural grave","Evitar reposo prolongado","Monitorizar carga","Dolor leve durante ejercicio es aceptable"],"tratamiento":"Fuerza glúteo+cuádriceps, corrección biomecánica, taping McConnell. Control dinámico."},{"id":"tendinopatia_patelar","r":"rodilla_akp","n":"Tendinopatía Patelar (Jumper's Knee)","p":["dolor polo inferior patela","decline squat positivo","dolor carga excéntrica","deportes de salto"],"rts_days":[90,180],"fases":[{"n":"Reactiva","c":"Dolor tras carga"},{"n":"Disrepair","c":"Dolor durante carga"},{"n":"Degenerativa","c":"Persistente"}],"criterios_rts":["Decline squat ≤2/10","Saltos repetidos sin reagudización","VISA-P >90","Fuerza simétrica"],"factores_recaida":["Exceso carga","Retorno precoz","Déficit fuerza cuádriceps","Rigidez cadena extensora"],"tecnicas_manuales":["Descarga tejidos blandos","Movilidad PFJ"],"ejercicio":{"inicial":["Isométricos 45–60s"],"intermedio":["Heavy slow resistance"],"avanzado":["Pliometría","Retorno específico deporte"]},"educacion":["Tendón necesita carga","Reposo absoluto empeora adaptación"],"tratamiento":"Heavy slow resistance excéntrico, decline squat. Sin infiltración local."},{"id":"hoffa_fatpad","r":"rodilla_akp","n":"Síndrome Hoffa (Fat Pad)","p":["dolor infrapatelar profundo","dolor extensión terminal","burning infrapatelar","maltracking asociado"],"rts_days":[42,84],"fases":[{"n":"Irritable","c":"Dolor extensión terminal"},{"n":"Crónica","c":"Inflamación persistente"}],"criterios_rts":["Extensión completa sin dolor","Carrera sin irritación","Salto sin dolor anterior"],"factores_recaida":["Hiperextensión","Maltracking","Coexistencia tendinopatía"],"tecnicas_manuales":["Taping descarga Hoffa","Corrección tracking patelar"],"ejercicio":{"inicial":["Evitar hiperextensión inicial","Fortalecimiento cadera"],"intermedio":["Control dinámico"],"avanzado":["Progresión deportiva"]},"educacion":["No bloquear rodilla en extensión"],"tratamiento":"Evitar extensión completa, taping patelar, control inflamación."},{"id":"plica_medial","r":"rodilla_akp","n":"Síndrome de Plica","p":["clicking/catching rodilla","dolor flex-ext repetida","Stutter test positivo","confundible menisco"],"rts_days":[42,84],"fases":[{"n":"Irritativa","c":"Clicking + dolor"},{"n":"Subaguda","c":"Menos irritabilidad"}],"criterios_rts":["Ausencia catching","Pruebas funcionales negativas"],"factores_recaida":["Flexo-extensión repetitiva","Maltracking asociado"],"tecnicas_manuales":["Movilización PFJ","Tejidos blandos"],"ejercicio":{"inicial":["Control dinámico","Fortalecimiento cadera"],"intermedio":["Corrección tracking"],"avanzado":["Progresión deportiva"]},"educacion":["Evitar irritación repetida"],"tratamiento":"Anti-inflamatorios, ejercicio suave, artroscopia si refractario."},{"id":"strain_cuadriceps","r":"cuadriceps","n":"Lesión Cuádriceps / Recto Femoral","p":["dolor explosivo muslo anterior","pop sprint/kick","dolor extensión resistida","gap palpable muslo"],"rts_days":[14,112],"fases":[{"n":"Aguda (0–72h)","c":"Hemorragia, dolor, impotencia funcional"},{"n":"Subaguda (3–10d)","c":"ROM + activación"},{"n":"Remodelación (2–6 sem)","c":"Fuerza progresiva"},{"n":"Funcional","c":"Sprint progresivo"}],"criterios_rts":["Sprint sin dolor","Fuerza ≥90–95%","Test excéntrico RF negativo","Salto/kick tolerado"],"factores_recaida":["Lesión previa reciente","Sprint precoz","Tendón central afectado","Fatiga neuromuscular","Déficit glúteo + core","Retorno sin fuerza excéntrica"],"tecnicas_manuales":["Drenaje suave","Liberación miofascial periférica","Movilización cadera sin agresión precoz","Descarga cuádriceps indirecta"],"ejercicio":{"inicial":["Isométricos RF (90°)","Extensiones controladas"],"intermedio":["Hip flexion resistida","Nordic parcial RF"],"avanzado":["Progresión sprint lineal","Pliometría"]},"educacion":["No es solo dolor: es carga estructural","Evitar estiramiento agresivo precoz","Riesgo alto de recaída si sprint precoz","Progresión por función no por dolor"],"tratamiento":"POLICE agudo, flexión 120° en contusión. Excéntricos fase tardía. MRI si sospecha tendón central."},{"id":"contusion_cuadriceps","r":"cuadriceps","n":"Contusión Cuádriceps","p":["golpe directo muslo","hematoma","limitación flexión","dolor palpación"],"rts_days":[7,42],"fases":[{"n":"Aguda inflamatoria (0–72h)","c":"Hematoma, limitación ROM"},{"n":"Subaguda","c":"Recuperar ROM"},{"n":"Funcional","c":"Progresión carga"}],"criterios_rts":["ROM completo >120° flexión","Fuerza normal","Sprint sin dolor"],"factores_recaida":["Hematoma no controlado","Retorno precoz","Inmovilización excesiva o agresión precoz"],"tecnicas_manuales":["Drenaje suave","Movilización leve progresiva (NO agresiva precoz)"],"ejercicio":{"inicial":["Contracciones isométricas tempranas","Progresión flexión activa","Marcha"],"intermedio":["Extensiones progresivas"],"avanzado":["Sprint progresivo"]},"educacion":["Flexión temprana a 120° reduce riesgo de miositis osificante","Evitar masaje agresivo en fase aguda"],"tratamiento":"Flexión inmediata 120°, hielo, compresión. Vigilar miositis osificante (MO)."},{"id":"strain_aductor","r":"aductor","n":"Lesión Aductor / Pubalgia","p":["dolor inguinal","dolor adducción resistida","squeeze test positivo","dolor sprint/cambio dirección"],"rts_days":[7,100],"fases":[{"n":"Aguda (0–5d)","c":"Dolor intenso, limitación funcional"},{"n":"Subaguda (5–21d)","c":"Mejora progresiva"},{"n":"Remodelación (3–8 sem)","c":"Fuerza + control motor"}],"criterios_rts":["Dolor ≤1/10 aducción resistida","Copenhagen test ≥90%","Sprint y cambios dirección sin dolor","Fuerza simétrica aductores"],"factores_recaida":["Lesión previa inguinal","Asimetría aductores >10%","Retorno precoz sprint","Déficit core/hip stability","Carga excéntrica insuficiente"],"tecnicas_manuales":["Liberación miofascial aductores","Tratamiento psoas/inguinal","Movilidad cadera (especial rotación)","Descarga sínfisis"],"ejercicio":{"inicial":["Isométricos aductores 0–45°"],"intermedio":["Copenhagen adduction progresivo","Squats amplios controlados"],"avanzado":["Desplazamientos laterales","Sprint progresivo","Cambios dirección"]},"educacion":["Lesión altamente recidivante si se vuelve rápido a sprint","Dolor inguinal no es daño estructural siempre","La fuerza aductora es el principal predictor de recaída"],"tratamiento":"Progresión carga aductores, Copenhagen adduction. Cirugía si retracción completa con retracción >2cm."},{"id":"strain_isquios","r":"isquiotibiales","n":"Lesión Isquiotibiales (Hamstring)","p":["dolor posterior muslo sprint","sensación tirón o pop","marcha rígida stiff-legged","equimosis posterior"],"rts_days":[7,84],"fases":[{"n":"Aguda (0–72h)","c":"Dolor + protección funcional"},{"n":"Subaguda (3–10d)","c":"Isométricos + activación"},{"n":"Remodelación (2–4 sem)","c":"Excéntricos"},{"n":"Funcional (4–8 sem)","c":"Sprint progresivo"},{"n":"RTS","c":"Exposición deportiva completa"}],"criterios_rts":["Marcha sin dolor","ROM completo bilateral","Fuerza ≥90–95% lado sano","Fuerza excéntrica simétrica","Sprint máximo sin dolor","Cambios dirección completos"],"factores_recaida":["Lesión previa (principal predictor)","Retorno precoz","Déficit excéntrico","Mala progresión sprint","Fatiga residual","Asimetría fuerza","Lesión proximal previa"],"tecnicas_manuales":["Liberación miofascial posterior","Movilización neural ciática","Trabajo fascia posterior","Movilización pélvica","Trabajo tejido proximal"],"ejercicio":{"inicial":["Curl isométrico","Bridge hold","Hip hinge hold"],"intermedio":["Nordic hamstring progresivo","Romanian deadlift","Slider curls"],"avanzado":["Nordic full ROM","Sprint drills progresivos","Cambios dirección","Saltos reactivos"]},"educacion":["Dolor no siempre significa daño","Evitar retorno precoz es clave","La recaída es más común que la primera lesión","La fuerza excéntrica protege el tejido","El sprint es el mayor estresor del isquio"],"tratamiento":"Excéntricos en elongación (Nordic hamstring). Control lumbopélvico. NO volver precoz al deporte."},{"id":"avulsion_isquios","r":"isquiotibiales","n":"Avulsión Proximal Isquiotibiales","p":["dolor al sentarse","dolor glúteo profundo","retracción palpable","trauma grave sprint/salto"],"rts_days":[90,270],"fases":[{"n":"Aguda severa","c":"Incapacidad funcional + hematoma"},{"n":"Conservador/postquirúrgico","c":"Progresión muy lenta"}],"criterios_rts":["Fuerza ≥90–95%","Sprint completo","Test funcional elite sin dolor"],"factores_recaida":["Retorno precoz","Déficit fuerza explosiva","Cicatrización incompleta"],"tecnicas_manuales":["Mínima fase aguda","Movilidad progresiva controlada"],"ejercicio":{"inicial":["Protección + carga mínima"],"intermedio":["Isométricos progresivos"],"avanzado":["Excéntricos tardíos","Sprint muy progresivo"]},"educacion":["Lesión de alto impacto funcional","No acelerar recuperación por dolor bajo"],"tratamiento":"Cirugía si >2 tendones o >2cm retracción. Rehab larga 6–18 meses."},{"id":"strain_gemelo","r":"gemelo","n":"Lesión Gemelo Medial (Tennis Leg)","p":["pop súbito pantorrilla","dolor posteromedial","dorsiflexión dolorosa","incapacidad heel raise"],"rts_days":[7,112],"fases":[{"n":"Aguda (0–7d)","c":"Dolor al caminar + cojera"},{"n":"Subaguda (1–3 sem)","c":"Dolor en push-off + edema"},{"n":"Funcional intermedia","c":"Dolor solo en sprint/hop"},{"n":"RTS","c":"Sin dolor en running + saltos"}],"criterios_rts":["Sin dolor en marcha, salto y sprint","Fuerza ≥90–95% contralateral","≥20–25 heel raises unilaterales sin dolor","Hop test simétrico","Sprint progresivo sin síntomas","Cambios dirección tolerados a alta intensidad"],"factores_recaida":["Lesión previa (principal predictor)","Retorno precoz","Déficit excéntrico","Fatiga neuromuscular","Edad >25","Deportes explosivos"],"tecnicas_manuales":["Liberación miofascial gemelo","Drenaje manual edema","Movilización tobillo talocrural","Liberación fascia posterior cadena"],"ejercicio":{"inicial":["Isométricos plantarflexión"],"intermedio":["Heel raises bilaterales","Single-leg calf raises"],"avanzado":["Eccentric heel raises","Hopping + running","Sprint progresivo"]},"educacion":["No estirar al inicio","Cargar progresivamente","Recaídas frecuentes si se vuelve pronto","Imagen no manda el retorno: manda la función","Si no puedes saltar bien no puedes correr rápido"],"tratamiento":"POLICE agudo, compresión. Heel raises progresivos. Excéntricos fase 3. NO estirar precoz."},{"id":"rotura_aquiles_parcial","r":"gemelo","n":"Tendinopatía / Lesión Aquiles","p":["dolor tendón aquiles","dolor matutino al levantarse","dolor carga excéntrica","engrosamiento palpable"],"rts_days":[56,180],"fases":[{"n":"Reactiva","c":"Dolor tras carga"},{"n":"Disrepair","c":"Dolor durante carga"},{"n":"Degenerativa","c":"Crónica"}],"criterios_rts":["Heel raise simétrico","Hopping sin dolor","Running tolerado","Fuerza ≥90%"],"factores_recaida":["Retorno precoz","Carga explosiva antes de recuperación excéntrica","Déficit dorsiflexión"],"tecnicas_manuales":["Movilización talocrural","Liberación pantorrilla","Movilidad subtalar"],"ejercicio":{"inicial":["Isométricos plantarflexión"],"intermedio":["Heel raises Alfredson/Silbernagel"],"avanzado":["Pliometría progresiva","Carrera progresiva"]},"educacion":["Tendón necesita carga progresiva","Reposo absoluto empeora adaptación"],"tratamiento":"Excéntricos Alfredson/Silbernagel. Ondas de choque. Ortesis si agudo. RTS lento."},{"id":"fascitis_plantar","r":"pie","n":"Fascitis Plantar","p":["dolor talón plantar","dolor primeros pasos mañana","dolor inicio carga tras reposo","dolor inserción calcánea fascia"],"rts_days":[42,270],"fases":[{"n":"Irritativa","c":"Dolor matutino intenso primeros pasos"},{"n":"Subaguda","c":"Dolor con carga prolongada"},{"n":"Funcional","c":"Dolor solo actividad alta"}],"criterios_rts":["Sin dolor primeros pasos matutinos","Tolerancia bipedestación prolongada","Carrera progresiva sin dolor","Single heel raise sin dolor"],"factores_recaida":["Sobrecarga progresiva mal gestionada","Calzado inadecuado","Déficit dorsiflexión tobillo","Sobrepeso","Retracción tríceps sural","Bipedestación laboral prolongada"],"tecnicas_manuales":["Liberación fascia plantar","Liberación tríceps sural / sóleo","Movilización dorsiflexión talocrural","Tejidos blandos planta"],"ejercicio":{"inicial":["Estiramiento fascia plantar específico","Estiramiento gastrocnemio-sóleo"],"intermedio":["Fortalecimiento intrínsecos pie","Heel raise con toalla bajo dedos (high-load)"],"avanzado":["Heel raise carga progresiva","Reentrenamiento carrera"]},"educacion":["El dolor matutino es típico y mejora con carga progresiva","La carga de alta intensidad del tríceps mejora el tendón y la fascia","Evitar reposo absoluto","El calzado y la actividad laboral influyen"],"tratamiento":"Estiramiento fascia + high-load strength training. Plantillas si pie plano. Ondas de choque si crónico >6 meses."},{"id":"neuroma_morton","r":"pie","n":"Neuroma de Morton","p":["dolor quemante antepié","sensación piedra o calcetín arrugado","parestesias entre dedos 3-4","empeora calzado estrecho","Mulder positivo"],"rts_days":[60,180],"fases":[{"n":"Irritativa","c":"Dolor intermitente antepié"},{"n":"Persistente","c":"Parestesias frecuentes"},{"n":"Funcional","c":"Dolor solo calzado/actividad específica"}],"criterios_rts":["Sin parestesias en marcha","Tolerancia calzado normal","Carrera sin dolor antepié"],"factores_recaida":["Calzado estrecho o tacón","Sobrecarga antepié","Pie plano con hiperpronación","Actividad de impacto repetida"],"tecnicas_manuales":["Movilización intermetatarsal","Apertura espacio metatarsal","Tejidos blandos antepié"],"ejercicio":{"inicial":["Fortalecimiento intrínsecos","Separación activa dedos"],"intermedio":["Control antepié en carga","Equilibrio"],"avanzado":["Progresión impacto controlada"]},"educacion":["El calzado ancho reduce los síntomas","No siempre requiere cirugía","Las parestesias entre los dedos son típicas de irritación nerviosa"],"tratamiento":"Calzado ancho, almohadilla metatarsal, modificación carga. Infiltración o cirugía si refractario."},{"id":"tibial_posterior","r":"pie","n":"Disfunción Tibial Posterior / Pie Plano Adquirido","p":["dolor medial inframaleolar","colapso arco medial","too many toes sign","incapacidad single heel raise","tumefacción medial"],"rts_days":[90,270],"fases":[{"n":"Irritativa","c":"Dolor medial + tumefacción, arco conservado"},{"n":"Disfunción flexible","c":"Colapso arco reductible"},{"n":"Avanzada","c":"Deformidad rígida progresiva"}],"criterios_rts":["Single heel raise con inversión talón","Sin dolor medial en carga","Tolerancia marcha prolongada","Control arco en carga"],"factores_recaida":["Sobrepeso","Hiperpronación no corregida","Progresión a deformidad rígida","Degeneración tendinosa","Carga sin soporte de arco"],"tecnicas_manuales":["Tejidos blandos tibial posterior","Movilización subtalar/mediopié","Control tono peroneos"],"ejercicio":{"inicial":["Fortalecimiento tibial posterior (inversión resistida)","Control arco"],"intermedio":["Heel raise con inversión","Equilibrio monopodal"],"avanzado":["Heel raise unilateral progresivo","Trabajo funcional de carga"]},"educacion":["El tendón tibial posterior sostiene el arco del pie","La detección precoz evita la deformidad rígida","Las ortesis pueden frenar la progresión"],"tratamiento":"Fortalecimiento excéntrico tibial posterior, ortesis de soporte medial. Cirugía si deformidad rígida."},{"id":"hallux_valgus","r":"pie","n":"Hallux Valgus","p":["desviación lateral primer dedo","prominencia medial primer MTF","dolor juanete con calzado","deformidad progresiva antepié"],"rts_days":[null,null],"fases":[{"n":"Leve","c":"Deformidad incipiente, dolor con calzado"},{"n":"Moderada","c":"Desviación visible, sobrecarga MTF"},{"n":"Severa","c":"Deformidad rígida, metatarsalgia asociada"}],"criterios_rts":["Dolor controlado con calzado adecuado","Marcha sin sobrecarga dolorosa","Función primer radio conservada"],"factores_recaida":["Calzado estrecho o tacón","Hiperpronación","Laxitud ligamentosa","Componente hereditario"],"tecnicas_manuales":["Movilización primer MTF","Tejidos blandos aductor hallux","Movilización mediopié"],"ejercicio":{"inicial":["Fortalecimiento abductor hallux","Separadores de dedos"],"intermedio":["Control intrínsecos","Short foot exercise"],"avanzado":["Control dinámico en carga"]},"educacion":["El ejercicio no revierte la deformidad pero mejora la función y el dolor","El calzado ancho reduce los síntomas","La cirugía es para el dolor, no por estética"],"tratamiento":"Calzado ancho, separadores, fortalecimiento abductor hallux. Cirugía si dolor incapacitante."},{"id":"hallux_rigidus","r":"pie","n":"Hallux Rigidus","p":["dolor primer MTF con carga","rigidez extensión primer dedo","dolor despegue del paso","osteofito dorsal primer MTF"],"rts_days":[null,null],"fases":[{"n":"Leve","c":"Dolor con dorsiflexión forzada"},{"n":"Moderada","c":"Limitación extensión + dolor despegue"},{"n":"Severa","c":"Rigidez marcada, artrosis MTF1"}],"criterios_rts":["Despegue del paso sin dolor","Dorsiflexión funcional primer dedo","Tolerancia marcha/carrera"],"factores_recaida":["Sobrecarga primer radio","Calzado flexible que exige dorsiflexión","Progresión artrósica"],"tecnicas_manuales":["Movilización y tracción primer MTF","Movilidad sesamoideos","Tejidos blandos flexor hallux"],"ejercicio":{"inicial":["Movilidad primer MTF en rango no doloroso","Control flexor hallux"],"intermedio":["Fortalecimiento intrínsecos","Propiocepción antepié"],"avanzado":["Despegue controlado progresivo"]},"educacion":["La rigidez del dedo gordo limita el despegue del paso","Una suela rígida (rocker) reduce el dolor","El objetivo es función y dolor, no recuperar todo el rango"],"tratamiento":"Suela rígida/rocker, movilización MTF1, control carga. Cirugía (queilectomía/artrodesis) si severo."},{"id":"tunel_tarsiano","r":"pie","n":"Síndrome del Túnel Tarsiano","p":["quemazón planta del pie","parestesias plantares","dolor medial retromaleolar","Tinel tarsiano positivo","empeora nocturno o con carga"],"rts_days":[60,180],"fases":[{"n":"Irritativa","c":"Parestesias intermitentes plantares"},{"n":"Persistente","c":"Quemazón frecuente + déficit sensitivo"},{"n":"Avanzada","c":"Déficit sensitivomotor mantenido"}],"criterios_rts":["Sin parestesias en carga prolongada","Sensibilidad plantar conservada","Tolerancia marcha/bipedestación"],"factores_recaida":["Hiperpronación que tracciona el nervio","Sobrecarga compresiva","Edema local","Lesión espacio-ocupante no resuelta"],"tecnicas_manuales":["Neurodinamia tibial posterior","Liberación retináculo flexor","Movilización medial tobillo"],"ejercicio":{"inicial":["Deslizamientos neurales tibial posterior","Control hiperpronación"],"intermedio":["Fortalecimiento tibial posterior","Control arco"],"avanzado":["Progresión carga funcional"]},"educacion":["Es una irritación del nervio en su paso medial por el tobillo","La pronación excesiva puede tensar el nervio","Las ortesis pueden descomprimir el túnel"],"tratamiento":"Neurodinamia, ortesis anti-pronación, control edema. Cirugía descompresiva si refractario o déficit progresivo."},{"id":"inestabilidad_peroneos","r":"pie","n":"Disfunción Peroneos / Inestabilidad Lateral Crónica","p":["dolor lateral retromaleolar","sensación de inestabilidad lateral crónica","esguinces de repetición","debilidad eversión","chasquido peroneo"],"rts_days":[42,180],"fases":[{"n":"Irritativa","c":"Dolor lateral + eversión débil"},{"n":"Funcional","c":"Inestabilidad en superficies irregulares"},{"n":"Avanzada","c":"Esguinces recurrentes o subluxación tendinosa"}],"criterios_rts":["Fuerza eversión ≥90%","Equilibrio monopodal simétrico","Sin giving way lateral","Cambios de dirección sin aprensión"],"factores_recaida":["Déficit propioceptivo no resuelto","Esguinces previos múltiples","Retorno precoz","Debilidad peroneos persistente","Subluxación tendinosa no tratada"],"tecnicas_manuales":["Tejidos blandos peroneos","Movilización fibular","Movilización subtalar"],"ejercicio":{"inicial":["Eversión resistida con banda","Propiocepción unipodal"],"intermedio":["Equilibrio en superficies inestables","Control lateral dinámico"],"avanzado":["Saltos laterales","Cambios de dirección","Pliometría"]},"educacion":["La inestabilidad crónica suele ser déficit neuromuscular, no solo ligamentoso","La propiocepción y la fuerza de peroneos son la clave","Distinto del esguince agudo: aquí el problema es la repetición"],"tratamiento":"Reentrenamiento propioceptivo + fuerza peroneos. Cirugía si inestabilidad mecánica o subluxación tendinosa."},{"id":"pie_reumatoide","r":"pie","n":"Pie Reumatoide (Artritis Reumatoide)","p":["dolor y tumefacción de tobillo","rigidez matutina prolongada mayor de 30 min","afectación poliarticular bilateral","dolor MTF de múltiples dedos","deformidades progresivas del antepié","diagnóstico previo de artritis reumatoide"],"rts_days":[null,null],"fases":[{"n":"Inflamatoria precoz","c":"Dolor + tumefacción sin erosiones"},{"n":"Inflamatoria persistente","c":"Sinovitis recurrente"},{"n":"Daño estructural","c":"Erosiones y deformidades visibles"},{"n":"Discapacidad avanzada","c":"Alteración severa de la marcha"}],"criterios_rts":["Control inflamatorio (no la imagen)","Dolor de tobillo controlado","Tumefacción mínima","Marcha normalizada","Tolerancia carga prolongada sin brote","Ausencia de brote activo"],"factores_recaida":["Actividad inflamatoria persistente","Dolor residual de tobillo","Tumefacción crónica de tobillo","Mal control farmacológico (DMARDs)","Sobrecarga mecánica","Enfermedad de larga duración"],"tecnicas_manuales":["Movilización tobillo (tibiotalar)","Movilización subtalar","Movilización mediopié","Drenaje de edema","Terapia de tejidos blandos"],"ejercicio":{"inicial":["Movilidad tobillo-retropié","Movilidad activa sin dolor"],"intermedio":["Fortalecimiento tríceps sural","Fortalecimiento intrínsecos del pie","Equilibrio"],"avanzado":["Reentrenamiento de la marcha","Trabajo funcional progresivo","Ejercicio aeróbico"]},"educacion":["El dolor no siempre refleja daño estructural","El tobillo y el retropié son tan importantes como el antepié","El control inflamatorio precoz cambia el pronóstico","Mantener actividad física es esencial","Las ortesis pueden reducir la discapacidad","Consultar ante nuevos brotes","La progresión no depende solo de las radiografías"],"tratamiento":"Enfermedad sistémica: el control inflamatorio (DMARDs/biológicos, reumatología) es prioritario. Fisioterapia complementaria: movilidad, fuerza, marcha, ortesis y calzado. La terapia manual NO modifica la progresión inflamatoria. Explorar SIEMPRE el tobillo y el retropié, que predicen más discapacidad que las erosiones del antepié."},{"id":"gluteo_mayor","r":"cadera","n":"Disfunción / Debilidad del Glúteo Mayor","p":["debilidad de extensión de cadera","dominancia de isquiotibiales en extensión","valgo dinámico y rotación interna femoral","caída pélvica en apoyo monopodal","sedestación prolongada","glúteo poco activo (sleepy glutes)"],"rts_days":[42,120],"fases":[{"n":"Inhibición","c":"Glúteo hipoactivo por dolor, derrame o sedestación"},{"n":"Reactivación","c":"Recupera activación y control lumbopélvico"},{"n":"Fortalecimiento","c":"Fuerza progresiva en carga"},{"n":"Potencia/RTS","c":"Producción de fuerza en tareas deportivas"}],"criterios_rts":["Fuerza de extensión de cadera ≥90-95%","Single-leg bridge simétrico","Single-leg squat sin valgo","Sprint sin compensaciones","Cambios de dirección controlados","Saltos sin pérdida de control","Estabilidad pélvica normal"],"factores_recaida":["Sedestación prolongada","Flexores de cadera cortos (inhibición recíproca)","Dolor o derrame articular (inhibición refleja)","Déficit de core","Dominancia sinérgica de isquiotibiales/aductor mayor/erectores","Anteversión pélvica"],"tecnicas_manuales":["Liberación flexores de cadera (psoas/recto femoral)","Movilización lumbopélvica","Trabajo de tejidos blandos","Reeducación postural pélvica"],"ejercicio":{"inicial":["Glute bridge","Single-leg bridge","Clam shell","Bird dog","Side plank + abducción"],"intermedio":["Hip thrust","Split squat","Step-up","Lateral step-up","Romanian deadlift"],"avanzado":["Single-leg squat","Single-leg RDL","Sprint","Saltos y drop jump","Cambios de dirección","Pliometría"]},"educacion":["La debilidad del glúteo mayor rara vez es aislada: suele ser inhibición neuromuscular","La activación y el timing importan tanto como la fuerza","La sedestación prolongada y los flexores cortos son los principales inhibidores","Corregir la inhibición ANTES de fortalecer (error frecuente fortalecer sin reactivar)","La evaluación funcional vale más que la fuerza aislada"],"tratamiento":"Progresión: 1) corregir inhibición (dolor, flexores cortos) → 2) restaurar estabilidad lumbopélvica → 3) fortalecer glúteo mayor (hip thrust = máxima activación) → 4) reintegrar patrones motores → 5) potencia deportiva. El hip thrust genera la mayor activación EMG aislada. Bandas en rodillas y trabajo unilateral aumentan el reclutamiento."},{"id":"tibial_anterior","r":"pie","n":"Tendinopatía / Rotura del Tibial Anterior","p":["dolor cara anterior del tobillo","déficit de dorsiflexión","marcha en steppage","debilidad de inversión","masa o gap palpable anterior en tobillo","posible chasquido y pérdida de dorsiflexión"],"rts_days":[42,180],"fases":[{"n":"Reactiva/leve","c":"Dolor anterior con carga, dorsiflexión conservada"},{"n":"Disrepair","c":"Dolor persistente, debilidad dorsiflexora"},{"n":"Rotura/avanzada","c":"Masa anterior, marcha steppage, déficit marcado"}],"criterios_rts":["Dorsiflexión sin dolor","Fuerza del tibial anterior ≥90%","Marcha normal sin steppage","Carrera sin compensaciones","Saltos unipodales sin síntomas","Sin dolor 24h post ejercicio"],"factores_recaida":["Déficit de dorsiflexión","Debilidad del tibial anterior","Pie plano adquirido","Sobrecarga del arco medial","Neuropatía peronea","Retorno precoz a la carrera"],"tecnicas_manuales":["Movilidad talocrural (dorsiflexión)","Movilidad subtalar","Liberación miofascial de la pierna","Tejidos blandos compartimento anterior"],"ejercicio":{"inicial":["Dorsiflexión isométrica","Dorsiflexión con banda"],"intermedio":["Heel walking","Control motor de tobillo","Excéntricos de dorsiflexión"],"avanzado":["Trabajo funcional","Carrera progresiva","Saltos unipodales"]},"educacion":["La rotura espontánea es más frecuente >50 años, en diabéticos, artritis inflamatoria o uso de corticoides","Más del 80% de las supuestas roturas parciales en ecografía pueden ser variantes anatómicas normales (6 morfotipos)","El patrón típico de rotura: chasquido, dolor inicial y posterior pérdida de dorsiflexión","La marcha en steppage indica déficit dorsiflexor significativo"],"tratamiento":"Tendinopatía: control de carga + excéntricos de dorsiflexión, corrección biomecánica del arco medial. Rotura: valorar cirugía (reparación o transferencia tendinosa) según edad, demanda y déficit funcional. La ecografía dinámica clasifica morfotipos y evita el sobrediagnóstico de rotura."},{"id":"hernia_tibial_anterior","r":"pie","n":"Hernia Muscular del Tibial Anterior","p":["bulto anterolateral de la pierna que aparece con carga","tumefacción que desaparece en reposo o decúbito","protrusión con la contracción del tibial anterior","dolor anterolateral localizado","antecedente traumático o deportivo","exploración neurológica normal"],"rts_days":[28,112],"fases":[{"n":"Asintomática","c":"Bulto sin dolor"},{"n":"Irritable","c":"Dolor durante la actividad"},{"n":"Funcional","c":"Dolor + limitación deportiva"},{"n":"Persistente/refractaria","c":"Síntomas crónicos, valorar cirugía"}],"criterios_rts":["Dolor ≤2/10","Sin aumento de síntomas 24h","Carrera continua sin dolor","Sprint sin síntomas","Salto unilateral tolerado","Dorsiflexión funcional restaurada","Fuerza del tibial anterior ≥90%"],"factores_recaida":["Retorno precoz al deporte","Traumatismos repetidos","Déficit de dorsiflexión","Sobrepronación excesiva","Alteración biomecánica de carrera","Hipertrofia muscular rápida","Incumplimiento de la compresión"],"tecnicas_manuales":["Movilidad talocrural","Movilidad subtalar","Liberación miofascial de la pierna","Tejidos blandos complementario"],"ejercicio":{"inicial":["Dorsiflexión isométrica en supino (baja carga)"],"intermedio":["Dorsiflexión concéntrica con banda","Heel walking","Control motor de tobillo"],"avanzado":["Excéntricos de dorsiflexión","Skipping","Aceleraciones","Cambios de dirección","Tareas específicas del deporte"]},"educacion":["Es una condición benigna y frecuente en deportistas","El signo clave: un bulto que aparece con la carga y desaparece en reposo","La persistencia visible de la hernia NO implica fracaso si el paciente está asintomático","La ecografía dinámica es la prueba diagnóstica de elección","Diferenciar de tumores: la hernia cambia de tamaño según la posición"],"tratamiento":"Conservador de primera elección: modificación de carga + medias compresivas (lo más citado) + ejercicio progresivo isométrico→excéntrico + corrección biomecánica. La mayoría vuelve al deporte en 6-12 semanas sin cirugía. Cirugía (fasciotomía longitudinal, no cierre primario) solo si refractario o alta demanda deportiva."}],"tests_by_region":{"hombro":[{"id":"er_lag","n":"External Rotation Lag Sign (90°)","s":"Infraspinoso/Supraespinoso","se":null,"sp":null,"role":"confirmar","dor":12.7},{"id":"ir_lag","n":"Internal Rotation Lag Sign","s":"Subescapular","se":null,"sp":null,"role":"confirmar","dor":7.0},{"id":"drop_arm","n":"Drop Arm Test","s":"Supraespinoso","se":0.21,"sp":0.92,"role":"confirmar"},{"id":"jobe","n":"Jobe / Empty Can","s":"Supraespinoso","se":0.59,"sp":0.67,"role":"apoyo"},{"id":"neer","n":"Neer Impingement Sign","s":"Espacio subacromial","se":0.72,"sp":0.6,"role":"descartar"},{"id":"hawkins","n":"Hawkins-Kennedy","s":"Espacio subacromial","se":0.79,"sp":0.59,"role":"descartar"},{"id":"speed","n":"Speed Test","s":"LHBT bíceps","se":0.32,"sp":0.75,"role":"apoyo"},{"id":"yergason","n":"Yergason Test","s":"LHBT / corredera bicipital","se":0.37,"sp":0.86,"role":"apoyo"},{"id":"apprehension_gh","n":"Apprehension Test","s":"Cápsula anterior / Labrum","se":0.72,"sp":0.6,"role":"apoyo"},{"id":"relocation","n":"Relocation Test","s":"Inestabilidad anterior","se":0.81,"sp":0.86,"role":"confirmar"},{"id":"belly_press","n":"Belly Press Test","s":"Subescapular superior","se":0.4,"sp":0.98,"role":"confirmar"},{"id":"bear_hug","n":"Bear Hug Test","s":"Subescapular porciones superiores","se":0.6,"sp":0.92,"role":"confirmar"},{"id":"hornblower","n":"Hornblower Sign","s":"Teres Minor / Rotura posterosuperior","se":null,"sp":null,"role":"apoyo"}],"cadera":[{"id":"faddir","n":"FADDIR","s":"FAI / Labrum anterosuperior","se":0.96,"sp":0.1,"role":"descartar"},{"id":"faber_cadera","n":"FABER Test","s":"Intraarticular / SIJ","se":0.88,"sp":0.64,"role":"apoyo"},{"id":"log_roll","n":"Log Roll Test","s":"Patología intraarticular pura","se":0.43,"sp":0.93,"role":"confirmar"},{"id":"trendelenburg","n":"Trendelenburg Test","s":"Glúteo medio","se":0.55,"sp":0.7,"role":"apoyo"},{"id":"scour","n":"Scour Test","s":"Superficie acetabular","se":null,"sp":null,"role":"apoyo"},{"id":"thomas_cadera","n":"Thomas Test","s":"Iliopsoas / flexores","se":null,"sp":null,"role":"apoyo"},{"id":"ober","n":"Ober Test","s":"TFL / Cintilla IT","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_ext_derotation","n":"Resisted External Derotation Test","s":"Glúteo medio / GTPS","se":null,"sp":null,"role":"apoyo"},{"id":"snapping_hip","n":"Snapping Hip / Coxa Saltans","s":"Iliopsoas / TFL","se":null,"sp":null,"role":"apoyo"},{"id":"single_leg_stance","n":"Single Leg Stance Test (30s)","s":"Tendinopatía glútea (compresión+tensión)","se":null,"sp":null,"role":"confirmar"},{"id":"resisted_int_rot","n":"Resisted Internal Rotation Test","s":"Glúteo medio/mínimo (carga tensional)","se":null,"sp":null,"role":"apoyo"},{"id":"single_leg_bridge","n":"Single-Leg Bridge Test","s":"Fuerza/resistencia glúteo mayor","se":null,"sp":null,"role":"apoyo"},{"id":"prone_hip_extension","n":"Prone Hip Extension (rodilla 90°)","s":"Fuerza aislada glúteo mayor","se":null,"sp":null,"role":"apoyo"}],"lumbar":[{"id":"slr","n":"SLR (Straight Leg Raise)","s":"Tensión radicular L4-S1","se":0.91,"sp":0.26,"role":"descartar"},{"id":"crossed_slr","n":"Crossed SLR","s":"Hernia discal significativa","se":0.29,"sp":0.88,"role":"confirmar"},{"id":"slump","n":"Slump Test","s":"Tensión neural global","se":0.84,"sp":0.83,"role":"apoyo"},{"id":"faber_sij","n":"FABER (SIJ)","s":"Articulación sacroiliaca","se":null,"sp":null,"role":"apoyo"},{"id":"gaenslen","n":"Gaenslen Test","s":"Articulación sacroiliaca","se":null,"sp":null,"role":"apoyo"},{"id":"kemp","n":"Kemp Test","s":"Facetario / estenosis","se":null,"sp":null,"role":"apoyo"},{"id":"fortin_finger","n":"Fortin Finger Test","s":"SIJ","se":null,"sp":null,"role":"apoyo"}],"toracico":[{"id":"palpacion_toracica","n":"Palpación segmental torácica","s":"Disfunción costovertebral/facetaria","se":null,"sp":null,"role":"apoyo"},{"id":"movimiento_toracico","n":"ROM torácico (flexión/extensión/rotación)","s":"Rigidez segmental torácica","se":null,"sp":null,"role":"apoyo"},{"id":"palpacion_costal","n":"Palpación costovertebral","s":"Disfunción costal","se":null,"sp":null,"role":"apoyo"},{"id":"spring_test","n":"Spring Test (PA pressure)","s":"Rigidez segmental torácica","se":null,"sp":null,"role":"apoyo"},{"id":"control_escapular","n":"Test control escapular","s":"Disfunción escapulotorácica","se":null,"sp":null,"role":"apoyo"}],"tobillo":[{"id":"anterior_drawer_tobillo","n":"Anterior Drawer Test Tobillo","s":"ATFL","se":0.74,"sp":0.88,"role":"confirmar"},{"id":"anterolateral_drawer","n":"Anterolateral Drawer Test","s":"Inestabilidad rotacional tobillo","se":null,"sp":null,"role":"confirmar"},{"id":"talar_tilt","n":"Talar Tilt / Inversion Stress","s":"CFL ± ATFL","se":0.5,"sp":0.88,"role":"apoyo"},{"id":"ottawa_ankle","n":"Ottawa Ankle Rules","s":"Fractura / hueso","se":0.99,"sp":null,"role":"descartar"},{"id":"squeeze_tobillo","n":"Squeeze Test Tobillo","s":"Sindesmosis","se":0.3,"sp":0.93,"role":"confirmar"},{"id":"external_rotation_stress","n":"External Rotation Stress Test","s":"Sindesmosis","se":0.71,"sp":0.63,"role":"apoyo"},{"id":"thompson","n":"Thompson Test","s":"Tendón de Aquiles","se":0.96,"sp":0.93,"role":"confirmar"},{"id":"kleiger","n":"Kleiger (ER) Test","s":"Deltoideo / sindesmosis medial","se":null,"sp":null,"role":"apoyo"}],"pie":[{"id":"mulder","n":"Mulder Click Test","s":"Neuroma de Morton (espacio intermetatarsal)","se":0.62,"sp":null,"role":"confirmar"},{"id":"tinel_tarsiano","n":"Tinel Túnel Tarsiano","s":"Nervio tibial posterior","se":0.58,"sp":null,"role":"confirmar"},{"id":"silfverskiold","n":"Silfverskiöld Test","s":"Gastrocnemio vs sóleo (equino)","se":null,"sp":null,"role":"apoyo"},{"id":"coleman_block","n":"Coleman Block Test","s":"Pie cavo flexible vs rígido","se":null,"sp":null,"role":"apoyo"},{"id":"single_heel_raise","n":"Single Leg Heel Raise","s":"Tibial posterior / tríceps sural","se":null,"sp":null,"role":"apoyo"},{"id":"too_many_toes","n":"Too Many Toes Sign","s":"Retropié en valgo / tibial posterior","se":null,"sp":null,"role":"apoyo"},{"id":"monofilamento","n":"Monofilamento 10g","s":"Sensibilidad / neuropatía periférica","se":null,"sp":null,"role":"apoyo"},{"id":"windlass_test","n":"Windlass Test","s":"Fascia plantar","se":0.32,"sp":1.0,"role":"confirmar"},{"id":"grind_mtf1","n":"Grind Test Primer MTF","s":"Artrosis MTF1 (hallux rigidus)","se":null,"sp":null,"role":"apoyo"},{"id":"fencer_lunge","n":"Fencer's Lunge Test","s":"Hernia muscular tibial anterior","se":null,"sp":null,"role":"confirmar"},{"id":"dorsiflexion_resistida","n":"Dorsiflexión Resistida","s":"Tibial anterior (fuerza/dolor)","se":null,"sp":null,"role":"apoyo"}],"codo":[{"id":"cozen","n":"Cozen Test","s":"Epicóndilo lateral / ECRB","se":0.84,"sp":0.74,"role":"apoyo"},{"id":"mill","n":"Mill Test","s":"Estiramiento tendón extensor","se":null,"sp":null,"role":"apoyo"},{"id":"maudsley","n":"Maudsley Test","s":"Extensión dedo medio / ECRB","se":null,"sp":null,"role":"apoyo"},{"id":"chair_pushup","n":"Chair Push-up Test","s":"Dolor funcional lateral codo","se":0.88,"sp":null,"role":"confirmar"},{"id":"golfer_test","n":"Test de Golfer","s":"Epicóndilo medial / flexor-pronador","se":null,"sp":null,"role":"apoyo"},{"id":"tinel_cubital","n":"Tinel Canal Cubital","s":"Nervio cubital","se":0.7,"sp":0.98,"role":"confirmar"},{"id":"flexion_cubital","n":"Flexion Test Cubital","s":"Neuropatía cubital dinámica","se":null,"sp":null,"role":"apoyo"},{"id":"froment","n":"Froment Sign","s":"Nervio cubital / intrínsecos","se":null,"sp":null,"role":"apoyo"},{"id":"tinel_radial","n":"Tinel Radial Tunnel","s":"Nervio radial / radial tunnel","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_supination","n":"Resisted Supination Test","s":"Radial tunnel / supinadores","se":null,"sp":null,"role":"apoyo"}],"cervical":[{"id":"spurling","n":"Spurling Test","s":"Raíz nerviosa cervical","se":0.5,"sp":0.86,"role":"confirmar"},{"id":"ulnt1","n":"ULNT1 (Mediano)","s":"Nervio mediano / tensión neural","se":0.7,"sp":0.71,"role":"apoyo"},{"id":"ulnt_combinados","n":"ULNT Combinados (≥1 positivo)","s":"Sensibilización neural global","se":0.97,"sp":0.51,"role":"descartar"},{"id":"shoulder_abduction_relief","n":"Shoulder Abduction Relief Test","s":"Alivio radicular cervical","se":0.49,"sp":0.76,"role":"apoyo"},{"id":"arm_squeeze","n":"Arm Squeeze Test","s":"Dolor radicular vs no radicular","se":0.97,"sp":0.97,"role":"confirmar"},{"id":"neck_tornado","n":"Neck Tornado Test","s":"Compresión dinámica cervical","se":0.85,"sp":0.87,"role":"apoyo"},{"id":"traccion_cervical","n":"Tracción Cervical Manual","s":"Alivio radicular","se":0.33,"sp":0.97,"role":"confirmar"}],"rodilla":[{"id":"thessaly","n":"Thessaly Test (20°)","s":"Menisco medial/lateral","se":0.66,"sp":0.53,"role":"apoyo"},{"id":"mcmurray","n":"McMurray Test","s":"Menisco","se":0.55,"sp":0.77,"role":"apoyo"},{"id":"joint_line_tenderness","n":"Joint Line Tenderness","s":"Menisco/articular","se":0.63,"sp":0.5,"role":"apoyo"},{"id":"lachman","n":"Lachman Test","s":"LCA","se":0.85,"sp":0.94,"role":"confirmar"},{"id":"pivot_shift","n":"Pivot Shift Test","s":"Inestabilidad rotacional LCA","se":0.42,"sp":0.98,"role":"confirmar"},{"id":"anterior_drawer_rodilla","n":"Anterior Drawer Rodilla","s":"LCA","se":0.62,"sp":0.88,"role":"apoyo"},{"id":"giving_way","n":"Giving Way Rotacional","s":"Inestabilidad funcional LCA","se":null,"sp":null,"role":"apoyo"}],"rodilla_akp":[{"id":"clarke_grind","n":"Patellar Grind Test (Clarke)","s":"Articulación patelofemoral","se":null,"sp":null,"role":"apoyo"},{"id":"patellar_apprehension","n":"Patellar Apprehension Test","s":"Inestabilidad patelar / MPFL","se":0.72,"sp":0.6,"role":"apoyo"},{"id":"lateral_glide","n":"Lateral Glide Test","s":"Hipermovilidad patelar / MPFL","se":null,"sp":null,"role":"apoyo"},{"id":"patellar_tilt","n":"Patellar Tilt Test","s":"Retináculo lateral","se":null,"sp":null,"role":"apoyo"},{"id":"j_sign","n":"J-Sign","s":"Maltracking patelar / displasia","se":null,"sp":null,"role":"apoyo"},{"id":"single_leg_squat","n":"Single-Leg Squat","s":"Control dinámico patelofemoral","se":null,"sp":null,"role":"apoyo"},{"id":"step_down","n":"Step-Down Test","s":"Control femoropatelar","se":null,"sp":null,"role":"apoyo"},{"id":"decline_squat","n":"Decline Squat Test","s":"Tendón patelar (tendinopatía)","se":null,"sp":null,"role":"apoyo"},{"id":"hoffa_test","n":"Hoffa Test","s":"Fat pad infrapatelar","se":null,"sp":null,"role":"apoyo"},{"id":"stutter_test","n":"Stutter Test","s":"Plica medial","se":null,"sp":null,"role":"apoyo"},{"id":"hughston_plica","n":"Hughston Plica Test","s":"Plica sintomática","se":null,"sp":null,"role":"apoyo"}],"cuadriceps":[{"id":"ext_resistida_cuad","n":"Extensión resistida cuádriceps","s":"Recto femoral / cuádriceps","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_knee_hip","n":"Extensión rodilla + flexión cadera resistida","s":"Recto femoral biarticular","se":null,"sp":null,"role":"apoyo"},{"id":"palpacion_gap_cuad","n":"Palpación gap muscular cuádriceps","s":"Rotura parcial/completa","se":null,"sp":null,"role":"confirmar"},{"id":"flexion_rodilla_cuad","n":"Flexión rodilla post-contusión","s":"Severidad contusión","se":null,"sp":null,"role":"apoyo"},{"id":"ely_test","n":"Ely Test","s":"Rigidez recto femoral","se":null,"sp":null,"role":"apoyo"}],"aductor":[{"id":"squeeze_90","n":"Squeeze Test 90°","s":"Aductor relacionado","se":0.56,"sp":0.79,"role":"apoyo"},{"id":"squeeze_0","n":"Squeeze Test 0°","s":"Aductor relacionado","se":0.45,"sp":0.9,"role":"apoyo"},{"id":"resist_add_max_abd","n":"Resisted Adduction in Maximal Abduction","s":"Dolor aductor funcional","se":null,"sp":null,"role":"apoyo"},{"id":"palp_origen_aductor","n":"Palpación origen aductor longus","s":"Adductor longus proximal","se":null,"sp":null,"role":"apoyo"},{"id":"copenhagen_test","n":"Copenhagen Adduction Test","s":"Fuerza aductora funcional","se":null,"sp":null,"role":"apoyo"}],"isquiotibiales":[{"id":"bent_knee_stretch","n":"Bent-knee Stretch Test","s":"Lesión proximal isquiotibiales","se":0.84,"sp":0.83,"role":"apoyo"},{"id":"puranen_orava","n":"Puranen-Orava Test","s":"Tendinopatía/strain proximal","se":0.76,"sp":null,"role":"apoyo"},{"id":"modified_bent_knee","n":"Modified Bent-knee Stretch","s":"Lesión proximal aguda","se":null,"sp":null,"role":"apoyo"},{"id":"palp_posterior_muslo","n":"Palpación posterior muslo","s":"Zona lesionada isquiotibiales","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_hamstring_curl","n":"Resisted Hamstring Curl","s":"Función muscular isquio","se":null,"sp":null,"role":"apoyo"},{"id":"standing_heel_drag","n":"Standing Heel-drag Test","s":"Activación excéntrica isquio","se":null,"sp":null,"role":"apoyo"}],"gemelo":[{"id":"dorsiflexion_pasiva","n":"Dorsiflexión pasiva rodilla extendida","s":"Gastrocnemio / tensión","se":null,"sp":null,"role":"apoyo"},{"id":"heel_raise_ext","n":"Heel Raise Rodilla Extendida","s":"Gastrocnemio","se":null,"sp":null,"role":"apoyo"},{"id":"heel_raise_flex","n":"Heel Raise Rodilla Flexionada","s":"Sóleo","se":null,"sp":null,"role":"apoyo"},{"id":"thompson_gemelo","n":"Thompson Test","s":"Tendón de Aquiles","se":0.96,"sp":0.93,"role":"confirmar"},{"id":"palp_gemelo","n":"Palpación musculatura posterior pantorrilla","s":"Gastrocnemio medial/lateral","se":null,"sp":null,"role":"apoyo"},{"id":"single_leg_hop_gemelo","n":"Single-leg Hop Test","s":"Función deportiva pantorrilla","se":null,"sp":null,"role":"apoyo"}]},"region_keywords":{"hombro":["hombro","glenohumeral","manguito","subacromial","bíceps","biceps","escapular","rotador","deltoides","acromion"],"cadera":["cadera","coxofemoral","acetabular","labrum","trocánter","inguinal","fai","iliopsoas","piriforme","glúteo","gluteo","cadera"],"lumbar":["lumbar","lumbalgia","ciática","ciatica","discal","sacroiliaca","sij","facetario","cauda equina","l1","l2","l3","l4","l5","s1"],"toracico":["torácico","toracico","dorsal","espalda alta","escapula","escápula","t1","t2","t3","t4","t5","costilla","costovertebral","cifosis","interescapular"],"tobillo":["tobillo","esguince","atfl","cfl","sindesmosis","peroné","perone","maléolo","maleolo","aquiles"],"pie":["pie","fascitis","plantar","talón","talon","metatarsal","metatarsalgia","antepié","antepie","retropié","retropie","mediopié","mediopie","morton","neuroma","hallux","juanete","sesamoid","tibial posterior","túnel tarsiano","tunel tarsiano","tarsiano","peroneos","reumatoide","calcáneo","calcaneo","dedos del pie","arco plantar","pie plano","pie cavo","mulder","tibial anterior","dorsiflexión","dorsiflexion","steppage","foot drop","pie caído","pie caido","fencer"],"codo":["codo","epicóndilo","epicondilo","epicondilitis","tennis elbow","olécranon","olecranon","cubital","humeral","epitróclea"],"cervical":["cervical","cervicalgia","cuello","radiculopatía cervical","radiculopatia cervical","braquialgia","c3","c4","c5","c6","c7"],"rodilla_akp":["rótula","rotula","patelofemoral","patelar","akp","dolor anterior rodilla","plica","hoffa","maltracking","jumper"],"rodilla":["rodilla","menisco","lca","ligamento cruzado","tibia","fémur distal","femur distal","crepitación rodilla"],"cuadriceps":["cuádriceps","cuadriceps","recto femoral","muslo anterior","contusión muslo","contusion muslo"],"aductor":["aductor","ingle","pubis","pubalgia","sínfisis","sinfisis","groin","aductores"],"isquiotibiales":["isquiotibiales","isquio","semimembranoso","semitendinoso","bíceps femoral","biceps femoral","muslo posterior","hamstring"],"gemelo":["gemelo","gastrocnemio","pantorrilla","sóleo","soleo","aquiles","tennis leg","triceps sural","tríceps sural"]},"red_flags":[{"n":"Anestesia en silla de montar","sug":"Síndrome Cauda Equina (CES)","urg":"emergencia","act":"Derivación urgente neurociugía"},{"n":"Retención urinaria aguda","sug":"Síndrome Cauda Equina (CES)","urg":"emergencia","act":"Urgencias hospitalarias inmediatas"},{"n":"Déficit motor progresivo","sug":"Compresión neural severa","urg":"urgente","act":"Derivación neurología/neurocirugía"},{"n":"Fiebre + dolor lumbar","sug":"Infección espinal (espondilodiscitis)","urg":"urgente","act":"Analítica urgente, derivación médico"},{"n":"Pérdida peso inexplicada + dolor","sug":"Posible malignidad vertebral","urg":"urgente","act":"Derivación oncología/médico"},{"n":"Dolor nocturno severo que no cede","sug":"Patología sistémica/maligna","urg":"urgente","act":"Derivación médico"},{"n":"Trauma + osteoporosis + dolor agudo","sug":"Fractura vertebral","urg":"urgente","act":"Radiografía urgente"},{"n":"Hinchazón aguda post-trauma articular","sug":"Fractura/luxación","urg":"urgente","act":"Radiografía urgente, inmovilización"},{"n":"Fiebre + bursitis o articulación caliente","sug":"Artritis séptica / bursitis séptica","urg":"emergencia","act":"Urgencias, antibióticos"},{"n":"Edema difuso pantorrilla sin trauma","sug":"TVP (Trombosis Venosa Profunda)","urg":"urgente","act":"Eco-doppler urgente, derivación médico"},{"n":"Dolor pecho + disnea","sug":"Patología cardiopulmonar","urg":"emergencia","act":"Urgencias inmediatas, ECG"},{"n":"Déficit neurológico agudo miembro superior","sug":"Mielopatía cervical / ACV","urg":"emergencia","act":"Urgencias neurológicas"},{"n":"Deformidad visible post-trauma","sug":"Luxación / fractura","urg":"urgente","act":"Inmovilización y urgencias"},{"n":"Síntomas bilaterales MMII progresivos","sug":"Mielopatía / Cauda Equina","urg":"emergencia","act":"Neuroimagen urgente"},{"n":"Dolor al sentarse + hematoma glúteo","sug":"Avulsión isquiotibiales proximal","urg":"urgente","act":"Imagen (MRI), valorar cirugía"},{"n":"Dolor pecho irradiado a brazo izquierdo","sug":"Cardiopatía isquémica","urg":"emergencia","act":"ECG urgente + urgencias"},{"n":"Cefalea brusca intensa (thunderclap)","sug":"Hemorragia subaracnoidea","urg":"emergencia","act":"Urgencias neurológicas inmediatas"},{"n":"Mielopatía cervical progresiva","sug":"Compresión medular cervical","urg":"urgente","act":"Neuroimagen + neurocirugía"}]};
const conditionMap = {};
CLINICAL_KB.conditions.forEach(c => { conditionMap[c.id] = c; });

const testsByRegion = {};
Object.entries(CLINICAL_KB.tests_by_region).forEach(([rid, tests]) => {
  testsByRegion[rid] = tests;
});

// ── Stripe ───────────────────────────────────────────────────────────────────
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// ── Price IDs (configurar en Railway como variables de entorno) ───────────────
const PRICE_IDS = {
  individual_mensual: process.env.PRICE_INDIVIDUAL_MONTHLY || 'price_1TllayPOSeyVBgtaGCjW8MQF',
  individual_anual:   process.env.PRICE_INDIVIDUAL_ANNUAL  || 'price_1TllblPOSeyVBgtaG7MboYdg',
  clinica_mensual:    process.env.PRICE_CLINICA_MONTHLY    || 'price_1TlldbPOSeyVBgtaAi5svWWE',
  clinica_anual:      process.env.PRICE_CLINICA_ANNUAL     || 'price_1TlleGPOSeyVBgtau2hQBmsN',
};
// Mapa inverso priceId → plan
const PLAN_MAP = Object.fromEntries(
  Object.entries(PRICE_IDS).filter(([,v]) => v).map(([k,v]) => [v, k])
);

// ── Rate limiting ────────────────────────────────────────────────────────────
const rateLimitMap = new Map();
function rateLimit(maxReqs, windowMs) {
  return (req, res, next) => {
    // Clave por usuario autenticado (token) o por IP real (trust proxy activado),
    // segmentada por endpoint (método+ruta) para que el límite de un endpoint no
    // se contamine con las llamadas a otro.
    const auth = req.headers.authorization || '';
    const who = auth.length > 30 ? 'u:' + auth.slice(-32) : 'ip:' + (req.ip || req.connection.remoteAddress);
    const key = who + '|' + req.method + req.baseUrl + req.path;
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    const times = (entry ? entry.times : []).filter(t => t > now - windowMs);
    if (times.length >= maxReqs) return res.status(429).json({ error: "Demasiadas peticiones. Espera un momento." });
    times.push(now);
    // Guardamos también la ventana, para que la limpieza periódica respete la
    // ventana real de cada endpoint (no un valor global hardcodeado).
    rateLimitMap.set(key, { times, windowMs });
    next();
  };
}

// Limpieza periódica del mapa de rate-limit: sin esto, cada usuario/IP/endpoint
// deja una entrada permanente y el mapa crece sin límite hasta agotar la memoria
// del servidor. Cada 5 min eliminamos las entradas cuyos timestamps ya caducaron,
// respetando la ventana propia de cada entrada.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    const win = (entry && entry.windowMs) || 60_000;
    const vivos = (entry && entry.times ? entry.times : []).filter(t => t > now - win);
    if (vivos.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, { times: vivos, windowMs: win });
  }
}, 5 * 60_000).unref();

// Middleware: exige un token de sesión válido de Supabase.
// Protege los endpoints de IA del uso por terceros (robo de cuota/coste).
function requireAuth() {
  return async (req, res, next) => {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: "No autorizado. Inicia sesión." });
    req.user = user;
    next();
  };
}

// ── CORS + Security ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

const allowedOrigins = [
  "http://localhost:3000","http://localhost:5500","http://localhost:8000","http://localhost:8080",
  "http://127.0.0.1:5500","http://127.0.0.1:3000","http://127.0.0.1:8000","http://127.0.0.1:8080",
  "https://fisioscript.com",
  "https://www.fisioscript.com",
  "https://fisioscript.pages.dev",
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_2,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser requests
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Allow any Cloudflare Pages preview URLs for this project
    if (origin.endsWith('.pages.dev') && origin.includes('fisioscript')) return cb(null, true);
    return cb(new Error("CORS no permitido"));
  },
  credentials: true,
}));

app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api/transcribe", express.raw({ type: "application/octet-stream", limit: "50mb" }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now()-start}ms`));
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({
  status: "ok", service: "FisioScript API v4.0",
  clinical_kb: {
    regions: Object.keys(CLINICAL_KB.regions).length,
    conditions: CLINICAL_KB.conditions.length,
    tests: Object.values(CLINICAL_KB.tests_by_region).flat().length,
    red_flags: CLINICAL_KB.red_flags.length,
  }
}));

// ── Build compact clinical context (solo lo esencial para el prompt) ──────────
function buildCompactContext() {
  // Lista compacta de condiciones: id, nombre, región, patrones, RTS días
  const condiciones = CLINICAL_KB.conditions.map(c => {
    const rts = c.rts_days?.[0] ? `${c.rts_days[0]}–${c.rts_days[1]}d` : 'variable';
    return `[${c.id}|${c.r}] ${c.n} | ${(c.p||[]).join('; ')} | RTS:${rts}`;
  }).join('\n');

  // Tests compactos: nombre, región, sens/espec
  const tests = Object.entries(CLINICAL_KB.tests_by_region).flatMap(([rid, ts]) =>
    ts.map(t => {
      let s = `${t.n}(${rid})→${t.s}`;
      if (t.se) s += ` Se:${Math.round(t.se*100)}%`;
      if (t.sp) s += ` Sp:${Math.round(t.sp*100)}%`;
      s += `|${t.role}`;
      return s;
    })
  ).join('\n');

  // Red flags compactas
  const redFlags = CLINICAL_KB.red_flags.map(r =>
    `⚠${r.n}→${r.sug}(${r.urg})`
  ).join('\n');

  return `=== KB FISIOSCRIPT v4.0 ===
CONDICIONES (id|región|nombre|patrones|RTS):
${condiciones}

TESTS:
${tests}

RED FLAGS:
${redFlags}
===`;
}

// Contexto extendido para una condición específica detectada
function getConditionContext(conditionId) {
  const c = conditionMap[conditionId];
  if (!c) return '';
  const fases = (c.fases||[]).map(f => `${f.n}: ${f.c}`).join(' | ');
  const rts = (c.criterios_rts||[]).join('; ');
  const recaida = (c.factores_recaida||[]).join('; ');
  const manuales = (c.tecnicas_manuales||[]).join('; ');
  const ej = c.ejercicio ? [
    ...(c.ejercicio.inicial||[]),
    ...(c.ejercicio.intermedio||[]),
    ...(c.ejercicio.avanzado||[])
  ].join('; ') : '';
  const edu = (c.educacion||[]).join('; ');
  return `\nPROTOCOLO DETALLADO [${conditionId}]:
Fases: ${fases}
RTS criterios: ${rts}
Factores recaída: ${recaida}
Técnicas manuales: ${manuales}
Ejercicio: ${ej}
Educación: ${edu}`;
}

// Detectar región probable del texto para añadir protocolo relevante
function detectRegion(text) {
  const t = text.toLowerCase();
  // Puntuamos cada región: nº de keywords distintas que aparecen, y damos un
  // pequeño extra a la coincidencia más específica (keyword más larga). Así una
  // palabra genérica no gana a un término específico, pero tampoco perdemos una
  // región que aparece varias veces. Devuelve la región ganadora (string) para
  // mantener compatibilidad con quien llama a detectRegion directamente.
  const scores = scoreRegions(t);
  return scores.length ? scores[0].rid : null;
}

// Devuelve un ranking de regiones [{rid, score, maxLen}] ordenado de mayor a menor.
function scoreRegions(textLower) {
  const t = textLower;
  const out = [];
  for (const [rid, keywords] of Object.entries(CLINICAL_KB.region_keywords)) {
    let hits = 0, maxLen = 0;
    for (const kw of keywords) {
      if (t.includes(kw)) { hits++; if (kw.length > maxLen) maxLen = kw.length; }
    }
    if (hits > 0) out.push({ rid, score: hits, maxLen });
  }
  // Orden: primero por nº de coincidencias, y a igualdad, por keyword más larga
  // (más específica). Esto resuelve los empates de forma clínicamente sensata.
  out.sort((a, b) => b.score - a.score || b.maxLen - a.maxLen);
  return out;
}

// Detecta hasta 2 regiones relevantes: la principal y una secundaria si tiene
// suficiente presencia (≥2 coincidencias, o una keyword muy específica). Captura
// los cuadros referidos (p.ej. cervical → brazo, lumbar → pierna) sin inflar el
// prompt: 2 regiones siguen siendo pocas condiciones.
function detectRegions(text) {
  const scores = scoreRegions(text.toLowerCase());
  if (!scores.length) return [];
  const regions = [scores[0].rid];
  if (scores[1] && (scores[1].score >= 2 || scores[1].maxLen >= 8)) {
    regions.push(scores[1].rid);
  }
  return regions;
}

// Empareja el nombre de un test propuesto por la IA con uno de la KB de forma
// robusta. Antes se comparaba solo la PRIMERA palabra (split(' ')[0]), lo que
// confundía "Thomas" con "Thompson" o cualquier test que empezara por "Single"/
// "Test". Ahora normalizamos (quitamos ruido como "test", "signo", "de") y
// exigimos que coincida una palabra SIGNIFICATIVA (≥4 letras) o el nombre casi
// completo. Más preciso y evita asignar la Se/Sp de un test a otro distinto.
function _testNameMatch(a, b) {
  if (!a || !b) return false;
  const STOP = new Set(['test','signo','sign','de','del','la','el','of','prueba','maniobra','y','con',
    // Palabras genéricas de posición/lado que NO identifican un test concreto:
    'single','leg','pierna','rodilla','knee','hip','cadera','shoulder','hombro',
    'derecha','izquierda','right','left','bilateral','active','activa','pasiva','passive',
    'resistida','resisted','stress','raise','elevacion']);
  const norm = s => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(w => w && !STOP.has(w));
  const wa = norm(a), wb = norm(b);
  if (!wa.length || !wb.length) return false;
  // Coincidencia si comparten alguna palabra significativa de ≥4 letras
  // (p.ej. "thompson", "spurling", "lachman"), que es lo que identifica el test.
  const sa = new Set(wa);
  for (const w of wb) {
    if (w.length >= 4 && sa.has(w)) return true;
  }
  return false;
}

// Obtener condiciones de una región de forma compacta
function getRegionProtocols(rid) {
  if (!rid) return '';
  const conds = CLINICAL_KB.conditions.filter(c => c.r === rid);
  if (!conds.length) return '';
  // Versión compacta: damos a la IA lo esencial para reconocer y manejar cada
  // condición (patrones, fases, RTS, ejercicio clave, educación clave) sin volcar
  // TODO el detalle de la KB. Esto mantiene la petición por debajo del límite de
  // 12000 tokens/min de Groq incluso en regiones con muchas condiciones (p.ej. pie).
  return '\nPROTOCOLOS REGIÓN ' + (CLINICAL_KB.regions[rid]||rid).toUpperCase() + ':\n' +
    conds.map(c => {
      const patrones = (c.p||[]).join(', ');
      const fases = (c.fases||[]).map(f => f.n).join(' → ');
      const rts = (c.rts_days && c.rts_days[0]) ? `${c.rts_days[0]}-${c.rts_days[1]||'?'} días` : '';
      // Solo 2 ejercicios representativos (inicial + avanzado) en vez de los 9
      const ej = c.ejercicio ? [
        (c.ejercicio.inicial||[])[0],
        (c.ejercicio.avanzado||[])[0]
      ].filter(Boolean).join('; ') : '';
      const edu = (c.educacion||[]).slice(0,2).join('; ');
      return `[${c.id}] ${c.n}\n  Señales: ${patrones}\n  Fases: ${fases}${rts?' | RTS: '+rts:''}\n  Ejercicio: ${ej}\n  Educación: ${edu}`;
    }).join('\n');
}

// Versión COMPLETA de una sola condición — para cuando ya se conoce el diagnóstico
// (endpoint /api/clinical/condition). No se usa en el prompt de generación masiva.
function getConditionFull(id) {
  const c = CLINICAL_KB.conditions.find(x => x.id === id);
  if (!c) return '';
  const fases = (c.fases||[]).map(f => `${f.n}: ${f.c}`).join(' | ');
  const rts = (c.criterios_rts||[]).join('; ');
  const manuales = (c.tecnicas_manuales||[]).join('; ');
  const ej = c.ejercicio ? [
    ...(c.ejercicio.inicial||[]), ...(c.ejercicio.intermedio||[]), ...(c.ejercicio.avanzado||[])
  ].join('; ') : '';
  const edu = (c.educacion||[]).join('; ');
  const recaida = (c.factores_recaida||[]).join('; ');
  return `[${c.id}] ${c.n}\n  Fases: ${fases}\n  RTS: ${rts}\n  Manual: ${manuales}\n  Ejercicio: ${ej}\n  Educación: ${edu}\n  Recaída: ${recaida}`;
}

const COMPACT_CONTEXT = buildCompactContext();

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE FIJO DEL PROMPT DE GENERACIÓN (para prompt caching de Groq)
// ───────────────────────────────────────────────────────────────────────────
// Este texto es IDÉNTICO en todas las peticiones a /api/generate, así que Groq
// lo cachea automáticamente y sus tokens dejan de contar para el límite TPM.
// Se calcula UNA vez al arrancar (no en cada petición). Incluye el esquema
// completo (primera visita Y seguimiento) para no romper el prefijo cacheable;
// la instrucción variable de cada petición le dice a la IA qué rama rellenar.
// Descripciones de campo aligeradas (palabras clave, no frases largas) para
// reducir tokens sin perder la guía que la IA necesita.
// ═══════════════════════════════════════════════════════════════════════════
const SYSTEM_GENERATE_FIXED = `Eres un fisioterapeuta clínico experto con acceso a una base de conocimiento (KB) validada.

INSTRUCCIONES:
1. Analiza la transcripción usando la KB de la región que se te facilita.
2. Probabilidad (0-100%) según patrones clínicos coincidentes.
3. Tests: usa sensibilidad/especificidad de la KB.
4. Recuperación y tratamiento: usa los protocolos del condition_id identificado.
5. Si no se menciona algo: [] para listas, "No mencionado" para texto.
6. Rellena SOLO la rama del esquema que indique el TIPO DE SESIÓN (primera_visita o seguimiento).

Devuelve ÚNICAMENTE este JSON (sin markdown ni texto extra). Usa la rama "primera_visita" O la rama "seguimiento" según corresponda:
{
  "historia": {
    "motivo": "localización, inicio, mecanismo, características del dolor (tipo, irradiación, ritmo)",
    "edad": "edad y demografía",
    "antecedentes": "médicos, quirúrgicos, lesiones previas en la zona",
    "medicacion": "medicación relevante",
    "deporte": "actividad física/laboral: nivel, frecuencia, demandas",
    "factores_contexto": "trabajo, sueño, estrés, expectativas, objetivos del paciente",
    "exploracion": "inspección, ROM en grados, palpación, fuerza, neurológico, EVA",
    "tratamiento": "técnicas y pautas de esta sesión",
    "observaciones": "evolución y factores psicosociales"
  },
  "soap": {
    "S": "subjetivo completo",
    "O": "objetivo: ROM en grados, tests y resultado",
    "A": "diagnóstico fisioterápico, estructuras afectadas, severidad",
    "P": "plan: técnicas con dosis, ejercicios, objetivos, próxima cita"
  },
  "banderas_rojas": [
    {"titulo": "nombre", "descripcion": "explicación", "severidad": "alta|media", "accion": "acción concreta"}
  ],
  "banderas_amarillas": [
    {"titulo": "nombre", "descripcion": "factor psicosocial", "severidad": "media|baja", "accion": "enfoque"}
  ],
  "hipotesis": {
    "principal": "diagnóstico más probable (nombre exacto de la KB si coincide)",
    "condition_id": "id exacto de la KB o null",
    "confianza": 0.75,
    "razonamiento": "qué patrones coinciden y cuáles no",
    "prioridad_derivacion": "null en la mayoría de casos. Si hay banderas rojas de urgencia/emergencia, aquí va el aviso: qué descartar primero y la acción (p.ej. 'Descartar Cauda Equina antes de tratar: derivación urgente'). El diagnóstico fisioterapéutico queda SUPEDITADO a esto.",
    "diferenciales": [
      {"nombre": "diferencial", "probabilidad": 30, "condition_id": "id o null"}
    ]
  },
  "tests": [
    {"nombre": "nombre", "zona": "región", "estructura": "estructura", "resultado": "positivo|negativo|no realizado", "sensibilidad": "valor% KB o null", "especificidad": "valor% KB o null", "interpretacion": "significado clínico"}
  ],
  "recuperacion": {
    "estimacion_dias": {"min": 14, "max": 42},
    "estimacion_texto": "tiempo esperado según KB",
    "fase_actual": "agudo|subagudo|crónico|rehabilitación|vuelta_actividad",
    "criterios_rts": ["criterio KB 1", "criterio KB 2"],
    "factores_riesgo_recaida": ["factor KB"],
    "notas": "consideraciones del caso"
  },
  "tratamiento_sugerido": {
    "fase_actual": "Fase aguda|Fase subaguda|Fase de carga|Fase funcional|Mantenimiento",
    "kb_protocolo": "protocolo KB del condition_id",
    "tecnicas_manuales": ["técnica KB con indicación"],
    "ejercicios_clave": ["ejercicio KB con dosis"],
    "educacion_paciente": ["mensaje educativo KB"],
    "proximos_pasos": "plan próximas sesiones",
    "derivacion": "derivación o 'No necesaria de momento'"
  },

  "objetivos_basales": [
    {"texto": "objetivo SMART con métrica (ej. EVA de 7 a ≤3 en 6 semanas)", "metrica": "EVA|ROM|fuerza|funcional", "valor_inicial": "partida", "valor_meta": "objetivo", "plazo": "plazo"}
  ],
  "pronostico": {"valoracion": "favorable|reservado|desfavorable", "razonamiento": "una frase según el caso y la KB"},

  "evolucion": {
    "tendencia": "mejora|estancamiento|empeoramiento",
    "resumen": "comparación con sesiones anteriores: dolor, función, respuesta",
    "cambio_eva": "evolución del dolor con números (ej. de 6 a 4)",
    "cambio_funcional": "cambios en ROM, fuerza o función vs sesiones previas",
    "adherencia": "¿hace los ejercicios? ¿cumple el plan? 'No mencionado' si no consta",
    "respuesta_tratamiento": "qué funciona y qué no",
    "ajuste_plan": "ajustes según evolución"
  },
  "diagnostico_seguimiento": {"confirmado": "se mantiene|revisado", "cambio": "nuevo dx y por qué, o 'Se mantiene el diagnóstico inicial'"},
  "objetivos_progreso": [
    {"objetivo": "objetivo basal previo", "estado": "cumplido|en progreso|sin avance|estancado", "nota": "comentario breve"}
  ],
  "fase_tratamiento": {"fase_actual": "fase actual", "progresion": "avanza|se mantiene|retrocede + explicación breve"},
  "tratamiento_hoy": {"aplicado": "qué se hizo hoy", "ajuste_plan": "qué cambia para la próxima", "ejercicios_actualizados": ["ejercicio casa con dosis"]},
  "alertas": ["estancamiento, recaída, abandono de adherencia, o 'considerar derivación si no mejora en X sesiones'. [] si no hay"]
}

IMPORTANTE — según el TIPO DE SESIÓN que se indique más abajo:
- Si es primera_visita: rellena objetivos_basales y pronostico; deja evolucion, diagnostico_seguimiento, objetivos_progreso, fase_tratamiento, tratamiento_hoy y alertas como [] o null.
- Si es seguimiento: rellena evolucion, diagnostico_seguimiento, objetivos_progreso, fase_tratamiento, tratamiento_hoy y alertas; deja objetivos_basales y pronostico como [] o null.

REGLAS:
- condition_id: ID exacto de la KB si coincide. Crítico para recuperación y tratamiento.
- BANDERAS ROJAS: si detectas una bandera roja de urgencia o emergencia, rellena hipotesis.prioridad_derivacion indicando qué hay que descartar y la acción, y refléjalo en el razonamiento ANTES del diagnóstico fisioterapéutico. La seguridad del paciente va primero: el diagnóstico musculoesquelético es secundario a descartar la patología grave.
- confianza 0.0-1.0 (confianza NETA): cuenta los patrones que COINCIDEN menos los que CONTRADICEN la hipótesis. 1-2 patrones netos 0.3-0.5; 3-4 netos 0.5-0.7; 5+ netos 0.7-0.95. Si hay señales que contradicen el diagnóstico, baja la confianza y menciónalas en el razonamiento (no las ocultes).
- estimacion_dias: usa rts_days de la KB si condition_id coincide.
- Sin mención: [] para listas, "No mencionado" para texto.
- Tratamiento exhaustivo: protocolos reales de fisioterapia.`;

// Índice mínimo de red flags (siempre relevantes, pesan poco). Se incluye en
// cada petición porque las banderas rojas pueden aplicar a cualquier región.
const REDFLAGS_COMPACT = 'BANDERAS ROJAS:\n' +
  CLINICAL_KB.red_flags.map(r => `⚠${r.n}→${r.sug} (${r.urg})`).join('\n');

// ── POST /api/transcribe — Whisper (Groq) ─────────────────────────────────────
// Recibe audio binario (webm/opus), lo transcribe con Whisper y devuelve el texto.
// El audio NO se almacena: se procesa en memoria y se descarta.
app.post("/api/transcribe", rateLimit(20, 60_000), requireAuth(), async (req, res) => {
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server not configured." });
  const audioBuffer = req.body;
  if (!audioBuffer || !audioBuffer.length) return res.status(400).json({ error: "No se recibió audio." });
  if (audioBuffer.length < 1000) return res.status(400).json({ error: "Audio demasiado corto." });
  if (audioBuffer.length > 45 * 1024 * 1024) return res.status(400).json({ error: "Audio demasiado largo." });

  const lang = (req.query.lang === 'en') ? 'en' : 'es';
  // Formato del audio según lo que mande el cliente (webm por defecto)
  const fmtParam = (req.query.fmt || 'webm').toLowerCase();
  const fmtMap = {
    webm: { mime: 'audio/webm', name: 'consulta.webm' },
    mp4:  { mime: 'audio/mp4',  name: 'consulta.mp4'  },
    m4a:  { mime: 'audio/mp4',  name: 'consulta.m4a'  },
    ogg:  { mime: 'audio/ogg',  name: 'consulta.ogg'  },
  };
  const fmt = fmtMap[fmtParam] || fmtMap.webm;

  const groqPrompt = lang === 'es'
    ? "Consulta de fisioterapia. Terminología clínica: lumbalgia, cervicalgia, tendinopatía, manguito rotador, isquiotibiales, propiocepción, dorsiflexión, EVA, ROM."
    : "Physiotherapy consultation. Clinical terminology.";

  // Función que hace una llamada a Groq con timeout largo
  async function callGroq() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 110_000);
    try {
      const form = new FormData();
      form.append("file", new Blob([audioBuffer], { type: fmt.mime }), fmt.name);
      form.append("model", "whisper-large-v3-turbo");
      form.append("language", lang);
      form.append("temperature", "0");
      form.append("response_format", "json");
      form.append("prompt", groqPrompt);

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  try {
    let response = await callGroq();

    // Reintento único ante saturación (429) o error de servidor de Groq (5xx)
    if (response.status === 429 || response.status >= 500) {
      await new Promise(r => setTimeout(r, 2000));
      response = await callGroq();
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Whisper error:", response.status, errText.slice(0, 200));
      if (response.status === 429) return res.status(429).json({ error: "Servicio de transcripción saturado. Inténtalo en unos segundos." });
      return res.status(502).json({ error: "Error al transcribir el audio." });
    }

    const data = await response.json();
    const text = (data.text || "").trim();
    return res.json({ text });
  } catch (err) {
    if (err.name === "AbortError") return res.status(504).json({ error: "La transcripción tardó demasiado." });
    console.error("Transcribe error:", err.message);
    return res.status(500).json({ error: "Error al transcribir." });
  }
});

// ── POST /api/generate ────────────────────────────────────────────────────────
app.post("/api/generate", rateLimit(20, 60_000), requireAuth(), async (req, res) => {
  const { text, lang, previous_session, episode, session_type } = req.body;
  const isEN = lang === 'en';
  if (!text || typeof text !== "string") return res.status(400).json({ error: isEN ? "Field 'text' is required." : "El campo 'text' es requerido." });
  if (text.trim().length < 10) return res.status(400).json({ error: isEN ? "Transcript too short." : "Transcripción demasiado corta." });
  if (text.length > 15_000) return res.status(400).json({ error: isEN ? "Transcript too long." : "Transcripción demasiado larga." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server not configured." });

  const langInstruction = isEN
    ? "Always respond in English. Use physiotherapy clinical terminology in English."
    : "Responde siempre en español. Usa terminología clínica de fisioterapia en español.";

  // Añadir protocolos de las regiones detectadas (hasta 2: principal + referida).
  // Capta cuadros irradiados sin perder los diferenciales de la zona secundaria.
  const detectedRegions = detectRegions(text);
  const regionProtocol = detectedRegions.map(r => getRegionProtocols(r)).filter(Boolean).join('\n');

  // ── Tipo de sesión: primera visita vs seguimiento ──────────────────────────
  // session_type lo envía el frontend; si no, se infiere de la presencia de episodio.
  const hasEpisode = (episode && typeof episode === 'object' && Array.isArray(episode.sessions) && episode.sessions.length)
                  || (previous_session && typeof previous_session === 'object');
  const isFollowUp = session_type === 'seguimiento' || (session_type !== 'primera_visita' && hasEpisode);

  let previousContext = "";
  if (isFollowUp) {
    const parts = [];

    if (episode && typeof episode === 'object') {
      // Contexto estructurado del EPISODIO (motivo de consulta actual)
      if (episode.diagnostico) parts.push(`Diagnóstico del episodio (primera visita): ${episode.diagnostico}`);
      if (episode.motivo_inicial) parts.push(`Motivo inicial del episodio: ${episode.motivo_inicial}`);
      if (episode.fecha_inicio) parts.push(`Fecha primera visita del episodio: ${episode.fecha_inicio}`);
      if (episode.fase_actual) parts.push(`Fase actual del tratamiento: ${episode.fase_actual}`);
      if (Array.isArray(episode.objetivos) && episode.objetivos.length)
        parts.push(`Objetivos basales establecidos: ${episode.objetivos.map(o => typeof o === 'string' ? o : (o.texto||o.objetivo||'')).filter(Boolean).join(' | ')}`);

      // Trayectoria EVA de las últimas sesiones
      if (Array.isArray(episode.sessions) && episode.sessions.length) {
        const traj = episode.sessions.slice(0, 4).map((s, i) => {
          const bits = [];
          if (s.fecha) bits.push(s.fecha);
          if (s.eva_pre !== null && s.eva_pre !== undefined) bits.push(`EVA ${s.eva_pre}${s.eva_post!==null&&s.eva_post!==undefined?'→'+s.eva_post:''}`);
          if (s.fase) bits.push(`fase: ${s.fase}`);
          if (s.tratamiento) bits.push(`tto: ${s.tratamiento}`);
          return `  • ${bits.join(', ')}`;
        }).join('\n');
        parts.push(`Trayectoria reciente (más reciente primero):\n${traj}`);
      }
      if (episode.num_sesiones) parts.push(`Sesiones previas en este episodio: ${episode.num_sesiones}`);
    } else if (previous_session && typeof previous_session === 'object') {
      // Compatibilidad: formato antiguo de una sola sesión
      const ps = previous_session;
      if (ps.fecha) parts.push(`Fecha sesión anterior: ${ps.fecha}`);
      if (ps.motivo) parts.push(`Motivo previo: ${ps.motivo}`);
      if (ps.diagnostico) parts.push(`Diagnóstico previo: ${ps.diagnostico}`);
      if (ps.fase) parts.push(`Fase previa: ${ps.fase}`);
      if (ps.eva_pre !== null && ps.eva_pre !== undefined) parts.push(`EVA previo: ${ps.eva_pre}${ps.eva_post!==null&&ps.eva_post!==undefined?` → ${ps.eva_post}`:''}`);
      if (ps.plan) parts.push(`Plan previo: ${ps.plan}`);
      if (ps.tratamiento) parts.push(`Tratamiento previo: ${ps.tratamiento}`);
      if (ps.numero_sesiones) parts.push(`Número de sesiones previas: ${ps.numero_sesiones}`);
    }

    previousContext = `

CONTEXTO DEL EPISODIO (esta es una sesión de SEGUIMIENTO):
${parts.join("\n")}

Esta es una REVISIÓN, no una primera visita. NO repitas la anamnesis (antecedentes, medicación, edad, deporte ya constan de la primera visita). Céntrate en el CAMBIO respecto a las sesiones anteriores de este episodio.`;
  }

  // Contexto clínico: enviamos el detalle SOLO de la región detectada + las
  // banderas rojas (siempre relevantes, pesan poco). NO enviamos el índice de
  // todas las condiciones: para diagnosticar la zona que el fisio explora, la IA
  // solo necesita los protocolos de esa región. Esto mantiene la petición muy por
  // debajo del límite de 12000 tokens/min de Groq, sin importar cuánto crezca la KB.
  let clinicalContext;
  if (regionProtocol) {
    clinicalContext = `${REDFLAGS_COMPACT}${regionProtocol}`;
  } else {
    // Sin región detectada: contexto compacto completo como fallback
    clinicalContext = COMPACT_CONTEXT;
  }

  // ── PROMPT EN DOS BLOQUES PARA APROVECHAR EL PROMPT CACHING DE GROQ ──────────
  // Groq cachea el PREFIJO común entre peticiones (gratis, automático) y esos
  // tokens cacheados NO cuentan para el límite de 12000 TPM. Por eso ponemos
  // PRIMERO todo lo que es idéntico en cada petición (rol + instrucciones +
  // esquema JSON, ~1700 tokens fijos) y DESPUÉS lo variable (idioma, contexto
  // clínico de la región, tipo de sesión, transcripción). Así el bloque fijo
  // se cachea y deja de consumir presupuesto TPM en cada llamada.

  // BLOQUE FIJO (cacheable): rol + esquema. Idéntico en TODAS las peticiones.
  const SYSTEM_FIXED = SYSTEM_GENERATE_FIXED;

  // BLOQUE VARIABLE: lo que cambia entre peticiones, va al final.
  const sessionRule = isFollowUp
    ? `SEGUIMIENTO: NO reconstruyas la anamnesis. En historia, los campos antecedentes/medicacion/edad/deporte deben ser "Sin cambios desde la primera visita" salvo que la transcripción mencione algo nuevo. Concéntrate en evolucion, objetivos_progreso, diagnostico_seguimiento, fase_tratamiento, tratamiento_hoy y alertas. Para "seguimiento", usa la estructura de seguimiento del esquema.`
    : `PRIMERA VISITA: anamnesis completa, screening exhaustivo de banderas rojas/amarillas, objetivos_basales medibles y pronostico inicial. Para "primera_visita", usa la estructura de primera visita del esquema.`;

  const system = `${SYSTEM_FIXED}

═══ CONTEXTO DE ESTA CONSULTA ═══
IDIOMA: ${langInstruction}
TIPO DE SESIÓN: ${sessionRule}
${clinicalContext}${previousContext}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  // Salvaguarda de longitud: el modelo tiene un límite de contexto. Una
  // transcripción muy larga (consulta de 30+ min) + system prompt + 4000 tokens
  // de respuesta puede superarlo y provocar un rechazo inmediato de Groq (502).
  // Recortamos a un máximo seguro (~24000 caracteres ≈ 6000 tokens) para que
  // la consulta SIEMPRE se procese, aunque sea aproximando. Mejor eso que perderla.
  const MAX_CHARS = 24000;
  let safeText = text;
  if (text.length > MAX_CHARS) {
    console.warn(`Transcripción larga (${text.length} chars), recortando a ${MAX_CHARS}`);
    safeText = text.slice(0, MAX_CHARS);
  }

  try {
    // Llamada a Groq reutilizable, para poder reintentar con menos tokens si
    // Groq rechaza por límite TPM (413). maxTok ajustable.
    const callGroqGen = (maxTok) => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: maxTok,
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Transcripción:\n\n${safeText}` },
        ],
      }),
      signal: controller.signal,
    });

    let response = await callGroqGen(2500);

    // Si Groq rechaza por exceder el límite TPM (413/rate_limit en tokens),
    // reintentamos UNA vez pidiendo menos tokens de respuesta. Así una consulta
    // nunca falla del todo solo porque el prompt + respuesta rozan el límite.
    if (response.status === 413) {
      const errBody = await response.clone().json().catch(() => ({}));
      console.warn('Groq 413 (TPM), reintentando con max_tokens reducido:', JSON.stringify(errBody).slice(0,200));
      response = await callGroqGen(1500);
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Groq /generate error:', response.status, JSON.stringify(err).slice(0, 400));
      if (process.env.SENTRY_DSN) { try { Sentry.captureMessage(`Groq generate ${response.status}: ${JSON.stringify(err).slice(0,200)}`, 'error'); } catch(_){} }
      if (response.status === 429) return res.status(429).json({ error: "Servicio saturado. Inténtalo en unos segundos." });
      if (response.status === 413) return res.status(413).json({ error: "La consulta es demasiado extensa para procesarla ahora. Inténtalo de nuevo en un minuto." });
      return res.status(502).json({ error: "Error al procesar con IA." });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: "Respuesta inesperada de la IA." });

    let parsed;
    try { parsed = JSON.parse(match[0]); }
    catch (e) { return res.status(502).json({ error: "Error al parsear respuesta." }); }

    // Limpiar posibles claves-comentario que la IA pudiera copiar del esquema
    // (las que empiezan por "//"). No deben llegar al cliente.
    for (const k of Object.keys(parsed)) { if (k.startsWith('//')) delete parsed[k]; }

    // Defaults y normalización
    parsed.historia = parsed.historia || {};
    parsed.soap = parsed.soap || {};
    parsed.banderas_rojas = Array.isArray(parsed.banderas_rojas) ? parsed.banderas_rojas : [];
    parsed.banderas_amarillas = Array.isArray(parsed.banderas_amarillas) ? parsed.banderas_amarillas : [];
    parsed.hipotesis = parsed.hipotesis || {};
    parsed.tests = Array.isArray(parsed.tests) ? parsed.tests : [];
    parsed.recuperacion = parsed.recuperacion || {};
    parsed.tratamiento_sugerido = parsed.tratamiento_sugerido || {};
    if (parsed.evolucion && typeof parsed.evolucion === "object") {
      // keep as-is
    } else {
      parsed.evolucion = null;
    }
    // Marcar el tipo de sesión para que el frontend sepa qué mostrar
    parsed._session_type = isFollowUp ? 'seguimiento' : 'primera_visita';
    // Normalizar campos específicos de cada tipo
    if (isFollowUp) {
      parsed.objetivos_progreso = Array.isArray(parsed.objetivos_progreso) ? parsed.objetivos_progreso : [];
      parsed.diagnostico_seguimiento = parsed.diagnostico_seguimiento || null;
      parsed.fase_tratamiento = parsed.fase_tratamiento || null;
      parsed.tratamiento_hoy = parsed.tratamiento_hoy || null;
      parsed.alertas = Array.isArray(parsed.alertas) ? parsed.alertas : [];
    } else {
      parsed.objetivos_basales = Array.isArray(parsed.objetivos_basales) ? parsed.objetivos_basales : [];
      parsed.pronostico = parsed.pronostico || null;
    }

    // Enriquecer desde KB si hay condition_id válido
    const cid = parsed.hipotesis?.condition_id;
    const cond = cid ? conditionMap[cid] : null;

    if (cond) {
      // Enriquecer recuperación con datos reales de KB
      if (cond.rts_days && cond.rts_days[0]) {
        parsed.recuperacion._kb_rts_days = { min: cond.rts_days[0], max: cond.rts_days[1] };
        // Si la IA no dio estimación, usar la de KB
        if (!parsed.recuperacion.estimacion_dias?.min) {
          parsed.recuperacion.estimacion_dias = { min: cond.rts_days[0], max: cond.rts_days[1] };
        }
      }
      // Enriquecer tratamiento con protocolo de KB
      if (cond.tratamiento && !parsed.tratamiento_sugerido._kb_tratamiento) {
        parsed.tratamiento_sugerido._kb_tratamiento = cond.tratamiento;
      }
      parsed.hipotesis._kb_condition_name = cond.n;

      // Protocolo de ejercicios estructurado por fases desde la KB
      if (cond.ejercicio) {
        parsed.protocolo_ejercicios = {
          condition_id: cid,
          condition_name: cond.n,
          inicial: cond.ejercicio.inicial || [],
          intermedio: cond.ejercicio.intermedio || [],
          avanzado: cond.ejercicio.avanzado || [],
          tecnicas_manuales: cond.tecnicas_manuales || [],
          criterios_rts: cond.criterios_rts || [],
          factores_recaida: cond.factores_recaida || [],
          educacion: cond.educacion || [],
          fases: cond.fases || [],
        };
      }
    }

    // Enriquecer tests con datos de KB
    parsed.tests = parsed.tests.map(t => {
      if (t.sensibilidad || t.especificidad) return t;
      // Buscar en KB por nombre similar
      for (const [rid, tests] of Object.entries(CLINICAL_KB.tests_by_region)) {
        const match = tests.find(kt => _testNameMatch(t.nombre, kt.n));
        if (match && (match.se || match.sp)) {
          t.sensibilidad = match.se ? Math.round(match.se*100)+'%' : null;
          t.especificidad = match.sp ? Math.round(match.sp*100)+'%' : null;
          break;
        }
      }
      return t;
    });

    // Normalizar resultado de tests
    parsed.tests = parsed.tests.map(t => ({
      ...t,
      resultado: (t.resultado||'').toLowerCase().includes('pos') ? 'positivo'
        : (t.resultado||'').toLowerCase().includes('neg') ? 'negativo'
        : t.resultado || 'no realizado',
    }));

    console.log(`✓ cond_id:${cid||'null'} | confianza:${parsed.hipotesis?.confianza} | red_flags:${parsed.banderas_rojas.length} | tests:${parsed.tests.length}`);
    return res.json(parsed);

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return res.status(504).json({ error: "La IA tardó demasiado. Inténtalo de nuevo." });
    console.error("Error generate:", err.message);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /api/evolucion — resumen de evolución del paciente ───────────────────
app.post("/api/evolucion", rateLimit(15, 60_000), requireAuth(), async (req, res) => {
  const { patient, sessions, totalSessions } = req.body || {};
  if (!sessions || typeof sessions !== "string") return res.status(400).json({ error: "Faltan datos de sesiones." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server not configured." });

  const prompt = `Eres un fisioterapeuta experto redactando un resumen clínico de evolución. A partir del historial de sesiones de un paciente, redacta un párrafo profesional y conciso (máximo 120 palabras) que sintetice: el motivo inicial, la evolución del dolor y la función a lo largo de las sesiones, la respuesta al tratamiento, y el estado actual. Usa lenguaje clínico claro. No inventes datos que no estén. Responde SOLO con el párrafo, sin encabezados.

Paciente: ${patient||'—'} (${totalSessions||0} sesiones)
Historial:
${sessions.slice(0, 6000)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: "Servicio saturado." });
      return res.status(502).json({ error: "Error al procesar con IA." });
    }
    const data = await response.json();
    const resumen = data.choices?.[0]?.message?.content?.trim() || "";
    return res.json({ resumen });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return res.status(504).json({ error: "La IA tardó demasiado." });
    console.error("Error evolucion:", err.message);
    return res.status(500).json({ error: "Error interno." });
  }
});

// ── POST /api/derivacion — informe formal de derivación a especialista ────────
app.post("/api/derivacion", rateLimit(15, 60_000), requireAuth(), async (req, res) => {
  const { patient, sessions, totalSessions, especialista, motivo } = req.body || {};
  if (!sessions || typeof sessions !== "string") return res.status(400).json({ error: "Faltan datos de sesiones." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server not configured." });

  const esp = especialista || "Traumatología";

  const prompt = `Eres un fisioterapeuta colegiado redactando un INFORME DE DERIVACIÓN formal para remitir a un paciente a un médico especialista (${esp}). A partir del historial clínico, redacta el cuerpo del informe en lenguaje médico profesional, objetivo y conciso.

Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin texto adicional, sin markdown) con esta estructura:
{
  "resumen_clinico": "2-4 frases: motivo inicial de consulta, tiempo de evolución y curso clínico observado a lo largo de las sesiones",
  "hallazgos_relevantes": ["hallazgo objetivo 1 (tests positivos, signos)", "hallazgo 2", "..."],
  "tratamiento_realizado": "1-2 frases: qué tratamiento de fisioterapia se ha aplicado y durante cuánto",
  "respuesta_tratamiento": "1-2 frases: cómo ha respondido el paciente (mejoría, estancamiento, empeoramiento)",
  "motivo_derivacion": "1-2 frases: por qué se deriva y qué se solicita al especialista (valoración, prueba de imagen, etc.)",
  "sospecha_diagnostica": "impresión diagnóstica del fisioterapeuta, indicando que es orientativa"
}

No inventes datos que no estén en el historial. Si falta información para un campo, déjalo breve o indica "No consta".

Especialista destino: ${esp}
${motivo ? `Motivo indicado por el fisioterapeuta: ${motivo}` : ''}
Paciente: ${patient||'—'} (${totalSessions||0} sesiones)
Historial clínico:
${sessions.slice(0, 6000)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: "Servicio saturado." });
      return res.status(502).json({ error: "Error al procesar con IA." });
    }
    const data = await response.json();
    let parsed;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch(e) {
      return res.status(502).json({ error: "Respuesta de IA no válida." });
    }
    return res.json({ derivacion: parsed });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return res.status(504).json({ error: "La IA tardó demasiado." });
    console.error("Error derivacion:", err.message);
    return res.status(500).json({ error: "Error interno." });
  }
});

// ── POST /api/rehipotesis — recalcular hipótesis con tests confirmados ────────
app.post("/api/rehipotesis", rateLimit(15, 60_000), requireAuth(), async (req, res) => {
  const { text, tests } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "El campo 'text' es requerido." });
  if (text.length > 15_000) return res.status(400).json({ error: "Texto demasiado largo." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server not configured." });

  // Resumen de los tests marcados por el fisio
  const testsTxt = Array.isArray(tests) && tests.length
    ? tests.map(t => `${t.nombre || ''}: ${t.resultado || ''}${t.sensibilidad ? ` (Se ${t.sensibilidad}, Sp ${t.especificidad || '—'})` : ''}`).join('\n')
    : '';

  const detectedRegions = detectRegions(text);
  const regionProtocol = detectedRegions.map(r => getRegionProtocols(r)).filter(Boolean).join('\n');

  // Mismo criterio que /generate: solo región detectada + red flags.
  const clinicalContext = regionProtocol
    ? `${REDFLAGS_COMPACT}${regionProtocol}`
    : COMPACT_CONTEXT;

  const system = `Eres un fisioterapeuta clínico experto con acceso a una base de conocimiento validada. Razonas de forma BAYESIANA: la historia y los síntomas establecen la probabilidad de partida (probabilidad pre-test), y los tests la AJUSTAN según su fuerza estadística. Los tests NO sustituyen al cuadro clínico: lo refinan.

${clinicalContext}

TAREA: El fisioterapeuta ha COMPLETADO la exploración física y ha confirmado los resultados de los tests. Recalcula la hipótesis INTEGRANDO los tests con los signos y síntomas de la historia, ponderando cada test según su poder diagnóstico. El cuadro de síntomas es el ancla; cada test sube o baja la probabilidad en la medida que le corresponde por su sensibilidad y especificidad.

TESTS CONFIRMADOS POR EL FISIOTERAPEUTA:
${testsTxt || 'Ninguno'}

Devuelve ÚNICAMENTE este JSON, sin markdown ni texto adicional:
{
  "hipotesis": {
    "principal": "diagnóstico más probable tras integrar tests Y síntomas (nombre exacto de la base de datos si coincide)",
    "condition_id": "id exacto de la base de datos o null",
    "confianza": 0.75,
    "razonamiento": "razonamiento clínico: cómo el cuadro de síntomas establece la base, y cómo cada test la modifica (qué refuerza, qué matiza, qué hallazgo es discordante si lo hay)",
    "diferenciales": [
      {"nombre": "diferencial 1", "probabilidad": 30, "condition_id": "id o null"},
      {"nombre": "diferencial 2", "probabilidad": 15, "condition_id": "id o null"}
    ],
    "cambio_diagnostico": {"hubo_cambio": false, "antes": "dx previo o null", "despues": "dx nuevo o null", "motivo": "test concreto y por qué justifica el cambio, o null si no hubo cambio"}
  }
}

PESO DE CADA TEST (cuánto debe mover la probabilidad):
- Especificidad ≥90% POSITIVO → mueve MUCHO hacia confirmar (descarta poco si es negativo).
- Sensibilidad ≥90% NEGATIVO → mueve MUCHO hacia descartar (confirma poco si es positivo).
- Sensibilidad/Especificidad 75-89% → efecto MODERADO: refuerza o matiza, pero no decide por sí solo.
- Sensibilidad/Especificidad <75%, o test SIN datos de Se/Sp → efecto LEVE: solo apoyo cualitativo, nunca confirma ni descarta por sí mismo.

REGLA ANTI-VUELCO (crítica — evita que un test se cargue el cuadro clínico):
- El diagnóstico principal NO cambia por un único test, SALVO que ese test sea de alta especificidad (≥85%) positivo, O de alta sensibilidad (≥85%) negativo, Y el nuevo diagnóstico sea coherente con AL MENOS un signo/síntoma de la historia.
- Si un cuadro de síntomas es claro y coherente (varios patrones coincidentes) y UN test lo contradice, NO vuelques el diagnóstico: refleja ese test como "hallazgo discordante" en el razonamiento y mantén el principal, bajando algo la confianza.
- Un cambio de principal requiere evidencia de tests FUERTE y COHERENTE (idealmente más de un test, o un test potente alineado con la historia), no un único hallazgo aislado.

CONFIANZA (0.0-1.0):
- Parte de la confianza pre-test (según patrones de síntomas coincidentes) y ajústala con los tests según su peso.
- Tests potentes y concordantes con los síntomas → sube la confianza con claridad.
- Hallazgos discordantes o tests débiles → la confianza sube poco o incluso baja.
- No infles la confianza solo porque hay tests: un test débil aporta poco.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Historia clínica y tests:\n\n${text}` },
        ],
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: "Servicio saturado. Inténtalo en unos segundos." });
      return res.status(502).json({ error: "Error al procesar con IA." });
    }
    const data = await response.json();
    let parsed;
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}"); }
    catch(e) { return res.status(502).json({ error: "Respuesta de IA no válida." }); }
    if (!parsed.hipotesis) return res.status(502).json({ error: "Respuesta incompleta de la IA." });
    return res.json({ hipotesis: parsed.hipotesis });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return res.status(504).json({ error: "La IA tardó demasiado." });
    console.error("Rehipotesis error:", err.message);
    return res.status(500).json({ error: "Error interno." });
  }
});

// ── GET /api/clinical/condition/:id ──────────────────────────────────────────
app.get("/api/clinical/condition/:id", requireAuth(), (req, res) => {
  const cid = req.params.id;
  const cond = conditionMap[cid];
  if (!cond) return res.status(404).json({ error: "Condición no encontrada." });
  const tests = testsByRegion[cond.r] || [];
  res.json({ condition: cond, tests: tests.slice(0,10) });
});

// ── GET /api/clinical/region/:id ─────────────────────────────────────────────
app.get("/api/clinical/region/:id", requireAuth(), (req, res) => {
  const rid = req.params.id;
  const conditions = CLINICAL_KB.conditions.filter(c => c.r === rid);
  const tests = testsByRegion[rid] || [];
  const redFlags = CLINICAL_KB.red_flags;
  res.json({ region: CLINICAL_KB.regions[rid], conditions, tests, red_flags: redFlags });
});

// ── GET /api/prices ───────────────────────────────────────────────────────────
// Devuelve los price IDs públicos para que el frontend inicie el checkout.
// Rate limit generoso (60/min): el uso legítimo son 1-2 llamadas por intento de
// pago, pero el límite corta un martilleo automatizado del endpoint.
app.get("/api/prices", rateLimit(60, 60_000), (req, res) => {
  res.json({
    individual_mensual: PRICE_IDS.individual_mensual,
    individual_anual:   PRICE_IDS.individual_anual,
    clinica_mensual:    PRICE_IDS.clinica_mensual,
    clinica_anual:      PRICE_IDS.clinica_anual,
  });
});

// ── DELETE /api/account ───────────────────────────────────────────────────────
app.delete("/api/account", rateLimit(5, 60_000), async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: "No autorizado." });
  const token = auth.slice(7);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: "Configuración incompleta." });
  try {
    // Verify token and get user
    const verifyRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` }
    });
    const user = await verifyRes.json();
    if (!user?.id) return res.status(401).json({ error: "Token inválido." });

    // Registrar el trial consumido ANTES de borrar (anti-abuso: que no pueda
    // re-registrarse con el mismo email y obtener otra prueba gratuita)
    try {
      const email = (user.email || '').toLowerCase().trim();
      const trialStart = user.user_metadata?.trial_start || user.created_at;
      if (email) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/used_trials`, {
          method: 'POST',
          headers: { ...sbAdmin(), 'Prefer': 'resolution=ignore-duplicates' },
          body: JSON.stringify({ email, trial_start: trialStart }),
        });
      }
    } catch(e) { /* no bloquear el borrado por esto */ }

    // Delete user from Supabase
    const deleteRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` }
    });
    if (!deleteRes.ok) throw new Error('Error al eliminar usuario');
    console.log(`✓ Cuenta eliminada: ${user.email}`);
    return res.json({ ok: true });
  } catch(e) {
    console.error('Delete account error:', e.message);
    return res.status(500).json({ error: "Error al eliminar la cuenta." });
  }
});

// ── POST /api/trial/verify — anti-abuso de pruebas gratuitas ──────────────────
// Registra la primera vez que un email inicia un trial. Si el email ya consumió
// un trial antes (aunque borrara la cuenta), restaura la fecha de inicio ORIGINAL
// en sus metadatos, de modo que no obtiene días gratis de nuevo.
app.post("/api/trial/verify", rateLimit(20, 60_000), async (req, res) => {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado." });

  const email = (user.email || '').toLowerCase().trim();
  const currentStart = user.user_metadata?.trial_start || user.created_at;
  if (!email) return res.json({ trial_start: currentStart });

  try {
    // ¿Este email ya consumió un trial?
    const lookupRes = await fetch(
      `${SB_REST()}/used_trials?email=eq.${encodeURIComponent(email)}&select=trial_start`,
      { headers: sbAdmin() }
    );
    const rows = await lookupRes.json();
    const stored = Array.isArray(rows) && rows[0]?.trial_start;

    if (!stored) {
      // Primera vez: registrar el inicio del trial
      await fetch(`${SB_REST()}/used_trials`, {
        method: 'POST',
        headers: { ...sbAdmin(), 'Prefer': 'resolution=ignore-duplicates' },
        body: JSON.stringify({ email, trial_start: currentStart }),
      });
      return res.json({ trial_start: currentStart });
    }

    // Ya existía: si la fecha actual del usuario es más reciente que la original
    // (se re-registró), restaurar la fecha original en sus metadatos.
    if (new Date(currentStart) > new Date(stored)) {
      try {
        const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { headers: sbAdmin() });
        const u = await r.json();
        const existing = u?.user_metadata || {};
        await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
          method: 'PUT',
          headers: sbAdmin(),
          body: JSON.stringify({ user_metadata: { ...existing, trial_start: stored } }),
        });
        console.log(`⚠ Trial reutilizado detectado: ${email} → restaurada fecha original ${stored}`);
      } catch(e) { /* devolver la fecha igualmente */ }
    }
    return res.json({ trial_start: stored });
  } catch(e) {
    console.error('Trial verify error:', e.message);
    // Ante error, no bloquear al usuario: devolver su fecha actual
    return res.json({ trial_start: currentStart });
  }
});

// ── Helper: verificar token y devolver el usuario ────────────────────────────
async function verifyUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` }
    });
    const u = await r.json();
    return u?.id ? u : null;
  } catch(e) { return null; }
}

// Cabeceras admin de Supabase (service key — ignora RLS)
function sbAdmin() {
  return {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
}
const SB_REST = () => `${process.env.SUPABASE_URL}/rest/v1`;

// ── GET /api/clinic — info de la clínica del usuario (como owner o miembro) ───
app.get("/api/clinic", rateLimit(30, 60_000), async (req, res) => {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado." });
  try {
    // ¿Es miembro de alguna clínica?
    const memRes = await fetch(`${SB_REST()}/clinic_members?user_id=eq.${user.id}&select=clinic_id,role`, { headers: sbAdmin() });
    const memberships = await memRes.json();
    if (!memRes.ok || !Array.isArray(memberships)) {
      console.error('✗ GET /api/clinic — error consultando clinic_members:', memRes.status, JSON.stringify(memberships).slice(0, 200));
      return res.json({ clinic: null });
    }
    if (!memberships.length) return res.json({ clinic: null });

    const clinicId = memberships[0].clinic_id;
    const myRole = memberships[0].role;

    const clinicRes = await fetch(`${SB_REST()}/clinics?id=eq.${clinicId}&select=*`, { headers: sbAdmin() });
    const clinics = await clinicRes.json();
    const clinic = clinics?.[0];
    if (!clinic) return res.json({ clinic: null });

    const allMembersRes = await fetch(`${SB_REST()}/clinic_members?clinic_id=eq.${clinicId}&select=user_id,role,email,name,added_at`, { headers: sbAdmin() });
    const members = await allMembersRes.json();

    return res.json({ clinic: { ...clinic, myRole, members: Array.isArray(members) ? members : [] } });
  } catch(e) {
    console.error('GET clinic error:', e.message);
    return res.status(500).json({ error: "Error al obtener la clínica." });
  }
});

// ── POST /api/clinic/member — invitar (añadir) un fisio por email ─────────────
app.post("/api/clinic/member", rateLimit(10, 60_000), async (req, res) => {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado." });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email requerido." });

  try {
    // 1. Buscar la clínica donde el solicitante es OWNER
    const clinicRes = await fetch(`${SB_REST()}/clinics?owner_id=eq.${user.id}&select=*`, { headers: sbAdmin() });
    const clinics = await clinicRes.json();
    const clinic = clinics?.[0];
    if (!clinic) return res.status(403).json({ error: "Solo el propietario de una clínica puede añadir miembros." });

    // 2. Comprobar límite de plazas
    const membersRes = await fetch(`${SB_REST()}/clinic_members?clinic_id=eq.${clinic.id}&select=user_id`, { headers: sbAdmin() });
    const members = await membersRes.json();
    if (Array.isArray(members) && members.length >= clinic.seats) {
      return res.status(403).json({ error: `Has alcanzado el límite de ${clinic.seats} fisioterapeutas. Amplía las plazas para añadir más.` });
    }

    // 3. Buscar al usuario invitado por email
    const invitedId = await resolveUserId('', email);
    if (!invitedId) return res.status(404).json({ error: "No existe ningún usuario de FisioScript con ese email. Pídele que se registre primero." });

    // 4. Datos del invitado (nombre)
    const invitedRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${invitedId}`, { headers: sbAdmin() });
    const invited = await invitedRes.json();
    const invitedName = invited?.user_metadata?.name || email.split('@')[0];

    // 5. Insertar miembro (upsert para evitar duplicados)
    const insRes = await fetch(`${SB_REST()}/clinic_members`, {
      method: 'POST',
      headers: { ...sbAdmin(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ clinic_id: clinic.id, user_id: invitedId, role: 'member', email, name: invitedName }),
    });
    if (!insRes.ok) {
      const t = await insRes.text();
      console.error('Insert member error:', t.slice(0,200));
      return res.status(500).json({ error: "No se pudo añadir el miembro." });
    }

    // 5b. Re-comprobar el límite TRAS insertar (cierra la carrera de dos invitaciones
    // simultáneas que leyeron el conteo a la vez). Si al recontar nos hemos pasado
    // del límite Y este usuario es el sobrante (no estaba ya dentro), lo quitamos.
    try {
      const recheckRes = await fetch(`${SB_REST()}/clinic_members?clinic_id=eq.${clinic.id}&select=user_id`, { headers: sbAdmin() });
      const after = await recheckRes.json();
      const wasAlreadyMember = Array.isArray(members) && members.some(m => m.user_id === invitedId);
      if (Array.isArray(after) && after.length > clinic.seats && !wasAlreadyMember) {
        // Nos pasamos por una inserción concurrente: revertir esta.
        await fetch(`${SB_REST()}/clinic_members?clinic_id=eq.${clinic.id}&user_id=eq.${invitedId}`, {
          method: 'DELETE', headers: sbAdmin(),
        });
        return res.status(409).json({ error: `Se han ocupado todas las plazas (${clinic.seats}) mientras añadías a este fisioterapeuta. Amplía las plazas e inténtalo de nuevo.` });
      }
    } catch(e) {
      console.warn('Re-chequeo de plazas tras insertar miembro falló (no crítico):', e.message);
    }

    // 6. Marcar el plan del invitado como clinica (para que pase el muro de acceso).
    // Reintentamos hasta 3 veces ante fallos transitorios, porque si esto falla
    // el fisio queda sin acceso. Solo si los 3 intentos fallan avisamos al dueño.
    let planUpdated = false;
    for (let intento = 1; intento <= 3; intento++) {
      try {
        await updateUserPlan(invitedId, clinic.plan);
        planUpdated = true; break; // si no lanzó, fue correcto
      } catch(e) {
        console.error(`Error actualizando plan del invitado (intento ${intento}/3):`, e.message);
        if (intento === 3 && process.env.SENTRY_DSN) {
          try { Sentry.captureException(e, { tags: { area: 'invite_member_plan' }, extra: { invitedId, plan: clinic.plan } }); } catch(_){}
        }
      }
      if (!planUpdated && intento < 3) await new Promise(r => setTimeout(r, 400));
    }
    if (!planUpdated && process.env.SENTRY_DSN) {
      try { Sentry.captureMessage(`No se pudo activar el plan del fisio invitado ${invitedId} tras 3 intentos`, 'warning'); } catch(_){}
    }

    return res.json({ ok: true, planUpdated, member: { user_id: invitedId, email, name: invitedName, role: 'member' } });
  } catch(e) {
    console.error('Add member error:', e.message);
    return res.status(500).json({ error: "Error al añadir el miembro." });
  }
});

// ── DELETE /api/clinic/member — quitar un fisio ──────────────────────────────
app.delete("/api/clinic/member", rateLimit(10, 60_000), async (req, res) => {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado." });
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId requerido." });

  try {
    const clinicRes = await fetch(`${SB_REST()}/clinics?owner_id=eq.${user.id}&select=*`, { headers: sbAdmin() });
    const clinics = await clinicRes.json();
    const clinic = clinics?.[0];
    if (!clinic) return res.status(403).json({ error: "Solo el propietario puede quitar miembros." });
    if (userId === user.id) return res.status(400).json({ error: "El propietario no puede quitarse a sí mismo." });

    const delRes = await fetch(`${SB_REST()}/clinic_members?clinic_id=eq.${clinic.id}&user_id=eq.${userId}`, {
      method: 'DELETE', headers: sbAdmin(),
    });
    if (!delRes.ok) return res.status(500).json({ error: "No se pudo quitar el miembro." });

    // Devolver al usuario quitado a plan trial cancelado
    try { await updateUserPlan(userId, 'cancelled'); }
    catch(e) {
      // Si falla, el fisio expulsado mantendría acceso de clínica: hay que saberlo.
      console.error(`✗ No se pudo revertir el plan del miembro expulsado ${userId}:`, e.message);
      if (process.env.SENTRY_DSN) { try { Sentry.captureException(e, { tags: { area: 'remove_member_plan' }, extra: { userId, clinicId: clinic.id } }); } catch(_){} }
    }

    return res.json({ ok: true });
  } catch(e) {
    console.error('Remove member error:', e.message);
    return res.status(500).json({ error: "Error al quitar el miembro." });
  }
});

// ── POST /api/clinic/seats — ampliar plazas (+5€/mes por fisio extra) ─────────
// Modifica la suscripción de Stripe añadiendo (o incrementando) el item de plaza
// extra, con prorrateo automático, y actualiza el límite en la base de datos.
app.post("/api/clinic/seats", rateLimit(10, 60_000), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no configurado." });
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado." });

  const EXTRA_SEAT_PRICE = process.env.PRICE_EXTRA_SEAT || 'price_1Tcit7POSeyVBgtaC7CSaSJs';
  const EXTRA_SEAT_PRICE_ANNUAL = process.env.PRICE_EXTRA_SEAT_ANNUAL || 'price_1TkgbePOSeyVBgtajlYXPiy2';

  try {
    // 1. Verificar que es owner de una clínica
    const clinicRes = await fetch(`${SB_REST()}/clinics?owner_id=eq.${user.id}&select=*`, { headers: sbAdmin() });
    const clinics = await clinicRes.json();
    const clinic = clinics?.[0];
    if (!clinic) return res.status(403).json({ error: "Solo el propietario de la clínica puede ampliar plazas." });

    // 2. Localizar la suscripción de Stripe
    let subId = clinic.stripe_subscription_id;
    if (!subId) {
      // Fallback: buscar por email del owner
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: 'active', limit: 1 });
        subId = subs.data[0]?.id || null;
        // Guardar para la próxima
        if (subId) {
          await fetch(`${SB_REST()}/clinics?id=eq.${clinic.id}`, {
            method: 'PATCH', headers: sbAdmin(),
            body: JSON.stringify({ stripe_subscription_id: subId, stripe_customer_id: customers.data[0].id }),
          });
        }
      }
    }
    if (!subId) return res.status(404).json({ error: "No se encontró la suscripción de Stripe de la clínica. Contacta con soporte." });

    // 3. Modificar la suscripción: incrementar el item de plaza extra o añadirlo
    const sub = await stripe.subscriptions.retrieve(subId);
    if (!sub || sub.status !== 'active') return res.status(400).json({ error: "La suscripción no está activa." });

    // Stripe exige que todos los items de una suscripción compartan el mismo
    // intervalo (mensual/anual). Detectamos el intervalo del plan de la clínica
    // y elegimos el precio de plaza extra que coincida. Si la clínica es anual
    // pero no hay precio de plaza extra anual configurado, avisamos en vez de fallar.
    const planInterval = sub.items.data[0]?.price?.recurring?.interval || 'month';
    let seatPrice = EXTRA_SEAT_PRICE;
    if (planInterval === 'year') {
      if (!EXTRA_SEAT_PRICE_ANNUAL) {
        return res.status(400).json({ error: "Las plazas extra para el plan anual aún no están disponibles. Contacta con soporte para añadir un fisioterapeuta." });
      }
      seatPrice = EXTRA_SEAT_PRICE_ANNUAL;
    }

    // Tope de seguridad: no permitir crecer sin límite (5 base + 20 extra = 25).
    const MAX_SEATS = 25;
    const currentSeats = clinic.seats || 5;
    if (currentSeats >= MAX_SEATS) {
      return res.status(400).json({ error: `Has alcanzado el máximo de ${MAX_SEATS} plazas. Contacta con soporte si necesitas más.` });
    }

    // ── RESERVA ATÓMICA (anti doble-cobro) ───────────────────────────────────
    // Antes de cobrar en Stripe, "reservamos" la plaza con un UPDATE condicional:
    // incrementamos seats SOLO si sigue valiendo lo que leímos (compare-and-swap).
    // Si dos peticiones simultáneas (doble clic) leyeron el mismo valor, solo una
    // gana la reserva; la otra no hace match y se rechaza ANTES de cobrar. Así es
    // imposible cobrar dos veces por la misma plaza.
    const newSeats = currentSeats + 1;
    let reserved = false;
    try {
      const casRes = await fetch(
        `${SB_REST()}/clinics?id=eq.${clinic.id}&seats=eq.${currentSeats}`,
        { method: 'PATCH', headers: { ...sbAdmin(), 'Prefer': 'return=representation' },
          body: JSON.stringify({ seats: newSeats }) }
      );
      if (casRes.ok) {
        const rows = await casRes.json();
        reserved = Array.isArray(rows) && rows.length === 1; // exactamente 1 fila actualizada
      }
    } catch(e) { reserved = false; }

    if (!reserved) {
      // Otra petición ganó la reserva (o el valor cambió). No cobramos.
      console.warn(`Reserva de plaza no concedida (posible doble clic): clínica ${clinic.id}, seats esperados ${currentSeats}`);
      return res.status(409).json({ error: "Otra operación de plazas está en curso. Espera un momento y revisa el número de plazas antes de volver a intentarlo." });
    }

    // A partir de aquí la plaza está reservada en BD. Si Stripe falla, revertimos.
    const revertReservation = async () => {
      try {
        await fetch(`${SB_REST()}/clinics?id=eq.${clinic.id}&seats=eq.${newSeats}`, {
          method: 'PATCH', headers: sbAdmin(), body: JSON.stringify({ seats: currentSeats }),
        });
      } catch(_) {
        console.error(`✗ No se pudo revertir la reserva de plaza (clínica ${clinic.id}). Requiere revisión manual.`);
        if (process.env.SENTRY_DSN) { try { Sentry.captureMessage('Fallo al revertir reserva de plaza', { level:'error', tags:{area:'clinic_seats'}, extra:{ clinicId: clinic.id, newSeats } }); } catch(_){} }
      }
    };

    // ── Cobro en Stripe (la plaza ya está reservada) ─────────────────────────
    const extraItem = sub.items.data.find(it => it.price?.id === seatPrice);
    try {
      if (extraItem) {
        await stripe.subscriptionItems.update(extraItem.id, {
          quantity: (extraItem.quantity || 0) + 1,
          proration_behavior: 'create_prorations',
        });
      } else {
        await stripe.subscriptionItems.create({
          subscription: subId,
          price: seatPrice,
          quantity: 1,
          proration_behavior: 'create_prorations',
        });
      }
    } catch(stripeErr) {
      // El cobro falló → revertir la reserva para no dejar la plaza "fantasma".
      console.error('Stripe falló al ampliar plaza, revirtiendo reserva:', stripeErr.message);
      await revertReservation();
      return res.status(502).json({ error: "No se pudo procesar el pago de la plaza. No se te ha cobrado. Inténtalo de nuevo." });
    }

    console.log(`✓ Plazas ampliadas: clínica ${clinic.id} → ${newSeats} (sub ${subId})`);
    return res.json({ ok: true, seats: newSeats });
  } catch(e) {
    console.error('Expand seats error:', e.message);
    return res.status(500).json({ error: "Error al ampliar las plazas: " + e.message });
  }
});

// ── POST /api/stripe/portal ───────────────────────────────────────────────────
app.post("/api/stripe/portal", rateLimit(10, 60_000), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no configurado." });
  // Seguridad: autenticar al usuario y usar SU email verificado, no uno del body.
  // Si confiáramos en el email del body, cualquiera podría abrir el portal de
  // facturación de otro cliente (ver facturas, cancelar su plan). IDOR.
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "No autorizado." });
  const email = user.email;
  if (!email) return res.status(400).json({ error: "Tu cuenta no tiene email asociado." });
  try {
    // Find customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) {
      return res.status(404).json({ error: "No se encontró una suscripción activa para este email." });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${process.env.FRONTEND_URL || "https://fisioscript.com"}/mi-cuenta.html`,
    });
    return res.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err.message);
    return res.status(500).json({ error: "Error al abrir el portal de facturación." });
  }
});

// ── POST /api/stripe/checkout ─────────────────────────────────────────────────
app.post("/api/stripe/checkout", rateLimit(10, 60_000), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no configurado." });
  const { priceId, email, extraSeats, userId } = req.body;
  if (!priceId) return res.status(400).json({ error: "priceId requerido." });

  // Anti-manipulación: el priceId debe ser uno de nuestros precios conocidos.
  // Evita que alguien envíe un priceId arbitrario (p.ej. de otro producto más barato).
  const KNOWN_PRICES = Object.values(PRICE_IDS).filter(Boolean);
  if (!KNOWN_PRICES.includes(priceId)) {
    return res.status(400).json({ error: "Plan no válido." });
  }

  // Price ID para profesionales extra — debe coincidir en intervalo con el plan
  // (Stripe no permite mezclar items mensuales y anuales en una suscripción).
  const EXTRA_SEAT_PRICE = process.env.PRICE_EXTRA_SEAT || 'price_1Tcit7POSeyVBgtaC7CSaSJs';
  const EXTRA_SEAT_PRICE_ANNUAL = process.env.PRICE_EXTRA_SEAT_ANNUAL || 'price_1TkgbePOSeyVBgtajlYXPiy2';

  // Detectar si es plan anual
  const isAnual   = priceId === PRICE_IDS.individual_anual  || priceId === PRICE_IDS.clinica_anual;
  const isClinica = priceId === PRICE_IDS.clinica_mensual   || priceId === PRICE_IDS.clinica_anual;

  // Elegir el precio de plaza extra que coincida con el intervalo del plan.
  const seatPrice = isAnual ? EXTRA_SEAT_PRICE_ANNUAL : EXTRA_SEAT_PRICE;

  // Construir line_items
  const lineItems = [{ price: priceId, quantity: 1 }];

  // Añadir profesionales extra si es plan clínica y se solicitan.
  // Si es anual pero no hay precio de plaza anual configurado, NO añadimos plazas
  // aquí (evita el error de Stripe); el owner podrá añadirlas luego desde su cuenta.
  const seats = parseInt(extraSeats) || 0;
  if (isClinica && seats > 0 && seats <= 20 && seatPrice) {
    lineItems.push({ price: seatPrice, quantity: seats });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: lineItems,
      metadata: {
        price_id: priceId,
        extra_seats: seats.toString(),
        user_id: userId || '',
      },
      subscription_data: {
        metadata: {
          price_id: priceId,
          user_id: userId || '',
        }
      },
      success_url: `${process.env.FRONTEND_URL||"https://fisioscript.com"}/fisioscript-app.html`,
      cancel_url: `${process.env.FRONTEND_URL||"https://fisioscript.com"}/precios.html`,
      locale: "es",
      allow_promotion_codes: true,
    });
    return res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    return res.status(500).json({ error: "Error al crear sesión de pago." });
  }
});

// ── Helpers Supabase admin ────────────────────────────────────────────────────
// Resuelve el ID de usuario: primero por ID directo (metadata), luego por email.
// IMPORTANTE: el endpoint admin/users IGNORA el filtro ?email=, así que hay que
// recorrer la lista y filtrar nosotros por email exacto.
async function resolveUserId(metaUserId, email) {
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };

  // 1. Si tenemos el userId de la metadata, verificar que existe y usarlo
  if (metaUserId) {
    try {
      const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${metaUserId}`, { headers });
      if (r.ok) {
        const u = await r.json();
        if (u?.id) return u.id;
      }
    } catch(e) { /* continuar al fallback */ }
  }

  // 2. Fallback: buscar por email recorriendo la lista paginada y filtrando exacto
  if (email) {
    const target = email.toLowerCase().trim();
    let page = 1;
    const perPage = 200;
    while (page <= 10) { // hasta 2000 usuarios
      const r = await fetch(
        `${process.env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        { headers }
      );
      if (!r.ok) break;
      const data = await r.json();
      const users = data?.users || [];
      const match = users.find(u => (u.email || '').toLowerCase().trim() === target);
      if (match) return match.id;
      if (users.length < perPage) break; // última página
      page++;
    }
  }
  return null;
}

async function updateUserPlan(userId, plan) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
  // Fetch existing metadata so we don't wipe name, trial_start, terms_accepted_at, etc.
  let existing = {};
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers });
    if (r.ok) {
      const u = await r.json();
      existing = u?.user_metadata || {};
    }
  } catch(e) { /* if fetch fails, proceed with just the plan */ }

  const resp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ user_metadata: { ...existing, plan } }),
  });
  // Comprobar el resultado: fetch NO lanza ante un 4xx/5xx, así que si no lo
  // verificamos, un fallo de Supabase pasaría desapercibido y el webhook
  // respondería 200 (sin reintento) dejando al cliente pagado sin plan. Lanzamos
  // para que quien llama (con try/catch) detecte el fallo y actúe (reintento).
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`updateUserPlan falló (${resp.status}): ${txt.slice(0, 200)}`);
  }
  return resp;
}

// Cancela una clínica entera cuando el dueño deja de pagar:
// retira el acceso a TODOS los fisios miembros, no solo al propietario.
// Sin esto, los miembros invitados conservarían su plan de clínica y seguirían
// usando FisioScript gratis aunque la suscripción que los pagaba ya no exista.
async function cancelClinicByOwner(ownerId) {
  try {
    // 1. Localizar la clínica de este propietario
    const clinicRes = await fetch(`${SB_REST()}/clinics?owner_id=eq.${ownerId}&select=id`, { headers: sbAdmin() });
    const clinics = await clinicRes.json();
    const clinic = clinics?.[0];
    if (!clinic) {
      // No tiene clínica: es un plan individual, basta con cancelar al usuario
      await updateUserPlan(ownerId, 'cancelled');
      return;
    }
    // 2. Obtener TODOS los miembros (incluido el owner)
    const memRes = await fetch(`${SB_REST()}/clinic_members?clinic_id=eq.${clinic.id}&select=user_id,role`, { headers: sbAdmin() });
    const members = await memRes.json();
    if (!Array.isArray(members)) {
      // Si no podemos leer los miembros, al menos cancelamos al dueño
      await updateUserPlan(ownerId, 'cancelled');
      return;
    }
    // 3. Cancelar el plan de cada miembro (owner + fisios invitados)
    let count = 0;
    const fallidos = [];
    for (const m of members) {
      try { await updateUserPlan(m.user_id, 'cancelled'); count++; }
      catch(e) {
        // Si falla cancelar a un miembro, queda con acceso indebido: hay que saberlo.
        console.error(`✗ No se pudo cancelar al miembro ${m.user_id} (clinic ${clinic.id}):`, e.message);
        fallidos.push(m.user_id);
      }
    }
    // Asegurar que el owner queda cancelado aunque no figure en la lista
    if (!members.some(m => m.user_id === ownerId)) {
      try { await updateUserPlan(ownerId, 'cancelled'); count++; }
      catch(e) {
        console.error(`✗ No se pudo cancelar al owner ${ownerId} (clinic ${clinic.id}):`, e.message);
        fallidos.push(ownerId);
      }
    }
    // Si algún usuario quedó SIN cancelar, es una fuga de acceso: reportar a Sentry.
    if (fallidos.length && process.env.SENTRY_DSN) {
      try { Sentry.captureMessage(`Cancelación de clínica incompleta: ${fallidos.length} usuario(s) con acceso indebido`, { level: 'error', tags: { area: 'cancel_clinic' }, extra: { clinicId: clinic.id, ownerId, fallidos } }); } catch(_){}
    }
    console.log(`✓ Clínica cancelada: ${count} miembro(s) sin acceso${fallidos.length ? `, ${fallidos.length} FALLIDO(S)` : ''} (clinic ${clinic.id})`);
  } catch(e) {
    console.error('Error cancelando clínica completa:', e.message);
    if (process.env.SENTRY_DSN) { try { Sentry.captureException(e, { tags: { area: 'cancel_clinic' }, extra: { ownerId } }); } catch(_){} }
    // Fallback: cancelar al menos al propietario
    try { await updateUserPlan(ownerId, 'cancelled'); }
    catch(e2) {
      console.error(`✗ Fallback: tampoco se pudo cancelar al owner ${ownerId}:`, e2.message);
      if (process.env.SENTRY_DSN) { try { Sentry.captureMessage(`Cancelación de clínica FALLÓ por completo para owner ${ownerId}`, { level: 'error', tags: { area: 'cancel_clinic' } }); } catch(_){} }
    }
  }
}

// Crea la clínica del owner si no existe y lo añade como miembro 'owner'.
async function ensureClinic(ownerId, email, plan, seats, stripeSubId, stripeCustomerId) {
  const rest = `${process.env.SUPABASE_URL}/rest/v1`;
  const headers = sbAdmin();

  const stripeFields = {};
  if (stripeSubId) stripeFields.stripe_subscription_id = stripeSubId;
  if (stripeCustomerId) stripeFields.stripe_customer_id = stripeCustomerId;

  // ¿Ya tiene una clínica como owner?
  const existRes = await fetch(`${rest}/clinics?owner_id=eq.${ownerId}&select=id`, { headers });
  const exist = await existRes.json();
  let clinicId = exist?.[0]?.id;

  if (!clinicId) {
    let createRes = await fetch(`${rest}/clinics`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ owner_id: ownerId, plan, seats: seats || 5, name: 'Mi clínica', ...stripeFields }),
    });
    if (!createRes.ok) {
      const errTxt = await createRes.text().catch(()=> '');
      console.error('✗ Error creando clínica:', createRes.status, errTxt.slice(0, 300));
      // Si fallan las columnas de Stripe (ALTER no ejecutado), reintentar sin ellas
      if (errTxt.includes('column') && (errTxt.includes('stripe_subscription_id') || errTxt.includes('stripe_customer_id'))) {
        console.warn('⚠ Reintentando sin columnas stripe_* (falta ejecutar el ALTER TABLE en Supabase)');
        createRes = await fetch(`${rest}/clinics`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ owner_id: ownerId, plan, seats: seats || 5, name: 'Mi clínica' }),
        });
        if (!createRes.ok) {
          const e2 = await createRes.text().catch(()=> '');
          console.error('✗ Error creando clínica (reintento):', createRes.status, e2.slice(0, 300));
          return;
        }
      } else {
        return;
      }
    }
    const created = await createRes.json();
    clinicId = created?.[0]?.id;
    console.log(`✓ Clínica creada: ${clinicId} (owner ${email}, ${seats} plazas)`);
  } else {
    // Actualizar plan, plazas y datos de Stripe
    await fetch(`${rest}/clinics?id=eq.${clinicId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ plan, seats: seats || 5, ...stripeFields }),
    });
  }

  if (!clinicId) return;

  // Añadir al owner como miembro (upsert)
  const ownerRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${ownerId}`, { headers });
  const owner = await ownerRes.json();
  const ownerName = owner?.user_metadata?.name || email.split('@')[0];
  const memberRes = await fetch(`${rest}/clinic_members`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ clinic_id: clinicId, user_id: ownerId, role: 'owner', email, name: ownerName }),
  });
  if (!memberRes.ok) {
    const errTxt = await memberRes.text().catch(()=> '');
    console.error('✗ Error añadiendo owner como miembro:', memberRes.status, errTxt.slice(0, 300));
  } else {
    console.log(`✓ Owner añadido como miembro de la clínica ${clinicId}`);
  }
}

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────
app.post("/api/stripe/webhook", async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no configurado." });
  const sig = req.headers["stripe-signature"];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send(`Webhook error: ${err.message}`); }

  console.log(`Stripe event: ${event.type}`);

  // Marca de fallo que MERECE reintento de Stripe. Solo se activa para fallos
  // críticos donde el cliente ya pagó pero no recibió su plan. Al final, si está
  // activa, respondemos 500 para que Stripe reintente el webhook (lo hace con
  // backoff durante ~3 días). Para fallos no críticos (p.ej. una cancelación que
  // no se pudo aplicar) NO forzamos reintento: respondemos 200 y lo dejamos en
  // Sentry, porque reintentar no aporta y el cliente no queda perjudicado.
  let needsRetry = false;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      const priceId = session.metadata?.price_id || '';
      const metaUserId = session.metadata?.user_id || '';
      // Mapear priceId → plan. Si no se reconoce (env var mal configurada, precio
      // nuevo, etc.), NO degradar en silencio: avisar para no dar a un cliente de
      // clínica el plan individual por error. Usamos el fallback solo como último
      // recurso para no bloquear a quien ya pagó, pero lo reportamos como crítico.
      let plan = PLAN_MAP[priceId];
      if (!plan) {
        plan = 'individual_mensual';
        console.error(`✗ CRÍTICO: priceId desconocido en webhook: "${priceId}". Plan asignado por defecto; REVISAR manualmente.`);
        if (process.env.SENTRY_DSN) {
          try { Sentry.captureMessage(`priceId desconocido en webhook de pago: ${priceId}`, { level: 'error', tags: { area: 'webhook_plan' }, extra: { priceId, email: session.customer_email, metaUserId } }); } catch(_){}
        }
      }
      console.log(`✓ Pago completado: ${email} → ${plan} (priceId: ${priceId}, userId: ${metaUserId || 'no enviado'})`);

      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        try {
          const userId = await resolveUserId(metaUserId, email);
          if (userId) {
            await updateUserPlan(userId, plan);
            console.log(`✓ Plan actualizado en Supabase: ${userId} → ${plan}`);

            // Si es un plan clínica, crear la clínica y añadir al owner (si no existe ya)
            if (plan === 'clinica_mensual' || plan === 'clinica_anual') {
              try {
                const extraSeats = parseInt(session.metadata?.extra_seats || '0') || 0;
                await ensureClinic(userId, email, plan, 5 + extraSeats, session.subscription || null, session.customer || null);
              } catch(e) {
                // El plan ya se activó, pero la clínica no se creó. El cliente de
                // clínica necesita su clínica → pedimos reintento. ensureClinic es
                // idempotente (crea solo si no existe), así que reintentar es seguro.
                console.error('✗ Error creando clínica tras pago:', e.message);
                needsRetry = true;
                if (process.env.SENTRY_DSN) Sentry.captureException(e, { tags: { area: 'webhook_clinica' }, extra: { email, plan, note: 'Plan activado pero clínica no creada; se reintentará' } });
              }
            }
          } else {
            // El pago se completó pero no encontramos al usuario. Puede ser un
            // problema temporal (el registro aún no se ha propagado). Pedimos a
            // Stripe que reintente, porque el cliente pagó y necesita su plan.
            console.warn(`⚠ Usuario no encontrado tras pago (userId: ${metaUserId}, email: ${email}). Se solicitará reintento.`);
            needsRetry = true;
            if (process.env.SENTRY_DSN) {
              try { Sentry.captureMessage(`Pago completado pero usuario no encontrado (se reintentará)`, { level: 'warning', tags: { area: 'webhook_plan' }, extra: { email, metaUserId, plan } }); } catch(_){}
            }
          }
        } catch(e) {
          // updateUserPlan (o resolveUserId) falló: el cliente PAGÓ pero no tiene
          // plan. Esto es crítico → pedimos reintento a Stripe respondiendo 500.
          console.error('✗ CRÍTICO: error actualizando plan tras pago:', e.message);
          needsRetry = true;
          if (process.env.SENTRY_DSN) {
            try { Sentry.captureException(e, { level: 'error', tags: { area: 'webhook_plan' }, extra: { email, plan, metaUserId, note: 'Cliente pagó sin recibir plan; Stripe reintentará' } }); } catch(_){}
          }
        }
      } else {
        // Sin Supabase configurado no podemos activar el plan; si esto ocurre en
        // producción tras un pago, conviene reintentar cuando se restablezca.
        console.error('✗ Pago completado pero Supabase no está configurado: no se pudo activar el plan.');
        needsRetry = true;
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      console.log(`✗ Suscripción cancelada: ${sub.customer}`);
      const cancelMetaUserId = sub.metadata?.user_id || '';
      const cancelEmail = sub.customer_email;
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        try {
          const userId = await resolveUserId(cancelMetaUserId, cancelEmail);
          if (userId) {
            await cancelClinicByOwner(userId);
            console.log(`✓ Plan cancelado en Supabase: ${userId}`);
          } else {
            // No se pudo identificar al usuario: su suscripción se canceló en Stripe
            // pero seguiría con acceso en la app sin pagar. Hay que saberlo.
            console.error(`✗ Cancelación sin usuario identificable (sub ${sub.id}, customer ${sub.customer}, email ${cancelEmail||'?'})`);
            if (process.env.SENTRY_DSN) {
              try { Sentry.captureMessage(`Cancelación de Stripe sin usuario identificable: acceso indebido posible`, { level: 'error', tags: { area: 'webhook_cancel' }, extra: { subId: sub.id, customer: sub.customer, email: cancelEmail } }); } catch(_){}
            }
          }
        } catch(e) { console.error('Error cancelando plan:', e.message); }
      }
      break;
    }

    case "customer.subscription.updated": {
      // Stripe cambia el estado de la suscripción (ej. active → past_due → unpaid).
      // Solo retiramos acceso cuando el estado es terminal de impago, no al primer fallo
      // (Stripe reintenta el cobro varios días en estado 'past_due').
      const sub = event.data.object;
      const status = sub.status; // active, past_due, unpaid, canceled, incomplete...
      console.log(`↻ Suscripción actualizada: ${sub.customer} → ${status}`);
      if (status === 'unpaid' || status === 'canceled' || status === 'incomplete_expired') {
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
          try {
            const userId = await resolveUserId(sub.metadata?.user_id || '', sub.customer_email);
            if (userId) {
              await cancelClinicByOwner(userId);
              console.log(`✓ Acceso retirado por impago (${status}): ${userId}`);
            }
          } catch(e) { console.error('Error retirando acceso:', e.message); }
        }
      }
      // Nota: 'past_due' NO retira acceso — Stripe sigue reintentando el cobro.
      break;
    }

    case "invoice.payment_failed": {
      // Una factura de renovación falló. Stripe reintentará automáticamente.
      // Solo actuamos cuando se agotan TODOS los reintentos (no quedan más programados),
      // para no echar a alguien por un fallo puntual del banco.
      const invoice = event.data.object;
      const noMoreRetries = !invoice.next_payment_attempt; // null = no habrá más intentos
      console.log(`⚠ Cobro fallido: ${invoice.customer_email || invoice.customer} · ${noMoreRetries ? 'sin más reintentos' : 'reintentará'}`);
      if (noMoreRetries && invoice.subscription && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        try {
          const userId = await resolveUserId(invoice.subscription_details?.metadata?.user_id || '', invoice.customer_email);
          if (userId) {
            await cancelClinicByOwner(userId);
            console.log(`✓ Acceso retirado tras agotar reintentos de cobro: ${userId}`);
          }
        } catch(e) { console.error('Error procesando impago:', e.message); }
      }
      break;
    }
  }
  // Si hubo un fallo crítico (cliente pagó pero no recibió plan/clínica),
  // respondemos 500 para que Stripe reintente el webhook automáticamente.
  // En el resto de casos, 200 (procesado).
  if (needsRetry) {
    return res.status(500).json({ error: "Procesamiento incompleto; reintentar." });
  }
  return res.json({ received: true });
});

// ── Error handlers ────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

// Sentry captura los errores de los endpoints (después de las rutas, antes del handler final)
if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: "Error interno." }); });

app.listen(PORT, () => {
  console.log(`\n✅  FisioScript API v4.0 → http://localhost:${PORT}`);
  console.log(`   GROQ_API_KEY:    ${process.env.GROQ_API_KEY ? "✓" : "✗ FALTA"}`);
  console.log(`   STRIPE:          ${process.env.STRIPE_SECRET_KEY ? "✓ " + process.env.STRIPE_SECRET_KEY.slice(0,12) + "..." : "✗"}`);
  console.log(`   SUPABASE:        ${process.env.SUPABASE_URL ? "✓" : "✗ (sin actualización plan auto)"}`);
  console.log(`   Clinical KB:     ${CLINICAL_KB.conditions.length} condiciones | ${Object.values(CLINICAL_KB.tests_by_region).flat().length} tests | ${CLINICAL_KB.red_flags.length} red flags\n`);

  // ── Verificación de precios al arrancar ──────────────────────────────────
  // El código tiene los IDs de producción como default, pero conviene saber si
  // las env vars de Railway están puestas (configuración explícita) o si se está
  // tirando del default. Si una env var falta, avisamos para revisarlo antes de
  // abrir pagos. Si ningún precio resuelve a un valor, es un error grave.
  const priceEnvVars = {
    PRICE_INDIVIDUAL_MONTHLY: PRICE_IDS.individual_mensual,
    PRICE_INDIVIDUAL_ANNUAL:  PRICE_IDS.individual_anual,
    PRICE_CLINICA_MONTHLY:    PRICE_IDS.clinica_mensual,
    PRICE_CLINICA_ANNUAL:     PRICE_IDS.clinica_anual,
    PRICE_EXTRA_SEAT:         process.env.PRICE_EXTRA_SEAT || 'price_1Tcit7POSeyVBgtaC7CSaSJs',
    PRICE_EXTRA_SEAT_ANNUAL:  process.env.PRICE_EXTRA_SEAT_ANNUAL || 'price_1TkgbePOSeyVBgtajlYXPiy2',
  };
  const faltantes = [];
  const vacios = [];
  console.log('   Precios Stripe:');
  for (const [name, resolved] of Object.entries(priceEnvVars)) {
    const fromEnv = !!process.env[name];
    if (!resolved) { vacios.push(name); console.log(`     ✗ ${name}: SIN VALOR (ni env var ni default)`); continue; }
    if (!fromEnv) faltantes.push(name);
    console.log(`     ${fromEnv ? '✓' : '⚠'} ${name}: ${resolved.slice(0,18)}… ${fromEnv ? '(env)' : '(DEFAULT del código)'}`);
  }
  if (vacios.length) {
    console.error(`   ✗ CRÍTICO: precios sin valor: ${vacios.join(', ')}. El checkout fallará para esos planes.`);
    if (process.env.SENTRY_DSN) { try { Sentry.captureMessage(`Precios sin valor al arrancar: ${vacios.join(', ')}`, { level: 'error', tags: { area: 'price_config' } }); } catch(_){} }
  }
  if (faltantes.length) {
    console.warn(`   ⚠ Estas env vars de precio NO están en Railway (se usa el default del código): ${faltantes.join(', ')}. Verifica que el default sea el correcto.`);
  }
  if (!vacios.length && !faltantes.length) {
    console.log('   ✓ Todos los precios vienen de env vars de Railway.');
  }
  console.log('');
}).on('error', (err) => {
  console.error('❌ Error arrancando servidor:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Error no capturado:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesa rechazada:', reason);
  process.exit(1);
});
