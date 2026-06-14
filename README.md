# 🛡️ Sential Local Engine

**The Open-Source, Zero-Retention Web3 Security Auditor.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED.svg?logo=docker)](https://www.docker.com/)
[![Foundry](https://img.shields.io/badge/Foundry-Embedded-orange.svg)](https://book.getfoundry.sh/)
[![Node Version](https://img.shields.io/badge/Node-v20--Bullseye-green.svg)](https://nodejs.org/)
[![Vite Version](https://img.shields.io/badge/Vite-7.x-646CFF.svg)](https://vite.dev/)
[![Version](https://img.shields.io/badge/Version-2.0.4--CE-blue.svg)]()

> **Sential Local** is an enterprise-grade, decentralized smart contract auditing engine that operates entirely on your local hardware. It orchestrates **Semantic Abstract Syntax Tree (AST) Parsing**, an autonomous **Multi-Model LLM Adversarial Waterfall**, and an embedded **Foundry "Guillotine" Sandbox** to mathematically isolate, simulate, and verify Web3 vulnerabilities with zero false positives.

Unlike typical cloud-based auditing suites or SaaS wrappers, Sential Local treats your source code as **ephemeral runtime data**. Your intellectual property is ingested straight into volatile container RAM, cryptographically processed through secure local streams, and **never saved, tracked, or sent to a centralized server for AI training.**

---

## 📖 Table of Contents

- [What Is This? (Simple Explanation)](#-what-is-this-simple-explanation)
- [What You Will Need](#-what-you-will-need-the-shopping-list)
- [Master System Architecture](#️-master-system-architecture--topology)
- [The Adversarial Triad Engine](#-the-adversarial-triad-engine)
- [Step-by-Step Installation](#-step-by-step-installation)
  - [Windows Setup](#-windows-setup-step-by-step)
  - [macOS Setup](#-macos-setup-step-by-step)
  - [Linux Setup](#-linux-setup-step-by-step)
- [Getting Your API Keys](#-getting-your-api-keys)
- [Running Sential for the First Time](#-running-sential-for-the-first-time)
- [How to Scan a Smart Contract](#-how-to-scan-a-smart-contract)
- [Reading Your Results](#-reading-your-results)
- [Troubleshooting Guide](#-the-definitive-troubleshooting--bug-ledger)
- [Maintenance Commands](#-maintenance--resource-allocation)
- [FAQ](#-frequently-asked-questions-faq)
- [License](#️-license--legal-framework)

---

## 🧒 What Is This? (Simple Explanation)

Imagine you wrote a secret recipe and you want to make sure no one can steal it or break it. You would hire a team of security experts to test it from every angle before publishing it to the world.

**Sential Local does exactly that — but for blockchain smart contracts.**

A **smart contract** is a tiny program that lives on a blockchain (like Ethereum) and automatically handles money and rules for apps like NFTs, DeFi, and DAOs. If there is a bug in that contract, hackers can drain millions of dollars from it in seconds. It has happened hundreds of times.

Sential Local uses **multiple AI models** — each playing a different role — to attack your smart contract code the same way a real hacker would, then verify every single finding with a real Ethereum simulator running on your own computer. If an AI claims it found a bug, the Foundry sandbox actually *proves* it by running the attack. No proof = no false alarm.

**The best part:** Everything happens on your machine. Your code never leaves. No subscriptions. No servers. No data leaks.

---

## 🛒 What You Will Need (The Shopping List)

Before you start, here is everything you need. Do not worry — most of it is free.

| Item | What It Is | Cost | Where to Get It |
|------|-----------|------|----------------|
| **A Computer** | Windows 10/11, macOS 12+, or Ubuntu Linux | Free (you have one!) | — |
| **Git** | A tool that downloads code from the internet | Free | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | A magic box that runs the whole app inside a virtual Linux machine | Free | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **At Least One API Key** | A password that lets Sential talk to an AI brain | Free tier available | See the [API Keys section](#-getting-your-api-keys) below |
| **Internet Connection** | Only needed for the first download (~5 minutes) | — | — |
| **~5 GB of Free Disk Space** | For Docker's virtual machine files | — | — |

> 💡 **That's it.** You do NOT need to install Python, Node.js, Foundry, or any programming language. Docker handles all of that inside its own virtual container.

---

## 🗺️ Master System Architecture & Topology

Here is a bird's-eye view of how everything is connected. Think of it like a factory assembly line where your smart contract code goes in one end and a detailed security report comes out the other.

```
       [ Your Browser → http://localhost:5173 ]
                           │
                           │  HTTP REST & Server-Sent Events (SSE)
                           ▼
 ┌──────────────────────────────────────────────────────────┐
 │               DOCKER VIRTUAL BRIDGE NETWORK              │
 │                                                          │
 │  ┌────────────────────────┐    ┌──────────────────────┐  │
 │  │    Frontend Container  │    │  Backend Container   │  │
 │  │     (Vite 7 + React)   │    │  (Node 20 + Python)  │  │
 │  │                        │◄──►│                      │  │
 │  │  • Port: 5173          │    │  • Port: 3001        │  │
 │  │  • Live Terminal UI    │    │  • Python AST Parser │  │
 │  │  • PDF Report Export   │    │  • Embedded Foundry  │  │
 │  └────────────────────────┘    └──────────────────────┘  │
 │                                          │               │
 └──────────────────────────────────────────│───────────────┘
                                            │
                         ┌──────────────────▼──────────────┐
                         │       EXTERNAL AI PROVIDERS      │
                         │                                  │
                         │  Groq → DeepSeek → MiniMax       │
                         │  Gemini → Claude → Zhipu         │
                         └──────────────────────────────────┘
```

### Node 1: The Frontend UI Container (`client/`)

This is the website you see in your browser. It is a live hacker-style terminal dashboard that shows you every step of the audit as it happens in real-time.

- **Technology Stack:** React 18, Vite 7.x, TypeScript, Tailwind CSS, `html2pdf.js`
- **Runs on:** `node:20-bullseye-slim` (a lightweight Linux environment inside Docker)
- **What it does:** Streams multi-line telemetry blocks from the backend and renders them as a live, animated audit log. Lets you export your final report as a PDF.

### Node 2: The Ingestion & Audit Core Node (`server/`)

This is the brain of the operation. It parses your code, breaks it into smart chunks, and orchestrates the AI waterfall.

- **Technology Stack:** Node.js 20 (Express), Python 3.10 (Tree-Sitter AST Engine), `AdmZip`
- **Runs on:** `nikolaik/python-nodejs:python3.10-nodejs20-bullseye` (a hybrid Linux environment)
- **What it does:** Handles file decompression, algorithmic code-slicing, and LLM orchestration. It is also the gatekeeper that strips boilerplate Solidity code so the AI focuses only on risky logic.

### Node 3: The Isolated Guillotine Sandbox (Foundry)

This is the lie detector. After the AI says "I found a bug," Foundry actually *tries* the attack in a simulated Ethereum environment to see if it works.

- **Technology Stack:** Foundry Toolchain (`forge`, `cast`, `anvil`)
- **Runs on:** Injected directly into the Backend container's `/root/.foundry/bin` at build time
- **What it does:** Compiles AI-generated exploit test files (`.t.sol`), runs them against a copy of your smart contract, and confirms or denies every vulnerability claim. If the exploit fails to execute, the finding is automatically downgraded to `[UNVERIFIED]`.

---

## 🧠 The Adversarial Triad Engine

Sential does not rely on a single AI model asking one question. It simulates a **real human red-team security audit** using multiple AI models, each playing a specialized role, with an automated fallback system if any provider hits a rate limit.

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                  ADVERSARIAL TRIAD PIPELINE                     │
  │                                                                 │
  │  Your Solidity Code                                             │
  │         │                                                       │
  │         ▼                                                       │
  │  ┌─────────────┐     Strips boilerplate, maps inheritance,      │
  │  │  GATEKEEPER │ ──► isolates high-risk logic vectors           │
  │  │  (Triage)   │     Model: Groq Llama 4 Scout                  │
  │  └──────┬──────┘                                               │
  │         │                                                       │
  │         ▼                                                       │
  │  ┌─────────────┐     Adopts hacker mindset. Writes a real       │
  │  │  RED TEAM   │ ──► Foundry exploit test (.t.sol file)         │
  │  │  (Attacker) │     Model: DeepSeek V4-Pro                     │
  │  └──────┬──────┘                                               │
  │         │                                                       │
  │         ▼                                                       │
  │  ┌─────────────┐     Verifies the math, kills hallucinations,   │
  │  │  BLUE TEAM  │ ──► formats the JSON verdict                   │
  │  │   (Judge)   │     Model: Claude Opus 4.8                     │
  │  └──────┬──────┘                                               │
  │         │                                                       │
  │         ▼                                                       │
  │  ┌─────────────┐     Runs `forge test` locally. Confirms or     │
  │  │ GUILLOTINE  │ ──► denies every single vulnerability          │
  │  │  (Sandbox)  │     Engine: Local Foundry Binary               │
  │  └─────────────┘                                               │
  └─────────────────────────────────────────────────────────────────┘
```

| Phase | Agent Role | Primary Model | Automatic Fallback Chain | Objective |
|-------|-----------|---------------|--------------------------|-----------|
| **Phase 1: Gatekeeper** | Semantic Triage | Groq Llama 4 Scout | Gemini 3.1 Pro | Analyzes payload complexity, strips boilerplate, maps inheritance graphs, and flags high-risk code vectors for deep analysis. |
| **Phase 2: Red Team** | Exploit Synthesis | DeepSeek V4-Pro | MiniMax M3 → Gemini 3.1 Pro → Groq Llama 4 Scout | Adopts a hostile adversarial persona. Synthesizes a physical `.t.sol` Foundry test file designed to compromise the target contract. |
| **Phase 3: Blue Team** | Verifier & Judge | Claude Opus 4.8 | Zhipu GLM-5.1 → Groq Llama 4 Scout → Gemini 3.1 Pro | Receives the target code and the Red Team's hypothesis. Performs logical verification, eliminates hallucinations, and formats telemetry into strict, structured JSON. |
| **Phase 4: Guillotine** | EVM Sandbox | Local Foundry Binary | *(Hardware Bound — No Fallback)* | Executes `forge test` inside the container. If the test passes, the vulnerability is confirmed `CRITICAL`. If it fails, the entry is downgraded to `[UNVERIFIED BY ENGINE]`. |

> 🔁 **The Hot-Swap Waterfall:** If DeepSeek hits its rate limit during Phase 2, the engine automatically and silently switches to MiniMax M3, then Gemini 3.1 Pro, then Groq — without interrupting your audit. You only need **one working API key** to start a scan.

---

## 💻 Step-by-Step Installation

Pick your operating system below and follow every step in order. Do not skip steps.

---

### 🪟 Windows Setup (Step-by-Step)

#### Step 1: Install Git

Git is the tool that will download Sential's code from GitHub onto your computer.

1. Go to [gitforwindows.org](https://gitforwindows.org/)
2. Click the big green **Download** button
3. Open the installer file you downloaded (it will be named something like `Git-2.x.x-64-bit.exe`)
4. Click **Next** through every screen — the default settings are perfect
5. Click **Install**, then **Finish**
6. To check it worked: Press `Windows Key + R`, type `cmd`, press Enter, then type `git --version` and press Enter. You should see a version number.

#### Step 2: Install Docker Desktop

Docker is the magic box that runs the whole Sential engine inside a virtual Linux machine on your Windows PC. You do NOT need to set up Linux yourself — Docker handles all of that.

1. Go to [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Click **Download for Windows**
3. Open the installer (`Docker Desktop Installer.exe`)
4. On the configuration screen, make sure **"Use WSL 2 based engine (recommended)"** is checked ✅
   > This is the option that tells Docker to use Windows' built-in Linux layer. You do not need to configure anything in WSL yourself — Docker handles it automatically.
5. Click **OK** and let the installer finish (this may take a few minutes)
6. Click **Close and restart** when prompted — your computer will reboot

#### Step 3: Start Docker Desktop

1. After your computer restarts, find **Docker Desktop** in your Start Menu and open it
2. Accept the terms of service if prompted
3. Wait until you see a **green dot** or the text "Engine running" in the bottom-left corner of the Docker Desktop window
4. Docker is now ready ✅

#### Step 4: Download Sential

1. Press `Windows Key + R`, type `cmd`, and press Enter to open a Command Prompt
2. Copy and paste the following commands one at a time, pressing Enter after each:

```cmd
git clone https://github.com/grweb3/sential-local.git
cd sential-local
```

#### Step 5: Launch Sential

1. Inside the `sential-local` folder, find the file called **`start.bat`**
2. Double-click `start.bat` — OR — in your Command Prompt window, type `start.bat` and press Enter

> ⏳ **First-Time Warning:** The very first time you run this, Docker needs to download a lightweight Linux environment, Python, Node.js, and compile the Foundry toolchain. This will take **3–5 minutes** depending on your internet speed. You will see a lot of text scrolling — this is completely normal. Do not close the window.

3. When the setup is complete, your browser will automatically open to `http://localhost:5173` ✅

---

### 🍎 macOS Setup (Step-by-Step)

#### Step 1: Install Git

1. Open the **Terminal** app (search for it with `Cmd + Space`, type "Terminal")
2. Type the following command and press Enter:
   ```bash
   git --version
   ```
3. If Git is not installed, macOS will automatically pop up a window saying **"The 'git' command requires the command line developer tools. Would you like to install them?"**
4. Click **Install** and wait for it to finish (this takes about 5 minutes)
5. Run `git --version` again to confirm it shows a version number ✅

#### Step 2: Install Docker Desktop

1. Go to [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Click **Download for Mac**
   - If you have an **M1, M2, M3, or M4 Mac** (Apple Silicon): download the **Apple Silicon** version
   - If you have an older Intel Mac: download the **Intel Chip** version
   - Not sure which you have? Click the Apple menu (🍎) → **About This Mac**
3. Open the `.dmg` file you downloaded
4. Drag the **Docker** icon into your **Applications** folder
5. Open Docker from your Applications folder
6. macOS may ask for your password or ask you to approve a system extension — click **OK** or **Allow** for all prompts
7. Wait until the Docker whale icon in your menu bar (top-right of screen) stops animating — it means Docker is running ✅

#### Step 3: Download Sential

1. Open your **Terminal** app
2. Copy and paste the following commands one at a time, pressing Enter after each:

```bash
git clone https://github.com/grweb3/sential-local.git
cd sential-local
```

#### Step 4: Launch Sential

```bash
chmod +x start.sh
./start.sh
```

> ⏳ **First-Time Warning:** The very first run downloads Linux, Python, Node.js, and Foundry inside Docker. This takes **3–5 minutes**. You will see lots of text — that is normal! Don't close the Terminal.

When you see the message that the engine is ready, your browser will open to `http://localhost:5173` automatically ✅

---

### 🐧 Linux Setup (Step-by-Step)

#### Step 1: Install Git and Docker

Open your Terminal and run the following commands in order:

```bash
# Update your package list
sudo apt update

# Install Git and curl
sudo apt install git curl -y

# Install Docker and Docker Compose
sudo apt install docker.io docker-compose -y

# Start Docker and make it start automatically on boot
sudo systemctl enable docker --now

# Add yourself to the Docker group (so you don't need "sudo" every time)
sudo usermod -aG docker $USER
```

> ⚠️ **Important:** After adding yourself to the Docker group, you must **log out and log back in** for the permission to take effect. Alternatively, run `newgrp docker` in your current terminal session.

#### Step 2: Download Sential

```bash
git clone https://github.com/grweb3/sential-local.git
cd sential-local
```

#### Step 3: Launch Sential

```bash
chmod +x start.sh
./start.sh
```

> ⏳ First run takes 3–5 minutes. Subsequent boots are under 5 seconds.

Your browser will open to `http://localhost:5173` when ready ✅

---

## 🔑 Getting Your API Keys

Sential needs at least **one** API key to talk to an AI model. All providers listed below have a **free tier** — you only need to pay if you want to run many scans. Here is a simple guide for getting each one.

> 💡 **You only need ONE key to start.** Adding more keys enables the automatic fallback waterfall (if one AI is busy, Sential uses another automatically).

### Groq (Recommended for Beginners — Fastest & Free)

Groq runs **Llama 4 Scout** and is the fastest free option.

1. Go to [console.groq.com](https://console.groq.com/)
2. Click **Sign Up** and create an account (free)
3. After logging in, click **API Keys** in the left sidebar
4. Click **Create API Key**, give it a name like "Sential", and click **Submit**
5. Copy the key that appears (it starts with `gsk_...`) — save it somewhere safe!

### DeepSeek (Best Red Team Model — Free Tier Available)

1. Go to [platform.deepseek.com](https://platform.deepseek.com/)
2. Click **Sign Up** and register
3. Go to **API Keys** in the dashboard
4. Click **Create API Key**, copy it (starts with `sk-...`)
5. Note: DeepSeek gives you free credits on sign-up

### Google Gemini (Best Fallback — Generous Free Tier)

1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **Get API Key** → **Create API key**
4. Copy the key (starts with `AIza...`)

### Anthropic / Claude (Best Judge Model)

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up and verify your account
3. Go to **API Keys** in the dashboard
4. Click **Create Key**, name it "Sential", and copy it (starts with `sk-ant-...`)

### MiniMax (Free Fallback)

1. Go to [api.minimax.chat](https://api.minimax.chat/)
2. Register an account
3. Go to **Account** → **API Keys**, create and copy your key

### Zhipu / GLM (Free Open-Source Fallback)

1. Go to [open.bigmodel.cn](https://open.bigmodel.cn/)
2. Register and verify your account
3. Go to **API Keys** and create a new one

---

## 🚀 Running Sential for the First Time

Once you have launched the engine and your browser has opened to `http://localhost:5173`, here is exactly what to do.

### Step 1: Add Your API Keys

1. In the Sential UI, click **⚙️ Settings** in the left sidebar
2. You will see a row of boxes for each AI provider
3. Paste your API key(s) into the boxes for any providers you signed up with
4. Click **Save** — your keys are immediately encrypted and stored **only in your browser's local memory**

> 🔒 **Security Note:** Your API keys never leave your machine. They are saved in your browser's `localStorage` under encrypted keys (`sential_key_*`). When you start a scan, the keys are temporarily sent to the backend running on `localhost`, held in RAM only for the duration of the scan, and then permanently deleted from memory the moment the scan ends.

### Step 2: Choose What to Scan

Click the **Scanner** tab. You have three options:

| Method | Best For | What to Enter |
|--------|---------|---------------|
| **Raw Solidity** | Testing your own code | Paste your `.sol` file contents directly |
| **Etherscan URL** | Auditing live deployed contracts | Enter a contract address like `0xA0b86991...` |
| **GitHub Repo** | Full protocol audits | Enter `owner/repo` like `Uniswap/v3-core` |

### Step 3: Configure Scan Options

- **Deep Supply Chain Scan (Toggle):** Turn this ON if you want to scan `node_modules/` and `lib/` folders for hidden upstream vulnerabilities. This uses more API tokens but finds supply chain attacks.
- **Etherscan API Key:** Required only if you are scanning a live contract by address.

### Step 4: Start the Scan

Click **🚀 Run Audit**. The terminal on the right side of the screen will come to life with a real-time stream of everything the AI models are doing.

---

## 📊 Reading Your Results

After the scan finishes, you will see a structured report in the terminal. Here is what the different labels mean:

| Label | Color | Meaning |
|-------|-------|---------|
| `[CRITICAL — VERIFIED]` | 🔴 Red | A real vulnerability that Foundry confirmed by running an exploit |
| `[HIGH — VERIFIED]` | 🟠 Orange | A serious issue that was mathematically confirmed |
| `[MEDIUM]` | 🟡 Yellow | A potential issue the AI flagged but may need manual review |
| `[LOW]` | 🔵 Blue | Minor issues, best practices, or gas optimizations |
| `[UNVERIFIED BY ENGINE]` | ⚪ Grey | The AI reported a bug, but Foundry's exploit test failed to reproduce it |
| `[INFO]` | 🟢 Green | Informational notes about your contract's architecture |

> ✅ A `[VERIFIED]` label means Foundry actually ran attack code against a simulation of your contract and the attack succeeded. These are real bugs that need fixing before deployment.

> ⚠️ An `[UNVERIFIED]` label means the AI thought something was suspicious, but it could not write working attack code that proves it. Treat these as leads for manual review, not confirmed vulnerabilities.

### Exporting Your Report

Click the **📄 Export PDF** button at the top of the results panel to download a professional-formatted audit report you can share with your team or clients.

---

## 🛑 The Definitive Troubleshooting & Bug Ledger

Here are every known issue, their causes, and exactly how to fix them.

---

### ❌ Problem 1: "Docker Desktop won't open" or "Docker is not running"

**Symptom:** You double-click Docker Desktop and nothing happens, or the icon appears but never shows as "Running."

**On Windows:**
- Open **Task Manager** (`Ctrl + Shift + Esc`)
- Look for a process called "Docker Desktop" — if it is there, right-click it and click **End Task**
- Wait 10 seconds, then reopen Docker Desktop from the Start Menu
- If it still doesn't work, go to **Settings → Apps** in Windows, find "Docker Desktop", click it, and select **Repair**

**On macOS:**
- Click the Docker whale icon in your menu bar and select **Quit Docker Desktop**
- Wait 10 seconds, then reopen it from your Applications folder
- If macOS gives a security warning, go to **System Preferences → Privacy & Security** and click **Allow**

---

### ❌ Problem 2: `'docker-compose' is not recognized` (Windows)

**Symptom:** You run `start.bat` and see an error like `'docker-compose' is not recognized as an internal or external command`.

**Cause:** Docker Desktop is not running in the background.

**Fix:**
1. Open **Docker Desktop** from your Start Menu
2. Wait for the green "Running" indicator
3. Run `start.bat` again

---

### ❌ Problem 3: `bind: address already in use` — Port Conflict

**Symptom:** Docker fails to start the containers and shows an error mentioning port `5173` or `3001`.

**Cause:** Another program on your computer is already using one of those ports (a web server, a game, another Docker container, etc.).

**Fix:**
```bash
docker compose down --remove-orphans
```
Then rerun `start.bat` (Windows) or `./start.sh` (Mac/Linux).

If the error persists, try restarting your computer entirely — this clears all port locks.

---

### ❌ Problem 4: Scan fails with `API_EXHAUSTION`

**Symptom:** The scan starts but dies mid-way with an error mentioning rate limits or exhausted credits.

**Cause:** The AI provider you are using has run out of free credits for today, or you have hit a rate limit.

**Fix:**
1. Go to **⚙️ Settings** in the Sential UI
2. Add an API key from a different provider (e.g., if DeepSeek failed, add a Groq key)
3. The waterfall will automatically use the new key next time
4. Alternatively, wait until midnight when most free tier limits reset

---

### 🐛 Problem 5: The Windows Volume Sync Freeze (VHDX Jam)

**Symptom:** Running `docker compose up` triggers an endless loading loop. The CPU sits idle, but disk operations stall and nothing happens.

**Cause:** Docker is trying to synchronize tens of thousands of `node_modules` files across the Windows/Linux filesystem bridge, which can deadlock on some systems.

**Fix:** Forcefully clear the volume cache and rebuild from scratch:
```bash
docker compose down -v
docker compose build --no-cache
docker compose up -d
```
> ⚠️ This will re-download some Docker layers and takes about 5 minutes. Your API keys (stored in your browser) are not affected.

---

### 🐛 Problem 6: Frontend Crashes with `TypeError: crypto.hash is not a function`

**Symptom:** The browser shows a blank white page, and your Docker logs show `TypeError: crypto.hash is not a function`.

**Cause:** Vite 7 requires Node.js version 20 or newer. If Docker is using an old cached image based on Node 18, it will crash.

**Fix:** Force Docker to rebuild using the correct base image:
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

### 🐛 Problem 7: Backend Crashes Mid-Scan with `Cannot read properties of null`

**Symptom:** The scan terminal freezes halfway through, and the backend Docker log shows `Cannot read properties of null (reading 'substring')`.

**Cause:** This is a TCP half-close race condition. Vite's development proxy sends an automatic "keep-alive" ping during the long Server-Sent Events (SSE) stream. The backend misinterprets this ping as the user closing the browser tab, and prematurely wipes the smart contract code from RAM while the AI is still processing it.

**Why it is already fixed:** Sential's backend (`server/index.js`) isolates all garbage collection exclusively to the `finally {}` block of the HTTP request lifecycle. It completely ignores false-positive disconnect signals from the proxy. If you still see this error, make sure you are running the latest version:
```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

### ❓ Problem 8: Scan Runs but Shows No Results

**Symptom:** The terminal shows the scan starting and finishing, but the results panel is empty or just shows `[INFO]` lines.

**Possible Causes & Fixes:**

1. **Your contract has no vulnerabilities** — Congratulations! This is the best possible outcome.
2. **Your contract is too small** — Very short contracts (under ~50 lines) may not trigger the full adversarial pipeline. Try pasting a more complete contract.
3. **All your API keys failed** — Check your Settings panel. At least one key must show as valid.
4. **Deep Scan is OFF and your vulnerabilities are in a library** — Toggle **Deep Supply Chain Scan** ON and rescan.

---

## 🔧 Maintenance & Resource Allocation

### Everyday Commands

Open your terminal in the `sential-local` folder and use these commands to manage the engine:

| Command | What It Does |
|---------|-------------|
| `docker compose up -d` | Start Sential in the background |
| `docker compose stop` | Pause the engine (keeps data) |
| `docker compose down` | Fully shut down and clean up |
| `docker compose down -v` | Shut down AND delete all volume data |
| `docker compose logs -f backend` | Watch live backend logs (great for debugging) |
| `docker compose logs -f frontend` | Watch live frontend logs |
| `docker compose build --no-cache` | Force a full rebuild from scratch |
| `docker system prune -a --volumes` | Nuclear option — delete ALL Docker data and start fresh |

### Recommended Hardware Settings

For best performance when auditing large GitHub repositories, make sure Docker Desktop has enough resources. Go to Docker Desktop → **Settings → Resources** and set:

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPUs | 2 cores | 4 cores |
| Memory (RAM) | 4 GB | 8 GB |
| Swap Space | 1 GB | 2 GB |
| Disk Image Size | 20 GB | 40 GB |

> 💡 If Docker is using too much RAM on your machine, reduce the Memory slider in Docker Desktop settings and restart the engine.

---

## ❓ Frequently Asked Questions (FAQ)

**Q: Is my code safe? Does Sential send it to anyone?**

A: No. Your smart contract code is processed exclusively inside a Docker container on your own machine. It is loaded into volatile RAM, analyzed, and discarded the moment the scan ends. The only external network connections are the API calls to AI providers (Groq, DeepSeek, etc.), which receive only the code snippets needed for each analysis phase — never your full repository.

---

**Q: Do I need to pay for this?**

A: Sential Local itself is 100% free and open-source (MIT License). However, the AI models it calls (DeepSeek, Groq, Gemini, Claude) have their own pricing. All of them have **free tiers** that are more than sufficient for personal use. For enterprise-scale audits (hundreds of contracts), you may need to add credits to your preferred provider.

---

**Q: What is Foundry and why does it matter?**

A: Foundry is the industry-standard toolkit for Ethereum smart contract development and testing. The "Guillotine Sandbox" in Sential uses Foundry's `forge test` command to run actual Solidity exploit tests against a simulated version of your contract. This is what makes Sential's findings *verifiable* rather than speculative — a confirmed vulnerability has been proven by executable code, not just guessed by an AI.

---

**Q: Can I audit Solidity code that imports other files?**

A: Yes. If you use the **GitHub Repository** ingestion method, the Python AST Chunker (`chunker.py`) automatically maps all imports and dependencies, flattening them into token-optimized chunks for the AI waterfall. For raw paste, make sure to flatten your imports beforehand using a tool like `hardhat-flatten` or `forge flatten`.

---

**Q: The scan is taking a very long time. Is something wrong?**

A: Large contracts or full GitHub repositories can take 5–15 minutes depending on the number of files and which AI models respond quickly. You can watch the live progress in the terminal. If it seems completely frozen for more than 10 minutes with no new output, try restarting with `docker compose down && docker compose up -d` and rescanning.

---

**Q: How do I update Sential to the latest version?**

A: Run these commands in your `sential-local` folder:

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

**Q: Can I use this on a Windows laptop without a lot of power?**

A: Yes, but you should allocate at least 4 GB of RAM to Docker in its settings. Lower-powered machines will work fine for small-to-medium contracts. For full protocol audits (Uniswap, Aave, etc.), a machine with 8+ GB RAM is recommended.

---

**Q: What blockchains does Sential support?**

A: Sential audits **Solidity source code**, which means it supports any EVM-compatible blockchain: Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BNB Chain, and more. The Foundry sandbox simulates a standard EVM environment.

---

## ⚖️ License & Legal Framework

Sential Local Engine is community-maintained software distributed under the terms of the open-source **[MIT License](https://opensource.org/licenses/MIT)**.

```
MIT License

Copyright (c) 2024–2026 Sential Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome. Please open an issue or pull request on the [GitHub repository](https://github.com/grweb3/sential-local).

When reporting a bug, please include:
- Your operating system and version
- The output of `docker --version` and `docker compose version`
- The full error message from `docker compose logs -f backend`
- A description of what you were trying to scan (contract size, ingestion method)

---

<p align="center">
  <strong>Built for the decentralized future. Hack safely. 🔐</strong>
  <br><br>
  <a href="https://github.com/grweb3/sential-local">GitHub</a> ·
  <a href="https://opensource.org/licenses/MIT">MIT License</a> ·
  <a href="https://book.getfoundry.sh/">Foundry Docs</a>
</p>
