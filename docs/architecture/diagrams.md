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
n163["Fencing Token Authority (Claims and Leases)"]
n164["Flow Control (Transport and Protocol)"]
n165["Atomic Claim Acquirer (Claims and Leases)"]
n166["Grant Issuer (Edit Grants and Collaboration)"]
n167["SIP Transactional Committer (Shared Infrastructure Plan)"]
n168["Atomic Task Claimer (Task Board)"]
n169["Message Schema Registry (Transport and Protocol)"]
n170["Transaction Manager (Memory and Persistence)"]
n171["Lease Reaper (Claims and Leases)"]
n172["Retention Pruner (Memory and Persistence)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n173["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n174["Config Schema Validator (Config and Profiles)"]
n175["Environment Parser (Config and Profiles)"]
n176["Migration Runner (Memory and Persistence)"]
n177["WebSocket Codec (Transport and Protocol)"]
n178["Resume Orchestrator (Bot Registry and Profiles)"]
n179["Grant Expiry (Edit Grants and Collaboration)"]
n180["Profile Resolver (Config and Profiles)"]
n181["Bot Identity Authenticator (Bot Registry and Profiles)"]
n182["Presence Tracker (Bot Registry and Profiles)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n54 -->|depends_on| n174
n178 -->|delegates_to| n173
n165 -->|depends_on| n170
n163 -->|depends_on| n30
n163 -->|depends_on| n170
n174 -->|depends_on| n175
n180 -->|depends_on| n174
n75 -->|depends_on| n164
n29 -->|controls| n165
n29 -->|controls| n166
n29 -->|controls| n167
n29 -->|controls| n168
n29 -->|depends_on| n169
n30 -->|controls| n163
n30 -->|depends_on| n170
n31 -->|delegates_to| n171
n31 -->|depends_on| n30
n31 -->|delegates_to| n172
n31 -->|delegates_to| n43
n31 -->|delegates_to| n173
n72 -->|depends_on| n174
n72 -->|depends_on| n175
n72 -->|depends_on| n32
n72 -->|depends_on| n73
n72 -->|depends_on| n176
n72 -->|depends_on| n177
n32 -->|depends_on| n178
n32 -->|delegates_to| n171
n32 -->|delegates_to| n179
n32 -->|depends_on| n170
n32 -->|depends_on| n173
n73 -->|depends_on| n180
n73 -->|depends_on| n31
n74 -->|depends_on| n181
n74 -->|publishes| n182
n74 -->|depends_on| n177
n172 -->|depends_on| n170
n65 -->|controls| n29
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n173 -->|depends_on| n167
n167 -->|depends_on| n170
n168 -->|depends_on| n170
n177 -->|depends_on| n169
n33 -->|controls| n54
n33 -->|depends_on| n30
n32 -->|depends_on| n33
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n72,n73,n74,n29,n30,n31,n32,n75,n33 internal;
class n163,n164,n165,n166,n167,n168,n169,n170,n171,n172,n43,n173,n174,n175,n176,n177,n178,n179,n180,n181,n182,n65,n64,n54 external;
```

### Transport and Protocol

Source: `docs/architecture/graphs/system-transport.mmd`

```mermaid
flowchart LR
n169["Message Schema Registry"]
n177["WebSocket Codec"]
n183["Request Correlator"]
n184["Event Stream"]
n185["Delta Sync Protocol"]
n186["Reconnect Supervisor"]
n187["Transport Authentication"]
n164["Flow Control"]
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
n188["Arbitration Adapter (Edit Grants and Collaboration)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n66["Ops API (Ops and Observability)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n189["Landmark Candidate Emitter (Perception)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n90["Typed Effects Emitter (Skill Runtime)"]
n87["Skill Progress Reporter (Skill Runtime)"]
n181["Bot Identity Authenticator (Bot Registry and Profiles)"]
n190["Secrets Loader (Config and Profiles)"]
n191["Observation Ingestor (World Model and Landmarks)"]
n71["Laya Client (Brains)"]
n192["Block Update Listener (Perception)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n193["Bot Claim Command Handler (Claims and Leases)"]
n133["Blueprint Fetch Client (Bot Runtime and Mineflayer Adapter)"]
n134["Construction Plan Fetch Client (Bot Runtime and Mineflayer Adapter)"]
n70 -->|depends_on| n139
n70 -->|subscribes| n184
n62 -->|depends_on| n186
n139 -->|publishes| n184
n181 -->|depends_on| n190
n111 -->|subscribes| n184
n75 -->|depends_on| n164
n29 -->|depends_on| n169
n72 -->|depends_on| n177
n74 -->|depends_on| n181
n74 -->|depends_on| n177
n79 -->|depends_on| n169
n38 -->|publishes| n184
n76 -->|subscribes| n184
n188 -->|publishes| n184
n68 -->|controls| n65
n68 -->|depends_on| n184
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n169
n67 -->|depends_on| n184
n189 -->|publishes| n184
n50 -->|subscribes| n184
n65 -->|controls| n29
n65 -->|depends_on| n184
n64 -->|proposes_to| n29
n64 -->|controls| n65
n64 -->|depends_on| n184
n90 -->|publishes| n184
n87 -->|publishes| n184
n187 -->|depends_on| n181
n187 -->|depends_on| n190
n185 -->|depends_on| n169
n184 -->|depends_on| n177
n184 -->|publishes| n191
n164 -->|depends_on| n183
n186 -->|depends_on| n177
n183 -->|depends_on| n177
n177 -->|depends_on| n169
n191 -->|subscribes| n184
n191 -->|reads| n169
n71 -->|depends_on| n177
n71 -->|depends_on| n70
n192 -->|publishes| n184
n61 -->|publishes| n184
n193 -->|depends_on| n177
n133 -->|depends_on| n183
n134 -->|depends_on| n183
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n169,n177,n183,n184,n185,n186,n187,n164 internal;
class n70,n62,n139,n111,n75,n29,n72,n74,n79,n38,n76,n188,n68,n66,n67,n189,n50,n65,n64,n90,n87,n181,n190,n191,n71,n192,n61,n193,n133,n134 external;
```

### Shared Infrastructure Plan

Source: `docs/architecture/graphs/system-sip.mmd`

```mermaid
flowchart LR
n194["Zone Store"]
n195["Structure Store"]
n196["Road Store"]
n197["Farm Store"]
n198["Container Registry"]
n199["Path Graph Store"]
n200["Rules Store"]
n201["SIP Revision Manager"]
n202["Spatial Overlap Validator"]
n203["Dependency Validator"]
n204["SIP Mutation Proposer"]
n167["SIP Transactional Committer"]
n173["SIP Reconciliation Engine"]
n205["Delta Sync Planner (Bot Registry and Profiles)"]
n178["Resume Orchestrator (Bot Registry and Profiles)"]
n93["Blueprint Validator (Building)"]
n111["Rollback Journal (Building)"]
n105["Work Package Partitioner (Building)"]
n206["Overlap Margin Checker (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n207["Compatibility Checker (Edit Grants and Collaboration)"]
n208["Design Revision Guard (Edit Grants and Collaboration)"]
n209["Collaboration Policy Evaluator (Edit Grants and Collaboration)"]
n156["SIP Dump (Ops and Observability)"]
n154["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n51["Keep Last Good Fallback (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n47["SIP Mutation Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n149["Protected BBox Rule (Autonomy and Safety)"]
n152["Safety Policy Engine (Autonomy and Safety)"]
n170["Transaction Manager (Memory and Persistence)"]
n210["Container Memory (World Model and Landmarks)"]
n211["Spatial Query Engine (World Model and Landmarks)"]
n212["World Reconciler (World Model and Landmarks)"]
n213["Plan Tagging (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n214["Follow Path (Skill Library)"]
n215["Harvest Farm (Skill Library)"]
n216["Plant Farm (Skill Library)"]
n205 -->|reads| n201
n178 -->|depends_on| n205
n178 -->|delegates_to| n173
n93 -->|depends_on| n200
n111 -->|reads| n195
n105 -->|reads| n195
n206 -->|depends_on| n202
n29 -->|controls| n167
n31 -->|delegates_to| n43
n31 -->|delegates_to| n173
n32 -->|depends_on| n178
n32 -->|depends_on| n170
n32 -->|depends_on| n173
n207 -->|depends_on| n200
n207 -->|depends_on| n195
n208 -->|reads| n201
n209 -->|depends_on| n195
n156 -->|depends_on| n201
n154 -->|reads| n201
n42 -->|reads| n201
n42 -->|reads| n211
n51 -->|reads| n201
n45 -->|depends_on| n203
n45 -->|reads| n200
n45 -->|reads| n211
n47 -->|proposes_to| n204
n43 -->|delegates_to| n42
n43 -->|reads| n201
n149 -->|reads| n200
n152 -->|depends_on| n149
n152 -->|reads| n200
n152 -->|reads| n211
n198 -->|depends_on| n170
n198 -->|depends_on| n210
n203 -->|depends_on| n198
n203 -->|depends_on| n197
n203 -->|depends_on| n199
n203 -->|depends_on| n196
n203 -->|depends_on| n195
n203 -->|reads| n211
n197 -->|depends_on| n170
n204 -->|depends_on| n203
n204 -->|depends_on| n201
n204 -->|depends_on| n202
n199 -->|depends_on| n170
n173 -->|depends_on| n197
n173 -->|depends_on| n196
n173 -->|depends_on| n195
n173 -->|depends_on| n167
n173 -->|depends_on| n212
n201 -->|publishes| n208
n201 -->|depends_on| n170
n201 -->|depends_on| n200
n201 -->|publishes| n213
n196 -->|depends_on| n170
n200 -->|depends_on| n170
n202 -->|reads| n200
n202 -->|depends_on| n195
n202 -->|depends_on| n194
n195 -->|depends_on| n170
n167 -->|depends_on| n170
n167 -->|writes| n198
n167 -->|writes| n197
n167 -->|writes| n199
n167 -->|depends_on| n201
n167 -->|writes| n196
n167 -->|writes| n200
n167 -->|writes| n195
n167 -->|writes| n194
n194 -->|depends_on| n170
n52 -->|reads| n201
n52 -->|reads| n211
n214 -->|depends_on| n199
n215 -->|depends_on| n197
n216 -->|depends_on| n197
n210 -->|reads| n198
n211 -->|reads| n199
n212 -->|depends_on| n211
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n194,n195,n196,n197,n198,n199,n200,n201,n202,n203,n204,n167,n173 internal;
class n205,n178,n93,n111,n105,n206,n29,n31,n32,n207,n208,n209,n156,n154,n42,n51,n45,n47,n43,n149,n152,n170,n210,n211,n212,n213,n52,n214,n215,n216 external;
```

### Task Board

Source: `docs/architecture/graphs/system-tasks.mmd`

```mermaid
flowchart LR
n217["Task Repository"]
n218["Task DAG Resolver"]
n219["Precondition Evaluator"]
n220["Priority Scheduler"]
n168["Atomic Task Claimer"]
n221["Job Offer Service"]
n222["Retry Manager"]
n223["Dead Letter Manager"]
n224["Task State Machine"]
n205["Delta Sync Planner (Bot Registry and Profiles)"]
n225["Claim Releaser (Claims and Leases)"]
n171["Lease Reaper (Claims and Leases)"]
n29["Command Router (Coordinator Runtime)"]
n226["Contention Harness (Testing and Evaluation)"]
n154["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n48["Task DAG Translator (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n170["Transaction Manager (Memory and Persistence)"]
n211["Spatial Query Engine (World Model and Landmarks)"]
n227["Bot Profile Store (Bot Registry and Profiles)"]
n228["Event Log Writer (Memory and Persistence)"]
n205 -->|depends_on| n227
n205 -->|reads| n217
n227 -->|depends_on| n170
n225 -->|depends_on| n224
n171 -->|depends_on| n224
n29 -->|controls| n168
n226 -->|depends_on| n217
n228 -->|depends_on| n170
n154 -->|reads| n217
n42 -->|reads| n227
n42 -->|reads| n217
n42 -->|reads| n211
n48 -->|proposes_to| n217
n43 -->|delegates_to| n42
n43 -->|reads| n223
n168 -->|depends_on| n170
n168 -->|depends_on| n220
n168 -->|writes| n217
n218 -->|depends_on| n217
n223 -->|writes| n217
n219 -->|depends_on| n217
n219 -->|reads| n211
n220 -->|reads| n227
n220 -->|depends_on| n218
n220 -->|depends_on| n219
n222 -->|writes| n217
n222 -->|depends_on| n224
n217 -->|depends_on| n170
n224 -->|depends_on| n228
n224 -->|writes| n217
n221 -->|depends_on| n220
n221 -->|delegates_to| n168
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n217,n218,n219,n220,n168,n221,n222,n223,n224 internal;
class n205,n225,n171,n29,n226,n154,n42,n48,n43,n170,n211,n227,n228 external;
```

### Claims and Leases

Source: `docs/architecture/graphs/system-claims.mmd`

```mermaid
flowchart LR
n229["Claim Repository"]
n206["Overlap Margin Checker"]
n165["Atomic Claim Acquirer"]
n230["Lease Heartbeat"]
n171["Lease Reaper"]
n163["Fencing Token Authority"]
n225["Claim Releaser"]
n193["Bot Claim Command Handler"]
n231["Contention Metrics"]
n178["Resume Orchestrator (Bot Registry and Profiles)"]
n170["Transaction Manager (Memory and Persistence)"]
n224["Task State Machine (Task Board)"]
n157["Metrics Registry (Ops and Observability)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n202["Spatial Overlap Validator (Shared Infrastructure Plan)"]
n29["Command Router (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n226["Contention Harness (Testing and Evaluation)"]
n207["Compatibility Checker (Edit Grants and Collaboration)"]
n232["Grant Revoker (Edit Grants and Collaboration)"]
n154["Status Aggregator (Ops and Observability)"]
n150["Active Bot Support Rule (Autonomy and Safety)"]
n148["Claim Loss Evaluator (Autonomy and Safety)"]
n149["Protected BBox Rule (Autonomy and Safety)"]
n152["Safety Policy Engine (Autonomy and Safety)"]
n177["WebSocket Codec (Transport and Protocol)"]
n178 -->|delegates_to| n225
n165 -->|writes| n229
n165 -->|depends_on| n206
n165 -->|depends_on| n170
n225 -->|writes| n229
n225 -->|depends_on| n224
n229 -->|depends_on| n170
n231 -->|depends_on| n229
n231 -->|observes| n157
n163 -->|depends_on| n30
n163 -->|depends_on| n170
n230 -->|writes| n229
n171 -->|writes| n229
n171 -->|depends_on| n224
n206 -->|depends_on| n229
n206 -->|depends_on| n202
n29 -->|controls| n165
n30 -->|controls| n163
n30 -->|depends_on| n170
n31 -->|delegates_to| n171
n31 -->|depends_on| n30
n32 -->|depends_on| n178
n32 -->|delegates_to| n171
n32 -->|depends_on| n170
n226 -->|depends_on| n229
n207 -->|reads| n229
n232 -->|depends_on| n163
n154 -->|reads| n229
n154 -->|observes| n157
n150 -->|reads| n229
n148 -->|reads| n229
n149 -->|reads| n229
n152 -->|reads| n229
n152 -->|depends_on| n150
n152 -->|depends_on| n149
n193 -->|depends_on| n229
n193 -->|depends_on| n177
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n229,n206,n165,n230,n171,n163,n225,n193,n231 internal;
class n178,n170,n224,n157,n30,n202,n29,n31,n32,n226,n207,n232,n154,n150,n148,n149,n152,n177 external;
```

### Edit Grants and Collaboration

Source: `docs/architecture/graphs/system-grants.mmd`

```mermaid
flowchart LR
n233["Grant Repository"]
n209["Collaboration Policy Evaluator"]
n207["Compatibility Checker"]
n208["Design Revision Guard"]
n166["Grant Issuer"]
n232["Grant Revoker"]
n234["Owner Offline Policy"]
n179["Grant Expiry"]
n188["Arbitration Adapter"]
n205["Delta Sync Planner (Bot Registry and Profiles)"]
n29["Command Router (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n184["Event Stream (Transport and Protocol)"]
n229["Claim Repository (Claims and Leases)"]
n200["Rules Store (Shared Infrastructure Plan)"]
n195["Structure Store (Shared Infrastructure Plan)"]
n201["SIP Revision Manager (Shared Infrastructure Plan)"]
n170["Transaction Manager (Memory and Persistence)"]
n163["Fencing Token Authority (Claims and Leases)"]
n182["Presence Tracker (Bot Registry and Profiles)"]
n227["Bot Profile Store (Bot Registry and Profiles)"]
n50["Planner Arbitration Handler (Cloud Planner Advisor)"]
n205 -->|depends_on| n227
n205 -->|reads| n233
n205 -->|reads| n201
n182 -->|depends_on| n227
n227 -->|depends_on| n170
n229 -->|depends_on| n170
n163 -->|depends_on| n170
n29 -->|controls| n166
n32 -->|delegates_to| n179
n32 -->|depends_on| n170
n188 -->|depends_on| n207
n188 -->|publishes| n184
n207 -->|reads| n229
n207 -->|depends_on| n233
n207 -->|depends_on| n200
n207 -->|depends_on| n195
n208 -->|depends_on| n233
n208 -->|controls| n232
n208 -->|reads| n201
n179 -->|writes| n233
n166 -->|depends_on| n207
n166 -->|depends_on| n208
n166 -->|writes| n233
n166 -->|depends_on| n209
n233 -->|depends_on| n170
n232 -->|depends_on| n163
n232 -->|writes| n233
n234 -->|reads| n182
n234 -->|reads| n227
n234 -->|depends_on| n207
n209 -->|depends_on| n233
n209 -->|depends_on| n195
n50 -->|reads| n207
n50 -->|proposes_to| n166
n50 -->|subscribes| n184
n201 -->|publishes| n208
n201 -->|depends_on| n170
n201 -->|depends_on| n200
n200 -->|depends_on| n170
n195 -->|depends_on| n170
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n233,n209,n207,n208,n166,n232,n234,n179,n188 internal;
class n205,n29,n32,n184,n229,n200,n195,n201,n170,n163,n182,n227,n50 external;
```

### Bot Registry and Profiles

Source: `docs/architecture/graphs/system-bots.mmd`

```mermaid
flowchart LR
n181["Bot Identity Authenticator"]
n227["Bot Profile Store"]
n235["Role Manager"]
n236["Behavior Profile Manager"]
n237["Relationship Store"]
n182["Presence Tracker"]
n205["Delta Sync Planner"]
n178["Resume Orchestrator"]
n238["Agency State Store"]
n239["Name Pool Allocator"]
n70["Deterministic Policy (Brains)"]
n62["Reconnect Supervisor (Bot Runtime and Mineflayer Adapter)"]
n233["Grant Repository (Edit Grants and Collaboration)"]
n201["SIP Revision Manager (Shared Infrastructure Plan)"]
n217["Task Repository (Task Board)"]
n190["Secrets Loader (Config and Profiles)"]
n240["Name Pool Validator (Config and Profiles)"]
n170["Transaction Manager (Memory and Persistence)"]
n225["Claim Releaser (Claims and Leases)"]
n173["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n88["Skill Checkpoint Manager (Skill Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n74["Bot Session Manager (Coordinator Runtime)"]
n234["Owner Offline Policy (Edit Grants and Collaboration)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n154["Status Aggregator (Ops and Observability)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n220["Priority Scheduler (Task Board)"]
n187["Transport Authentication (Transport and Protocol)"]
n142["Agency State Adapter (Bot Runtime and Mineflayer Adapter)"]
n155["Agency Status View (Ops and Observability)"]
n241["Agency State (Agency)"]
n70 -->|reads| n236
n62 -->|delegates_to| n205
n236 -->|depends_on| n227
n205 -->|depends_on| n227
n205 -->|reads| n233
n205 -->|reads| n201
n205 -->|reads| n217
n181 -->|depends_on| n227
n181 -->|depends_on| n190
n239 -->|depends_on| n227
n239 -->|depends_on| n240
n182 -->|depends_on| n227
n227 -->|depends_on| n170
n237 -->|depends_on| n227
n178 -->|depends_on| n205
n178 -->|depends_on| n227
n178 -->|delegates_to| n225
n178 -->|delegates_to| n173
n178 -->|reads| n88
n235 -->|depends_on| n227
n32 -->|depends_on| n178
n32 -->|depends_on| n170
n32 -->|depends_on| n173
n74 -->|depends_on| n181
n74 -->|publishes| n182
n233 -->|depends_on| n170
n234 -->|reads| n182
n234 -->|reads| n227
n67 -->|depends_on| n182
n154 -->|depends_on| n182
n154 -->|reads| n201
n154 -->|reads| n217
n42 -->|reads| n227
n42 -->|reads| n201
n42 -->|reads| n217
n201 -->|depends_on| n170
n88 -->|depends_on| n170
n220 -->|reads| n227
n217 -->|depends_on| n170
n187 -->|depends_on| n181
n187 -->|depends_on| n190
n181 -->|writes| n227
n235 -->|writes| n227
n236 -->|writes| n227
n237 -->|writes| n227
n239 -->|writes| n227
n142 -->|persists_to| n238
n238 -->|depends_on| n170
n155 -->|reads| n238
n238 -->|depends_on| n241
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n181,n227,n235,n236,n237,n182,n205,n178,n238,n239 internal;
class n70,n62,n233,n201,n217,n190,n240,n170,n225,n173,n88,n32,n74,n234,n67,n154,n42,n220,n187,n142,n155,n241 external;
```

### World Model and Landmarks

Source: `docs/architecture/graphs/system-world.mmd`

```mermaid
flowchart LR
n191["Observation Ingestor"]
n242["Chunk Version Store"]
n243["Sparse Occupancy Grid"]
n244["Merge Conflict Resolver"]
n245["Confidence Decay"]
n246["Landmark Registry"]
n247["Detector Result Integrator"]
n213["Plan Tagging"]
n211["Spatial Query Engine"]
n210["Container Memory"]
n212["World Reconciler"]
n108["Block Verifier (Building)"]
n110["Container Refill Adapter (Building)"]
n109["Material Preflight (Building)"]
n107["Reachability and Scaffold Planner (Building)"]
n104["Schematic Diff (Building)"]
n42["Planner Context Builder (Cloud Planner Advisor)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n150["Active Bot Support Rule (Autonomy and Safety)"]
n152["Safety Policy Engine (Autonomy and Safety)"]
n198["Container Registry (Shared Infrastructure Plan)"]
n203["Dependency Validator (Shared Infrastructure Plan)"]
n173["SIP Reconciliation Engine (Shared Infrastructure Plan)"]
n201["SIP Revision Manager (Shared Infrastructure Plan)"]
n52["Skill Context Builder (Skill Runtime)"]
n89["Skill Restore Validator (Skill Runtime)"]
n248["Deposit (Skill Library)"]
n249["Explore (Skill Library)"]
n250["Skill Shared Utilities (Skill Library)"]
n251["Withdraw (Skill Library)"]
n219["Precondition Evaluator (Task Board)"]
n184["Event Stream (Transport and Protocol)"]
n170["Transaction Manager (Memory and Persistence)"]
n169["Message Schema Registry (Transport and Protocol)"]
n199["Path Graph Store (Shared Infrastructure Plan)"]
n108 -->|reads| n211
n110 -->|writes| n210
n109 -->|reads| n52
n109 -->|reads| n210
n107 -->|reads| n211
n104 -->|reads| n211
n42 -->|reads| n201
n42 -->|reads| n211
n45 -->|depends_on| n203
n45 -->|reads| n211
n150 -->|reads| n211
n152 -->|depends_on| n150
n152 -->|reads| n211
n198 -->|depends_on| n170
n198 -->|depends_on| n210
n203 -->|depends_on| n198
n203 -->|depends_on| n199
n203 -->|reads| n211
n199 -->|depends_on| n170
n173 -->|depends_on| n212
n201 -->|depends_on| n170
n201 -->|publishes| n213
n52 -->|reads| n201
n52 -->|reads| n211
n89 -->|depends_on| n211
n248 -->|depends_on| n210
n249 -->|depends_on| n211
n250 -->|depends_on| n52
n250 -->|depends_on| n211
n251 -->|depends_on| n210
n219 -->|reads| n211
n184 -->|publishes| n191
n242 -->|depends_on| n170
n245 -->|depends_on| n242
n245 -->|writes| n246
n210 -->|reads| n198
n210 -->|depends_on| n246
n247 -->|writes| n246
n247 -->|depends_on| n244
n246 -->|depends_on| n170
n244 -->|writes| n242
n244 -->|depends_on| n245
n191 -->|subscribes| n184
n191 -->|reads| n169
n191 -->|writes| n242
n243 -->|depends_on| n242
n213 -->|depends_on| n246
n211 -->|reads| n199
n211 -->|depends_on| n246
n211 -->|depends_on| n243
n212 -->|depends_on| n246
n212 -->|depends_on| n211
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n191,n242,n243,n244,n245,n246,n247,n213,n211,n210,n212 internal;
class n108,n110,n109,n107,n104,n42,n45,n150,n152,n198,n203,n173,n201,n52,n89,n248,n249,n250,n251,n219,n184,n170,n169,n199 external;
```

### Perception

Source: `docs/architecture/graphs/system-perception.mmd`

```mermaid
flowchart LR
n252["Ring Sampler"]
n253["Chunk Snapshot Encoder"]
n192["Block Update Listener"]
n254["Path and Road Detector"]
n255["House Detector"]
n256["Farm Detector"]
n257["Storage and Workstation Detector"]
n258["Linear Structure Detector"]
n259["Detector Pipeline"]
n189["Landmark Candidate Emitter"]
n260["Perception Rate Limiter"]
n55["Mineflayer Event Bridge (Bot Runtime and Mineflayer Adapter)"]
n140["Perception Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n261["Detector Fixtures (Testing and Evaluation)"]
n184["Event Stream (Transport and Protocol)"]
n180["Profile Resolver (Config and Profiles)"]
n55 -->|delegates_to| n192
n140 -->|depends_on| n259
n140 -->|depends_on| n252
n56 -->|depends_on| n55
n56 -->|delegates_to| n252
n261 -->|depends_on| n259
n253 -->|depends_on| n252
n259 -->|depends_on| n253
n259 -->|depends_on| n256
n259 -->|depends_on| n255
n259 -->|depends_on| n258
n259 -->|depends_on| n254
n259 -->|depends_on| n257
n256 -->|depends_on| n253
n255 -->|depends_on| n253
n189 -->|depends_on| n259
n189 -->|publishes| n184
n258 -->|depends_on| n253
n254 -->|depends_on| n253
n260 -->|depends_on| n180
n252 -->|depends_on| n260
n257 -->|depends_on| n253
n192 -->|publishes| n184
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n252,n253,n192,n254,n255,n256,n257,n258,n259,n189,n260 internal;
class n55,n140,n56,n261,n184,n180 external;
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
n174["Config Schema Validator (Config and Profiles)"]
n169["Message Schema Registry (Transport and Protocol)"]
n262["Hardware Probe (Config and Profiles)"]
n158["Structured Logger (Ops and Observability)"]
n157["Metrics Registry (Ops and Observability)"]
n263["Laya Runtime Resolver (Config and Profiles)"]
n26(["ONNX Runtime / WebGPU Driver"])
n184["Event Stream (Transport and Protocol)"]
n180["Profile Resolver (Config and Profiles)"]
n264["Laya Benchmark Harness (Testing and Evaluation)"]
n159["Health and Readiness (Ops and Observability)"]
n265["Calibration Fitter (Laya Training)"]
n70 -->|subscribes| n184
n262 -->|depends_on| n180
n263 -->|depends_on| n262
n263 -->|depends_on| n180
n180 -->|depends_on| n174
n36 -->|depends_on| n78
n36 -->|depends_on| n34
n36 -->|depends_on| n76
n39 -->|proposes_to| n70
n39 -->|depends_on| n174
n39 -->|depends_on| n38
n79 -->|depends_on| n169
n78 -->|depends_on| n76
n35 -->|depends_on| n262
n35 -->|controls| n34
n35 -->|observes| n158
n80 -->|observes| n157
n80 -->|writes| n157
n34 -->|depends_on| n263
n34 -->|depends_on| n26
n38 -->|depends_on| n36
n38 -->|publishes| n184
n76 -->|subscribes| n184
n77 -->|depends_on| n180
n77 -->|depends_on| n76
n37 -->|controls| n36
n40 -->|controls| n38
n40 -->|depends_on| n76
n264 -->|depends_on| n80
n264 -->|depends_on| n34
n159 -->|depends_on| n34
n265 -->|reads| n39
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n34,n35,n76,n77,n78,n79,n36,n37,n38,n39,n40,n80 internal;
class n70,n174,n169,n262,n158,n157,n263,n184,n180,n264,n159,n265,n26 external;
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
n207["Compatibility Checker (Edit Grants and Collaboration)"]
n166["Grant Issuer (Edit Grants and Collaboration)"]
n184["Event Stream (Transport and Protocol)"]
n157["Metrics Registry (Ops and Observability)"]
n227["Bot Profile Store (Bot Registry and Profiles)"]
n201["SIP Revision Manager (Shared Infrastructure Plan)"]
n217["Task Repository (Task Board)"]
n211["Spatial Query Engine (World Model and Landmarks)"]
n174["Config Schema Validator (Config and Profiles)"]
n190["Secrets Loader (Config and Profiles)"]
n25(["Muse Spark Planner Endpoint"])
n170["Transaction Manager (Memory and Persistence)"]
n203["Dependency Validator (Shared Infrastructure Plan)"]
n200["Rules Store (Shared Infrastructure Plan)"]
n84["Skill Registry (Skill Runtime)"]
n204["SIP Mutation Proposer (Shared Infrastructure Plan)"]
n223["Dead Letter Manager (Task Board)"]
n64["Recovery Ladder (Autonomy and Safety)"]
n227 -->|depends_on| n170
n31 -->|delegates_to| n43
n207 -->|depends_on| n200
n166 -->|depends_on| n207
n50 -->|reads| n207
n50 -->|proposes_to| n166
n50 -->|subscribes| n184
n49 -->|observes| n157
n49 -->|controls| n41
n42 -->|reads| n227
n42 -->|reads| n201
n42 -->|reads| n217
n42 -->|reads| n211
n51 -->|depends_on| n81
n51 -->|reads| n201
n41 -->|depends_on| n174
n41 -->|depends_on| n190
n41 -->|depends_on| n25
n41 -->|delegates_to| n50
n81 -->|depends_on| n170
n46 -->|controls| n51
n46 -->|depends_on| n41
n46 -->|depends_on| n44
n46 -->|depends_on| n45
n44 -->|controls| n46
n45 -->|controls| n46
n45 -->|depends_on| n44
n45 -->|depends_on| n203
n45 -->|reads| n200
n45 -->|reads| n84
n45 -->|reads| n211
n47 -->|depends_on| n46
n47 -->|proposes_to| n204
n48 -->|depends_on| n46
n48 -->|proposes_to| n217
n43 -->|observes| n157
n43 -->|delegates_to| n42
n43 -->|reads| n201
n43 -->|reads| n223
n64 -->|proposes_to| n43
n64 -->|depends_on| n184
n203 -->|reads| n211
n204 -->|depends_on| n203
n204 -->|depends_on| n201
n201 -->|depends_on| n170
n201 -->|depends_on| n200
n200 -->|depends_on| n170
n223 -->|writes| n217
n217 -->|depends_on| n170
n82 -->|depends_on| n81
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n41,n42,n43,n44,n45,n46,n47,n48,n49,n81,n50,n51,n82 internal;
class n31,n207,n166,n184,n157,n227,n201,n217,n211,n174,n190,n170,n203,n200,n84,n204,n223,n64,n25 external;
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
n161["Affordance Enumerator (Brains)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n178["Resume Orchestrator (Bot Registry and Profiles)"]
n109["Material Preflight (Building)"]
n45["Planner Semantic Validator (Cloud Planner Advisor)"]
n170["Transaction Manager (Memory and Persistence)"]
n201["SIP Revision Manager (Shared Infrastructure Plan)"]
n211["Spatial Query Engine (World Model and Landmarks)"]
n184["Event Stream (Transport and Protocol)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n157["Metrics Registry (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n266["Craft (Skill Library)"]
n267["Navigate (Skill Library)"]
n268["Place Build (Skill Library)"]
n250["Skill Shared Utilities (Skill Library)"]
n161 -->|depends_on| n56
n161 -->|depends_on| n69
n161 -->|depends_on| n84
n59 -->|depends_on| n85
n59 -->|depends_on| n86
n56 -->|delegates_to| n52
n178 -->|reads| n88
n109 -->|reads| n52
n45 -->|reads| n84
n45 -->|reads| n211
n63 -->|reads| n69
n69 -->|controls| n63
n201 -->|depends_on| n170
n88 -->|depends_on| n170
n52 -->|reads| n56
n52 -->|reads| n201
n52 -->|depends_on| n88
n52 -->|reads| n211
n90 -->|publishes| n184
n85 -->|depends_on| n52
n85 -->|depends_on| n90
n85 -->|depends_on| n83
n85 -->|depends_on| n84
n91 -->|reads| n63
n91 -->|depends_on| n85
n87 -->|observes| n157
n87 -->|publishes| n184
n89 -->|depends_on| n88
n89 -->|depends_on| n211
n84 -->|depends_on| n83
n86 -->|reads| n69
n86 -->|depends_on| n85
n266 -->|depends_on| n52
n267 -->|depends_on| n83
n268 -->|depends_on| n52
n250 -->|depends_on| n52
n250 -->|depends_on| n211
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n83,n84,n85,n86,n52,n87,n88,n89,n90,n91 internal;
class n161,n59,n56,n178,n109,n45,n170,n201,n211,n184,n63,n157,n69,n266,n267,n268,n250 external;
```

### Skill Library

Source: `docs/architecture/graphs/system-skills.mmd`

```mermaid
flowchart LR
n267["Navigate"]
n214["Follow Path"]
n269["Mine"]
n270["Collect"]
n266["Craft"]
n271["Smelt"]
n272["Eat"]
n248["Deposit"]
n251["Withdraw"]
n273["Sleep"]
n274["Flee or Defend"]
n249["Explore"]
n275["Bridge"]
n276["Clear"]
n268["Place Build"]
n277["Construction"]
n278["Procurement"]
n279["Schematic Build"]
n280["Repair"]
n215["Harvest Farm"]
n216["Plant Farm"]
n281["Entity Targeting"]
n282["Equip Gear"]
n283["Gather Food"]
n284["Gather Wool"]
n285["Place Bed"]
n286["Dig Shelter"]
n250["Skill Shared Utilities"]
n53["Block Executor (Building)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n52["Skill Context Builder (Skill Runtime)"]
n210["Container Memory (World Model and Landmarks)"]
n211["Spatial Query Engine (World Model and Landmarks)"]
n144["Mob Threat Evaluator (Autonomy and Safety)"]
n199["Path Graph Store (Shared Infrastructure Plan)"]
n197["Farm Store (Shared Infrastructure Plan)"]
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
n104 -->|reads| n211
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n211
n275 -->|depends_on| n53
n275 -->|depends_on| n267
n276 -->|depends_on| n53
n276 -->|depends_on| n63
n270 -->|depends_on| n57
n270 -->|depends_on| n269
n270 -->|depends_on| n267
n266 -->|depends_on| n57
n266 -->|depends_on| n52
n248 -->|depends_on| n57
n248 -->|depends_on| n210
n272 -->|depends_on| n57
n249 -->|depends_on| n267
n249 -->|depends_on| n211
n274 -->|depends_on| n57
n274 -->|depends_on| n144
n274 -->|depends_on| n267
n214 -->|depends_on| n199
n214 -->|depends_on| n267
n215 -->|depends_on| n57
n215 -->|depends_on| n197
n215 -->|depends_on| n267
n269 -->|depends_on| n57
n269 -->|depends_on| n267
n267 -->|depends_on| n57
n267 -->|depends_on| n83
n268 -->|depends_on| n53
n268 -->|depends_on| n52
n216 -->|depends_on| n57
n216 -->|depends_on| n197
n216 -->|depends_on| n267
n280 -->|depends_on| n53
n280 -->|depends_on| n104
n279 -->|depends_on| n53
n279 -->|depends_on| n106
n279 -->|depends_on| n105
n250 -->|depends_on| n52
n250 -->|depends_on| n211
n273 -->|depends_on| n57
n273 -->|depends_on| n267
n271 -->|depends_on| n57
n271 -->|depends_on| n267
n251 -->|depends_on| n57
n251 -->|depends_on| n210
n211 -->|reads| n199
n124 -->|depends_on| n126
n281 -->|depends_on| n56
n282 -->|depends_on| n250
n282 -->|depends_on| n57
n283 -->|depends_on| n281
n283 -->|depends_on| n250
n283 -->|depends_on| n57
n283 -->|depends_on| n56
n284 -->|depends_on| n281
n284 -->|depends_on| n250
n284 -->|depends_on| n57
n284 -->|depends_on| n56
n285 -->|depends_on| n250
n285 -->|depends_on| n57
n286 -->|depends_on| n250
n286 -->|depends_on| n57
n277 -->|depends_on| n132
n277 -->|depends_on| n124
n278 -->|depends_on| n136
n278 -->|depends_on| n126
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n267,n214,n269,n270,n266,n271,n272,n248,n251,n273,n274,n249,n275,n276,n268,n277,n278,n279,n280,n215,n216,n281,n282,n283,n284,n285,n286,n250 internal;
class n53,n63,n57,n52,n210,n211,n144,n199,n197,n83,n104,n106,n105,n56,n132,n124,n136,n126 external;
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
n211["Spatial Query Engine (World Model and Landmarks)"]
n200["Rules Store (Shared Infrastructure Plan)"]
n210["Container Memory (World Model and Landmarks)"]
n52["Skill Context Builder (Skill Runtime)"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n287["Block Changelog Writer (Memory and Persistence)"]
n195["Structure Store (Shared Infrastructure Plan)"]
n184["Event Stream (Transport and Protocol)"]
n275["Bridge (Skill Library)"]
n276["Clear (Skill Library)"]
n268["Place Build (Skill Library)"]
n280["Repair (Skill Library)"]
n279["Schematic Build (Skill Library)"]
n277["Construction (Skill Library)"]
n278["Procurement (Skill Library)"]
n57 -->|depends_on| n63
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n108
n53 -->|depends_on| n111
n53 -->|depends_on| n63
n108 -->|depends_on| n92
n108 -->|reads| n211
n93 -->|depends_on| n92
n93 -->|depends_on| n200
n106 -->|depends_on| n92
n106 -->|depends_on| n105
n110 -->|depends_on| n57
n110 -->|writes| n210
n109 -->|depends_on| n92
n109 -->|reads| n52
n109 -->|reads| n210
n107 -->|reads| n56
n107 -->|depends_on| n106
n107 -->|reads| n211
n111 -->|writes| n287
n111 -->|reads| n195
n111 -->|subscribes| n184
n104 -->|depends_on| n92
n104 -->|reads| n211
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
n105 -->|reads| n195
n63 -->|validates| n57
n63 -->|validates| n53
n52 -->|reads| n56
n52 -->|reads| n211
n275 -->|depends_on| n53
n276 -->|depends_on| n53
n276 -->|depends_on| n63
n268 -->|depends_on| n53
n268 -->|depends_on| n52
n280 -->|depends_on| n53
n280 -->|depends_on| n104
n279 -->|depends_on| n53
n279 -->|depends_on| n106
n279 -->|depends_on| n105
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
n277 -->|depends_on| n124
n125 -->|depends_on| n112
n127 -->|depends_on| n92
n127 -->|depends_on| n104
n127 -->|depends_on| n122
n127 -->|depends_on| n123
n128 -->|depends_on| n92
n128 -->|depends_on| n122
n128 -->|depends_on| n123
n128 -->|depends_on| n111
n278 -->|depends_on| n126
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n92,n93,n94,n95,n96,n97,n98,n99,n100,n101,n102,n103,n104,n105,n106,n107,n108,n53,n109,n110,n111,n112,n113,n114,n115,n116,n117,n118,n119,n120,n121,n122,n123,n124,n125,n126,n127,n128 internal;
class n57,n63,n211,n200,n210,n52,n56,n287,n195,n184,n275,n276,n268,n280,n279,n277,n278 external;
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
n63["Action Veto Gate (Autonomy and Safety)"]
n161["Affordance Enumerator (Brains)"]
n174["Config Schema Validator (Config and Profiles)"]
n24(["Minecraft 1.20.1 LAN Server"])
n70["Deterministic Policy (Brains)"]
n192["Block Update Listener (Perception)"]
n69["Reflex Guardian Loop (Brains)"]
n180["Profile Resolver (Config and Profiles)"]
n259["Detector Pipeline (Perception)"]
n252["Ring Sampler (Perception)"]
n205["Delta Sync Planner (Bot Registry and Profiles)"]
n186["Reconnect Supervisor (Transport and Protocol)"]
n85["Skill Lifecycle Executor (Skill Runtime)"]
n86["Skill Tick Scheduler (Skill Runtime)"]
n184["Event Stream (Transport and Protocol)"]
n52["Skill Context Builder (Skill Runtime)"]
n53["Block Executor (Building)"]
n110["Container Refill Adapter (Building)"]
n107["Reachability and Scaffold Planner (Building)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n270["Collect (Skill Library)"]
n266["Craft (Skill Library)"]
n248["Deposit (Skill Library)"]
n272["Eat (Skill Library)"]
n274["Flee or Defend (Skill Library)"]
n215["Harvest Farm (Skill Library)"]
n269["Mine (Skill Library)"]
n267["Navigate (Skill Library)"]
n216["Plant Farm (Skill Library)"]
n273["Sleep (Skill Library)"]
n271["Smelt (Skill Library)"]
n251["Withdraw (Skill Library)"]
n33["Bot Process Supervisor (Coordinator Runtime)"]
n288["Goal Arbiter (Agency)"]
n289["Intention Manager (Agency)"]
n241["Agency State (Agency)"]
n71["Laya Client (Brains)"]
n290["Social Engine (Agency)"]
n238["Agency State Store (Bot Registry and Profiles)"]
n291["Agent Episode Repository (Memory and Persistence)"]
n281["Entity Targeting (Skill Library)"]
n282["Equip Gear (Skill Library)"]
n283["Gather Food (Skill Library)"]
n284["Gather Wool (Skill Library)"]
n285["Place Bed (Skill Library)"]
n286["Dig Shelter (Skill Library)"]
n277["Construction (Skill Library)"]
n183["Request Correlator (Transport and Protocol)"]
n292["Reflection (Agency)"]
n278["Procurement (Skill Library)"]
n57 -->|depends_on| n54
n57 -->|depends_on| n131
n57 -->|depends_on| n63
n161 -->|depends_on| n56
n161 -->|depends_on| n69
n54 -->|depends_on| n174
n54 -->|depends_on| n24
n70 -->|depends_on| n161
n70 -->|depends_on| n139
n70 -->|subscribes| n184
n55 -->|depends_on| n54
n55 -->|delegates_to| n192
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n129 -->|depends_on| n54
n129 -->|depends_on| n180
n140 -->|depends_on| n259
n140 -->|depends_on| n252
n131 -->|depends_on| n174
n62 -->|depends_on| n54
n62 -->|delegates_to| n205
n62 -->|depends_on| n186
n59 -->|depends_on| n85
n59 -->|depends_on| n86
n139 -->|depends_on| n54
n139 -->|depends_on| n56
n139 -->|publishes| n184
n56 -->|depends_on| n55
n56 -->|delegates_to| n252
n56 -->|delegates_to| n52
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n110 -->|depends_on| n57
n107 -->|reads| n56
n180 -->|depends_on| n174
n67 -->|controls| n59
n67 -->|depends_on| n184
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n65 -->|controls| n57
n65 -->|depends_on| n184
n69 -->|controls| n63
n52 -->|reads| n56
n85 -->|depends_on| n52
n86 -->|reads| n69
n86 -->|depends_on| n85
n270 -->|depends_on| n57
n270 -->|depends_on| n269
n270 -->|depends_on| n267
n266 -->|depends_on| n57
n266 -->|depends_on| n52
n248 -->|depends_on| n57
n272 -->|depends_on| n57
n274 -->|depends_on| n57
n274 -->|depends_on| n267
n215 -->|depends_on| n57
n215 -->|depends_on| n267
n269 -->|depends_on| n57
n269 -->|depends_on| n267
n267 -->|depends_on| n57
n216 -->|depends_on| n57
n216 -->|depends_on| n267
n273 -->|depends_on| n57
n273 -->|depends_on| n267
n271 -->|depends_on| n57
n271 -->|depends_on| n267
n251 -->|depends_on| n57
n33 -->|controls| n54
n71 -->|depends_on| n161
n71 -->|depends_on| n70
n192 -->|publishes| n184
n60 -->|depends_on| n288
n60 -->|depends_on| n289
n60 -->|depends_on| n241
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n139
n60 -->|delegates_to| n59
n61 -->|depends_on| n290
n61 -->|publishes| n184
n142 -->|persists_to| n238
n60 -->|persists_to| n291
n289 -->|depends_on| n288
n241 -->|depends_on| n289
n290 -->|proposes_to| n61
n238 -->|depends_on| n241
n281 -->|depends_on| n56
n282 -->|depends_on| n57
n283 -->|depends_on| n281
n283 -->|depends_on| n57
n283 -->|depends_on| n56
n284 -->|depends_on| n281
n284 -->|depends_on| n57
n284 -->|depends_on| n56
n285 -->|depends_on| n57
n286 -->|depends_on| n57
n130 -->|depends_on| n56
n277 -->|depends_on| n132
n135 -->|depends_on| n133
n133 -->|depends_on| n183
n60 -->|depends_on| n141
n141 -->|depends_on| n288
n134 -->|depends_on| n183
n135 -->|depends_on| n134
n60 -->|depends_on| n292
n278 -->|depends_on| n136
n136 -->|depends_on| n137
n136 -->|depends_on| n138
n137 -->|depends_on| n56
n138 -->|depends_on| n56
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n54,n129,n55,n56,n130,n131,n57,n132,n133,n134,n135,n136,n137,n138,n139,n58,n59,n140,n60,n141,n61,n142,n62 internal;
class n63,n161,n174,n70,n192,n69,n180,n259,n252,n205,n186,n85,n86,n184,n52,n53,n110,n107,n67,n65,n270,n266,n248,n272,n274,n215,n269,n267,n216,n273,n271,n251,n33,n288,n289,n241,n71,n290,n238,n291,n281,n282,n283,n284,n285,n286,n277,n183,n292,n278,n24 external;
```

### Autonomy and Safety

Source: `docs/architecture/graphs/system-safety.mmd`

```mermaid
flowchart LR
n143["Hazard Evaluator"]
n144["Mob Threat Evaluator"]
n145["Hunger Evaluator"]
n146["Stuck and Timeout Evaluator"]
n147["Inventory Evaluator"]
n148["Claim Loss Evaluator"]
n149["Protected BBox Rule"]
n150["Active Bot Support Rule"]
n151["Material Ban Rule"]
n152["Safety Policy Engine"]
n63["Action Veto Gate"]
n64["Recovery Ladder"]
n65["Emergency Stop Controller"]
n153["Incident Journal"]
n57["Action Executor (Bot Runtime and Mineflayer Adapter)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n53["Block Executor (Building)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n69["Reflex Guardian Loop (Brains)"]
n229["Claim Repository (Claims and Leases)"]
n211["Spatial Query Engine (World Model and Landmarks)"]
n29["Command Router (Coordinator Runtime)"]
n184["Event Stream (Transport and Protocol)"]
n228["Event Log Writer (Memory and Persistence)"]
n200["Rules Store (Shared Infrastructure Plan)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n91["Skill Preemption Handler (Skill Runtime)"]
n276["Clear (Skill Library)"]
n274["Flee or Defend (Skill Library)"]
n57 -->|depends_on| n63
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n53 -->|depends_on| n57
n53 -->|depends_on| n63
n68 -->|controls| n65
n68 -->|depends_on| n184
n63 -->|validates| n57
n63 -->|validates| n53
n63 -->|reads| n69
n63 -->|depends_on| n152
n150 -->|reads| n229
n150 -->|reads| n211
n148 -->|reads| n229
n65 -->|controls| n57
n65 -->|controls| n29
n65 -->|depends_on| n184
n69 -->|controls| n63
n69 -->|depends_on| n148
n69 -->|depends_on| n143
n69 -->|depends_on| n145
n69 -->|depends_on| n147
n69 -->|depends_on| n144
n69 -->|depends_on| n146
n153 -->|writes| n228
n149 -->|reads| n229
n149 -->|reads| n200
n64 -->|proposes_to| n29
n64 -->|proposes_to| n43
n64 -->|controls| n65
n64 -->|depends_on| n184
n152 -->|reads| n229
n152 -->|depends_on| n150
n152 -->|depends_on| n151
n152 -->|depends_on| n149
n152 -->|reads| n200
n152 -->|reads| n211
n91 -->|reads| n63
n276 -->|depends_on| n53
n276 -->|depends_on| n63
n274 -->|depends_on| n57
n274 -->|depends_on| n144
n68 -->|writes| n228
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n143,n144,n145,n146,n147,n148,n149,n150,n151,n152,n63,n64,n65,n153 internal;
class n57,n58,n53,n68,n69,n229,n211,n29,n184,n228,n200,n43,n91,n276,n274 external;
```

### Memory and Persistence

Source: `docs/architecture/graphs/system-memory.mmd`

```mermaid
flowchart LR
n293["SQLite Runtime"]
n176["Migration Runner"]
n170["Transaction Manager"]
n228["Event Log Writer"]
n287["Block Changelog Writer"]
n172["Retention Pruner"]
n294["Snapshot Export"]
n295["Schema Version Registry"]
n296["Episode Store"]
n291["Agent Episode Repository"]
n227["Bot Profile Store (Bot Registry and Profiles)"]
n111["Rollback Journal (Building)"]
n165["Atomic Claim Acquirer (Claims and Leases)"]
n229["Claim Repository (Claims and Leases)"]
n163["Fencing Token Authority (Claims and Leases)"]
n30["Coordinator Epoch Authority (Coordinator Runtime)"]
n31["Global Scheduler (Coordinator Runtime)"]
n72["Process Bootstrap (Coordinator Runtime)"]
n32["Restart Recovery Orchestrator (Coordinator Runtime)"]
n297["Replay Engine (Testing and Evaluation)"]
n233["Grant Repository (Edit Grants and Collaboration)"]
n160["Audit Viewer (Ops and Observability)"]
n159["Health and Readiness (Ops and Observability)"]
n81["Plan Cache (Cloud Planner Advisor)"]
n153["Incident Journal (Autonomy and Safety)"]
n198["Container Registry (Shared Infrastructure Plan)"]
n197["Farm Store (Shared Infrastructure Plan)"]
n199["Path Graph Store (Shared Infrastructure Plan)"]
n201["SIP Revision Manager (Shared Infrastructure Plan)"]
n196["Road Store (Shared Infrastructure Plan)"]
n200["Rules Store (Shared Infrastructure Plan)"]
n195["Structure Store (Shared Infrastructure Plan)"]
n167["SIP Transactional Committer (Shared Infrastructure Plan)"]
n194["Zone Store (Shared Infrastructure Plan)"]
n88["Skill Checkpoint Manager (Skill Runtime)"]
n168["Atomic Task Claimer (Task Board)"]
n217["Task Repository (Task Board)"]
n224["Task State Machine (Task Board)"]
n298["Trace Exporter (Laya Training)"]
n242["Chunk Version Store (World Model and Landmarks)"]
n246["Landmark Registry (World Model and Landmarks)"]
n67["Pause and Resume Controller (Ops and Observability)"]
n68["Fleet Emergency Stop (Ops and Observability)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n238["Agency State Store (Bot Registry and Profiles)"]
n155["Agency Status View (Ops and Observability)"]
n227 -->|depends_on| n170
n111 -->|writes| n287
n111 -->|reads| n195
n165 -->|writes| n229
n165 -->|depends_on| n170
n229 -->|depends_on| n170
n163 -->|depends_on| n30
n163 -->|depends_on| n170
n30 -->|controls| n163
n30 -->|depends_on| n170
n31 -->|depends_on| n30
n31 -->|delegates_to| n172
n72 -->|depends_on| n32
n72 -->|depends_on| n176
n32 -->|depends_on| n170
n297 -->|depends_on| n228
n233 -->|depends_on| n170
n287 -->|depends_on| n170
n228 -->|depends_on| n170
n176 -->|depends_on| n293
n172 -->|depends_on| n287
n172 -->|depends_on| n228
n172 -->|depends_on| n170
n295 -->|depends_on| n176
n294 -->|depends_on| n170
n170 -->|depends_on| n293
n160 -->|reads| n287
n160 -->|reads| n228
n159 -->|depends_on| n293
n81 -->|depends_on| n170
n153 -->|writes| n228
n198 -->|depends_on| n170
n197 -->|depends_on| n170
n199 -->|depends_on| n170
n201 -->|depends_on| n170
n201 -->|depends_on| n200
n196 -->|depends_on| n170
n200 -->|depends_on| n170
n195 -->|depends_on| n170
n167 -->|depends_on| n170
n167 -->|writes| n198
n167 -->|writes| n197
n167 -->|writes| n199
n167 -->|depends_on| n201
n167 -->|writes| n196
n167 -->|writes| n200
n167 -->|writes| n195
n167 -->|writes| n194
n194 -->|depends_on| n170
n88 -->|depends_on| n170
n168 -->|depends_on| n170
n168 -->|writes| n217
n217 -->|depends_on| n170
n224 -->|depends_on| n228
n224 -->|writes| n217
n298 -->|reads| n228
n242 -->|depends_on| n170
n246 -->|depends_on| n170
n297 -->|reads| n296
n298 -->|reads| n296
n160 -->|reads| n296
n172 -->|depends_on| n296
n67 -->|writes| n228
n68 -->|writes| n228
n60 -->|persists_to| n291
n238 -->|depends_on| n170
n291 -->|depends_on| n170
n155 -->|reads| n238
n155 -->|reads| n291
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n293,n176,n170,n228,n287,n172,n294,n295,n296,n291 internal;
class n227,n111,n165,n229,n163,n30,n31,n72,n32,n297,n233,n160,n159,n81,n153,n198,n197,n199,n201,n196,n200,n195,n167,n194,n88,n168,n217,n224,n298,n242,n246,n67,n68,n60,n238,n155 external;
```

### Ops and Observability

Source: `docs/architecture/graphs/system-ops.mmd`

```mermaid
flowchart LR
n66["Ops API"]
n154["Status Aggregator"]
n155["Agency Status View"]
n67["Pause and Resume Controller"]
n68["Fleet Emergency Stop"]
n156["SIP Dump"]
n157["Metrics Registry"]
n158["Structured Logger"]
n159["Health and Readiness"]
n160["Audit Viewer"]
n231["Contention Metrics (Claims and Leases)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n80["Latency Metrics (Laya Decision Service)"]
n299["Metrics Reporter (Testing and Evaluation)"]
n28(["Fleet Operator"])
n287["Block Changelog Writer (Memory and Persistence)"]
n228["Event Log Writer (Memory and Persistence)"]
n65["Emergency Stop Controller (Autonomy and Safety)"]
n184["Event Stream (Transport and Protocol)"]
n34["Model Loader (Laya Decision Service)"]
n293["SQLite Runtime (Memory and Persistence)"]
n169["Message Schema Registry (Transport and Protocol)"]
n59["Skill Host (Bot Runtime and Mineflayer Adapter)"]
n182["Presence Tracker (Bot Registry and Profiles)"]
n201["SIP Revision Manager (Shared Infrastructure Plan)"]
n229["Claim Repository (Claims and Leases)"]
n217["Task Repository (Task Board)"]
n49["Planner Budget Limiter (Cloud Planner Advisor)"]
n43["Planner Trigger Evaluator (Cloud Planner Advisor)"]
n87["Skill Progress Reporter (Skill Runtime)"]
n296["Episode Store (Memory and Persistence)"]
n238["Agency State Store (Bot Registry and Profiles)"]
n291["Agent Episode Repository (Memory and Persistence)"]
n231 -->|depends_on| n229
n231 -->|observes| n157
n35 -->|controls| n34
n35 -->|observes| n158
n80 -->|observes| n157
n80 -->|writes| n157
n299 -->|observes| n157
n28 -->|controls| n66
n160 -->|reads| n287
n160 -->|reads| n228
n68 -->|controls| n65
n68 -->|depends_on| n184
n159 -->|depends_on| n34
n159 -->|depends_on| n293
n159 -->|depends_on| n154
n66 -->|depends_on| n68
n66 -->|depends_on| n67
n66 -->|depends_on| n154
n66 -->|depends_on| n169
n67 -->|controls| n59
n67 -->|depends_on| n182
n67 -->|depends_on| n184
n156 -->|depends_on| n201
n154 -->|depends_on| n182
n154 -->|reads| n229
n154 -->|observes| n157
n154 -->|reads| n201
n154 -->|reads| n217
n49 -->|observes| n157
n43 -->|observes| n157
n43 -->|reads| n201
n65 -->|depends_on| n184
n87 -->|observes| n157
n87 -->|publishes| n184
n160 -->|reads| n296
n67 -->|writes| n228
n68 -->|writes| n228
n155 -->|reads| n238
n155 -->|reads| n291
n66 -->|depends_on| n155
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n66,n154,n155,n67,n68,n156,n157,n158,n159,n160 internal;
class n231,n35,n80,n299,n287,n228,n65,n184,n34,n293,n169,n59,n182,n201,n229,n217,n49,n43,n87,n296,n238,n291,n28 external;
```

### Config and Profiles

Source: `docs/architecture/graphs/system-config.mmd`

```mermaid
flowchart LR
n175["Environment Parser"]
n174["Config Schema Validator"]
n180["Profile Resolver"]
n262["Hardware Probe"]
n190["Secrets Loader"]
n240["Name Pool Validator"]
n263["Laya Runtime Resolver"]
n300["Fail Fast Handler"]
n54["Connection Lifecycle (Bot Runtime and Mineflayer Adapter)"]
n129["Join and Auth (Bot Runtime and Mineflayer Adapter)"]
n131["Reach and Rate Guard (Bot Runtime and Mineflayer Adapter)"]
n181["Bot Identity Authenticator (Bot Registry and Profiles)"]
n239["Name Pool Allocator (Bot Registry and Profiles)"]
n27(["Host Hardware"])
n72["Process Bootstrap (Coordinator Runtime)"]
n73["Service Composition (Coordinator Runtime)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n35["Execution Provider Selector (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n77["Decision Rate Limiter (Laya Decision Service)"]
n260["Perception Rate Limiter (Perception)"]
n41["OpenAI-Compatible Client (Cloud Planner Advisor)"]
n187["Transport Authentication (Transport and Protocol)"]
n162["Tactical Decision Policy (Brains)"]
n54 -->|depends_on| n174
n129 -->|depends_on| n54
n129 -->|depends_on| n180
n131 -->|depends_on| n174
n181 -->|depends_on| n190
n239 -->|depends_on| n240
n174 -->|depends_on| n175
n300 -->|depends_on| n174
n262 -->|depends_on| n180
n262 -->|depends_on| n27
n263 -->|depends_on| n262
n263 -->|depends_on| n180
n240 -->|depends_on| n174
n180 -->|depends_on| n174
n190 -->|depends_on| n175
n72 -->|depends_on| n174
n72 -->|depends_on| n175
n72 -->|depends_on| n73
n73 -->|depends_on| n180
n39 -->|depends_on| n174
n35 -->|depends_on| n262
n35 -->|controls| n34
n34 -->|depends_on| n263
n77 -->|depends_on| n180
n260 -->|depends_on| n180
n41 -->|depends_on| n174
n41 -->|depends_on| n190
n187 -->|depends_on| n181
n187 -->|depends_on| n190
n162 -->|depends_on| n174
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n175,n174,n180,n262,n190,n240,n263,n300 internal;
class n54,n129,n131,n181,n239,n72,n73,n39,n35,n34,n77,n260,n41,n187,n162,n27 external;
```

### Testing and Evaluation

Source: `docs/architecture/graphs/system-eval.mmd`

```mermaid
flowchart LR
n301["Unit Fixtures"]
n261["Detector Fixtures"]
n302["Docker Server Harness"]
n303["Scenario Runner"]
n297["Replay Engine"]
n226["Contention Harness"]
n299["Metrics Reporter"]
n304["Soak Runner"]
n305["Architecture Guard Tests"]
n264["Laya Benchmark Harness"]
n229["Claim Repository (Claims and Leases)"]
n217["Task Repository (Task Board)"]
n259["Detector Pipeline (Perception)"]
n24(["Minecraft 1.20.1 LAN Server"])
n80["Latency Metrics (Laya Decision Service)"]
n34["Model Loader (Laya Decision Service)"]
n157["Metrics Registry (Ops and Observability)"]
n228["Event Log Writer (Memory and Persistence)"]
n306["Promotion Gate (Laya Training)"]
n296["Episode Store (Memory and Persistence)"]
n80 -->|observes| n157
n80 -->|writes| n157
n305 -->|depends_on| n301
n226 -->|depends_on| n229
n226 -->|delegates_to| n303
n226 -->|depends_on| n217
n261 -->|depends_on| n301
n261 -->|depends_on| n259
n302 -->|depends_on| n301
n302 -->|depends_on| n24
n264 -->|depends_on| n80
n264 -->|depends_on| n34
n264 -->|delegates_to| n303
n299 -->|observes| n157
n297 -->|depends_on| n303
n297 -->|depends_on| n228
n303 -->|controls| n302
n303 -->|publishes| n299
n304 -->|depends_on| n299
n304 -->|delegates_to| n303
n306 -->|depends_on| n264
n297 -->|reads| n296
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n301,n261,n302,n303,n297,n226,n299,n304,n305,n264 internal;
class n229,n217,n259,n80,n34,n157,n228,n306,n296,n24 external;
```

### Laya Training

Source: `docs/architecture/graphs/system-training.mmd`

```mermaid
flowchart LR
n298["Trace Exporter"]
n307["Labeling Pipeline"]
n308["Reward Computer"]
n309["Fine-tune Runner"]
n310["ONNX Exporter"]
n265["Calibration Fitter"]
n306["Promotion Gate"]
n39["Confidence Calibrator (Laya Decision Service)"]
n264["Laya Benchmark Harness (Testing and Evaluation)"]
n228["Event Log Writer (Memory and Persistence)"]
n296["Episode Store (Memory and Persistence)"]
n265 -->|reads| n39
n265 -->|depends_on| n298
n309 -->|depends_on| n307
n309 -->|depends_on| n308
n307 -->|depends_on| n298
n310 -->|depends_on| n309
n306 -->|depends_on| n264
n306 -->|depends_on| n265
n306 -->|depends_on| n310
n308 -->|depends_on| n298
n298 -->|reads| n228
n298 -->|reads| n296
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n298,n307,n308,n309,n310,n265,n306 internal;
class n39,n264,n228,n296 external;
```

### Brains

Source: `docs/architecture/graphs/system-brains.mmd`

```mermaid
flowchart LR
n69["Reflex Guardian Loop"]
n161["Affordance Enumerator"]
n70["Deterministic Policy"]
n71["Laya Client"]
n162["Tactical Decision Policy"]
n56["World Cache Adapter (Bot Runtime and Mineflayer Adapter)"]
n84["Skill Registry (Skill Runtime)"]
n139["State Digest Collector (Bot Runtime and Mineflayer Adapter)"]
n236["Behavior Profile Manager (Bot Registry and Profiles)"]
n184["Event Stream (Transport and Protocol)"]
n58["Guardian Hook (Bot Runtime and Mineflayer Adapter)"]
n39["Confidence Calibrator (Laya Decision Service)"]
n63["Action Veto Gate (Autonomy and Safety)"]
n148["Claim Loss Evaluator (Autonomy and Safety)"]
n143["Hazard Evaluator (Autonomy and Safety)"]
n145["Hunger Evaluator (Autonomy and Safety)"]
n147["Inventory Evaluator (Autonomy and Safety)"]
n144["Mob Threat Evaluator (Autonomy and Safety)"]
n146["Stuck and Timeout Evaluator (Autonomy and Safety)"]
n86["Skill Tick Scheduler (Skill Runtime)"]
n177["WebSocket Codec (Transport and Protocol)"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n174["Config Schema Validator (Config and Profiles)"]
n161 -->|depends_on| n56
n161 -->|depends_on| n69
n161 -->|depends_on| n84
n70 -->|depends_on| n161
n70 -->|depends_on| n139
n70 -->|reads| n236
n70 -->|subscribes| n184
n58 -->|depends_on| n63
n58 -->|delegates_to| n69
n139 -->|depends_on| n56
n139 -->|publishes| n184
n39 -->|proposes_to| n70
n39 -->|depends_on| n174
n63 -->|reads| n69
n69 -->|controls| n63
n69 -->|depends_on| n148
n69 -->|depends_on| n143
n69 -->|depends_on| n145
n69 -->|depends_on| n147
n69 -->|depends_on| n144
n69 -->|depends_on| n146
n86 -->|reads| n69
n184 -->|depends_on| n177
n71 -->|depends_on| n161
n71 -->|depends_on| n177
n71 -->|depends_on| n70
n60 -->|delegates_to| n71
n60 -->|delegates_to| n70
n60 -->|depends_on| n139
n71 -->|depends_on| n162
n162 -->|depends_on| n174
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n69,n161,n70,n71,n162 internal;
class n56,n84,n139,n236,n184,n58,n39,n63,n148,n143,n145,n147,n144,n146,n86,n177,n60,n174 external;
```

### Agency

Source: `docs/architecture/graphs/system-agency.mmd`

```mermaid
flowchart LR
n311["Personality Model"]
n312["Needs Model"]
n313["Goal Catalog"]
n314["Goal Generator"]
n288["Goal Arbiter"]
n289["Intention Manager"]
n315["Routine Model"]
n316["Item Knowledge"]
n317["Night Preparation Config"]
n318["Shelter Strategy"]
n319["Shelter Plan"]
n320["Night Readiness"]
n290["Social Engine"]
n321["Working Memory"]
n322["Project Focus Policy"]
n241["Agency State"]
n323["Strategic Intent Policy"]
n292["Reflection"]
n60["Agent Loop (Bot Runtime and Mineflayer Adapter)"]
n61["Chat Adapter (Bot Runtime and Mineflayer Adapter)"]
n238["Agency State Store (Bot Registry and Profiles)"]
n141["Goal Tie-Break (Bot Runtime and Mineflayer Adapter)"]
n60 -->|depends_on| n288
n60 -->|depends_on| n289
n60 -->|depends_on| n241
n61 -->|depends_on| n290
n314 -->|depends_on| n313
n314 -->|depends_on| n312
n314 -->|depends_on| n311
n288 -->|depends_on| n314
n288 -->|depends_on| n312
n288 -->|depends_on| n311
n289 -->|depends_on| n288
n290 -->|depends_on| n311
n241 -->|depends_on| n312
n241 -->|depends_on| n311
n241 -->|depends_on| n289
n241 -->|depends_on| n315
n241 -->|depends_on| n321
n322 -->|depends_on| n321
n290 -->|proposes_to| n61
n238 -->|depends_on| n241
n320 -->|depends_on| n316
n320 -->|depends_on| n317
n320 -->|depends_on| n315
n320 -->|depends_on| n319
n320 -->|depends_on| n318
n318 -->|depends_on| n317
n314 -->|depends_on| n317
n314 -->|depends_on| n320
n314 -->|depends_on| n315
n323 -->|depends_on| n288
n323 -->|depends_on| n321
n60 -->|depends_on| n141
n141 -->|depends_on| n288
n60 -->|depends_on| n292
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n311,n312,n313,n314,n288,n289,n315,n316,n317,n318,n319,n320,n290,n321,n322,n241,n323,n292 internal;
class n60,n61,n238,n141 external;
```

### Bootstrap and Toolchain

Source: `docs/architecture/graphs/system-toolchain.mmd`

```mermaid
flowchart LR
n324["Bootstrap Orchestrator"]
n325["Capability Check"]
n326["Python Environment"]
n327["Minecraft Server Controller"]
n328["Firefox SVG Renderer"]
n324 -->|depends_on| n325
n324 -->|depends_on| n326
n324 -->|depends_on| n327
n324 -->|depends_on| n328
classDef internal fill:#eef6ff,stroke:#2563eb,color:#0f172a;
classDef external fill:#fff7ed,stroke:#ea580c,color:#7c2d12;
class n324,n325,n326,n327,n328 internal;
```
