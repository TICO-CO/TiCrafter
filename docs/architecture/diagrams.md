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
n14 -->|depends_on×2, publishes×2| n1
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
n12 -->|depends_on×9| n13
n12 -->|depends_on×2| n15
n12 -->|depends_on×21| n14
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
n14 -->|depends_on×2, publishes×2| n1
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
n12 -->|depends_on×9| n13
n12 -->|depends_on×2| n15
n12 -->|depends_on×21| n14
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
n153["Fencing Token Authority (Claims and Leases)"]
n154["Flow Control (Transport and Protocol)"]
n155["Atomic Claim Acquirer (Claims and Leases)"]
n156["Grant Issuer (Edit Grants and Collaboration)"]
n157["SIP Transactional Committer (Shared Infrastructure Plan)"]
n158["Atomic Task Claimer (Task Board)"]
n159["Message Schema Registry (Transport and Protocol)"]
n160["Transaction Manager (Memory and Persistence)"]
n161["Lease Reaper (Claims and Leases)"]
n162["Retention Pruner (Memory and Persistence)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n163["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n164["Config Schema Validator (Config and Profiles)"]
n165["Environment Parser (Config and Profiles)"]
n166["Migration Runner (Memory and Persistence)"]
n167["WebSocket Codec (Transport and Protocol)"]
n168["Resume Orchestrator (Bot Registry and Profiles)"]
n169["Grant Expiry (Edit Grants and Collaboration)"]
n170["Profile Resolver (Config and Profiles)"]
n171["Bot Identity Authenticator (Bot Registry and Profiles)"]
n172["Presence Tracker (Bot Registry and Profiles)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n54 -->|depends_on| n164
n168 -->|delegates_to| n163
n155 -->|depends_on| n160
n153 -->|depends_on| n30
n153 -->|depends_on| n160
n164 -->|depends_on| n165
n170 -->|depends_on| n164
n75 -->|depends_on| n154
n29 -->|controls| n155
n29 -->|controls| n156
n29 -->|controls| n157
n29 -->|controls| n158
n29 -->|depends_on| n159
n30 -->|controls| n153
n30 -->|depends_on| n160
n31 -->|delegates_to| n161
n31 -->|depends_on| n30
n31 -->|delegates_to| n162
n31 -->|delegates_to| n43
n31 -->|delegates_to| n163
n72 -->|depends_on| n164
n72 -->|depends_on| n165
n72 -->|depends_on| n32
n72 -->|depends_on| n73
n72 -->|depends_on| n166
n72 -->|depends_on| n167
n32 -->|depends_on| n168
n32 -->|delegates_to| n161
n32 -->|delegates_to| n169
n32 -->|depends_on| n160
n32 -->|depends_on| n163
n73 -->|depends_on| n170
n73 -->|depends_on| n31
n74 -->|depends_on| n171
n74 -->|publishes| n172
n74 -->|depends_on| n167
n162 -->|depends_on| n160
n65 -->|controls| n29
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n163 -->|depends_on| n157
n157 -->|depends_on| n160
n158 -->|depends_on| n160
n167 -->|depends_on| n159
n33 -->|controls| n54
n33 -->|depends_on| n30
n32 -->|depends_on| n33
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n72,n73,n74,n29,n30,n31,n32,n75,n33 internal;
class n153,n154,n155,n156,n157,n158,n159,n160,n161,n162,n43,n163,n164,n165,n166,n167,n168,n169,n170,n171,n172,n65,n64,n54 external;
```

### Transport and Protocol

Source: `docs/architecture/graphs/system-transport.mmd`

```mermaid
flowchart LR
n159["Message Schema Registry"]
n167["WebSocket Codec"]
n173["Request Correlator"]
n174["Event Stream"]
n175["Delta Sync Protocol"]
n176["Reconnect Supervisor"]
n177["Transport Authentication"]
n154["Flow Control"]
n70["Deterministic Policy (Brains)"]
n62["Reconnect Supervisor (Bot Runtime and Mineflayer Adapter)"]
n131["State Digest Collector (Bot Runtime and Mineflayer Adapter)"]
n110["Rollback Journal (Building)"]
n75["Backpressure Controller (Coordinator Runtime)"]
n29["Command Router (Coordinator Runtime)"]
n72["Process Bootstrap (Coordinator Runtime)"]
n74["Bot Session Manager (Coordinator Runtime)"]
n79["Digest Assembler (Laya Decision Service)"]
n38["Output Parser (Laya Decision Service)"]
n76["Decision Queue (Laya Decision Service)"]
n178["Arbitration Adapter (Edit Grants and Collaboration)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n66["Ops API (Ops and Observability)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n179["Landmark Candidate Emitter (Perception)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n89["Typed Effects Emitter (Skill Runtime)"]
n86["Skill Progress Reporter (Skill Runtime)"]
n171["Bot Identity Authenticator (Bot Registry and Profiles)"]
n180["Secrets Loader (Config and Profiles)"]
n181["Observation Ingestor (World Model and Landmarks)"]
n71["Laya Client (Brains)"]
n182["Block Update Listener (Perception)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n183["Bot Claim Command Handler (Claims and Leases)"]
n129["Blueprint Fetch Client (Bot Runtime and Mineflayer Adapter)"]
n70 -->|depends_on| n131
n70 -->|subscribes| n174
n62 -->|depends_on| n176
n131 -->|publishes| n174
n171 -->|depends_on| n180
n110 -->|subscribes| n174
n75 -->|depends_on| n154
n29 -->|depends_on| n159
n72 -->|depends_on| n167
n74 -->|depends_on| n171
n74 -->|depends_on| n167
n79 -->|depends_on| n159
n38 -->|publishes| n174
n76 -->|subscribes| n174
n178 -->|publishes| n174
n68 -->|controls| n65
n68 -->|depends_on| n174
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n159
n67 -->|depends_on| n174
n179 -->|publishes| n174
n50 -->|subscribes| n174
n65 -->|controls| n29
n65 -->|depends_on| n174
n64 -->|proposes_to| n29
n64 -->|controls| n65
n64 -->|depends_on| n174
n89 -->|publishes| n174
n86 -->|publishes| n174
n177 -->|depends_on| n171
n177 -->|depends_on| n180
n175 -->|depends_on| n159
n174 -->|depends_on| n167
n174 -->|publishes| n181
n154 -->|depends_on| n173
n176 -->|depends_on| n167
n173 -->|depends_on| n167
n167 -->|depends_on| n159
n181 -->|subscribes| n174
n181 -->|reads| n159
n71 -->|depends_on| n167
n71 -->|depends_on| n70
n182 -->|publishes| n174
n61 -->|publishes| n174
n183 -->|depends_on| n167
n129 -->|depends_on| n173
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n159,n167,n173,n174,n175,n176,n177,n154 internal;
class n70,n62,n131,n110,n75,n29,n72,n74,n79,n38,n76,n178,n68,n66,n67,n179,n50,n65,n64,n89,n86,n171,n180,n181,n71,n182,n61,n183,n129 external;
```

### Shared Infrastructure Plan

Source: `docs/architecture/graphs/system-sip.mmd`

```mermaid
flowchart LR
n184["Zone Store"]
n185["Structure Store"]
n186["Road Store"]
n187["Farm Store"]
n188["Container Registry"]
n189["Path Graph Store"]
n190["Rules Store"]
n191["SIP Revision Manager"]
n192["Spatial Overlap Validator"]
n193["Dependency Validator"]
n194["SIP Mutation Proposer"]
n157["SIP Transactional Committer"]
n163["SIP Reconciliation Engine"]
n195["Delta Sync Planner (Bot Registry and Profiles)"]
n168["Resume Orchestrator (Bot Registry and Profiles)"]
n92["Blueprint Validator (Building)"]
n110["Rollback Journal (Building)"]
n104["Work Package Partitioner (Building)"]
n196["Overlap Margin Checker (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n197["Compatibility Checker (Edit Grants and Collaboration)"]
n198["Design Revision Guard (Edit Grants and Collaboration)"]
n199["Collaboration Policy Evaluator (Edit Grants and Collaboration)"]
n147["SIP Dump (Ops and Observability)"]
n145["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n51["Keep Last Good Fallback (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n47["SIP Mutation Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n140["Protected BBox Rule (Autonomy and Safety)"]
n143["Safety Policy Engine (Autonomy and Safety)"]
n160["Transaction Manager (Memory and Persistence)"]
n200["Container Memory (World Model and Landmarks)"]
n201["Spatial Query Engine (World Model and Landmarks)"]
n202["World Reconciler (World Model and Landmarks)"]
n203["Plan Tagging (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n204["Follow Path (Skill Library)"]
n205["Harvest Farm (Skill Library)"]
n206["Plant Farm (Skill Library)"]
n195 -->|reads| n191
n168 -->|depends_on| n195
n168 -->|delegates_to| n163
n92 -->|depends_on| n190
n110 -->|reads| n185
n104 -->|reads| n185
n196 -->|depends_on| n192
n29 -->|controls| n157
n31 -->|delegates_to| n43
n31 -->|delegates_to| n163
n32 -->|depends_on| n168
n32 -->|depends_on| n160
n32 -->|depends_on| n163
n197 -->|depends_on| n190
n197 -->|depends_on| n185
n198 -->|reads| n191
n199 -->|depends_on| n185
n147 -->|depends_on| n191
n145 -->|reads| n191
n42 -->|reads| n191
n42 -->|reads| n201
n51 -->|reads| n191
n45 -->|depends_on| n193
n45 -->|reads| n190
n45 -->|reads| n201
n47 -->|proposes_to| n194
n43 -->|delegates_to| n42
n43 -->|reads| n191
n140 -->|reads| n190
n143 -->|depends_on| n140
n143 -->|reads| n190
n143 -->|reads| n201
n188 -->|depends_on| n160
n188 -->|depends_on| n200
n193 -->|depends_on| n188
n193 -->|depends_on| n187
n193 -->|depends_on| n189
n193 -->|depends_on| n186
n193 -->|depends_on| n185
n193 -->|reads| n201
n187 -->|depends_on| n160
n194 -->|depends_on| n193
n194 -->|depends_on| n191
n194 -->|depends_on| n192
n189 -->|depends_on| n160
n163 -->|depends_on| n187
n163 -->|depends_on| n186
n163 -->|depends_on| n185
n163 -->|depends_on| n157
n163 -->|depends_on| n202
n191 -->|publishes| n198
n191 -->|depends_on| n160
n191 -->|depends_on| n190
n191 -->|publishes| n203
n186 -->|depends_on| n160
n190 -->|depends_on| n160
n192 -->|reads| n190
n192 -->|depends_on| n185
n192 -->|depends_on| n184
n185 -->|depends_on| n160
n157 -->|depends_on| n160
n157 -->|writes| n188
n157 -->|writes| n187
n157 -->|writes| n189
n157 -->|depends_on| n191
n157 -->|writes| n186
n157 -->|writes| n190
n157 -->|writes| n185
n157 -->|writes| n184
n184 -->|depends_on| n160
n52 -->|reads| n191
n52 -->|reads| n201
n204 -->|depends_on| n189
n205 -->|depends_on| n187
n206 -->|depends_on| n187
n200 -->|reads| n188
n201 -->|reads| n189
n202 -->|depends_on| n201
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n184,n185,n186,n187,n188,n189,n190,n191,n192,n193,n194,n157,n163 internal;
class n195,n168,n92,n110,n104,n196,n29,n31,n32,n197,n198,n199,n147,n145,n42,n51,n45,n47,n43,n140,n143,n160,n200,n201,n202,n203,n52,n204,n205,n206 external;
```

### Task Board

Source: `docs/architecture/graphs/system-tasks.mmd`

```mermaid
flowchart LR
n207["Task Repository"]
n208["Task DAG Resolver"]
n209["Precondition Evaluator"]
n210["Priority Scheduler"]
n158["Atomic Task Claimer"]
n211["Job Offer Service"]
n212["Retry Manager"]
n213["Dead Letter Manager"]
n214["Task State Machine"]
n195["Delta Sync Planner (Bot Registry and Profiles)"]
n215["Claim Releaser (Claims and Leases)"]
n161["Lease Reaper (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n216["Contention Harness (Testing and Evaluation)"]
n145["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n48["Task DAG Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n160["Transaction Manager (Memory and Persistence)"]
n201["Spatial Query Engine (World Model and Landmarks)"]
n217["Bot Profile Store (Bot Registry and Profiles)"]
n218["Event Log Writer (Memory and Persistence)"]
n195 -->|depends_on| n217
n195 -->|reads| n207
n217 -->|depends_on| n160
n215 -->|depends_on| n214
n161 -->|depends_on| n214
n29 -->|controls| n158
n216 -->|depends_on| n207
n218 -->|depends_on| n160
n145 -->|reads| n207
n42 -->|reads| n217
n42 -->|reads| n207
n42 -->|reads| n201
n48 -->|proposes_to| n207
n43 -->|delegates_to| n42
n43 -->|reads| n213
n158 -->|depends_on| n160
n158 -->|depends_on| n210
n158 -->|writes| n207
n208 -->|depends_on| n207
n213 -->|writes| n207
n209 -->|depends_on| n207
n209 -->|reads| n201
n210 -->|reads| n217
n210 -->|depends_on| n208
n210 -->|depends_on| n209
n212 -->|writes| n207
n212 -->|depends_on| n214
n207 -->|depends_on| n160
n214 -->|depends_on| n218
n214 -->|writes| n207
n211 -->|depends_on| n210
n211 -->|delegates_to| n158
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n207,n208,n209,n210,n158,n211,n212,n213,n214 internal;
class n195,n215,n161,n29,n216,n145,n42,n48,n43,n160,n201,n217,n218 external;
```

### Claims and Leases

Source: `docs/architecture/graphs/system-claims.mmd`

```mermaid
flowchart LR
n219["Claim Repository"]
n196["Overlap Margin Checker"]
n155["Atomic Claim Acquirer"]
n220["Lease Heartbeat"]
n161["Lease Reaper"]
n153["Fencing Token Authority"]
n215["Claim Releaser"]
n183["Bot Claim Command Handler"]
n221["Contention Metrics"]
n168["Resume Orchestrator (Bot Registry and Profiles)"]
n160["Transaction Manager (Memory and Persistence)"]
n214["Task State Machine (Task Board)"]
n148["Metrics Registry (Ops and Observability)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n192["Spatial Overlap Validator (Shared Infrastructure Plan)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n216["Contention Harness (Testing and Evaluation)"]
n197["Compatibility Checker (Edit Grants and Collaboration)"]
n222["Grant Revoker (Edit Grants and Collaboration)"]
n145["Status Aggregator (Ops and Observability)"]
n141["Active Bot Support Rule (Autonomy and Safety)"]
n139["Claim Loss Evaluator (Autonomy and Safety)"]
n140["Protected BBox Rule (Autonomy and Safety)"]
n143["Safety Policy Engine (Autonomy and Safety)"]
n167["WebSocket Codec (Transport and Protocol)"]
n168 -->|delegates_to| n215
n155 -->|writes| n219
n155 -->|depends_on| n196
n155 -->|depends_on| n160
n215 -->|writes| n219
n215 -->|depends_on| n214
n219 -->|depends_on| n160
n221 -->|depends_on| n219
n221 -->|observes| n148
n153 -->|depends_on| n30
n153 -->|depends_on| n160
n220 -->|writes| n219
n161 -->|writes| n219
n161 -->|depends_on| n214
n196 -->|depends_on| n219
n196 -->|depends_on| n192
n29 -->|controls| n155
n30 -->|controls| n153
n30 -->|depends_on| n160
n31 -->|delegates_to| n161
n31 -->|depends_on| n30
n32 -->|depends_on| n168
n32 -->|delegates_to| n161
n32 -->|depends_on| n160
n216 -->|depends_on| n219
n197 -->|reads| n219
n222 -->|depends_on| n153
n145 -->|reads| n219
n145 -->|observes| n148
n141 -->|reads| n219
n139 -->|reads| n219
n140 -->|reads| n219
n143 -->|reads| n219
n143 -->|depends_on| n141
n143 -->|depends_on| n140
n183 -->|depends_on| n219
n183 -->|depends_on| n167
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n219,n196,n155,n220,n161,n153,n215,n183,n221 internal;
class n168,n160,n214,n148,n30,n192,n29,n31,n32,n216,n197,n222,n145,n141,n139,n140,n143,n167 external;
```

### Edit Grants and Collaboration

Source: `docs/architecture/graphs/system-grants.mmd`

```mermaid
flowchart LR
n223["Grant Repository"]
n199["Collaboration Policy Evaluator"]
n197["Compatibility Checker"]
n198["Design Revision Guard"]
n156["Grant Issuer"]
n222["Grant Revoker"]
n224["Owner Offline Policy"]
n169["Grant Expiry"]
n178["Arbitration Adapter"]
n195["Delta Sync Planner (Bot Registry and Profiles)"]
n29["Command Router (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n174["Event Stream (Transport and Protocol)"]
n219["Claim Repository (Claims and Leases)"]
n190["Rules Store (Shared Infrastructure Plan)"]
n185["Structure Store (Shared Infrastructure Plan)"]
n191["SIP Revision Manager (Shared Infrastructure Plan)"]
n160["Transaction Manager (Memory and Persistence)"]
n153["Fencing Token Authority (Claims and Leases)"]
n172["Presence Tracker (Bot Registry and Profiles)"]
n217["Bot Profile Store (Bot Registry and Profiles)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n195 -->|depends_on| n217
n195 -->|reads| n223
n195 -->|reads| n191
n172 -->|depends_on| n217
n217 -->|depends_on| n160
n219 -->|depends_on| n160
n153 -->|depends_on| n160
n29 -->|controls| n156
n32 -->|delegates_to| n169
n32 -->|depends_on| n160
n178 -->|depends_on| n197
n178 -->|publishes| n174
n197 -->|reads| n219
n197 -->|depends_on| n223
n197 -->|depends_on| n190
n197 -->|depends_on| n185
n198 -->|depends_on| n223
n198 -->|controls| n222
n198 -->|reads| n191
n169 -->|writes| n223
n156 -->|depends_on| n197
n156 -->|depends_on| n198
n156 -->|writes| n223
n156 -->|depends_on| n199
n223 -->|depends_on| n160
n222 -->|depends_on| n153
n222 -->|writes| n223
n224 -->|reads| n172
n224 -->|reads| n217
n224 -->|depends_on| n197
n199 -->|depends_on| n223
n199 -->|depends_on| n185
n50 -->|reads| n197
n50 -->|proposes_to| n156
n50 -->|subscribes| n174
n191 -->|publishes| n198
n191 -->|depends_on| n160
n191 -->|depends_on| n190
n190 -->|depends_on| n160
n185 -->|depends_on| n160
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n223,n199,n197,n198,n156,n222,n224,n169,n178 internal;
class n195,n29,n32,n174,n219,n190,n185,n191,n160,n153,n172,n217,n50 external;
```

### Bot Registry and Profiles

Source: `docs/architecture/graphs/system-bots.mmd`

```mermaid
flowchart LR
n171["Bot Identity Authenticator"]
n217["Bot Profile Store"]
n225["Role Manager"]
n226["Behavior Profile Manager"]
n227["Relationship Store"]
n172["Presence Tracker"]
n195["Delta Sync Planner"]
n168["Resume Orchestrator"]
n228["Agency State Store"]
n229["Name Pool Allocator"]
n70["Deterministic Policy (Brains)"]
n62["Reconnect Supervisor (Bot Runtime and Mineflayer Adapter)"]
n223["Grant Repository (Edit Grants and Collaboration)"]
n191["SIP Revision Manager (Shared Infrastructure Plan)"]
n207["Task Repository (Task Board)"]
n180["Secrets Loader (Config and Profiles)"]
n230["Name Pool Validator (Config and Profiles)"]
n160["Transaction Manager (Memory and Persistence)"]
n215["Claim Releaser (Claims and Leases)"]
n163["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n87["Skill Checkpoint Manager (Skill Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n74["Bot Session Manager (Coordinator Runtime)"]
n224["Owner Offline Policy (Edit Grants and Collaboration)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n145["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n210["Priority Scheduler (Task Board)"]
n177["Transport Authentication (Transport and Protocol)"]
n133["Agency State Adapter (Bot Runtime and Mineflayer Adapter)"]
n146["Agency Status View (Ops and Observability)"]
n231["Agency State (Agency)"]
n70 -->|reads| n226
n62 -->|delegates_to| n195
n226 -->|depends_on| n217
n195 -->|depends_on| n217
n195 -->|reads| n223
n195 -->|reads| n191
n195 -->|reads| n207
n171 -->|depends_on| n217
n171 -->|depends_on| n180
n229 -->|depends_on| n217
n229 -->|depends_on| n230
n172 -->|depends_on| n217
n217 -->|depends_on| n160
n227 -->|depends_on| n217
n168 -->|depends_on| n195
n168 -->|depends_on| n217
n168 -->|delegates_to| n215
n168 -->|delegates_to| n163
n168 -->|reads| n87
n225 -->|depends_on| n217
n32 -->|depends_on| n168
n32 -->|depends_on| n160
n32 -->|depends_on| n163
n74 -->|depends_on| n171
n74 -->|publishes| n172
n223 -->|depends_on| n160
n224 -->|reads| n172
n224 -->|reads| n217
n67 -->|depends_on| n172
n145 -->|depends_on| n172
n145 -->|reads| n191
n145 -->|reads| n207
n42 -->|reads| n217
n42 -->|reads| n191
n42 -->|reads| n207
n191 -->|depends_on| n160
n87 -->|depends_on| n160
n210 -->|reads| n217
n207 -->|depends_on| n160
n177 -->|depends_on| n171
n177 -->|depends_on| n180
n171 -->|writes| n217
n225 -->|writes| n217
n226 -->|writes| n217
n227 -->|writes| n217
n229 -->|writes| n217
n133 -->|persists_to| n228
n228 -->|depends_on| n160
n146 -->|reads| n228
n228 -->|depends_on| n231
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n171,n217,n225,n226,n227,n172,n195,n168,n228,n229 internal;
class n70,n62,n223,n191,n207,n180,n230,n160,n215,n163,n87,n32,n74,n224,n67,n145,n42,n210,n177,n133,n146,n231 external;
```

### World Model and Landmarks

Source: `docs/architecture/graphs/system-world.mmd`

```mermaid
flowchart LR
n181["Observation Ingestor"]
n232["Chunk Version Store"]
n233["Sparse Occupancy Grid"]
n234["Merge Conflict Resolver"]
n235["Confidence Decay"]
n236["Landmark Registry"]
n237["Detector Result Integrator"]
n203["Plan Tagging"]
n201["Spatial Query Engine"]
n200["Container Memory"]
n202["World Reconciler"]
n107["Block Verifier (Building)"]
n109["Container Refill Adapter (Building)"]
n108["Material Preflight (Building)"]
n106["Reachability and Scaffold Planner (Building)"]
n103["Schematic Diff (Building)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n141["Active Bot Support Rule (Autonomy and Safety)"]
n143["Safety Policy Engine (Autonomy and Safety)"]
n188["Container Registry (Shared Infrastructure Plan)"]
n193["Dependency Validator (Shared Infrastructure Plan)"]
n163["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n191["SIP Revision Manager (Shared Infrastructure Plan)"]
n52["Skill Context Builder (Skill Runtime)"]
n88["Skill Restore Validator (Skill Runtime)"]
n238["Deposit (Skill Library)"]
n239["Explore (Skill Library)"]
n240["Skill Shared Utilities (Skill Library)"]
n241["Withdraw (Skill Library)"]
n209["Precondition Evaluator (Task Board)"]
n174["Event Stream (Transport and Protocol)"]
n160["Transaction Manager (Memory and Persistence)"]
n159["Message Schema Registry (Transport and Protocol)"]
n189["Path Graph Store (Shared Infrastructure Plan)"]
n107 -->|reads| n201
n109 -->|writes| n200
n108 -->|reads| n52
n108 -->|reads| n200
n106 -->|reads| n201
n103 -->|reads| n201
n42 -->|reads| n191
n42 -->|reads| n201
n45 -->|depends_on| n193
n45 -->|reads| n201
n141 -->|reads| n201
n143 -->|depends_on| n141
n143 -->|reads| n201
n188 -->|depends_on| n160
n188 -->|depends_on| n200
n193 -->|depends_on| n188
n193 -->|depends_on| n189
n193 -->|reads| n201
n189 -->|depends_on| n160
n163 -->|depends_on| n202
n191 -->|depends_on| n160
n191 -->|publishes| n203
n52 -->|reads| n191
n52 -->|reads| n201
n88 -->|depends_on| n201
n238 -->|depends_on| n200
n239 -->|depends_on| n201
n240 -->|depends_on| n52
n240 -->|depends_on| n201
n241 -->|depends_on| n200
n209 -->|reads| n201
n174 -->|publishes| n181
n232 -->|depends_on| n160
n235 -->|depends_on| n232
n235 -->|writes| n236
n200 -->|reads| n188
n200 -->|depends_on| n236
n237 -->|writes| n236
n237 -->|depends_on| n234
n236 -->|depends_on| n160
n234 -->|writes| n232
n234 -->|depends_on| n235
n181 -->|subscribes| n174
n181 -->|reads| n159
n181 -->|writes| n232
n233 -->|depends_on| n232
n203 -->|depends_on| n236
n201 -->|reads| n189
n201 -->|depends_on| n236
n201 -->|depends_on| n233
n202 -->|depends_on| n236
n202 -->|depends_on| n201
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n181,n232,n233,n234,n235,n236,n237,n203,n201,n200,n202 internal;
class n107,n109,n108,n106,n103,n42,n45,n141,n143,n188,n193,n163,n191,n52,n88,n238,n239,n240,n241,n209,n174,n160,n159,n189 external;
```

### Perception

Source: `docs/architecture/graphs/system-perception.mmd`

```mermaid
flowchart LR
n242["Ring Sampler"]
n243["Chunk Snapshot Encoder"]
n182["Block Update Listener"]
n244["Path and Road Detector"]
n245["House Detector"]
n246["Farm Detector"]
n247["Storage and Workstation Detector"]
n248["Linear Structure Detector"]
n249["Detector Pipeline"]
n179["Landmark Candidate Emitter"]
n250["Perception Rate Limiter"]
n55["Mineflayer Event Bridge (Bot Runtime and Mineflayer Adapter)"]
n132["Perception Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n251["Detector Fixtures (Testing and Evaluation)"]
n174["Event Stream (Transport and Protocol)"]
n170["Profile Resolver (Config and Profiles)"]
n55 -->|delegates_to| n182
n132 -->|depends_on| n249
n132 -->|depends_on| n242
n56 -->|depends_on| n55
n56 -->|delegates_to| n242
n251 -->|depends_on| n249
n243 -->|depends_on| n242
n249 -->|depends_on| n243
n249 -->|depends_on| n246
n249 -->|depends_on| n245
n249 -->|depends_on| n248
n249 -->|depends_on| n244
n249 -->|depends_on| n247
n246 -->|depends_on| n243
n245 -->|depends_on| n243
n179 -->|depends_on| n249
n179 -->|publishes| n174
n248 -->|depends_on| n243
n244 -->|depends_on| n243
n250 -->|depends_on| n170
n242 -->|depends_on| n250
n247 -->|depends_on| n243
n182 -->|publishes| n174
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n242,n243,n182,n244,n245,n246,n247,n248,n249,n179,n250 internal;
class n55,n132,n56,n251,n174,n170 external;
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
n164["Config Schema Validator (Config and Profiles)"]
n159["Message Schema Registry (Transport and Protocol)"]
n252["Hardware Probe (Config and Profiles)"]
n149["Structured Logger (Ops and Observability)"]
n148["Metrics Registry (Ops and Observability)"]
n253["Laya Runtime Resolver (Config and Profiles)"]
n26(["ONNX Runtime / WebGPU Driver"])
n174["Event Stream (Transport and Protocol)"]
n170["Profile Resolver (Config and Profiles)"]
n254["Laya Benchmark Harness (Testing and Evaluation)"]
n150["Health and Readiness (Ops and Observability)"]
n255["Calibration Fitter (Laya Training)"]
n70 -->|subscribes| n174
n252 -->|depends_on| n170
n253 -->|depends_on| n252
n253 -->|depends_on| n170
n170 -->|depends_on| n164
n36 -->|depends_on| n78
n36 -->|depends_on| n34
n36 -->|depends_on| n76
n39 -->|proposes_to| n70
n39 -->|depends_on| n164
n39 -->|depends_on| n38
n79 -->|depends_on| n159
n78 -->|depends_on| n76
n35 -->|depends_on| n252
n35 -->|controls| n34
n35 -->|observes| n149
n80 -->|observes| n148
n80 -->|writes| n148
n34 -->|depends_on| n253
n34 -->|depends_on| n26
n38 -->|depends_on| n36
n38 -->|publishes| n174
n76 -->|subscribes| n174
n77 -->|depends_on| n170
n77 -->|depends_on| n76
n37 -->|controls| n36
n40 -->|controls| n38
n40 -->|depends_on| n76
n254 -->|depends_on| n80
n254 -->|depends_on| n34
n150 -->|depends_on| n34
n255 -->|reads| n39
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n34,n35,n76,n77,n78,n79,n36,n37,n38,n39,n40,n80 internal;
class n70,n164,n159,n252,n149,n148,n253,n174,n170,n254,n150,n255,n26 external;
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
n197["Compatibility Checker (Edit Grants and Collaboration)"]
n156["Grant Issuer (Edit Grants and Collaboration)"]
n174["Event Stream (Transport and Protocol)"]
n148["Metrics Registry (Ops and Observability)"]
n217["Bot Profile Store (Bot Registry and Profiles)"]
n191["SIP Revision Manager (Shared Infrastructure Plan)"]
n207["Task Repository (Task Board)"]
n201["Spatial Query Engine (World Model and Landmarks)"]
n164["Config Schema Validator (Config and Profiles)"]
n180["Secrets Loader (Config and Profiles)"]
n25(["Muse Spark Planner Endpoint"])
n160["Transaction Manager (Memory and Persistence)"]
n193["Dependency Validator (Shared Infrastructure Plan)"]
n190["Rules Store (Shared Infrastructure Plan)"]
n83["Skill Registry (Skill Runtime)"]
n194["SIP Mutation Proposer (Shared Infrastructure Plan)"]
n213["Dead Letter Manager (Task Board)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n217 -->|depends_on| n160
n31 -->|delegates_to| n43
n197 -->|depends_on| n190
n156 -->|depends_on| n197
n50 -->|reads| n197
n50 -->|proposes_to| n156
n50 -->|subscribes| n174
n49 -->|observes| n148
n49 -->|controls| n41
n42 -->|reads| n217
n42 -->|reads| n191
n42 -->|reads| n207
n42 -->|reads| n201
n51 -->|depends_on| n81
n51 -->|reads| n191
n41 -->|depends_on| n164
n41 -->|depends_on| n180
n41 -->|depends_on| n25
n41 -->|delegates_to| n50
n81 -->|depends_on| n160
n46 -->|controls| n51
n46 -->|depends_on| n41
n46 -->|depends_on| n44
n46 -->|depends_on| n45
n44 -->|controls| n46
n45 -->|controls| n46
n45 -->|depends_on| n44
n45 -->|depends_on| n193
n45 -->|reads| n190
n45 -->|reads| n83
n45 -->|reads| n201
n47 -->|depends_on| n46
n47 -->|proposes_to| n194
n48 -->|depends_on| n46
n48 -->|proposes_to| n207
n43 -->|observes| n148
n43 -->|delegates_to| n42
n43 -->|reads| n191
n43 -->|reads| n213
n64 -->|proposes_to| n43
n64 -->|depends_on| n174
n193 -->|reads| n201
n194 -->|depends_on| n193
n194 -->|depends_on| n191
n191 -->|depends_on| n160
n191 -->|depends_on| n190
n190 -->|depends_on| n160
n213 -->|writes| n207
n207 -->|depends_on| n160
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n41,n42,n43,n44,n45,n46,n47,n48,n49,n81,n50,n51 internal;
class n31,n197,n156,n174,n148,n217,n191,n207,n201,n164,n180,n160,n193,n190,n83,n194,n213,n64,n25 external;
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
n152["Affordance Enumerator (Brains)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n168["Resume Orchestrator (Bot Registry and Profiles)"]
n108["Material Preflight (Building)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n160["Transaction Manager (Memory and Persistence)"]
n191["SIP Revision Manager (Shared Infrastructure Plan)"]
n201["Spatial Query Engine (World Model and Landmarks)"]
n174["Event Stream (Transport and Protocol)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n148["Metrics Registry (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n256["Craft (Skill Library)"]
n257["Navigate (Skill Library)"]
n258["Place Build (Skill Library)"]
n240["Skill Shared Utilities (Skill Library)"]
n152 -->|depends_on| n56
n152 -->|depends_on| n69
n152 -->|depends_on| n83
n59 -->|depends_on| n84
n59 -->|depends_on| n85
n56 -->|delegates_to| n52
n168 -->|reads| n87
n108 -->|reads| n52
n45 -->|reads| n83
n45 -->|reads| n201
n63 -->|reads| n69
n69 -->|controls| n63
n191 -->|depends_on| n160
n87 -->|depends_on| n160
n52 -->|reads| n56
n52 -->|reads| n191
n52 -->|depends_on| n87
n52 -->|reads| n201
n89 -->|publishes| n174
n84 -->|depends_on| n52
n84 -->|depends_on| n89
n84 -->|depends_on| n82
n84 -->|depends_on| n83
n90 -->|reads| n63
n90 -->|depends_on| n84
n86 -->|observes| n148
n86 -->|publishes| n174
n88 -->|depends_on| n87
n88 -->|depends_on| n201
n83 -->|depends_on| n82
n85 -->|reads| n69
n85 -->|depends_on| n84
n256 -->|depends_on| n52
n257 -->|depends_on| n82
n258 -->|depends_on| n52
n240 -->|depends_on| n52
n240 -->|depends_on| n201
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n82,n83,n84,n85,n52,n86,n87,n88,n89,n90 internal;
class n152,n59,n56,n168,n108,n45,n160,n191,n201,n174,n63,n148,n69,n256,n257,n258,n240 external;
```

### Skill Library

Source: `docs/architecture/graphs/system-skills.mmd`

```mermaid
flowchart LR
n257["Navigate"]
n204["Follow Path"]
n259["Mine"]
n260["Collect"]
n256["Craft"]
n261["Smelt"]
n262["Eat"]
n238["Deposit"]
n241["Withdraw"]
n263["Sleep"]
n264["Flee or Defend"]
n239["Explore"]
n265["Bridge"]
n266["Clear"]
n258["Place Build"]
n267["Construction"]
n268["Schematic Build"]
n269["Repair"]
n205["Harvest Farm"]
n206["Plant Farm"]
n270["Entity Targeting"]
n271["Equip Gear"]
n272["Gather Food"]
n273["Gather Wool"]
n274["Place Bed"]
n275["Dig Shelter"]
n240["Skill Shared Utilities"]
n53["Block Executor (Building)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n52["Skill Context Builder (Skill Runtime)"]
n200["Container Memory (World Model and Landmarks)"]
n201["Spatial Query Engine (World Model and Landmarks)"]
n135["Mob Threat Evaluator (Autonomy and Safety)"]
n189["Path Graph Store (Shared Infrastructure Plan)"]
n187["Farm Store (Shared Infrastructure Plan)"]
n82["Skill Contract (Skill Runtime)"]
n103["Schematic Diff (Building)"]
n105["Build Order Planner (Building)"]
n104["Work Package Partitioner (Building)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n128["Building Execution Service (Bot Runtime and Mineflayer Adapter)"]
n123["Construction Plan Planner (Building)"]
n57 -->|depends_on| n63
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n105 -->|depends_on| n104
n103 -->|reads| n201
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n201
n265 -->|depends_on| n53
n265 -->|depends_on| n257
n266 -->|depends_on| n53
n266 -->|depends_on| n63
n260 -->|depends_on| n57
n260 -->|depends_on| n259
n260 -->|depends_on| n257
n256 -->|depends_on| n57
n256 -->|depends_on| n52
n238 -->|depends_on| n57
n238 -->|depends_on| n200
n262 -->|depends_on| n57
n239 -->|depends_on| n257
n239 -->|depends_on| n201
n264 -->|depends_on| n57
n264 -->|depends_on| n135
n264 -->|depends_on| n257
n204 -->|depends_on| n189
n204 -->|depends_on| n257
n205 -->|depends_on| n57
n205 -->|depends_on| n187
n205 -->|depends_on| n257
n259 -->|depends_on| n57
n259 -->|depends_on| n257
n257 -->|depends_on| n57
n257 -->|depends_on| n82
n258 -->|depends_on| n53
n258 -->|depends_on| n52
n206 -->|depends_on| n57
n206 -->|depends_on| n187
n206 -->|depends_on| n257
n269 -->|depends_on| n53
n269 -->|depends_on| n103
n268 -->|depends_on| n53
n268 -->|depends_on| n105
n268 -->|depends_on| n104
n240 -->|depends_on| n52
n240 -->|depends_on| n201
n263 -->|depends_on| n57
n263 -->|depends_on| n257
n261 -->|depends_on| n57
n261 -->|depends_on| n257
n241 -->|depends_on| n57
n241 -->|depends_on| n200
n201 -->|reads| n189
n270 -->|depends_on| n56
n271 -->|depends_on| n240
n271 -->|depends_on| n57
n272 -->|depends_on| n270
n272 -->|depends_on| n240
n272 -->|depends_on| n57
n272 -->|depends_on| n56
n273 -->|depends_on| n270
n273 -->|depends_on| n240
n273 -->|depends_on| n57
n273 -->|depends_on| n56
n274 -->|depends_on| n240
n274 -->|depends_on| n57
n275 -->|depends_on| n240
n275 -->|depends_on| n57
n267 -->|depends_on| n128
n267 -->|depends_on| n123
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n257,n204,n259,n260,n256,n261,n262,n238,n241,n263,n264,n239,n265,n266,n258,n267,n268,n269,n205,n206,n270,n271,n272,n273,n274,n275,n240 internal;
class n53,n63,n57,n52,n200,n201,n135,n189,n187,n82,n103,n105,n104,n56,n128,n123 external;
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
n111["Construction Plan Types"]
n112["Blueprint Document"]
n113["Seeded Random"]
n114["Style Palette"]
n115["Motif Library"]
n116["Blueprint Composer"]
n117["Observed Blueprint"]
n118["Blueprint Source Resolver"]
n119["Site Planner"]
n120["Foundation Planner"]
n121["Construction Dependency Graph"]
n122["Work Package Planner"]
n123["Construction Plan Planner"]
n124["Material Procurement Planner"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n201["Spatial Query Engine (World Model and Landmarks)"]
n190["Rules Store (Shared Infrastructure Plan)"]
n200["Container Memory (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n276["Block Changelog Writer (Memory and Persistence)"]
n185["Structure Store (Shared Infrastructure Plan)"]
n174["Event Stream (Transport and Protocol)"]
n265["Bridge (Skill Library)"]
n266["Clear (Skill Library)"]
n258["Place Build (Skill Library)"]
n269["Repair (Skill Library)"]
n268["Schematic Build (Skill Library)"]
n267["Construction (Skill Library)"]
n57 -->|depends_on| n63
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n107
n53 -->|depends_on| n110
n53 -->|depends_on| n63
n107 -->|depends_on| n91
n107 -->|reads| n201
n92 -->|depends_on| n91
n92 -->|depends_on| n190
n105 -->|depends_on| n91
n105 -->|depends_on| n104
n109 -->|depends_on| n57
n109 -->|writes| n200
n108 -->|depends_on| n91
n108 -->|reads| n52
n108 -->|reads| n200
n106 -->|reads| n56
n106 -->|depends_on| n105
n106 -->|reads| n201
n110 -->|writes| n276
n110 -->|reads| n185
n110 -->|subscribes| n174
n103 -->|depends_on| n91
n103 -->|reads| n201
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
n104 -->|reads| n185
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n201
n265 -->|depends_on| n53
n266 -->|depends_on| n53
n266 -->|depends_on| n63
n258 -->|depends_on| n53
n258 -->|depends_on| n52
n269 -->|depends_on| n53
n269 -->|depends_on| n103
n268 -->|depends_on| n53
n268 -->|depends_on| n105
n268 -->|depends_on| n104
n111 -->|depends_on| n91
n112 -->|depends_on| n91
n116 -->|depends_on| n112
n116 -->|depends_on| n113
n116 -->|depends_on| n114
n116 -->|depends_on| n115
n118 -->|depends_on| n116
n118 -->|depends_on| n117
n120 -->|depends_on| n119
n121 -->|depends_on| n111
n122 -->|depends_on| n111
n123 -->|depends_on| n120
n123 -->|depends_on| n121
n123 -->|depends_on| n122
n123 -->|depends_on| n124
n124 -->|depends_on| n108
n119 -->|depends_on| n111
n267 -->|depends_on| n123
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n91,n92,n93,n94,n95,n96,n97,n98,n99,n100,n101,n102,n103,n104,n105,n106,n107,n53,n108,n109,n110,n111,n112,n113,n114,n115,n116,n117,n118,n119,n120,n121,n122,n123,n124 internal;
class n57,n63,n201,n190,n200,n52,n56,n276,n185,n174,n265,n266,n258,n269,n268,n267 external;
```

### Bot Runtime and Mineflayer Adapter

Source: `docs/architecture/graphs/system-bot-runtime.mmd`

```mermaid
flowchart LR
n54["Connection Lifecycle"]
n125["Join and Auth"]
n55["Mineflayer Event Bridge"]
n56["World Cache Adapter"]
n126["Shelter Inspector"]
n127["Reach and Rate Guard"]
n57["Action Executor"]
n128["Building Execution Service"]
n129["Blueprint Fetch Client"]
n130["Construction Source"]
n131["State Digest Collector"]
n58["Guardian Hook"]
n59["Skill Host"]
n132["Perception Host"]
n60["Agent Loop"]
n61["Chat Adapter"]
n133["Agency State Adapter"]
n62["Reconnect Supervisor"]
n63["Action Veto Gate (Autonomy and Safety)"]
n152["Affordance Enumerator (Brains)"]
n164["Config Schema Validator (Config and Profiles)"]
n24(["Minecraft 1.20.1 LAN Server"])
n70["Deterministic Policy (Brains)"]
n182["Block Update Listener (Perception)"]
n69["Reflex Guardian Loop (Brains)"]
n170["Profile Resolver (Config and Profiles)"]
n249["Detector Pipeline (Perception)"]
n242["Ring Sampler (Perception)"]
n195["Delta Sync Planner (Bot Registry and Profiles)"]
n176["Reconnect Supervisor (Transport and Protocol)"]
n84["Skill Lifecycle Executor (Skill Runtime)"]
n85["Skill Tick Scheduler (Skill Runtime)"]
n174["Event Stream (Transport and Protocol)"]
n52["Skill Context Builder (Skill Runtime)"]
n53["Block Executor (Building)"]
n109["Container Refill Adapter (Building)"]
n106["Reachability and Scaffold Planner (Building)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n260["Collect (Skill Library)"]
n256["Craft (Skill Library)"]
n238["Deposit (Skill Library)"]
n262["Eat (Skill Library)"]
n264["Flee or Defend (Skill Library)"]
n205["Harvest Farm (Skill Library)"]
n259["Mine (Skill Library)"]
n257["Navigate (Skill Library)"]
n206["Plant Farm (Skill Library)"]
n263["Sleep (Skill Library)"]
n261["Smelt (Skill Library)"]
n241["Withdraw (Skill Library)"]
n33["Bot Process Supervisor (Coordinator Runtime)"]
n277["Goal Arbiter (Agency)"]
n278["Intention Manager (Agency)"]
n231["Agency State (Agency)"]
n71["Laya Client (Brains)"]
n279["Social Engine (Agency)"]
n228["Agency State Store (Bot Registry and Profiles)"]
n280["Agent Episode Repository (Memory and Persistence)"]
n270["Entity Targeting (Skill Library)"]
n271["Equip Gear (Skill Library)"]
n272["Gather Food (Skill Library)"]
n273["Gather Wool (Skill Library)"]
n274["Place Bed (Skill Library)"]
n275["Dig Shelter (Skill Library)"]
n267["Construction (Skill Library)"]
n173["Request Correlator (Transport and Protocol)"]
n57 -->|depends_on| n54
n57 -->|depends_on| n127
n57 -->|depends_on| n63
n152 -->|depends_on| n56
n152 -->|depends_on| n69
n54 -->|depends_on| n164
n54 -->|depends_on| n24
n70 -->|depends_on| n152
n70 -->|depends_on| n131
n70 -->|subscribes| n174
n55 -->|depends_on| n54
n55 -->|delegates_to| n182
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n125 -->|depends_on| n54
n125 -->|depends_on| n170
n132 -->|depends_on| n249
n132 -->|depends_on| n242
n127 -->|depends_on| n164
n62 -->|depends_on| n54
n62 -->|delegates_to| n195
n62 -->|depends_on| n176
n59 -->|depends_on| n84
n59 -->|depends_on| n85
n131 -->|depends_on| n54
n131 -->|depends_on| n56
n131 -->|publishes| n174
n56 -->|depends_on| n55
n56 -->|delegates_to| n242
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n109 -->|depends_on| n57
n106 -->|reads| n56
n170 -->|depends_on| n164
n67 -->|controls| n59
n67 -->|depends_on| n174
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n65 -->|controls| n57
n65 -->|depends_on| n174
n69 -->|controls| n63
n52 -->|reads| n56
n84 -->|depends_on| n52
n85 -->|reads| n69
n85 -->|depends_on| n84
n260 -->|depends_on| n57
n260 -->|depends_on| n259
n260 -->|depends_on| n257
n256 -->|depends_on| n57
n256 -->|depends_on| n52
n238 -->|depends_on| n57
n262 -->|depends_on| n57
n264 -->|depends_on| n57
n264 -->|depends_on| n257
n205 -->|depends_on| n57
n205 -->|depends_on| n257
n259 -->|depends_on| n57
n259 -->|depends_on| n257
n257 -->|depends_on| n57
n206 -->|depends_on| n57
n206 -->|depends_on| n257
n263 -->|depends_on| n57
n263 -->|depends_on| n257
n261 -->|depends_on| n57
n261 -->|depends_on| n257
n241 -->|depends_on| n57
n33 -->|controls| n54
n71 -->|depends_on| n152
n71 -->|depends_on| n70
n182 -->|publishes| n174
n60 -->|depends_on| n277
n60 -->|depends_on| n278
n60 -->|depends_on| n231
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n131
n60 -->|delegates_to| n59
n61 -->|depends_on| n279
n61 -->|publishes| n174
n133 -->|persists_to| n228
n60 -->|persists_to| n280
n278 -->|depends_on| n277
n231 -->|depends_on| n278
n279 -->|proposes_to| n61
n228 -->|depends_on| n231
n270 -->|depends_on| n56
n271 -->|depends_on| n57
n272 -->|depends_on| n270
n272 -->|depends_on| n57
n272 -->|depends_on| n56
n273 -->|depends_on| n270
n273 -->|depends_on| n57
n273 -->|depends_on| n56
n274 -->|depends_on| n57
n275 -->|depends_on| n57
n126 -->|depends_on| n56
n267 -->|depends_on| n128
n130 -->|depends_on| n129
n129 -->|depends_on| n173
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n54,n125,n55,n56,n126,n127,n57,n128,n129,n130,n131,n58,n59,n132,n60,n61,n133,n62 internal;
class n63,n152,n164,n70,n182,n69,n170,n249,n242,n195,n176,n84,n85,n174,n52,n53,n109,n106,n67,n65,n260,n256,n238,n262,n264,n205,n259,n257,n206,n263,n261,n241,n33,n277,n278,n231,n71,n279,n228,n280,n270,n271,n272,n273,n274,n275,n267,n173,n24 external;
```

### Autonomy and Safety

Source: `docs/architecture/graphs/system-safety.mmd`

```mermaid
flowchart LR
n134["Hazard Evaluator"]
n135["Mob Threat Evaluator"]
n136["Hunger Evaluator"]
n137["Stuck and Timeout Evaluator"]
n138["Inventory Evaluator"]
n139["Claim Loss Evaluator"]
n140["Protected BBox Rule"]
n141["Active Bot Support Rule"]
n142["Material Ban Rule"]
n143["Safety Policy Engine"]
n63["Action Veto Gate"]
n64["Recovery Ladder"]
n65["Emergency Stop Controller"]
n144["Incident Journal"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n53["Block Executor (Building)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n219["Claim Repository (Claims and Leases)"]
n201["Spatial Query Engine (World Model and Landmarks)"]
n29["Command Router (Coordinator Runtime)"]
n174["Event Stream (Transport and Protocol)"]
n218["Event Log Writer (Memory and Persistence)"]
n190["Rules Store (Shared Infrastructure Plan)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n90["Skill Preemption Handler (Skill Runtime)"]
n266["Clear (Skill Library)"]
n264["Flee or Defend (Skill Library)"]
n57 -->|depends_on| n63
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n68 -->|controls| n65
n68 -->|depends_on| n174
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n63 -->|depends_on| n143
n141 -->|reads| n219
n141 -->|reads| n201
n139 -->|reads| n219
n65 -->|controls| n57
n65 -->|controls| n29
n65 -->|depends_on| n174
n69 -->|controls| n63
n69 -->|depends_on| n139
n69 -->|depends_on| n134
n69 -->|depends_on| n136
n69 -->|depends_on| n138
n69 -->|depends_on| n135
n69 -->|depends_on| n137
n144 -->|writes| n218
n140 -->|reads| n219
n140 -->|reads| n190
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n64 -->|depends_on| n174
n143 -->|reads| n219
n143 -->|depends_on| n141
n143 -->|depends_on| n142
n143 -->|depends_on| n140
n143 -->|reads| n190
n143 -->|reads| n201
n90 -->|reads| n63
n266 -->|depends_on| n53
n266 -->|depends_on| n63
n264 -->|depends_on| n57
n264 -->|depends_on| n135
n68 -->|writes| n218
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n134,n135,n136,n137,n138,n139,n140,n141,n142,n143,n63,n64,n65,n144 internal;
class n57,n58,n53,n68,n69,n219,n201,n29,n174,n218,n190,n43,n90,n266,n264 external;
```

### Memory and Persistence

Source: `docs/architecture/graphs/system-memory.mmd`

```mermaid
flowchart LR
n281["SQLite Runtime"]
n166["Migration Runner"]
n160["Transaction Manager"]
n218["Event Log Writer"]
n276["Block Changelog Writer"]
n162["Retention Pruner"]
n282["Snapshot Export"]
n283["Schema Version Registry"]
n284["Episode Store"]
n280["Agent Episode Repository"]
n217["Bot Profile Store (Bot Registry and Profiles)"]
n110["Rollback Journal (Building)"]
n155["Atomic Claim Acquirer (Claims and Leases)"]
n219["Claim Repository (Claims and Leases)"]
n153["Fencing Token Authority (Claims and Leases)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n72["Process Bootstrap (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n285["Replay Engine (Testing and Evaluation)"]
n223["Grant Repository (Edit Grants and Collaboration)"]
n151["Audit Viewer (Ops and Observability)"]
n150["Health and Readiness (Ops and Observability)"]
n81["Plan Cache (Cloud Planner Advisor)"]
n144["Incident Journal (Autonomy and Safety)"]
n188["Container Registry (Shared Infrastructure Plan)"]
n187["Farm Store (Shared Infrastructure Plan)"]
n189["Path Graph Store (Shared Infrastructure Plan)"]
n191["SIP Revision Manager (Shared Infrastructure Plan)"]
n186["Road Store (Shared Infrastructure Plan)"]
n190["Rules Store (Shared Infrastructure Plan)"]
n185["Structure Store (Shared Infrastructure Plan)"]
n157["SIP Transactional Committer (Shared Infrastructure Plan)"]
n184["Zone Store (Shared Infrastructure Plan)"]
n87["Skill Checkpoint Manager (Skill Runtime)"]
n158["Atomic Task Claimer (Task Board)"]
n207["Task Repository (Task Board)"]
n214["Task State Machine (Task Board)"]
n286["Trace Exporter (Laya Training)"]
n232["Chunk Version Store (World Model and Landmarks)"]
n236["Landmark Registry (World Model and Landmarks)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n228["Agency State Store (Bot Registry and Profiles)"]
n146["Agency Status View (Ops and Observability)"]
n217 -->|depends_on| n160
n110 -->|writes| n276
n110 -->|reads| n185
n155 -->|writes| n219
n155 -->|depends_on| n160
n219 -->|depends_on| n160
n153 -->|depends_on| n30
n153 -->|depends_on| n160
n30 -->|controls| n153
n30 -->|depends_on| n160
n31 -->|depends_on| n30
n31 -->|delegates_to| n162
n72 -->|depends_on| n32
n72 -->|depends_on| n166
n32 -->|depends_on| n160
n285 -->|depends_on| n218
n223 -->|depends_on| n160
n276 -->|depends_on| n160
n218 -->|depends_on| n160
n166 -->|depends_on| n281
n162 -->|depends_on| n276
n162 -->|depends_on| n218
n162 -->|depends_on| n160
n283 -->|depends_on| n166
n282 -->|depends_on| n160
n160 -->|depends_on| n281
n151 -->|reads| n276
n151 -->|reads| n218
n150 -->|depends_on| n281
n81 -->|depends_on| n160
n144 -->|writes| n218
n188 -->|depends_on| n160
n187 -->|depends_on| n160
n189 -->|depends_on| n160
n191 -->|depends_on| n160
n191 -->|depends_on| n190
n186 -->|depends_on| n160
n190 -->|depends_on| n160
n185 -->|depends_on| n160
n157 -->|depends_on| n160
n157 -->|writes| n188
n157 -->|writes| n187
n157 -->|writes| n189
n157 -->|depends_on| n191
n157 -->|writes| n186
n157 -->|writes| n190
n157 -->|writes| n185
n157 -->|writes| n184
n184 -->|depends_on| n160
n87 -->|depends_on| n160
n158 -->|depends_on| n160
n158 -->|writes| n207
n207 -->|depends_on| n160
n214 -->|depends_on| n218
n214 -->|writes| n207
n286 -->|reads| n218
n232 -->|depends_on| n160
n236 -->|depends_on| n160
n285 -->|reads| n284
n286 -->|reads| n284
n151 -->|reads| n284
n162 -->|depends_on| n284
n67 -->|writes| n218
n68 -->|writes| n218
n60 -->|persists_to| n280
n228 -->|depends_on| n160
n280 -->|depends_on| n160
n146 -->|reads| n228
n146 -->|reads| n280
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n281,n166,n160,n218,n276,n162,n282,n283,n284,n280 internal;
class n217,n110,n155,n219,n153,n30,n31,n72,n32,n285,n223,n151,n150,n81,n144,n188,n187,n189,n191,n186,n190,n185,n157,n184,n87,n158,n207,n214,n286,n232,n236,n67,n68,n60,n228,n146 external;
```

### Ops and Observability

Source: `docs/architecture/graphs/system-ops.mmd`

```mermaid
flowchart LR
n66["Ops API"]
n145["Status Aggregator"]
n146["Agency Status View"]
n67["Pause and Resume Controller"]
n68["Fleet Emergency Stop"]
n147["SIP Dump"]
n148["Metrics Registry"]
n149["Structured Logger"]
n150["Health and Readiness"]
n151["Audit Viewer"]
n221["Contention Metrics (Claims and Leases)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n80["Latency Metrics (Laya Decision Service)"]
n287["Metrics Reporter (Testing and Evaluation)"]
n28(["Fleet Operator"])
n276["Block Changelog Writer (Memory and Persistence)"]
n218["Event Log Writer (Memory and Persistence)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n174["Event Stream (Transport and Protocol)"]
n34["Model Loader (Laya Decision Service)"]
n281["SQLite Runtime (Memory and Persistence)"]
n159["Message Schema Registry (Transport and Protocol)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n172["Presence Tracker (Bot Registry and Profiles)"]
n191["SIP Revision Manager (Shared Infrastructure Plan)"]
n219["Claim Repository (Claims and Leases)"]
n207["Task Repository (Task Board)"]
n49["Planner Budget Limiter (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n86["Skill Progress Reporter (Skill Runtime)"]
n284["Episode Store (Memory and Persistence)"]
n228["Agency State Store (Bot Registry and Profiles)"]
n280["Agent Episode Repository (Memory and Persistence)"]
n221 -->|depends_on| n219
n221 -->|observes| n148
n35 -->|controls| n34
n35 -->|observes| n149
n80 -->|observes| n148
n80 -->|writes| n148
n287 -->|observes| n148
n28 -->|controls| n66
n151 -->|reads| n276
n151 -->|reads| n218
n68 -->|controls| n65
n68 -->|depends_on| n174
n150 -->|depends_on| n34
n150 -->|depends_on| n281
n150 -->|depends_on| n145
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n145
n66 -->|depends_on| n159
n67 -->|controls| n59
n67 -->|depends_on| n172
n67 -->|depends_on| n174
n147 -->|depends_on| n191
n145 -->|depends_on| n172
n145 -->|reads| n219
n145 -->|observes| n148
n145 -->|reads| n191
n145 -->|reads| n207
n49 -->|observes| n148
n43 -->|observes| n148
n43 -->|reads| n191
n65 -->|depends_on| n174
n86 -->|observes| n148
n86 -->|publishes| n174
n151 -->|reads| n284
n67 -->|writes| n218
n68 -->|writes| n218
n146 -->|reads| n228
n146 -->|reads| n280
n66 -->|depends_on| n146
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n66,n145,n146,n67,n68,n147,n148,n149,n150,n151 internal;
class n221,n35,n80,n287,n276,n218,n65,n174,n34,n281,n159,n59,n172,n191,n219,n207,n49,n43,n86,n284,n228,n280,n28 external;
```

### Config and Profiles

Source: `docs/architecture/graphs/system-config.mmd`

```mermaid
flowchart LR
n165["Environment Parser"]
n164["Config Schema Validator"]
n170["Profile Resolver"]
n252["Hardware Probe"]
n180["Secrets Loader"]
n230["Name Pool Validator"]
n253["Laya Runtime Resolver"]
n288["Fail Fast Handler"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n125["Join and Auth (Bot Runtime and Mineflayer Adapter)"]
n127["Reach and Rate Guard (Bot Runtime and Mineflayer Adapter)"]
n171["Bot Identity Authenticator (Bot Registry and Profiles)"]
n229["Name Pool Allocator (Bot Registry and Profiles)"]
n27(["Host Hardware"])
n72["Process Bootstrap (Coordinator Runtime)"]
n73["Service Composition (Coordinator Runtime)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n77["Decision Rate Limiter (Laya Decision Service)"]
n250["Perception Rate Limiter (Perception)"]
n41["OpenAI-Compatible Client (Cloud Planner Advisor)"]
n177["Transport Authentication (Transport and Protocol)"]
n54 -->|depends_on| n164
n125 -->|depends_on| n54
n125 -->|depends_on| n170
n127 -->|depends_on| n164
n171 -->|depends_on| n180
n229 -->|depends_on| n230
n164 -->|depends_on| n165
n288 -->|depends_on| n164
n252 -->|depends_on| n170
n252 -->|depends_on| n27
n253 -->|depends_on| n252
n253 -->|depends_on| n170
n230 -->|depends_on| n164
n170 -->|depends_on| n164
n180 -->|depends_on| n165
n72 -->|depends_on| n164
n72 -->|depends_on| n165
n72 -->|depends_on| n73
n73 -->|depends_on| n170
n39 -->|depends_on| n164
n35 -->|depends_on| n252
n35 -->|controls| n34
n34 -->|depends_on| n253
n77 -->|depends_on| n170
n250 -->|depends_on| n170
n41 -->|depends_on| n164
n41 -->|depends_on| n180
n177 -->|depends_on| n171
n177 -->|depends_on| n180
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n165,n164,n170,n252,n180,n230,n253,n288 internal;
class n54,n125,n127,n171,n229,n72,n73,n39,n35,n34,n77,n250,n41,n177,n27 external;
```

### Testing and Evaluation

Source: `docs/architecture/graphs/system-eval.mmd`

```mermaid
flowchart LR
n289["Unit Fixtures"]
n251["Detector Fixtures"]
n290["Docker Server Harness"]
n291["Scenario Runner"]
n285["Replay Engine"]
n216["Contention Harness"]
n287["Metrics Reporter"]
n292["Soak Runner"]
n293["Architecture Guard Tests"]
n254["Laya Benchmark Harness"]
n219["Claim Repository (Claims and Leases)"]
n207["Task Repository (Task Board)"]
n249["Detector Pipeline (Perception)"]
n24(["Minecraft 1.20.1 LAN Server"])
n80["Latency Metrics (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n148["Metrics Registry (Ops and Observability)"]
n218["Event Log Writer (Memory and Persistence)"]
n294["Promotion Gate (Laya Training)"]
n284["Episode Store (Memory and Persistence)"]
n80 -->|observes| n148
n80 -->|writes| n148
n293 -->|depends_on| n289
n216 -->|depends_on| n219
n216 -->|delegates_to| n291
n216 -->|depends_on| n207
n251 -->|depends_on| n289
n251 -->|depends_on| n249
n290 -->|depends_on| n289
n290 -->|depends_on| n24
n254 -->|depends_on| n80
n254 -->|depends_on| n34
n254 -->|delegates_to| n291
n287 -->|observes| n148
n285 -->|depends_on| n291
n285 -->|depends_on| n218
n291 -->|controls| n290
n291 -->|publishes| n287
n292 -->|depends_on| n287
n292 -->|delegates_to| n291
n294 -->|depends_on| n254
n285 -->|reads| n284
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n289,n251,n290,n291,n285,n216,n287,n292,n293,n254 internal;
class n219,n207,n249,n80,n34,n148,n218,n294,n284,n24 external;
```

### Laya Training

Source: `docs/architecture/graphs/system-training.mmd`

```mermaid
flowchart LR
n286["Trace Exporter"]
n295["Labeling Pipeline"]
n296["Reward Computer"]
n297["Fine-tune Runner"]
n298["ONNX Exporter"]
n255["Calibration Fitter"]
n294["Promotion Gate"]
n39["Confidence Calibrator (Laya Decision Service)"]
n254["Laya Benchmark Harness (Testing and Evaluation)"]
n218["Event Log Writer (Memory and Persistence)"]
n284["Episode Store (Memory and Persistence)"]
n255 -->|reads| n39
n255 -->|depends_on| n286
n297 -->|depends_on| n295
n297 -->|depends_on| n296
n295 -->|depends_on| n286
n298 -->|depends_on| n297
n294 -->|depends_on| n254
n294 -->|depends_on| n255
n294 -->|depends_on| n298
n296 -->|depends_on| n286
n286 -->|reads| n218
n286 -->|reads| n284
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n286,n295,n296,n297,n298,n255,n294 internal;
class n39,n254,n218,n284 external;
```

### Brains

Source: `docs/architecture/graphs/system-brains.mmd`

```mermaid
flowchart LR
n69["Reflex Guardian Loop"]
n152["Affordance Enumerator"]
n70["Deterministic Policy"]
n71["Laya Client"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n83["Skill Registry (Skill Runtime)"]
n131["State Digest Collector (Bot Runtime and Mineflayer Adapter)"]
n226["Behavior Profile Manager (Bot Registry and Profiles)"]
n174["Event Stream (Transport and Protocol)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n139["Claim Loss Evaluator (Autonomy and Safety)"]
n134["Hazard Evaluator (Autonomy and Safety)"]
n136["Hunger Evaluator (Autonomy and Safety)"]
n138["Inventory Evaluator (Autonomy and Safety)"]
n135["Mob Threat Evaluator (Autonomy and Safety)"]
n137["Stuck and Timeout Evaluator (Autonomy and Safety)"]
n85["Skill Tick Scheduler (Skill Runtime)"]
n167["WebSocket Codec (Transport and Protocol)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n152 -->|depends_on| n56
n152 -->|depends_on| n69
n152 -->|depends_on| n83
n70 -->|depends_on| n152
n70 -->|depends_on| n131
n70 -->|reads| n226
n70 -->|subscribes| n174
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n131 -->|depends_on| n56
n131 -->|publishes| n174
n39 -->|proposes_to| n70
n63 -->|reads| n69
n69 -->|controls| n63
n69 -->|depends_on| n139
n69 -->|depends_on| n134
n69 -->|depends_on| n136
n69 -->|depends_on| n138
n69 -->|depends_on| n135
n69 -->|depends_on| n137
n85 -->|reads| n69
n174 -->|depends_on| n167
n71 -->|depends_on| n152
n71 -->|depends_on| n167
n71 -->|depends_on| n70
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n131
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n69,n152,n70,n71 internal;
class n56,n83,n131,n226,n174,n58,n39,n63,n139,n134,n136,n138,n135,n137,n85,n167,n60 external;
```

### Agency

Source: `docs/architecture/graphs/system-agency.mmd`

```mermaid
flowchart LR
n299["Personality Model"]
n300["Needs Model"]
n301["Goal Catalog"]
n302["Goal Generator"]
n277["Goal Arbiter"]
n278["Intention Manager"]
n303["Routine Model"]
n304["Item Knowledge"]
n305["Night Preparation Config"]
n306["Shelter Strategy"]
n307["Shelter Plan"]
n308["Night Readiness"]
n279["Social Engine"]
n309["Working Memory"]
n310["Project Focus Policy"]
n231["Agency State"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n228["Agency State Store (Bot Registry and Profiles)"]
n60 -->|depends_on| n277
n60 -->|depends_on| n278
n60 -->|depends_on| n231
n61 -->|depends_on| n279
n302 -->|depends_on| n301
n302 -->|depends_on| n300
n302 -->|depends_on| n299
n277 -->|depends_on| n302
n277 -->|depends_on| n300
n277 -->|depends_on| n299
n278 -->|depends_on| n277
n279 -->|depends_on| n299
n231 -->|depends_on| n300
n231 -->|depends_on| n299
n231 -->|depends_on| n278
n231 -->|depends_on| n303
n231 -->|depends_on| n309
n310 -->|depends_on| n309
n279 -->|proposes_to| n61
n228 -->|depends_on| n231
n308 -->|depends_on| n304
n308 -->|depends_on| n305
n308 -->|depends_on| n303
n308 -->|depends_on| n307
n308 -->|depends_on| n306
n306 -->|depends_on| n305
n302 -->|depends_on| n305
n302 -->|depends_on| n308
n302 -->|depends_on| n303
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n299,n300,n301,n302,n277,n278,n303,n304,n305,n306,n307,n308,n279,n309,n310,n231 internal;
class n60,n61,n228 external;
```

### Bootstrap and Toolchain

Source: `docs/architecture/graphs/system-toolchain.mmd`

```mermaid
flowchart LR
n311["Bootstrap Orchestrator"]
n312["Capability Check"]
n313["Python Environment"]
n314["Minecraft Server Controller"]
n315["Firefox SVG Renderer"]
n311 -->|depends_on| n312
n311 -->|depends_on| n313
n311 -->|depends_on| n314
n311 -->|depends_on| n315
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n311,n312,n313,n314,n315 internal;
```
