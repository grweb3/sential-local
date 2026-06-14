# 🛡️ Sential Local Engine

**The Open-Source, Zero-Retention Web3 Security Auditor.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?logo=docker)](https://www.docker.com/)
[![Foundry](https://img.shields.io/badge/Foundry-Integrated-orange.svg)](https://book.getfoundry.sh/)
[![Version](https://img.shields.io/badge/Version-2.0.4--CE-blue.svg)]()

> Sential Local is a decentralized smart contract auditing engine that combines **Semantic AST Parsing**, a **Multi-Model LLM Waterfall**, and an **Ephemeral Foundry Sandbox** to identify and cryptographically verify Web3 vulnerabilities with zero false positives.

Built for enterprise auditors, developers, and security researchers, Sential executes entirely on your local hardware. Your smart contract code is processed in volatile RAM and is **never stored, tracked, or used for AI training.**

---

## 🧠 The Adversarial Triad Architecture

Sential does not rely on a single monolithic AI. It utilizes a margin-protected waterfall architecture to simulate a real human auditing team:

| Role | Model | Responsibility |
|------|-------|----------------|
| **Semantic Gatekeeper** | Groq Llama 3.3 | Parses Solidity into an AST, strips boilerplate, and isolates high-risk logic vectors |
| **Red Team** | DeepSeek V4 / MiniMax M3 / Gemini 3.1 | Synthesizes attack vectors and writes weaponized Foundry PoC `.t.sol` tests |
| **Blue Team Judge** | Claude Opus / Zhipu GLM-5 | Verifies math, eliminates hallucinations, and standardizes severity output |
| **Guillotine Sandbox** | Local Foundry | Executes exploits in isolation; silently downgrades threats if tests fail |

---

## 💻 Step 1: System Prerequisites

> You do **not** need to manually install Node.js, Python, or Foundry — the entire engine runs inside an isolated Docker container. You only need **Git** and **Docker**.

<details>
<summary>🪟 <strong>Windows Setup</strong></summary>

1. **Install Git** — Download from [gitforwindows.org](https://gitforwindows.org/) and keep all default settings.
2. **Install Docker** — Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
   - Ensure **WSL2** (Windows Subsystem for Linux) is enabled during installation.
3. **Start Docker** — Open Docker Desktop from your Start Menu. Wait until the whale icon in your system tray shows a green **Running** status.

</details>

<details>
<summary>🍎 <strong>macOS Setup</strong></summary>

1. **Install Git** — Open `Terminal` and run `git --version`. If prompted, click **Install** to add Command Line Developer Tools.
2. **Install Docker** — Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) (choose Apple Silicon or Intel).
3. **Start Docker** — Open Docker from your Applications folder. Wait until the menu bar icon shows it is running.

</details>

<details>
<summary>🐧 <strong>Linux Setup (Ubuntu/Debian)</strong></summary>

```bash
sudo apt update
sudo apt install git curl -y
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

> ℹ️ You may need to **log out and back in** for Docker group permissions to take effect.

</details>

---

## ⚡ Step 2: 1-Click Installation

Once Git and Docker are running, clone and boot Sential Local in seconds.

**1. Clone the repository:**

```bash
git clone https://github.com/grweb3/sential-local.git
cd sential-local
```

**2. Run the Engine:**

<table>
<tr>
<th>🪟 Windows</th>
<th>🍎 macOS / 🐧 Linux</th>
</tr>
<tr>
<td>Double-click <code>start.bat</code>, or run:

```cmd
start.bat
```
</td>
<td>

```bash
chmod +x start.sh
./start.sh
```
</td>
</tr>
</table>

> ⏳ **First Boot Warning:** Docker will download the Linux OS, Foundry, and Python binaries on the first run. This takes **3–5 minutes** depending on your internet speed. Future boots take under **5 seconds**.

✅ Your browser will automatically open to `http://localhost:5173` when the engine is ready.

---

## 🔑 Step 3: Configuration (Bring Your Own Keys)

Sential Local uses a **Direct Key Injection Architecture** — no `.env` files, no centralized server, no key leaks.

1. Open the Sential Local UI at `http://localhost:5173`
2. Click **Settings** in the left sidebar
3. Paste your preferred AI API keys (Gemini, DeepSeek, Groq, etc.)
4. Keys are **immediately encrypted** and saved in your browser's local cache — they never leave your machine

> 💡 You only need **one** valid key to run a scan. Adding multiple keys enables the Unbreakable Waterfall to hot-swap models if one hits a rate limit.

---

## 🌐 Supported Ingestion Methods

Navigate to the **Scanner** tab to begin an audit. Three ingestion methods are supported:

| Method | Details |
|--------|---------|
| **Raw Solidity** | Paste `.sol` code directly into the UI editor |
| **Etherscan URL** | Enter a verified contract address to pull from the blockchain *(requires Etherscan API key)* |
| **Public GitHub Repo** | Enter any `owner/repo` string to scan a full repository |

> 🔍 **Deep Supply Chain Scan:** Toggle this ON to force the Python AST chunker to parse nested `node_modules/` and `lib/` folders, protecting against upstream dependency attacks.

---

## 🛑 Troubleshooting & FAQs

<details>
<summary><strong>❌ Error: `'docker-compose' is not recognized` (Windows)</strong></summary>

Docker is not running. Open **Docker Desktop** from your Start Menu, wait for it to fully initialize, then run `start.bat` again.

</details>

<details>
<summary><strong>❌ Scan fails with `API_EXHAUSTION`</strong></summary>

The API provider you are using has hit its rate limit or run out of credits. Go to **Settings** and add a fallback key from a different provider (e.g., add a Groq key if DeepSeek fails).

</details>

<details>
<summary><strong>❌ Port Conflicts — `Address already in use`</strong></summary>

Sential requires ports **3001** and **5173**. If other web servers are running locally, stop them first, then run:

```bash
docker compose down
```

</details>

<details>
<summary><strong>🛑 How do I stop the engine?</strong></summary>

Open your terminal in the `sential-local` folder and run:

```bash
docker compose down
```

</details>

---

## ⚖️ License

Sential Local is distributed under the **[MIT License](https://opensource.org/licenses/MIT)**.

---

<p align="center">Built for the decentralized future. Hack safely. 🔐</p>
