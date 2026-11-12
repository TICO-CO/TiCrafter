# TiCrafter Architecture Graphs

> Generated from `docs/architecture/graph.json`. Edit the graph, then run `bun tools/architecture/render-graphs.mjs`.


Mermaid source lives in `docs/architecture/graphs/`. GitHub renders these fenced blocks directly. For local SVG rendering, run `bun run render:svg -- <input.mmd> <output.svg>`; it uses the installed Firefox browser and never downloads Chromium.

## Fleet overview

Systems and externals with aggregated relation counts.

```mermaid
flowchart LR
n0["Coordinator Runtime"]
n1["Transport and Protocol"]
n2["Shared Infrastructure Plan"]
n3["Task Board"]
n4["Claims and Leases"]
n5["Edit Grants and Collaboration"]
n6["Bot Registry and Profiles"]
n7["World Model and Landmarks"]
n8["Perception"]
n9["Laya Decision Service"]
n10["Cloud Planner Advisor"]
n11["Skill Runtime"]
n12["Skill Library"]
n13["Building"]
n14["Bot Runtime and Mineflayer Adapter"]
n15["Autonomy and Safety"]
n16["Memory and Persistence"]
n17["Ops and Observability"]
n18["Config and Profiles"]
n19["Testing and Evaluation"]
n20["Laya Training"]
n21["Brains"]
n22["Agency"]
n23["Bootstrap and Toolchain"]
n24(["Minecraft 1.20.1 LAN Server"])
n25(["Muse Spark Planner Endpoint"])
n26(["ONNX Runtime / WebGPU Driver"])
n27(["Host Hardware"])
n28(["Fleet Operator"])
n14 -->|depends_on×2| n15
n21 -->|depends_on×2| n14
n21 -->|depends_on×1| n11
n14 -->|depends_on×3| n18
n14 -->|depends_on×1| n24
n21 -->|reads×1| n6
n21 -->|subscribes×1, depends_on×1| n1
n14 -->|delegates_to×2, depends_on×2| n8
n14 -->|delegates_to×3| n21
n14 -->|delegates_to×1, persists_to×1| n6
n14 -->|depends_on×1, publishes×2| n1
n14 -->|depends_on×2, delegates_to×1| n11
n6 -->|reads×1| n5
n6 -->|reads×1, delegates_to×1| n2
n6 -->|reads×1| n3
n6 -->|depends_on×2| n18
n6 -->|depends_on×2| n16
n6 -->|delegates_to×1| n4
n6 -->|reads×1| n11
n13 -->|depends_on×2, reads×1| n14
n13 -->|depends_on×1| n15
n13 -->|reads×4, writes×1| n7
n13 -->|depends_on×1, reads×2| n2
n13 -->|reads×1| n11
n13 -->|writes×1| n16
n13 -->|subscribes×1| n1
n4 -->|depends_on×3| n16
n4 -->|depends_on×2| n3
n4 -->|observes×1| n17
n4 -->|depends_on×1| n0
n4 -->|depends_on×1| n2
n18 -->|depends_on×1| n27
n0 -->|depends_on×4| n1
n0 -->|controls×2, delegates_to×2| n4
n0 -->|controls×1, delegates_to×1| n5
n0 -->|controls×1, delegates_to×1, depends_on×1| n2
n0 -->|controls×1| n3
n0 -->|depends_on×3, delegates_to×1| n16
n0 -->|delegates_to×1| n10
n0 -->|depends_on×3| n18
n0 -->|depends_on×2, publishes×1| n6
n9 -->|proposes_to×1| n21
n9 -->|depends_on×4| n18
n9 -->|depends_on×1, publishes×1, subscribes×1| n1
n9 -->|observes×2, writes×1| n17
n9 -->|depends_on×1| n26
n19 -->|depends_on×1| n4
n19 -->|depends_on×1| n3
n19 -->|depends_on×1| n8
n19 -->|depends_on×1| n24
n19 -->|depends_on×2| n9
n19 -->|observes×1| n17
n19 -->|depends_on×1, reads×1| n16
n28 -->|controls×1| n17
n5 -->|publishes×1| n1
n5 -->|reads×1, depends_on×1| n4
n5 -->|depends_on×3, reads×1| n2
n5 -->|depends_on×1| n16
n5 -->|reads×2| n6
n17 -->|reads×4, depends_on×1, writes×2| n16
n17 -->|controls×1| n15
n17 -->|depends_on×3| n1
n17 -->|depends_on×1| n9
n17 -->|controls×1| n14
n17 -->|depends_on×2, reads×1| n6
n17 -->|depends_on×1, reads×1| n2
n17 -->|reads×1| n4
n17 -->|reads×1| n3
n8 -->|publishes×2| n1
n8 -->|depends_on×1| n18
n10 -->|reads×1, proposes_to×1| n5
n10 -->|subscribes×1| n1
n10 -->|observes×2| n17
n10 -->|reads×1| n6
n10 -->|reads×4, depends_on×1, proposes_to×1| n2
n10 -->|reads×2, proposes_to×1| n3
n10 -->|reads×2| n7
n10 -->|depends_on×2| n18
n10 -->|depends_on×1| n25
n10 -->|depends_on×1| n16
n10 -->|reads×1| n11
n15 -->|validates×1, controls×1| n14
n15 -->|validates×1| n13
n15 -->|reads×1| n21
n15 -->|reads×4| n4
n15 -->|reads×2| n7
n15 -->|controls×1, proposes_to×1| n0
n15 -->|depends_on×2| n1
n21 -->|controls×1, depends_on×6| n15
n15 -->|writes×1| n16
n15 -->|reads×2| n2
n15 -->|proposes_to×1| n10
n2 -->|depends_on×9| n16
n2 -->|depends_on×2, reads×1, publishes×1| n7
n2 -->|publishes×1| n5
n11 -->|depends_on×1| n16
n11 -->|reads×1| n14
n11 -->|reads×1| n2
n11 -->|reads×1, depends_on×1| n7
n11 -->|publishes×2| n1
n11 -->|reads×1| n15
n11 -->|observes×1| n17
n11 -->|reads×1| n21
n12 -->|depends_on×8| n13
n12 -->|depends_on×2| n15
n12 -->|depends_on×12| n14
n12 -->|depends_on×4| n11
n12 -->|depends_on×4| n7
n12 -->|depends_on×3| n2
n3 -->|depends_on×3| n16
n3 -->|reads×1| n7
n3 -->|reads×1| n6
n20 -->|reads×1| n9
n20 -->|depends_on×1| n19
n20 -->|reads×2| n16
n1 -->|depends_on×1| n6
n1 -->|depends_on×1| n18
n1 -->|publishes×1| n7
n7 -->|depends_on×2| n16
n7 -->|reads×2| n2
n7 -->|subscribes×1, reads×1| n1
n0 -->|controls×1| n14
n14 -->|depends_on×4| n22
n14 -->|persists_to×1| n16
n4 -->|depends_on×1| n1
n22 -->|proposes_to×1| n14
n6 -->|depends_on×1| n22
classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n0,n1,n2,n3,n4,n5,n6,n7,n8,n9,n10,n11,n12,n13,n14,n15,n16,n17,n18,n19,n20,n21,n22,n23 system;
class n24,n25,n26,n27,n28 external;
```

## Cross-system dependencies

System-to-system view with relation types.

```mermaid
flowchart LR
n0["Coordinator Runtime"]
n1["Transport and Protocol"]
n2["Shared Infrastructure Plan"]
n3["Task Board"]
n4["Claims and Leases"]
n5["Edit Grants and Collaboration"]
n6["Bot Registry and Profiles"]
n7["World Model and Landmarks"]
n8["Perception"]
n9["Laya Decision Service"]
n10["Cloud Planner Advisor"]
n11["Skill Runtime"]
n12["Skill Library"]
n13["Building"]
n14["Bot Runtime and Mineflayer Adapter"]
n15["Autonomy and Safety"]
n16["Memory and Persistence"]
n17["Ops and Observability"]
n18["Config and Profiles"]
n19["Testing and Evaluation"]
n20["Laya Training"]
n21["Brains"]
n22["Agency"]
n23["Bootstrap and Toolchain"]
n14 -->|depends_on×2| n15
n21 -->|depends_on×2| n14
n21 -->|depends_on×1| n11
n14 -->|depends_on×3| n18
n21 -->|reads×1| n6
n21 -->|subscribes×1, depends_on×1| n1
n14 -->|delegates_to×2, depends_on×2| n8
n14 -->|delegates_to×3| n21
n14 -->|delegates_to×1, persists_to×1| n6
n14 -->|depends_on×1, publishes×2| n1
n14 -->|depends_on×2, delegates_to×1| n11
n6 -->|reads×1| n5
n6 -->|reads×1, delegates_to×1| n2
n6 -->|reads×1| n3
n6 -->|depends_on×2| n18
n6 -->|depends_on×2| n16
n6 -->|delegates_to×1| n4
n6 -->|reads×1| n11
n13 -->|depends_on×2, reads×1| n14
n13 -->|depends_on×1| n15
n13 -->|reads×4, writes×1| n7
n13 -->|depends_on×1, reads×2| n2
n13 -->|reads×1| n11
n13 -->|writes×1| n16
n13 -->|subscribes×1| n1
n4 -->|depends_on×3| n16
n4 -->|depends_on×2| n3
n4 -->|observes×1| n17
n4 -->|depends_on×1| n0
n4 -->|depends_on×1| n2
n0 -->|depends_on×4| n1
n0 -->|controls×2, delegates_to×2| n4
n0 -->|controls×1, delegates_to×1| n5
n0 -->|controls×1, delegates_to×1, depends_on×1| n2
n0 -->|controls×1| n3
n0 -->|depends_on×3, delegates_to×1| n16
n0 -->|delegates_to×1| n10
n0 -->|depends_on×3| n18
n0 -->|depends_on×2, publishes×1| n6
n9 -->|proposes_to×1| n21
n9 -->|depends_on×4| n18
n9 -->|depends_on×1, publishes×1, subscribes×1| n1
n9 -->|observes×2, writes×1| n17
n19 -->|depends_on×1| n4
n19 -->|depends_on×1| n3
n19 -->|depends_on×1| n8
n19 -->|depends_on×2| n9
n19 -->|observes×1| n17
n19 -->|depends_on×1, reads×1| n16
n5 -->|publishes×1| n1
n5 -->|reads×1, depends_on×1| n4
n5 -->|depends_on×3, reads×1| n2
n5 -->|depends_on×1| n16
n5 -->|reads×2| n6
n17 -->|reads×4, depends_on×1, writes×2| n16
n17 -->|controls×1| n15
n17 -->|depends_on×3| n1
n17 -->|depends_on×1| n9
n17 -->|controls×1| n14
n17 -->|depends_on×2, reads×1| n6
n17 -->|depends_on×1, reads×1| n2
n17 -->|reads×1| n4
n17 -->|reads×1| n3
n8 -->|publishes×2| n1
n8 -->|depends_on×1| n18
n10 -->|reads×1, proposes_to×1| n5
n10 -->|subscribes×1| n1
n10 -->|observes×2| n17
n10 -->|reads×1| n6
n10 -->|reads×4, depends_on×1, proposes_to×1| n2
n10 -->|reads×2, proposes_to×1| n3
n10 -->|reads×2| n7
n10 -->|depends_on×2| n18
n10 -->|depends_on×1| n16
n10 -->|reads×1| n11
n15 -->|validates×1, controls×1| n14
n15 -->|validates×1| n13
n15 -->|reads×1| n21
n15 -->|reads×4| n4
n15 -->|reads×2| n7
n15 -->|controls×1, proposes_to×1| n0
n15 -->|depends_on×2| n1
n21 -->|controls×1, depends_on×6| n15
n15 -->|writes×1| n16
n15 -->|reads×2| n2
n15 -->|proposes_to×1| n10
n2 -->|depends_on×9| n16
n2 -->|depends_on×2, reads×1, publishes×1| n7
n2 -->|publishes×1| n5
n11 -->|depends_on×1| n16
n11 -->|reads×1| n14
n11 -->|reads×1| n2
n11 -->|reads×1, depends_on×1| n7
n11 -->|publishes×2| n1
n11 -->|reads×1| n15
n11 -->|observes×1| n17
n11 -->|reads×1| n21
n12 -->|depends_on×8| n13
n12 -->|depends_on×2| n15
n12 -->|depends_on×12| n14
n12 -->|depends_on×4| n11
n12 -->|depends_on×4| n7
n12 -->|depends_on×3| n2
n3 -->|depends_on×3| n16
n3 -->|reads×1| n7
n3 -->|reads×1| n6
n20 -->|reads×1| n9
n20 -->|depends_on×1| n19
n20 -->|reads×2| n16
n1 -->|depends_on×1| n6
n1 -->|depends_on×1| n18
n1 -->|publishes×1| n7
n7 -->|depends_on×2| n16
n7 -->|reads×2| n2
n7 -->|subscribes×1, reads×1| n1
n0 -->|controls×1| n14
n14 -->|depends_on×4| n22
n14 -->|persists_to×1| n16
n4 -->|depends_on×1| n1
n22 -->|proposes_to×1| n14
n6 -->|depends_on×1| n22
classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;
class n0,n1,n2,n3,n4,n5,n6,n7,n8,n9,n10,n11,n12,n13,n14,n15,n16,n17,n18,n19,n20,n21,n22,n23 system;
```

## Safety and control authority

Guardian veto, grant/claim control, ops stop path, and planner proposal path.

```mermaid
flowchart TD
n0["Coordinator Runtime"]
n9["Laya Decision Service"]
n10["Cloud Planner Advisor"]
n11["Skill Runtime"]
n13["Building"]
n14["Bot Runtime and Mineflayer Adapter"]
n15["Autonomy and Safety"]
n17["Ops and Observability"]
n21["Brains"]
n28(["Fleet Operator"])
n14 -->|delegates_to| n21
n14 -->|delegates_to| n11
n0 -->|delegates_to| n10
n9 -->|proposes_to| n21
n17 -->|controls| n15
n17 -->|controls| n14
n15 -->|validates| n14
n15 -->|validates| n13
n15 -->|controls| n14
n15 -->|controls| n0
n21 -->|controls| n15
n15 -->|proposes_to| n0
n15 -->|proposes_to| n10
n0 -->|controls| n14
n29["Command Router"]
n30["Coordinator Epoch Authority"]
n31["Global Scheduler"]
n32["Restart Recovery Orchestrator"]
n33["Bot Process Supervisor"]
n34["Model Loader"]
n35["Execution Provider Selector"]
n36["Batch Runner"]
n37["Single In-flight Guard"]
n38["Output Parser"]
n39["Confidence Calibrator"]
n40["Timeout and Fallback Handler"]
n41["OpenAI-Compatible Client"]
n42["Planner Context Builder"]
n43["Planner Trigger Evaluator"]
n44["Planner Schema Validator"]
n45["Planner Semantic Validator"]
n46["Planner Repair Loop"]
n47["SIP Mutation Translator"]
n48["Task DAG Translator"]
n49["Planner Budget Limiter"]
n50["Planner Arbitration Handler"]
n51["Keep Last Good Fallback"]
n52["Skill Context Builder"]
n53["Block Executor"]
n54["Connection Lifecycle"]
n55["Mineflayer Event Bridge"]
n56["World Cache Adapter"]
n57["Action Executor"]
n58["Guardian Hook"]
n59["Skill Host"]
n60["Agent Loop"]
n61["Chat Adapter"]
n62["Reconnect Supervisor"]
n63["Action Veto Gate"]
n64["Recovery Ladder"]
n65["Emergency Stop Controller"]
n66["Ops API"]
n67["Pause and Resume Controller"]
n68["Fleet Emergency Stop"]
n69["Reflex Guardian Loop"]
n70["Deterministic Policy"]
n71["Laya Client"]
n58 -->|delegates_to| n69
n56 -->|delegates_to| n52
n31 -->|delegates_to| n43
n39 -->|proposes_to| n70
n35 -->|controls| n34
n37 -->|controls| n36
n40 -->|controls| n38
n68 -->|controls| n65
n67 -->|controls| n59
n49 -->|controls| n41
n41 -->|delegates_to| n50
n46 -->|controls| n51
n44 -->|controls| n46
n45 -->|controls| n46
n43 -->|delegates_to| n42
n63 -->|validates| n57
n63 -->|validates| n53
n65 -->|controls| n57
n65 -->|controls| n29
n69 -->|controls| n63
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n33 -->|controls| n54
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|delegates_to| n59
classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef component fill:#f8fafc,stroke:#64748b,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n0,n9,n10,n11,n13,n14,n15,n17,n21 system;
class n29,n30,n31,n32,n33,n34,n35,n36,n37,n38,n39,n40,n41,n42,n43,n44,n45,n46,n47,n48,n49,n50,n51,n52,n53,n54,n55,n56,n57,n58,n59,n60,n61,n62,n63,n64,n65,n66,n67,n68,n69,n70,n71 component;
class n28 external;
```

## Data flow

Perception, world model, SIP, decisions, skills, building, and persistence.

```mermaid
flowchart LR
n1["Transport and Protocol"]
n2["Shared Infrastructure Plan"]
n7["World Model and Landmarks"]
n8["Perception"]
n9["Laya Decision Service"]
n10["Cloud Planner Advisor"]
n11["Skill Runtime"]
n12["Skill Library"]
n13["Building"]
n14["Bot Runtime and Mineflayer Adapter"]
n15["Autonomy and Safety"]
n16["Memory and Persistence"]
n21["Brains"]
n21 -->|subscribes| n1
n14 -->|publishes| n1
n13 -->|reads| n7
n13 -->|writes| n7
n13 -->|reads| n11
n13 -->|reads| n14
n13 -->|writes| n16
n13 -->|reads| n2
n13 -->|subscribes| n1
n9 -->|proposes_to| n21
n9 -->|publishes| n1
n9 -->|subscribes| n1
n8 -->|publishes| n1
n10 -->|subscribes| n1
n10 -->|reads| n2
n10 -->|reads| n7
n10 -->|reads| n11
n10 -->|proposes_to| n2
n15 -->|reads| n21
n15 -->|reads| n7
n15 -->|writes| n16
n15 -->|reads| n2
n15 -->|proposes_to| n10
n2 -->|reads| n7
n2 -->|publishes| n7
n11 -->|reads| n14
n11 -->|reads| n2
n11 -->|reads| n7
n11 -->|publishes| n1
n11 -->|reads| n15
n11 -->|reads| n21
n1 -->|publishes| n7
n7 -->|reads| n2
n7 -->|subscribes| n1
n7 -->|reads| n1
n14 -->|persists_to| n16
classDef system fill:#eef6ff,stroke:#2563eb,color:#0f172a;
class n1,n2,n7,n8,n9,n10,n11,n12,n13,n14,n15,n16,n21 system;
```

## Per-system graphs

### Coordinator Runtime

Source: `docs/architecture/graphs/system-core.mmd`

```mermaid
flowchart LR
n72["Process Bootstrap"]
n73["Service Composition"]
n74["Bot Session Manager"]
n29["Command Router"]
n30["Coordinator Epoch Authority"]
n31["Global Scheduler"]
n32["Restart Recovery Orchestrator"]
n75["Backpressure Controller"]
n33["Bot Process Supervisor"]
n135["Fencing Token Authority (Claims and Leases)"]
n136["Flow Control (Transport and Protocol)"]
n137["Atomic Claim Acquirer (Claims and Leases)"]
n138["Grant Issuer (Edit Grants and Collaboration)"]
n139["SIP Transactional Committer (Shared Infrastructure Plan)"]
n140["Atomic Task Claimer (Task Board)"]
n141["Message Schema Registry (Transport and Protocol)"]
n142["Transaction Manager (Memory and Persistence)"]
n143["Lease Reaper (Claims and Leases)"]
n144["Retention Pruner (Memory and Persistence)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n145["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n146["Config Schema Validator (Config and Profiles)"]
n147["Environment Parser (Config and Profiles)"]
n148["Migration Runner (Memory and Persistence)"]
n149["WebSocket Codec (Transport and Protocol)"]
n150["Resume Orchestrator (Bot Registry and Profiles)"]
n151["Grant Expiry (Edit Grants and Collaboration)"]
n152["Profile Resolver (Config and Profiles)"]
n153["Bot Identity Authenticator (Bot Registry and Profiles)"]
n154["Presence Tracker (Bot Registry and Profiles)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n54 -->|depends_on| n146
n150 -->|delegates_to| n145
n137 -->|depends_on| n142
n135 -->|depends_on| n30
n135 -->|depends_on| n142
n146 -->|depends_on| n147
n152 -->|depends_on| n146
n75 -->|depends_on| n136
n29 -->|controls| n137
n29 -->|controls| n138
n29 -->|controls| n139
n29 -->|controls| n140
n29 -->|depends_on| n141
n30 -->|controls| n135
n30 -->|depends_on| n142
n31 -->|delegates_to| n143
n31 -->|depends_on| n30
n31 -->|delegates_to| n144
n31 -->|delegates_to| n43
n31 -->|delegates_to| n145
n72 -->|depends_on| n146
n72 -->|depends_on| n147
n72 -->|depends_on| n32
n72 -->|depends_on| n73
n72 -->|depends_on| n148
n72 -->|depends_on| n149
n32 -->|depends_on| n150
n32 -->|delegates_to| n143
n32 -->|delegates_to| n151
n32 -->|depends_on| n142
n32 -->|depends_on| n145
n73 -->|depends_on| n152
n73 -->|depends_on| n31
n74 -->|depends_on| n153
n74 -->|publishes| n154
n74 -->|depends_on| n149
n144 -->|depends_on| n142
n65 -->|controls| n29
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n145 -->|depends_on| n139
n139 -->|depends_on| n142
n140 -->|depends_on| n142
n149 -->|depends_on| n141
n33 -->|controls| n54
n33 -->|depends_on| n30
n32 -->|depends_on| n33
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n72,n73,n74,n29,n30,n31,n32,n75,n33 internal;
class n135,n136,n137,n138,n139,n140,n141,n142,n143,n144,n43,n145,n146,n147,n148,n149,n150,n151,n152,n153,n154,n65,n64,n54 external;
```

### Transport and Protocol

Source: `docs/architecture/graphs/system-transport.mmd`

```mermaid
flowchart LR
n141["Message Schema Registry"]
n149["WebSocket Codec"]
n155["Request Correlator"]
n156["Event Stream"]
n157["Delta Sync Protocol"]
n158["Reconnect Supervisor"]
n159["Transport Authentication"]
n136["Flow Control"]
n70["Deterministic Policy (Brains)"]
n62["Reconnect Supervisor (Bot Runtime and Mineflayer Adapter)"]
n113["State Digest Collector (Bot Runtime and Mineflayer Adapter)"]
n110["Rollback Journal (Building)"]
n75["Backpressure Controller (Coordinator Runtime)"]
n29["Command Router (Coordinator Runtime)"]
n72["Process Bootstrap (Coordinator Runtime)"]
n74["Bot Session Manager (Coordinator Runtime)"]
n79["Digest Assembler (Laya Decision Service)"]
n38["Output Parser (Laya Decision Service)"]
n76["Decision Queue (Laya Decision Service)"]
n160["Arbitration Adapter (Edit Grants and Collaboration)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n66["Ops API (Ops and Observability)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n161["Landmark Candidate Emitter (Perception)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n89["Typed Effects Emitter (Skill Runtime)"]
n86["Skill Progress Reporter (Skill Runtime)"]
n153["Bot Identity Authenticator (Bot Registry and Profiles)"]
n162["Secrets Loader (Config and Profiles)"]
n163["Observation Ingestor (World Model and Landmarks)"]
n71["Laya Client (Brains)"]
n164["Block Update Listener (Perception)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n165["Bot Claim Command Handler (Claims and Leases)"]
n70 -->|depends_on| n113
n70 -->|subscribes| n156
n62 -->|depends_on| n158
n113 -->|publishes| n156
n153 -->|depends_on| n162
n110 -->|subscribes| n156
n75 -->|depends_on| n136
n29 -->|depends_on| n141
n72 -->|depends_on| n149
n74 -->|depends_on| n153
n74 -->|depends_on| n149
n79 -->|depends_on| n141
n38 -->|publishes| n156
n76 -->|subscribes| n156
n160 -->|publishes| n156
n68 -->|controls| n65
n68 -->|depends_on| n156
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n141
n67 -->|depends_on| n156
n161 -->|publishes| n156
n50 -->|subscribes| n156
n65 -->|controls| n29
n65 -->|depends_on| n156
n64 -->|proposes_to| n29
n64 -->|controls| n65
n64 -->|depends_on| n156
n89 -->|publishes| n156
n86 -->|publishes| n156
n159 -->|depends_on| n153
n159 -->|depends_on| n162
n157 -->|depends_on| n141
n156 -->|depends_on| n149
n156 -->|publishes| n163
n136 -->|depends_on| n155
n158 -->|depends_on| n149
n155 -->|depends_on| n149
n149 -->|depends_on| n141
n163 -->|subscribes| n156
n163 -->|reads| n141
n71 -->|depends_on| n149
n71 -->|depends_on| n70
n164 -->|publishes| n156
n61 -->|publishes| n156
n165 -->|depends_on| n149
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n141,n149,n155,n156,n157,n158,n159,n136 internal;
class n70,n62,n113,n110,n75,n29,n72,n74,n79,n38,n76,n160,n68,n66,n67,n161,n50,n65,n64,n89,n86,n153,n162,n163,n71,n164,n61,n165 external;
```

### Shared Infrastructure Plan

Source: `docs/architecture/graphs/system-sip.mmd`

```mermaid
flowchart LR
n166["Zone Store"]
n167["Structure Store"]
n168["Road Store"]
n169["Farm Store"]
n170["Container Registry"]
n171["Path Graph Store"]
n172["Rules Store"]
n173["SIP Revision Manager"]
n174["Spatial Overlap Validator"]
n175["Dependency Validator"]
n176["SIP Mutation Proposer"]
n139["SIP Transactional Committer"]
n145["SIP Reconciliation Engine"]
n177["Delta Sync Planner (Bot Registry and Profiles)"]
n150["Resume Orchestrator (Bot Registry and Profiles)"]
n92["Blueprint Validator (Building)"]
n110["Rollback Journal (Building)"]
n104["Work Package Partitioner (Building)"]
n178["Overlap Margin Checker (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n179["Compatibility Checker (Edit Grants and Collaboration)"]
n180["Design Revision Guard (Edit Grants and Collaboration)"]
n181["Collaboration Policy Evaluator (Edit Grants and Collaboration)"]
n129["SIP Dump (Ops and Observability)"]
n127["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n51["Keep Last Good Fallback (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n47["SIP Mutation Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n122["Protected BBox Rule (Autonomy and Safety)"]
n125["Safety Policy Engine (Autonomy and Safety)"]
n142["Transaction Manager (Memory and Persistence)"]
n182["Container Memory (World Model and Landmarks)"]
n183["Spatial Query Engine (World Model and Landmarks)"]
n184["World Reconciler (World Model and Landmarks)"]
n185["Plan Tagging (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n186["Follow Path (Skill Library)"]
n187["Harvest Farm (Skill Library)"]
n188["Plant Farm (Skill Library)"]
n177 -->|reads| n173
n150 -->|depends_on| n177
n150 -->|delegates_to| n145
n92 -->|depends_on| n172
n110 -->|reads| n167
n104 -->|reads| n167
n178 -->|depends_on| n174
n29 -->|controls| n139
n31 -->|delegates_to| n43
n31 -->|delegates_to| n145
n32 -->|depends_on| n150
n32 -->|depends_on| n142
n32 -->|depends_on| n145
n179 -->|depends_on| n172
n179 -->|depends_on| n167
n180 -->|reads| n173
n181 -->|depends_on| n167
n129 -->|depends_on| n173
n127 -->|reads| n173
n42 -->|reads| n173
n42 -->|reads| n183
n51 -->|reads| n173
n45 -->|depends_on| n175
n45 -->|reads| n172
n45 -->|reads| n183
n47 -->|proposes_to| n176
n43 -->|delegates_to| n42
n43 -->|reads| n173
n122 -->|reads| n172
n125 -->|depends_on| n122
n125 -->|reads| n172
n125 -->|reads| n183
n170 -->|depends_on| n142
n170 -->|depends_on| n182
n175 -->|depends_on| n170
n175 -->|depends_on| n169
n175 -->|depends_on| n171
n175 -->|depends_on| n168
n175 -->|depends_on| n167
n175 -->|reads| n183
n169 -->|depends_on| n142
n176 -->|depends_on| n175
n176 -->|depends_on| n173
n176 -->|depends_on| n174
n171 -->|depends_on| n142
n145 -->|depends_on| n169
n145 -->|depends_on| n168
n145 -->|depends_on| n167
n145 -->|depends_on| n139
n145 -->|depends_on| n184
n173 -->|publishes| n180
n173 -->|depends_on| n142
n173 -->|depends_on| n172
n173 -->|publishes| n185
n168 -->|depends_on| n142
n172 -->|depends_on| n142
n174 -->|reads| n172
n174 -->|depends_on| n167
n174 -->|depends_on| n166
n167 -->|depends_on| n142
n139 -->|depends_on| n142
n139 -->|writes| n170
n139 -->|writes| n169
n139 -->|writes| n171
n139 -->|depends_on| n173
n139 -->|writes| n168
n139 -->|writes| n172
n139 -->|writes| n167
n139 -->|writes| n166
n166 -->|depends_on| n142
n52 -->|reads| n173
n52 -->|reads| n183
n186 -->|depends_on| n171
n187 -->|depends_on| n169
n188 -->|depends_on| n169
n182 -->|reads| n170
n183 -->|reads| n171
n184 -->|depends_on| n183
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n166,n167,n168,n169,n170,n171,n172,n173,n174,n175,n176,n139,n145 internal;
class n177,n150,n92,n110,n104,n178,n29,n31,n32,n179,n180,n181,n129,n127,n42,n51,n45,n47,n43,n122,n125,n142,n182,n183,n184,n185,n52,n186,n187,n188 external;
```

### Task Board

Source: `docs/architecture/graphs/system-tasks.mmd`

```mermaid
flowchart LR
n189["Task Repository"]
n190["Task DAG Resolver"]
n191["Precondition Evaluator"]
n192["Priority Scheduler"]
n140["Atomic Task Claimer"]
n193["Job Offer Service"]
n194["Retry Manager"]
n195["Dead Letter Manager"]
n196["Task State Machine"]
n177["Delta Sync Planner (Bot Registry and Profiles)"]
n197["Claim Releaser (Claims and Leases)"]
n143["Lease Reaper (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n198["Contention Harness (Testing and Evaluation)"]
n127["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n48["Task DAG Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n142["Transaction Manager (Memory and Persistence)"]
n183["Spatial Query Engine (World Model and Landmarks)"]
n199["Bot Profile Store (Bot Registry and Profiles)"]
n200["Event Log Writer (Memory and Persistence)"]
n177 -->|depends_on| n199
n177 -->|reads| n189
n199 -->|depends_on| n142
n197 -->|depends_on| n196
n143 -->|depends_on| n196
n29 -->|controls| n140
n198 -->|depends_on| n189
n200 -->|depends_on| n142
n127 -->|reads| n189
n42 -->|reads| n199
n42 -->|reads| n189
n42 -->|reads| n183
n48 -->|proposes_to| n189
n43 -->|delegates_to| n42
n43 -->|reads| n195
n140 -->|depends_on| n142
n140 -->|depends_on| n192
n140 -->|writes| n189
n190 -->|depends_on| n189
n195 -->|writes| n189
n191 -->|depends_on| n189
n191 -->|reads| n183
n192 -->|reads| n199
n192 -->|depends_on| n190
n192 -->|depends_on| n191
n194 -->|writes| n189
n194 -->|depends_on| n196
n189 -->|depends_on| n142
n196 -->|depends_on| n200
n196 -->|writes| n189
n193 -->|depends_on| n192
n193 -->|delegates_to| n140
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n189,n190,n191,n192,n140,n193,n194,n195,n196 internal;
class n177,n197,n143,n29,n198,n127,n42,n48,n43,n142,n183,n199,n200 external;
```

### Claims and Leases

Source: `docs/architecture/graphs/system-claims.mmd`

```mermaid
flowchart LR
n201["Claim Repository"]
n178["Overlap Margin Checker"]
n137["Atomic Claim Acquirer"]
n202["Lease Heartbeat"]
n143["Lease Reaper"]
n135["Fencing Token Authority"]
n197["Claim Releaser"]
n165["Bot Claim Command Handler"]
n203["Contention Metrics"]
n150["Resume Orchestrator (Bot Registry and Profiles)"]
n142["Transaction Manager (Memory and Persistence)"]
n196["Task State Machine (Task Board)"]
n130["Metrics Registry (Ops and Observability)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n174["Spatial Overlap Validator (Shared Infrastructure Plan)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n198["Contention Harness (Testing and Evaluation)"]
n179["Compatibility Checker (Edit Grants and Collaboration)"]
n204["Grant Revoker (Edit Grants and Collaboration)"]
n127["Status Aggregator (Ops and Observability)"]
n123["Active Bot Support Rule (Autonomy and Safety)"]
n121["Claim Loss Evaluator (Autonomy and Safety)"]
n122["Protected BBox Rule (Autonomy and Safety)"]
n125["Safety Policy Engine (Autonomy and Safety)"]
n149["WebSocket Codec (Transport and Protocol)"]
n150 -->|delegates_to| n197
n137 -->|writes| n201
n137 -->|depends_on| n178
n137 -->|depends_on| n142
n197 -->|writes| n201
n197 -->|depends_on| n196
n201 -->|depends_on| n142
n203 -->|depends_on| n201
n203 -->|observes| n130
n135 -->|depends_on| n30
n135 -->|depends_on| n142
n202 -->|writes| n201
n143 -->|writes| n201
n143 -->|depends_on| n196
n178 -->|depends_on| n201
n178 -->|depends_on| n174
n29 -->|controls| n137
n30 -->|controls| n135
n30 -->|depends_on| n142
n31 -->|delegates_to| n143
n31 -->|depends_on| n30
n32 -->|depends_on| n150
n32 -->|delegates_to| n143
n32 -->|depends_on| n142
n198 -->|depends_on| n201
n179 -->|reads| n201
n204 -->|depends_on| n135
n127 -->|reads| n201
n127 -->|observes| n130
n123 -->|reads| n201
n121 -->|reads| n201
n122 -->|reads| n201
n125 -->|reads| n201
n125 -->|depends_on| n123
n125 -->|depends_on| n122
n165 -->|depends_on| n201
n165 -->|depends_on| n149
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n201,n178,n137,n202,n143,n135,n197,n165,n203 internal;
class n150,n142,n196,n130,n30,n174,n29,n31,n32,n198,n179,n204,n127,n123,n121,n122,n125,n149 external;
```

### Edit Grants and Collaboration

Source: `docs/architecture/graphs/system-grants.mmd`

```mermaid
flowchart LR
n205["Grant Repository"]
n181["Collaboration Policy Evaluator"]
n179["Compatibility Checker"]
n180["Design Revision Guard"]
n138["Grant Issuer"]
n204["Grant Revoker"]
n206["Owner Offline Policy"]
n151["Grant Expiry"]
n160["Arbitration Adapter"]
n177["Delta Sync Planner (Bot Registry and Profiles)"]
n29["Command Router (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n156["Event Stream (Transport and Protocol)"]
n201["Claim Repository (Claims and Leases)"]
n172["Rules Store (Shared Infrastructure Plan)"]
n167["Structure Store (Shared Infrastructure Plan)"]
n173["SIP Revision Manager (Shared Infrastructure Plan)"]
n142["Transaction Manager (Memory and Persistence)"]
n135["Fencing Token Authority (Claims and Leases)"]
n154["Presence Tracker (Bot Registry and Profiles)"]
n199["Bot Profile Store (Bot Registry and Profiles)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n177 -->|depends_on| n199
n177 -->|reads| n205
n177 -->|reads| n173
n154 -->|depends_on| n199
n199 -->|depends_on| n142
n201 -->|depends_on| n142
n135 -->|depends_on| n142
n29 -->|controls| n138
n32 -->|delegates_to| n151
n32 -->|depends_on| n142
n160 -->|depends_on| n179
n160 -->|publishes| n156
n179 -->|reads| n201
n179 -->|depends_on| n205
n179 -->|depends_on| n172
n179 -->|depends_on| n167
n180 -->|depends_on| n205
n180 -->|controls| n204
n180 -->|reads| n173
n151 -->|writes| n205
n138 -->|depends_on| n179
n138 -->|depends_on| n180
n138 -->|writes| n205
n138 -->|depends_on| n181
n205 -->|depends_on| n142
n204 -->|depends_on| n135
n204 -->|writes| n205
n206 -->|reads| n154
n206 -->|reads| n199
n206 -->|depends_on| n179
n181 -->|depends_on| n205
n181 -->|depends_on| n167
n50 -->|reads| n179
n50 -->|proposes_to| n138
n50 -->|subscribes| n156
n173 -->|publishes| n180
n173 -->|depends_on| n142
n173 -->|depends_on| n172
n172 -->|depends_on| n142
n167 -->|depends_on| n142
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n205,n181,n179,n180,n138,n204,n206,n151,n160 internal;
class n177,n29,n32,n156,n201,n172,n167,n173,n142,n135,n154,n199,n50 external;
```

### Bot Registry and Profiles

Source: `docs/architecture/graphs/system-bots.mmd`

```mermaid
flowchart LR
n153["Bot Identity Authenticator"]
n199["Bot Profile Store"]
n207["Role Manager"]
n208["Behavior Profile Manager"]
n209["Relationship Store"]
n154["Presence Tracker"]
n177["Delta Sync Planner"]
n150["Resume Orchestrator"]
n210["Agency State Store"]
n211["Name Pool Allocator"]
n70["Deterministic Policy (Brains)"]
n62["Reconnect Supervisor (Bot Runtime and Mineflayer Adapter)"]
n205["Grant Repository (Edit Grants and Collaboration)"]
n173["SIP Revision Manager (Shared Infrastructure Plan)"]
n189["Task Repository (Task Board)"]
n162["Secrets Loader (Config and Profiles)"]
n212["Name Pool Validator (Config and Profiles)"]
n142["Transaction Manager (Memory and Persistence)"]
n197["Claim Releaser (Claims and Leases)"]
n145["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n87["Skill Checkpoint Manager (Skill Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n74["Bot Session Manager (Coordinator Runtime)"]
n206["Owner Offline Policy (Edit Grants and Collaboration)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n127["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n192["Priority Scheduler (Task Board)"]
n159["Transport Authentication (Transport and Protocol)"]
n115["Agency State Adapter (Bot Runtime and Mineflayer Adapter)"]
n128["Agency Status View (Ops and Observability)"]
n213["Agency State (Agency)"]
n70 -->|reads| n208
n62 -->|delegates_to| n177
n208 -->|depends_on| n199
n177 -->|depends_on| n199
n177 -->|reads| n205
n177 -->|reads| n173
n177 -->|reads| n189
n153 -->|depends_on| n199
n153 -->|depends_on| n162
n211 -->|depends_on| n199
n211 -->|depends_on| n212
n154 -->|depends_on| n199
n199 -->|depends_on| n142
n209 -->|depends_on| n199
n150 -->|depends_on| n177
n150 -->|depends_on| n199
n150 -->|delegates_to| n197
n150 -->|delegates_to| n145
n150 -->|reads| n87
n207 -->|depends_on| n199
n32 -->|depends_on| n150
n32 -->|depends_on| n142
n32 -->|depends_on| n145
n74 -->|depends_on| n153
n74 -->|publishes| n154
n205 -->|depends_on| n142
n206 -->|reads| n154
n206 -->|reads| n199
n67 -->|depends_on| n154
n127 -->|depends_on| n154
n127 -->|reads| n173
n127 -->|reads| n189
n42 -->|reads| n199
n42 -->|reads| n173
n42 -->|reads| n189
n173 -->|depends_on| n142
n87 -->|depends_on| n142
n192 -->|reads| n199
n189 -->|depends_on| n142
n159 -->|depends_on| n153
n159 -->|depends_on| n162
n153 -->|writes| n199
n207 -->|writes| n199
n208 -->|writes| n199
n209 -->|writes| n199
n211 -->|writes| n199
n115 -->|persists_to| n210
n210 -->|depends_on| n142
n128 -->|reads| n210
n210 -->|depends_on| n213
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n153,n199,n207,n208,n209,n154,n177,n150,n210,n211 internal;
class n70,n62,n205,n173,n189,n162,n212,n142,n197,n145,n87,n32,n74,n206,n67,n127,n42,n192,n159,n115,n128,n213 external;
```

### World Model and Landmarks

Source: `docs/architecture/graphs/system-world.mmd`

```mermaid
flowchart LR
n163["Observation Ingestor"]
n214["Chunk Version Store"]
n215["Sparse Occupancy Grid"]
n216["Merge Conflict Resolver"]
n217["Confidence Decay"]
n218["Landmark Registry"]
n219["Detector Result Integrator"]
n185["Plan Tagging"]
n183["Spatial Query Engine"]
n182["Container Memory"]
n184["World Reconciler"]
n107["Block Verifier (Building)"]
n109["Container Refill Adapter (Building)"]
n108["Material Preflight (Building)"]
n106["Reachability and Scaffold Planner (Building)"]
n103["Schematic Diff (Building)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n123["Active Bot Support Rule (Autonomy and Safety)"]
n125["Safety Policy Engine (Autonomy and Safety)"]
n170["Container Registry (Shared Infrastructure Plan)"]
n175["Dependency Validator (Shared Infrastructure Plan)"]
n145["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n173["SIP Revision Manager (Shared Infrastructure Plan)"]
n52["Skill Context Builder (Skill Runtime)"]
n88["Skill Restore Validator (Skill Runtime)"]
n220["Deposit (Skill Library)"]
n221["Explore (Skill Library)"]
n222["Skill Shared Utilities (Skill Library)"]
n223["Withdraw (Skill Library)"]
n191["Precondition Evaluator (Task Board)"]
n156["Event Stream (Transport and Protocol)"]
n142["Transaction Manager (Memory and Persistence)"]
n141["Message Schema Registry (Transport and Protocol)"]
n171["Path Graph Store (Shared Infrastructure Plan)"]
n107 -->|reads| n183
n109 -->|writes| n182
n108 -->|reads| n52
n108 -->|reads| n182
n106 -->|reads| n183
n103 -->|reads| n183
n42 -->|reads| n173
n42 -->|reads| n183
n45 -->|depends_on| n175
n45 -->|reads| n183
n123 -->|reads| n183
n125 -->|depends_on| n123
n125 -->|reads| n183
n170 -->|depends_on| n142
n170 -->|depends_on| n182
n175 -->|depends_on| n170
n175 -->|depends_on| n171
n175 -->|reads| n183
n171 -->|depends_on| n142
n145 -->|depends_on| n184
n173 -->|depends_on| n142
n173 -->|publishes| n185
n52 -->|reads| n173
n52 -->|reads| n183
n88 -->|depends_on| n183
n220 -->|depends_on| n182
n221 -->|depends_on| n183
n222 -->|depends_on| n52
n222 -->|depends_on| n183
n223 -->|depends_on| n182
n191 -->|reads| n183
n156 -->|publishes| n163
n214 -->|depends_on| n142
n217 -->|depends_on| n214
n217 -->|writes| n218
n182 -->|reads| n170
n182 -->|depends_on| n218
n219 -->|writes| n218
n219 -->|depends_on| n216
n218 -->|depends_on| n142
n216 -->|writes| n214
n216 -->|depends_on| n217
n163 -->|subscribes| n156
n163 -->|reads| n141
n163 -->|writes| n214
n215 -->|depends_on| n214
n185 -->|depends_on| n218
n183 -->|reads| n171
n183 -->|depends_on| n218
n183 -->|depends_on| n215
n184 -->|depends_on| n218
n184 -->|depends_on| n183
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n163,n214,n215,n216,n217,n218,n219,n185,n183,n182,n184 internal;
class n107,n109,n108,n106,n103,n42,n45,n123,n125,n170,n175,n145,n173,n52,n88,n220,n221,n222,n223,n191,n156,n142,n141,n171 external;
```

### Perception

Source: `docs/architecture/graphs/system-perception.mmd`

```mermaid
flowchart LR
n224["Ring Sampler"]
n225["Chunk Snapshot Encoder"]
n164["Block Update Listener"]
n226["Path and Road Detector"]
n227["House Detector"]
n228["Farm Detector"]
n229["Storage and Workstation Detector"]
n230["Linear Structure Detector"]
n231["Detector Pipeline"]
n161["Landmark Candidate Emitter"]
n232["Perception Rate Limiter"]
n55["Mineflayer Event Bridge (Bot Runtime and Mineflayer Adapter)"]
n114["Perception Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n233["Detector Fixtures (Testing and Evaluation)"]
n156["Event Stream (Transport and Protocol)"]
n152["Profile Resolver (Config and Profiles)"]
n55 -->|delegates_to| n164
n114 -->|depends_on| n231
n114 -->|depends_on| n224
n56 -->|depends_on| n55
n56 -->|delegates_to| n224
n233 -->|depends_on| n231
n225 -->|depends_on| n224
n231 -->|depends_on| n225
n231 -->|depends_on| n228
n231 -->|depends_on| n227
n231 -->|depends_on| n230
n231 -->|depends_on| n226
n231 -->|depends_on| n229
n228 -->|depends_on| n225
n227 -->|depends_on| n225
n161 -->|depends_on| n231
n161 -->|publishes| n156
n230 -->|depends_on| n225
n226 -->|depends_on| n225
n232 -->|depends_on| n152
n224 -->|depends_on| n232
n229 -->|depends_on| n225
n164 -->|publishes| n156
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n224,n225,n164,n226,n227,n228,n229,n230,n231,n161,n232 internal;
class n55,n114,n56,n233,n156,n152 external;
```

### Laya Decision Service

Source: `docs/architecture/graphs/system-decision.mmd`

```mermaid
flowchart LR
n34["Model Loader"]
n35["Execution Provider Selector"]
n76["Decision Queue"]
n77["Decision Rate Limiter"]
n78["Digest Cache"]
n79["Digest Assembler"]
n36["Batch Runner"]
n37["Single In-flight Guard"]
n38["Output Parser"]
n39["Confidence Calibrator"]
n40["Timeout and Fallback Handler"]
n80["Latency Metrics"]
n70["Deterministic Policy (Brains)"]
n146["Config Schema Validator (Config and Profiles)"]
n141["Message Schema Registry (Transport and Protocol)"]
n234["Hardware Probe (Config and Profiles)"]
n131["Structured Logger (Ops and Observability)"]
n130["Metrics Registry (Ops and Observability)"]
n235["Laya Runtime Resolver (Config and Profiles)"]
n26(["ONNX Runtime / WebGPU Driver"])
n156["Event Stream (Transport and Protocol)"]
n152["Profile Resolver (Config and Profiles)"]
n236["Laya Benchmark Harness (Testing and Evaluation)"]
n132["Health and Readiness (Ops and Observability)"]
n237["Calibration Fitter (Laya Training)"]
n70 -->|subscribes| n156
n234 -->|depends_on| n152
n235 -->|depends_on| n234
n235 -->|depends_on| n152
n152 -->|depends_on| n146
n36 -->|depends_on| n78
n36 -->|depends_on| n34
n36 -->|depends_on| n76
n39 -->|proposes_to| n70
n39 -->|depends_on| n146
n39 -->|depends_on| n38
n79 -->|depends_on| n141
n78 -->|depends_on| n76
n35 -->|depends_on| n234
n35 -->|controls| n34
n35 -->|observes| n131
n80 -->|observes| n130
n80 -->|writes| n130
n34 -->|depends_on| n235
n34 -->|depends_on| n26
n38 -->|depends_on| n36
n38 -->|publishes| n156
n76 -->|subscribes| n156
n77 -->|depends_on| n152
n77 -->|depends_on| n76
n37 -->|controls| n36
n40 -->|controls| n38
n40 -->|depends_on| n76
n236 -->|depends_on| n80
n236 -->|depends_on| n34
n132 -->|depends_on| n34
n237 -->|reads| n39
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n34,n35,n76,n77,n78,n79,n36,n37,n38,n39,n40,n80 internal;
class n70,n146,n141,n234,n131,n130,n235,n156,n152,n236,n132,n237,n26 external;
```

### Cloud Planner Advisor

Source: `docs/architecture/graphs/system-planner.mmd`

```mermaid
flowchart LR
n41["OpenAI-Compatible Client"]
n42["Planner Context Builder"]
n43["Planner Trigger Evaluator"]
n44["Planner Schema Validator"]
n45["Planner Semantic Validator"]
n46["Planner Repair Loop"]
n47["SIP Mutation Translator"]
n48["Task DAG Translator"]
n49["Planner Budget Limiter"]
n81["Plan Cache"]
n50["Planner Arbitration Handler"]
n51["Keep Last Good Fallback"]
n31["Global Scheduler (Coordinator Runtime)"]
n179["Compatibility Checker (Edit Grants and Collaboration)"]
n138["Grant Issuer (Edit Grants and Collaboration)"]
n156["Event Stream (Transport and Protocol)"]
n130["Metrics Registry (Ops and Observability)"]
n199["Bot Profile Store (Bot Registry and Profiles)"]
n173["SIP Revision Manager (Shared Infrastructure Plan)"]
n189["Task Repository (Task Board)"]
n183["Spatial Query Engine (World Model and Landmarks)"]
n146["Config Schema Validator (Config and Profiles)"]
n162["Secrets Loader (Config and Profiles)"]
n25(["Muse Spark Planner Endpoint"])
n142["Transaction Manager (Memory and Persistence)"]
n175["Dependency Validator (Shared Infrastructure Plan)"]
n172["Rules Store (Shared Infrastructure Plan)"]
n83["Skill Registry (Skill Runtime)"]
n176["SIP Mutation Proposer (Shared Infrastructure Plan)"]
n195["Dead Letter Manager (Task Board)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n199 -->|depends_on| n142
n31 -->|delegates_to| n43
n179 -->|depends_on| n172
n138 -->|depends_on| n179
n50 -->|reads| n179
n50 -->|proposes_to| n138
n50 -->|subscribes| n156
n49 -->|observes| n130
n49 -->|controls| n41
n42 -->|reads| n199
n42 -->|reads| n173
n42 -->|reads| n189
n42 -->|reads| n183
n51 -->|depends_on| n81
n51 -->|reads| n173
n41 -->|depends_on| n146
n41 -->|depends_on| n162
n41 -->|depends_on| n25
n41 -->|delegates_to| n50
n81 -->|depends_on| n142
n46 -->|controls| n51
n46 -->|depends_on| n41
n46 -->|depends_on| n44
n46 -->|depends_on| n45
n44 -->|controls| n46
n45 -->|controls| n46
n45 -->|depends_on| n44
n45 -->|depends_on| n175
n45 -->|reads| n172
n45 -->|reads| n83
n45 -->|reads| n183
n47 -->|depends_on| n46
n47 -->|proposes_to| n176
n48 -->|depends_on| n46
n48 -->|proposes_to| n189
n43 -->|observes| n130
n43 -->|delegates_to| n42
n43 -->|reads| n173
n43 -->|reads| n195
n64 -->|proposes_to| n43
n64 -->|depends_on| n156
n175 -->|reads| n183
n176 -->|depends_on| n175
n176 -->|depends_on| n173
n173 -->|depends_on| n142
n173 -->|depends_on| n172
n172 -->|depends_on| n142
n195 -->|writes| n189
n189 -->|depends_on| n142
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n41,n42,n43,n44,n45,n46,n47,n48,n49,n81,n50,n51 internal;
class n31,n179,n138,n156,n130,n199,n173,n189,n183,n146,n162,n142,n175,n172,n83,n176,n195,n64,n25 external;
```

### Skill Runtime

Source: `docs/architecture/graphs/system-skill-runtime.mmd`

```mermaid
flowchart LR
n82["Skill Contract"]
n83["Skill Registry"]
n84["Skill Lifecycle Executor"]
n85["Skill Tick Scheduler"]
n52["Skill Context Builder"]
n86["Skill Progress Reporter"]
n87["Skill Checkpoint Manager"]
n88["Skill Restore Validator"]
n89["Typed Effects Emitter"]
n90["Skill Preemption Handler"]
n134["Affordance Enumerator (Brains)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n150["Resume Orchestrator (Bot Registry and Profiles)"]
n108["Material Preflight (Building)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n142["Transaction Manager (Memory and Persistence)"]
n173["SIP Revision Manager (Shared Infrastructure Plan)"]
n183["Spatial Query Engine (World Model and Landmarks)"]
n156["Event Stream (Transport and Protocol)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n130["Metrics Registry (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n238["Craft (Skill Library)"]
n239["Navigate (Skill Library)"]
n240["Place Build (Skill Library)"]
n222["Skill Shared Utilities (Skill Library)"]
n134 -->|depends_on| n56
n134 -->|depends_on| n69
n134 -->|depends_on| n83
n59 -->|depends_on| n84
n59 -->|depends_on| n85
n56 -->|delegates_to| n52
n150 -->|reads| n87
n108 -->|reads| n52
n45 -->|reads| n83
n45 -->|reads| n183
n63 -->|reads| n69
n69 -->|controls| n63
n173 -->|depends_on| n142
n87 -->|depends_on| n142
n52 -->|reads| n56
n52 -->|reads| n173
n52 -->|depends_on| n87
n52 -->|reads| n183
n89 -->|publishes| n156
n84 -->|depends_on| n52
n84 -->|depends_on| n89
n84 -->|depends_on| n82
n84 -->|depends_on| n83
n90 -->|reads| n63
n90 -->|depends_on| n84
n86 -->|observes| n130
n86 -->|publishes| n156
n88 -->|depends_on| n87
n88 -->|depends_on| n183
n83 -->|depends_on| n82
n85 -->|reads| n69
n85 -->|depends_on| n84
n238 -->|depends_on| n52
n239 -->|depends_on| n82
n240 -->|depends_on| n52
n222 -->|depends_on| n52
n222 -->|depends_on| n183
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n82,n83,n84,n85,n52,n86,n87,n88,n89,n90 internal;
class n134,n59,n56,n150,n108,n45,n142,n173,n183,n156,n63,n130,n69,n238,n239,n240,n222 external;
```

### Skill Library

Source: `docs/architecture/graphs/system-skills.mmd`

```mermaid
flowchart LR
n239["Navigate"]
n186["Follow Path"]
n241["Mine"]
n242["Collect"]
n238["Craft"]
n243["Smelt"]
n244["Eat"]
n220["Deposit"]
n223["Withdraw"]
n245["Sleep"]
n246["Flee or Defend"]
n221["Explore"]
n247["Bridge"]
n248["Clear"]
n240["Place Build"]
n249["Schematic Build"]
n250["Repair"]
n187["Harvest Farm"]
n188["Plant Farm"]
n222["Skill Shared Utilities"]
n53["Block Executor (Building)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n52["Skill Context Builder (Skill Runtime)"]
n182["Container Memory (World Model and Landmarks)"]
n183["Spatial Query Engine (World Model and Landmarks)"]
n117["Mob Threat Evaluator (Autonomy and Safety)"]
n171["Path Graph Store (Shared Infrastructure Plan)"]
n169["Farm Store (Shared Infrastructure Plan)"]
n82["Skill Contract (Skill Runtime)"]
n103["Schematic Diff (Building)"]
n105["Build Order Planner (Building)"]
n104["Work Package Partitioner (Building)"]
n57 -->|depends_on| n63
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n105 -->|depends_on| n104
n103 -->|reads| n183
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n183
n247 -->|depends_on| n53
n247 -->|depends_on| n239
n248 -->|depends_on| n53
n248 -->|depends_on| n63
n242 -->|depends_on| n57
n242 -->|depends_on| n241
n242 -->|depends_on| n239
n238 -->|depends_on| n57
n238 -->|depends_on| n52
n220 -->|depends_on| n57
n220 -->|depends_on| n182
n244 -->|depends_on| n57
n221 -->|depends_on| n239
n221 -->|depends_on| n183
n246 -->|depends_on| n57
n246 -->|depends_on| n117
n246 -->|depends_on| n239
n186 -->|depends_on| n171
n186 -->|depends_on| n239
n187 -->|depends_on| n57
n187 -->|depends_on| n169
n187 -->|depends_on| n239
n241 -->|depends_on| n57
n241 -->|depends_on| n239
n239 -->|depends_on| n57
n239 -->|depends_on| n82
n240 -->|depends_on| n53
n240 -->|depends_on| n52
n188 -->|depends_on| n57
n188 -->|depends_on| n169
n188 -->|depends_on| n239
n250 -->|depends_on| n53
n250 -->|depends_on| n103
n249 -->|depends_on| n53
n249 -->|depends_on| n105
n249 -->|depends_on| n104
n222 -->|depends_on| n52
n222 -->|depends_on| n183
n245 -->|depends_on| n57
n245 -->|depends_on| n239
n243 -->|depends_on| n57
n243 -->|depends_on| n239
n223 -->|depends_on| n57
n223 -->|depends_on| n182
n183 -->|reads| n171
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n239,n186,n241,n242,n238,n243,n244,n220,n223,n245,n246,n221,n247,n248,n240,n249,n250,n187,n188,n222 internal;
class n53,n63,n57,n52,n182,n183,n117,n171,n169,n82,n103,n105,n104 external;
```

### Building

Source: `docs/architecture/graphs/system-building.mmd`

```mermaid
flowchart LR
n91["Blueprint IR"]
n92["Blueprint Validator"]
n93["Template Registry"]
n94["House Template"]
n95["Road Template"]
n96["Farm Template"]
n97["Wall Template"]
n98["Bridge Template"]
n99["Storage Room Template"]
n100["Watchtower Template"]
n101["Template Instantiator"]
n102["Schematic Parser"]
n103["Schematic Diff"]
n104["Work Package Partitioner"]
n105["Build Order Planner"]
n106["Reachability and Scaffold Planner"]
n107["Block Verifier"]
n53["Block Executor"]
n108["Material Preflight"]
n109["Container Refill Adapter"]
n110["Rollback Journal"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n183["Spatial Query Engine (World Model and Landmarks)"]
n172["Rules Store (Shared Infrastructure Plan)"]
n182["Container Memory (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n251["Block Changelog Writer (Memory and Persistence)"]
n167["Structure Store (Shared Infrastructure Plan)"]
n156["Event Stream (Transport and Protocol)"]
n247["Bridge (Skill Library)"]
n248["Clear (Skill Library)"]
n240["Place Build (Skill Library)"]
n250["Repair (Skill Library)"]
n249["Schematic Build (Skill Library)"]
n57 -->|depends_on| n63
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n107
n53 -->|depends_on| n110
n53 -->|depends_on| n63
n107 -->|depends_on| n91
n107 -->|reads| n183
n92 -->|depends_on| n91
n92 -->|depends_on| n172
n105 -->|depends_on| n91
n105 -->|depends_on| n104
n109 -->|depends_on| n57
n109 -->|writes| n182
n108 -->|depends_on| n91
n108 -->|reads| n52
n108 -->|reads| n182
n106 -->|reads| n56
n106 -->|depends_on| n105
n106 -->|reads| n183
n110 -->|writes| n251
n110 -->|reads| n167
n110 -->|subscribes| n156
n103 -->|depends_on| n91
n103 -->|reads| n183
n102 -->|depends_on| n91
n98 -->|depends_on| n91
n96 -->|depends_on| n91
n94 -->|depends_on| n91
n101 -->|depends_on| n92
n101 -->|depends_on| n93
n93 -->|depends_on| n91
n95 -->|depends_on| n91
n99 -->|depends_on| n91
n97 -->|depends_on| n91
n100 -->|depends_on| n91
n104 -->|depends_on| n91
n104 -->|reads| n167
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n183
n247 -->|depends_on| n53
n248 -->|depends_on| n53
n248 -->|depends_on| n63
n240 -->|depends_on| n53
n240 -->|depends_on| n52
n250 -->|depends_on| n53
n250 -->|depends_on| n103
n249 -->|depends_on| n53
n249 -->|depends_on| n105
n249 -->|depends_on| n104
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n91,n92,n93,n94,n95,n96,n97,n98,n99,n100,n101,n102,n103,n104,n105,n106,n107,n53,n108,n109,n110 internal;
class n57,n63,n183,n172,n182,n52,n56,n251,n167,n156,n247,n248,n240,n250,n249 external;
```

### Bot Runtime and Mineflayer Adapter

Source: `docs/architecture/graphs/system-bot-runtime.mmd`

```mermaid
flowchart LR
n54["Connection Lifecycle"]
n111["Join and Auth"]
n55["Mineflayer Event Bridge"]
n56["World Cache Adapter"]
n112["Reach and Rate Guard"]
n57["Action Executor"]
n113["State Digest Collector"]
n58["Guardian Hook"]
n59["Skill Host"]
n114["Perception Host"]
n60["Agent Loop"]
n61["Chat Adapter"]
n115["Agency State Adapter"]
n62["Reconnect Supervisor"]
n63["Action Veto Gate (Autonomy and Safety)"]
n134["Affordance Enumerator (Brains)"]
n146["Config Schema Validator (Config and Profiles)"]
n24(["Minecraft 1.20.1 LAN Server"])
n70["Deterministic Policy (Brains)"]
n164["Block Update Listener (Perception)"]
n69["Reflex Guardian Loop (Brains)"]
n152["Profile Resolver (Config and Profiles)"]
n231["Detector Pipeline (Perception)"]
n224["Ring Sampler (Perception)"]
n177["Delta Sync Planner (Bot Registry and Profiles)"]
n158["Reconnect Supervisor (Transport and Protocol)"]
n84["Skill Lifecycle Executor (Skill Runtime)"]
n85["Skill Tick Scheduler (Skill Runtime)"]
n156["Event Stream (Transport and Protocol)"]
n52["Skill Context Builder (Skill Runtime)"]
n53["Block Executor (Building)"]
n109["Container Refill Adapter (Building)"]
n106["Reachability and Scaffold Planner (Building)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n242["Collect (Skill Library)"]
n238["Craft (Skill Library)"]
n220["Deposit (Skill Library)"]
n244["Eat (Skill Library)"]
n246["Flee or Defend (Skill Library)"]
n187["Harvest Farm (Skill Library)"]
n241["Mine (Skill Library)"]
n239["Navigate (Skill Library)"]
n188["Plant Farm (Skill Library)"]
n245["Sleep (Skill Library)"]
n243["Smelt (Skill Library)"]
n223["Withdraw (Skill Library)"]
n33["Bot Process Supervisor (Coordinator Runtime)"]
n252["Goal Arbiter (Agency)"]
n253["Intention Manager (Agency)"]
n213["Agency State (Agency)"]
n71["Laya Client (Brains)"]
n254["Social Engine (Agency)"]
n210["Agency State Store (Bot Registry and Profiles)"]
n255["Agent Episode Repository (Memory and Persistence)"]
n57 -->|depends_on| n54
n57 -->|depends_on| n112
n57 -->|depends_on| n63
n134 -->|depends_on| n56
n134 -->|depends_on| n69
n54 -->|depends_on| n146
n54 -->|depends_on| n24
n70 -->|depends_on| n134
n70 -->|depends_on| n113
n70 -->|subscribes| n156
n55 -->|depends_on| n54
n55 -->|delegates_to| n164
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n111 -->|depends_on| n54
n111 -->|depends_on| n152
n114 -->|depends_on| n231
n114 -->|depends_on| n224
n112 -->|depends_on| n146
n62 -->|depends_on| n54
n62 -->|delegates_to| n177
n62 -->|depends_on| n158
n59 -->|depends_on| n84
n59 -->|depends_on| n85
n113 -->|depends_on| n54
n113 -->|depends_on| n56
n113 -->|publishes| n156
n56 -->|depends_on| n55
n56 -->|delegates_to| n224
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n109 -->|depends_on| n57
n106 -->|reads| n56
n152 -->|depends_on| n146
n67 -->|controls| n59
n67 -->|depends_on| n156
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n65 -->|controls| n57
n65 -->|depends_on| n156
n69 -->|controls| n63
n52 -->|reads| n56
n84 -->|depends_on| n52
n85 -->|reads| n69
n85 -->|depends_on| n84
n242 -->|depends_on| n57
n242 -->|depends_on| n241
n242 -->|depends_on| n239
n238 -->|depends_on| n57
n238 -->|depends_on| n52
n220 -->|depends_on| n57
n244 -->|depends_on| n57
n246 -->|depends_on| n57
n246 -->|depends_on| n239
n187 -->|depends_on| n57
n187 -->|depends_on| n239
n241 -->|depends_on| n57
n241 -->|depends_on| n239
n239 -->|depends_on| n57
n188 -->|depends_on| n57
n188 -->|depends_on| n239
n245 -->|depends_on| n57
n245 -->|depends_on| n239
n243 -->|depends_on| n57
n243 -->|depends_on| n239
n223 -->|depends_on| n57
n33 -->|controls| n54
n71 -->|depends_on| n134
n71 -->|depends_on| n70
n164 -->|publishes| n156
n60 -->|depends_on| n252
n60 -->|depends_on| n253
n60 -->|depends_on| n213
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n113
n60 -->|delegates_to| n59
n61 -->|depends_on| n254
n61 -->|publishes| n156
n115 -->|persists_to| n210
n60 -->|persists_to| n255
n253 -->|depends_on| n252
n213 -->|depends_on| n253
n254 -->|proposes_to| n61
n210 -->|depends_on| n213
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n54,n111,n55,n56,n112,n57,n113,n58,n59,n114,n60,n61,n115,n62 internal;
class n63,n134,n146,n70,n164,n69,n152,n231,n224,n177,n158,n84,n85,n156,n52,n53,n109,n106,n67,n65,n242,n238,n220,n244,n246,n187,n241,n239,n188,n245,n243,n223,n33,n252,n253,n213,n71,n254,n210,n255,n24 external;
```

### Autonomy and Safety

Source: `docs/architecture/graphs/system-safety.mmd`

```mermaid
flowchart LR
n116["Hazard Evaluator"]
n117["Mob Threat Evaluator"]
n118["Hunger Evaluator"]
n119["Stuck and Timeout Evaluator"]
n120["Inventory Evaluator"]
n121["Claim Loss Evaluator"]
n122["Protected BBox Rule"]
n123["Active Bot Support Rule"]
n124["Material Ban Rule"]
n125["Safety Policy Engine"]
n63["Action Veto Gate"]
n64["Recovery Ladder"]
n65["Emergency Stop Controller"]
n126["Incident Journal"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n53["Block Executor (Building)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n201["Claim Repository (Claims and Leases)"]
n183["Spatial Query Engine (World Model and Landmarks)"]
n29["Command Router (Coordinator Runtime)"]
n156["Event Stream (Transport and Protocol)"]
n200["Event Log Writer (Memory and Persistence)"]
n172["Rules Store (Shared Infrastructure Plan)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n90["Skill Preemption Handler (Skill Runtime)"]
n248["Clear (Skill Library)"]
n246["Flee or Defend (Skill Library)"]
n57 -->|depends_on| n63
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n68 -->|controls| n65
n68 -->|depends_on| n156
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n63 -->|depends_on| n125
n123 -->|reads| n201
n123 -->|reads| n183
n121 -->|reads| n201
n65 -->|controls| n57
n65 -->|controls| n29
n65 -->|depends_on| n156
n69 -->|controls| n63
n69 -->|depends_on| n121
n69 -->|depends_on| n116
n69 -->|depends_on| n118
n69 -->|depends_on| n120
n69 -->|depends_on| n117
n69 -->|depends_on| n119
n126 -->|writes| n200
n122 -->|reads| n201
n122 -->|reads| n172
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n64 -->|depends_on| n156
n125 -->|reads| n201
n125 -->|depends_on| n123
n125 -->|depends_on| n124
n125 -->|depends_on| n122
n125 -->|reads| n172
n125 -->|reads| n183
n90 -->|reads| n63
n248 -->|depends_on| n53
n248 -->|depends_on| n63
n246 -->|depends_on| n57
n246 -->|depends_on| n117
n68 -->|writes| n200
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n116,n117,n118,n119,n120,n121,n122,n123,n124,n125,n63,n64,n65,n126 internal;
class n57,n58,n53,n68,n69,n201,n183,n29,n156,n200,n172,n43,n90,n248,n246 external;
```

### Memory and Persistence

Source: `docs/architecture/graphs/system-memory.mmd`

```mermaid
flowchart LR
n256["SQLite Runtime"]
n148["Migration Runner"]
n142["Transaction Manager"]
n200["Event Log Writer"]
n251["Block Changelog Writer"]
n144["Retention Pruner"]
n257["Snapshot Export"]
n258["Schema Version Registry"]
n259["Episode Store"]
n255["Agent Episode Repository"]
n199["Bot Profile Store (Bot Registry and Profiles)"]
n110["Rollback Journal (Building)"]
n137["Atomic Claim Acquirer (Claims and Leases)"]
n201["Claim Repository (Claims and Leases)"]
n135["Fencing Token Authority (Claims and Leases)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n72["Process Bootstrap (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n260["Replay Engine (Testing and Evaluation)"]
n205["Grant Repository (Edit Grants and Collaboration)"]
n133["Audit Viewer (Ops and Observability)"]
n132["Health and Readiness (Ops and Observability)"]
n81["Plan Cache (Cloud Planner Advisor)"]
n126["Incident Journal (Autonomy and Safety)"]
n170["Container Registry (Shared Infrastructure Plan)"]
n169["Farm Store (Shared Infrastructure Plan)"]
n171["Path Graph Store (Shared Infrastructure Plan)"]
n173["SIP Revision Manager (Shared Infrastructure Plan)"]
n168["Road Store (Shared Infrastructure Plan)"]
n172["Rules Store (Shared Infrastructure Plan)"]
n167["Structure Store (Shared Infrastructure Plan)"]
n139["SIP Transactional Committer (Shared Infrastructure Plan)"]
n166["Zone Store (Shared Infrastructure Plan)"]
n87["Skill Checkpoint Manager (Skill Runtime)"]
n140["Atomic Task Claimer (Task Board)"]
n189["Task Repository (Task Board)"]
n196["Task State Machine (Task Board)"]
n261["Trace Exporter (Laya Training)"]
n214["Chunk Version Store (World Model and Landmarks)"]
n218["Landmark Registry (World Model and Landmarks)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n210["Agency State Store (Bot Registry and Profiles)"]
n128["Agency Status View (Ops and Observability)"]
n199 -->|depends_on| n142
n110 -->|writes| n251
n110 -->|reads| n167
n137 -->|writes| n201
n137 -->|depends_on| n142
n201 -->|depends_on| n142
n135 -->|depends_on| n30
n135 -->|depends_on| n142
n30 -->|controls| n135
n30 -->|depends_on| n142
n31 -->|depends_on| n30
n31 -->|delegates_to| n144
n72 -->|depends_on| n32
n72 -->|depends_on| n148
n32 -->|depends_on| n142
n260 -->|depends_on| n200
n205 -->|depends_on| n142
n251 -->|depends_on| n142
n200 -->|depends_on| n142
n148 -->|depends_on| n256
n144 -->|depends_on| n251
n144 -->|depends_on| n200
n144 -->|depends_on| n142
n258 -->|depends_on| n148
n257 -->|depends_on| n142
n142 -->|depends_on| n256
n133 -->|reads| n251
n133 -->|reads| n200
n132 -->|depends_on| n256
n81 -->|depends_on| n142
n126 -->|writes| n200
n170 -->|depends_on| n142
n169 -->|depends_on| n142
n171 -->|depends_on| n142
n173 -->|depends_on| n142
n173 -->|depends_on| n172
n168 -->|depends_on| n142
n172 -->|depends_on| n142
n167 -->|depends_on| n142
n139 -->|depends_on| n142
n139 -->|writes| n170
n139 -->|writes| n169
n139 -->|writes| n171
n139 -->|depends_on| n173
n139 -->|writes| n168
n139 -->|writes| n172
n139 -->|writes| n167
n139 -->|writes| n166
n166 -->|depends_on| n142
n87 -->|depends_on| n142
n140 -->|depends_on| n142
n140 -->|writes| n189
n189 -->|depends_on| n142
n196 -->|depends_on| n200
n196 -->|writes| n189
n261 -->|reads| n200
n214 -->|depends_on| n142
n218 -->|depends_on| n142
n260 -->|reads| n259
n261 -->|reads| n259
n133 -->|reads| n259
n144 -->|depends_on| n259
n67 -->|writes| n200
n68 -->|writes| n200
n60 -->|persists_to| n255
n210 -->|depends_on| n142
n255 -->|depends_on| n142
n128 -->|reads| n210
n128 -->|reads| n255
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n256,n148,n142,n200,n251,n144,n257,n258,n259,n255 internal;
class n199,n110,n137,n201,n135,n30,n31,n72,n32,n260,n205,n133,n132,n81,n126,n170,n169,n171,n173,n168,n172,n167,n139,n166,n87,n140,n189,n196,n261,n214,n218,n67,n68,n60,n210,n128 external;
```

### Ops and Observability

Source: `docs/architecture/graphs/system-ops.mmd`

```mermaid
flowchart LR
n66["Ops API"]
n127["Status Aggregator"]
n128["Agency Status View"]
n67["Pause and Resume Controller"]
n68["Fleet Emergency Stop"]
n129["SIP Dump"]
n130["Metrics Registry"]
n131["Structured Logger"]
n132["Health and Readiness"]
n133["Audit Viewer"]
n203["Contention Metrics (Claims and Leases)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n80["Latency Metrics (Laya Decision Service)"]
n262["Metrics Reporter (Testing and Evaluation)"]
n28(["Fleet Operator"])
n251["Block Changelog Writer (Memory and Persistence)"]
n200["Event Log Writer (Memory and Persistence)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n156["Event Stream (Transport and Protocol)"]
n34["Model Loader (Laya Decision Service)"]
n256["SQLite Runtime (Memory and Persistence)"]
n141["Message Schema Registry (Transport and Protocol)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n154["Presence Tracker (Bot Registry and Profiles)"]
n173["SIP Revision Manager (Shared Infrastructure Plan)"]
n201["Claim Repository (Claims and Leases)"]
n189["Task Repository (Task Board)"]
n49["Planner Budget Limiter (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n86["Skill Progress Reporter (Skill Runtime)"]
n259["Episode Store (Memory and Persistence)"]
n210["Agency State Store (Bot Registry and Profiles)"]
n255["Agent Episode Repository (Memory and Persistence)"]
n203 -->|depends_on| n201
n203 -->|observes| n130
n35 -->|controls| n34
n35 -->|observes| n131
n80 -->|observes| n130
n80 -->|writes| n130
n262 -->|observes| n130
n28 -->|controls| n66
n133 -->|reads| n251
n133 -->|reads| n200
n68 -->|controls| n65
n68 -->|depends_on| n156
n132 -->|depends_on| n34
n132 -->|depends_on| n256
n132 -->|depends_on| n127
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n127
n66 -->|depends_on| n141
n67 -->|controls| n59
n67 -->|depends_on| n154
n67 -->|depends_on| n156
n129 -->|depends_on| n173
n127 -->|depends_on| n154
n127 -->|reads| n201
n127 -->|observes| n130
n127 -->|reads| n173
n127 -->|reads| n189
n49 -->|observes| n130
n43 -->|observes| n130
n43 -->|reads| n173
n65 -->|depends_on| n156
n86 -->|observes| n130
n86 -->|publishes| n156
n133 -->|reads| n259
n67 -->|writes| n200
n68 -->|writes| n200
n128 -->|reads| n210
n128 -->|reads| n255
n66 -->|depends_on| n128
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n66,n127,n128,n67,n68,n129,n130,n131,n132,n133 internal;
class n203,n35,n80,n262,n251,n200,n65,n156,n34,n256,n141,n59,n154,n173,n201,n189,n49,n43,n86,n259,n210,n255,n28 external;
```

### Config and Profiles

Source: `docs/architecture/graphs/system-config.mmd`

```mermaid
flowchart LR
n147["Environment Parser"]
n146["Config Schema Validator"]
n152["Profile Resolver"]
n234["Hardware Probe"]
n162["Secrets Loader"]
n212["Name Pool Validator"]
n235["Laya Runtime Resolver"]
n263["Fail Fast Handler"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n111["Join and Auth (Bot Runtime and Mineflayer Adapter)"]
n112["Reach and Rate Guard (Bot Runtime and Mineflayer Adapter)"]
n153["Bot Identity Authenticator (Bot Registry and Profiles)"]
n211["Name Pool Allocator (Bot Registry and Profiles)"]
n27(["Host Hardware"])
n72["Process Bootstrap (Coordinator Runtime)"]
n73["Service Composition (Coordinator Runtime)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n77["Decision Rate Limiter (Laya Decision Service)"]
n232["Perception Rate Limiter (Perception)"]
n41["OpenAI-Compatible Client (Cloud Planner Advisor)"]
n159["Transport Authentication (Transport and Protocol)"]
n54 -->|depends_on| n146
n111 -->|depends_on| n54
n111 -->|depends_on| n152
n112 -->|depends_on| n146
n153 -->|depends_on| n162
n211 -->|depends_on| n212
n146 -->|depends_on| n147
n263 -->|depends_on| n146
n234 -->|depends_on| n152
n234 -->|depends_on| n27
n235 -->|depends_on| n234
n235 -->|depends_on| n152
n212 -->|depends_on| n146
n152 -->|depends_on| n146
n162 -->|depends_on| n147
n72 -->|depends_on| n146
n72 -->|depends_on| n147
n72 -->|depends_on| n73
n73 -->|depends_on| n152
n39 -->|depends_on| n146
n35 -->|depends_on| n234
n35 -->|controls| n34
n34 -->|depends_on| n235
n77 -->|depends_on| n152
n232 -->|depends_on| n152
n41 -->|depends_on| n146
n41 -->|depends_on| n162
n159 -->|depends_on| n153
n159 -->|depends_on| n162
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n147,n146,n152,n234,n162,n212,n235,n263 internal;
class n54,n111,n112,n153,n211,n72,n73,n39,n35,n34,n77,n232,n41,n159,n27 external;
```

### Testing and Evaluation

Source: `docs/architecture/graphs/system-eval.mmd`

```mermaid
flowchart LR
n264["Unit Fixtures"]
n233["Detector Fixtures"]
n265["Docker Server Harness"]
n266["Scenario Runner"]
n260["Replay Engine"]
n198["Contention Harness"]
n262["Metrics Reporter"]
n267["Soak Runner"]
n268["Architecture Guard Tests"]
n236["Laya Benchmark Harness"]
n201["Claim Repository (Claims and Leases)"]
n189["Task Repository (Task Board)"]
n231["Detector Pipeline (Perception)"]
n24(["Minecraft 1.20.1 LAN Server"])
n80["Latency Metrics (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n130["Metrics Registry (Ops and Observability)"]
n200["Event Log Writer (Memory and Persistence)"]
n269["Promotion Gate (Laya Training)"]
n259["Episode Store (Memory and Persistence)"]
n80 -->|observes| n130
n80 -->|writes| n130
n268 -->|depends_on| n264
n198 -->|depends_on| n201
n198 -->|delegates_to| n266
n198 -->|depends_on| n189
n233 -->|depends_on| n264
n233 -->|depends_on| n231
n265 -->|depends_on| n264
n265 -->|depends_on| n24
n236 -->|depends_on| n80
n236 -->|depends_on| n34
n236 -->|delegates_to| n266
n262 -->|observes| n130
n260 -->|depends_on| n266
n260 -->|depends_on| n200
n266 -->|controls| n265
n266 -->|publishes| n262
n267 -->|depends_on| n262
n267 -->|delegates_to| n266
n269 -->|depends_on| n236
n260 -->|reads| n259
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n264,n233,n265,n266,n260,n198,n262,n267,n268,n236 internal;
class n201,n189,n231,n80,n34,n130,n200,n269,n259,n24 external;
```

### Laya Training

Source: `docs/architecture/graphs/system-training.mmd`

```mermaid
flowchart LR
n261["Trace Exporter"]
n270["Labeling Pipeline"]
n271["Reward Computer"]
n272["Fine-tune Runner"]
n273["ONNX Exporter"]
n237["Calibration Fitter"]
n269["Promotion Gate"]
n39["Confidence Calibrator (Laya Decision Service)"]
n236["Laya Benchmark Harness (Testing and Evaluation)"]
n200["Event Log Writer (Memory and Persistence)"]
n259["Episode Store (Memory and Persistence)"]
n237 -->|reads| n39
n237 -->|depends_on| n261
n272 -->|depends_on| n270
n272 -->|depends_on| n271
n270 -->|depends_on| n261
n273 -->|depends_on| n272
n269 -->|depends_on| n236
n269 -->|depends_on| n237
n269 -->|depends_on| n273
n271 -->|depends_on| n261
n261 -->|reads| n200
n261 -->|reads| n259
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n261,n270,n271,n272,n273,n237,n269 internal;
class n39,n236,n200,n259 external;
```

### Brains

Source: `docs/architecture/graphs/system-brains.mmd`

```mermaid
flowchart LR
n69["Reflex Guardian Loop"]
n134["Affordance Enumerator"]
n70["Deterministic Policy"]
n71["Laya Client"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n83["Skill Registry (Skill Runtime)"]
n113["State Digest Collector (Bot Runtime and Mineflayer Adapter)"]
n208["Behavior Profile Manager (Bot Registry and Profiles)"]
n156["Event Stream (Transport and Protocol)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n121["Claim Loss Evaluator (Autonomy and Safety)"]
n116["Hazard Evaluator (Autonomy and Safety)"]
n118["Hunger Evaluator (Autonomy and Safety)"]
n120["Inventory Evaluator (Autonomy and Safety)"]
n117["Mob Threat Evaluator (Autonomy and Safety)"]
n119["Stuck and Timeout Evaluator (Autonomy and Safety)"]
n85["Skill Tick Scheduler (Skill Runtime)"]
n149["WebSocket Codec (Transport and Protocol)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n134 -->|depends_on| n56
n134 -->|depends_on| n69
n134 -->|depends_on| n83
n70 -->|depends_on| n134
n70 -->|depends_on| n113
n70 -->|reads| n208
n70 -->|subscribes| n156
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n113 -->|depends_on| n56
n113 -->|publishes| n156
n39 -->|proposes_to| n70
n63 -->|reads| n69
n69 -->|controls| n63
n69 -->|depends_on| n121
n69 -->|depends_on| n116
n69 -->|depends_on| n118
n69 -->|depends_on| n120
n69 -->|depends_on| n117
n69 -->|depends_on| n119
n85 -->|reads| n69
n156 -->|depends_on| n149
n71 -->|depends_on| n134
n71 -->|depends_on| n149
n71 -->|depends_on| n70
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n113
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n69,n134,n70,n71 internal;
class n56,n83,n113,n208,n156,n58,n39,n63,n121,n116,n118,n120,n117,n119,n85,n149,n60 external;
```

### Agency

Source: `docs/architecture/graphs/system-agency.mmd`

```mermaid
flowchart LR
n274["Personality Model"]
n275["Needs Model"]
n276["Goal Catalog"]
n277["Goal Generator"]
n252["Goal Arbiter"]
n253["Intention Manager"]
n278["Routine Model"]
n254["Social Engine"]
n213["Agency State"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n210["Agency State Store (Bot Registry and Profiles)"]
n60 -->|depends_on| n252
n60 -->|depends_on| n253
n60 -->|depends_on| n213
n61 -->|depends_on| n254
n277 -->|depends_on| n276
n277 -->|depends_on| n275
n277 -->|depends_on| n274
n252 -->|depends_on| n277
n252 -->|depends_on| n275
n252 -->|depends_on| n274
n253 -->|depends_on| n252
n254 -->|depends_on| n274
n213 -->|depends_on| n275
n213 -->|depends_on| n274
n213 -->|depends_on| n253
n213 -->|depends_on| n278
n254 -->|proposes_to| n61
n210 -->|depends_on| n213
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n274,n275,n276,n277,n252,n253,n278,n254,n213 internal;
class n60,n61,n210 external;
```

### Bootstrap and Toolchain

Source: `docs/architecture/graphs/system-toolchain.mmd`

```mermaid
flowchart LR
n279["Bootstrap Orchestrator"]
n280["Capability Check"]
n281["Python Environment"]
n282["Minecraft Server Controller"]
n283["Firefox SVG Renderer"]
n279 -->|depends_on| n280
n279 -->|depends_on| n281
n279 -->|depends_on| n282
n279 -->|depends_on| n283
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n279,n280,n281,n282,n283 internal;
```
