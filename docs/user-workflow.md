# User workflow

What clients go through across the full lifecycle of an OAK Studio device — from unboxing through ongoing use, training custom models, troubleshooting, and updates.

**oak studio · v1.0**

---

## Contents

- [Who this is for](#who-this-is-for)
- [Lifecycle overview](#lifecycle-overview)
- [Stage 1 — Pre-purchase](#stage-1--pre-purchase)
- [Stage 2 — Unboxing and first boot](#stage-2--unboxing-and-first-boot)
- [Stage 3 — First detection and OSC test](#stage-3--first-detection-and-osc-test)
- [Stage 4 — Production setup](#stage-4--production-setup)
- [Stage 5 — Custom model training](#stage-5--custom-model-training)
- [Stage 6 — Daily operation](#stage-6--daily-operation)
- [Stage 7 — Updates and maintenance](#stage-7--updates-and-maintenance)
- [Stage 8 — Troubleshooting](#stage-8--troubleshooting)

---

## Who this is for

This doc maps the typical journey for the two primary user types of an OAK Studio device:

- **Studio operator** — the technical lead at a creative studio who installs and configures the device for a client's project. Comfortable with TouchDesigner / Max / VVVV, IP networking, and basic Python.
- **Installation artist** — the artist using the device's output to drive their visual or audio work. May or may not be hands-on with the device itself; often delegates setup to a studio operator.

Most flows below are written from the studio operator's perspective, since they're the one configuring the device. The artist's involvement is noted where relevant.

---

## Lifecycle overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. Pre-purchase│ →  │  2. Unboxing &  │ →  │  3. First       │
│     consultation│    │     first boot  │    │     detection   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       ↓
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  6. Daily       │ ←  │  5. Custom      │ ←  │  4. Production  │
│     operation   │    │     model train │    │     setup       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ↓                                              ↑
┌─────────────────┐    ┌─────────────────┐
│  7. Updates &   │ →  │  8. Trouble-    │
│     maintenance │    │     shooting    │
└─────────────────┘    └─────────────────┘
```

---

## Stage 1 — Pre-purchase

### What happens

The client (studio or artist) reaches out for a project consultation. We discuss:

- Project requirements — what they want to detect, how the data is used downstream
- Venue conditions — lighting, mounting positions, ceiling height, ambient motion
- Software environment — TouchDesigner, Max, custom apps
- Number of cameras and tier — Lite vs Pro based on lighting and depth requirements

### Outcome

Quote covering:
- Hardware bundle (1–4 cameras + Pi 5 + accessories)
- Software (bundled in hardware price)
- Service fees for setup and installation
- Optional cloud training subscription if custom models are needed

### Key decisions made here

- **Lite vs Pro** — driven by venue lighting and the kinds of detections needed
- **Camera count** — based on coverage area and detection density
- **Custom model needs** — affects whether cloud training is included

---

## Stage 2 — Unboxing and first boot

### What ships

- Pre-configured Raspberry Pi 5 (8GB) in a case with cooling
- 1–4 OAK-D cameras (Lite or Pro)
- USB-C power supply for the Pi
- USB-C cables for the cameras
- 32GB microSD card pre-imaged with the OAK Studio software
- Quick-start card with device serial number and pairing code
- Mounting hardware (camera mounts, brackets)

### Physical setup

1. **Mount the cameras** in their fixed positions (ceiling, wall, etc.)
2. **Connect cameras to Pi** via USB-C — 1 to 2 cameras per USB 3.0 controller on the Pi
3. **Connect the Pi to the network via Ethernet** — this is required for first boot. WiFi is configured later through the web UI, but the device needs an Ethernet connection to make the web UI reachable in the first place
4. **Power on the Pi** with the included USB-C adapter

> **Note on Ethernet requirement:** The device must be connected via Ethernet for initial setup. Once the operator has configured WiFi through the web UI, the Ethernet cable can be removed (though Ethernet remains recommended for installations because it's more stable). If the venue has no Ethernet at the final mounting position, the operator should perform initial setup at a workbench with Ethernet, then move the device to its final location after WiFi is configured.

### First boot

The device boots straight into the OAK Studio service. No login, no setup wizard on the device itself — the device is fully configured via the web UI from another machine on the network.

- Boot time: ~25 seconds from power-on to web UI reachable
- Default hostname: `oak-studio-pi`
- Status indicator (LED on the Pi case): blinks during boot, solid green when ready

### Finding the device on the network

The operator's laptop is on the same network. They have two options:

**Option A — via hostname (preferred):**
Open a browser to `http://oak-studio-pi.local`. Works on most modern operating systems via mDNS.

**Option B — via IP address:**
If mDNS doesn't work (some corporate networks block it), check the router's DHCP lease table or the Pi's HDMI output for the assigned IP. Enter the IP in the browser.

### Outcome

Dashboard loads in the browser, showing the connected cameras and "no models active" state. The device is now ready to configure.

---

## Stage 3 — First detection and OSC test

### Goal

Confirm the device works end-to-end before doing any project-specific setup. This is a sanity check.

### Steps

1. **Open the Cameras page** in the web UI
2. **Click cam 1** in the camera tab strip
3. **Enable pose estimation** by toggling its model card on
4. **Observe the live preview** — skeletons should appear when someone walks in front of the camera
5. **Open the OSC output page**
6. **Add a temporary OSC target** pointing to the operator's laptop running an OSC monitor (e.g. Protokol, OSCdebug, a TouchDesigner patch with an OSC In)
7. **Open the OSC monitor in the web UI** — confirm messages are streaming
8. **On the operator's laptop**, confirm OSC messages are arriving at the destination

### Expected time

5 minutes from "logged into web UI" to "OSC messages confirmed at destination."

### Outcome

Operator has confirmed the full chain works: camera → inference → OSC → network → client. Any failure at this stage is a hardware or basic config issue, not a project-specific problem.

---

## Stage 4 — Production setup

### Goal

Configure the device for the actual project — the right models, the right zones, the right OSC routing.

### Sub-steps

#### 4.1 Camera configuration

For each camera in use:

1. **Enable the models needed** — pose, depth, motion, etc. Disable everything else to keep performance high
2. **Adjust confidence thresholds** per model based on observed false positives / negatives in the live preview
3. **Define zones** for each model that needs spatial subdivision
   - Draw rectangles directly on the live preview
   - Name them meaningfully (`stage_left`, `entry`, `near_artwork`)
4. **Set per-model parameters** — max people for pose, hue tolerance for color, etc.

#### 4.2 OSC routing

1. **Add OSC targets** for each destination machine
   - TouchDesigner host
   - Sound engineer's Max patch
   - Backup logger
2. **Assign cameras to targets** — multi-target routing means cam 1 can go to TD while cam 3 goes to Max
3. **Configure global settings** — address prefix, send FPS, coordinate origin

#### 4.3 Test with downstream software

The artist or downstream operator wires up their TouchDesigner / Max patch:

1. Add an OSC In CHOP / object pointed at the OAK Studio device's IP and port
2. Subscribe to the address patterns documented in the model reference
3. Verify data flows and feels right (no jitter, sensible value ranges, latency acceptable)

### Common decisions during this stage

- **Which models per camera** — running every model on every camera is rarely needed and reduces FPS
- **Zone granularity** — fewer larger zones is usually better than many tiny ones (less OSC noise, clearer intent)
- **Send FPS** — 30 fps for responsive interaction, 10–15 fps for ambient triggers (lower bandwidth)
- **Coordinate origin** — top-left default works for most TD users; center works better for some Max patches

### Outcome

Device is producing the exact data the project needs, and downstream software is consuming it. The installation is functionally complete.

---

## Stage 5 — Custom model training

This stage is only relevant for projects that need to detect specific objects not covered by the built-in COCO classes — for example: a specific prop, a particular artwork, a unique costume element.

### Pre-requisites

- Cloud training subscription active (included or purchased separately)
- A Roboflow account
- Sample images of the target object (typically 200–800 images, depending on visual variability)

### Steps

#### 5.1 Annotate in Roboflow

The operator (or the artist, or oak studio annotation service) creates a Roboflow project and annotates images:

1. Upload images to a new Roboflow project
2. Draw bounding boxes around each instance of the target class
3. Generate a dataset version once annotation is complete

This typically takes 1–4 hours of focused work depending on dataset size.

#### 5.2 Submit to cloud training

In the OAK Studio web UI:

1. Open the **Custom models** page
2. Click **+ Train new model**
3. Paste the Roboflow project URL and API key
4. Confirm dataset details (class count, image count)
5. Choose training parameters:
   - Base model — YOLOv8n (fastest) to YOLOv8m (most accurate)
   - Epochs — 50 is a reasonable default
   - Image size — 416 is the balance point for OAK-D
6. Click **Start training**

#### 5.3 Wait for training

Training runs on the cloud GPU environment. Typical duration:
- YOLOv8n at 50 epochs: ~30–60 minutes
- YOLOv8s at 100 epochs: ~90–180 minutes

The web UI's model card shows live progress (epoch, loss, ETA). The operator can leave the page and come back later — training continues in the cloud.

#### 5.4 Automatic conversion

Once training completes, the cloud environment automatically converts the trained weights to the OAK-D blob format. This is invisible to the user — they just see the model status change from "training" to "ready".

#### 5.5 Deploy to camera

1. From the Custom models page, click **Deploy to camera**
2. Select which cameras should run the model
3. The cloud pushes the blob file to the Pi over the local network
4. The Pi hot-swaps the model into the running pipeline — no service restart needed
5. The model card status changes to "deployed", showing which cameras it's active on

#### 5.6 Verify detections

The operator returns to the Cameras page, selects the affected camera, and confirms the custom model is producing the expected detections (overlays appear on the live preview, OSC messages appear in the monitor).

### Outcome

Custom-trained YOLO model is running on the device, producing detections via the same OSC schema as the built-in object detection.

---

## Stage 6 — Daily operation

### Goal

The device runs unattended in the venue, producing OSC data continuously. The operator and artist mostly leave it alone.

### What "daily operation" actually looks like

For a permanent installation:

- The device is powered 24/7 (or scheduled on/off via the venue's power system)
- It boots automatically on power, comes online in ~25 seconds
- No daily interaction needed if everything is working

For a temporary installation (gallery show, performance run):

- Operator powers the device on at the start of the day
- Confirms the dashboard shows all cameras online and the OSC stream live
- Checks the activity feed for any overnight warnings
- Powers down at end of day (optional)

### Light-touch monitoring

The dashboard is designed for at-a-glance checks:

- Is the device online?
- Are all cameras connected and producing FPS?
- Is the OSC stream still flowing?
- Are there any warnings in the recent activity feed?

If everything is green, the operator moves on. If something looks off, they go deeper into the relevant page.

### Artist's typical interaction

The artist often doesn't touch the device at all — their TouchDesigner / Max patch handles the OSC data and produces the visuals. The OAK Studio device is "the thing in the corner that sends the magic numbers."

When the artist wants to adjust detection behavior (e.g. tune zones, change confidence thresholds), they either:
- Open the web UI themselves if they're comfortable doing so
- Ask the studio operator to make the change

---

## Stage 7 — Updates and maintenance

### Software updates

The device checks for updates daily on the stable channel. When an update is available:

1. The System page shows a banner with the new version and release notes
2. The operator clicks **Install** when convenient
3. Update downloads, installs, and restarts the pipeline (typically 1–3 minutes of downtime)
4. The OSC stream resumes automatically

Updates are not pushed automatically. The operator decides when to install.

### Maintenance actions

Available in the System page, under Maintenance:

- **Restart pipeline** — clears the detection pipeline without rebooting. ~5 seconds of OSC downtime
- **Reboot device** — full Pi reboot. ~60–90 seconds of downtime
- **Factory reset** — wipes all config and models, preserves license. Requires typing `RESET` to confirm

### Backups

Configuration is a single JSON file on the SD card. The operator can:

- **Export config** — downloads the JSON for safe-keeping (available in System → Export diagnostics)
- **Restore config** — uploads a previously-exported JSON to restore settings after a factory reset or hardware swap

### Hardware replacement

If a camera fails or the Pi needs replacement, the operator can:

1. Swap the hardware
2. Boot the new unit
3. Restore the config from a previous export
4. Continue with the same setup, same custom models (models are stored in the config bundle)

---

## Stage 8 — Troubleshooting

The most common issues and their resolution paths.

### "I can't reach the web UI"

Symptoms: browser shows "site not reachable" or timeout.

Try in order:
1. Confirm the Pi has power and the status LED is solid (not blinking)
2. Try `http://oak-studio-pi.local` instead of an IP, or vice versa
3. Check the router's DHCP table for the Pi's current IP
4. Confirm your laptop is on the same network as the Pi
5. If using fixed IP, confirm the laptop's network matches (same subnet)
6. SSH into the Pi via `ssh pi@<ip>` to check the service is running

### "OSC messages aren't arriving in TouchDesigner"

Symptoms: web UI shows messages flowing in the OSC monitor, but TouchDesigner shows nothing.

Try in order:
1. Confirm the OSC target IP in the web UI matches the TD machine's IP exactly
2. Confirm the port matches between the OAK Studio target and TD's OSC In CHOP
3. Confirm no firewall is blocking UDP on that port on the TD machine
4. Use the OSC Monitor in the web UI to confirm messages are actually being sent
5. Use a third-party OSC monitor app on the TD machine to confirm packets arrive

### "Detections are unreliable / jumpy"

Symptoms: skeletons flicker, IDs swap between people, false positives.

Try in order:
1. Increase the confidence threshold for that model
2. Check lighting conditions (Pro tier handles low light better than Lite)
3. Check camera mounting — vibration causes jitter
4. Reduce the number of active models on that camera (too many models = lower FPS = less stable tracking)

### "FPS is too low"

Symptoms: web UI shows FPS below 20, downstream visuals feel laggy.

Try in order:
1. Disable models you aren't using on that camera
2. Reduce send FPS in OSC settings (lower send rate = less Pi CPU)
3. Move Pi-side inference models (hand tracking, face landmarks) to fewer cameras
4. Check Pi temperature in the System page — thermal throttling causes FPS drops

### "Camera disconnected"

Symptoms: a camera shows offline on the dashboard.

Try in order:
1. Check the USB cable connection at both ends
2. Try a different USB port on the Pi (preferably USB 3.0)
3. Power-cycle the Pi
4. If still failing, the camera or cable may be defective — contact support

### "Custom model training failed"

Symptoms: model card shows "training failed" status.

Try in order:
1. Check the cloud training logs (linked from the model card)
2. Confirm the Roboflow dataset is valid (sufficient images, annotations present, classes consistent)
3. Try a smaller base model (YOLOv8n) — sometimes larger models fail on small datasets
4. Reduce epochs — overfitting on tiny datasets can cause early termination

### Escalation

If none of the above resolves the issue, the operator can:

1. Go to **System → Export diagnostics** — downloads a bundle with logs, config, and system info
2. Open a support ticket and attach the bundle
3. Provide the device serial number (visible on the System page and on the physical device)

The diagnostic bundle contains everything needed to debug remotely without requiring SSH access to the customer's network.
