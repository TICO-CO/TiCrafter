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
n14 -->|depends_on×3, publishes×2| n1
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
n12 -->|depends_on×10| n13
n12 -->|depends_on×2| n15
n12 -->|depends_on×22| n14
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
n14 -->|depends_on×6| n22
n14 -->|persists_to×1| n16
n4 -->|depends_on×1| n1
n22 -->|proposes_to×1| n14
n6 -->|depends_on×1| n22
n21 -->|depends_on×1| n18
n19 -->|depends_on×1| n14
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
n14 -->|depends_on×3, publishes×2| n1
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
n12 -->|depends_on×10| n13
n12 -->|depends_on×2| n15
n12 -->|depends_on×22| n14
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
n14 -->|depends_on×6| n22
n14 -->|persists_to×1| n16
n4 -->|depends_on×1| n1
n22 -->|proposes_to×1| n14
n6 -->|depends_on×1| n22
n21 -->|depends_on×1| n18
n19 -->|depends_on×1| n14
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
n164["Fencing Token Authority (Claims and Leases)"]
n165["Flow Control (Transport and Protocol)"]
n166["Atomic Claim Acquirer (Claims and Leases)"]
n167["Grant Issuer (Edit Grants and Collaboration)"]
n168["SIP Transactional Committer (Shared Infrastructure Plan)"]
n169["Atomic Task Claimer (Task Board)"]
n170["Message Schema Registry (Transport and Protocol)"]
n171["Transaction Manager (Memory and Persistence)"]
n172["Lease Reaper (Claims and Leases)"]
n173["Retention Pruner (Memory and Persistence)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n174["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n175["Config Schema Validator (Config and Profiles)"]
n176["Environment Parser (Config and Profiles)"]
n177["Migration Runner (Memory and Persistence)"]
n178["WebSocket Codec (Transport and Protocol)"]
n179["Resume Orchestrator (Bot Registry and Profiles)"]
n180["Grant Expiry (Edit Grants and Collaboration)"]
n181["Profile Resolver (Config and Profiles)"]
n182["Bot Identity Authenticator (Bot Registry and Profiles)"]
n183["Presence Tracker (Bot Registry and Profiles)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n54 -->|depends_on| n175
n179 -->|delegates_to| n174
n166 -->|depends_on| n171
n164 -->|depends_on| n30
n164 -->|depends_on| n171
n175 -->|depends_on| n176
n181 -->|depends_on| n175
n75 -->|depends_on| n165
n29 -->|controls| n166
n29 -->|controls| n167
n29 -->|controls| n168
n29 -->|controls| n169
n29 -->|depends_on| n170
n30 -->|controls| n164
n30 -->|depends_on| n171
n31 -->|delegates_to| n172
n31 -->|depends_on| n30
n31 -->|delegates_to| n173
n31 -->|delegates_to| n43
n31 -->|delegates_to| n174
n72 -->|depends_on| n175
n72 -->|depends_on| n176
n72 -->|depends_on| n32
n72 -->|depends_on| n73
n72 -->|depends_on| n177
n72 -->|depends_on| n178
n32 -->|depends_on| n179
n32 -->|delegates_to| n172
n32 -->|delegates_to| n180
n32 -->|depends_on| n171
n32 -->|depends_on| n174
n73 -->|depends_on| n181
n73 -->|depends_on| n31
n74 -->|depends_on| n182
n74 -->|publishes| n183
n74 -->|depends_on| n178
n173 -->|depends_on| n171
n65 -->|controls| n29
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n174 -->|depends_on| n168
n168 -->|depends_on| n171
n169 -->|depends_on| n171
n178 -->|depends_on| n170
n33 -->|controls| n54
n33 -->|depends_on| n30
n32 -->|depends_on| n33
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n72,n73,n74,n29,n30,n31,n32,n75,n33 internal;
class n164,n165,n166,n167,n168,n169,n170,n171,n172,n173,n43,n174,n175,n176,n177,n178,n179,n180,n181,n182,n183,n65,n64,n54 external;
```

### Transport and Protocol

Source: `docs/architecture/graphs/system-transport.mmd`

```mermaid
flowchart LR
n170["Message Schema Registry"]
n178["WebSocket Codec"]
n184["Request Correlator"]
n185["Event Stream"]
n186["Delta Sync Protocol"]
n187["Reconnect Supervisor"]
n188["Transport Authentication"]
n165["Flow Control"]
n70["Deterministic Policy (Brains)"]
n62["Reconnect Supervisor (Bot Runtime and Mineflayer Adapter)"]
n139["State Digest Collector (Bot Runtime and Mineflayer Adapter)"]
n111["Rollback Journal (Building)"]
n75["Backpressure Controller (Coordinator Runtime)"]
n29["Command Router (Coordinator Runtime)"]
n72["Process Bootstrap (Coordinator Runtime)"]
n74["Bot Session Manager (Coordinator Runtime)"]
n79["Digest Assembler (Laya Decision Service)"]
n38["Output Parser (Laya Decision Service)"]
n76["Decision Queue (Laya Decision Service)"]
n189["Arbitration Adapter (Edit Grants and Collaboration)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n66["Ops API (Ops and Observability)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n190["Landmark Candidate Emitter (Perception)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n90["Typed Effects Emitter (Skill Runtime)"]
n87["Skill Progress Reporter (Skill Runtime)"]
n182["Bot Identity Authenticator (Bot Registry and Profiles)"]
n191["Secrets Loader (Config and Profiles)"]
n192["Observation Ingestor (World Model and Landmarks)"]
n71["Laya Client (Brains)"]
n193["Block Update Listener (Perception)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n194["Bot Claim Command Handler (Claims and Leases)"]
n133["Blueprint Fetch Client (Bot Runtime and Mineflayer Adapter)"]
n134["Construction Plan Fetch Client (Bot Runtime and Mineflayer Adapter)"]
n70 -->|depends_on| n139
n70 -->|subscribes| n185
n62 -->|depends_on| n187
n139 -->|publishes| n185
n182 -->|depends_on| n191
n111 -->|subscribes| n185
n75 -->|depends_on| n165
n29 -->|depends_on| n170
n72 -->|depends_on| n178
n74 -->|depends_on| n182
n74 -->|depends_on| n178
n79 -->|depends_on| n170
n38 -->|publishes| n185
n76 -->|subscribes| n185
n189 -->|publishes| n185
n68 -->|controls| n65
n68 -->|depends_on| n185
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n170
n67 -->|depends_on| n185
n190 -->|publishes| n185
n50 -->|subscribes| n185
n65 -->|controls| n29
n65 -->|depends_on| n185
n64 -->|proposes_to| n29
n64 -->|controls| n65
n64 -->|depends_on| n185
n90 -->|publishes| n185
n87 -->|publishes| n185
n188 -->|depends_on| n182
n188 -->|depends_on| n191
n186 -->|depends_on| n170
n185 -->|depends_on| n178
n185 -->|publishes| n192
n165 -->|depends_on| n184
n187 -->|depends_on| n178
n184 -->|depends_on| n178
n178 -->|depends_on| n170
n192 -->|subscribes| n185
n192 -->|reads| n170
n71 -->|depends_on| n178
n71 -->|depends_on| n70
n193 -->|publishes| n185
n61 -->|publishes| n185
n194 -->|depends_on| n178
n133 -->|depends_on| n184
n134 -->|depends_on| n184
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n170,n178,n184,n185,n186,n187,n188,n165 internal;
class n70,n62,n139,n111,n75,n29,n72,n74,n79,n38,n76,n189,n68,n66,n67,n190,n50,n65,n64,n90,n87,n182,n191,n192,n71,n193,n61,n194,n133,n134 external;
```

### Shared Infrastructure Plan

Source: `docs/architecture/graphs/system-sip.mmd`

```mermaid
flowchart LR
n195["Zone Store"]
n196["Structure Store"]
n197["Road Store"]
n198["Farm Store"]
n199["Container Registry"]
n200["Path Graph Store"]
n201["Rules Store"]
n202["SIP Revision Manager"]
n203["Spatial Overlap Validator"]
n204["Dependency Validator"]
n205["SIP Mutation Proposer"]
n168["SIP Transactional Committer"]
n174["SIP Reconciliation Engine"]
n206["Delta Sync Planner (Bot Registry and Profiles)"]
n179["Resume Orchestrator (Bot Registry and Profiles)"]
n93["Blueprint Validator (Building)"]
n111["Rollback Journal (Building)"]
n105["Work Package Partitioner (Building)"]
n207["Overlap Margin Checker (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n208["Compatibility Checker (Edit Grants and Collaboration)"]
n209["Design Revision Guard (Edit Grants and Collaboration)"]
n210["Collaboration Policy Evaluator (Edit Grants and Collaboration)"]
n157["SIP Dump (Ops and Observability)"]
n155["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n51["Keep Last Good Fallback (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n47["SIP Mutation Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n150["Protected BBox Rule (Autonomy and Safety)"]
n153["Safety Policy Engine (Autonomy and Safety)"]
n171["Transaction Manager (Memory and Persistence)"]
n211["Container Memory (World Model and Landmarks)"]
n212["Spatial Query Engine (World Model and Landmarks)"]
n213["World Reconciler (World Model and Landmarks)"]
n214["Plan Tagging (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n215["Follow Path (Skill Library)"]
n216["Harvest Farm (Skill Library)"]
n217["Plant Farm (Skill Library)"]
n206 -->|reads| n202
n179 -->|depends_on| n206
n179 -->|delegates_to| n174
n93 -->|depends_on| n201
n111 -->|reads| n196
n105 -->|reads| n196
n207 -->|depends_on| n203
n29 -->|controls| n168
n31 -->|delegates_to| n43
n31 -->|delegates_to| n174
n32 -->|depends_on| n179
n32 -->|depends_on| n171
n32 -->|depends_on| n174
n208 -->|depends_on| n201
n208 -->|depends_on| n196
n209 -->|reads| n202
n210 -->|depends_on| n196
n157 -->|depends_on| n202
n155 -->|reads| n202
n42 -->|reads| n202
n42 -->|reads| n212
n51 -->|reads| n202
n45 -->|depends_on| n204
n45 -->|reads| n201
n45 -->|reads| n212
n47 -->|proposes_to| n205
n43 -->|delegates_to| n42
n43 -->|reads| n202
n150 -->|reads| n201
n153 -->|depends_on| n150
n153 -->|reads| n201
n153 -->|reads| n212
n199 -->|depends_on| n171
n199 -->|depends_on| n211
n204 -->|depends_on| n199
n204 -->|depends_on| n198
n204 -->|depends_on| n200
n204 -->|depends_on| n197
n204 -->|depends_on| n196
n204 -->|reads| n212
n198 -->|depends_on| n171
n205 -->|depends_on| n204
n205 -->|depends_on| n202
n205 -->|depends_on| n203
n200 -->|depends_on| n171
n174 -->|depends_on| n198
n174 -->|depends_on| n197
n174 -->|depends_on| n196
n174 -->|depends_on| n168
n174 -->|depends_on| n213
n202 -->|publishes| n209
n202 -->|depends_on| n171
n202 -->|depends_on| n201
n202 -->|publishes| n214
n197 -->|depends_on| n171
n201 -->|depends_on| n171
n203 -->|reads| n201
n203 -->|depends_on| n196
n203 -->|depends_on| n195
n196 -->|depends_on| n171
n168 -->|depends_on| n171
n168 -->|writes| n199
n168 -->|writes| n198
n168 -->|writes| n200
n168 -->|depends_on| n202
n168 -->|writes| n197
n168 -->|writes| n201
n168 -->|writes| n196
n168 -->|writes| n195
n195 -->|depends_on| n171
n52 -->|reads| n202
n52 -->|reads| n212
n215 -->|depends_on| n200
n216 -->|depends_on| n198
n217 -->|depends_on| n198
n211 -->|reads| n199
n212 -->|reads| n200
n213 -->|depends_on| n212
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n195,n196,n197,n198,n199,n200,n201,n202,n203,n204,n205,n168,n174 internal;
class n206,n179,n93,n111,n105,n207,n29,n31,n32,n208,n209,n210,n157,n155,n42,n51,n45,n47,n43,n150,n153,n171,n211,n212,n213,n214,n52,n215,n216,n217 external;
```

### Task Board

Source: `docs/architecture/graphs/system-tasks.mmd`

```mermaid
flowchart LR
n218["Task Repository"]
n219["Task DAG Resolver"]
n220["Precondition Evaluator"]
n221["Priority Scheduler"]
n169["Atomic Task Claimer"]
n222["Job Offer Service"]
n223["Retry Manager"]
n224["Dead Letter Manager"]
n225["Task State Machine"]
n206["Delta Sync Planner (Bot Registry and Profiles)"]
n226["Claim Releaser (Claims and Leases)"]
n172["Lease Reaper (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n227["Contention Harness (Testing and Evaluation)"]
n155["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n48["Task DAG Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n171["Transaction Manager (Memory and Persistence)"]
n212["Spatial Query Engine (World Model and Landmarks)"]
n228["Bot Profile Store (Bot Registry and Profiles)"]
n229["Event Log Writer (Memory and Persistence)"]
n206 -->|depends_on| n228
n206 -->|reads| n218
n228 -->|depends_on| n171
n226 -->|depends_on| n225
n172 -->|depends_on| n225
n29 -->|controls| n169
n227 -->|depends_on| n218
n229 -->|depends_on| n171
n155 -->|reads| n218
n42 -->|reads| n228
n42 -->|reads| n218
n42 -->|reads| n212
n48 -->|proposes_to| n218
n43 -->|delegates_to| n42
n43 -->|reads| n224
n169 -->|depends_on| n171
n169 -->|depends_on| n221
n169 -->|writes| n218
n219 -->|depends_on| n218
n224 -->|writes| n218
n220 -->|depends_on| n218
n220 -->|reads| n212
n221 -->|reads| n228
n221 -->|depends_on| n219
n221 -->|depends_on| n220
n223 -->|writes| n218
n223 -->|depends_on| n225
n218 -->|depends_on| n171
n225 -->|depends_on| n229
n225 -->|writes| n218
n222 -->|depends_on| n221
n222 -->|delegates_to| n169
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n218,n219,n220,n221,n169,n222,n223,n224,n225 internal;
class n206,n226,n172,n29,n227,n155,n42,n48,n43,n171,n212,n228,n229 external;
```

### Claims and Leases

Source: `docs/architecture/graphs/system-claims.mmd`

```mermaid
flowchart LR
n230["Claim Repository"]
n207["Overlap Margin Checker"]
n166["Atomic Claim Acquirer"]
n231["Lease Heartbeat"]
n172["Lease Reaper"]
n164["Fencing Token Authority"]
n226["Claim Releaser"]
n194["Bot Claim Command Handler"]
n232["Contention Metrics"]
n179["Resume Orchestrator (Bot Registry and Profiles)"]
n171["Transaction Manager (Memory and Persistence)"]
n225["Task State Machine (Task Board)"]
n158["Metrics Registry (Ops and Observability)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n203["Spatial Overlap Validator (Shared Infrastructure Plan)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n227["Contention Harness (Testing and Evaluation)"]
n208["Compatibility Checker (Edit Grants and Collaboration)"]
n233["Grant Revoker (Edit Grants and Collaboration)"]
n155["Status Aggregator (Ops and Observability)"]
n151["Active Bot Support Rule (Autonomy and Safety)"]
n149["Claim Loss Evaluator (Autonomy and Safety)"]
n150["Protected BBox Rule (Autonomy and Safety)"]
n153["Safety Policy Engine (Autonomy and Safety)"]
n178["WebSocket Codec (Transport and Protocol)"]
n179 -->|delegates_to| n226
n166 -->|writes| n230
n166 -->|depends_on| n207
n166 -->|depends_on| n171
n226 -->|writes| n230
n226 -->|depends_on| n225
n230 -->|depends_on| n171
n232 -->|depends_on| n230
n232 -->|observes| n158
n164 -->|depends_on| n30
n164 -->|depends_on| n171
n231 -->|writes| n230
n172 -->|writes| n230
n172 -->|depends_on| n225
n207 -->|depends_on| n230
n207 -->|depends_on| n203
n29 -->|controls| n166
n30 -->|controls| n164
n30 -->|depends_on| n171
n31 -->|delegates_to| n172
n31 -->|depends_on| n30
n32 -->|depends_on| n179
n32 -->|delegates_to| n172
n32 -->|depends_on| n171
n227 -->|depends_on| n230
n208 -->|reads| n230
n233 -->|depends_on| n164
n155 -->|reads| n230
n155 -->|observes| n158
n151 -->|reads| n230
n149 -->|reads| n230
n150 -->|reads| n230
n153 -->|reads| n230
n153 -->|depends_on| n151
n153 -->|depends_on| n150
n194 -->|depends_on| n230
n194 -->|depends_on| n178
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n230,n207,n166,n231,n172,n164,n226,n194,n232 internal;
class n179,n171,n225,n158,n30,n203,n29,n31,n32,n227,n208,n233,n155,n151,n149,n150,n153,n178 external;
```

### Edit Grants and Collaboration

Source: `docs/architecture/graphs/system-grants.mmd`

```mermaid
flowchart LR
n234["Grant Repository"]
n210["Collaboration Policy Evaluator"]
n208["Compatibility Checker"]
n209["Design Revision Guard"]
n167["Grant Issuer"]
n233["Grant Revoker"]
n235["Owner Offline Policy"]
n180["Grant Expiry"]
n189["Arbitration Adapter"]
n206["Delta Sync Planner (Bot Registry and Profiles)"]
n29["Command Router (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n185["Event Stream (Transport and Protocol)"]
n230["Claim Repository (Claims and Leases)"]
n201["Rules Store (Shared Infrastructure Plan)"]
n196["Structure Store (Shared Infrastructure Plan)"]
n202["SIP Revision Manager (Shared Infrastructure Plan)"]
n171["Transaction Manager (Memory and Persistence)"]
n164["Fencing Token Authority (Claims and Leases)"]
n183["Presence Tracker (Bot Registry and Profiles)"]
n228["Bot Profile Store (Bot Registry and Profiles)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n206 -->|depends_on| n228
n206 -->|reads| n234
n206 -->|reads| n202
n183 -->|depends_on| n228
n228 -->|depends_on| n171
n230 -->|depends_on| n171
n164 -->|depends_on| n171
n29 -->|controls| n167
n32 -->|delegates_to| n180
n32 -->|depends_on| n171
n189 -->|depends_on| n208
n189 -->|publishes| n185
n208 -->|reads| n230
n208 -->|depends_on| n234
n208 -->|depends_on| n201
n208 -->|depends_on| n196
n209 -->|depends_on| n234
n209 -->|controls| n233
n209 -->|reads| n202
n180 -->|writes| n234
n167 -->|depends_on| n208
n167 -->|depends_on| n209
n167 -->|writes| n234
n167 -->|depends_on| n210
n234 -->|depends_on| n171
n233 -->|depends_on| n164
n233 -->|writes| n234
n235 -->|reads| n183
n235 -->|reads| n228
n235 -->|depends_on| n208
n210 -->|depends_on| n234
n210 -->|depends_on| n196
n50 -->|reads| n208
n50 -->|proposes_to| n167
n50 -->|subscribes| n185
n202 -->|publishes| n209
n202 -->|depends_on| n171
n202 -->|depends_on| n201
n201 -->|depends_on| n171
n196 -->|depends_on| n171
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n234,n210,n208,n209,n167,n233,n235,n180,n189 internal;
class n206,n29,n32,n185,n230,n201,n196,n202,n171,n164,n183,n228,n50 external;
```

### Bot Registry and Profiles

Source: `docs/architecture/graphs/system-bots.mmd`

```mermaid
flowchart LR
n182["Bot Identity Authenticator"]
n228["Bot Profile Store"]
n236["Role Manager"]
n237["Behavior Profile Manager"]
n238["Relationship Store"]
n183["Presence Tracker"]
n206["Delta Sync Planner"]
n179["Resume Orchestrator"]
n239["Agency State Store"]
n240["Name Pool Allocator"]
n70["Deterministic Policy (Brains)"]
n62["Reconnect Supervisor (Bot Runtime and Mineflayer Adapter)"]
n234["Grant Repository (Edit Grants and Collaboration)"]
n202["SIP Revision Manager (Shared Infrastructure Plan)"]
n218["Task Repository (Task Board)"]
n191["Secrets Loader (Config and Profiles)"]
n241["Name Pool Validator (Config and Profiles)"]
n171["Transaction Manager (Memory and Persistence)"]
n226["Claim Releaser (Claims and Leases)"]
n174["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n88["Skill Checkpoint Manager (Skill Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n74["Bot Session Manager (Coordinator Runtime)"]
n235["Owner Offline Policy (Edit Grants and Collaboration)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n155["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n221["Priority Scheduler (Task Board)"]
n188["Transport Authentication (Transport and Protocol)"]
n142["Agency State Adapter (Bot Runtime and Mineflayer Adapter)"]
n156["Agency Status View (Ops and Observability)"]
n242["Agency State (Agency)"]
n70 -->|reads| n237
n62 -->|delegates_to| n206
n237 -->|depends_on| n228
n206 -->|depends_on| n228
n206 -->|reads| n234
n206 -->|reads| n202
n206 -->|reads| n218
n182 -->|depends_on| n228
n182 -->|depends_on| n191
n240 -->|depends_on| n228
n240 -->|depends_on| n241
n183 -->|depends_on| n228
n228 -->|depends_on| n171
n238 -->|depends_on| n228
n179 -->|depends_on| n206
n179 -->|depends_on| n228
n179 -->|delegates_to| n226
n179 -->|delegates_to| n174
n179 -->|reads| n88
n236 -->|depends_on| n228
n32 -->|depends_on| n179
n32 -->|depends_on| n171
n32 -->|depends_on| n174
n74 -->|depends_on| n182
n74 -->|publishes| n183
n234 -->|depends_on| n171
n235 -->|reads| n183
n235 -->|reads| n228
n67 -->|depends_on| n183
n155 -->|depends_on| n183
n155 -->|reads| n202
n155 -->|reads| n218
n42 -->|reads| n228
n42 -->|reads| n202
n42 -->|reads| n218
n202 -->|depends_on| n171
n88 -->|depends_on| n171
n221 -->|reads| n228
n218 -->|depends_on| n171
n188 -->|depends_on| n182
n188 -->|depends_on| n191
n182 -->|writes| n228
n236 -->|writes| n228
n237 -->|writes| n228
n238 -->|writes| n228
n240 -->|writes| n228
n142 -->|persists_to| n239
n239 -->|depends_on| n171
n156 -->|reads| n239
n239 -->|depends_on| n242
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n182,n228,n236,n237,n238,n183,n206,n179,n239,n240 internal;
class n70,n62,n234,n202,n218,n191,n241,n171,n226,n174,n88,n32,n74,n235,n67,n155,n42,n221,n188,n142,n156,n242 external;
```

### World Model and Landmarks

Source: `docs/architecture/graphs/system-world.mmd`

```mermaid
flowchart LR
n192["Observation Ingestor"]
n243["Chunk Version Store"]
n244["Sparse Occupancy Grid"]
n245["Merge Conflict Resolver"]
n246["Confidence Decay"]
n247["Landmark Registry"]
n248["Detector Result Integrator"]
n214["Plan Tagging"]
n212["Spatial Query Engine"]
n211["Container Memory"]
n213["World Reconciler"]
n108["Block Verifier (Building)"]
n110["Container Refill Adapter (Building)"]
n109["Material Preflight (Building)"]
n107["Reachability and Scaffold Planner (Building)"]
n104["Schematic Diff (Building)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n151["Active Bot Support Rule (Autonomy and Safety)"]
n153["Safety Policy Engine (Autonomy and Safety)"]
n199["Container Registry (Shared Infrastructure Plan)"]
n204["Dependency Validator (Shared Infrastructure Plan)"]
n174["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n202["SIP Revision Manager (Shared Infrastructure Plan)"]
n52["Skill Context Builder (Skill Runtime)"]
n89["Skill Restore Validator (Skill Runtime)"]
n249["Deposit (Skill Library)"]
n250["Explore (Skill Library)"]
n251["Skill Shared Utilities (Skill Library)"]
n252["Withdraw (Skill Library)"]
n220["Precondition Evaluator (Task Board)"]
n185["Event Stream (Transport and Protocol)"]
n171["Transaction Manager (Memory and Persistence)"]
n170["Message Schema Registry (Transport and Protocol)"]
n200["Path Graph Store (Shared Infrastructure Plan)"]
n108 -->|reads| n212
n110 -->|writes| n211
n109 -->|reads| n52
n109 -->|reads| n211
n107 -->|reads| n212
n104 -->|reads| n212
n42 -->|reads| n202
n42 -->|reads| n212
n45 -->|depends_on| n204
n45 -->|reads| n212
n151 -->|reads| n212
n153 -->|depends_on| n151
n153 -->|reads| n212
n199 -->|depends_on| n171
n199 -->|depends_on| n211
n204 -->|depends_on| n199
n204 -->|depends_on| n200
n204 -->|reads| n212
n200 -->|depends_on| n171
n174 -->|depends_on| n213
n202 -->|depends_on| n171
n202 -->|publishes| n214
n52 -->|reads| n202
n52 -->|reads| n212
n89 -->|depends_on| n212
n249 -->|depends_on| n211
n250 -->|depends_on| n212
n251 -->|depends_on| n52
n251 -->|depends_on| n212
n252 -->|depends_on| n211
n220 -->|reads| n212
n185 -->|publishes| n192
n243 -->|depends_on| n171
n246 -->|depends_on| n243
n246 -->|writes| n247
n211 -->|reads| n199
n211 -->|depends_on| n247
n248 -->|writes| n247
n248 -->|depends_on| n245
n247 -->|depends_on| n171
n245 -->|writes| n243
n245 -->|depends_on| n246
n192 -->|subscribes| n185
n192 -->|reads| n170
n192 -->|writes| n243
n244 -->|depends_on| n243
n214 -->|depends_on| n247
n212 -->|reads| n200
n212 -->|depends_on| n247
n212 -->|depends_on| n244
n213 -->|depends_on| n247
n213 -->|depends_on| n212
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n192,n243,n244,n245,n246,n247,n248,n214,n212,n211,n213 internal;
class n108,n110,n109,n107,n104,n42,n45,n151,n153,n199,n204,n174,n202,n52,n89,n249,n250,n251,n252,n220,n185,n171,n170,n200 external;
```

### Perception

Source: `docs/architecture/graphs/system-perception.mmd`

```mermaid
flowchart LR
n253["Ring Sampler"]
n254["Chunk Snapshot Encoder"]
n193["Block Update Listener"]
n255["Path and Road Detector"]
n256["House Detector"]
n257["Farm Detector"]
n258["Storage and Workstation Detector"]
n259["Linear Structure Detector"]
n260["Detector Pipeline"]
n190["Landmark Candidate Emitter"]
n261["Perception Rate Limiter"]
n55["Mineflayer Event Bridge (Bot Runtime and Mineflayer Adapter)"]
n140["Perception Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n262["Detector Fixtures (Testing and Evaluation)"]
n185["Event Stream (Transport and Protocol)"]
n181["Profile Resolver (Config and Profiles)"]
n55 -->|delegates_to| n193
n140 -->|depends_on| n260
n140 -->|depends_on| n253
n56 -->|depends_on| n55
n56 -->|delegates_to| n253
n262 -->|depends_on| n260
n254 -->|depends_on| n253
n260 -->|depends_on| n254
n260 -->|depends_on| n257
n260 -->|depends_on| n256
n260 -->|depends_on| n259
n260 -->|depends_on| n255
n260 -->|depends_on| n258
n257 -->|depends_on| n254
n256 -->|depends_on| n254
n190 -->|depends_on| n260
n190 -->|publishes| n185
n259 -->|depends_on| n254
n255 -->|depends_on| n254
n261 -->|depends_on| n181
n253 -->|depends_on| n261
n258 -->|depends_on| n254
n193 -->|publishes| n185
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n253,n254,n193,n255,n256,n257,n258,n259,n260,n190,n261 internal;
class n55,n140,n56,n262,n185,n181 external;
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
n175["Config Schema Validator (Config and Profiles)"]
n170["Message Schema Registry (Transport and Protocol)"]
n263["Hardware Probe (Config and Profiles)"]
n159["Structured Logger (Ops and Observability)"]
n158["Metrics Registry (Ops and Observability)"]
n264["Laya Runtime Resolver (Config and Profiles)"]
n26(["ONNX Runtime / WebGPU Driver"])
n185["Event Stream (Transport and Protocol)"]
n181["Profile Resolver (Config and Profiles)"]
n265["Laya Benchmark Harness (Testing and Evaluation)"]
n160["Health and Readiness (Ops and Observability)"]
n266["Calibration Fitter (Laya Training)"]
n70 -->|subscribes| n185
n263 -->|depends_on| n181
n264 -->|depends_on| n263
n264 -->|depends_on| n181
n181 -->|depends_on| n175
n36 -->|depends_on| n78
n36 -->|depends_on| n34
n36 -->|depends_on| n76
n39 -->|proposes_to| n70
n39 -->|depends_on| n175
n39 -->|depends_on| n38
n79 -->|depends_on| n170
n78 -->|depends_on| n76
n35 -->|depends_on| n263
n35 -->|controls| n34
n35 -->|observes| n159
n80 -->|observes| n158
n80 -->|writes| n158
n34 -->|depends_on| n264
n34 -->|depends_on| n26
n38 -->|depends_on| n36
n38 -->|publishes| n185
n76 -->|subscribes| n185
n77 -->|depends_on| n181
n77 -->|depends_on| n76
n37 -->|controls| n36
n40 -->|controls| n38
n40 -->|depends_on| n76
n265 -->|depends_on| n80
n265 -->|depends_on| n34
n160 -->|depends_on| n34
n266 -->|reads| n39
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n34,n35,n76,n77,n78,n79,n36,n37,n38,n39,n40,n80 internal;
class n70,n175,n170,n263,n159,n158,n264,n185,n181,n265,n160,n266,n26 external;
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
n82["Strategic Intent Store"]
n31["Global Scheduler (Coordinator Runtime)"]
n208["Compatibility Checker (Edit Grants and Collaboration)"]
n167["Grant Issuer (Edit Grants and Collaboration)"]
n185["Event Stream (Transport and Protocol)"]
n158["Metrics Registry (Ops and Observability)"]
n228["Bot Profile Store (Bot Registry and Profiles)"]
n202["SIP Revision Manager (Shared Infrastructure Plan)"]
n218["Task Repository (Task Board)"]
n212["Spatial Query Engine (World Model and Landmarks)"]
n175["Config Schema Validator (Config and Profiles)"]
n191["Secrets Loader (Config and Profiles)"]
n25(["Muse Spark Planner Endpoint"])
n171["Transaction Manager (Memory and Persistence)"]
n204["Dependency Validator (Shared Infrastructure Plan)"]
n201["Rules Store (Shared Infrastructure Plan)"]
n84["Skill Registry (Skill Runtime)"]
n205["SIP Mutation Proposer (Shared Infrastructure Plan)"]
n224["Dead Letter Manager (Task Board)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n228 -->|depends_on| n171
n31 -->|delegates_to| n43
n208 -->|depends_on| n201
n167 -->|depends_on| n208
n50 -->|reads| n208
n50 -->|proposes_to| n167
n50 -->|subscribes| n185
n49 -->|observes| n158
n49 -->|controls| n41
n42 -->|reads| n228
n42 -->|reads| n202
n42 -->|reads| n218
n42 -->|reads| n212
n51 -->|depends_on| n81
n51 -->|reads| n202
n41 -->|depends_on| n175
n41 -->|depends_on| n191
n41 -->|depends_on| n25
n41 -->|delegates_to| n50
n81 -->|depends_on| n171
n46 -->|controls| n51
n46 -->|depends_on| n41
n46 -->|depends_on| n44
n46 -->|depends_on| n45
n44 -->|controls| n46
n45 -->|controls| n46
n45 -->|depends_on| n44
n45 -->|depends_on| n204
n45 -->|reads| n201
n45 -->|reads| n84
n45 -->|reads| n212
n47 -->|depends_on| n46
n47 -->|proposes_to| n205
n48 -->|depends_on| n46
n48 -->|proposes_to| n218
n43 -->|observes| n158
n43 -->|delegates_to| n42
n43 -->|reads| n202
n43 -->|reads| n224
n64 -->|proposes_to| n43
n64 -->|depends_on| n185
n204 -->|reads| n212
n205 -->|depends_on| n204
n205 -->|depends_on| n202
n202 -->|depends_on| n171
n202 -->|depends_on| n201
n201 -->|depends_on| n171
n224 -->|writes| n218
n218 -->|depends_on| n171
n82 -->|depends_on| n81
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n41,n42,n43,n44,n45,n46,n47,n48,n49,n81,n50,n51,n82 internal;
class n31,n208,n167,n185,n158,n228,n202,n218,n212,n175,n191,n171,n204,n201,n84,n205,n224,n64,n25 external;
```

### Skill Runtime

Source: `docs/architecture/graphs/system-skill-runtime.mmd`

```mermaid
flowchart LR
n83["Skill Contract"]
n84["Skill Registry"]
n85["Skill Lifecycle Executor"]
n86["Skill Tick Scheduler"]
n52["Skill Context Builder"]
n87["Skill Progress Reporter"]
n88["Skill Checkpoint Manager"]
n89["Skill Restore Validator"]
n90["Typed Effects Emitter"]
n91["Skill Preemption Handler"]
n162["Affordance Enumerator (Brains)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n179["Resume Orchestrator (Bot Registry and Profiles)"]
n109["Material Preflight (Building)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n171["Transaction Manager (Memory and Persistence)"]
n202["SIP Revision Manager (Shared Infrastructure Plan)"]
n212["Spatial Query Engine (World Model and Landmarks)"]
n185["Event Stream (Transport and Protocol)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n158["Metrics Registry (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n267["Craft (Skill Library)"]
n268["Navigate (Skill Library)"]
n269["Place Build (Skill Library)"]
n251["Skill Shared Utilities (Skill Library)"]
n162 -->|depends_on| n56
n162 -->|depends_on| n69
n162 -->|depends_on| n84
n59 -->|depends_on| n85
n59 -->|depends_on| n86
n56 -->|delegates_to| n52
n179 -->|reads| n88
n109 -->|reads| n52
n45 -->|reads| n84
n45 -->|reads| n212
n63 -->|reads| n69
n69 -->|controls| n63
n202 -->|depends_on| n171
n88 -->|depends_on| n171
n52 -->|reads| n56
n52 -->|reads| n202
n52 -->|depends_on| n88
n52 -->|reads| n212
n90 -->|publishes| n185
n85 -->|depends_on| n52
n85 -->|depends_on| n90
n85 -->|depends_on| n83
n85 -->|depends_on| n84
n91 -->|reads| n63
n91 -->|depends_on| n85
n87 -->|observes| n158
n87 -->|publishes| n185
n89 -->|depends_on| n88
n89 -->|depends_on| n212
n84 -->|depends_on| n83
n86 -->|reads| n69
n86 -->|depends_on| n85
n267 -->|depends_on| n52
n268 -->|depends_on| n83
n269 -->|depends_on| n52
n251 -->|depends_on| n52
n251 -->|depends_on| n212
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n83,n84,n85,n86,n52,n87,n88,n89,n90,n91 internal;
class n162,n59,n56,n179,n109,n45,n171,n202,n212,n185,n63,n158,n69,n267,n268,n269,n251 external;
```

### Skill Library

Source: `docs/architecture/graphs/system-skills.mmd`

```mermaid
flowchart LR
n268["Navigate"]
n215["Follow Path"]
n270["Mine"]
n271["Collect"]
n267["Craft"]
n272["Smelt"]
n273["Eat"]
n249["Deposit"]
n252["Withdraw"]
n274["Sleep"]
n275["Flee or Defend"]
n250["Explore"]
n276["Bridge"]
n277["Clear"]
n269["Place Build"]
n278["Construction"]
n279["Procurement"]
n280["Schematic Build"]
n281["Repair"]
n216["Harvest Farm"]
n217["Plant Farm"]
n282["Entity Targeting"]
n283["Equip Gear"]
n284["Gather Food"]
n285["Gather Wool"]
n286["Place Bed"]
n287["Dig Shelter"]
n251["Skill Shared Utilities"]
n53["Block Executor (Building)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n52["Skill Context Builder (Skill Runtime)"]
n211["Container Memory (World Model and Landmarks)"]
n212["Spatial Query Engine (World Model and Landmarks)"]
n145["Mob Threat Evaluator (Autonomy and Safety)"]
n200["Path Graph Store (Shared Infrastructure Plan)"]
n198["Farm Store (Shared Infrastructure Plan)"]
n83["Skill Contract (Skill Runtime)"]
n104["Schematic Diff (Building)"]
n106["Build Order Planner (Building)"]
n105["Work Package Partitioner (Building)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n132["Building Execution Service (Bot Runtime and Mineflayer Adapter)"]
n124["Construction Plan Planner (Building)"]
n136["Building Procurement Service (Bot Runtime and Mineflayer Adapter)"]
n126["Material Procurement Planner (Building)"]
n57 -->|depends_on| n63
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n106 -->|depends_on| n105
n104 -->|reads| n212
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n212
n276 -->|depends_on| n53
n276 -->|depends_on| n268
n277 -->|depends_on| n53
n277 -->|depends_on| n63
n271 -->|depends_on| n57
n271 -->|depends_on| n270
n271 -->|depends_on| n268
n267 -->|depends_on| n57
n267 -->|depends_on| n52
n249 -->|depends_on| n57
n249 -->|depends_on| n211
n273 -->|depends_on| n57
n250 -->|depends_on| n268
n250 -->|depends_on| n212
n275 -->|depends_on| n57
n275 -->|depends_on| n145
n275 -->|depends_on| n268
n215 -->|depends_on| n200
n215 -->|depends_on| n268
n216 -->|depends_on| n57
n216 -->|depends_on| n198
n216 -->|depends_on| n268
n270 -->|depends_on| n57
n270 -->|depends_on| n268
n268 -->|depends_on| n57
n268 -->|depends_on| n83
n269 -->|depends_on| n53
n269 -->|depends_on| n52
n217 -->|depends_on| n57
n217 -->|depends_on| n198
n217 -->|depends_on| n268
n281 -->|depends_on| n53
n281 -->|depends_on| n104
n280 -->|depends_on| n53
n280 -->|depends_on| n106
n280 -->|depends_on| n105
n251 -->|depends_on| n52
n251 -->|depends_on| n212
n274 -->|depends_on| n57
n274 -->|depends_on| n268
n272 -->|depends_on| n57
n272 -->|depends_on| n268
n252 -->|depends_on| n57
n252 -->|depends_on| n211
n212 -->|reads| n200
n124 -->|depends_on| n126
n282 -->|depends_on| n56
n283 -->|depends_on| n251
n283 -->|depends_on| n57
n284 -->|depends_on| n282
n284 -->|depends_on| n251
n284 -->|depends_on| n57
n284 -->|depends_on| n56
n285 -->|depends_on| n282
n285 -->|depends_on| n251
n285 -->|depends_on| n57
n285 -->|depends_on| n56
n286 -->|depends_on| n251
n286 -->|depends_on| n57
n287 -->|depends_on| n251
n287 -->|depends_on| n57
n278 -->|depends_on| n132
n278 -->|depends_on| n124
n279 -->|depends_on| n136
n279 -->|depends_on| n126
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n268,n215,n270,n271,n267,n272,n273,n249,n252,n274,n275,n250,n276,n277,n269,n278,n279,n280,n281,n216,n217,n282,n283,n284,n285,n286,n287,n251 internal;
class n53,n63,n57,n52,n211,n212,n145,n200,n198,n83,n104,n106,n105,n56,n132,n124,n136,n126 external;
```

### Building

Source: `docs/architecture/graphs/system-building.mmd`

```mermaid
flowchart LR
n92["Blueprint IR"]
n93["Blueprint Validator"]
n94["Template Registry"]
n95["House Template"]
n96["Road Template"]
n97["Farm Template"]
n98["Wall Template"]
n99["Bridge Template"]
n100["Storage Room Template"]
n101["Watchtower Template"]
n102["Template Instantiator"]
n103["Schematic Parser"]
n104["Schematic Diff"]
n105["Work Package Partitioner"]
n106["Build Order Planner"]
n107["Reachability and Scaffold Planner"]
n108["Block Verifier"]
n53["Block Executor"]
n109["Material Preflight"]
n110["Container Refill Adapter"]
n111["Rollback Journal"]
n112["Construction Plan Types"]
n113["Blueprint Document"]
n114["Seeded Random"]
n115["Style Palette"]
n116["Motif Library"]
n117["Blueprint Composer"]
n118["Observed Blueprint"]
n119["Blueprint Source Resolver"]
n120["Site Planner"]
n121["Foundation Planner"]
n122["Construction Dependency Graph"]
n123["Work Package Planner"]
n124["Construction Plan Planner"]
n125["Construction Plan Document"]
n126["Material Procurement Planner"]
n127["Repair Plan Planner"]
n128["Rollback Plan Planner"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n212["Spatial Query Engine (World Model and Landmarks)"]
n201["Rules Store (Shared Infrastructure Plan)"]
n211["Container Memory (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n288["Block Changelog Writer (Memory and Persistence)"]
n196["Structure Store (Shared Infrastructure Plan)"]
n185["Event Stream (Transport and Protocol)"]
n276["Bridge (Skill Library)"]
n277["Clear (Skill Library)"]
n269["Place Build (Skill Library)"]
n281["Repair (Skill Library)"]
n280["Schematic Build (Skill Library)"]
n278["Construction (Skill Library)"]
n279["Procurement (Skill Library)"]
n57 -->|depends_on| n63
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n108
n53 -->|depends_on| n111
n53 -->|depends_on| n63
n108 -->|depends_on| n92
n108 -->|reads| n212
n93 -->|depends_on| n92
n93 -->|depends_on| n201
n106 -->|depends_on| n92
n106 -->|depends_on| n105
n110 -->|depends_on| n57
n110 -->|writes| n211
n109 -->|depends_on| n92
n109 -->|reads| n52
n109 -->|reads| n211
n107 -->|reads| n56
n107 -->|depends_on| n106
n107 -->|reads| n212
n111 -->|writes| n288
n111 -->|reads| n196
n111 -->|subscribes| n185
n104 -->|depends_on| n92
n104 -->|reads| n212
n103 -->|depends_on| n92
n99 -->|depends_on| n92
n97 -->|depends_on| n92
n95 -->|depends_on| n92
n102 -->|depends_on| n93
n102 -->|depends_on| n94
n94 -->|depends_on| n92
n96 -->|depends_on| n92
n100 -->|depends_on| n92
n98 -->|depends_on| n92
n101 -->|depends_on| n92
n105 -->|depends_on| n92
n105 -->|reads| n196
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n212
n276 -->|depends_on| n53
n277 -->|depends_on| n53
n277 -->|depends_on| n63
n269 -->|depends_on| n53
n269 -->|depends_on| n52
n281 -->|depends_on| n53
n281 -->|depends_on| n104
n280 -->|depends_on| n53
n280 -->|depends_on| n106
n280 -->|depends_on| n105
n112 -->|depends_on| n92
n113 -->|depends_on| n92
n117 -->|depends_on| n113
n117 -->|depends_on| n114
n117 -->|depends_on| n115
n117 -->|depends_on| n116
n119 -->|depends_on| n117
n119 -->|depends_on| n118
n121 -->|depends_on| n120
n122 -->|depends_on| n112
n123 -->|depends_on| n112
n124 -->|depends_on| n121
n124 -->|depends_on| n122
n124 -->|depends_on| n123
n124 -->|depends_on| n126
n126 -->|depends_on| n109
n120 -->|depends_on| n112
n278 -->|depends_on| n124
n125 -->|depends_on| n112
n127 -->|depends_on| n92
n127 -->|depends_on| n104
n127 -->|depends_on| n122
n127 -->|depends_on| n123
n128 -->|depends_on| n92
n128 -->|depends_on| n122
n128 -->|depends_on| n123
n128 -->|depends_on| n111
n279 -->|depends_on| n126
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n92,n93,n94,n95,n96,n97,n98,n99,n100,n101,n102,n103,n104,n105,n106,n107,n108,n53,n109,n110,n111,n112,n113,n114,n115,n116,n117,n118,n119,n120,n121,n122,n123,n124,n125,n126,n127,n128 internal;
class n57,n63,n212,n201,n211,n52,n56,n288,n196,n185,n276,n277,n269,n281,n280,n278,n279 external;
```

### Bot Runtime and Mineflayer Adapter

Source: `docs/architecture/graphs/system-bot-runtime.mmd`

```mermaid
flowchart LR
n54["Connection Lifecycle"]
n129["Join and Auth"]
n55["Mineflayer Event Bridge"]
n56["World Cache Adapter"]
n130["Shelter Inspector"]
n131["Reach and Rate Guard"]
n57["Action Executor"]
n132["Building Execution Service"]
n133["Blueprint Fetch Client"]
n134["Construction Plan Fetch Client"]
n135["Construction Source"]
n136["Building Procurement Service"]
n137["Container Scanner"]
n138["Procurement Catalog"]
n139["State Digest Collector"]
n58["Guardian Hook"]
n59["Skill Host"]
n140["Perception Host"]
n60["Agent Loop"]
n141["Goal Tie-Break"]
n61["Chat Adapter"]
n142["Agency State Adapter"]
n62["Reconnect Supervisor"]
n143["Headless Bot Runtime"]
n63["Action Veto Gate (Autonomy and Safety)"]
n162["Affordance Enumerator (Brains)"]
n175["Config Schema Validator (Config and Profiles)"]
n24(["Minecraft 1.20.1 LAN Server"])
n70["Deterministic Policy (Brains)"]
n193["Block Update Listener (Perception)"]
n69["Reflex Guardian Loop (Brains)"]
n181["Profile Resolver (Config and Profiles)"]
n260["Detector Pipeline (Perception)"]
n253["Ring Sampler (Perception)"]
n206["Delta Sync Planner (Bot Registry and Profiles)"]
n187["Reconnect Supervisor (Transport and Protocol)"]
n85["Skill Lifecycle Executor (Skill Runtime)"]
n86["Skill Tick Scheduler (Skill Runtime)"]
n185["Event Stream (Transport and Protocol)"]
n52["Skill Context Builder (Skill Runtime)"]
n53["Block Executor (Building)"]
n110["Container Refill Adapter (Building)"]
n107["Reachability and Scaffold Planner (Building)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n271["Collect (Skill Library)"]
n267["Craft (Skill Library)"]
n249["Deposit (Skill Library)"]
n273["Eat (Skill Library)"]
n275["Flee or Defend (Skill Library)"]
n216["Harvest Farm (Skill Library)"]
n270["Mine (Skill Library)"]
n268["Navigate (Skill Library)"]
n217["Plant Farm (Skill Library)"]
n274["Sleep (Skill Library)"]
n272["Smelt (Skill Library)"]
n252["Withdraw (Skill Library)"]
n33["Bot Process Supervisor (Coordinator Runtime)"]
n289["Goal Arbiter (Agency)"]
n290["Intention Manager (Agency)"]
n242["Agency State (Agency)"]
n71["Laya Client (Brains)"]
n291["Social Engine (Agency)"]
n239["Agency State Store (Bot Registry and Profiles)"]
n292["Agent Episode Repository (Memory and Persistence)"]
n282["Entity Targeting (Skill Library)"]
n283["Equip Gear (Skill Library)"]
n284["Gather Food (Skill Library)"]
n285["Gather Wool (Skill Library)"]
n286["Place Bed (Skill Library)"]
n287["Dig Shelter (Skill Library)"]
n278["Construction (Skill Library)"]
n184["Request Correlator (Transport and Protocol)"]
n293["Reflection (Agency)"]
n279["Procurement (Skill Library)"]
n294["Simulation Harness (Testing and Evaluation)"]
n57 -->|depends_on| n54
n57 -->|depends_on| n131
n57 -->|depends_on| n63
n162 -->|depends_on| n56
n162 -->|depends_on| n69
n54 -->|depends_on| n175
n54 -->|depends_on| n24
n70 -->|depends_on| n162
n70 -->|depends_on| n139
n70 -->|subscribes| n185
n55 -->|depends_on| n54
n55 -->|delegates_to| n193
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n129 -->|depends_on| n54
n129 -->|depends_on| n181
n140 -->|depends_on| n260
n140 -->|depends_on| n253
n131 -->|depends_on| n175
n62 -->|depends_on| n54
n62 -->|delegates_to| n206
n62 -->|depends_on| n187
n59 -->|depends_on| n85
n59 -->|depends_on| n86
n139 -->|depends_on| n54
n139 -->|depends_on| n56
n139 -->|publishes| n185
n56 -->|depends_on| n55
n56 -->|delegates_to| n253
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n110 -->|depends_on| n57
n107 -->|reads| n56
n181 -->|depends_on| n175
n67 -->|controls| n59
n67 -->|depends_on| n185
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n65 -->|controls| n57
n65 -->|depends_on| n185
n69 -->|controls| n63
n52 -->|reads| n56
n85 -->|depends_on| n52
n86 -->|reads| n69
n86 -->|depends_on| n85
n271 -->|depends_on| n57
n271 -->|depends_on| n270
n271 -->|depends_on| n268
n267 -->|depends_on| n57
n267 -->|depends_on| n52
n249 -->|depends_on| n57
n273 -->|depends_on| n57
n275 -->|depends_on| n57
n275 -->|depends_on| n268
n216 -->|depends_on| n57
n216 -->|depends_on| n268
n270 -->|depends_on| n57
n270 -->|depends_on| n268
n268 -->|depends_on| n57
n217 -->|depends_on| n57
n217 -->|depends_on| n268
n274 -->|depends_on| n57
n274 -->|depends_on| n268
n272 -->|depends_on| n57
n272 -->|depends_on| n268
n252 -->|depends_on| n57
n33 -->|controls| n54
n71 -->|depends_on| n162
n71 -->|depends_on| n70
n193 -->|publishes| n185
n60 -->|depends_on| n289
n60 -->|depends_on| n290
n60 -->|depends_on| n242
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n139
n60 -->|delegates_to| n59
n61 -->|depends_on| n291
n61 -->|publishes| n185
n142 -->|persists_to| n239
n60 -->|persists_to| n292
n290 -->|depends_on| n289
n242 -->|depends_on| n290
n291 -->|proposes_to| n61
n239 -->|depends_on| n242
n282 -->|depends_on| n56
n283 -->|depends_on| n57
n284 -->|depends_on| n282
n284 -->|depends_on| n57
n284 -->|depends_on| n56
n285 -->|depends_on| n282
n285 -->|depends_on| n57
n285 -->|depends_on| n56
n286 -->|depends_on| n57
n287 -->|depends_on| n57
n130 -->|depends_on| n56
n278 -->|depends_on| n132
n135 -->|depends_on| n133
n133 -->|depends_on| n184
n60 -->|depends_on| n141
n141 -->|depends_on| n289
n134 -->|depends_on| n184
n135 -->|depends_on| n134
n60 -->|depends_on| n293
n279 -->|depends_on| n136
n136 -->|depends_on| n137
n136 -->|depends_on| n138
n137 -->|depends_on| n56
n138 -->|depends_on| n56
n294 -->|depends_on| n143
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n54,n129,n55,n56,n130,n131,n57,n132,n133,n134,n135,n136,n137,n138,n139,n58,n59,n140,n60,n141,n61,n142,n62,n143 internal;
class n63,n162,n175,n70,n193,n69,n181,n260,n253,n206,n187,n85,n86,n185,n52,n53,n110,n107,n67,n65,n271,n267,n249,n273,n275,n216,n270,n268,n217,n274,n272,n252,n33,n289,n290,n242,n71,n291,n239,n292,n282,n283,n284,n285,n286,n287,n278,n184,n293,n279,n294,n24 external;
```

### Autonomy and Safety

Source: `docs/architecture/graphs/system-safety.mmd`

```mermaid
flowchart LR
n144["Hazard Evaluator"]
n145["Mob Threat Evaluator"]
n146["Hunger Evaluator"]
n147["Stuck and Timeout Evaluator"]
n148["Inventory Evaluator"]
n149["Claim Loss Evaluator"]
n150["Protected BBox Rule"]
n151["Active Bot Support Rule"]
n152["Material Ban Rule"]
n153["Safety Policy Engine"]
n63["Action Veto Gate"]
n64["Recovery Ladder"]
n65["Emergency Stop Controller"]
n154["Incident Journal"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n53["Block Executor (Building)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n230["Claim Repository (Claims and Leases)"]
n212["Spatial Query Engine (World Model and Landmarks)"]
n29["Command Router (Coordinator Runtime)"]
n185["Event Stream (Transport and Protocol)"]
n229["Event Log Writer (Memory and Persistence)"]
n201["Rules Store (Shared Infrastructure Plan)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n91["Skill Preemption Handler (Skill Runtime)"]
n277["Clear (Skill Library)"]
n275["Flee or Defend (Skill Library)"]
n57 -->|depends_on| n63
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n68 -->|controls| n65
n68 -->|depends_on| n185
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n63 -->|depends_on| n153
n151 -->|reads| n230
n151 -->|reads| n212
n149 -->|reads| n230
n65 -->|controls| n57
n65 -->|controls| n29
n65 -->|depends_on| n185
n69 -->|controls| n63
n69 -->|depends_on| n149
n69 -->|depends_on| n144
n69 -->|depends_on| n146
n69 -->|depends_on| n148
n69 -->|depends_on| n145
n69 -->|depends_on| n147
n154 -->|writes| n229
n150 -->|reads| n230
n150 -->|reads| n201
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n64 -->|depends_on| n185
n153 -->|reads| n230
n153 -->|depends_on| n151
n153 -->|depends_on| n152
n153 -->|depends_on| n150
n153 -->|reads| n201
n153 -->|reads| n212
n91 -->|reads| n63
n277 -->|depends_on| n53
n277 -->|depends_on| n63
n275 -->|depends_on| n57
n275 -->|depends_on| n145
n68 -->|writes| n229
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n144,n145,n146,n147,n148,n149,n150,n151,n152,n153,n63,n64,n65,n154 internal;
class n57,n58,n53,n68,n69,n230,n212,n29,n185,n229,n201,n43,n91,n277,n275 external;
```

### Memory and Persistence

Source: `docs/architecture/graphs/system-memory.mmd`

```mermaid
flowchart LR
n295["SQLite Runtime"]
n177["Migration Runner"]
n171["Transaction Manager"]
n229["Event Log Writer"]
n288["Block Changelog Writer"]
n173["Retention Pruner"]
n296["Snapshot Export"]
n297["Schema Version Registry"]
n298["Episode Store"]
n292["Agent Episode Repository"]
n228["Bot Profile Store (Bot Registry and Profiles)"]
n111["Rollback Journal (Building)"]
n166["Atomic Claim Acquirer (Claims and Leases)"]
n230["Claim Repository (Claims and Leases)"]
n164["Fencing Token Authority (Claims and Leases)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n72["Process Bootstrap (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n299["Replay Engine (Testing and Evaluation)"]
n234["Grant Repository (Edit Grants and Collaboration)"]
n161["Audit Viewer (Ops and Observability)"]
n160["Health and Readiness (Ops and Observability)"]
n81["Plan Cache (Cloud Planner Advisor)"]
n154["Incident Journal (Autonomy and Safety)"]
n199["Container Registry (Shared Infrastructure Plan)"]
n198["Farm Store (Shared Infrastructure Plan)"]
n200["Path Graph Store (Shared Infrastructure Plan)"]
n202["SIP Revision Manager (Shared Infrastructure Plan)"]
n197["Road Store (Shared Infrastructure Plan)"]
n201["Rules Store (Shared Infrastructure Plan)"]
n196["Structure Store (Shared Infrastructure Plan)"]
n168["SIP Transactional Committer (Shared Infrastructure Plan)"]
n195["Zone Store (Shared Infrastructure Plan)"]
n88["Skill Checkpoint Manager (Skill Runtime)"]
n169["Atomic Task Claimer (Task Board)"]
n218["Task Repository (Task Board)"]
n225["Task State Machine (Task Board)"]
n300["Trace Exporter (Laya Training)"]
n243["Chunk Version Store (World Model and Landmarks)"]
n247["Landmark Registry (World Model and Landmarks)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n239["Agency State Store (Bot Registry and Profiles)"]
n156["Agency Status View (Ops and Observability)"]
n228 -->|depends_on| n171
n111 -->|writes| n288
n111 -->|reads| n196
n166 -->|writes| n230
n166 -->|depends_on| n171
n230 -->|depends_on| n171
n164 -->|depends_on| n30
n164 -->|depends_on| n171
n30 -->|controls| n164
n30 -->|depends_on| n171
n31 -->|depends_on| n30
n31 -->|delegates_to| n173
n72 -->|depends_on| n32
n72 -->|depends_on| n177
n32 -->|depends_on| n171
n299 -->|depends_on| n229
n234 -->|depends_on| n171
n288 -->|depends_on| n171
n229 -->|depends_on| n171
n177 -->|depends_on| n295
n173 -->|depends_on| n288
n173 -->|depends_on| n229
n173 -->|depends_on| n171
n297 -->|depends_on| n177
n296 -->|depends_on| n171
n171 -->|depends_on| n295
n161 -->|reads| n288
n161 -->|reads| n229
n160 -->|depends_on| n295
n81 -->|depends_on| n171
n154 -->|writes| n229
n199 -->|depends_on| n171
n198 -->|depends_on| n171
n200 -->|depends_on| n171
n202 -->|depends_on| n171
n202 -->|depends_on| n201
n197 -->|depends_on| n171
n201 -->|depends_on| n171
n196 -->|depends_on| n171
n168 -->|depends_on| n171
n168 -->|writes| n199
n168 -->|writes| n198
n168 -->|writes| n200
n168 -->|depends_on| n202
n168 -->|writes| n197
n168 -->|writes| n201
n168 -->|writes| n196
n168 -->|writes| n195
n195 -->|depends_on| n171
n88 -->|depends_on| n171
n169 -->|depends_on| n171
n169 -->|writes| n218
n218 -->|depends_on| n171
n225 -->|depends_on| n229
n225 -->|writes| n218
n300 -->|reads| n229
n243 -->|depends_on| n171
n247 -->|depends_on| n171
n299 -->|reads| n298
n300 -->|reads| n298
n161 -->|reads| n298
n173 -->|depends_on| n298
n67 -->|writes| n229
n68 -->|writes| n229
n60 -->|persists_to| n292
n239 -->|depends_on| n171
n292 -->|depends_on| n171
n156 -->|reads| n239
n156 -->|reads| n292
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n295,n177,n171,n229,n288,n173,n296,n297,n298,n292 internal;
class n228,n111,n166,n230,n164,n30,n31,n72,n32,n299,n234,n161,n160,n81,n154,n199,n198,n200,n202,n197,n201,n196,n168,n195,n88,n169,n218,n225,n300,n243,n247,n67,n68,n60,n239,n156 external;
```

### Ops and Observability

Source: `docs/architecture/graphs/system-ops.mmd`

```mermaid
flowchart LR
n66["Ops API"]
n155["Status Aggregator"]
n156["Agency Status View"]
n67["Pause and Resume Controller"]
n68["Fleet Emergency Stop"]
n157["SIP Dump"]
n158["Metrics Registry"]
n159["Structured Logger"]
n160["Health and Readiness"]
n161["Audit Viewer"]
n232["Contention Metrics (Claims and Leases)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n80["Latency Metrics (Laya Decision Service)"]
n301["Metrics Reporter (Testing and Evaluation)"]
n28(["Fleet Operator"])
n288["Block Changelog Writer (Memory and Persistence)"]
n229["Event Log Writer (Memory and Persistence)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n185["Event Stream (Transport and Protocol)"]
n34["Model Loader (Laya Decision Service)"]
n295["SQLite Runtime (Memory and Persistence)"]
n170["Message Schema Registry (Transport and Protocol)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n183["Presence Tracker (Bot Registry and Profiles)"]
n202["SIP Revision Manager (Shared Infrastructure Plan)"]
n230["Claim Repository (Claims and Leases)"]
n218["Task Repository (Task Board)"]
n49["Planner Budget Limiter (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n87["Skill Progress Reporter (Skill Runtime)"]
n298["Episode Store (Memory and Persistence)"]
n239["Agency State Store (Bot Registry and Profiles)"]
n292["Agent Episode Repository (Memory and Persistence)"]
n232 -->|depends_on| n230
n232 -->|observes| n158
n35 -->|controls| n34
n35 -->|observes| n159
n80 -->|observes| n158
n80 -->|writes| n158
n301 -->|observes| n158
n28 -->|controls| n66
n161 -->|reads| n288
n161 -->|reads| n229
n68 -->|controls| n65
n68 -->|depends_on| n185
n160 -->|depends_on| n34
n160 -->|depends_on| n295
n160 -->|depends_on| n155
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n155
n66 -->|depends_on| n170
n67 -->|controls| n59
n67 -->|depends_on| n183
n67 -->|depends_on| n185
n157 -->|depends_on| n202
n155 -->|depends_on| n183
n155 -->|reads| n230
n155 -->|observes| n158
n155 -->|reads| n202
n155 -->|reads| n218
n49 -->|observes| n158
n43 -->|observes| n158
n43 -->|reads| n202
n65 -->|depends_on| n185
n87 -->|observes| n158
n87 -->|publishes| n185
n161 -->|reads| n298
n67 -->|writes| n229
n68 -->|writes| n229
n156 -->|reads| n239
n156 -->|reads| n292
n66 -->|depends_on| n156
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n66,n155,n156,n67,n68,n157,n158,n159,n160,n161 internal;
class n232,n35,n80,n301,n288,n229,n65,n185,n34,n295,n170,n59,n183,n202,n230,n218,n49,n43,n87,n298,n239,n292,n28 external;
```

### Config and Profiles

Source: `docs/architecture/graphs/system-config.mmd`

```mermaid
flowchart LR
n176["Environment Parser"]
n175["Config Schema Validator"]
n181["Profile Resolver"]
n263["Hardware Probe"]
n191["Secrets Loader"]
n241["Name Pool Validator"]
n264["Laya Runtime Resolver"]
n302["Fail Fast Handler"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n129["Join and Auth (Bot Runtime and Mineflayer Adapter)"]
n131["Reach and Rate Guard (Bot Runtime and Mineflayer Adapter)"]
n182["Bot Identity Authenticator (Bot Registry and Profiles)"]
n240["Name Pool Allocator (Bot Registry and Profiles)"]
n27(["Host Hardware"])
n72["Process Bootstrap (Coordinator Runtime)"]
n73["Service Composition (Coordinator Runtime)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n77["Decision Rate Limiter (Laya Decision Service)"]
n261["Perception Rate Limiter (Perception)"]
n41["OpenAI-Compatible Client (Cloud Planner Advisor)"]
n188["Transport Authentication (Transport and Protocol)"]
n163["Tactical Decision Policy (Brains)"]
n54 -->|depends_on| n175
n129 -->|depends_on| n54
n129 -->|depends_on| n181
n131 -->|depends_on| n175
n182 -->|depends_on| n191
n240 -->|depends_on| n241
n175 -->|depends_on| n176
n302 -->|depends_on| n175
n263 -->|depends_on| n181
n263 -->|depends_on| n27
n264 -->|depends_on| n263
n264 -->|depends_on| n181
n241 -->|depends_on| n175
n181 -->|depends_on| n175
n191 -->|depends_on| n176
n72 -->|depends_on| n175
n72 -->|depends_on| n176
n72 -->|depends_on| n73
n73 -->|depends_on| n181
n39 -->|depends_on| n175
n35 -->|depends_on| n263
n35 -->|controls| n34
n34 -->|depends_on| n264
n77 -->|depends_on| n181
n261 -->|depends_on| n181
n41 -->|depends_on| n175
n41 -->|depends_on| n191
n188 -->|depends_on| n182
n188 -->|depends_on| n191
n163 -->|depends_on| n175
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n176,n175,n181,n263,n191,n241,n264,n302 internal;
class n54,n129,n131,n182,n240,n72,n73,n39,n35,n34,n77,n261,n41,n188,n163,n27 external;
```

### Testing and Evaluation

Source: `docs/architecture/graphs/system-eval.mmd`

```mermaid
flowchart LR
n303["Unit Fixtures"]
n262["Detector Fixtures"]
n304["Docker Server Harness"]
n305["Scenario Runner"]
n299["Replay Engine"]
n227["Contention Harness"]
n301["Metrics Reporter"]
n306["Soak Runner"]
n307["Architecture Guard Tests"]
n265["Laya Benchmark Harness"]
n294["Simulation Harness"]
n308["Behavior Assertions"]
n309["Trace Inspector"]
n230["Claim Repository (Claims and Leases)"]
n218["Task Repository (Task Board)"]
n260["Detector Pipeline (Perception)"]
n24(["Minecraft 1.20.1 LAN Server"])
n80["Latency Metrics (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n158["Metrics Registry (Ops and Observability)"]
n229["Event Log Writer (Memory and Persistence)"]
n310["Promotion Gate (Laya Training)"]
n298["Episode Store (Memory and Persistence)"]
n143["Headless Bot Runtime (Bot Runtime and Mineflayer Adapter)"]
n80 -->|observes| n158
n80 -->|writes| n158
n307 -->|depends_on| n303
n227 -->|depends_on| n230
n227 -->|delegates_to| n305
n227 -->|depends_on| n218
n262 -->|depends_on| n303
n262 -->|depends_on| n260
n304 -->|depends_on| n303
n304 -->|depends_on| n24
n265 -->|depends_on| n80
n265 -->|depends_on| n34
n265 -->|delegates_to| n305
n301 -->|observes| n158
n299 -->|depends_on| n305
n299 -->|depends_on| n229
n305 -->|controls| n304
n305 -->|publishes| n301
n306 -->|depends_on| n301
n306 -->|delegates_to| n305
n310 -->|depends_on| n265
n299 -->|reads| n298
n294 -->|depends_on| n143
n294 -->|depends_on| n308
n309 -->|depends_on| n294
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n303,n262,n304,n305,n299,n227,n301,n306,n307,n265,n294,n308,n309 internal;
class n230,n218,n260,n80,n34,n158,n229,n310,n298,n143,n24 external;
```

### Laya Training

Source: `docs/architecture/graphs/system-training.mmd`

```mermaid
flowchart LR
n300["Trace Exporter"]
n311["Labeling Pipeline"]
n312["Reward Computer"]
n313["Fine-tune Runner"]
n314["ONNX Exporter"]
n266["Calibration Fitter"]
n310["Promotion Gate"]
n39["Confidence Calibrator (Laya Decision Service)"]
n265["Laya Benchmark Harness (Testing and Evaluation)"]
n229["Event Log Writer (Memory and Persistence)"]
n298["Episode Store (Memory and Persistence)"]
n266 -->|reads| n39
n266 -->|depends_on| n300
n313 -->|depends_on| n311
n313 -->|depends_on| n312
n311 -->|depends_on| n300
n314 -->|depends_on| n313
n310 -->|depends_on| n265
n310 -->|depends_on| n266
n310 -->|depends_on| n314
n312 -->|depends_on| n300
n300 -->|reads| n229
n300 -->|reads| n298
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n300,n311,n312,n313,n314,n266,n310 internal;
class n39,n265,n229,n298 external;
```

### Brains

Source: `docs/architecture/graphs/system-brains.mmd`

```mermaid
flowchart LR
n69["Reflex Guardian Loop"]
n162["Affordance Enumerator"]
n70["Deterministic Policy"]
n71["Laya Client"]
n163["Tactical Decision Policy"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n84["Skill Registry (Skill Runtime)"]
n139["State Digest Collector (Bot Runtime and Mineflayer Adapter)"]
n237["Behavior Profile Manager (Bot Registry and Profiles)"]
n185["Event Stream (Transport and Protocol)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n149["Claim Loss Evaluator (Autonomy and Safety)"]
n144["Hazard Evaluator (Autonomy and Safety)"]
n146["Hunger Evaluator (Autonomy and Safety)"]
n148["Inventory Evaluator (Autonomy and Safety)"]
n145["Mob Threat Evaluator (Autonomy and Safety)"]
n147["Stuck and Timeout Evaluator (Autonomy and Safety)"]
n86["Skill Tick Scheduler (Skill Runtime)"]
n178["WebSocket Codec (Transport and Protocol)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n175["Config Schema Validator (Config and Profiles)"]
n162 -->|depends_on| n56
n162 -->|depends_on| n69
n162 -->|depends_on| n84
n70 -->|depends_on| n162
n70 -->|depends_on| n139
n70 -->|reads| n237
n70 -->|subscribes| n185
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n139 -->|depends_on| n56
n139 -->|publishes| n185
n39 -->|proposes_to| n70
n39 -->|depends_on| n175
n63 -->|reads| n69
n69 -->|controls| n63
n69 -->|depends_on| n149
n69 -->|depends_on| n144
n69 -->|depends_on| n146
n69 -->|depends_on| n148
n69 -->|depends_on| n145
n69 -->|depends_on| n147
n86 -->|reads| n69
n185 -->|depends_on| n178
n71 -->|depends_on| n162
n71 -->|depends_on| n178
n71 -->|depends_on| n70
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n139
n71 -->|depends_on| n163
n163 -->|depends_on| n175
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n69,n162,n70,n71,n163 internal;
class n56,n84,n139,n237,n185,n58,n39,n63,n149,n144,n146,n148,n145,n147,n86,n178,n60,n175 external;
```

### Agency

Source: `docs/architecture/graphs/system-agency.mmd`

```mermaid
flowchart LR
n315["Personality Model"]
n316["Needs Model"]
n317["Goal Catalog"]
n318["Goal Generator"]
n289["Goal Arbiter"]
n290["Intention Manager"]
n319["Routine Model"]
n320["Item Knowledge"]
n321["Night Preparation Config"]
n322["Shelter Strategy"]
n323["Shelter Plan"]
n324["Night Readiness"]
n291["Social Engine"]
n325["Working Memory"]
n326["Project Focus Policy"]
n242["Agency State"]
n327["Strategic Intent Policy"]
n293["Reflection"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n239["Agency State Store (Bot Registry and Profiles)"]
n141["Goal Tie-Break (Bot Runtime and Mineflayer Adapter)"]
n60 -->|depends_on| n289
n60 -->|depends_on| n290
n60 -->|depends_on| n242
n61 -->|depends_on| n291
n318 -->|depends_on| n317
n318 -->|depends_on| n316
n318 -->|depends_on| n315
n289 -->|depends_on| n318
n289 -->|depends_on| n316
n289 -->|depends_on| n315
n290 -->|depends_on| n289
n291 -->|depends_on| n315
n242 -->|depends_on| n316
n242 -->|depends_on| n315
n242 -->|depends_on| n290
n242 -->|depends_on| n319
n242 -->|depends_on| n325
n326 -->|depends_on| n325
n291 -->|proposes_to| n61
n239 -->|depends_on| n242
n324 -->|depends_on| n320
n324 -->|depends_on| n321
n324 -->|depends_on| n319
n324 -->|depends_on| n323
n324 -->|depends_on| n322
n322 -->|depends_on| n321
n318 -->|depends_on| n321
n318 -->|depends_on| n324
n318 -->|depends_on| n319
n327 -->|depends_on| n289
n327 -->|depends_on| n325
n60 -->|depends_on| n141
n141 -->|depends_on| n289
n60 -->|depends_on| n293
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n315,n316,n317,n318,n289,n290,n319,n320,n321,n322,n323,n324,n291,n325,n326,n242,n327,n293 internal;
class n60,n61,n239,n141 external;
```

### Bootstrap and Toolchain

Source: `docs/architecture/graphs/system-toolchain.mmd`

```mermaid
flowchart LR
n328["Bootstrap Orchestrator"]
n329["Capability Check"]
n330["Python Environment"]
n331["Minecraft Server Controller"]
n332["Firefox SVG Renderer"]
n328 -->|depends_on| n329
n328 -->|depends_on| n330
n328 -->|depends_on| n331
n328 -->|depends_on| n332
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n328,n329,n330,n331,n332 internal;
```
