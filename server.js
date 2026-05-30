import express from "express";
import cors from "cors";
import Stripe from "stripe";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════════════════════════
// BASE DE CONOCIMIENTO CLÍNICO FISIOSCRIPT v3.0 (13 regiones, 34 patologías)
// ═══════════════════════════════════════════════════════════════════════════
const CLINICAL_KB = {"regions":{"hombro":"Hombro","cadera":"Cadera","lumbar":"Columna Lumbar","toracico":"Columna Torácica / Espalda Alta","tobillo":"Tobillo","codo":"Codo","cervical":"Columna Cervical / Radiculopatía","rodilla":"Rodilla","rodilla_akp":"Dolor Anterior de Rodilla (AKP/Patelofemoral)","cuadriceps":"Cuádriceps","aductor":"Aductor / Ingle","isquiotibiales":"Isquiotibiales","gemelo":"Gemelo / Pantorrilla"},"conditions":[{"id":"rct_manguito","r":"hombro","n":"Rotura Manguito Rotador","p":["dolor hombro con movimiento","debilidad rotación","dolor nocturno","incapacidad elevación"],"rts_days":[90,180],"tratamiento":"Fisioterapia progresiva: rotadores + escapular. Cirugía si rotura completa atleta élite."},{"id":"sis_impingement","r":"hombro","n":"Síndrome Subacromial (SIS)","p":["dolor arco 60-120°","dolor con elevación","dolor nocturno leve","sin deficit fuerza significativo"],"rts_days":[30,90],"tratamiento":"Ejercicio terapéutico, corrección postura escapular, evitar compresión. Manual therapy."},{"id":"inestabilidad_gh","r":"hombro","n":"Inestabilidad Glenohumeral","p":["sensación luxación","apprehension","dolor joven deportista","trauma previo"],"rts_days":[90,270],"tratamiento":"Estabilizadores dinámicos. Cirugía si recidivante."},{"id":"tendinopatia_biceps","r":"hombro","n":"Tendinopatía Bíceps (LHBT)","p":["dolor anterior hombro","dolor surco bicipital","chasquido","dolor flexión codo resistida"],"rts_days":[30,60],"tratamiento":"Excéntricos bíceps, evitar carga end-range. Infiltración si crónico."},{"id":"fai_labrum","r":"cadera","n":"FAI / Lesión Labrum","p":["dolor inguinal","dolor con flexión cadera","limitación rotación interna","dolor salida coche/sentarse"],"rts_days":[60,120],"tratamiento":"Control motor cadera-core. Artroscopia si fallo conservador >6 meses."},{"id":"gtps_gluteo","r":"cadera","n":"Tendinopatía Glúteo / GTPS","p":["dolor lateral cadera","dolor trocánter mayor","Trendelenburg","empeora cruce piernas"],"rts_days":[60,120],"tratamiento":"Carga progresiva glúteo medio, evitar compresión. Sin estiramiento precoz."},{"id":"oa_cadera","r":"cadera","n":"Osteoartritis de Cadera","p":["rigidez matutina","dolor IR y flexión","marcha antálgica","limitación ROM global"],"rts_days":[null,null],"tratamiento":"Ejercicio aeróbico + fuerza. Pérdida peso. Artroplastia si incapacitante."},{"id":"radiculopatia_lumbar","r":"lumbar","n":"Radiculopatía Lumbar","p":["dolor irradiado pierna","parestesias","SLR positivo","déficit neurológico"],"rts_days":[30,90],"tratamiento":"Neurodinamia, control motor, educación dolor. Epidural si severo. Cirugía si CES."},{"id":"dolor_lumbar_mecanico","r":"lumbar","n":"Dolor Lumbar Mecánico","p":["dolor lumbar posicional","sin irradiación","centralización McKenzie","mejora movimiento"],"rts_days":[14,42],"tratamiento":"Ejercicio activo, McKenzie si centralización. Manipulación en agudo. Evitar reposo."},{"id":"sij_sacroiliaco","r":"lumbar","n":"Disfunción Sacroiliaca","p":["dolor zona SIJ","Fortin sign","dolor glúteo","cluster 3 tests positivos"],"rts_days":[21,60],"tratamiento":"Manipulación SIJ, estabilización cintura pélvica, ejercicio."},{"id":"dolor_toracico_mecanico","r":"toracico","n":"Dolor Torácico Mecánico / UBP","p":["dolor entre escápulas","dolor T1-T5","empeora sedestación","relación cuello-hombro","rigidez torácica"],"rts_days":[14,42],"tratamiento":"Movilización torácica, ejercicio fuerza escapular, educación postural. Enfoque multimodal."},{"id":"disfuncion_costovertebral","r":"toracico","n":"Disfunción Costovertebral","p":["dolor localizado costilla","dolor inspiración","dolor unilateral espalda alta","reproducible palpación"],"rts_days":[7,21],"tratamiento":"Movilización costal, respiración, HVLA si indicado."},{"id":"esguince_lateral","r":"tobillo","n":"Esguince Lateral (ATFL/CFL)","p":["inversión traumática","dolor lateral","hematoma precoz","incapacidad carga"],"rts_days":[7,84],"tratamiento":"POLICE agudo. Propiocepción precoz. Fuerza peroneos. Progresión funcional."},{"id":"sindesmosis","r":"tobillo","n":"Lesión Sindesmosis","p":["rotación externa traumática","dolor distal tibiofibular","squeeze positivo","recuperación lenta"],"rts_days":[42,120],"tratamiento":"Protección carga, control edema. Cirugía si diástasis. Rehab lenta y progresiva."},{"id":"rotura_aquiles","r":"tobillo","n":"Rotura Tendón Aquiles","p":["pop súbito","Thompson positivo","pérdida plantarflexión","incapacidad carga"],"rts_days":[180,365],"tratamiento":"Ortesis funcional vs cirugía. Excéntricos fase tardía. RTS lento."},{"id":"epicondilitis_lateral","r":"codo","n":"Epicondilitis Lateral (Tennis Elbow)","p":["dolor epicóndilo lateral","Cozen positivo","dolor extensión muñeca resistida","actividad repetitiva"],"rts_days":[30,90],"tratamiento":"Excéntricos ECRB, corrección técnica, ortesis. Ondas de choque si crónico."},{"id":"epicondilitis_medial","r":"codo","n":"Epicondilitis Medial (Golfer Elbow)","p":["dolor epicóndilo medial","golfer test positivo","dolor pronación resistida","posible parestesias"],"rts_days":[30,90],"tratamiento":"Excéntricos flexores, corrección técnica. Valorar nervio cubital."},{"id":"neuropatia_cubital","r":"codo","n":"Neuropatía Cubital","p":["parestesias 4-5 dedo","Tinel cubital positivo","debilidad intrínseca mano","dolor medial codo"],"rts_days":[30,90],"tratamiento":"Almohada nocturna, ejercicios deslizamiento neural. Cirugía si severo."},{"id":"radiculopatia_cervical","r":"cervical","n":"Radiculopatía Cervical","p":["dolor irradiado brazo","Spurling positivo","parestesias dermatoma","debilidad miotomal"],"rts_days":[30,90],"tratamiento":"Neurodinamia ULNT, tracción manual, collar si agudo. Cirugía si déficit motor."},{"id":"cervicalgia_mecanica","r":"cervical","n":"Cervicalgia Mecánica","p":["dolor cuello localizado","limitación ROM cervical","dolor postural","sin irradiación"],"rts_days":[14,42],"tratamiento":"Movilización cervical, ejercicio control motor, educación postural."},{"id":"menisco","r":"rodilla","n":"Lesión Meniscal","p":["dolor línea articular","Thessaly positivo","catching/locking","dolor con carga rotacional"],"rts_days":[42,180],"tratamiento":"Ejercicio fuerza cuádriceps-isquios. Artroscopia si bloqueo o fallo conservador."},{"id":"lca","r":"rodilla","n":"Rotura LCA","p":["trauma rotacional","giving way","derrame rápido","Lachman positivo","pivot shift"],"rts_days":[240,365],"tratamiento":"Reconstrucción LCA + rehabilitación 9-12 meses. Fuerza + neuromusuclar + confianza."},{"id":"oa_rodilla","r":"rodilla","n":"Osteoartritis de Rodilla","p":["dolor mecánico rodilla","crepitación","rigidez matutina <30min","limitación ROM"],"rts_days":[null,null],"tratamiento":"Ejercicio, pérdida peso, órtesis. Infiltración si dolor agudo. Prótesis si incapacitante."},{"id":"akp_patelofemoral","r":"rodilla_akp","n":"Dolor Patelofemoral (AKP)","p":["dolor anterior rodilla","dolor escaleras/sentadilla","movie theater sign","maltracking","debilidad cadera"],"rts_days":[42,120],"tratamiento":"Fuerza glúteo+cuádriceps, corrección biomecánica, taping McConnell. Control dinámico."},{"id":"tendinopatia_patelar","r":"rodilla_akp","n":"Tendinopatía Patelar (Jumper's Knee)","p":["dolor polo inferior patela","decline squat positivo","dolor carga excéntrica","deportes de salto"],"rts_days":[90,180],"tratamiento":"Heavy slow resistance excéntrico, decline squat. US confirma. Sin infiltración local."},{"id":"hoffa_fatpad","r":"rodilla_akp","n":"Síndrome Hoffa (Fat Pad)","p":["dolor infrapatelar profundo","dolor extensión terminal","burning infrapatelar","maltracking asociado"],"rts_days":[30,90],"tratamiento":"Evitar extensión completa, taping patelar, control inflamación. MRI si duda."},{"id":"plica_medial","r":"rodilla_akp","n":"Síndrome de Plica","p":["clicking/catching rodilla","dolor flex-ext repetida","Stutter test positivo","confundible menisco"],"rts_days":[30,60],"tratamiento":"Anti-inflamatorios, ejercicio suave, artroscopia si refractario."},{"id":"strain_cuadriceps","r":"cuadriceps","n":"Lesión Cuádriceps / Recto Femoral","p":["dolor explosivo muslo","pop sprint/kick","dolor extensión resistida","gap palpable"],"rts_days":[14,84],"tratamiento":"POLICE agudo, flexión 120° contusión. Excéntricos fase tardía. MRI si tendón central."},{"id":"contusion_cuadriceps","r":"cuadriceps","n":"Contusión Cuádriceps","p":["golpe directo muslo","hematoma","limitación flexión","dolor palpación"],"rts_days":[7,42],"tratamiento":"Flexión inmediata 120°, hielo, compresión. Vigilar miositis osificante."},{"id":"strain_aductor","r":"aductor","n":"Lesión Aductor / Pubalgia","p":["dolor inguinal","dolor adducción resistida","squeeze test positivo","dolor sprint/cambio dirección"],"rts_days":[7,100],"tratamiento":"Progresión carga aductores, Copenhagen adduction. Cirugía si retracción completa."},{"id":"strain_isquios","r":"isquiotibiales","n":"Lesión Isquiotibiales","p":["dolor posterior muslo sprint","sensación tirón","marcha rígida","equimosis posterior"],"rts_days":[14,84],"tratamiento":"Excéntricos elongación (Nordic hamstring). Control lumbo-pélvico. NO volver precoz."},{"id":"avulsion_isquios","r":"isquiotibiales","n":"Avulsión Proximal Isquiotibiales","p":["dolor al sentarse","dolor glúteo profundo","retracción","trauma grave"],"rts_days":[90,270],"tratamiento":"Cirugía si >2 tendones o >2cm retracción. Rehab larga."},{"id":"strain_gemelo","r":"gemelo","n":"Lesión Gemelo Medial (Tennis Leg)","p":["pop súbito pantorrilla","dolor posteromedial","dorsiflexión dolorosa","incapacidad heel raise"],"rts_days":[14,84],"tratamiento":"POLICE, compresión. Heel raises progresivos. Excéntricos fase 3. NO estirar precoz."},{"id":"rotura_aquiles_parcial","r":"gemelo","n":"Tendinopatía / Lesión Aquiles","p":["dolor tendón aquiles","dolor matutino","dolor carga excéntrica","engrosamiento palpable"],"rts_days":[60,180],"tratamiento":"Excéntricos Alfredson/Silbernagel. Ondas de choque. Ortesis si agudo."}],"tests_by_region":{"hombro":[{"id":"er_lag","n":"External Rotation Lag Sign (90°)","s":"Infraspinoso/Supraespinoso","se":null,"sp":null,"role":"confirmar","dor":12.7},{"id":"ir_lag","n":"Internal Rotation Lag Sign","s":"Subescapular","se":null,"sp":null,"role":"confirmar","dor":7.0},{"id":"drop_arm","n":"Drop Arm Test","s":"Supraespinoso","se":0.21,"sp":0.92,"role":"confirmar"},{"id":"jobe","n":"Jobe / Empty Can","s":"Supraespinoso","se":0.59,"sp":0.67,"role":"apoyo"},{"id":"neer","n":"Neer Impingement Sign","s":"Espacio subacromial","se":0.72,"sp":0.6,"role":"descartar"},{"id":"hawkins","n":"Hawkins-Kennedy","s":"Espacio subacromial","se":0.79,"sp":0.59,"role":"descartar"},{"id":"speed","n":"Speed Test","s":"LHBT bíceps","se":0.32,"sp":0.75,"role":"apoyo"},{"id":"yergason","n":"Yergason Test","s":"LHBT / corredera bicipital","se":0.37,"sp":0.86,"role":"apoyo"},{"id":"apprehension_gh","n":"Apprehension Test","s":"Cápsula anterior / Labrum","se":0.72,"sp":0.6,"role":"apoyo"},{"id":"belly_press","n":"Belly Press Test","s":"Subescapular superior","se":0.4,"sp":0.98,"role":"confirmar"},{"id":"bear_hug","n":"Bear Hug Test","s":"Subescapular porciones superiores","se":0.6,"sp":0.92,"role":"confirmar"}],"cadera":[{"id":"faddir","n":"FADDIR","s":"FAI / Labrum anterosuperior","se":0.96,"sp":0.1,"role":"descartar"},{"id":"faber_cadera","n":"FABER Test","s":"Intraarticular / SIJ","se":0.88,"sp":0.64,"role":"apoyo"},{"id":"log_roll","n":"Log Roll Test","s":"Patología intraarticular pura","se":0.43,"sp":0.93,"role":"confirmar"},{"id":"trendelenburg","n":"Trendelenburg Test","s":"Glúteo medio","se":0.55,"sp":0.7,"role":"apoyo"},{"id":"scour","n":"Scour Test","s":"Superficie acetabular","se":null,"sp":null,"role":"apoyo"},{"id":"thomas_cadera","n":"Thomas Test","s":"Iliopsoas / flexores","se":null,"sp":null,"role":"apoyo"},{"id":"ober","n":"Ober Test","s":"TFL / Cintilla IT","se":null,"sp":null,"role":"apoyo"}],"lumbar":[{"id":"slr","n":"SLR (Straight Leg Raise)","s":"Tensión radicular L4-S1","se":0.91,"sp":0.26,"role":"descartar"},{"id":"crossed_slr","n":"Crossed SLR","s":"Hernia discal significativa","se":0.29,"sp":0.88,"role":"confirmar"},{"id":"slump","n":"Slump Test","s":"Tensión neural global","se":0.84,"sp":0.83,"role":"apoyo"},{"id":"faber_sij","n":"FABER (SIJ)","s":"Articulación sacroiliaca","se":null,"sp":null,"role":"apoyo"},{"id":"gaenslen","n":"Gaenslen Test","s":"Articulación sacroiliaca","se":null,"sp":null,"role":"apoyo"}],"toracico":[{"id":"palpacion_toracica","n":"Palpación segmental torácica","s":"Disfunción costovertebral / facetaria","se":null,"sp":null,"role":"apoyo"},{"id":"movimiento_toracico","n":"ROM torácico (flexión/extensión/rotación)","s":"Rigidez segmental torácica","se":null,"sp":null,"role":"apoyo"},{"id":"palpacion_costal","n":"Palpación costovertebral","s":"Disfunción costal","se":null,"sp":null,"role":"apoyo"},{"id":"spring_test","n":"Spring Test (PA pressure)","s":"Rigidez segmental torácica","se":null,"sp":null,"role":"apoyo"},{"id":"control_escapular","n":"Test control escapular","s":"Disfunción escapulotorácica","se":null,"sp":null,"role":"apoyo"}],"tobillo":[{"id":"anterior_drawer_tobillo","n":"Anterior Drawer Test","s":"ATFL","se":0.74,"sp":0.88,"role":"confirmar"},{"id":"talar_tilt","n":"Talar Tilt / Inversion Stress","s":"CFL ± ATFL","se":0.5,"sp":0.88,"role":"apoyo"},{"id":"ottawa_ankle","n":"Ottawa Ankle Rules","s":"Fractura / hueso","se":0.99,"sp":null,"role":"descartar"},{"id":"squeeze_tobillo","n":"Squeeze Test Tobillo","s":"Sindesmosis","se":0.3,"sp":0.93,"role":"confirmar"},{"id":"external_rotation_stress","n":"External Rotation Stress Test","s":"Sindesmosis","se":0.71,"sp":0.63,"role":"apoyo"},{"id":"thompson","n":"Thompson Test","s":"Tendón de Aquiles","se":0.96,"sp":0.93,"role":"confirmar"}],"codo":[{"id":"cozen","n":"Cozen Test","s":"Epicóndilo lateral / ECRB","se":0.84,"sp":0.74,"role":"apoyo"},{"id":"golfer_test","n":"Test de Golfer","s":"Epicóndilo medial","se":null,"sp":null,"role":"apoyo"},{"id":"tinel_cubital","n":"Tinel Canal Cubital","s":"Nervio cubital","se":0.7,"sp":0.98,"role":"confirmar"},{"id":"valgus_stress_codo","n":"Valgus Stress Test Codo","s":"Ligamento colateral medial","se":null,"sp":null,"role":"apoyo"},{"id":"chair_pushup","n":"Chair Push-up Test","s":"Inestabilidad PLRI","se":0.88,"sp":null,"role":"confirmar"}],"cervical":[{"id":"spurling","n":"Spurling Test","s":"Raíz nerviosa cervical","se":0.5,"sp":0.86,"role":"confirmar"},{"id":"ulnt1","n":"ULNT1 (Mediano)","s":"Nervio mediano / tensión neural","se":0.7,"sp":0.71,"role":"apoyo"},{"id":"ulnt_combinados","n":"ULNT Combinados (≥1 positivo)","s":"Sensibilización neural global","se":0.97,"sp":0.51,"role":"descartar"},{"id":"shoulder_abduction_relief","n":"Shoulder Abduction Relief Test","s":"Alivio radicular cervical","se":0.49,"sp":0.76,"role":"apoyo"}],"rodilla":[{"id":"thessaly","n":"Thessaly Test (20°)","s":"Menisco medial/lateral","se":0.66,"sp":0.53,"role":"apoyo"},{"id":"mcmurray","n":"McMurray Test","s":"Menisco","se":0.55,"sp":0.77,"role":"apoyo"},{"id":"lachman","n":"Lachman Test","s":"LCA","se":0.85,"sp":0.94,"role":"confirmar"},{"id":"pivot_shift","n":"Pivot Shift Test","s":"Inestabilidad rotacional LCA","se":0.42,"sp":0.98,"role":"confirmar"},{"id":"anterior_drawer_rodilla","n":"Anterior Drawer Rodilla","s":"LCA","se":0.62,"sp":0.88,"role":"apoyo"}],"rodilla_akp":[{"id":"clarke_grind","n":"Patellar Grind Test (Clarke)","s":"Articulación patelofemoral","se":null,"sp":null,"role":"apoyo"},{"id":"patellar_apprehension","n":"Patellar Apprehension Test","s":"Inestabilidad patelar / MPFL","se":0.72,"sp":0.6,"role":"apoyo"},{"id":"lateral_glide","n":"Lateral Glide Test","s":"Hipermovilidad patelar / MPFL","se":null,"sp":null,"role":"apoyo"},{"id":"patellar_tilt","n":"Patellar Tilt Test","s":"Retináculo lateral","se":null,"sp":null,"role":"apoyo"},{"id":"j_sign","n":"J-Sign","s":"Maltracking patelar / displasia","se":null,"sp":null,"role":"apoyo"},{"id":"single_leg_squat","n":"Single-Leg Squat","s":"Control dinámico patelofemoral","se":null,"sp":null,"role":"apoyo"},{"id":"step_down","n":"Step-Down Test","s":"Control femoropatelar","se":null,"sp":null,"role":"apoyo"},{"id":"decline_squat","n":"Decline Squat Test","s":"Tendón rotuliano (tendinopatía patelar)","se":null,"sp":null,"role":"apoyo"},{"id":"hoffa_test","n":"Hoffa Test","s":"Fat pad infrapatelar","se":null,"sp":null,"role":"apoyo"},{"id":"stutter_test","n":"Stutter Test","s":"Plica medial","se":null,"sp":null,"role":"apoyo"}],"cuadriceps":[{"id":"ext_resistida_cuad","n":"Extensión resistida cuádriceps","s":"Recto femoral / cuádriceps","se":null,"sp":null,"role":"apoyo"},{"id":"resisted_knee_hip","n":"Extensión rodilla + flexión cadera resistida","s":"Recto femoral biarticular","se":null,"sp":null,"role":"apoyo"},{"id":"palpacion_gap_cuad","n":"Palpación gap muscular cuádriceps","s":"Rotura parcial/completa","se":null,"sp":null,"role":"confirmar"},{"id":"flexion_rodilla_cuad","n":"Flexión rodilla post-contusión","s":"Severidad contusión","se":null,"sp":null,"role":"apoyo"}],"aductor":[{"id":"squeeze_90","n":"Squeeze Test 90°","s":"Aductor relacionado","se":0.56,"sp":0.79,"role":"apoyo"},{"id":"squeeze_0","n":"Squeeze Test 0°","s":"Aductor relacionado","se":0.45,"sp":0.9,"role":"apoyo"},{"id":"resist_add_max_abd","n":"Resisted Adduction in Maximal Abduction","s":"Dolor aductor funcional","se":null,"sp":null,"role":"apoyo"},{"id":"palp_origen_aductor","n":"Palpación origen aductor longus","s":"Adductor longus proximal","se":null,"sp":null,"role":"apoyo"}],"isquiotibiales":[{"id":"bent_knee_stretch","n":"Bent-knee Stretch Test","s":"Lesión proximal isquiotibiales","se":0.84,"sp":0.83,"role":"apoyo"},{"id":"puranen_orava","n":"Puranen-Orava Test","s":"Tendinopatía/strain proximal","se":0.76,"sp":null,"role":"apoyo"},{"id":"palp_posterior_muslo","n":"Palpación posterior muslo","s":"Zona lesionada isquiotibiales","se":null,"sp":null,"role":"apoyo"},{"id":"slr_hamstring","n":"SLR con evaluación isquiotibiales","s":"Tensión neural vs muscular","se":null,"sp":null,"role":"apoyo"}],"gemelo":[{"id":"dorsiflexion_pasiva","n":"Dorsiflexión pasiva (rodilla extendida)","s":"Gastrocnemio / tensión","se":null,"sp":null,"role":"apoyo"},{"id":"heel_raise_ext","n":"Heel Raise Rodilla Extendida","s":"Gastrocnemio","se":null,"sp":null,"role":"apoyo"},{"id":"heel_raise_flex","n":"Heel Raise Rodilla Flexionada","s":"Sóleo","se":null,"sp":null,"role":"apoyo"},{"id":"thompson_gemelo","n":"Thompson Test","s":"Tendón de Aquiles","se":0.96,"sp":0.93,"role":"confirmar"},{"id":"palp_gemelo","n":"Palpación musculatura posterior pantorrilla","s":"Gastrocnemio medial/lateral","se":null,"sp":null,"role":"apoyo"}]},"region_keywords":{"hombro":["hombro","glenohumeral","manguito","subacromial","bíceps","escapular","rotador","deltoides"],"cadera":["cadera","coxofemoral","acetabular","labrum","trocánter","inguinal","fai","iliopsoas","piriforme","glúteo"],"lumbar":["lumbar","lumbalgia","ciática","discal","sacroiliaca","sij","facetario","cauda equina","l1","l2","l3","l4","l5","s1"],"toracico":["torácico","toracico","dorsal","espalda alta","escapula","escápula","t1","t2","t3","t4","t5","costilla","costovertebral","cifosis"],"tobillo":["tobillo","esguince","atfl","cfl","sindesmosis","peroné","maléolo","aquiles"],"codo":["codo","epicóndilo","epicondilitis","tennis elbow","olécranon","cubital","humeral"],"cervical":["cervical","cervicalgia","cuello","radiculopatía cervical","braquialgia","c3","c4","c5","c6","c7"],"rodilla_akp":["rótula","patelofemoral","patelar","akp","dolor anterior rodilla","plica","hoffa","maltracking","jumper"],"rodilla":["rodilla","menisco","lca","ligamento cruzado","tibia","fémur distal","crepitación rodilla"],"cuadriceps":["cuádriceps","recto femoral","cuadriceps","muslo anterior","contusión muslo"],"aductor":["aductor","ingle","pubis","pubalgia","sínfisis","groin"],"isquiotibiales":["isquiotibiales","isquio","semimembranoso","semitendinoso","bíceps femoral","muslo posterior"],"gemelo":["gemelo","gastrocnemio","pantorrilla","sóleo","aquiles","tennis leg"]},"red_flags":[{"n":"Anestesia en silla de montar","sug":"Síndrome Cauda Equina (CES)","urg":"emergencia","act":"Derivación urgente neurociugía"},{"n":"Retención urinaria aguda","sug":"Síndrome Cauda Equina (CES)","urg":"emergencia","act":"Urgencias hospitalarias inmediatas"},{"n":"Déficit motor progresivo","sug":"Compresión neural severa","urg":"urgente","act":"Derivación neurología/neurocirugía"},{"n":"Fiebre + dolor lumbar","sug":"Infección espinal (espondilodiscitis)","urg":"urgente","act":"Analítica urgente, derivación médico"},{"n":"Pérdida peso inexplicada + dolor","sug":"Posible malignidad vertebral","urg":"urgente","act":"Derivación oncología/médico"},{"n":"Dolor nocturno severo que no cede","sug":"Patología sistémica/maligna","urg":"urgente","act":"Derivación médico"},{"n":"Trauma + osteoporosis + dolor agudo","sug":"Fractura vertebral","urg":"urgente","act":"Radiografía urgente"},{"n":"Hinchazón aguda post-trauma articular","sug":"Fractura/luxación","urg":"urgente","act":"Radiografía urgente, inmovilización"},{"n":"Fiebre + bursitis o articulación caliente","sug":"Artritis séptica / bursitis séptica","urg":"emergencia","act":"Urgencias, antibióticos"},{"n":"Edema difuso pantorrilla sin trauma","sug":"TVP (Trombosis Venosa Profunda)","urg":"urgente","act":"Eco-doppler urgente, derivación médico"},{"n":"Dolor pecho + disnea","sug":"Patología cardiopulmonar","urg":"emergencia","act":"Urgencias inmediatas, ECG"},{"n":"Déficit neurológico agudo miembro superior","sug":"Mielopatía cervical / ACV","urg":"emergencia","act":"Urgencias neurológicas"},{"n":"Deformidad visible post-trauma","sug":"Luxación / fractura","urg":"urgente","act":"Inmovilización y urgencias"},{"n":"Síntomas bilaterales MMII progresivos","sug":"Mielopatía / Cauda Equina","urg":"emergencia","act":"Neuroimagen urgente"}]};

// Lookups precompilados
const conditionMap = {};
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
  status: "ok", service: "FisioScript API v3.0",
  clinical_kb: {
    regions: Object.keys(CLINICAL_KB.regions).length,
    conditions: CLINICAL_KB.conditions.length,
    red_flags: CLINICAL_KB.red_flags.length,
  }
}));

// ── Build clinical context string ─────────────────────────────────────────────
function buildClinicalContext() {
  const regiones = Object.entries(CLINICAL_KB.regions).map(([id, n]) => `${id}:${n}`).join(', ');

  const condiciones = CLINICAL_KB.conditions.map(c => {
    const rts = c.rts_days && c.rts_days[0] ? `RTS ${c.rts_days[0]}-${c.rts_days[1]}d` : 'RTS variable';
    return `[${c.id}] ${c.n} (${c.r}) | Patrones: ${(c.p||[]).join('; ')} | ${rts} | Tx: ${c.tratamiento||''}`;
  }).join('\n');

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

  return `=== BASE CLÍNICA FISIOSCRIPT v3.0 ===
REGIONES: ${regiones}

PATOLOGÍAS Y TRATAMIENTOS:
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
4. Para el tratamiento, usa el protocolo de la base de datos del condition_id identificado.
5. Para recuperación, usa los rts_days de la base de datos.

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
    "estimacion_texto": "descripción legible del tiempo esperado",
    "fase_actual": "agudo|subagudo|crónico|rehabilitación|vuelta_actividad",
    "criterios_rts": ["criterio objetivo 1", "criterio objetivo 2", "criterio objetivo 3"],
    "factores_riesgo_recaida": ["factor 1 si aplica"],
    "notas": "consideraciones específicas del caso"
  },
  "tratamiento_sugerido": {
    "fase_actual": "Fase aguda|Fase subaguda|Fase de carga|Fase funcional|Mantenimiento",
    "tecnicas_manuales": ["técnica 1 con indicación", "técnica 2"],
    "ejercicios_clave": ["ejercicio 1 con dosis", "ejercicio 2 con dosis"],
    "educacion_paciente": ["mensaje educativo clave 1", "mensaje 2"],
    "proximos_pasos": "plan para próximas sesiones",
    "derivacion": "derivación si es necesaria o 'No necesaria de momento'"
  }
}

REGLAS:
- condition_id: usa el ID exacto de la base de datos si el diagnóstico coincide. Esto es crítico para calcular tiempos de recuperación correctos.
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

// ── POST /api/stripe/checkout ─────────────────────────────────────────────────
app.post("/api/stripe/checkout", rateLimit(10, 60_000), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe no configurado." });
  const { priceId, email, extraSeats } = req.body;
  if (!priceId) return res.status(400).json({ error: "priceId requerido." });

  // Price IDs para profesionales extra (+5€/mes cada uno)
  const EXTRA_SEAT_PRICE_MONTHLY = 'price_1Tcit7POSeyVBgtaC7CSaSJs'; // ← reemplazar con price ID real de Stripe
  const EXTRA_SEAT_PRICE_ANNUAL  = 'price_1Tcit7POSeyVBgtaC7CSaSJs'; // ← reemplazar con price ID real de Stripe

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
