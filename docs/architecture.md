# System architecture

How the OAK Studio device is built, from hardware to software to the network it lives on.

**oak studio · v1.0**

---

## Contents

- [Overview](#overview)
- [Hardware](#hardware)
- [Pi-side software](#pi-side-software)
- [Custom model pipeline](#custom-model-pipeline)
- [OSC output](#osc-output)
- [Web UI](#web-ui)
- [Network and discovery](#network-and-discovery)
- [Boot and recovery](#boot-and-recovery)
- [Design decisions](#design-decisions)

---

## Overview

The OAK Studio device is a self-contained computer vision unit designed for installation artists and creative studios. A single Raspberry Pi 5 acts as the compute hub for up to four OAK-D cameras, runs detection models on the cameras' onboard VPUs (with Pi-side fallback when needed), and streams the resulting detections as OSC messages over the local network. All configuration happens through a browser-based web UI served by the device itself.

```
┌────────────────────────────────────────────────────────────────┐
│                   OAK Studio device                             │
│                                                                 │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐               │
│   │ OAK-D  │  │ OAK-D  │  │ OAK-D  │  │ OAK-D  │   (1–4 cams)  │
│   │  VPU   │  │  VPU   │  │  VPU   │  │  VPU   │               │
│   └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘               │
│       └───────────┴───────────┴───────────┘                    │
│                      USB 3.0                                    │
│                         │                                       │
│                  ┌──────┴──────┐                               │
│                  │  Pi 5 (8GB) │                               │
│                  │  hub + UI    │                               │
│                  └──────┬──────┘                               │
└─────────────────────────┼───────────────────────────────────────┘
                          │  WiFi / Ethernet
              ┌───────────┼───────────┐
              │           │           │
        TouchDesigner   Max/MSP   Web browser
        (OSC in)       (OSC in)   (config UI)
```

---

## Hardware

### Cameras

Two camera tiers, sold separately as Studio Lite and Studio Pro bundles. A single device may have 1–4 cameras, all of the same model (mixing Lite and Pro within one device is not supported).

| | Studio Lite | Studio Pro |
|---|---|---|
| Camera | OAK-D Lite | OAK-D Pro |
| VPU | Movidius Myriad X | Movidius Myriad X |
| Active stereo / IR illumination | No | Yes |
| Recommended depth range | 0.5–8m | 0.35–12m |
| Low-light capable | No | Yes |

Each camera runs its own DepthAI pipeline on the onboard VPU. Inference for most detection models happens entirely on the camera — the Pi receives processed results rather than raw frames for those models. This is what makes the device viable on a Raspberry Pi without a discrete GPU.

### Compute hub

- **Raspberry Pi 5, 8GB RAM** — single unit per device, acts as hub for all cameras
- **USB 3.0** — connects each camera to the Pi. The Pi 5 has two USB 3.0 controllers, with two cameras max per controller for 4 total
- **USB-C 27W power** — for the Pi
- **microSD card** — system storage (32GB minimum, holds OS + custom models + logs)

### Connectivity

- **Gigabit Ethernet** — required for first boot (used to reach the web UI before WiFi can be configured); recommended for installations long-term (most stable)
- **WiFi 2.4 / 5 GHz** — configured via the web UI after first boot; useful for venues where running cables to the final mounting position isn't possible
- **Both can be enabled simultaneously** — Ethernet preferred when both are up

---

## Pi-side software

The Pi runs a single Python process that manages all cameras, all models, OSC output, and the web UI backend. Within that process, work is distributed across threads.

```
┌─────────────────────────────────────────────────────────────────┐
│                  systemd service (auto-start on boot)            │
└────────────────────────────────────┬────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────┐
│              Main Python process (single)                        │
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │  cam #1  │  │  cam #2  │  │  cam #3  │  │  cam #4  │       │
│   │  worker  │  │  worker  │  │  worker  │  │  worker  │       │
│   │  thread  │  │  thread  │  │  thread  │  │  thread  │       │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│        └─────────────┴─────────────┴─────────────┘              │
│                         │  frame + VPU results                  │
│                  ┌──────▼──────────────────┐                    │
│                  │     Model router        │                    │
│                  │  (VPU or Pi fallback)   │                    │
│                  └──────┬──────────────────┘                    │
│                         │                                       │
│                  ┌──────▼──────────────────┐                    │
│                  │   Pi-side inference     │                    │
│                  │   (MediaPipe, custom)   │                    │
│                  └──────┬──────────────────┘                    │
│                         │                                       │
│                  ┌──────▼──────────────────┐                    │
│                  │   Result aggregator     │                    │
│                  │ normalise · assign IDs  │                    │
│                  └──────┬──────────────────┘                    │
│                         │                                       │
│              ┌──────────┴──────────┐                            │
│              ▼                     ▼                            │
│      ┌───────────────┐    ┌────────────────┐                    │
│      │ OSC broadcaster│   │ State / event  │                    │
│      │   UDP, configd │   │     bus        │                    │
│      └───────────────┘    └───────┬────────┘                    │
│                                   │                             │
│                          ┌────────▼────────┐                    │
│                          │ FastAPI backend │                    │
│                          │ REST + WebSocket│                    │
│                          └─────────────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

### Camera worker threads

Each connected camera gets its own thread that owns a DepthAI `Device` object. The thread is responsible for starting the camera's pipeline, receiving processed results from the VPU, and putting them on an internal queue for the model router.

Threads (not processes) are used because:
- The heavy lifting happens in the DepthAI C++ layer, which releases the GIL during inference
- Shared memory across threads makes result aggregation cheap
- Inter-process complexity (IPC, serialization) is avoided

If a camera worker crashes, only its thread fails — the others keep running. The pipeline manager auto-restarts failed workers.

### Model router

This is the hot-swap point. When a custom model is deployed via the web UI, the model router swaps it in without restarting the camera worker:

1. New model is loaded into a staging slot
2. Frames begin routing to both the old and the new model briefly
3. Once the new model is producing results, the old model is unloaded
4. The OSC stream continues uninterrupted

The same mechanism handles fallback to Pi-side inference: models like hand tracking that DepthAI doesn't support on-device are routed to a MediaPipe runner on the Pi.

### Result aggregator

Raw output from the VPU and Pi-side inference comes in heterogeneous formats — pixel coordinates from one, normalized 0–1 from another, depth in millimetres from a third. The aggregator normalises everything to the OSC schema:

- **Coordinates** → normalized 0.0 to 1.0 (X, Y), meters (Z)
- **IDs** → persistent across frames using a built-in tracker
- **Confidence** → 0.0 to 1.0 across all models
- **Zone assignment** → centroid checked against the per-model zone definitions; zone name embedded in the OSC address

The aggregator is the only component that knows about the OSC schema. Camera workers and inference runners just produce results in their native format.

### OSC broadcaster

Reads from the aggregator's output queue and sends UDP packets to configured targets. Multiple targets are supported, and each target has its own camera subset (e.g. cam 1 and 2 to TouchDesigner, cam 3 to Max).

Send rate is configurable from 10 to 30 fps per camera. The broadcaster does not block on slow targets — UDP is fire-and-forget, so a non-responsive client doesn't affect other targets or the pipeline.

### State / event bus

An asyncio queue that bridges the threaded pipeline and the async FastAPI backend. Used for:
- Live preview frames (for the web UI's camera view)
- OSC monitor messages (for the web UI's debug stream)
- System events (camera connect/disconnect, model deploy, warnings)

---

## Custom model pipeline

Custom YOLO models follow a five-stage pipeline from raw images to deployed inference:

```
┌───────────────┐
│ 1. Annotate   │   User annotates training images in Roboflow
│   (Roboflow)  │   (or oak studio provides annotation as a service)
└──────┬────────┘
       │
┌──────▼────────┐
│ 2. Train      │   Roboflow project ID + API key submitted via web UI
│   (cloud GPU) │   Training runs on the managed cloud environment
└──────┬────────┘
       │
┌──────▼────────┐
│ 3. Convert    │   Trained YOLO weights are automatically converted
│   (cloud)     │   to OpenVINO IR, then to OAK-D blob format
└──────┬────────┘
       │
┌──────▼────────┐
│ 4. Deploy     │   User clicks "Deploy" in web UI
│   (local LAN) │   Cloud pushes blob to Pi over the local network
└──────┬────────┘
       │
┌──────▼────────┐
│ 5. Inference  │   Model router hot-swaps blob into camera workers
│   (VPU)       │   Detections flow through OSC as standard objects
└───────────────┘
```

### Conversion details

DepthAI runs models in a proprietary `.blob` format compiled from OpenVINO Intermediate Representation. The conversion pipeline (handled in the cloud, not on the Pi):

1. YOLO model trained in PyTorch → exported to ONNX
2. ONNX → OpenVINO IR (xml + bin)
3. OpenVINO IR → OAK-D blob via Luxonis blobconverter

This is fully automated. The user never sees blob files or OpenVINO config.

### Deployment over local network

The cloud training environment knows which Pi to push to because the device authenticates against the cloud service using its serial number + license key during training submission. When the user clicks "Deploy", the cloud opens an outbound connection to the Pi's web UI backend (provided both are reachable on the same network) and uploads the converted blob via a signed REST endpoint.

If the Pi and the user's machine are not on the same network as the cloud service can reach, the alternative is manual download from the web UI's training page and upload from the same browser session.

---

## OSC output

### Address structure

```
/oak/cam/{cam_id}/zone/{zone_name}/{model}/{detection_id}/{property}
```

- `oak` — configurable device-level prefix (default `oak`)
- `cam/{cam_id}` — camera index, 1 to 4
- `zone/{zone_name}` — user-defined zone, or `none` if no zones or outside all zones
- `{model}` — detection model name (pose, depth, object, etc.)
- `{detection_id}` — persistent tracker ID for that detection
- `{property}` — the specific data point (joint position, class label, etc.)

Zones are defined per model — each model on a camera can have its own independent zone set.

### Transport

- **UDP** — fire-and-forget, no acknowledgement, lowest latency
- **Multiple targets** — supported, with per-target camera routing
- **Send rate** — configurable 10–30 fps per camera

### Coordinate convention

- **X, Y** — normalized 0.0 to 1.0, origin at top-left of frame
- **Z** — meters from camera (depth)
- **Confidence** — 0.0 to 1.0

Detailed schema and per-model OSC messages are documented in [detection_models_reference.md](./detection_models_reference.md).

---

## Web UI

### Stack

- **Backend** — FastAPI (Python), runs in the same process as the camera pipeline
- **Frontend** — vanilla JavaScript + HTML/CSS, served as static files from the FastAPI backend
- **Transport** — REST for config, WebSocket for live data (preview frames, OSC monitor stream)

FastAPI was chosen because:
- The pipeline is already Python; sharing the process avoids IPC overhead
- Async-native, which matters for streaming live preview frames
- WebSocket support is first-class
- Pairs well with a lightweight no-build frontend

### Pages

| Page | Purpose |
|---|---|
| Dashboard | Device status, camera health, recent activity |
| Cameras | Per-camera model configuration, zones, thresholds |
| OSC output | Target configuration and live message monitor |
| Custom models | Train and deploy custom YOLO models |
| Network | Connection settings (WiFi / Ethernet / IP) |
| System | Device info, resources, logs, maintenance |

### Access

- Local network only — the Pi serves the UI on its own IP, port 80
- No authentication by default in v1 (relies on local network trust)
- Future option: optional password protection in System settings

### Configuration persistence

All settings are stored in a single JSON file on the SD card. Simple, human-readable, easy to back up and restore. Changes are atomic — the file is written to a temp path and renamed, so a crash mid-write can't corrupt the config.

---

## Network and discovery

### IP assignment

The Pi supports both DHCP and fixed IP, configurable through the Network page in the web UI. **Fixed IP is recommended for installations** since artists need a predictable address to point TouchDesigner at.

### Discovery

The Pi advertises itself on the local network via mDNS / Bonjour. By default, it is reachable at `oak-studio-pi.local` (hostname is configurable). This means:
- The user doesn't need to know the Pi's IP for first connection
- The web UI can be accessed at `http://oak-studio-pi.local`
- OSC targets can use the hostname instead of an IP

### Boot behavior

- The Pi boots straight into the OAK Studio service, no login required
- The detection pipeline starts automatically
- OSC streaming begins as soon as cameras are detected and models are configured
- The web UI is reachable within ~15 seconds of power-on

---

## Boot and recovery

### Normal boot sequence

1. Pi boots Raspberry Pi OS Lite
2. systemd starts the OAK Studio service
3. Service loads the JSON config from disk
4. Camera workers spin up for each connected camera
5. Models load on each camera's VPU
6. OSC broadcaster starts sending to configured targets
7. FastAPI backend starts serving the web UI

Total time from power on to live OSC output: typically 15–25 seconds.

### Recovery scenarios

| Failure | Behavior |
|---|---|
| One camera disconnects | Worker thread shuts down cleanly. Other cameras unaffected. Dashboard shows the camera as offline. |
| One camera reconnects | Pipeline manager detects USB enumeration, spins up a new worker, restores its config. |
| Pi-side inference crashes | Model router falls back to skipping that model. Logs the crash. Other models keep running. |
| OSC target unreachable | Broadcaster keeps sending — UDP is fire-and-forget. No retry, no buffering. |
| Web UI backend crashes | systemd auto-restarts the service. Pipeline restarts with it. |
| Config file corrupted | Service refuses to start. Recovery requires SSH access or factory reset. |
| Custom model load fails | That model is disabled with an error logged. Other models keep running. |

### Factory reset

Factory reset wipes the JSON config, all custom models, and all logs — but preserves the OS, the OAK Studio software, and the license activation. After reset, the device boots into a clean default state.

---

## Design decisions

A summary of the key architectural choices and their reasoning.

### Why one Python process instead of one per camera?

A central process with worker threads is simpler than coordinating multiple processes via IPC. The GIL is not a bottleneck because inference happens in C++ (DepthAI, MediaPipe), which releases the GIL. Failures are isolated at the thread level, so one camera worker crashing doesn't take down the others.

### Why on-camera VPU inference instead of Pi GPU?

The Pi 5 has no GPU usable for ML inference. Doing inference on the OAK-D VPU is the entire reason this hardware combination works — without it, you'd need a desktop GPU machine. This is also the main differentiator vs. competitors like ZED that require a host GPU.

### Why FastAPI + vanilla JS instead of a heavier frontend stack?

The web UI is a small surface area (6 pages) and doesn't need React or a build pipeline. Vanilla JS keeps the developer experience simple and the runtime fast on a Pi-served origin.

### Why one Pi managing all cameras instead of one Pi per camera?

Cost (one Pi instead of four), simpler networking (one IP, one mDNS name, one web UI), simpler client experience (one URL for everything). The trade-off — single point of failure for the management UI — is acceptable for installations of this size.

### Why UDP for OSC instead of TCP?

OSC over UDP is the convention in the creative coding world. Latency is what matters; missing one frame's worth of data is fine because the next frame is 33ms away. TCP's reliability would add latency for no real benefit here.

### Why one shared web UI instead of a separate desktop app?

For MVP, one device = one UI accessed in any browser keeps the product simple to ship and support. Multi-device management is a meaningful UX win for studios with several installations, but it's complex enough to ship as a future premium add-on rather than v1 core.

### Why JSON config instead of a database?

A single device with a handful of cameras and models doesn't need relational queries. JSON is human-readable for debugging, easy to back up by copying a file, and trivial to validate against a schema. If multi-device management is added later, a real database can sit in the cloud — the Pi itself can stay simple.
