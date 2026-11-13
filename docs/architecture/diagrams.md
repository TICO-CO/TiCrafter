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
n21 -->|depends_on×5| n14
n21 -->|depends_on×1| n11
n14 -->|depends_on×3| n18
n14 -->|depends_on×1| n24
n21 -->|reads×1| n6
n21 -->|subscribes×1, depends_on×1| n1
n14 -->|delegates_to×2, depends_on×2| n8
n14 -->|delegates_to×3| n21
n14 -->|delegates_to×1, persists_to×1| n6
n14 -->|depends_on×4, publishes×2| n1
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
n12 -->|depends_on×5| n11
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
n21 -->|depends_on×5| n14
n21 -->|depends_on×1| n11
n14 -->|depends_on×3| n18
n21 -->|reads×1| n6
n21 -->|subscribes×1, depends_on×1| n1
n14 -->|delegates_to×2, depends_on×2| n8
n14 -->|delegates_to×3| n21
n14 -->|delegates_to×1, persists_to×1| n6
n14 -->|depends_on×4, publishes×2| n1
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
n12 -->|depends_on×5| n11
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
n174["Fencing Token Authority (Claims and Leases)"]
n175["Flow Control (Transport and Protocol)"]
n176["Atomic Claim Acquirer (Claims and Leases)"]
n177["Grant Issuer (Edit Grants and Collaboration)"]
n178["SIP Transactional Committer (Shared Infrastructure Plan)"]
n179["Atomic Task Claimer (Task Board)"]
n180["Message Schema Registry (Transport and Protocol)"]
n181["Transaction Manager (Memory and Persistence)"]
n182["Lease Reaper (Claims and Leases)"]
n183["Retention Pruner (Memory and Persistence)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n184["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n185["Config Schema Validator (Config and Profiles)"]
n186["Environment Parser (Config and Profiles)"]
n187["Migration Runner (Memory and Persistence)"]
n188["WebSocket Codec (Transport and Protocol)"]
n189["Resume Orchestrator (Bot Registry and Profiles)"]
n190["Grant Expiry (Edit Grants and Collaboration)"]
n191["Profile Resolver (Config and Profiles)"]
n192["Bot Identity Authenticator (Bot Registry and Profiles)"]
n193["Presence Tracker (Bot Registry and Profiles)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n54 -->|depends_on| n185
n189 -->|delegates_to| n184
n176 -->|depends_on| n181
n174 -->|depends_on| n30
n174 -->|depends_on| n181
n185 -->|depends_on| n186
n191 -->|depends_on| n185
n75 -->|depends_on| n175
n29 -->|controls| n176
n29 -->|controls| n177
n29 -->|controls| n178
n29 -->|controls| n179
n29 -->|depends_on| n180
n30 -->|controls| n174
n30 -->|depends_on| n181
n31 -->|delegates_to| n182
n31 -->|depends_on| n30
n31 -->|delegates_to| n183
n31 -->|delegates_to| n43
n31 -->|delegates_to| n184
n72 -->|depends_on| n185
n72 -->|depends_on| n186
n72 -->|depends_on| n32
n72 -->|depends_on| n73
n72 -->|depends_on| n187
n72 -->|depends_on| n188
n32 -->|depends_on| n189
n32 -->|delegates_to| n182
n32 -->|delegates_to| n190
n32 -->|depends_on| n181
n32 -->|depends_on| n184
n73 -->|depends_on| n191
n73 -->|depends_on| n31
n74 -->|depends_on| n192
n74 -->|publishes| n193
n74 -->|depends_on| n188
n183 -->|depends_on| n181
n65 -->|controls| n29
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n184 -->|depends_on| n178
n178 -->|depends_on| n181
n179 -->|depends_on| n181
n188 -->|depends_on| n180
n33 -->|controls| n54
n33 -->|depends_on| n30
n32 -->|depends_on| n33
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n72,n73,n74,n29,n30,n31,n32,n75,n33 internal;
class n174,n175,n176,n177,n178,n179,n180,n181,n182,n183,n43,n184,n185,n186,n187,n188,n189,n190,n191,n192,n193,n65,n64,n54 external;
```

### Transport and Protocol

Source: `docs/architecture/graphs/system-transport.mmd`

```mermaid
flowchart LR
n180["Message Schema Registry"]
n188["WebSocket Codec"]
n194["Request Correlator"]
n195["Event Stream"]
n196["Delta Sync Protocol"]
n197["Reconnect Supervisor"]
n198["Transport Authentication"]
n175["Flow Control"]
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
n199["Arbitration Adapter (Edit Grants and Collaboration)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n66["Ops API (Ops and Observability)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n200["Landmark Candidate Emitter (Perception)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n90["Typed Effects Emitter (Skill Runtime)"]
n87["Skill Progress Reporter (Skill Runtime)"]
n192["Bot Identity Authenticator (Bot Registry and Profiles)"]
n201["Secrets Loader (Config and Profiles)"]
n202["Observation Ingestor (World Model and Landmarks)"]
n71["Laya Client (Brains)"]
n203["Block Update Listener (Perception)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n204["Bot Claim Command Handler (Claims and Leases)"]
n133["Blueprint Fetch Client (Bot Runtime and Mineflayer Adapter)"]
n134["Construction Plan Fetch Client (Bot Runtime and Mineflayer Adapter)"]
n144["Behavior Trace (Bot Runtime and Mineflayer Adapter)"]
n70 -->|depends_on| n139
n70 -->|subscribes| n195
n62 -->|depends_on| n197
n139 -->|publishes| n195
n192 -->|depends_on| n201
n111 -->|subscribes| n195
n75 -->|depends_on| n175
n29 -->|depends_on| n180
n72 -->|depends_on| n188
n74 -->|depends_on| n192
n74 -->|depends_on| n188
n79 -->|depends_on| n180
n38 -->|publishes| n195
n76 -->|subscribes| n195
n199 -->|publishes| n195
n68 -->|controls| n65
n68 -->|depends_on| n195
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n180
n67 -->|depends_on| n195
n200 -->|publishes| n195
n50 -->|subscribes| n195
n65 -->|controls| n29
n65 -->|depends_on| n195
n64 -->|proposes_to| n29
n64 -->|controls| n65
n64 -->|depends_on| n195
n90 -->|publishes| n195
n87 -->|publishes| n195
n198 -->|depends_on| n192
n198 -->|depends_on| n201
n196 -->|depends_on| n180
n195 -->|depends_on| n188
n195 -->|publishes| n202
n175 -->|depends_on| n194
n197 -->|depends_on| n188
n194 -->|depends_on| n188
n188 -->|depends_on| n180
n202 -->|subscribes| n195
n202 -->|reads| n180
n71 -->|depends_on| n188
n71 -->|depends_on| n70
n203 -->|publishes| n195
n61 -->|publishes| n195
n204 -->|depends_on| n188
n133 -->|depends_on| n194
n134 -->|depends_on| n194
n144 -->|depends_on| n180
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n180,n188,n194,n195,n196,n197,n198,n175 internal;
class n70,n62,n139,n111,n75,n29,n72,n74,n79,n38,n76,n199,n68,n66,n67,n200,n50,n65,n64,n90,n87,n192,n201,n202,n71,n203,n61,n204,n133,n134,n144 external;
```

### Shared Infrastructure Plan

Source: `docs/architecture/graphs/system-sip.mmd`

```mermaid
flowchart LR
n205["Zone Store"]
n206["Structure Store"]
n207["Road Store"]
n208["Farm Store"]
n209["Container Registry"]
n210["Path Graph Store"]
n211["Rules Store"]
n212["SIP Revision Manager"]
n213["Spatial Overlap Validator"]
n214["Dependency Validator"]
n215["SIP Mutation Proposer"]
n178["SIP Transactional Committer"]
n184["SIP Reconciliation Engine"]
n216["Delta Sync Planner (Bot Registry and Profiles)"]
n189["Resume Orchestrator (Bot Registry and Profiles)"]
n93["Blueprint Validator (Building)"]
n111["Rollback Journal (Building)"]
n105["Work Package Partitioner (Building)"]
n217["Overlap Margin Checker (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n218["Compatibility Checker (Edit Grants and Collaboration)"]
n219["Design Revision Guard (Edit Grants and Collaboration)"]
n220["Collaboration Policy Evaluator (Edit Grants and Collaboration)"]
n164["SIP Dump (Ops and Observability)"]
n162["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n51["Keep Last Good Fallback (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n47["SIP Mutation Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n157["Protected BBox Rule (Autonomy and Safety)"]
n160["Safety Policy Engine (Autonomy and Safety)"]
n181["Transaction Manager (Memory and Persistence)"]
n221["Container Memory (World Model and Landmarks)"]
n222["Spatial Query Engine (World Model and Landmarks)"]
n223["World Reconciler (World Model and Landmarks)"]
n224["Plan Tagging (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n225["Follow Path (Skill Library)"]
n226["Harvest Farm (Skill Library)"]
n227["Plant Farm (Skill Library)"]
n216 -->|reads| n212
n189 -->|depends_on| n216
n189 -->|delegates_to| n184
n93 -->|depends_on| n211
n111 -->|reads| n206
n105 -->|reads| n206
n217 -->|depends_on| n213
n29 -->|controls| n178
n31 -->|delegates_to| n43
n31 -->|delegates_to| n184
n32 -->|depends_on| n189
n32 -->|depends_on| n181
n32 -->|depends_on| n184
n218 -->|depends_on| n211
n218 -->|depends_on| n206
n219 -->|reads| n212
n220 -->|depends_on| n206
n164 -->|depends_on| n212
n162 -->|reads| n212
n42 -->|reads| n212
n42 -->|reads| n222
n51 -->|reads| n212
n45 -->|depends_on| n214
n45 -->|reads| n211
n45 -->|reads| n222
n47 -->|proposes_to| n215
n43 -->|delegates_to| n42
n43 -->|reads| n212
n157 -->|reads| n211
n160 -->|depends_on| n157
n160 -->|reads| n211
n160 -->|reads| n222
n209 -->|depends_on| n181
n209 -->|depends_on| n221
n214 -->|depends_on| n209
n214 -->|depends_on| n208
n214 -->|depends_on| n210
n214 -->|depends_on| n207
n214 -->|depends_on| n206
n214 -->|reads| n222
n208 -->|depends_on| n181
n215 -->|depends_on| n214
n215 -->|depends_on| n212
n215 -->|depends_on| n213
n210 -->|depends_on| n181
n184 -->|depends_on| n208
n184 -->|depends_on| n207
n184 -->|depends_on| n206
n184 -->|depends_on| n178
n184 -->|depends_on| n223
n212 -->|publishes| n219
n212 -->|depends_on| n181
n212 -->|depends_on| n211
n212 -->|publishes| n224
n207 -->|depends_on| n181
n211 -->|depends_on| n181
n213 -->|reads| n211
n213 -->|depends_on| n206
n213 -->|depends_on| n205
n206 -->|depends_on| n181
n178 -->|depends_on| n181
n178 -->|writes| n209
n178 -->|writes| n208
n178 -->|writes| n210
n178 -->|depends_on| n212
n178 -->|writes| n207
n178 -->|writes| n211
n178 -->|writes| n206
n178 -->|writes| n205
n205 -->|depends_on| n181
n52 -->|reads| n212
n52 -->|reads| n222
n225 -->|depends_on| n210
n226 -->|depends_on| n208
n227 -->|depends_on| n208
n221 -->|reads| n209
n222 -->|reads| n210
n223 -->|depends_on| n222
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n205,n206,n207,n208,n209,n210,n211,n212,n213,n214,n215,n178,n184 internal;
class n216,n189,n93,n111,n105,n217,n29,n31,n32,n218,n219,n220,n164,n162,n42,n51,n45,n47,n43,n157,n160,n181,n221,n222,n223,n224,n52,n225,n226,n227 external;
```

### Task Board

Source: `docs/architecture/graphs/system-tasks.mmd`

```mermaid
flowchart LR
n228["Task Repository"]
n229["Task DAG Resolver"]
n230["Precondition Evaluator"]
n231["Priority Scheduler"]
n179["Atomic Task Claimer"]
n232["Job Offer Service"]
n233["Retry Manager"]
n234["Dead Letter Manager"]
n235["Task State Machine"]
n216["Delta Sync Planner (Bot Registry and Profiles)"]
n236["Claim Releaser (Claims and Leases)"]
n182["Lease Reaper (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n237["Contention Harness (Testing and Evaluation)"]
n162["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n48["Task DAG Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n181["Transaction Manager (Memory and Persistence)"]
n222["Spatial Query Engine (World Model and Landmarks)"]
n238["Bot Profile Store (Bot Registry and Profiles)"]
n239["Event Log Writer (Memory and Persistence)"]
n216 -->|depends_on| n238
n216 -->|reads| n228
n238 -->|depends_on| n181
n236 -->|depends_on| n235
n182 -->|depends_on| n235
n29 -->|controls| n179
n237 -->|depends_on| n228
n239 -->|depends_on| n181
n162 -->|reads| n228
n42 -->|reads| n238
n42 -->|reads| n228
n42 -->|reads| n222
n48 -->|proposes_to| n228
n43 -->|delegates_to| n42
n43 -->|reads| n234
n179 -->|depends_on| n181
n179 -->|depends_on| n231
n179 -->|writes| n228
n229 -->|depends_on| n228
n234 -->|writes| n228
n230 -->|depends_on| n228
n230 -->|reads| n222
n231 -->|reads| n238
n231 -->|depends_on| n229
n231 -->|depends_on| n230
n233 -->|writes| n228
n233 -->|depends_on| n235
n228 -->|depends_on| n181
n235 -->|depends_on| n239
n235 -->|writes| n228
n232 -->|depends_on| n231
n232 -->|delegates_to| n179
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n228,n229,n230,n231,n179,n232,n233,n234,n235 internal;
class n216,n236,n182,n29,n237,n162,n42,n48,n43,n181,n222,n238,n239 external;
```

### Claims and Leases

Source: `docs/architecture/graphs/system-claims.mmd`

```mermaid
flowchart LR
n240["Claim Repository"]
n217["Overlap Margin Checker"]
n176["Atomic Claim Acquirer"]
n241["Lease Heartbeat"]
n182["Lease Reaper"]
n174["Fencing Token Authority"]
n236["Claim Releaser"]
n204["Bot Claim Command Handler"]
n242["Contention Metrics"]
n189["Resume Orchestrator (Bot Registry and Profiles)"]
n181["Transaction Manager (Memory and Persistence)"]
n235["Task State Machine (Task Board)"]
n165["Metrics Registry (Ops and Observability)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n213["Spatial Overlap Validator (Shared Infrastructure Plan)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n237["Contention Harness (Testing and Evaluation)"]
n218["Compatibility Checker (Edit Grants and Collaboration)"]
n243["Grant Revoker (Edit Grants and Collaboration)"]
n162["Status Aggregator (Ops and Observability)"]
n158["Active Bot Support Rule (Autonomy and Safety)"]
n156["Claim Loss Evaluator (Autonomy and Safety)"]
n157["Protected BBox Rule (Autonomy and Safety)"]
n160["Safety Policy Engine (Autonomy and Safety)"]
n188["WebSocket Codec (Transport and Protocol)"]
n189 -->|delegates_to| n236
n176 -->|writes| n240
n176 -->|depends_on| n217
n176 -->|depends_on| n181
n236 -->|writes| n240
n236 -->|depends_on| n235
n240 -->|depends_on| n181
n242 -->|depends_on| n240
n242 -->|observes| n165
n174 -->|depends_on| n30
n174 -->|depends_on| n181
n241 -->|writes| n240
n182 -->|writes| n240
n182 -->|depends_on| n235
n217 -->|depends_on| n240
n217 -->|depends_on| n213
n29 -->|controls| n176
n30 -->|controls| n174
n30 -->|depends_on| n181
n31 -->|delegates_to| n182
n31 -->|depends_on| n30
n32 -->|depends_on| n189
n32 -->|delegates_to| n182
n32 -->|depends_on| n181
n237 -->|depends_on| n240
n218 -->|reads| n240
n243 -->|depends_on| n174
n162 -->|reads| n240
n162 -->|observes| n165
n158 -->|reads| n240
n156 -->|reads| n240
n157 -->|reads| n240
n160 -->|reads| n240
n160 -->|depends_on| n158
n160 -->|depends_on| n157
n204 -->|depends_on| n240
n204 -->|depends_on| n188
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n240,n217,n176,n241,n182,n174,n236,n204,n242 internal;
class n189,n181,n235,n165,n30,n213,n29,n31,n32,n237,n218,n243,n162,n158,n156,n157,n160,n188 external;
```

### Edit Grants and Collaboration

Source: `docs/architecture/graphs/system-grants.mmd`

```mermaid
flowchart LR
n244["Grant Repository"]
n220["Collaboration Policy Evaluator"]
n218["Compatibility Checker"]
n219["Design Revision Guard"]
n177["Grant Issuer"]
n243["Grant Revoker"]
n245["Owner Offline Policy"]
n190["Grant Expiry"]
n199["Arbitration Adapter"]
n216["Delta Sync Planner (Bot Registry and Profiles)"]
n29["Command Router (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n195["Event Stream (Transport and Protocol)"]
n240["Claim Repository (Claims and Leases)"]
n211["Rules Store (Shared Infrastructure Plan)"]
n206["Structure Store (Shared Infrastructure Plan)"]
n212["SIP Revision Manager (Shared Infrastructure Plan)"]
n181["Transaction Manager (Memory and Persistence)"]
n174["Fencing Token Authority (Claims and Leases)"]
n193["Presence Tracker (Bot Registry and Profiles)"]
n238["Bot Profile Store (Bot Registry and Profiles)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n216 -->|depends_on| n238
n216 -->|reads| n244
n216 -->|reads| n212
n193 -->|depends_on| n238
n238 -->|depends_on| n181
n240 -->|depends_on| n181
n174 -->|depends_on| n181
n29 -->|controls| n177
n32 -->|delegates_to| n190
n32 -->|depends_on| n181
n199 -->|depends_on| n218
n199 -->|publishes| n195
n218 -->|reads| n240
n218 -->|depends_on| n244
n218 -->|depends_on| n211
n218 -->|depends_on| n206
n219 -->|depends_on| n244
n219 -->|controls| n243
n219 -->|reads| n212
n190 -->|writes| n244
n177 -->|depends_on| n218
n177 -->|depends_on| n219
n177 -->|writes| n244
n177 -->|depends_on| n220
n244 -->|depends_on| n181
n243 -->|depends_on| n174
n243 -->|writes| n244
n245 -->|reads| n193
n245 -->|reads| n238
n245 -->|depends_on| n218
n220 -->|depends_on| n244
n220 -->|depends_on| n206
n50 -->|reads| n218
n50 -->|proposes_to| n177
n50 -->|subscribes| n195
n212 -->|publishes| n219
n212 -->|depends_on| n181
n212 -->|depends_on| n211
n211 -->|depends_on| n181
n206 -->|depends_on| n181
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n244,n220,n218,n219,n177,n243,n245,n190,n199 internal;
class n216,n29,n32,n195,n240,n211,n206,n212,n181,n174,n193,n238,n50 external;
```

### Bot Registry and Profiles

Source: `docs/architecture/graphs/system-bots.mmd`

```mermaid
flowchart LR
n192["Bot Identity Authenticator"]
n238["Bot Profile Store"]
n246["Role Manager"]
n247["Behavior Profile Manager"]
n248["Relationship Store"]
n193["Presence Tracker"]
n216["Delta Sync Planner"]
n189["Resume Orchestrator"]
n249["Agency State Store"]
n250["Name Pool Allocator"]
n70["Deterministic Policy (Brains)"]
n62["Reconnect Supervisor (Bot Runtime and Mineflayer Adapter)"]
n244["Grant Repository (Edit Grants and Collaboration)"]
n212["SIP Revision Manager (Shared Infrastructure Plan)"]
n228["Task Repository (Task Board)"]
n201["Secrets Loader (Config and Profiles)"]
n251["Name Pool Validator (Config and Profiles)"]
n181["Transaction Manager (Memory and Persistence)"]
n236["Claim Releaser (Claims and Leases)"]
n184["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n88["Skill Checkpoint Manager (Skill Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n74["Bot Session Manager (Coordinator Runtime)"]
n245["Owner Offline Policy (Edit Grants and Collaboration)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n162["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n231["Priority Scheduler (Task Board)"]
n198["Transport Authentication (Transport and Protocol)"]
n142["Agency State Adapter (Bot Runtime and Mineflayer Adapter)"]
n163["Agency Status View (Ops and Observability)"]
n252["Agency State (Agency)"]
n70 -->|reads| n247
n62 -->|delegates_to| n216
n247 -->|depends_on| n238
n216 -->|depends_on| n238
n216 -->|reads| n244
n216 -->|reads| n212
n216 -->|reads| n228
n192 -->|depends_on| n238
n192 -->|depends_on| n201
n250 -->|depends_on| n238
n250 -->|depends_on| n251
n193 -->|depends_on| n238
n238 -->|depends_on| n181
n248 -->|depends_on| n238
n189 -->|depends_on| n216
n189 -->|depends_on| n238
n189 -->|delegates_to| n236
n189 -->|delegates_to| n184
n189 -->|reads| n88
n246 -->|depends_on| n238
n32 -->|depends_on| n189
n32 -->|depends_on| n181
n32 -->|depends_on| n184
n74 -->|depends_on| n192
n74 -->|publishes| n193
n244 -->|depends_on| n181
n245 -->|reads| n193
n245 -->|reads| n238
n67 -->|depends_on| n193
n162 -->|depends_on| n193
n162 -->|reads| n212
n162 -->|reads| n228
n42 -->|reads| n238
n42 -->|reads| n212
n42 -->|reads| n228
n212 -->|depends_on| n181
n88 -->|depends_on| n181
n231 -->|reads| n238
n228 -->|depends_on| n181
n198 -->|depends_on| n192
n198 -->|depends_on| n201
n192 -->|writes| n238
n246 -->|writes| n238
n247 -->|writes| n238
n248 -->|writes| n238
n250 -->|writes| n238
n142 -->|persists_to| n249
n249 -->|depends_on| n181
n163 -->|reads| n249
n249 -->|depends_on| n252
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n192,n238,n246,n247,n248,n193,n216,n189,n249,n250 internal;
class n70,n62,n244,n212,n228,n201,n251,n181,n236,n184,n88,n32,n74,n245,n67,n162,n42,n231,n198,n142,n163,n252 external;
```

### World Model and Landmarks

Source: `docs/architecture/graphs/system-world.mmd`

```mermaid
flowchart LR
n202["Observation Ingestor"]
n253["Chunk Version Store"]
n254["Sparse Occupancy Grid"]
n255["Merge Conflict Resolver"]
n256["Confidence Decay"]
n257["Landmark Registry"]
n258["Detector Result Integrator"]
n224["Plan Tagging"]
n222["Spatial Query Engine"]
n221["Container Memory"]
n223["World Reconciler"]
n259["Plot Ownership and Farm Permission"]
n108["Block Verifier (Building)"]
n110["Container Refill Adapter (Building)"]
n109["Material Preflight (Building)"]
n107["Reachability and Scaffold Planner (Building)"]
n104["Schematic Diff (Building)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n158["Active Bot Support Rule (Autonomy and Safety)"]
n160["Safety Policy Engine (Autonomy and Safety)"]
n209["Container Registry (Shared Infrastructure Plan)"]
n214["Dependency Validator (Shared Infrastructure Plan)"]
n184["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n212["SIP Revision Manager (Shared Infrastructure Plan)"]
n52["Skill Context Builder (Skill Runtime)"]
n89["Skill Restore Validator (Skill Runtime)"]
n260["Deposit (Skill Library)"]
n261["Explore (Skill Library)"]
n262["Skill Shared Utilities (Skill Library)"]
n263["Withdraw (Skill Library)"]
n230["Precondition Evaluator (Task Board)"]
n195["Event Stream (Transport and Protocol)"]
n181["Transaction Manager (Memory and Persistence)"]
n180["Message Schema Registry (Transport and Protocol)"]
n210["Path Graph Store (Shared Infrastructure Plan)"]
n108 -->|reads| n222
n110 -->|writes| n221
n109 -->|reads| n52
n109 -->|reads| n221
n107 -->|reads| n222
n104 -->|reads| n222
n42 -->|reads| n212
n42 -->|reads| n222
n45 -->|depends_on| n214
n45 -->|reads| n222
n158 -->|reads| n222
n160 -->|depends_on| n158
n160 -->|reads| n222
n209 -->|depends_on| n181
n209 -->|depends_on| n221
n214 -->|depends_on| n209
n214 -->|depends_on| n210
n214 -->|reads| n222
n210 -->|depends_on| n181
n184 -->|depends_on| n223
n212 -->|depends_on| n181
n212 -->|publishes| n224
n52 -->|reads| n212
n52 -->|reads| n222
n89 -->|depends_on| n222
n260 -->|depends_on| n221
n261 -->|depends_on| n222
n262 -->|depends_on| n52
n262 -->|depends_on| n222
n263 -->|depends_on| n221
n230 -->|reads| n222
n195 -->|publishes| n202
n253 -->|depends_on| n181
n256 -->|depends_on| n253
n256 -->|writes| n257
n221 -->|reads| n209
n221 -->|depends_on| n257
n258 -->|writes| n257
n258 -->|depends_on| n255
n257 -->|depends_on| n181
n255 -->|writes| n253
n255 -->|depends_on| n256
n202 -->|subscribes| n195
n202 -->|reads| n180
n202 -->|writes| n253
n254 -->|depends_on| n253
n224 -->|depends_on| n257
n222 -->|reads| n210
n222 -->|depends_on| n257
n222 -->|depends_on| n254
n223 -->|depends_on| n257
n223 -->|depends_on| n222
n259 -->|depends_on| n257
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n202,n253,n254,n255,n256,n257,n258,n224,n222,n221,n223,n259 internal;
class n108,n110,n109,n107,n104,n42,n45,n158,n160,n209,n214,n184,n212,n52,n89,n260,n261,n262,n263,n230,n195,n181,n180,n210 external;
```

### Perception

Source: `docs/architecture/graphs/system-perception.mmd`

```mermaid
flowchart LR
n264["Ring Sampler"]
n265["Chunk Snapshot Encoder"]
n203["Block Update Listener"]
n266["Path and Road Detector"]
n267["House Detector"]
n268["Farm Detector"]
n269["Storage and Workstation Detector"]
n270["Linear Structure Detector"]
n271["Detector Pipeline"]
n200["Landmark Candidate Emitter"]
n272["Perception Rate Limiter"]
n273["Village Scanner"]
n55["Mineflayer Event Bridge (Bot Runtime and Mineflayer Adapter)"]
n140["Perception Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n274["Detector Fixtures (Testing and Evaluation)"]
n195["Event Stream (Transport and Protocol)"]
n191["Profile Resolver (Config and Profiles)"]
n55 -->|delegates_to| n203
n140 -->|depends_on| n271
n140 -->|depends_on| n264
n56 -->|depends_on| n55
n56 -->|delegates_to| n264
n274 -->|depends_on| n271
n265 -->|depends_on| n264
n271 -->|depends_on| n265
n271 -->|depends_on| n268
n271 -->|depends_on| n267
n271 -->|depends_on| n270
n271 -->|depends_on| n266
n271 -->|depends_on| n269
n268 -->|depends_on| n265
n267 -->|depends_on| n265
n200 -->|depends_on| n271
n200 -->|publishes| n195
n270 -->|depends_on| n265
n266 -->|depends_on| n265
n272 -->|depends_on| n191
n264 -->|depends_on| n272
n269 -->|depends_on| n265
n203 -->|publishes| n195
n273 -->|depends_on| n268
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n264,n265,n203,n266,n267,n268,n269,n270,n271,n200,n272,n273 internal;
class n55,n140,n56,n274,n195,n191 external;
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
n185["Config Schema Validator (Config and Profiles)"]
n180["Message Schema Registry (Transport and Protocol)"]
n275["Hardware Probe (Config and Profiles)"]
n166["Structured Logger (Ops and Observability)"]
n165["Metrics Registry (Ops and Observability)"]
n276["Laya Runtime Resolver (Config and Profiles)"]
n26(["ONNX Runtime / WebGPU Driver"])
n195["Event Stream (Transport and Protocol)"]
n191["Profile Resolver (Config and Profiles)"]
n277["Laya Benchmark Harness (Testing and Evaluation)"]
n167["Health and Readiness (Ops and Observability)"]
n278["Calibration Fitter (Laya Training)"]
n70 -->|subscribes| n195
n275 -->|depends_on| n191
n276 -->|depends_on| n275
n276 -->|depends_on| n191
n191 -->|depends_on| n185
n36 -->|depends_on| n78
n36 -->|depends_on| n34
n36 -->|depends_on| n76
n39 -->|proposes_to| n70
n39 -->|depends_on| n185
n39 -->|depends_on| n38
n79 -->|depends_on| n180
n78 -->|depends_on| n76
n35 -->|depends_on| n275
n35 -->|controls| n34
n35 -->|observes| n166
n80 -->|observes| n165
n80 -->|writes| n165
n34 -->|depends_on| n276
n34 -->|depends_on| n26
n38 -->|depends_on| n36
n38 -->|publishes| n195
n76 -->|subscribes| n195
n77 -->|depends_on| n191
n77 -->|depends_on| n76
n37 -->|controls| n36
n40 -->|controls| n38
n40 -->|depends_on| n76
n277 -->|depends_on| n80
n277 -->|depends_on| n34
n167 -->|depends_on| n34
n278 -->|reads| n39
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n34,n35,n76,n77,n78,n79,n36,n37,n38,n39,n40,n80 internal;
class n70,n185,n180,n275,n166,n165,n276,n195,n191,n277,n167,n278,n26 external;
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
n218["Compatibility Checker (Edit Grants and Collaboration)"]
n177["Grant Issuer (Edit Grants and Collaboration)"]
n195["Event Stream (Transport and Protocol)"]
n165["Metrics Registry (Ops and Observability)"]
n238["Bot Profile Store (Bot Registry and Profiles)"]
n212["SIP Revision Manager (Shared Infrastructure Plan)"]
n228["Task Repository (Task Board)"]
n222["Spatial Query Engine (World Model and Landmarks)"]
n185["Config Schema Validator (Config and Profiles)"]
n201["Secrets Loader (Config and Profiles)"]
n25(["Muse Spark Planner Endpoint"])
n181["Transaction Manager (Memory and Persistence)"]
n214["Dependency Validator (Shared Infrastructure Plan)"]
n211["Rules Store (Shared Infrastructure Plan)"]
n84["Skill Registry (Skill Runtime)"]
n215["SIP Mutation Proposer (Shared Infrastructure Plan)"]
n234["Dead Letter Manager (Task Board)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n238 -->|depends_on| n181
n31 -->|delegates_to| n43
n218 -->|depends_on| n211
n177 -->|depends_on| n218
n50 -->|reads| n218
n50 -->|proposes_to| n177
n50 -->|subscribes| n195
n49 -->|observes| n165
n49 -->|controls| n41
n42 -->|reads| n238
n42 -->|reads| n212
n42 -->|reads| n228
n42 -->|reads| n222
n51 -->|depends_on| n81
n51 -->|reads| n212
n41 -->|depends_on| n185
n41 -->|depends_on| n201
n41 -->|depends_on| n25
n41 -->|delegates_to| n50
n81 -->|depends_on| n181
n46 -->|controls| n51
n46 -->|depends_on| n41
n46 -->|depends_on| n44
n46 -->|depends_on| n45
n44 -->|controls| n46
n45 -->|controls| n46
n45 -->|depends_on| n44
n45 -->|depends_on| n214
n45 -->|reads| n211
n45 -->|reads| n84
n45 -->|reads| n222
n47 -->|depends_on| n46
n47 -->|proposes_to| n215
n48 -->|depends_on| n46
n48 -->|proposes_to| n228
n43 -->|observes| n165
n43 -->|delegates_to| n42
n43 -->|reads| n212
n43 -->|reads| n234
n64 -->|proposes_to| n43
n64 -->|depends_on| n195
n214 -->|reads| n222
n215 -->|depends_on| n214
n215 -->|depends_on| n212
n212 -->|depends_on| n181
n212 -->|depends_on| n211
n211 -->|depends_on| n181
n234 -->|writes| n228
n228 -->|depends_on| n181
n82 -->|depends_on| n81
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n41,n42,n43,n44,n45,n46,n47,n48,n49,n81,n50,n51,n82 internal;
class n31,n218,n177,n195,n165,n238,n212,n228,n222,n185,n201,n181,n214,n211,n84,n215,n234,n64,n25 external;
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
n169["Affordance Enumerator (Brains)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n189["Resume Orchestrator (Bot Registry and Profiles)"]
n109["Material Preflight (Building)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n181["Transaction Manager (Memory and Persistence)"]
n212["SIP Revision Manager (Shared Infrastructure Plan)"]
n222["Spatial Query Engine (World Model and Landmarks)"]
n195["Event Stream (Transport and Protocol)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n165["Metrics Registry (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n279["Craft (Skill Library)"]
n280["Navigate (Skill Library)"]
n281["Place Build (Skill Library)"]
n262["Skill Shared Utilities (Skill Library)"]
n282["Gather Resource (Skill Library)"]
n169 -->|depends_on| n56
n169 -->|depends_on| n69
n169 -->|depends_on| n84
n59 -->|depends_on| n85
n59 -->|depends_on| n86
n56 -->|delegates_to| n52
n189 -->|reads| n88
n109 -->|reads| n52
n45 -->|reads| n84
n45 -->|reads| n222
n63 -->|reads| n69
n69 -->|controls| n63
n212 -->|depends_on| n181
n88 -->|depends_on| n181
n52 -->|reads| n56
n52 -->|reads| n212
n52 -->|depends_on| n88
n52 -->|reads| n222
n90 -->|publishes| n195
n85 -->|depends_on| n52
n85 -->|depends_on| n90
n85 -->|depends_on| n83
n85 -->|depends_on| n84
n91 -->|reads| n63
n91 -->|depends_on| n85
n87 -->|observes| n165
n87 -->|publishes| n195
n89 -->|depends_on| n88
n89 -->|depends_on| n222
n84 -->|depends_on| n83
n86 -->|reads| n69
n86 -->|depends_on| n85
n279 -->|depends_on| n52
n280 -->|depends_on| n83
n281 -->|depends_on| n52
n262 -->|depends_on| n52
n262 -->|depends_on| n222
n282 -->|depends_on| n83
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n83,n84,n85,n86,n52,n87,n88,n89,n90,n91 internal;
class n169,n59,n56,n189,n109,n45,n181,n212,n222,n195,n63,n165,n69,n279,n280,n281,n262,n282 external;
```

### Skill Library

Source: `docs/architecture/graphs/system-skills.mmd`

```mermaid
flowchart LR
n280["Navigate"]
n225["Follow Path"]
n283["Mine"]
n284["Collect"]
n279["Craft"]
n285["Smelt"]
n286["Eat"]
n260["Deposit"]
n263["Withdraw"]
n287["Sleep"]
n288["Flee or Defend"]
n261["Explore"]
n289["Bridge"]
n290["Clear"]
n281["Place Build"]
n291["Construction"]
n292["Procurement"]
n293["Schematic Build"]
n294["Repair"]
n226["Harvest Farm"]
n227["Plant Farm"]
n295["Entity Targeting"]
n296["Equip Gear"]
n297["Gather Food"]
n298["Gather Wool"]
n299["Place Bed"]
n300["Dig Shelter"]
n262["Skill Shared Utilities"]
n282["Gather Resource"]
n53["Block Executor (Building)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n52["Skill Context Builder (Skill Runtime)"]
n221["Container Memory (World Model and Landmarks)"]
n222["Spatial Query Engine (World Model and Landmarks)"]
n152["Mob Threat Evaluator (Autonomy and Safety)"]
n210["Path Graph Store (Shared Infrastructure Plan)"]
n208["Farm Store (Shared Infrastructure Plan)"]
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
n104 -->|reads| n222
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n222
n289 -->|depends_on| n53
n289 -->|depends_on| n280
n290 -->|depends_on| n53
n290 -->|depends_on| n63
n284 -->|depends_on| n57
n284 -->|depends_on| n283
n284 -->|depends_on| n280
n279 -->|depends_on| n57
n279 -->|depends_on| n52
n260 -->|depends_on| n57
n260 -->|depends_on| n221
n286 -->|depends_on| n57
n261 -->|depends_on| n280
n261 -->|depends_on| n222
n288 -->|depends_on| n57
n288 -->|depends_on| n152
n288 -->|depends_on| n280
n225 -->|depends_on| n210
n225 -->|depends_on| n280
n226 -->|depends_on| n57
n226 -->|depends_on| n208
n226 -->|depends_on| n280
n283 -->|depends_on| n57
n283 -->|depends_on| n280
n280 -->|depends_on| n57
n280 -->|depends_on| n83
n281 -->|depends_on| n53
n281 -->|depends_on| n52
n227 -->|depends_on| n57
n227 -->|depends_on| n208
n227 -->|depends_on| n280
n294 -->|depends_on| n53
n294 -->|depends_on| n104
n293 -->|depends_on| n53
n293 -->|depends_on| n106
n293 -->|depends_on| n105
n262 -->|depends_on| n52
n262 -->|depends_on| n222
n287 -->|depends_on| n57
n287 -->|depends_on| n280
n285 -->|depends_on| n57
n285 -->|depends_on| n280
n263 -->|depends_on| n57
n263 -->|depends_on| n221
n222 -->|reads| n210
n124 -->|depends_on| n126
n295 -->|depends_on| n56
n296 -->|depends_on| n262
n296 -->|depends_on| n57
n297 -->|depends_on| n295
n297 -->|depends_on| n262
n297 -->|depends_on| n57
n297 -->|depends_on| n56
n298 -->|depends_on| n295
n298 -->|depends_on| n262
n298 -->|depends_on| n57
n298 -->|depends_on| n56
n299 -->|depends_on| n262
n299 -->|depends_on| n57
n300 -->|depends_on| n262
n300 -->|depends_on| n57
n291 -->|depends_on| n132
n291 -->|depends_on| n124
n292 -->|depends_on| n136
n292 -->|depends_on| n126
n282 -->|depends_on| n83
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n280,n225,n283,n284,n279,n285,n286,n260,n263,n287,n288,n261,n289,n290,n281,n291,n292,n293,n294,n226,n227,n295,n296,n297,n298,n299,n300,n262,n282 internal;
class n53,n63,n57,n52,n221,n222,n152,n210,n208,n83,n104,n106,n105,n56,n132,n124,n136,n126 external;
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
n222["Spatial Query Engine (World Model and Landmarks)"]
n211["Rules Store (Shared Infrastructure Plan)"]
n221["Container Memory (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n301["Block Changelog Writer (Memory and Persistence)"]
n206["Structure Store (Shared Infrastructure Plan)"]
n195["Event Stream (Transport and Protocol)"]
n289["Bridge (Skill Library)"]
n290["Clear (Skill Library)"]
n281["Place Build (Skill Library)"]
n294["Repair (Skill Library)"]
n293["Schematic Build (Skill Library)"]
n291["Construction (Skill Library)"]
n292["Procurement (Skill Library)"]
n57 -->|depends_on| n63
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n108
n53 -->|depends_on| n111
n53 -->|depends_on| n63
n108 -->|depends_on| n92
n108 -->|reads| n222
n93 -->|depends_on| n92
n93 -->|depends_on| n211
n106 -->|depends_on| n92
n106 -->|depends_on| n105
n110 -->|depends_on| n57
n110 -->|writes| n221
n109 -->|depends_on| n92
n109 -->|reads| n52
n109 -->|reads| n221
n107 -->|reads| n56
n107 -->|depends_on| n106
n107 -->|reads| n222
n111 -->|writes| n301
n111 -->|reads| n206
n111 -->|subscribes| n195
n104 -->|depends_on| n92
n104 -->|reads| n222
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
n105 -->|reads| n206
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n222
n289 -->|depends_on| n53
n290 -->|depends_on| n53
n290 -->|depends_on| n63
n281 -->|depends_on| n53
n281 -->|depends_on| n52
n294 -->|depends_on| n53
n294 -->|depends_on| n104
n293 -->|depends_on| n53
n293 -->|depends_on| n106
n293 -->|depends_on| n105
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
n291 -->|depends_on| n124
n125 -->|depends_on| n112
n127 -->|depends_on| n92
n127 -->|depends_on| n104
n127 -->|depends_on| n122
n127 -->|depends_on| n123
n128 -->|depends_on| n92
n128 -->|depends_on| n122
n128 -->|depends_on| n123
n128 -->|depends_on| n111
n292 -->|depends_on| n126
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n92,n93,n94,n95,n96,n97,n98,n99,n100,n101,n102,n103,n104,n105,n106,n107,n108,n53,n109,n110,n111,n112,n113,n114,n115,n116,n117,n118,n119,n120,n121,n122,n123,n124,n125,n126,n127,n128 internal;
class n57,n63,n222,n211,n221,n52,n56,n301,n206,n195,n289,n290,n281,n294,n293,n291,n292 external;
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
n144["Behavior Trace"]
n145["Human Mover"]
n146["Sightings Source"]
n147["Social Presence"]
n148["Farm Permission Service"]
n149["Farm Plot Registry"]
n150["Visibility and Sighting Source"]
n63["Action Veto Gate (Autonomy and Safety)"]
n169["Affordance Enumerator (Brains)"]
n185["Config Schema Validator (Config and Profiles)"]
n24(["Minecraft 1.20.1 LAN Server"])
n70["Deterministic Policy (Brains)"]
n203["Block Update Listener (Perception)"]
n69["Reflex Guardian Loop (Brains)"]
n191["Profile Resolver (Config and Profiles)"]
n271["Detector Pipeline (Perception)"]
n264["Ring Sampler (Perception)"]
n216["Delta Sync Planner (Bot Registry and Profiles)"]
n197["Reconnect Supervisor (Transport and Protocol)"]
n85["Skill Lifecycle Executor (Skill Runtime)"]
n86["Skill Tick Scheduler (Skill Runtime)"]
n195["Event Stream (Transport and Protocol)"]
n52["Skill Context Builder (Skill Runtime)"]
n53["Block Executor (Building)"]
n110["Container Refill Adapter (Building)"]
n107["Reachability and Scaffold Planner (Building)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n284["Collect (Skill Library)"]
n279["Craft (Skill Library)"]
n260["Deposit (Skill Library)"]
n286["Eat (Skill Library)"]
n288["Flee or Defend (Skill Library)"]
n226["Harvest Farm (Skill Library)"]
n283["Mine (Skill Library)"]
n280["Navigate (Skill Library)"]
n227["Plant Farm (Skill Library)"]
n287["Sleep (Skill Library)"]
n285["Smelt (Skill Library)"]
n263["Withdraw (Skill Library)"]
n33["Bot Process Supervisor (Coordinator Runtime)"]
n302["Goal Arbiter (Agency)"]
n303["Intention Manager (Agency)"]
n252["Agency State (Agency)"]
n71["Laya Client (Brains)"]
n304["Social Engine (Agency)"]
n249["Agency State Store (Bot Registry and Profiles)"]
n305["Agent Episode Repository (Memory and Persistence)"]
n295["Entity Targeting (Skill Library)"]
n296["Equip Gear (Skill Library)"]
n297["Gather Food (Skill Library)"]
n298["Gather Wool (Skill Library)"]
n299["Place Bed (Skill Library)"]
n300["Dig Shelter (Skill Library)"]
n291["Construction (Skill Library)"]
n194["Request Correlator (Transport and Protocol)"]
n306["Reflection (Agency)"]
n292["Procurement (Skill Library)"]
n307["Simulation Harness (Testing and Evaluation)"]
n171["Gaze Controller (Brains)"]
n172["Humanization Policy (Brains)"]
n173["Perception Filter (Brains)"]
n180["Message Schema Registry (Transport and Protocol)"]
n57 -->|depends_on| n54
n57 -->|depends_on| n131
n57 -->|depends_on| n63
n169 -->|depends_on| n56
n169 -->|depends_on| n69
n54 -->|depends_on| n185
n54 -->|depends_on| n24
n70 -->|depends_on| n169
n70 -->|depends_on| n139
n70 -->|subscribes| n195
n55 -->|depends_on| n54
n55 -->|delegates_to| n203
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n129 -->|depends_on| n54
n129 -->|depends_on| n191
n140 -->|depends_on| n271
n140 -->|depends_on| n264
n131 -->|depends_on| n185
n62 -->|depends_on| n54
n62 -->|delegates_to| n216
n62 -->|depends_on| n197
n59 -->|depends_on| n85
n59 -->|depends_on| n86
n139 -->|depends_on| n54
n139 -->|depends_on| n56
n139 -->|publishes| n195
n56 -->|depends_on| n55
n56 -->|delegates_to| n264
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n110 -->|depends_on| n57
n107 -->|reads| n56
n191 -->|depends_on| n185
n67 -->|controls| n59
n67 -->|depends_on| n195
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n65 -->|controls| n57
n65 -->|depends_on| n195
n69 -->|controls| n63
n52 -->|reads| n56
n85 -->|depends_on| n52
n86 -->|reads| n69
n86 -->|depends_on| n85
n284 -->|depends_on| n57
n284 -->|depends_on| n283
n284 -->|depends_on| n280
n279 -->|depends_on| n57
n279 -->|depends_on| n52
n260 -->|depends_on| n57
n286 -->|depends_on| n57
n288 -->|depends_on| n57
n288 -->|depends_on| n280
n226 -->|depends_on| n57
n226 -->|depends_on| n280
n283 -->|depends_on| n57
n283 -->|depends_on| n280
n280 -->|depends_on| n57
n227 -->|depends_on| n57
n227 -->|depends_on| n280
n287 -->|depends_on| n57
n287 -->|depends_on| n280
n285 -->|depends_on| n57
n285 -->|depends_on| n280
n263 -->|depends_on| n57
n33 -->|controls| n54
n71 -->|depends_on| n169
n71 -->|depends_on| n70
n203 -->|publishes| n195
n60 -->|depends_on| n302
n60 -->|depends_on| n303
n60 -->|depends_on| n252
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n139
n60 -->|delegates_to| n59
n61 -->|depends_on| n304
n61 -->|publishes| n195
n142 -->|persists_to| n249
n60 -->|persists_to| n305
n303 -->|depends_on| n302
n252 -->|depends_on| n303
n304 -->|proposes_to| n61
n249 -->|depends_on| n252
n295 -->|depends_on| n56
n296 -->|depends_on| n57
n297 -->|depends_on| n295
n297 -->|depends_on| n57
n297 -->|depends_on| n56
n298 -->|depends_on| n295
n298 -->|depends_on| n57
n298 -->|depends_on| n56
n299 -->|depends_on| n57
n300 -->|depends_on| n57
n130 -->|depends_on| n56
n291 -->|depends_on| n132
n135 -->|depends_on| n133
n133 -->|depends_on| n194
n60 -->|depends_on| n141
n141 -->|depends_on| n302
n134 -->|depends_on| n194
n135 -->|depends_on| n134
n60 -->|depends_on| n306
n292 -->|depends_on| n136
n136 -->|depends_on| n137
n136 -->|depends_on| n138
n137 -->|depends_on| n56
n138 -->|depends_on| n56
n307 -->|depends_on| n143
n171 -->|depends_on| n57
n172 -->|depends_on| n145
n173 -->|depends_on| n146
n144 -->|depends_on| n180
n145 -->|depends_on| n144
n146 -->|depends_on| n56
n147 -->|depends_on| n61
n148 -->|depends_on| n55
n148 -->|depends_on| n149
n150 -->|depends_on| n140
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n54,n129,n55,n56,n130,n131,n57,n132,n133,n134,n135,n136,n137,n138,n139,n58,n59,n140,n60,n141,n61,n142,n62,n143,n144,n145,n146,n147,n148,n149,n150 internal;
class n63,n169,n185,n70,n203,n69,n191,n271,n264,n216,n197,n85,n86,n195,n52,n53,n110,n107,n67,n65,n284,n279,n260,n286,n288,n226,n283,n280,n227,n287,n285,n263,n33,n302,n303,n252,n71,n304,n249,n305,n295,n296,n297,n298,n299,n300,n291,n194,n306,n292,n307,n171,n172,n173,n180,n24 external;
```

### Autonomy and Safety

Source: `docs/architecture/graphs/system-safety.mmd`

```mermaid
flowchart LR
n151["Hazard Evaluator"]
n152["Mob Threat Evaluator"]
n153["Hunger Evaluator"]
n154["Stuck and Timeout Evaluator"]
n155["Inventory Evaluator"]
n156["Claim Loss Evaluator"]
n157["Protected BBox Rule"]
n158["Active Bot Support Rule"]
n159["Material Ban Rule"]
n160["Safety Policy Engine"]
n63["Action Veto Gate"]
n64["Recovery Ladder"]
n65["Emergency Stop Controller"]
n161["Incident Journal"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n53["Block Executor (Building)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n240["Claim Repository (Claims and Leases)"]
n222["Spatial Query Engine (World Model and Landmarks)"]
n29["Command Router (Coordinator Runtime)"]
n195["Event Stream (Transport and Protocol)"]
n239["Event Log Writer (Memory and Persistence)"]
n211["Rules Store (Shared Infrastructure Plan)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n91["Skill Preemption Handler (Skill Runtime)"]
n290["Clear (Skill Library)"]
n288["Flee or Defend (Skill Library)"]
n57 -->|depends_on| n63
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n68 -->|controls| n65
n68 -->|depends_on| n195
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n63 -->|depends_on| n160
n158 -->|reads| n240
n158 -->|reads| n222
n156 -->|reads| n240
n65 -->|controls| n57
n65 -->|controls| n29
n65 -->|depends_on| n195
n69 -->|controls| n63
n69 -->|depends_on| n156
n69 -->|depends_on| n151
n69 -->|depends_on| n153
n69 -->|depends_on| n155
n69 -->|depends_on| n152
n69 -->|depends_on| n154
n161 -->|writes| n239
n157 -->|reads| n240
n157 -->|reads| n211
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n64 -->|depends_on| n195
n160 -->|reads| n240
n160 -->|depends_on| n158
n160 -->|depends_on| n159
n160 -->|depends_on| n157
n160 -->|reads| n211
n160 -->|reads| n222
n91 -->|reads| n63
n290 -->|depends_on| n53
n290 -->|depends_on| n63
n288 -->|depends_on| n57
n288 -->|depends_on| n152
n68 -->|writes| n239
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n151,n152,n153,n154,n155,n156,n157,n158,n159,n160,n63,n64,n65,n161 internal;
class n57,n58,n53,n68,n69,n240,n222,n29,n195,n239,n211,n43,n91,n290,n288 external;
```

### Memory and Persistence

Source: `docs/architecture/graphs/system-memory.mmd`

```mermaid
flowchart LR
n308["SQLite Runtime"]
n187["Migration Runner"]
n181["Transaction Manager"]
n239["Event Log Writer"]
n301["Block Changelog Writer"]
n183["Retention Pruner"]
n309["Snapshot Export"]
n310["Schema Version Registry"]
n311["Episode Store"]
n305["Agent Episode Repository"]
n238["Bot Profile Store (Bot Registry and Profiles)"]
n111["Rollback Journal (Building)"]
n176["Atomic Claim Acquirer (Claims and Leases)"]
n240["Claim Repository (Claims and Leases)"]
n174["Fencing Token Authority (Claims and Leases)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n72["Process Bootstrap (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n312["Replay Engine (Testing and Evaluation)"]
n244["Grant Repository (Edit Grants and Collaboration)"]
n168["Audit Viewer (Ops and Observability)"]
n167["Health and Readiness (Ops and Observability)"]
n81["Plan Cache (Cloud Planner Advisor)"]
n161["Incident Journal (Autonomy and Safety)"]
n209["Container Registry (Shared Infrastructure Plan)"]
n208["Farm Store (Shared Infrastructure Plan)"]
n210["Path Graph Store (Shared Infrastructure Plan)"]
n212["SIP Revision Manager (Shared Infrastructure Plan)"]
n207["Road Store (Shared Infrastructure Plan)"]
n211["Rules Store (Shared Infrastructure Plan)"]
n206["Structure Store (Shared Infrastructure Plan)"]
n178["SIP Transactional Committer (Shared Infrastructure Plan)"]
n205["Zone Store (Shared Infrastructure Plan)"]
n88["Skill Checkpoint Manager (Skill Runtime)"]
n179["Atomic Task Claimer (Task Board)"]
n228["Task Repository (Task Board)"]
n235["Task State Machine (Task Board)"]
n313["Trace Exporter (Laya Training)"]
n253["Chunk Version Store (World Model and Landmarks)"]
n257["Landmark Registry (World Model and Landmarks)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n249["Agency State Store (Bot Registry and Profiles)"]
n163["Agency Status View (Ops and Observability)"]
n238 -->|depends_on| n181
n111 -->|writes| n301
n111 -->|reads| n206
n176 -->|writes| n240
n176 -->|depends_on| n181
n240 -->|depends_on| n181
n174 -->|depends_on| n30
n174 -->|depends_on| n181
n30 -->|controls| n174
n30 -->|depends_on| n181
n31 -->|depends_on| n30
n31 -->|delegates_to| n183
n72 -->|depends_on| n32
n72 -->|depends_on| n187
n32 -->|depends_on| n181
n312 -->|depends_on| n239
n244 -->|depends_on| n181
n301 -->|depends_on| n181
n239 -->|depends_on| n181
n187 -->|depends_on| n308
n183 -->|depends_on| n301
n183 -->|depends_on| n239
n183 -->|depends_on| n181
n310 -->|depends_on| n187
n309 -->|depends_on| n181
n181 -->|depends_on| n308
n168 -->|reads| n301
n168 -->|reads| n239
n167 -->|depends_on| n308
n81 -->|depends_on| n181
n161 -->|writes| n239
n209 -->|depends_on| n181
n208 -->|depends_on| n181
n210 -->|depends_on| n181
n212 -->|depends_on| n181
n212 -->|depends_on| n211
n207 -->|depends_on| n181
n211 -->|depends_on| n181
n206 -->|depends_on| n181
n178 -->|depends_on| n181
n178 -->|writes| n209
n178 -->|writes| n208
n178 -->|writes| n210
n178 -->|depends_on| n212
n178 -->|writes| n207
n178 -->|writes| n211
n178 -->|writes| n206
n178 -->|writes| n205
n205 -->|depends_on| n181
n88 -->|depends_on| n181
n179 -->|depends_on| n181
n179 -->|writes| n228
n228 -->|depends_on| n181
n235 -->|depends_on| n239
n235 -->|writes| n228
n313 -->|reads| n239
n253 -->|depends_on| n181
n257 -->|depends_on| n181
n312 -->|reads| n311
n313 -->|reads| n311
n168 -->|reads| n311
n183 -->|depends_on| n311
n67 -->|writes| n239
n68 -->|writes| n239
n60 -->|persists_to| n305
n249 -->|depends_on| n181
n305 -->|depends_on| n181
n163 -->|reads| n249
n163 -->|reads| n305
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n308,n187,n181,n239,n301,n183,n309,n310,n311,n305 internal;
class n238,n111,n176,n240,n174,n30,n31,n72,n32,n312,n244,n168,n167,n81,n161,n209,n208,n210,n212,n207,n211,n206,n178,n205,n88,n179,n228,n235,n313,n253,n257,n67,n68,n60,n249,n163 external;
```

### Ops and Observability

Source: `docs/architecture/graphs/system-ops.mmd`

```mermaid
flowchart LR
n66["Ops API"]
n162["Status Aggregator"]
n163["Agency Status View"]
n67["Pause and Resume Controller"]
n68["Fleet Emergency Stop"]
n164["SIP Dump"]
n165["Metrics Registry"]
n166["Structured Logger"]
n167["Health and Readiness"]
n168["Audit Viewer"]
n242["Contention Metrics (Claims and Leases)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n80["Latency Metrics (Laya Decision Service)"]
n314["Metrics Reporter (Testing and Evaluation)"]
n28(["Fleet Operator"])
n301["Block Changelog Writer (Memory and Persistence)"]
n239["Event Log Writer (Memory and Persistence)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n195["Event Stream (Transport and Protocol)"]
n34["Model Loader (Laya Decision Service)"]
n308["SQLite Runtime (Memory and Persistence)"]
n180["Message Schema Registry (Transport and Protocol)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n193["Presence Tracker (Bot Registry and Profiles)"]
n212["SIP Revision Manager (Shared Infrastructure Plan)"]
n240["Claim Repository (Claims and Leases)"]
n228["Task Repository (Task Board)"]
n49["Planner Budget Limiter (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n87["Skill Progress Reporter (Skill Runtime)"]
n311["Episode Store (Memory and Persistence)"]
n249["Agency State Store (Bot Registry and Profiles)"]
n305["Agent Episode Repository (Memory and Persistence)"]
n242 -->|depends_on| n240
n242 -->|observes| n165
n35 -->|controls| n34
n35 -->|observes| n166
n80 -->|observes| n165
n80 -->|writes| n165
n314 -->|observes| n165
n28 -->|controls| n66
n168 -->|reads| n301
n168 -->|reads| n239
n68 -->|controls| n65
n68 -->|depends_on| n195
n167 -->|depends_on| n34
n167 -->|depends_on| n308
n167 -->|depends_on| n162
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n162
n66 -->|depends_on| n180
n67 -->|controls| n59
n67 -->|depends_on| n193
n67 -->|depends_on| n195
n164 -->|depends_on| n212
n162 -->|depends_on| n193
n162 -->|reads| n240
n162 -->|observes| n165
n162 -->|reads| n212
n162 -->|reads| n228
n49 -->|observes| n165
n43 -->|observes| n165
n43 -->|reads| n212
n65 -->|depends_on| n195
n87 -->|observes| n165
n87 -->|publishes| n195
n168 -->|reads| n311
n67 -->|writes| n239
n68 -->|writes| n239
n163 -->|reads| n249
n163 -->|reads| n305
n66 -->|depends_on| n163
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n66,n162,n163,n67,n68,n164,n165,n166,n167,n168 internal;
class n242,n35,n80,n314,n301,n239,n65,n195,n34,n308,n180,n59,n193,n212,n240,n228,n49,n43,n87,n311,n249,n305,n28 external;
```

### Config and Profiles

Source: `docs/architecture/graphs/system-config.mmd`

```mermaid
flowchart LR
n186["Environment Parser"]
n185["Config Schema Validator"]
n191["Profile Resolver"]
n275["Hardware Probe"]
n201["Secrets Loader"]
n251["Name Pool Validator"]
n276["Laya Runtime Resolver"]
n315["Fail Fast Handler"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n129["Join and Auth (Bot Runtime and Mineflayer Adapter)"]
n131["Reach and Rate Guard (Bot Runtime and Mineflayer Adapter)"]
n192["Bot Identity Authenticator (Bot Registry and Profiles)"]
n250["Name Pool Allocator (Bot Registry and Profiles)"]
n27(["Host Hardware"])
n72["Process Bootstrap (Coordinator Runtime)"]
n73["Service Composition (Coordinator Runtime)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n77["Decision Rate Limiter (Laya Decision Service)"]
n272["Perception Rate Limiter (Perception)"]
n41["OpenAI-Compatible Client (Cloud Planner Advisor)"]
n198["Transport Authentication (Transport and Protocol)"]
n170["Tactical Decision Policy (Brains)"]
n54 -->|depends_on| n185
n129 -->|depends_on| n54
n129 -->|depends_on| n191
n131 -->|depends_on| n185
n192 -->|depends_on| n201
n250 -->|depends_on| n251
n185 -->|depends_on| n186
n315 -->|depends_on| n185
n275 -->|depends_on| n191
n275 -->|depends_on| n27
n276 -->|depends_on| n275
n276 -->|depends_on| n191
n251 -->|depends_on| n185
n191 -->|depends_on| n185
n201 -->|depends_on| n186
n72 -->|depends_on| n185
n72 -->|depends_on| n186
n72 -->|depends_on| n73
n73 -->|depends_on| n191
n39 -->|depends_on| n185
n35 -->|depends_on| n275
n35 -->|controls| n34
n34 -->|depends_on| n276
n77 -->|depends_on| n191
n272 -->|depends_on| n191
n41 -->|depends_on| n185
n41 -->|depends_on| n201
n198 -->|depends_on| n192
n198 -->|depends_on| n201
n170 -->|depends_on| n185
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n186,n185,n191,n275,n201,n251,n276,n315 internal;
class n54,n129,n131,n192,n250,n72,n73,n39,n35,n34,n77,n272,n41,n198,n170,n27 external;
```

### Testing and Evaluation

Source: `docs/architecture/graphs/system-eval.mmd`

```mermaid
flowchart LR
n316["Unit Fixtures"]
n274["Detector Fixtures"]
n317["Docker Server Harness"]
n318["Scenario Runner"]
n312["Replay Engine"]
n237["Contention Harness"]
n314["Metrics Reporter"]
n319["Soak Runner"]
n320["Architecture Guard Tests"]
n277["Laya Benchmark Harness"]
n307["Simulation Harness"]
n321["Behavior Assertions"]
n322["Trace Inspector"]
n323["Behavior Oddity Detectors"]
n240["Claim Repository (Claims and Leases)"]
n228["Task Repository (Task Board)"]
n271["Detector Pipeline (Perception)"]
n24(["Minecraft 1.20.1 LAN Server"])
n80["Latency Metrics (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n165["Metrics Registry (Ops and Observability)"]
n239["Event Log Writer (Memory and Persistence)"]
n324["Promotion Gate (Laya Training)"]
n311["Episode Store (Memory and Persistence)"]
n143["Headless Bot Runtime (Bot Runtime and Mineflayer Adapter)"]
n80 -->|observes| n165
n80 -->|writes| n165
n320 -->|depends_on| n316
n237 -->|depends_on| n240
n237 -->|delegates_to| n318
n237 -->|depends_on| n228
n274 -->|depends_on| n316
n274 -->|depends_on| n271
n317 -->|depends_on| n316
n317 -->|depends_on| n24
n277 -->|depends_on| n80
n277 -->|depends_on| n34
n277 -->|delegates_to| n318
n314 -->|observes| n165
n312 -->|depends_on| n318
n312 -->|depends_on| n239
n318 -->|controls| n317
n318 -->|publishes| n314
n319 -->|depends_on| n314
n319 -->|delegates_to| n318
n324 -->|depends_on| n277
n312 -->|reads| n311
n307 -->|depends_on| n143
n307 -->|depends_on| n321
n322 -->|depends_on| n307
n323 -->|depends_on| n321
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n316,n274,n317,n318,n312,n237,n314,n319,n320,n277,n307,n321,n322,n323 internal;
class n240,n228,n271,n80,n34,n165,n239,n324,n311,n143,n24 external;
```

### Laya Training

Source: `docs/architecture/graphs/system-training.mmd`

```mermaid
flowchart LR
n313["Trace Exporter"]
n325["Labeling Pipeline"]
n326["Reward Computer"]
n327["Fine-tune Runner"]
n328["ONNX Exporter"]
n278["Calibration Fitter"]
n324["Promotion Gate"]
n39["Confidence Calibrator (Laya Decision Service)"]
n277["Laya Benchmark Harness (Testing and Evaluation)"]
n239["Event Log Writer (Memory and Persistence)"]
n311["Episode Store (Memory and Persistence)"]
n278 -->|reads| n39
n278 -->|depends_on| n313
n327 -->|depends_on| n325
n327 -->|depends_on| n326
n325 -->|depends_on| n313
n328 -->|depends_on| n327
n324 -->|depends_on| n277
n324 -->|depends_on| n278
n324 -->|depends_on| n328
n326 -->|depends_on| n313
n313 -->|reads| n239
n313 -->|reads| n311
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n313,n325,n326,n327,n328,n278,n324 internal;
class n39,n277,n239,n311 external;
```

### Brains

Source: `docs/architecture/graphs/system-brains.mmd`

```mermaid
flowchart LR
n69["Reflex Guardian Loop"]
n169["Affordance Enumerator"]
n70["Deterministic Policy"]
n71["Laya Client"]
n170["Tactical Decision Policy"]
n171["Gaze Controller"]
n172["Humanization Policy"]
n173["Perception Filter"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n84["Skill Registry (Skill Runtime)"]
n139["State Digest Collector (Bot Runtime and Mineflayer Adapter)"]
n247["Behavior Profile Manager (Bot Registry and Profiles)"]
n195["Event Stream (Transport and Protocol)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n156["Claim Loss Evaluator (Autonomy and Safety)"]
n151["Hazard Evaluator (Autonomy and Safety)"]
n153["Hunger Evaluator (Autonomy and Safety)"]
n155["Inventory Evaluator (Autonomy and Safety)"]
n152["Mob Threat Evaluator (Autonomy and Safety)"]
n154["Stuck and Timeout Evaluator (Autonomy and Safety)"]
n86["Skill Tick Scheduler (Skill Runtime)"]
n188["WebSocket Codec (Transport and Protocol)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n185["Config Schema Validator (Config and Profiles)"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n145["Human Mover (Bot Runtime and Mineflayer Adapter)"]
n146["Sightings Source (Bot Runtime and Mineflayer Adapter)"]
n57 -->|depends_on| n63
n169 -->|depends_on| n56
n169 -->|depends_on| n69
n169 -->|depends_on| n84
n70 -->|depends_on| n169
n70 -->|depends_on| n139
n70 -->|reads| n247
n70 -->|subscribes| n195
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n139 -->|depends_on| n56
n139 -->|publishes| n195
n39 -->|proposes_to| n70
n39 -->|depends_on| n185
n63 -->|validates| n57
n63 -->|reads| n69
n69 -->|controls| n63
n69 -->|depends_on| n156
n69 -->|depends_on| n151
n69 -->|depends_on| n153
n69 -->|depends_on| n155
n69 -->|depends_on| n152
n69 -->|depends_on| n154
n86 -->|reads| n69
n195 -->|depends_on| n188
n71 -->|depends_on| n169
n71 -->|depends_on| n188
n71 -->|depends_on| n70
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n139
n71 -->|depends_on| n170
n170 -->|depends_on| n185
n171 -->|depends_on| n57
n172 -->|depends_on| n145
n173 -->|depends_on| n146
n146 -->|depends_on| n56
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n69,n169,n70,n71,n170,n171,n172,n173 internal;
class n56,n84,n139,n247,n195,n58,n39,n63,n156,n151,n153,n155,n152,n154,n86,n188,n60,n185,n57,n145,n146 external;
```

### Agency

Source: `docs/architecture/graphs/system-agency.mmd`

```mermaid
flowchart LR
n329["Personality Model"]
n330["Needs Model"]
n331["Goal Catalog"]
n332["Goal Generator"]
n302["Goal Arbiter"]
n303["Intention Manager"]
n333["Routine Model"]
n334["Item Knowledge"]
n335["Night Preparation Config"]
n336["Shelter Strategy"]
n337["Shelter Plan"]
n338["Night Readiness"]
n304["Social Engine"]
n339["Working Memory"]
n340["Project Focus Policy"]
n252["Agency State"]
n341["Strategic Intent Policy"]
n306["Reflection"]
n342["Goal Deadline Policy"]
n343["Idle Life"]
n344["Progression Plan"]
n345["Progression Planner"]
n346["Recipe Port"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n249["Agency State Store (Bot Registry and Profiles)"]
n141["Goal Tie-Break (Bot Runtime and Mineflayer Adapter)"]
n60 -->|depends_on| n302
n60 -->|depends_on| n303
n60 -->|depends_on| n252
n61 -->|depends_on| n304
n332 -->|depends_on| n331
n332 -->|depends_on| n330
n332 -->|depends_on| n329
n302 -->|depends_on| n332
n302 -->|depends_on| n330
n302 -->|depends_on| n329
n303 -->|depends_on| n302
n304 -->|depends_on| n329
n252 -->|depends_on| n330
n252 -->|depends_on| n329
n252 -->|depends_on| n303
n252 -->|depends_on| n333
n252 -->|depends_on| n339
n340 -->|depends_on| n339
n304 -->|proposes_to| n61
n249 -->|depends_on| n252
n338 -->|depends_on| n334
n338 -->|depends_on| n335
n338 -->|depends_on| n333
n338 -->|depends_on| n337
n338 -->|depends_on| n336
n336 -->|depends_on| n335
n332 -->|depends_on| n335
n332 -->|depends_on| n338
n332 -->|depends_on| n333
n341 -->|depends_on| n302
n341 -->|depends_on| n339
n60 -->|depends_on| n141
n141 -->|depends_on| n302
n60 -->|depends_on| n306
n342 -->|depends_on| n303
n343 -->|depends_on| n332
n344 -->|depends_on| n339
n345 -->|depends_on| n344
n346 -->|depends_on| n344
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n329,n330,n331,n332,n302,n303,n333,n334,n335,n336,n337,n338,n304,n339,n340,n252,n341,n306,n342,n343,n344,n345,n346 internal;
class n60,n61,n249,n141 external;
```

### Bootstrap and Toolchain

Source: `docs/architecture/graphs/system-toolchain.mmd`

```mermaid
flowchart LR
n347["Bootstrap Orchestrator"]
n348["Capability Check"]
n349["Python Environment"]
n350["Minecraft Server Controller"]
n351["Firefox SVG Renderer"]
n347 -->|depends_on| n348
n347 -->|depends_on| n349
n347 -->|depends_on| n350
n347 -->|depends_on| n351
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n347,n348,n349,n350,n351 internal;
```
