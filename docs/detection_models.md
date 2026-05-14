# Detection model reference

What each model detects, sample use cases, and OSC message format.

**oak studio · v1.0 · 14 models**

---

## Contents

- [OSC address schema](#osc-address-schema)
- [Zones (region of interest)](#zones-region-of-interest)
- [Detection models](#detection-models)
  - [Pose estimation](#pose-estimation)
  - [Depth map](#depth-map)
  - [Blob / contour detection](#blob--contour-detection)
  - [Motion detection](#motion-detection)
  - [Object detection & tracking](#object-detection--tracking)
  - [Hand tracking](#hand-tracking)
  - [Face detection](#face-detection)
  - [Face landmarks](#face-landmarks)
  - [Eye / gaze tracking](#eye--gaze-tracking)
  - [Person count](#person-count)
  - [Optical flow](#optical-flow)
  - [Skeleton gestures](#skeleton-gestures)
  - [Background subtraction](#background-subtraction)
  - [Color detection](#color-detection)

---

## OSC address schema

All OSC messages follow a consistent address structure. The base prefix `/oak` is configurable per device. Camera index ranges from 1 to 4. Detection IDs are assigned per model and persist across frames while the target is tracked.

```
# Address structure
/oak/cam/{cam_id}/zone/{zone_name}/{model}/{detection_id}/{property} → value(s)

# Coordinate system
#   x, y: normalized 0.0 — 1.0 (origin top-left)
#   z: meters from camera
#   confidence: 0.0 — 1.0

# Send mode: continuous at configured FPS (default 30, range 10–30)
```

---

## Zones (region of interest)

Zones are user-defined rectangular regions drawn on the camera view via the web UI. Zones are **defined per model** — each detection model running on a camera has its own independent set of zones. This means pose estimation can have zones like "left / right", while object detection on the same camera can have entirely different zones like "entry / exit".

The zone name is **embedded in the OSC address path**, which allows clients (TouchDesigner, Max, etc.) to pattern-match on zones directly without correlating separate messages.

If no zones are defined for a model, the zone segment is set to `none` for all detections from that model. Detections that fall outside any defined zone are also tagged with `none`, or dropped entirely if configured per model.

```
# Detection inside the "left" zone
/oak/cam/1/zone/left/pose/0/joint/right_wrist  → 0.62 0.45 1.83 0.97

# Same person, moved into "right" zone
/oak/cam/1/zone/right/pose/0/joint/right_wrist → 0.71 0.46 1.85 0.97

# No zones defined or detection outside all zones
/oak/cam/1/zone/none/pose/0/joint/right_wrist  → 0.40 0.45 1.83 0.97
```

### Pattern matching in TouchDesigner

The zone-in-address structure lets you route detections by zone with a single wildcard:

```
/oak/cam/1/zone/left/*    → all detections inside "left"
/oak/cam/*/zone/door/*    → all detections inside "door" across all cameras
```

---

## Detection models

> **Note:** all model addresses below assume base prefix `/oak/cam/{n}/zone/{zone_name}`. When no zones are defined, `{zone_name}` is `none`.

### Pose estimation

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU

Detects and tracks the full skeleton of up to 5 people simultaneously. Each person gets a unique ID and 17 joint positions in normalized 2D coordinates plus depth (Z) in meters.

#### What you get

- 17 joint positions (x, y, z)
- Confidence per joint (0.0–1.0)
- Person presence trigger
- Unique tracked ID per person

#### Example use cases

- Body-reactive visuals and projection mapping
- Multi-person generative audio from joint positions
- Presence-triggered installations
- Zone-based per-limb interaction

#### Sample OSC

```
.../pose/0/joint/right_wrist  → 0.62 0.45 1.83 0.97
.../pose/0/present            → 1
```

---

### Depth map

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU

Measures distance from the camera to every point in the frame using stereo vision. Reports the average depth within each defined zone.

#### What you get

- Distance in meters per zone
- Optional raw depth output
- Active stereo for low-texture scenes (Pro)
- Works in low-light (Pro)

#### Example use cases

- Proximity-triggered effects
- Distance-to-audio parameter mapping
- Depth-layered spatial events
- 3D spatial interaction without body tracking

#### Sample OSC

```
.../depth/average  → 1.20
```

Depth's per-zone output is naturally expressed through the zone-in-address pattern: each zone produces its own `.../depth/average` message.

---

### Blob / contour detection

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU

Detects distinct regions of movement or color contrast as blobs. Each blob has a centroid, area, and bounding box. Useful for abstract input without specific object recognition.

#### What you get

- Centroid (x, y) per blob
- Area as fraction of frame (0.0–1.0)
- Bounding box (x, y, w, h)
- Unique tracked ID per blob

#### Example use cases

- Abstract particle systems driven by blob position
- Map blob area to scale or audio amplitude
- Track colored props or costumes on stage
- Low-latency motion-reactive visuals

#### Sample OSC

```
.../blob/0/centroid  → 0.34 0.51
.../blob/0/area      → 0.08
```

---

### Motion detection

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU

Detects movement within zones. Each zone outputs a presence trigger and a continuous motion intensity. Lightweight and low-latency — ideal as a first trigger layer.

#### What you get

- Presence trigger per zone (0 or 1)
- Motion intensity per zone (0.0–1.0)
- Configurable sensitivity

#### Example use cases

- Wake an installation when someone enters
- Drive ambient audio intensity from crowd energy
- Zone-based lighting or video triggers
- Spatial awareness without body tracking

#### Sample OSC

```
.../motion/intensity  → 0.82
.../motion/present    → 1
```

---

### Object detection & tracking

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU

Detects and tracks objects from COCO 80-class vocabulary or a custom-trained YOLO model. Each object gets a persistent ID, position, and velocity across frames.

#### What you get

- Class label (COCO or custom)
- Position (x, y, z)
- Velocity vector (vx, vy)
- Confidence score
- Persistent ID across frames

#### Example use cases

- Track a specific prop across an installation
- Trigger when an object enters a zone
- Map object velocity to visual parameters
- Custom: detect branded objects, artwork, tools

#### Sample OSC

```
.../object/2/class     → bottle
.../object/2/position  → 0.55 0.40 1.20
.../object/2/velocity  → 0.02 -0.01
```

---

### Hand tracking

**Tiers:** Pro only &nbsp; **Runtime:** Raspberry Pi

Tracks up to 2 hands with 21 landmark points each, including finger joints and wrist. Provides fine-grained finger and gesture data for close-range interaction.

#### What you get

- 21 landmark positions per hand (x, y, z)
- Up to 2 hands simultaneously
- Hand ID (0 = left, 1 = right)
- Best within 1–2m of camera

#### Example use cases

- Finger-position generative visuals
- Gesture-based parameter control
- Pinch / spread as interaction events
- Finger curl to audio filter mapping

#### Sample OSC

```
.../hand/1/landmark/index_tip  → 0.48 0.33 0.62
.../hand/0/landmark/wrist      → 0.51 0.55 0.70
```

---

### Face detection

**Tiers:** Pro only &nbsp; **Runtime:** OAK-D VPU

Detects faces and outputs presence and bounding box per detection. No facial recognition or biometric data — spatial position only, keeping the model privacy-minimal.

#### What you get

- Face presence trigger per ID
- Bounding box center (x, y)
- Bounding box size (w, h) normalized
- No biometric data

#### Example use cases

- Trigger effects when viewer faces camera
- Drive visuals from face position
- Count visitors looking at installation
- Gaze-zone interaction without eye tracking

#### Sample OSC

```
.../face/0/present   → 1
.../face/0/position  → 0.50 0.38 0.12 0.18
```

---

### Face landmarks

**Tiers:** Pro only &nbsp; **Runtime:** Raspberry Pi

468-point face mesh covering eyes, brows, mouth, nose, and jaw. Provides expression and feature-level data beyond basic face detection.

#### What you get

- Mouth open value (0.0–1.0)
- Eye open per side (0.0–1.0)
- Key landmark positions
- Smile / brow raise derived metrics

#### Example use cases

- Expression-driven visuals
- Mouth-open trigger for audio
- Smile detection events
- Eye direction as cursor input

#### Sample OSC

```
.../face/0/landmark/mouth_open       → 0.72
.../face/0/landmark/left_eye_open    → 0.94
.../face/0/landmark/right_eye_open   → 0.92
```

---

### Eye / gaze tracking

**Tiers:** Pro only &nbsp; **Runtime:** Raspberry Pi

Estimates where a person is looking based on iris position within the eye. Derived from face landmarks — no extra hardware. Outputs a normalized gaze vector and target point.

#### What you get

- Gaze direction vector (x, y)
- Estimated target point in frame
- Confidence value
- Best within 1m of camera

#### Example use cases

- Viewer gaze drives visuals
- Attention heatmap over time
- Look-at-object triggers
- Interactive gaze-aware installations

#### Sample OSC

```
.../gaze/0/direction  → 0.12 -0.05
.../gaze/0/target     → 0.55 0.40
```

---

### Person count

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU (derived)

A lightweight aggregation layer on top of pose or face detection. Outputs a simple integer count of people in the frame. With zones defined, you get a count per zone automatically through the zone-in-address pattern.

#### What you get

- Count of people in zone (or total if no zones)
- Configurable update interval
- No extra cost — derived from pose/face

#### Example use cases

- Scale visuals by crowd size
- Trigger when room fills
- Per-zone occupancy events
- Visitor analytics over time

#### Sample OSC

```
.../count/people  → 3
```

When zones are defined, each zone produces its own count message — `/oak/cam/1/zone/left/count/people`, `/oak/cam/1/zone/right/count/people`, etc.

---

### Optical flow

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU

Measures the direction and speed of pixel movement across the frame, producing a flow field. Captures overall energy and direction of movement without needing body detection.

#### What you get

- Dominant direction vector (x, y)
- Overall magnitude (0.0–1.0)
- Optional grid-cell vectors
- Configurable grid resolution

#### Example use cases

- Flow field as generative visual input
- Wind-like visual effects from crowd motion
- Dominant direction triggers
- Crowd energy mapping

#### Sample OSC

```
.../flow/dominant    → 0.72 -0.31
.../flow/magnitude   → 0.54
```

Optical flow is computed over the full frame; with zones defined, flow is computed independently per zone and routed through the corresponding zone address.

---

### Skeleton gestures

**Tiers:** Lite · Pro &nbsp; **Runtime:** Raspberry Pi

Classifies discrete gestures (wave, raise hand, arms out, jump, pose-hold) derived from pose data. Lightweight classifier on top of the pose stream.

#### What you get

- Gesture type label
- Confidence (0.0–1.0)
- Person ID who triggered it
- Default vocabulary of 6 gestures

#### Example use cases

- Wave to trigger event
- Raise hands to change mode
- Jump detection for energy bursts
- Pose-hold for sustained interaction

#### Sample OSC

```
.../gesture/0/type        → wave
.../gesture/0/confidence  → 0.91
```

---

### Background subtraction

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU

Separates moving foreground subjects from a static background, producing a silhouette. More robust than blob detection in complex scenes.

#### What you get

- Silhouette centroid (x, y)
- Foreground area (0.0–1.0)
- Bounding box around silhouette
- Configurable sensitivity

#### Example use cases

- Live silhouette projection
- Green-screen-like separation without color key
- Shadow mapping in installations
- Clean foreground extraction

#### Sample OSC

```
.../silhouette/0/centroid  → 0.50 0.42
.../silhouette/0/area      → 0.14
```

---

### Color detection

**Tiers:** Lite · Pro &nbsp; **Runtime:** OAK-D VPU

Detects dominant colors or tracks specific color ranges in the frame. Configurable target hue via web UI. Useful for tracking colored props or costumes.

#### What you get

- Centroid per matching color region
- Area of matching pixels
- Dominant color RGB triplet
- Configurable hue tolerance

#### Example use cases

- Track a red ball or colored prop
- Follow a colored costume across stage
- Trigger on dominant color shift
- Palette-reactive visuals

#### Sample OSC

```
.../color/red/centroid  → 0.38 0.55
.../color/red/area      → 0.05
.../color/dominant      → 0.82 0.21 0.14
```
