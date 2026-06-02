import express from "express";
import cors from "cors";
import Stripe from "stripe";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════════════════════════
// BASE DE CONOCIMIENTO CLÍNICO FISIOSCRIPT v4.0 (13 regiones, 34 patologías, 99 tests)
// Expandida con: fases clínicas, RTS, factores recaída, técnicas manuales, ejercicio, educación
const CLINICAL_KB = {"regions":{"hombro":"Hombro","cadera":"Cadera","lumbar":"Columna Lumbar","toracico":"Columna Torácica / Espalda Alta","tobillo":"Tobillo","codo":"Codo","cervical":"Columna Cervical / Radiculopatía","rodilla":"Rodilla","rodilla_akp":"Dolor Anterior de Rodilla (AKP/Patelofemoral)","cuadriceps":"Cuádriceps","aductor":"Aductor / Ingle","isquiotibiales":"Isquiotibiales","gemelo":"Gemelo / Pantorrilla"},"conditions":[{"id":"rct_manguito","r":"hombro","n":"Rotura Manguito Rotador","p":["dolor lateral hombro","dolor nocturno","debilidad rotación externa","incapacidad elevación"],"rts_days":[90,270],"fases":[{"n":"Aguda","c":"Dolor nocturno, debilidad marcada"},{"n":"Subaguda","c":"Dolor disminuye, fuerza limitada"},{"n":"Remodelación","c":"Recupera ROM y fuerza"},{"n":"Funcional","c":"Fuerza >90% lado sano"}],"criterios_rts":["ROM completo o funcional","Fuerza ≥90–95% contralateral","ER/IR ratio normalizado","Sin dolor nocturno","Sin compensaciones escapulares"],"factores_recaida":["Debilidad rotadores externos","Déficit escapular persistente","Retorno precoz","Diabetes","Tabaquismo","Mala adherencia"],"tecnicas_manuales":["Movilización GH posterior","Movilización inferior GH","Movilidad torácica","Liberación pectoral menor","Movilización escapular"],"ejercicio":{"inicial":["Pendulares","Isométricos ER/IR","Scapular setting"],"intermedio":["ER con banda","Remo","Elevaciones escapulares"],"avanzado":["Press","Lanzamientos","Trabajo pliométrico"]},"educacion":["El dolor no equivale a daño estructural","Muchas roturas son asintomáticas","La carga progresiva es segura","La fuerza predice mejor función que la imagen"],"tratamiento":"Fisioterapia progresiva: rotadores externos + estabilidad escapular. Cirugía si rotura completa en atleta élite o fallo conservador."},{"id":"sis_impingement","r":"hombro","n":"Síndrome Subacromial (SIS)","p":["dolor arco 60-120°","dolor con elevación","painful arc","déficit escapular"],"rts_days":[42,120],"fases":[{"n":"Irritable","c":"Dolor con elevación"},{"n":"Subaguda","c":"Mejor tolerancia"},{"n":"Funcional","c":"Dolor mínimo"}],"criterios_rts":["Elevación completa","Fuerza ≥90%","Dolor ≤2/10","Sin painful arc funcional"],"factores_recaida":["Sobrecarga repetitiva overhead","Escápula discinética","Debilidad manguito","Déficit torácico"],"tecnicas_manuales":["Movilidad torácica","GH posterior","Escapulotorácica","Liberación pectoral menor"],"ejercicio":{"inicial":["Serrato anterior","Scapular setting"],"intermedio":["Trapecio inferior","Rotadores externos","Wall slides"],"avanzado":["Push-up plus","Press funcional"]},"educacion":["Impingement no implica atrapamiento permanente","La mayoría mejora sin cirugía","El ejercicio es el tratamiento principal"],"tratamiento":"Ejercicio terapéutico, corrección postura escapular, evitar compresión. Terapia manual adyuvante."},{"id":"inestabilidad_gh","r":"hombro","n":"Inestabilidad Glenohumeral","p":["sensación luxación","apprehension","dolor joven deportista","trauma previo"],"rts_days":[90,270],"fases":[{"n":"Aguda","c":"Aprensión marcada"},{"n":"Recuperación","c":"Menor sensación de escape"},{"n":"Funcional","c":"Control dinámico"}],"criterios_rts":["Sin apprehension","Fuerza ≥90–95%","Control dinámico completo","CKCUEST normal"],"factores_recaida":["Edad <25 años","Deportes contacto","Hiperlaxitud","Déficit manguito","Déficit control escapular"],"tecnicas_manuales":["Movilizaciones suaves GH","Movilidad torácica","Escapulotorácica"],"ejercicio":{"inicial":["Isométricos","Scapular setting"],"intermedio":["ER/IR banda","Remo","Serrato anterior"],"avanzado":["Body blade","Lanzamientos","Pliometría"]},"educacion":["Evitar miedo al movimiento","Comprender mecanismos de luxación","Reintroducir carga progresivamente"],"tratamiento":"Estabilizadores dinámicos. Cirugía si recidivante o déficit estructural significativo."},{"id":"tendinopatia_biceps","r":"hombro","n":"Tendinopatía Bíceps Largo (LHBT)","p":["dolor anterior hombro","dolor surco bicipital","Speed positivo","dolor flexión codo resistida"],"rts_days":[42,120],"fases":[{"n":"Reactiva","c":"Dolor carga"},{"n":"Disrepair","c":"Dolor persistente"},{"n":"Degenerativa","c":"Crónica"}],"criterios_rts":["Sin dolor en Speed","Fuerza flexión/supinación ≥90%","Tolerancia overhead"],"factores_recaida":["Sobrecarga lanzamiento","Déficit escapular","Manguito débil"],"tecnicas_manuales":["Surco bicipital","Pectoral menor","Movilidad torácica"],"ejercicio":{"inicial":["Isométricos flexión"],"intermedio":["Curl progresivo","Supinación resistida"],"avanzado":["Heavy slow resistance"]},"educacion":["Tendón responde a carga progresiva","Reposo absoluto empeora capacidad"],"tratamiento":"Gestión carga, isométricos, Heavy Slow Resistance. Infiltración si crónico."},{"id":"fai_labrum","r":"cadera","n":"FAI / Lesión Labrum Acetabular","p":["dolor inguinal","dolor con flexión cadera","limitación rotación interna","dolor salida coche"],"rts_days":[60,180],"fases":[{"n":"Irritable","c":"Dolor actividades diarias"},{"n":"Subaguda","c":"Dolor mecánico intermitente"},{"n":"Funcional","c":"Síntomas con carga alta"},{"n":"Crónica","c":"Rigidez persistente"}],"criterios_rts":["ROM funcional completo","FADDIR negativo o mínimamente sintomático","Fuerza abductores ≥90%","Single-leg squat controlado","Tolerancia carrera/salto"],"factores_recaida":["Déficit rotación interna","Persistencia impingement óseo","Déficit glúteo medio","Retorno precoz","Hipermovilidad asociada"],"tecnicas_manuales":["Distracción coxofemoral","Movilización posterior","Movilización inferior","Movilidad cápsula posterior","Movilidad lumbar/torácica"],"ejercicio":{"inicial":["Isométricos abductores","Puentes","Control pélvico"],"intermedio":["Clamshell","Monster walks","Split squat"],"avanzado":["Sentadilla profunda","Carrera progresiva","Saltos"]},"educacion":["El FAI radiológico no siempre produce síntomas","La movilidad y la fuerza son modificables","La cirugía no siempre es necesaria"],"tratamiento":"Control motor cadera-core. Artroscopia si fallo conservador >6 meses."},{"id":"gtps_gluteo","r":"cadera","n":"Tendinopatía Glúteo Medio / GTPS","p":["dolor lateral cadera","dolor trocánter mayor","Trendelenburg positivo","empeora cruce piernas","dolor escaleras"],"rts_days":[56,270],"fases":[{"n":"Irritable","c":"Dolor lateral continuo"},{"n":"Subaguda","c":"Dolor carga prolongada"},{"n":"Funcional","c":"Dolor solo actividad alta"}],"criterios_rts":["Single-leg stance 30–60s","Fuerza abductores ≥90%","Sin dolor escaleras"],"factores_recaida":["Compresión lateral persistente","Dormir sobre lado afecto","Debilidad abductores","Valgo dinámico"],"tecnicas_manuales":["Liberación TFL","Movilidad cadera","Tejidos blandos glúteos"],"ejercicio":{"inicial":["Isométricos abductores","Puentes"],"intermedio":["Clamshell","Side step"],"avanzado":["Single-leg squat","Step-down","Saltos"]},"educacion":["Evitar cruzar piernas inicialmente","Evitar dormir sobre lado doloroso","La carga progresiva es esencial"],"tratamiento":"Carga progresiva glúteo medio. Evitar compresión trocantérica. Sin estiramiento precoz."},{"id":"oa_cadera","r":"cadera","n":"Osteoartritis de Cadera","p":["rigidez matutina","dolor IR y flexión","marcha antálgica","limitación ROM global"],"rts_days":[null,null],"fases":[{"n":"Temprana","c":"Dolor esfuerzo"},{"n":"Moderada","c":"Rigidez progresiva"},{"n":"Avanzada","c":"Limitación funcional"}],"criterios_rts":["Mantener independencia funcional","Caminar sin reagudización significativa"],"factores_recaida":["Sedentarismo","Obesidad","Déficit fuerza","Miedo al movimiento"],"tecnicas_manuales":["Movilidad articular","Distracción coxofemoral","Movilidad tejidos blandos"],"ejercicio":{"inicial":["Sit-to-stand","Sentadilla parcial"],"intermedio":["Bicicleta","Marcha"],"avanzado":["Ejercicio aeróbico progresivo"]},"educacion":["Movimiento seguro","Dolor no es daño progresivo inmediato","El ejercicio es primera línea"],"tratamiento":"Ejercicio aeróbico + fuerza. Pérdida peso. Artroplastia si incapacitante."},{"id":"radiculopatia_lumbar","r":"lumbar","n":"Radiculopatía Lumbar / Ciática","p":["dolor irradiado pierna","parestesias bajo rodilla","SLR positivo","déficit neurológico"],"rts_days":[42,180],"fases":[{"n":"Aguda (0–6 sem)","c":"Dolor irradiado intenso, neuroinflamación"},{"n":"Subaguda (6–12 sem)","c":"Mejora progresiva, persistencia neural"},{"n":"Crónica (>12 sem)","c":"Sensibilización, miedo al movimiento frecuente"}],"criterios_rts":["Dolor ≤2/10","SLR funcional sin empeoramiento","Fuerza ≥90% lado sano","Caminar/correr sin síntomas progresivos","Sin déficits neurológicos progresivos"],"factores_recaida":["Tabaquismo","Obesidad","Sedentarismo","Miedo al movimiento","Cargas mal gestionadas","Exposición repetida a flexión + carga"],"tecnicas_manuales":["Movilizaciones neurodinámicas","Movilización lumbar suave","Terapia manual adyuvante"],"ejercicio":{"inicial":["Walking program","McKenzie si centraliza"],"intermedio":["Estabilización lumbar"],"avanzado":["Fuerza progresiva global"]},"educacion":["Evitar reposo prolongado","La mayoría mejoran sin cirugía","Dolor no es daño","Mantener actividad graduada"],"tratamiento":"Neurodinamia, control motor, educación dolor. Epidural si severo. Cirugía si CES o déficit motor progresivo."},{"id":"dolor_lumbar_mecanico","r":"lumbar","n":"Dolor Lumbar Mecánico","p":["dolor lumbar posicional","sin irradiación","centralización McKenzie","mejora movimiento"],"rts_days":[14,56],"fases":[{"n":"Aguda","c":"Bloqueo y dolor movimiento"},{"n":"Subaguda","c":"Mejora ROM"},{"n":"Remodelación","c":"Recuperación funcional"}],"criterios_rts":["ROM funcional","Tolerancia sedestación","Levantar cargas sin reagudización","Capacidad laboral completa"],"factores_recaida":["Desacondicionamiento","Estrés","Trabajo sedentario","Baja fuerza tronco"],"tecnicas_manuales":["Movilización lumbar","Manipulación HVLA casos seleccionados","Movilización torácica"],"ejercicio":{"inicial":["McGill Big Three"],"intermedio":["Fuerza global","Bisagra cadera"],"avanzado":["Acondicionamiento aeróbico"]},"educacion":["Evitar miedo al movimiento","Promover exposición gradual","Fomentar autonomía"],"tratamiento":"Ejercicio activo, McKenzie si centralización. Manipulación en agudo. Evitar reposo."},{"id":"sij_sacroiliaco","r":"lumbar","n":"Disfunción Sacroiliaca (SIJ)","p":["dolor zona SIJ","Fortin sign","dolor glúteo","cluster 3 tests positivos"],"rts_days":[28,84],"fases":[{"n":"Irritación","c":"Dolor localizado"},{"n":"Subaguda","c":"Mejor tolerancia carga"},{"n":"Funcional","c":"Recuperación completa"}],"criterios_rts":["Caminar sin dolor","Tolerar carrera","Pruebas unipodales normales"],"factores_recaida":["Embarazo/postparto","Hipermovilidad","Déficit glúteo medio","Asimetrías de carga"],"tecnicas_manuales":["Movilización SIJ","Manipulación SIJ","Movilización cadera"],"ejercicio":{"inicial":["Glúteo medio","Estabilidad lumbopélvica"],"intermedio":["Control rotacional"],"avanzado":["Funcional específico"]},"educacion":["Evitar dependencia de cinturones o terapia pasiva","Progresión funcional"],"tratamiento":"Manipulación SIJ, estabilización cintura pélvica, ejercicio."},{"id":"dolor_toracico_mecanico","r":"toracico","n":"Dolor Torácico Mecánico / UBP","p":["dolor entre escápulas","dolor T1-T5","empeora sedestación","relación cuello-hombro","rigidez torácica"],"rts_days":[14,56],"fases":[{"n":"Aguda","c":"Dolor interescapular mecánico"},{"n":"Subaguda","c":"Rigidez torácica + limitación rotación"},{"n":"Crónica","c":"Sensibilidad + postura + estrés"}],"criterios_rts":["Dolor ≤1/10 en actividad prolongada","Rotación torácica completa sin dolor","Control escapular simétrico","Tolerancia sedestación prolongada"],"factores_recaida":["Sedestación prolongada","Estrés psicológico","Debilidad escapular","Rigidez torácica","Patrón cervical asociado"],"tecnicas_manuales":["Movilización torácica","Soft tissue paravertebral","HVLA torácica","Movilización costal","Trabajo miofascial escápula"],"ejercicio":{"inicial":["Extensión torácica","Rotación torácica","Respiración diafragmática"],"intermedio":["Y-T-W escapular","Retracción escapular"],"avanzado":["Patrones push/pull","Control sedestación"]},"educacion":["No es lesión estructural grave","El movimiento es tratamiento","La postura prolongada es el problema","Requiere tratamiento combinado"],"tratamiento":"Movilización torácica, ejercicio fuerza escapular, educación postural. Enfoque multimodal siempre."},{"id":"disfuncion_costovertebral","r":"toracico","n":"Disfunción Costovertebral","p":["dolor localizado costilla","dolor inspiración profunda","dolor unilateral espalda alta","reproducible palpación"],"rts_days":[7,21],"fases":[{"n":"Aguda","c":"Dolor localizado respiratorio"},{"n":"Resolución","c":"Mejora con movilización"}],"criterios_rts":["Sin dolor inspiración profunda","Rotación sin dolor","Movilidad normal"],"factores_recaida":["Postura mantenida","Mecanismos repetitivos"],"tecnicas_manuales":["Movilización costal","Respiración","HVLA si indicado"],"ejercicio":{"inicial":["Respiración diafragmática"],"intermedio":["Movilidad torácica"],"avanzado":["Control postural"]},"educacion":["Patrón funcional frecuente","El movimiento ayuda"],"tratamiento":"Movilización costal, respiración, HVLA si indicado."},{"id":"esguince_lateral","r":"tobillo","n":"Esguince Lateral (ATFL/CFL)","p":["inversión traumática","dolor lateral tobillo","hematoma precoz","incapacidad carga"],"rts_days":[7,84],"fases":[{"n":"Aguda (0–7d)","c":"Dolor, edema, incapacidad carga"},{"n":"Subaguda (1–3 sem)","c":"Mejora progresiva, control carga"},{"n":"Remodelación (3–12 sem)","c":"Estabilidad + fuerza"},{"n":"Crónica (>12 sem)","c":"Inestabilidad funcional"}],"criterios_rts":["Dolor ≤2/10 en carga completa","Salto monopodal sin dolor","Estabilidad cambios dirección","Test equilibrio unipodal simétrico","Fuerza eversores ≥90%","Ausencia giving way"],"factores_recaida":["Déficit de peroneos","Propiocepción pobre","Retorno precoz","Inestabilidad crónica ATFL","Historial esguinces previos"],"tecnicas_manuales":["Movilización talocrural (dorsiflexión)","Movilización subtalar","Drenaje edema","Movilización fibular"],"ejercicio":{"inicial":["Propiocepción BOSU/unipodal","Eversión con banda"],"intermedio":["Saltos progresivos","Marcha + carrera progresiva"],"avanzado":["Pliometría","Cambios dirección"]},"educacion":["Carga temprana acelera recuperación","Evitar inmovilización excesiva","Recaída = falta control neuromuscular no debilidad estructural"],"tratamiento":"POLICE agudo. Propiocepción precoz. Fuerza peroneos. Progresión funcional."},{"id":"sindesmosis","r":"tobillo","n":"Lesión Sindesmosis (High Ankle Sprain)","p":["rotación externa traumática","dolor distal tibiofibular","squeeze positivo","recuperación lenta"],"rts_days":[28,180],"fases":[{"n":"Aguda","c":"Dolor profundo + incapacidad carga"},{"n":"Subaguda","c":"Marcha alterada"},{"n":"Crónica","c":"Dolor persistente + inestabilidad"}],"criterios_rts":["Sprint sin dolor","Cambios dirección completos","Saltos sin dolor distal tibiofibular","Test ER negativo","Tolerancia carga excéntrica"],"factores_recaida":["Retorno precoz","Falta estabilidad mortaja","Dorsiflexión limitada","Deportes contacto precoz"],"tecnicas_manuales":["Movilización tibiofibular distal","Manipulación mortaja si indicado","Movilización dorsiflexión"],"ejercicio":{"inicial":["Dorsiflexión activa controlada"],"intermedio":["Carga progresiva cadena cerrada","Skipping progresivo"],"avanzado":["Estabilidad dinámica rotación externa"]},"educacion":["Recuperación más lenta que esguince lateral","No subestimar dolor profundo","Evitar retorno precoz"],"tratamiento":"Protección carga, control edema. Cirugía si diástasis. Rehab lenta y progresiva."},{"id":"rotura_aquiles","r":"tobillo","n":"Rotura / Tendinopatía Aquiles","p":["pop súbito","Thompson positivo","pérdida plantarflexión","incapacidad carga"],"rts_days":[180,365],"fases":[{"n":"Aguda","c":"Incapacidad funcional"},{"n":"Conservador/postquirúrgico","c":"Progresión carga lenta"},{"n":"Funcional","c":"Retorno deportivo"}],"criterios_rts":["Heel raise simétrico","Hopping sin dolor","Running progresivo tolerado","Fuerza ≥90%"],"factores_recaida":["Retorno precoz","Déficit excéntrico","Carga explosiva antes de recuperación"],"tecnicas_manuales":["Movilización talocrural","Liberación pantorrilla","Movilidad subtalar"],"ejercicio":{"inicial":["Isométricos plantarflexión"],"intermedio":["Heel raises bilaterales/unilaterales"],"avanzado":["Excéntricos Alfredson","Pliometría progresiva"]},"educacion":["Tendón necesita carga progresiva","Reposo absoluto empeora adaptación"],"tratamiento":"Ortesis funcional vs cirugía. Excéntricos fase tardía. RTS lento 9–12 meses."},{"id":"epicondilitis_lateral","r":"codo","n":"Epicondilalgia Lateral (Tennis Elbow)","p":["dolor epicóndilo lateral","Cozen positivo","dolor extensión muñeca resistida","actividad repetitiva"],"rts_days":[21,120],"fases":[{"n":"Reactiva","c":"Dolor carga > dolor reposo"},{"n":"Disrepair","c":"Dolor persistente"},{"n":"Degenerativa","c":"Crónica con sensibilización"}],"criterios_rts":["Dolor ≤2/10 en carga","Cozen negativo o mínimo","Grip strength ≥90%","Sin dolor post actividad 24h","Tolerancia extensores muñeca repetidos"],"factores_recaida":["Sobrecarga excéntrica repetitiva","Mala ergonomía","Déficit extensores muñeca","Falta progresión carga","Trabajo manual intenso sin adaptación"],"tecnicas_manuales":["Movilización radiohumeral","Liberación ECRB/extensores","Movilización cervical C6–C7 si referido","Neurodinamia radial"],"ejercicio":{"inicial":["Isométricos extensores muñeca"],"intermedio":["Excéntricos ECRB","Heavy Slow Resistance"],"avanzado":["Prono-supinación carga progresiva","Grip training"]},"educacion":["No es inflamación sino sobrecarga del tendón","Dolor no es daño estructural","Evitar reposo completo prolongado","Carga progresiva es tratamiento"],"tratamiento":"Excéntricos ECRB, corrección técnica, ortesis. Ondas de choque si crónico."},{"id":"epicondilitis_medial","r":"codo","n":"Epicondilalgia Medial (Golfer Elbow)","p":["dolor epicóndilo medial","golfer test positivo","dolor pronación resistida","posible parestesias cubital"],"rts_days":[42,120],"fases":[{"n":"Reactiva","c":"Dolor carga flexor-pronador"},{"n":"Disrepair","c":"Dolor persistente + posible neuropatía cubital"},{"n":"Crónica","c":"Sensibilización + debilidad"}],"criterios_rts":["Grip sin dolor","Flexión resistida ≤2/10","Sin parestesias cubitales","Resistencia pronación tolerada"],"factores_recaida":["Trabajo manual repetitivo","Pronación forzada continua","Falta control escapular","Irritación cubital no tratada"],"tecnicas_manuales":["Liberación flexor-pronador","Movilización cubital","Neurodinamia nervio cubital","Movilidad cervical C8–T1"],"ejercicio":{"inicial":["Isométricos flexores muñeca"],"intermedio":["Excéntricos pronación","Grip progresivo"],"avanzado":["Trabajo funcional agarre"]},"educacion":["No es inflamación del tendón","Evitar sobreprotección excesiva","Control del volumen de carga","Revisar ergonomía laboral"],"tratamiento":"Excéntricos flexores, corrección técnica. Valorar nervio cubital asociado."},{"id":"neuropatia_cubital","r":"codo","n":"Neuropatía Cubital (Cubital Tunnel)","p":["parestesias 4-5 dedo","Tinel cubital positivo","debilidad intrínseca mano","dolor medial codo con flexión"],"rts_days":[28,120],"fases":[{"n":"Irritativa","c":"Parestesias intermitentes"},{"n":"Moderada","c":"Parestesias + debilidad leve"},{"n":"Severa","c":"Déficit motor + atrofia"}],"criterios_rts":["Sin parestesias 48h post carga","Flexión sostenida tolerada","Fuerza intrínsecos OK"],"factores_recaida":["Flexión mantenida del codo","Apoyo prolongado","Sobrecarga flexores"],"tecnicas_manuales":["Liberación túnel cubital","Movilización cubital","Cervical C8–T1"],"ejercicio":{"inicial":["Deslizamientos nervio cubital"],"intermedio":["Control flexión codo"],"avanzado":["Fortalecimiento intrínsecos mano"]},"educacion":["Evitar flexión prolongada","Ergonomía nocturna","Evitar presión directa"],"tratamiento":"Almohada nocturna, ejercicios deslizamiento neural. Cirugía si severo o progresivo."},{"id":"radiculopatia_cervical","r":"cervical","n":"Radiculopatía Cervical","p":["dolor irradiado brazo","Spurling positivo","parestesias dermatomal","debilidad miotomal"],"rts_days":[14,180],"fases":[{"n":"Aguda irritativa","c":"Dolor + parestesias fluctuantes"},{"n":"Subaguda neural","c":"Dolor más estable + déficits leves"},{"n":"Sensibilización neural","c":"Síntomas amplificados, ULNT +"},{"n":"Crónica","c":"Dolor persistente + disfunción + miedo movimiento"}],"criterios_rts":["ULNT negativo o mínimo síntomas","Spurling negativo o no provocativo","Sin parestesias en carga funcional","Fuerza miotomal ≥90%","Tolerancia carga cervical repetida"],"factores_recaida":["Estenosis foraminal","Protrusión discal persistente","Mala movilidad cervicotorácica","Kinesiofobia","Estrés crónico"],"tecnicas_manuales":["Movilización segmentaria C4–C7","Técnicas descompresión foraminal","Tracción cervical","Movilización T1–T4","Neurodinamia mediano/radial/cubital"],"ejercicio":{"inicial":["Deep neck flexor activation (chin tuck)","Isométricos cervicales suaves","Neurodinamia tipo slider"],"intermedio":["Resistencia cervical progresiva","Control escapular serrato + trapecio inferior"],"avanzado":["Carga en cadena cerrada","Resistencia rotacional","Integración funcional"]},"educacion":["El nervio está sensible, no dañado permanentemente","Los síntomas pueden fluctuar sin daño real","Mover es parte del tratamiento","La postura no es causa única del problema"],"tratamiento":"Neurodinamia ULNT, tracción manual, collar si agudo. Cirugía si déficit motor progresivo."},{"id":"cervicalgia_mecanica","r":"cervical","n":"Cervicalgia Mecánica","p":["dolor cuello localizado","limitación ROM cervical","dolor postural","sin irradiación"],"rts_days":[7,42],"fases":[{"n":"Aguda","c":"Dolor + limitación ROM"},{"n":"Subaguda","c":"Mejora progresiva"},{"n":"Funcional","c":"Recuperación completa"}],"criterios_rts":["ROM completo sin dolor","Tolerancia carga","Sin limitación funcional"],"factores_recaida":["Postura mantenida","Estrés","Sedentarismo cervical"],"tecnicas_manuales":["Movilización cervical segmentaria","Movilización torácica","Tejidos blandos cervicales"],"ejercicio":{"inicial":["Movilidad cervical activa"],"intermedio":["Isométricos cervicales","Control escapular"],"avanzado":["Resistencia progresiva"]},"educacion":["Postura no es la causa única","Movimiento es tratamiento","Evitar sobreprotección"],"tratamiento":"Movilización cervical, ejercicio control motor, educación postural."},{"id":"menisco","r":"rodilla","n":"Lesión Meniscal","p":["dolor línea articular","Thessaly positivo","catching/locking","dolor carga rotacional"],"rts_days":[42,180],"fases":[{"n":"Aguda","c":"Derrame, dolor línea articular"},{"n":"Subaguda","c":"Menos inflamación"},{"n":"Crónica","c":"Catching recurrente"}],"criterios_rts":["Sin derrame","ROM completo","Thessaly negativo o asintomático","Saltos sin dolor","Fuerza ≥90%"],"factores_recaida":["Persistencia derrame","Déficit cuádriceps","Obesidad","Retorno precoz","OA coexistente"],"tecnicas_manuales":["Movilización tibiofemoral","Movilidad extensión","Control edema"],"ejercicio":{"inicial":["Cuádriceps","Glúteos"],"intermedio":["Propiocepción","Progresión impacto"],"avanzado":["Carrera progresiva","Cambios dirección"]},"educacion":["Evitar giros bruscos iniciales","Carga progresiva segura"],"tratamiento":"Ejercicio fuerza cuádriceps-isquios. Artroscopia si bloqueo o fallo conservador >12 semanas."},{"id":"lca","r":"rodilla","n":"Rotura LCA","p":["trauma rotacional","giving way","derrame rápido","Lachman positivo","pivot shift"],"rts_days":[270,540],"fases":[{"n":"Aguda (0–6 sem)","c":"Derrame + dolor"},{"n":"Fuerza (6 sem–4 m)","c":"Recuperación fuerza"},{"n":"Potencia (4–8 m)","c":"Pliometría + agilidad"},{"n":"RTS (9–12 m)","c":"Retorno deportivo completo"}],"criterios_rts":["LSI ≥90–95%","Hop tests ≥90%","Sin derrame","Sin giving way","ACL-RSI adecuado","Cambio dirección sin síntomas"],"factores_recaida":["RTS <9 meses","Déficit cuádriceps","Miedo movimiento","Mala mecánica aterrizaje"],"tecnicas_manuales":["Recuperación extensión","Movilización patelar","Manejo edema"],"ejercicio":{"inicial":["Fuerza cuádriceps","Fuerza isquios"],"intermedio":["Pliometría","Agilidad"],"avanzado":["Exposición deportiva completa"]},"educacion":["Injerto no es recuperación funcional","Criterio funcional es más importante que el tiempo"],"tratamiento":"Reconstrucción LCA + rehabilitación 9–12 meses. Fuerza + neuromuscular + confianza psicológica."},{"id":"oa_rodilla","r":"rodilla","n":"Osteoartritis de Rodilla","p":["dolor mecánico rodilla","crepitación","rigidez matutina <30min","limitación ROM"],"rts_days":[null,null],"fases":[{"n":"Temprana","c":"Dolor actividad"},{"n":"Moderada","c":"Rigidez y limitación"},{"n":"Avanzada","c":"Dolor frecuente"}],"criterios_rts":["Caminar sin aumento síntomas","Subir escaleras","Mejorar ROM","Mejorar capacidad funcional"],"factores_recaida":["Obesidad","Sedentarismo","Debilidad cuádriceps","Baja adherencia"],"tecnicas_manuales":["Movilizaciones tibiofemorales","PFJ","Tejidos blandos"],"ejercicio":{"inicial":["Fuerza cuádriceps","Fuerza cadera"],"intermedio":["Ejercicio aeróbico"],"avanzado":["Progresión funcional"]},"educacion":["OA no es desgaste inevitable","Movimiento protege articulación"],"tratamiento":"Ejercicio, pérdida peso, órtesis. Infiltración si dolor agudo. Prótesis si incapacitante."},{"id":"akp_patelofemoral","r":"rodilla_akp","n":"Dolor Patelofemoral (AKP)","p":["dolor anterior rodilla","dolor escaleras/sentadilla","movie theater sign","maltracking","debilidad cadera"],"rts_days":[42,180],"fases":[{"n":"Irritable","c":"Dolor frecuente, stairs pain, movie sign, baja tolerancia carga"},{"n":"Subaguda","c":"Dolor intermitente, mejora con reposo"},{"n":"Crónica","c":">3 meses, kinesiofobia, pérdida fuerza, alteración control motor"}],"criterios_rts":["Dolor ≤2/10 durante carga","Sin aumento síntomas 24h post actividad","Single-leg squat sin colapso dinámico","Step-down controlado","Fuerza cuádriceps ≥90%","Fuerza glúteo medio ≥90%"],"factores_recaida":["Debilidad glúteo medio","Debilidad rotadores externos cadera","Valgo dinámico","Incremento brusco carga","Kinesiofobia","Movie sign persistente","Patela alta","TT-TG aumentado"],"tecnicas_manuales":["Movilización PF medial","Liberación retináculo lateral","Movilización tibiofemoral","Movilización cadera","Terapia manual toracolumbar si déficit regional"],"ejercicio":{"inicial":["Isométricos cuádriceps","Puente","Clam shells","Side plank"],"intermedio":["Squat parcial","Step-down","Split squat"],"avanzado":["Single-leg squat","Salto","Aterrizaje","Cambios dirección"]},"educacion":["AKP no es daño estructural grave","Evitar reposo prolongado","Monitorizar carga","Dolor leve durante ejercicio es aceptable"],"tratamiento":"Fuerza glúteo+cuádriceps, corrección biomecánica, taping McConnell. Control dinámico."},{"id":"tendinopatia_patelar","r":"rodilla_akp","n":"Tendinopatía Patelar (Jumper's Knee)","p":["dolor polo inferior patela","decline squat positivo","dolor carga excéntrica","deportes de salto"],"rts_days":[90,180],"fases":[{"n":"Reactiva","c":"Dolor tras carga"},{"n":"Disrepair","c":"Dolor durante carga"},{"n":"Degenerativa","c":"Persistente"}],"criterios_rts":["Decline squat ≤2/10","Saltos repetidos sin reagudización","VISA-P >90","Fuerza simétrica"],"factores_recaida":["Exceso carga","Retorno precoz","Déficit fuerza cuádriceps","Rigidez cadena extensora"],"tecnicas_manuales":["Descarga tejidos blandos","Movilidad PFJ"],"ejercicio":{"inicial":["Isométricos 45–60s"],"intermedio":["Heavy slow resistance"],"avanzado":["Pliometría","Retorno específico deporte"]},"educacion":["Tendón necesita carga","Reposo absoluto empeora adaptación"],"tratamiento":"Heavy slow resistance excéntrico, decline squat. Sin infiltración local."},{"id":"hoffa_fatpad","r":"rodilla_akp","n":"Síndrome Hoffa (Fat Pad)","p":["dolor infrapatelar profundo","dolor extensión terminal","burning infrapatelar","maltracking asociado"],"rts_days":[42,84],"fases":[{"n":"Irritable","c":"Dolor extensión terminal"},{"n":"Crónica","c":"Inflamación persistente"}],"criterios_rts":["Extensión completa sin dolor","Carrera sin irritación","Salto sin dolor anterior"],"factores_recaida":["Hiperextensión","Maltracking","Coexistencia tendinopatía"],"tecnicas_manuales":["Taping descarga Hoffa","Corrección tracking patelar"],"ejercicio":{"inicial":["Evitar hiperextensión inicial","Fortalecimiento cadera"],"intermedio":["Control dinámico"],"avanzado":["Progresión deportiva"]},"educacion":["No bloquear rodilla en extensión"],"tratamiento":"Evitar extensión completa, taping patelar, control inflamación."},{"id":"plica_medial","r":"rodilla_akp","n":"Síndrome de Plica","p":["clicking/catching rodilla","dolor flex-ext repetida","Stutter test positivo","confundible menisco"],"rts_days":[42,84],"fases":[{"n":"Irritativa","c":"Clicking + dolor"},{"n":"Subaguda","c":"Menos irritabilidad"}],"criterios_rts":["Ausencia catching","Pruebas funcionales negativas"],"factores_recaida":["Flexo-extensión repetitiva","Maltracking asociado"],"tecnicas_manuales":["Movilización PFJ","Tejidos blandos"],"ejercicio":{"inicial":["Control dinámico","Fortalecimiento cadera"],"intermedio":["Corrección tracking"],"avanzado":["Progresión deportiva"]},"educacion":["Evitar irritación repetida"],"tratamiento":"Anti-inflamatorios, ejercicio suave, artroscopia si refractario."},{"id":"strain_cuadriceps","r":"cuadriceps","n":"Lesión Cuádriceps / Recto Femoral","p":["dolor explosivo muslo anterior","pop sprint/kick","dolor extensión resistida","gap palpable muslo"],"rts_days":[14,112],"fases":[{"n":"Aguda (0–72h)","c":"Hemorragia, dolor, impotencia funcional"},{"n":"Subaguda (3–10d)","c":"ROM + activación"},{"n":"Remodelación (2–6 sem)","c":"Fuerza progresiva"},{"n":"Funcional","c":"Sprint progresivo"}],"criterios_rts":["Sprint sin dolor","Fuerza ≥90–95%","Test excéntrico RF negativo","Salto/kick tolerado"],"factores_recaida":["Lesión previa reciente","Sprint precoz","Tendón central afectado","Fatiga neuromuscular","Déficit glúteo + core","Retorno sin fuerza excéntrica"],"tecnicas_manuales":["Drenaje suave","Liberación miofascial periférica","Movilización cadera sin agresión precoz","Descarga cuádriceps indirecta"],"ejercicio":{"inicial":["Isométricos RF (90°)","Extensiones controladas"],"intermedio":["Hip flexion resistida","Nordic parcial RF"],"avanzado":["Progresión sprint lineal","Pliometría"]},"educacion":["No es solo dolor: es carga estructural","Evitar estiramiento agresivo precoz","Riesgo alto de recaída si sprint precoz","Progresión por función no por dolor"],"tratamiento":"POLICE agudo, flexión 120° en contusión. Excéntricos fase tardía. MRI si sospecha tendón central."},{"id":"contusion_cuadriceps","r":"cuadriceps","n":"Contusión Cuádriceps","p":["golpe directo muslo","hematoma","limitación flexión","dolor palpación"],"rts_days":[7,42],"fases":[{"n":"Aguda inflamatoria (0–72h)","c":"Hematoma, limitación ROM"},{"n":"Subaguda","c":"Recuperar ROM"},{"n":"Funcional","c":"Progresión carga"}],"criterios_rts":["ROM completo >120° flexión","Fuerza normal","Sprint sin dolor"],"factores_recaida":["Hematoma no controlado","Retorno precoz","Inmovilización excesiva o agresión precoz"],"tecnicas_manuales":["Drenaje suave","Movilización leve progresiva (NO agresiva precoz)"],"ejercicio":{"inicial":["Contracciones isométricas tempranas","Progresión flexión activa","Marcha"],"intermedio":["Extensiones progresivas"],"avanzado":["Sprint progresivo"]},"educacion":["Flexión temprana a 120° reduce riesgo de miositis osificante","Evitar masaje agresivo en fase aguda"],"tratamiento":"Flexión inmediata 120°, hielo, compresión. Vigilar miositis osificante (MO)."},{"id":"strain_aductor","r":"aductor","n":"Lesión Aductor / Pubalgia","p":["dolor inguinal","dolor adducción resistida","squeeze test positivo","dolor sprint/cambio dirección"],"rts_days":[7,100],"fases":[{"n":"Aguda (0–5d)","c":"Dolor intenso, limitación funcional"},{"n":"Subaguda (5–21d)","c":"Mejora progresiva"},{"n":"Remodelación (3–8 sem)","c":"Fuerza + control motor"}],"criterios_rts":["Dolor ≤1/10 aducción resistida","Copenhagen test ≥90%","Sprint y cambios dirección sin dolor","Fuerza simétrica aductores"],"factores_recaida":["Lesión previa inguinal","Asimetría aductores >10%","Retorno precoz sprint","Déficit core/hip stability","Carga excéntrica insuficiente"],"tecnicas_manuales":["Liberación miofascial aductores","Tratamiento psoas/inguinal","Movilidad cadera (especial rotación)","Descarga sínfisis"],"ejercicio":{"inicial":["Isométricos aductores 0–45°"],"intermedio":["Copenhagen adduction progresivo","Squats amplios controlados"],"avanzado":["Desplazamientos laterales","Sprint progresivo","Cambios dirección"]},"educacion":["Lesión altamente recidivante si se vuelve rápido a sprint","Dolor inguinal no es daño estructural siempre","La fuerza aductora es el principal predictor de recaída"],"tratamiento":"Progresión carga aductores, Copenhagen adduction. Cirugía si retracción completa con retracción >2cm."},{"id":"strain_isquios","r":"isquiotibiales","n":"Lesión Isquiotibiales (Hamstring)","p":["dolor posterior muslo sprint","sensación tirón o pop","marcha rígida stiff-legged","equimosis posterior"],"rts_days":[7,84],"fases":[{"n":"Aguda (0–72h)","c":"Dolor + protección funcional"},{"n":"Subaguda (3–10d)","c":"Isométricos + activación"},{"n":"Remodelación (2–4 sem)","c":"Excéntricos"},{"n":"Funcional (4–8 sem)","c":"Sprint progresivo"},{"n":"RTS","c":"Exposición deportiva completa"}],"criterios_rts":["Marcha sin dolor","ROM completo bilateral","Fuerza ≥90–95% lado sano","Fuerza excéntrica simétrica","Sprint máximo sin dolor","Cambios dirección completos"],"factores_recaida":["Lesión previa (principal predictor)","Retorno precoz","Déficit excéntrico","Mala progresión sprint","Fatiga residual","Asimetría fuerza","Lesión proximal previa"],"tecnicas_manuales":["Liberación miofascial posterior","Movilización neural ciática","Trabajo fascia posterior","Movilización pélvica","Trabajo tejido proximal"],"ejercicio":{"inicial":["Curl isométrico","Bridge hold","Hip hinge hold"],"intermedio":["Nordic hamstring progresivo","Romanian deadlift","Slider curls"],"avanzado":["Nordic full ROM","Sprint drills progresivos","Cambios dirección","Saltos reactivos"]},"educacion":["Dolor no siempre significa daño","Evitar retorno precoz es clave","La recaída es más común que la primera lesión","La fuerza excéntrica protege el tejido","El sprint es el mayor estresor del isquio"],"tratamiento":"Excéntricos en elongación (Nordic hamstring). Control lumbopélvico. NO volver precoz al deporte."},{"id":"avulsion_isquios","r":"isquiotibiales","n":"Avulsión Proximal Isquiotibiales","p":["dolor al sentarse","dolor glúteo profundo","retracción palpable","trauma grave sprint/salto"],"rts_days":[90,270],"fases":[{"n":"Aguda severa","c":"Incapacidad funcional + hematoma"},{"n":"Conservador/postquirúrgico","c":"Progresión muy lenta"}],"criterios_rts":["Fuerza ≥90–95%","Sprint completo","Test funcional elite sin dolor"],"factores_recaida":["Retorno precoz","Déficit fuerza explosiva","Cicatrización incompleta"],"tecnicas_manuales":["Mínima fase aguda","Movilidad progresiva controlada"],"ejercicio":{"inicial":["Protección + carga mínima"],"intermedio":["Isométricos progresivos"],"avanzado":["Excéntricos tardíos","Sprint muy progresivo"]},"educacion":["Lesión de alto impacto funcional","No acelerar recuperación por dolor bajo"],"tratamiento":"Cirugía si >2 tendones o >2cm retracción. Rehab larga 6–18 meses."},{"id":"strain_gemelo","r":"gemelo","n":"Lesión Gemelo Medial (Tennis Leg)","p":["pop súbito pantorrilla","dolor posteromedial","dorsiflexión dolorosa","incapacidad heel raise"],"rts_days":[7,112],"fases":[{"n":"Aguda (0–7d)","c":"Dolor al caminar + cojera"},{"n":"Subaguda (1–3 sem)","c":"Dolor en push-off + edema"},{"n":"Funcional intermedia","c":"Dolor solo en sprint/hop"},{"n":"RTS","c":"Sin dolor en running + saltos"}],"criterios_rts":["Sin dolor en marcha, salto y sprint","Fuerza ≥90–95% contralateral","≥20–25 heel raises unilaterales sin dolor","Hop test simétrico","Sprint progresivo sin síntomas","Cambios dirección tolerados a alta intensidad"],"factores_recaida":["Lesión previa (principal predictor)","Retorno precoz","Déficit excéntrico","Fatiga neuromuscular","Edad >25","Deportes explosivos"],"tecnicas_manuales":["Liberación miofascial gemelo","Drenaje manual edema","Movilización tobillo talocrural","Liberación fascia posterior cadena"],"ejercicio":{"inicial":["Isométricos plantarflexión"],"intermedio":["Heel raises bilaterales","Single-leg calf raises"],"avanzado":["Eccentric heel raises","Hopping + running","Sprint progresivo"]},"educacion":["No estirar al inicio","Cargar progresivamente","Recaídas frecuentes si se vuelve pronto","Imagen no manda el retorno: manda la función","Si no puedes saltar bien no puedes correr rápido"],"tratamiento":"POLICE agudo, compresión. Heel raises progresivos. Excéntricos fase 3. NO estirar precoz."},{"id":"rotura_aquiles_parcial","r":"gemelo","n":"Tendinopatía / Lesión Aquiles","p":["dolor tendón aquiles","dolor matutino al levantarse","dolor carga excéntrica","engrosamiento palpable"],"rts_days":[56,180],"fases":[{"n":"Reactiva","c":"Dolor tras carga"},{"n":"Disrepair","c":"Dolor durante carga"},{"n":"Degenerativa","c":"Crónica"}],"criterios_rts":["Heel raise simétrico","Hopping sin dolor","Running tolerado","Fuerza ≥90%"],"factores_recaida":["Retorno precoz","Carga explosiva antes de recuperación excéntrica","Déficit dorsiflexión"],"tecnicas_manuales":["Movilización talocrural","Liberación pantorrilla","Movilidad subtalar"],"ejercicio":{"inicial":["Isométricos plantarflexión"],"intermedio":["Heel raises Alfredson/Silbernagel"],"avanzado":["Pliometría progresiva","Carrera progresiva"]},"educacion":["Tendón necesita carga progresiva","Reposo absoluto empeora adaptación"],"tratamiento":"Excéntricos Alfredson/Silbernagel. Ondas de choque. Ortesis si agudo. RTS lento."}],"tests_by_region":{"hombro":[{"id":"er_lag","n":"External Rotation Lag Sign (90°)","s":"Infraspinoso/Supraespinoso","se":null,"sp":null,"role":"confirmar","dor":12.7},{"id":"ir_lag","n":"Internal Rotation Lag Sign","s":"Subescapular","se":null,"sp":null,"role":"confirmar","dor":7.0},{"id":"drop_arm","n":"Drop Arm Test","s":"Supraespinoso","se":0.21,"sp":0.92,"role":"confirmar"},{"id":"jobe","n":"Jobe / Empty Can","s":"Supraespinoso","se":0.59,"sp":0.67,"role":"apoyo"},{"id":"neer","n":"Neer Impingement Sign","s":"Espacio subacromial","se":0.72,"sp":0.6,"role":"descartar"},{"id":"hawkins","n":"Hawkins-Kennedy","s":"Espacio subacromial","se":0.79,"sp":0.59,"role":"descartar"},{"id":"speed","n":"Speed Test","s":"LHBT bíceps","se":0.32,"sp":0.75,"role":"apoyo"},{"id":"yergason","n":"Yergason Test","s":"LHBT / corredera bicipital","se":0.37,"sp":0.86,"role":"apoyo"},{"id":"apprehension_gh","n":"Apprehension Test","s":"Cápsula anterior / Labrum","se":0.72,"sp":0.6,"role":"apoyo"},{"id":"relocation","n":"Relocation Test","s":"Inestabilidad anterior","se":0.81,"sp":0.86,"role":"confirmar"},{"id":"belly_press","n":"Belly Press Test","s":"Subescapular superior","se":0.4,"sp":0.98,"role":"confirmar"},{"id":"bear_hug","n":"Bear Hug Test","s":"Subescapular porciones superiores","se":0.6,"sp":0.92,"role":"confirmar"},{"id":"hornblower","n":"Hornblower Sign","s":"Teres Minor / Rotura posterosuperior","se":null,"sp":null,"role":"apoyo"}],"cadera":[{"id":"faddir","n":"FADDIR","s":"FAI / Labrum anterosuperior","se":0.96,"sp":0.1,"role":"descartar"},{"id":"faber_cadera","n":"FABER Test","s":"Intraarticular / SIJ","se":0.88,"sp":0.64,"role":"apoyo"},{"id":"log_roll","n":"Log Roll Test","s":"Patología intraarticular pura","se":0.43,"sp":0.93,"role":"confirmar"},{"id":"trendelenburg","n":"Trendelenburg Test","s":"Glúteo medio","se":0.55,"sp":0.7,"role":"apoyo"},{"id":"scour","n":"Scour Test","s":"Superficie acetabular","se":null,"sp":null,"role":"apoyo"},{"id":"thomas_cadera","n":"Thomas Test","s":"Iliopsoas / flexores","se":null,"sp":null,"role":"apoyo"},{"id":"ober","n":"Ober Test","s":"TFL / Cintilla IT","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_ext_derotation","n":"Resisted External Derotation Test","s":"Glúteo medio / GTPS","se":null,"sp":null,"role":"apoyo"},{"id":"snapping_hip","n":"Snapping Hip / Coxa Saltans","s":"Iliopsoas / TFL","se":null,"sp":null,"role":"apoyo"}],"lumbar":[{"id":"slr","n":"SLR (Straight Leg Raise)","s":"Tensión radicular L4-S1","se":0.91,"sp":0.26,"role":"descartar"},{"id":"crossed_slr","n":"Crossed SLR","s":"Hernia discal significativa","se":0.29,"sp":0.88,"role":"confirmar"},{"id":"slump","n":"Slump Test","s":"Tensión neural global","se":0.84,"sp":0.83,"role":"apoyo"},{"id":"faber_sij","n":"FABER (SIJ)","s":"Articulación sacroiliaca","se":null,"sp":null,"role":"apoyo"},{"id":"gaenslen","n":"Gaenslen Test","s":"Articulación sacroiliaca","se":null,"sp":null,"role":"apoyo"},{"id":"kemp","n":"Kemp Test","s":"Facetario / estenosis","se":null,"sp":null,"role":"apoyo"},{"id":"fortin_finger","n":"Fortin Finger Test","s":"SIJ","se":null,"sp":null,"role":"apoyo"}],"toracico":[{"id":"palpacion_toracica","n":"Palpación segmental torácica","s":"Disfunción costovertebral/facetaria","se":null,"sp":null,"role":"apoyo"},{"id":"movimiento_toracico","n":"ROM torácico (flexión/extensión/rotación)","s":"Rigidez segmental torácica","se":null,"sp":null,"role":"apoyo"},{"id":"palpacion_costal","n":"Palpación costovertebral","s":"Disfunción costal","se":null,"sp":null,"role":"apoyo"},{"id":"spring_test","n":"Spring Test (PA pressure)","s":"Rigidez segmental torácica","se":null,"sp":null,"role":"apoyo"},{"id":"control_escapular","n":"Test control escapular","s":"Disfunción escapulotorácica","se":null,"sp":null,"role":"apoyo"}],"tobillo":[{"id":"anterior_drawer_tobillo","n":"Anterior Drawer Test Tobillo","s":"ATFL","se":0.74,"sp":0.88,"role":"confirmar"},{"id":"anterolateral_drawer","n":"Anterolateral Drawer Test","s":"Inestabilidad rotacional tobillo","se":null,"sp":null,"role":"confirmar"},{"id":"talar_tilt","n":"Talar Tilt / Inversion Stress","s":"CFL ± ATFL","se":0.5,"sp":0.88,"role":"apoyo"},{"id":"ottawa_ankle","n":"Ottawa Ankle Rules","s":"Fractura / hueso","se":0.99,"sp":null,"role":"descartar"},{"id":"squeeze_tobillo","n":"Squeeze Test Tobillo","s":"Sindesmosis","se":0.3,"sp":0.93,"role":"confirmar"},{"id":"external_rotation_stress","n":"External Rotation Stress Test","s":"Sindesmosis","se":0.71,"sp":0.63,"role":"apoyo"},{"id":"thompson","n":"Thompson Test","s":"Tendón de Aquiles","se":0.96,"sp":0.93,"role":"confirmar"},{"id":"kleiger","n":"Kleiger (ER) Test","s":"Deltoideo / sindesmosis medial","se":null,"sp":null,"role":"apoyo"}],"codo":[{"id":"cozen","n":"Cozen Test","s":"Epicóndilo lateral / ECRB","se":0.84,"sp":0.74,"role":"apoyo"},{"id":"mill","n":"Mill Test","s":"Estiramiento tendón extensor","se":null,"sp":null,"role":"apoyo"},{"id":"maudsley","n":"Maudsley Test","s":"Extensión dedo medio / ECRB","se":null,"sp":null,"role":"apoyo"},{"id":"chair_pushup","n":"Chair Push-up Test","s":"Dolor funcional lateral codo","se":0.88,"sp":null,"role":"confirmar"},{"id":"golfer_test","n":"Test de Golfer","s":"Epicóndilo medial / flexor-pronador","se":null,"sp":null,"role":"apoyo"},{"id":"tinel_cubital","n":"Tinel Canal Cubital","s":"Nervio cubital","se":0.7,"sp":0.98,"role":"confirmar"},{"id":"flexion_cubital","n":"Flexion Test Cubital","s":"Neuropatía cubital dinámica","se":null,"sp":null,"role":"apoyo"},{"id":"froment","n":"Froment Sign","s":"Nervio cubital / intrínsecos","se":null,"sp":null,"role":"apoyo"},{"id":"tinel_radial","n":"Tinel Radial Tunnel","s":"Nervio radial / radial tunnel","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_supination","n":"Resisted Supination Test","s":"Radial tunnel / supinadores","se":null,"sp":null,"role":"apoyo"}],"cervical":[{"id":"spurling","n":"Spurling Test","s":"Raíz nerviosa cervical","se":0.5,"sp":0.86,"role":"confirmar"},{"id":"ulnt1","n":"ULNT1 (Mediano)","s":"Nervio mediano / tensión neural","se":0.7,"sp":0.71,"role":"apoyo"},{"id":"ulnt_combinados","n":"ULNT Combinados (≥1 positivo)","s":"Sensibilización neural global","se":0.97,"sp":0.51,"role":"descartar"},{"id":"shoulder_abduction_relief","n":"Shoulder Abduction Relief Test","s":"Alivio radicular cervical","se":0.49,"sp":0.76,"role":"apoyo"},{"id":"arm_squeeze","n":"Arm Squeeze Test","s":"Dolor radicular vs no radicular","se":0.97,"sp":0.97,"role":"confirmar"},{"id":"neck_tornado","n":"Neck Tornado Test","s":"Compresión dinámica cervical","se":0.85,"sp":0.87,"role":"apoyo"},{"id":"traccion_cervical","n":"Tracción Cervical Manual","s":"Alivio radicular","se":0.33,"sp":0.97,"role":"confirmar"}],"rodilla":[{"id":"thessaly","n":"Thessaly Test (20°)","s":"Menisco medial/lateral","se":0.66,"sp":0.53,"role":"apoyo"},{"id":"mcmurray","n":"McMurray Test","s":"Menisco","se":0.55,"sp":0.77,"role":"apoyo"},{"id":"joint_line_tenderness","n":"Joint Line Tenderness","s":"Menisco/articular","se":0.63,"sp":0.5,"role":"apoyo"},{"id":"lachman","n":"Lachman Test","s":"LCA","se":0.85,"sp":0.94,"role":"confirmar"},{"id":"pivot_shift","n":"Pivot Shift Test","s":"Inestabilidad rotacional LCA","se":0.42,"sp":0.98,"role":"confirmar"},{"id":"anterior_drawer_rodilla","n":"Anterior Drawer Rodilla","s":"LCA","se":0.62,"sp":0.88,"role":"apoyo"},{"id":"giving_way","n":"Giving Way Rotacional","s":"Inestabilidad funcional LCA","se":null,"sp":null,"role":"apoyo"}],"rodilla_akp":[{"id":"clarke_grind","n":"Patellar Grind Test (Clarke)","s":"Articulación patelofemoral","se":null,"sp":null,"role":"apoyo"},{"id":"patellar_apprehension","n":"Patellar Apprehension Test","s":"Inestabilidad patelar / MPFL","se":0.72,"sp":0.6,"role":"apoyo"},{"id":"lateral_glide","n":"Lateral Glide Test","s":"Hipermovilidad patelar / MPFL","se":null,"sp":null,"role":"apoyo"},{"id":"patellar_tilt","n":"Patellar Tilt Test","s":"Retináculo lateral","se":null,"sp":null,"role":"apoyo"},{"id":"j_sign","n":"J-Sign","s":"Maltracking patelar / displasia","se":null,"sp":null,"role":"apoyo"},{"id":"single_leg_squat","n":"Single-Leg Squat","s":"Control dinámico patelofemoral","se":null,"sp":null,"role":"apoyo"},{"id":"step_down","n":"Step-Down Test","s":"Control femoropatelar","se":null,"sp":null,"role":"apoyo"},{"id":"decline_squat","n":"Decline Squat Test","s":"Tendón patelar (tendinopatía)","se":null,"sp":null,"role":"apoyo"},{"id":"hoffa_test","n":"Hoffa Test","s":"Fat pad infrapatelar","se":null,"sp":null,"role":"apoyo"},{"id":"stutter_test","n":"Stutter Test","s":"Plica medial","se":null,"sp":null,"role":"apoyo"},{"id":"hughston_plica","n":"Hughston Plica Test","s":"Plica sintomática","se":null,"sp":null,"role":"apoyo"}],"cuadriceps":[{"id":"ext_resistida_cuad","n":"Extensión resistida cuádriceps","s":"Recto femoral / cuádriceps","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_knee_hip","n":"Extensión rodilla + flexión cadera resistida","s":"Recto femoral biarticular","se":null,"sp":null,"role":"apoyo"},{"id":"palpacion_gap_cuad","n":"Palpación gap muscular cuádriceps","s":"Rotura parcial/completa","se":null,"sp":null,"role":"confirmar"},{"id":"flexion_rodilla_cuad","n":"Flexión rodilla post-contusión","s":"Severidad contusión","se":null,"sp":null,"role":"apoyo"},{"id":"ely_test","n":"Ely Test","s":"Rigidez recto femoral","se":null,"sp":null,"role":"apoyo"}],"aductor":[{"id":"squeeze_90","n":"Squeeze Test 90°","s":"Aductor relacionado","se":0.56,"sp":0.79,"role":"apoyo"},{"id":"squeeze_0","n":"Squeeze Test 0°","s":"Aductor relacionado","se":0.45,"sp":0.9,"role":"apoyo"},{"id":"resist_add_max_abd","n":"Resisted Adduction in Maximal Abduction","s":"Dolor aductor funcional","se":null,"sp":null,"role":"apoyo"},{"id":"palp_origen_aductor","n":"Palpación origen aductor longus","s":"Adductor longus proximal","se":null,"sp":null,"role":"apoyo"},{"id":"copenhagen_test","n":"Copenhagen Adduction Test","s":"Fuerza aductora funcional","se":null,"sp":null,"role":"apoyo"}],"isquiotibiales":[{"id":"bent_knee_stretch","n":"Bent-knee Stretch Test","s":"Lesión proximal isquiotibiales","se":0.84,"sp":0.83,"role":"apoyo"},{"id":"puranen_orava","n":"Puranen-Orava Test","s":"Tendinopatía/strain proximal","se":0.76,"sp":null,"role":"apoyo"},{"id":"modified_bent_knee","n":"Modified Bent-knee Stretch","s":"Lesión proximal aguda","se":null,"sp":null,"role":"apoyo"},{"id":"palp_posterior_muslo","n":"Palpación posterior muslo","s":"Zona lesionada isquiotibiales","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_hamstring_curl","n":"Resisted Hamstring Curl","s":"Función muscular isquio","se":null,"sp":null,"role":"apoyo"},{"id":"standing_heel_drag","n":"Standing Heel-drag Test","s":"Activación excéntrica isquio","se":null,"sp":null,"role":"apoyo"}],"gemelo":[{"id":"dorsiflexion_pasiva","n":"Dorsiflexión pasiva rodilla extendida","s":"Gastrocnemio / tensión","se":null,"sp":null,"role":"apoyo"},{"id":"heel_raise_ext","n":"Heel Raise Rodilla Extendida","s":"Gastrocnemio","se":null,"sp":null,"role":"apoyo"},{"id":"heel_raise_flex","n":"Heel Raise Rodilla Flexionada","s":"Sóleo","se":null,"sp":null,"role":"apoyo"},{"id":"thompson_gemelo","n":"Thompson Test","s":"Tendón de Aquiles","se":0.96,"sp":0.93,"role":"confirmar"},{"id":"palp_gemelo","n":"Palpación musculatura posterior pantorrilla","s":"Gastrocnemio medial/lateral","se":null,"sp":null,"role":"apoyo"},{"id":"single_leg_hop_gemelo","n":"Single-leg Hop Test","s":"Función deportiva pantorrilla","se":null,"sp":null,"role":"apoyo"}]},"region_keywords":{"hombro":["hombro","glenohumeral","manguito","subacromial","bíceps","biceps","escapular","rotador","deltoides","acromion"],"cadera":["cadera","coxofemoral","acetabular","labrum","trocánter","inguinal","fai","iliopsoas","piriforme","glúteo","gluteo","cadera"],"lumbar":["lumbar","lumbalgia","ciática","ciatica","discal","sacroiliaca","sij","facetario","cauda equina","l1","l2","l3","l4","l5","s1"],"toracico":["torácico","toracico","dorsal","espalda alta","escapula","escápula","t1","t2","t3","t4","t5","costilla","costovertebral","cifosis","interescapular"],"tobillo":["tobillo","esguince","atfl","cfl","sindesmosis","peroné","perone","maléolo","maleolo","aquiles"],"codo":["codo","epicóndilo","epicondilo","epicondilitis","tennis elbow","olécranon","olecranon","cubital","humeral","epitróclea"],"cervical":["cervical","cervicalgia","cuello","radiculopatía cervical","radiculopatia cervical","braquialgia","c3","c4","c5","c6","c7"],"rodilla_akp":["rótula","rotula","patelofemoral","patelar","akp","dolor anterior rodilla","plica","hoffa","maltracking","jumper"],"rodilla":["rodilla","menisco","lca","ligamento cruzado","tibia","fémur distal","femur distal","crepitación rodilla"],"cuadriceps":["cuádriceps","cuadriceps","recto femoral","muslo anterior","contusión muslo","contusion muslo"],"aductor":["aductor","ingle","pubis","pubalgia","sínfisis","sinfisis","groin","aductores"],"isquiotibiales":["isquiotibiales","isquio","semimembranoso","semitendinoso","bíceps femoral","biceps femoral","muslo posterior","hamstring"],"gemelo":["gemelo","gastrocnemio","pantorrilla","sóleo","soleo","aquiles","tennis leg","triceps sural","tríceps sural"]},"red_flags":[{"n":"Anestesia en silla de montar","sug":"Síndrome Cauda Equina (CES)","urg":"emergencia","act":"Derivación urgente neurociugía"},{"n":"Retención urinaria aguda","sug":"Síndrome Cauda Equina (CES)","urg":"emergencia","act":"Urgencias hospitalarias inmediatas"},{"n":"Déficit motor progresivo","sug":"Compresión neural severa","urg":"urgente","act":"Derivación neurología/neurocirugía"},{"n":"Fiebre + dolor lumbar","sug":"Infección espinal (espondilodiscitis)","urg":"urgente","act":"Analítica urgente, derivación médico"},{"n":"Pérdida peso inexplicada + dolor","sug":"Posible malignidad vertebral","urg":"urgente","act":"Derivación oncología/médico"},{"n":"Dolor nocturno severo que no cede","sug":"Patología sistémica/maligna","urg":"urgente","act":"Derivación médico"},{"n":"Trauma + osteoporosis + dolor agudo","sug":"Fractura vertebral","urg":"urgente","act":"Radiografía urgente"},{"n":"Hinchazón aguda post-trauma articular","sug":"Fractura/luxación","urg":"urgente","act":"Radiografía urgente, inmovilización"},{"n":"Fiebre + bursitis o articulación caliente","sug":"Artritis séptica / bursitis séptica","urg":"emergencia","act":"Urgencias, antibióticos"},{"n":"Edema difuso pantorrilla sin trauma","sug":"TVP (Trombosis Venosa Profunda)","urg":"urgente","act":"Eco-doppler urgente, derivación médico"},{"n":"Dolor pecho + disnea","sug":"Patología cardiopulmonar","urg":"emergencia","act":"Urgencias inmediatas, ECG"},{"n":"Déficit neurológico agudo miembro superior","sug":"Mielopatía cervical / ACV","urg":"emergencia","act":"Urgencias neurológicas"},{"n":"Deformidad visible post-trauma","sug":"Luxación / fractura","urg":"urgente","act":"Inmovilización y urgencias"},{"n":"Síntomas bilaterales MMII progresivos","sug":"Mielopatía / Cauda Equina","urg":"emergencia","act":"Neuroimagen urgente"},{"n":"Dolor al sentarse + hematoma glúteo","sug":"Avulsión isquiotibiales proximal","urg":"urgente","act":"Imagen (MRI), valorar cirugía"},{"n":"Dolor pecho irradiado a brazo izquierdo","sug":"Cardiopatía isquémica","urg":"emergencia","act":"ECG urgente + urgencias"},{"n":"Cefalea brusca intensa (thunderclap)","sug":"Hemorragia subaracnoidea","urg":"emergencia","act":"Urgencias neurológicas inmediatas"},{"n":"Mielopatía cervical progresiva","sug":"Compresión medular cervical","urg":"urgente","act":"Neuroimagen + neurocirugía"}]};
CLINICAL_KB.conditions.forEach(c => { conditionMap[c.id] = c; });

const testsByRegion = {};
Object.entries(CLINICAL_KB.tests_by_region).forEach(([rid, tests]) => {
  testsByRegion[rid] = tests;
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

// ── CORS + Security ──────────────────────────────────────────────────────────
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
  status: "ok", service: "FisioScript API v4.0",
  clinical_kb: {
    regions: Object.keys(CLINICAL_KB.regions).length,
    conditions: CLINICAL_KB.conditions.length,
    tests: Object.values(CLINICAL_KB.tests_by_region).flat().length,
    red_flags: CLINICAL_KB.red_flags.length,
  }
}));

// ── Build clinical context string ─────────────────────────────────────────────
function buildClinicalContext() {
  const regiones = Object.entries(CLINICAL_KB.regions).map(([id, n]) => `${id}:${n}`).join(', ');

  const condiciones = CLINICAL_KB.conditions.map(c => {
    const rts = c.rts_days && c.rts_days[0] ? `RTS ${c.rts_days[0]}–${c.rts_days[1]}d` : 'RTS variable/continuo';
    const fases = (c.fases||[]).map(f => `${f.n}: ${f.c}`).join(' | ');
    const rts_criterios = (c.criterios_rts||[]).join('; ');
    const recaida = (c.factores_recaida||[]).join('; ');
    const manuales = (c.tecnicas_manuales||[]).join('; ');
    const ejercicio = c.ejercicio ? [
      ...(c.ejercicio.inicial||[]),
      ...(c.ejercicio.intermedio||[]),
      ...(c.ejercicio.avanzado||[])
    ].join('; ') : '';
    const educacion = (c.educacion||[]).join('; ');
    return `[${c.id}] ${c.n} (${c.r})
  Patrones: ${(c.p||[]).join('; ')}
  ${rts}
  Fases: ${fases||'N/A'}
  RTS criterios: ${rts_criterios||'N/A'}
  Factores recaída: ${recaida||'N/A'}
  Técnicas manuales: ${manuales||'N/A'}
  Ejercicio: ${ejercicio||'N/A'}
  Educación: ${educacion||'N/A'}
  Tratamiento: ${c.tratamiento||'N/A'}`;
  }).join('\n\n');

  const tests = Object.entries(CLINICAL_KB.tests_by_region).flatMap(([rid, ts]) =>
    ts.map(t => {
      let s = `${t.n} (${rid}) → ${t.s}`;
      if (t.se) s += ` | Sens:${Math.round(t.se*100)}%`;
      if (t.sp) s += ` Espec:${Math.round(t.sp*100)}%`;
      if (t.dor) s += ` | DOR:${t.dor}`;
      s += ` | ${t.role}`;
      return s;
    })
  ).join('\n');

  const redFlags = CLINICAL_KB.red_flags.map(r => `⚠ ${r.n} → ${r.sug} (${r.urg}) → ${r.act}`).join('\n');

  return `=== BASE CLÍNICA FISIOSCRIPT v4.0 ===
REGIONES: ${regiones}

PATOLOGÍAS CON PROTOCOLO CLÍNICO COMPLETO:
${condiciones}

TESTS CLÍNICOS CON EVIDENCIA:
${tests}

BANDERAS ROJAS:
${redFlags}
======================================`;
}

const CLINICAL_CONTEXT = buildClinicalContext();

// ── POST /api/generate ────────────────────────────────────────────────────────
app.post("/api/generate", rateLimit(20, 60_000), async (req, res) => {
  const { text, lang } = req.body;
  const isEN = lang === 'en';
  if (!text || typeof text !== "string") return res.status(400).json({ error: isEN ? "Field 'text' is required." : "El campo 'text' es requerido." });
  if (text.trim().length < 10) return res.status(400).json({ error: isEN ? "Transcript too short." : "Transcripción demasiado corta." });
  if (text.length > 15_000) return res.status(400).json({ error: isEN ? "Transcript too long." : "Transcripción demasiado larga." });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server not configured." });

  const langInstruction = isEN
    ? "Always respond in English. Use physiotherapy clinical terminology in English. Field labels like 'motivo', 'soap', etc. should have English values."
    : "Responde siempre en español. Usa terminología clínica de fisioterapia en español.";

  const system = `Eres un fisioterapeuta clínico experto con acceso a una base de conocimiento validada.

LANGUAGE: ${langInstruction}

${CLINICAL_CONTEXT}

INSTRUCCIONES CRÍTICAS:
1. Analiza la transcripción usando la base de conocimiento anterior.
2. Para cada diagnóstico hipotético, calcula una probabilidad (0-100%) basada en cuántos patrones clínicos de la base de datos coinciden.
3. Para los tests detectados, usa la sensibilidad/especificidad de la base de datos.
4. Para recuperacion: usa los rts_days, fases, criterios_rts y factores_recaida del condition_id identificado en la KB.
5. Para tratamiento: usa las tecnicas_manuales, ejercicio y educacion del condition_id identificado en la KB.
6. Adapta los protocolos a la clínica real del paciente — la KB es la base, la clínica individual es el ajuste.

Devuelve ÚNICAMENTE este JSON exacto, sin markdown ni texto adicional:
{
  "historia": {
    "motivo": "motivo detallado con localización, inicio y características",
    "edad": "edad y datos demográficos",
    "antecedentes": "antecedentes médicos y lesiones previas",
    "medicacion": "medicación actual",
    "deporte": "actividad física, nivel, frecuencia",
    "exploracion": "exploración: postura, ROM, palpación, fuerza, EVA",
    "tratamiento": "técnicas aplicadas y pautas",
    "observaciones": "evolución y factores psicosociales"
  },
  "soap": {
    "S": "síntomas subjetivos completos",
    "O": "hallazgos objetivos: ROM con grados, tests y resultado",
    "A": "evaluación: diagnóstico fisioterápico, estructuras afectadas, severidad",
    "P": "plan: técnicas con dosis, ejercicios, objetivos, próxima cita"
  },
  "banderas_rojas": [
    {"titulo": "nombre", "descripcion": "explicación clínica", "severidad": "alta|media", "accion": "acción concreta"}
  ],
  "banderas_amarillas": [
    {"titulo": "nombre", "descripcion": "factor psicosocial", "severidad": "media|baja", "accion": "enfoque"}
  ],
  "hipotesis": {
    "principal": "diagnóstico más probable (nombre exacto de la base de datos si coincide)",
    "condition_id": "id exacto de la base de datos o null",
    "confianza": 0.75,
    "razonamiento": "razonamiento clínico: qué patrones coinciden y cuáles no",
    "diferenciales": [
      {"nombre": "diagnóstico diferencial 1", "probabilidad": 30, "condition_id": "id o null"},
      {"nombre": "diagnóstico diferencial 2", "probabilidad": 15, "condition_id": "id o null"}
    ]
  },
  "tests": [
    {
      "nombre": "nombre completo",
      "zona": "región anatómica",
      "estructura": "estructura evaluada",
      "resultado": "positivo|negativo|no realizado",
      "sensibilidad": "valor% si está en base de datos o null",
      "especificidad": "valor% si está en base de datos o null",
      "interpretacion": "significado clínico en este caso"
    }
  ],
  "recuperacion": {
    "estimacion_dias": {"min": 14, "max": 42},
    "estimacion_texto": "descripción legible del tiempo esperado basada en la KB",
    "fase_actual": "agudo|subagudo|crónico|rehabilitación|vuelta_actividad",
    "criterios_rts": ["criterio objetivo 1 de la KB", "criterio objetivo 2", "criterio objetivo 3"],
    "factores_riesgo_recaida": ["factor de la KB que aplique al caso"],
    "notas": "consideraciones específicas del caso clínico"
  },
  "tratamiento_sugerido": {
    "fase_actual": "Fase aguda|Fase subaguda|Fase de carga|Fase funcional|Mantenimiento",
    "kb_protocolo": "protocolo base de la KB para este condition_id",
    "tecnicas_manuales": ["técnica 1 de la KB con indicación", "técnica 2"],
    "ejercicios_clave": ["ejercicio 1 de la KB con dosis", "ejercicio 2"],
    "educacion_paciente": ["mensaje educativo clave de la KB", "mensaje 2"],
    "proximos_pasos": "plan para próximas sesiones",
    "derivacion": "derivación si es necesaria o 'No necesaria de momento'"
  }
}

REGLAS:
- condition_id: usa el ID exacto de la base de datos si el diagnóstico coincide. Crítico para recuperación y tratamiento.
- confianza: 0.0-1.0 basado en coincidencia de patrones. Con 1-2 patrones: 0.3-0.5. Con 3-4 patrones: 0.5-0.7. Con 5+ patrones: 0.7-0.95.
- estimacion_dias: usa rts_days de la base de datos si condition_id coincide.
- Si algo no se menciona: usa [] para listas o "No mencionado" para campos de texto.
- Sé exhaustivo con el tratamiento: protocolos reales de fisioterapia.`;

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
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Transcripción:\n\n${text}` },
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
    catch (e) { return res.status(502).json({ error: "Error al parsear respuesta." }); }

    // Defaults y normalización
    parsed.historia = parsed.historia || {};
    parsed.soap = parsed.soap || {};
    parsed.banderas_rojas = Array.isArray(parsed.banderas_rojas) ? parsed.banderas_rojas : [];
    parsed.banderas_amarillas = Array.isArray(parsed.banderas_amarillas) ? parsed.banderas_amarillas : [];
    parsed.hipotesis = parsed.hipotesis || {};
    parsed.tests = Array.isArray(parsed.tests) ? parsed.tests : [];
    parsed.recuperacion = parsed.recuperacion || {};
    parsed.tratamiento_sugerido = parsed.tratamiento_sugerido || {};

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
    }

    // Enriquecer tests con datos de KB
    parsed.tests = parsed.tests.map(t => {
      if (t.sensibilidad || t.especificidad) return t;
      // Buscar en KB por nombre similar
      for (const [rid, tests] of Object.entries(CLINICAL_KB.tests_by_region)) {
        const match = tests.find(kt =>
          kt.n.toLowerCase().includes(t.nombre?.toLowerCase()?.split(' ')[0]) ||
          t.nombre?.toLowerCase()?.includes(kt.n.toLowerCase().split(' ')[0])
        );
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

// ── GET /api/clinical/condition/:id ──────────────────────────────────────────
app.get("/api/clinical/condition/:id", (req, res) => {
  const cid = req.params.id;
  const cond = conditionMap[cid];
  if (!cond) return res.status(404).json({ error: "Condición no encontrada." });
  const tests = testsByRegion[cond.r] || [];
  res.json({ condition: cond, tests: tests.slice(0,10) });
});

// ── GET /api/clinical/region/:id ─────────────────────────────────────────────
app.get("/api/clinical/region/:id", (req, res) => {
  const rid = req.params.id;
  const conditions = CLINICAL_KB.conditions.filter(c => c.r === rid);
  const tests = testsByRegion[rid] || [];
  const redFlags = CLINICAL_KB.red_flags;
  res.json({ region: CLINICAL_KB.regions[rid], conditions, tests, red_flags: redFlags });
});

// ── POST /api/stripe/portal ───────────────────────────────────────────────────
app.post("/api/stripe/portal", rateLimit(10, 60_000), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no configurado." });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido." });
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
  const { priceId, email, extraSeats } = req.body;
  if (!priceId) return res.status(400).json({ error: "priceId requerido." });

  // Price IDs para profesionales extra (+5€/mes cada uno)
  const EXTRA_SEAT_PRICE_MONTHLY = 'price_1Tcit7POSeyVBgtaC7CSaSJs';
  const EXTRA_SEAT_PRICE_ANNUAL  = 'price_1Tcit7POSeyVBgtaC7CSaSJs';

  // Detectar si es plan anual
  const isAnual = priceId === 'price_1TWFFrPOSeyVBgta0XkvT9EZ' || priceId === 'price_1TWFFtPOSeyVBgtaN7yiBmPT';
  const isClinica = priceId === 'price_1TWFFrPOSeyVBgtahQl9oQvJ' || priceId === 'price_1TWFFtPOSeyVBgtaN7yiBmPT';

  // Construir line_items
  const lineItems = [{ price: priceId, quantity: 1 }];

  // Añadir profesionales extra si es plan clínica y se solicitan
  const seats = parseInt(extraSeats) || 0;
  if (isClinica && seats > 0 && seats <= 20) {
    const extraPriceId = isAnual ? EXTRA_SEAT_PRICE_ANNUAL : EXTRA_SEAT_PRICE_MONTHLY;
    // Solo añadir si el price ID extra está configurado (no es placeholder)
    if (!extraPriceId.includes('XXXX') && !extraPriceId.includes('YYYY')) {
      lineItems.push({ price: extraPriceId, quantity: seats });
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: lineItems,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          plan: priceId,
          extra_seats: seats.toString(),
        }
      },
      success_url: `${process.env.FRONTEND_URL||"https://fisioscript.com"}/exito.html?session_id={CHECKOUT_SESSION_ID}`,
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

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────
app.post("/api/stripe/webhook", async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no configurado." });
  const sig = req.headers["stripe-signature"];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send(`Webhook error: ${err.message}`); }

  console.log(`Stripe event: ${event.type}`);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.customer_email;
      const priceId = session.line_items?.data?.[0]?.price?.id || '';
      const planMap = {
        'price_1TWFFrPOSeyVBgtaKHKpCA7T': 'individual_mensual',
        'price_1TWFFrPOSeyVBgta0XkvT9EZ': 'individual_anual',
        'price_1TWFFrPOSeyVBgtahQl9oQvJ': 'clinica_mensual',
        'price_1TWFFtPOSeyVBgtaN7yiBmPT': 'clinica_anual',
      };
      const plan = planMap[priceId] || 'individual_mensual';
      console.log(`✓ Pago: ${email} → ${plan}`);
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        try {
          const usersRes = await fetch(
            `${process.env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
            { headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` } }
          );
          const usersData = await usersRes.json();
          const userId = usersData?.users?.[0]?.id;
          if (userId) {
            await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
              body: JSON.stringify({ user_metadata: { plan } })
            });
            console.log(`✓ Plan actualizado en Supabase: ${userId} → ${plan}`);
          }
        } catch(e) { console.error('Error actualizando plan:', e.message); }
      }
      break;
    }
    case "customer.subscription.deleted":
      console.log(`✗ Suscripción cancelada: ${event.data.object.customer}`);
      break;
  }
  return res.json({ received: true });
});

// ── Error handlers ────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: "Error interno." }); });

app.listen(PORT, () => {
  console.log(`\n✅  FisioScript API v3.0 → http://localhost:${PORT}`);
  console.log(`   GROQ_API_KEY:    ${process.env.GROQ_API_KEY ? "✓" : "✗ FALTA"}`);
  console.log(`   STRIPE:          ${process.env.STRIPE_SECRET_KEY ? "✓" : "✗"}`);
  console.log(`   SUPABASE:        ${process.env.SUPABASE_URL ? "✓" : "✗ (sin actualización plan auto)"}`);
  console.log(`   Clinical KB:     ${CLINICAL_KB.conditions.length} condiciones | ${Object.values(CLINICAL_KB.tests_by_region).flat().length} tests | ${CLINICAL_KB.red_flags.length} red flags\n`);
});
