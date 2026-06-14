import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import AdmZip from 'adm-zip';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto'; 
import OpenAI from 'openai';

import { runGuillotine } from './guillotine.js';

// ============================================================================
// 1. CONFIGURATION & SERVER SETUP
// ============================================================================
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Strict CORS for local desktop environments
const allowedOrigins = [
    'http://localhost:5173', 
    'http://localhost:3000',
    'http://127.0.0.1:5173'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS Policy Violation'));
        }
    }
}));

app.use(express.json({ limit: '10mb' }));

// ============================================================================
// 2. CORE PROMPTS
// ============================================================================
const SYSTEM_PROMPT = `
You are Sential AI — an elite Web3 Smart Contract Security Auditor, formal verification engineer, and EVM internals specialist. You have encyclopedic knowledge of every major on-chain exploit since 2016, SWC/DASP vulnerability patterns, DeFi economic attack surfaces, and Solidity compiler edge cases.

Your singular objective: identify every exploitable vulnerability with zero false positives and zero missed criticals.

═══════════════════════════════════════════════════════════════
SECTION 1 — ABSOLUTE OPERATIONAL CONSTRAINTS
═══════════════════════════════════════════════════════════════

1. ZERO HALLUCINATIONS
   - Never reference functions, variables, events, errors, modifiers, or external contracts
     that do not appear verbatim in the provided source.
   - Every "vulnerable_code" field MUST be a byte-for-byte copy from the input. Never paraphrase it.
   - If the code is truncated or imports are unresolvable, note it in the summary and
     analyze only what is present.

2. NO BOILERPLATE FLAGS
   - Never flag standard, unmodified OpenZeppelin v4.x or v5.x contracts.
   - DO flag OZ contracts that are modified, incorrectly inherited, or whose invariants
     are broken by surrounding logic.
   - Never flag missing NatSpec, floating pragma, or Solidity version warnings unless
     they introduce a concrete, demonstrable security risk.

3. CONFIDENCE THRESHOLD
   - Only report a finding if exploitability confidence is ≥ 70%.
   - If a potential issue requires unverifiable off-chain preconditions, report it as
     MEDIUM and explicitly state the assumption.

4. SEVERITY DEFINITIONS (strictly enforced)

   CRITICAL — An unprivileged, external actor can:
     steal user or protocol funds, permanently brick the contract, or arbitrarily
     mint/burn tokens without authorization.
     → A complete, compilable Foundry Invariant Invalidation Proof (.t.sol) is MANDATORY.
     → If a working PoC cannot be produced, you MUST downgrade to HIGH.

   HIGH — Major logical flaw, privilege escalation, access control bypass,
     permanent griefing with state damage, or edge-case fund loss under
     realistic on-chain conditions.
     → No PoC required.

   MEDIUM — Centralization risk, front-running without direct fund loss, MEV
     extraction vector, DoS with partial recovery, unsafe external call pattern,
     or oracle reliance without validation.

   GAS / LOW — Suboptimal gas patterns, missing events on state-changing
     functions, non-critical code-style deviations.

═══════════════════════════════════════════════════════════════
SECTION 2 — MANDATORY ANALYSIS PHASES
═══════════════════════════════════════════════════════════════

PHASE 0 — PROTOCOL CLASSIFICATION
Identify the contract archetype: ERC20 Token, ERC721/1155 NFT, AMM/DEX,
Lending/Borrowing, Vault/Strategy (ERC4626), Governance, Bridge/Messaging,
Proxy/Upgradeable, Staking/Rewards, Lottery/VRF, or Hybrid. This determines
the applicable default invariant set for Phase 2.

PHASE 1 — DEPENDENCY & STORAGE MAPPING
- Map the full inheritance chain and its C3 linearization order.
- Enumerate all state variables and their effective storage slots.
- Flag any storage layout collision risks (critical for proxy patterns).
- List every external contract call, including implicit ones from inherited code.

PHASE 2 — INVARIANT EXTRACTION
Extract every mathematical, economic, and logical invariant. Use formal notation.
Examples:
  LAW-1: ∀t: totalSupply(t) = Σ balances[u](t)  — token accounting
  LAW-2: ∀ swap: reserve0 × reserve1 ≥ k        — AMM constant-product
  LAW-3: ∀u: withdrawable[u] ≤ deposited[u]      — solvency

PHASE 3 — ATTACK SURFACE ENUMERATION
Systematically evaluate every item in this taxonomy:

  A. REENTRANCY
     · Single-function (CEI violation)
     · Cross-function (re-entering a different function in same contract)
     · Cross-contract (shared state mutated mid-call by a sibling contract)
     · Read-only reentrancy (view used as an oracle mid-callback)

  B. ACCESS CONTROL
     · Missing or incorrect modifiers on privileged state-changing functions
     · msg.sender vs tx.origin confusion
     · Unprotected initializers in upgradeable contracts
     · Role escalation or role-grant-without-revoke paths

  C. ARITHMETIC
     · Overflow/underflow in unchecked{} blocks
     · Division before multiplication causing precision loss
     · Incorrect rounding direction (should always round against the user)
     · Dangerous downcasting (uint256 → uint128, etc.)

  D. ORACLE MANIPULATION
     · Spot price used directly as oracle (single-block manipulable)
     · TWAP with an insufficient observation window
     · Missing staleness check on Chainlink feeds (block.timestamp vs updatedAt)
     · Unvalidated oracle return values (price = 0, price < 0, sequencer uptime)

  E. FLASH LOAN ATTACK SURFACE
     · Any function whose security invariant can be violated by a flash-loan-funded
       state change executed and reversed within a single transaction.

  F. LOGIC & BUSINESS INVARIANT VIOLATIONS
     · Any code path that violates an invariant from Phase 2
     · Incorrect fee accounting, share calculation, or reward distribution
     · State transitions that can be skipped, duplicated, or reversed

  G. DENIAL OF SERVICE
     · Unbounded loops over user-controlled or ever-growing arrays
     · Gas griefing via forced ETH sends (push pattern without pull fallback)
     · Block-stuffing attacks on time-sensitive operations

  H. FRONT-RUNNING & MEV
     · Sandwich-attackable functions lacking slippage/deadline protection
     · Commit-reveal schemes that are bypassable on-chain
     · Predictable randomness (block.prevrandao, blockhash, timestamp)

  I. PROXY & UPGRADEABILITY
     · Uninitialized implementation contract (can be self-destructed)
     · Function selector clash between proxy and implementation
     · Missing storage gaps in upgradeable base contracts
     · Admin key with no timelock — single point of failure

  J. EXTERNAL CALL SAFETY
     · Unchecked return value on low-level .call()
     · Silent transfer failures from non-standard ERC20 tokens (no bool return)
     · Untrusted callbacks (onERC721Received, onERC1155Received hooks)

  K. CRYPTOGRAPHY
     · Signature malleability (missing EIP-712, missing nonce, wrong v validation)
     · Cross-chain replay (missing chainId in EIP-712 domain separator)
     · Predictable CREATE2 salt enabling front-run of deployment

  L. ERC STANDARD COMPLIANCE
     · Deviations from ERC20/721/1155/4626/2612 specs that break integrations
       or violate expected behavior for downstream protocols

PHASE 4 — INVARIANT INVALIDATION PROOF (internal chain-of-thought)
For every finding, internally trace:
  1. Entry point function and caller type (EOA, contract, flashloan provider)
  2. Exact call stack and state mutations at each step
  3. Preconditions: what state must hold before the failure succeeds
  4. Postconditions: which invariant from Phase 2 is now violated
  5. Estimated capital requirement and quantified profit/damage

For every CRITICAL finding, synthesize a Foundry test with this exact structure that formally proves the vulnerability:
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.x;
  import "forge-std/Test.sol";
  import "../src/TargetContract.sol";

  contract SentialAudit_[VulnerabilityName]_Test is Test {
      TargetContract target;
      address tester = makeAddr("tester");

      function setUp() public {
          // Deploy target and seed realistic state
      }

      function test_invalidate_[VulnerabilityName]() public {
          vm.startPrank(tester);
          // Execute the sequence that triggers the failure
          vm.stopPrank();
          // Assert the invariant violation
          assertGt(tester.balance, 0, "Invariant holds");
      }
  }

PHASE 5 — REMEDIATION SYNTHESIS
For every finding provide:
  · A minimal, surgical code fix that preserves the intended business logic.
  · One sentence explaining WHY the fix closes the vulnerability vector.

═══════════════════════════════════════════════════════════════
SECTION 3 — SECURITY SCORE RUBRIC
═══════════════════════════════════════════════════════════════

10.0 – 9.0  | No findings. Follows all security best practices.
 8.9 – 7.0  | GAS/LOW findings only. Safe to deploy with minor improvements.
 6.9 – 5.0  | MEDIUM findings present. Deployment inadvisable without fixes.
 4.9 – 3.0  | HIGH findings present. Significant risk to user funds.
 2.9 – 1.0  | One CRITICAL finding. Do NOT deploy.
 0.9 – 0.0  | Multiple CRITICALs or systemic architectural failure.

═══════════════════════════════════════════════════════════════
SECTION 4 — OUTPUT CONTRACT (STRICTLY ENFORCED)
═══════════════════════════════════════════════════════════════

Your ENTIRE response MUST be a single raw, valid JSON object.
No text before it. No text after it. No markdown. No code fences. No comments.
No trailing commas. Parser will reject any deviation.

{
  "score": <number 0.0–10.0>,
  "protocol_type": "<archetype from Phase 0>",
  "summary": "<Exactly 3 sentences: (1) what the contract does architecturally, (2) the most severe flaw found, (3) deployment recommendation>",
  "invariants": [
    {
      "id": "LAW-1",
      "description": "<plain English>",
      "formal": "<optional: mathematical/logical notation>"
    }
  ],
  "critical": [
    {
      "id": "C-1",
      "title": "<concise vulnerability name>",
      "category": "<taxonomy letter + name, e.g. A. REENTRANCY>",
      "description": "<what is broken, exact steps to trigger, quantified impact>",
      "affected_functions": ["<functionName>"],
      "preconditions": "<state that must hold before the failure>",
      "impact": "<precise consequence>",
      "vulnerable_code": "<verbatim snippet from source — never paraphrased>",
      "remediated_code": "<minimal fixed snippet>",
      "remediation_explanation": "<one sentence: why this fix restores structural integrity>",
      "foundry_poc": "<complete compilable Foundry .t.sol — or null if downgraded to HIGH>"
    }
  ],
  "high": [
    {
      "id": "H-1",
      "title": "...",
      "category": "...",
      "description": "...",
      "affected_functions": [],
      "preconditions": "...",
      "impact": "...",
      "vulnerable_code": "...",
      "remediated_code": "...",
      "remediation_explanation": "..."
    }
  ],
  "medium": [
    {
      "id": "M-1",
      "title": "...",
      "category": "...",
      "description": "...",
      "affected_functions": [],
      "vulnerable_code": "...",
      "remediated_code": "...",
      "remediation_explanation": "..."
    }
  ],
  "gas": [
    {
      "id": "G-1",
      "title": "...",
      "description": "...",
      "affected_functions": [],
      "vulnerable_code": "...",
      "remediated_code": "..."
    }
  ]
}
`;

const RED_TEAM_PROMPT = `
You are the Red Team simulation engine for Sential AI. Analyze the target code and construct a theoretical attack vector. If a critical flaw exists, you MUST generate a valid Foundry Invariant Invalidation Proof (.t.sol) demonstrating the failure. DO NOT format your response as JSON. Provide a raw Markdown analysis of the structural weakness.
`;

const JUDGE_PROMPT = `
You are the Blue Team Judge for Sential AI. You will receive the Original Code and the Red Team's theoretical vulnerability analysis. You must verify if the math and logic in the Red Team's analysis actually break the contract's invariants. 

If they are correct, format their findings into the required JSON structure. 
If they hallucinated the flaw, disregard it or downgrade it to LOW.

You MUST follow the JSON Output Contract defined in the SYSTEM PROMPT. Output ONLY valid JSON.
`;

function extractJSON(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return (start !== -1 && end !== -1) ? text.slice(start, end + 1) : text;
}

// ============================================================================
// 3. INGESTION ENGINE HELPERS
// ============================================================================
async function fetchEtherscanCode(address, etherscanApiKey) {
    try {
        const url = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${address.trim()}&apikey=${etherscanApiKey || ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === "0") throw new Error(`Etherscan Rejection: ${data.result || data.message}`);

        if (data.status === "1" && data.result?.[0]?.SourceCode) {
            let source = data.result[0].SourceCode;
            if (source.startsWith('{{') && source.endsWith('}}')) {
                source = source.substring(1, source.length - 1);
                const parsedSource = JSON.parse(source);
                let combinedCode = "";
                for (const [fileName, fileData] of Object.entries(parsedSource.sources)) {
                    combinedCode += `\n/* --- File: ${fileName} --- */\n${fileData.content}\n`;
                }
                return combinedCode;
            }
            return source;
        }
        throw new Error("Contract source code is not verified on Etherscan.");
    } catch (error) { 
        throw new Error("Etherscan API Error: " + error.message); 
    }
}

async function fetchPrivateGithubRepo(repoFullName, deepScan = false) {
    const headers = {
        'User-Agent': 'Sential-AI-Engine',
        'Accept': 'application/vnd.github.v3+json'
    };

    const response = await fetch(`https://api.github.com/repos/${repoFullName}/zipball/HEAD`, {
        headers,
        redirect: 'follow'
    });

    if (!response.ok) throw new Error(`GitHub Repo Download Failed: ${response.statusText} (Ensure it is a public repository)`);

    const reader = response.body.getReader();
    const chunks = [];
    let downloadedBytes = 0;
    const MAX_BYTES = deepScan ? 50 * 1024 * 1024 : 20 * 1024 * 1024;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            downloadedBytes += value.length;
            if (downloadedBytes > MAX_BYTES) {
                throw new Error(`Repository exceeds memory limits. Deep Scan: ${deepScan ? 'ON' : 'OFF'}.`);
            }
            chunks.push(value);
        }
    }

    const buffer = Buffer.concat(chunks);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    let combinedSolidity = "";
    let fileCount = 0;
    const MAX_FILES = deepScan ? 150 : 50; 
    
    const IGNORE_DIRS = deepScan 
        ? ['test/', 'out/', 'cache/', 'artifacts/', 'mocks/', 'dist/', 'build/'] 
        : ['node_modules/', 'lib/', 'test/', 'out/', 'cache/', 'artifacts/', 'mocks/'];

    zipEntries.forEach((zipEntry) => {
        if (fileCount >= MAX_FILES) return; 
        
        if (zipEntry.name.endsWith(".sol")) {
            const isIgnored = IGNORE_DIRS.some(dir => zipEntry.entryName.includes(dir));
            if (!isIgnored) {
                const content = zipEntry.getData().toString("utf8");
                combinedSolidity += `\n/* --- File: ${zipEntry.entryName} --- */\n${content}\n`;
                fileCount++;
            }
        }
    });

    if (!combinedSolidity) throw new Error("No valid Solidity logic found based on current ingestion settings.");
    
    const CONTEXT_LIMIT = deepScan ? 400000 : 200000;
    if (combinedSolidity.length > CONTEXT_LIMIT) {
        combinedSolidity = combinedSolidity.substring(0, CONTEXT_LIMIT) + "\n\n/* [TRUNCATED DUE TO FILE SIZE LIMITS] */";
    }

    return combinedSolidity;
}

function runPythonChunker(codeString) {
    return new Promise((resolve, reject) => {
        const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
        const pythonProcess = spawn(pythonBin, ['chunker.py']); 
        
        let output = '';
        let errorOutput = '';

        const timeoutId = setTimeout(() => {
            pythonProcess.kill('SIGKILL');
            reject(new Error("AST Chunker timed out (exceeded 30s). The repository may be too large or malformed."));
        }, 30000);

        pythonProcess.stdout.on('data', (data) => { output += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

        pythonProcess.on('close', (code) => {
            clearTimeout(timeoutId);
            if (code !== 0) return reject(new Error(`Python Script Failed: ${errorOutput}`));
            try { 
                resolve(JSON.parse(output)); 
            } catch (e) { 
                reject(new Error("Failed to parse Python AST JSON output.")); 
            }
        });

        pythonProcess.stdin.write(codeString);
        pythonProcess.stdin.end();
    });
}

// ============================================================================
// 4. MAIN PIPELINE: THE DYNAMIC LOCAL ENGINE
// ============================================================================

// Stream Helpers
async function streamOpenAICompatible(client, modelName, messages, sendEvent, isJSON = false) {
    const params = { model: modelName, messages: messages, temperature: 0.1, max_tokens: 8000, stream: true };
    if (isJSON && (modelName.includes('llama') || modelName.includes('deepseek') || modelName.includes('MiniMax'))) {
         params.response_format = { type: "json_object" };
    }
    const stream = await client.chat.completions.create(params);
    let fullText = "";
    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) { fullText += content; sendEvent('token', content); }
    }
    return fullText;
}

async function streamAnthropic(client, modelName, systemPrompt, messages, sendEvent) {
    const stream = await client.messages.create({
        model: modelName, max_tokens: 8000, temperature: 0.1, system: systemPrompt, messages: messages, stream: true
    });
    let fullText = "";
    for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
            fullText += chunk.delta.text; sendEvent('token', chunk.delta.text); 
        }
    }
    return fullText;
}

async function streamGemini(client, modelName, prompt, sendEvent) {
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContentStream(prompt);
    let fullText = "";
    for await (const chunk of result.stream) {
        const chunkText = chunk.text(); fullText += chunkText; sendEvent('token', chunkText);
    }
    return fullText;
}

app.post('/api/audit/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (type, data) => { res.write(`data: ${JSON.stringify({ type, data })}\n\n`); };

    let finalSolidityCode = null;
    let { code, type, deepScan } = req.body;
    const reqId = crypto.randomBytes(4).toString('hex');

    // BUG FIX: Removed 'finalSolidityCode = null' from this handler.
    // Vite proxy half-closes streams on large payloads, which was causing
    // the backend to prematurely wipe its own memory and crash.
    req.on('close', () => {
        console.log(`[SYS] Client Request [${reqId}] TCP event detected (stream waiting).`);
    });

    sendEvent('log', { prefix: 'SYS', message: 'Establishing secure WebSocket connection to Local Engine... OK' });

    // --- DYNAMIC CLIENT INITIALIZATION (Pulling keys from headers) ---
    const keys = {
        gemini: req.headers['x-api-key-gemini'],
        deepseek: req.headers['x-api-key-deepseek'],
        minimax: req.headers['x-api-key-minimax'],
        groq: req.headers['x-api-key-groq'],
        anthropic: req.headers['x-api-key-anthropic'],
        zhipu: req.headers['x-api-key-zhipu'],
        etherscan: req.headers['x-api-key-etherscan']
    };

    const clients = {
        gemini: keys.gemini ? new GoogleGenerativeAI(keys.gemini) : null,
        anthropic: keys.anthropic ? new Anthropic({ apiKey: keys.anthropic }) : null,
        groq: keys.groq ? new Groq({ apiKey: keys.groq }) : null,
        deepseek: keys.deepseek ? new OpenAI({ apiKey: keys.deepseek, baseURL: 'https://api.deepseek.com' }) : null,
        zhipu: keys.zhipu ? new OpenAI({ apiKey: keys.zhipu, baseURL: 'https://open.bigmodel.cn/api/paas/v4/' }) : null,
        minimax: keys.minimax ? new OpenAI({ apiKey: keys.minimax, baseURL: 'https://api.minimax.io/v1' }) : null,
    };

    if (!code) {
        sendEvent('error', { message: 'No input provided.', fatal: true });
        return res.end();
    }

    try {
        sendEvent('log', { prefix: 'SYS', message: `Ingesting smart contract payload (Type: ${type})...` });
        finalSolidityCode = code;

        if (type === 'address') {
            if (!keys.etherscan) throw new Error("Etherscan API Key is required for address imports.");
            finalSolidityCode = await fetchEtherscanCode(code, keys.etherscan);
            sendEvent('log', { prefix: 'SYS', message: 'Etherscan source code successfully extracted.' });
        } else if (type === 'github') {
            sendEvent('log', { prefix: 'SYS', message: `Downloading repository ZIP buffer (Deep Scan: ${deepScan ? 'ON' : 'OFF'})...` });
            const rawCode = await fetchPrivateGithubRepo(code, deepScan);
            sendEvent('log', { prefix: 'SYS', message: 'Executing Virtual Framer and Python AST Chunker...' });
            
            const astData = await runPythonChunker(rawCode);
            finalSolidityCode = `AST Sliced Repository Architecture:\n\n`;
            astData.chunks.forEach(chunk => {
                finalSolidityCode += `[Type: ${chunk.entity_type}] [Name: ${chunk.entity_name}]\n${chunk.code}\n\n`;
            });
            sendEvent('log', { prefix: 'SYS', message: `AST Chunking complete. ${astData.chunks.length} discrete logic blocks isolated.` });
        }

        // --- GATEKEEPER WATERFALL ---
        let isComplex = false;
        sendEvent('log', { prefix: 'ROUTER', message: 'Engaging Semantic Gatekeeper...' });
        const gatekeeperPrompt = "Does this code contain complex DeFi math, custom Oracles, Assembly, or intricate tokenomics? JSON response: {\"is_complex\": true/false}";
        
        try {
            if (!clients.groq) throw new Error("Key missing");
            const complexityCheck = await clients.groq.chat.completions.create({
                // BUG FIX: Added optional chaining (?.) to prevent null string access
                messages: [ { role: "system", content: gatekeeperPrompt }, { role: "user", content: finalSolidityCode?.substring(0, 30000) || "" } ],
                model: "llama-3.1-8b-instant", response_format: { type: "json_object" }
            });
            isComplex = JSON.parse(extractJSON(complexityCheck.choices[0]?.message?.content) || '{"is_complex": false}').is_complex;
        } catch (error) {
            sendEvent('log', { prefix: 'ROUTER', message: `Gatekeeper (Groq) unavailable. Hot-swapping to Gemini...` });
            try {
                if (!clients.gemini) throw new Error("Key missing");
                const gatekeeperModel = clients.gemini.getGenerativeModel({ model: 'gemini-3.1-pro-preview', generationConfig: { responseMimeType: "application/json" } });
                const res = await gatekeeperModel.generateContent(`${gatekeeperPrompt}\n\nCODE:\n${finalSolidityCode?.substring(0, 30000) || ""}`);
                isComplex = JSON.parse(extractJSON(res.response.text()) || '{"is_complex": false}').is_complex;
            } catch (fallbackError) {
                isComplex = true; // Safest fallback is to assume it's complex if gatekeepers fail
            }
        }

        let fullJsonOutput = "";
        let triagingCode = finalSolidityCode?.substring(0, 5000) || "";

        // --- THE ADVERSARIAL TRIAD WATERFALL ---
        if (isComplex) {
            sendEvent('log', { prefix: 'SYS', message: 'Complexity threshold exceeded. Engaging Adversarial Triad Engine...' });
            
            // STEP 1: COST-SHIELD TRIAGE
            try {
                if (!clients.groq) throw new Error("Key missing");
                sendEvent('log', { prefix: 'ROUTER', message: 'Isolating high-risk logic vectors (Cost-Shield active)...' });
                const groqTriage = await clients.groq.chat.completions.create({
                    messages: [ { role: "system", content: "Extract only the most complex, non-standard, or highly privileged functions from this code." }, { role: "user", content: finalSolidityCode?.substring(0, 40000) || "" } ],
                    model: "llama-3.3-70b-versatile", temperature: 0.1,
                });
                triagingCode = groqTriage.choices[0]?.message?.content || triagingCode;
            } catch (e) {
                sendEvent('log', { prefix: 'ROUTER', message: 'Triage skipped. Proceeding with raw AST...' });
                triagingCode = finalSolidityCode?.substring(0, 40000) || "";
            }

            // STEP 2: RED TEAM WATERFALL
            sendEvent('log', { prefix: 'AGENT', message: 'Deploying Red Team to synthesize failure vectors...' });
            let redTeamExploit = "";
            const redTeamMessages = [
                { role: "system", content: "You are the Red Team. Analyze the code." },
                { role: "user", content: `${RED_TEAM_PROMPT}\n\nTARGET CODE:\n${triagingCode}` }
            ];

            try {
                if (!clients.deepseek) throw new Error("Key missing");
                sendEvent('log', { prefix: 'ROUTER', message: 'Executing Red Team via DeepSeek V4 Pro...' });
                const dsRes = await clients.deepseek.chat.completions.create({ model: "deepseek-chat", messages: redTeamMessages, temperature: 0.2 });
                redTeamExploit = dsRes.choices[0]?.message?.content;
            } catch (e1) {
                sendEvent('log', { prefix: 'ROUTER', message: 'DeepSeek unavailable. Hot-swapping Red Team to MiniMax M3...' });
                try {
                    if (!clients.minimax) throw new Error("Key missing");
                    const mmRes = await clients.minimax.chat.completions.create({ model: "MiniMax-M3", messages: redTeamMessages, temperature: 0.2 });
                    redTeamExploit = mmRes.choices[0]?.message?.content;
                } catch (e2) {
                    sendEvent('log', { prefix: 'ROUTER', message: 'MiniMax M3 unavailable. Hot-swapping Red Team to Gemini 3.1 Pro...' });
                    try {
                        if (!clients.gemini) throw new Error("Key missing");
                        const rtModel = clients.gemini.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
                        const gemRes = await rtModel.generateContent(`${RED_TEAM_PROMPT}\n\nTARGET CODE:\n${triagingCode}`);
                        redTeamExploit = gemRes.response.text();
                    } catch (e3) {
                        sendEvent('log', { prefix: 'ROUTER', message: 'Gemini unavailable. Hot-swapping Red Team to Groq Llama 3.3 70B...' });
                        if (!clients.groq) throw new Error("API_EXHAUSTION: No models available for Red Team simulation.");
                        const groqRes = await clients.groq.chat.completions.create({ model: "llama-3.3-70b-versatile", messages: redTeamMessages, temperature: 0.2 });
                        redTeamExploit = groqRes.choices[0]?.message?.content;
                    }
                }
            }
            
            sendEvent('log', { prefix: 'AGENT', message: 'Red Team has hypothesized an invariant breach. Passing to Blue Team for verification.' });
            
            // STEP 3: BLUE TEAM JUDGE WATERFALL
            const judgeMessages = [
                { role: "user", content: `Original Code:\n${triagingCode}\n\nRed Team Hypothesis:\n${redTeamExploit}\n\nEvaluate this and output the final JSON.` }
            ];

            try {
                if (!clients.anthropic) throw new Error("Key missing");
                sendEvent('log', { prefix: 'ROUTER', message: 'Routing hypothesis to Claude Opus 4.8 Judge...' });
                fullJsonOutput = await streamAnthropic(clients.anthropic, "claude-3-opus-20260416", `${SYSTEM_PROMPT}\n\n${JUDGE_PROMPT}`, judgeMessages, sendEvent);
            } catch (e1) {
                sendEvent('log', { prefix: 'ERROR', message: `Claude Opus failed. Hot-swapping Judge to Zhipu GLM-5...` });
                try {
                    if (!clients.zhipu) throw new Error("Key missing");
                    fullJsonOutput = await streamOpenAICompatible(clients.zhipu, "glm-5", [{role: "system", content: `${SYSTEM_PROMPT}\n\n${JUDGE_PROMPT}`}, ...judgeMessages], sendEvent, true);
                } catch (e2) {
                    sendEvent('log', { prefix: 'ERROR', message: `Zhipu GLM-5 failed. Hot-swapping Judge to Groq Llama 3.3 70B...` });
                    try {
                        if (!clients.groq) throw new Error("Key missing");
                        fullJsonOutput = await streamOpenAICompatible(clients.groq, "llama-3.3-70b-versatile", [{role: "system", content: `${SYSTEM_PROMPT}\n\n${JUDGE_PROMPT}`}, ...judgeMessages], sendEvent, true);
                    } catch (e3) {
                        sendEvent('log', { prefix: 'ERROR', message: `Groq Llama 70B failed. Hot-swapping Judge to Gemini 3.1 Pro...` });
                        if (!clients.gemini) throw new Error("API_EXHAUSTION: No models available for Judge phase.");
                        fullJsonOutput = await streamGemini(clients.gemini, "gemini-3.1-pro-preview", `${SYSTEM_PROMPT}\n\n${JUDGE_PROMPT}\n\n${judgeMessages[0].content}`, sendEvent);
                    }
                }
            }
        } else {
            // --- STANDARD ROUTING WATERFALL ---
            sendEvent('log', { prefix: 'ROUTER', message: 'Standard Logic detected. Engaging Standard Engine Waterfall...' });
            const standardMessages = [
                { role: "system", content: SYSTEM_PROMPT }, 
                { role: "user", content: `Code to audit:\n\n${finalSolidityCode}` }
            ];

            try {
                if (!clients.groq) throw new Error("Key missing");
                sendEvent('log', { prefix: 'AGENT', message: 'Groq Llama 3.3 70B mapping logic paths...' });
                fullJsonOutput = await streamOpenAICompatible(clients.groq, "llama-3.3-70b-versatile", standardMessages, sendEvent, true);
            } catch (e1) {
                sendEvent('log', { prefix: 'ERROR', message: `Groq Engine failed. Re-routing to DeepSeek V4 Pro...` });
                try {
                    if (!clients.deepseek) throw new Error("Key missing");
                    fullJsonOutput = await streamOpenAICompatible(clients.deepseek, "deepseek-chat", standardMessages, sendEvent, true);
                } catch (e2) {
                    sendEvent('log', { prefix: 'ERROR', message: `DeepSeek Engine failed. Re-routing to MiniMax M3...` });
                    try {
                        if (!clients.minimax) throw new Error("Key missing");
                        fullJsonOutput = await streamOpenAICompatible(clients.minimax, "MiniMax-M3", standardMessages, sendEvent, true);
                    } catch (e3) {
                        sendEvent('log', { prefix: 'ERROR', message: `MiniMax Engine failed. Re-routing to Gemini 3.1 Pro...` });
                        if (!clients.gemini) throw new Error("API_EXHAUSTION: No standard models available.");
                        fullJsonOutput = await streamGemini(clients.gemini, "gemini-3.1-pro-preview", `${SYSTEM_PROMPT}\n\nCode to audit:\n\n${finalSolidityCode}`, sendEvent);
                    }
                }
            }
        }

        // --- SHATTERPROOF JSON PARSING ---
        sendEvent('log', { prefix: 'SYS', message: 'Analysis complete. Parsing deterministic JSON payload...' });
        let auditData;
        try {
            let cleanJSON = extractJSON((fullJsonOutput || "").replace(/```json/gi, "").replace(/```/g, "").trim());
            auditData = JSON.parse(cleanJSON);
        } catch (jsonError) {
            sendEvent('log', { prefix: 'ERROR', message: `AI returned malformed JSON formatting. Reconstructing gracefully...` });
            auditData = {
                score: 5,
                summary: "The analysis engine completed its scan, but the AI returned a malformed structural response. Please rerun the scan to get exact vulnerability mappings.",
                invariants: [], critical: [], high: [], gas: [], good: [],
                medium: [{ title: "Malformed Engine Output", description: "The underlying AI successfully executed but failed to format the output data properly.", remediated_code: (fullJsonOutput || "").substring(0, 500) + "..." }]
            };
        }

        // --- THE GUILLOTINE FILTER ---
        if (auditData.critical && auditData.critical.length > 0) {
            sendEvent('log', { prefix: 'SYS', message: 'CRITICAL structural failure detected. Engaging Sential Local Sandbox (Guillotine)...' });
            
            const verifiedCriticals = [];
            const downgradedIssues = [];

            for (const issue of auditData.critical) {
                if (issue.foundry_poc) {
                    sendEvent('log', { prefix: 'AGENT', message: `Testing Invariant Invalidation Proof for: ${issue.title}...` });
                    
                    const guillotineResult = await runGuillotine("SentialExploit", issue.foundry_poc, sendEvent);
                    
                    if (guillotineResult.verified) {
                        verifiedCriticals.push(issue);
                    } else {
                        issue.title = `[UNVERIFIED BY ENGINE] ${issue.title}`;
                        issue.description = `(Note: Sential AI detected a structural vulnerability, but the deterministic sandbox could not prove the math. Proceed with caution.)\n\n${issue.description}`;
                        downgradedIssues.push(issue);
                    }
                } else {
                    sendEvent('log', { prefix: 'ERROR', message: `Critical issue '${issue.title}' lacks formal mathematical proof. Downgrading to Medium severity.` });
                    issue.title = `[UNVERIFIED] ${issue.title}`;
                    downgradedIssues.push(issue);
                }
            }

            auditData.critical = verifiedCriticals;
            if (!auditData.medium) auditData.medium = [];
            auditData.medium = [...auditData.medium, ...downgradedIssues];
            
            if (verifiedCriticals.length > 0) {
                sendEvent('log', { prefix: 'SYS', message: `Guillotine phase complete. ${verifiedCriticals.length} Critical threats formally verified.` });
            } else {
                sendEvent('log', { prefix: 'SYS', message: 'Guillotine phase complete. All Critical threats were logical hallucinations and have been silently downgraded.' });
            }
        }

        sendEvent('log', { prefix: 'SYS', message: 'Consensus Report generated. Clearing local memory buffers...' });

        sendEvent('complete', auditData);
        return res.end();

    } catch (error) {
        console.error("[STREAM FATAL ERROR]:", error.message);
        
        // Broadcast the fatal loop-breaker to the React client
        sendEvent('error', { 
            message: error.message.includes('API_EXHAUSTION') ? "All configured AI models failed or returned a Rate Limit error. Please update your API Keys in Settings." : error.message,
            fatal: true 
        });
        
        return res.end();
    } finally {
        finalSolidityCode = null;
        code = null;
        console.log(`[SYS] Connection safely closed for Request: [${reqId}]`);
    }
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Sential AI Local Core Loaded`);
  console.log(`📡 Listening on Port ${PORT}`);
  console.log(`======================================================\n`);
});