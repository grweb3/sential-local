import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import crypto from 'crypto';

/**
 * SENTIAL AI - THE GUILLOTINE (Execution Sandbox)
 * Spins up an ephemeral Foundry environment to deterministically execute Red Team exploits.
 */
export async function runGuillotine(title, pocCode, sendEvent) {
    const runId = crypto.randomBytes(8).toString('hex');
    const tempDir = path.join(os.tmpdir(), `sential_forge_${runId}`);
    
    sendEvent('log', { prefix: 'SYS', message: `[GUILLOTINE] Initializing Ephemeral Sandbox [ID: ${runId}]...` });

    try {
        // 1. Create temporary Forge workspace
        await fs.mkdir(tempDir, { recursive: true });
        await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
        await fs.mkdir(path.join(tempDir, 'test'), { recursive: true });

        // 2. Write the minimal foundry.toml
        const tomlConfig = `
[profile.default]
src = "src"
test = "test"
out = "out"
libs = ["lib"]
`;
        await fs.writeFile(path.join(tempDir, 'foundry.toml'), tomlConfig);

        // 3. Inject the Red Team's Exploit code
        const testFilePath = path.join(tempDir, 'test', 'Exploit.t.sol');
        await fs.writeFile(testFilePath, pocCode);

        sendEvent('log', { prefix: 'AGENT', message: `[GUILLOTINE] Injecting weaponized payload into isolated WSL2 container...` });

        // 4. Execute the Sandbox via Child Process
        const result = await runCommand('forge', ['test'], tempDir);

        // 5. Parse the deterministic outcome
        sendEvent('log', { prefix: 'SYS', message: `[GUILLOTINE] Execution complete. Analyzing deterministic outcome...` });
        
        const output = result.stdout + "\n" + result.stderr;
        const isSuccess = output.includes('Failing tests:') || output.includes('FAIL.');
        
        // If the test FAILS in Foundry, it means the exploit reverted (The contract was safe / AI Hallucinated)
        // If the test PASSES, it means the exploit successfully executed without reverting (Vulnerability is REAL)
        if (!isSuccess && output.includes('PASS')) {
            return { verified: true, log: output };
        } else {
            return { verified: false, log: output };
        }

    } catch (error) {
        // If Foundry crashes or times out, we catch it gracefully
        sendEvent('log', { prefix: 'ERROR', message: `[GUILLOTINE] Sandbox Execution Failed: ${error.message}` });
        
        // Fallback: If the sandbox crashes, we cannot verify the exploit. We fail securely (downgrade).
        return { verified: false, log: error.message };
    } finally {
        // 6. Zero-Retention: Violently purge the ephemeral workspace
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
            sendEvent('log', { prefix: 'SYS', message: `[GUILLOTINE] Sandbox [ID: ${runId}] purged from memory.` });
        } catch (e) {
            console.error(`[FATAL] Failed to cleanup temp directory: ${tempDir}`);
        }
    }
}

/**
 * Helper function to run shell commands as Promises with a strict Timeout
 */
function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        // We are natively on WSL2 now, no need for Windows cmd.exe hacks
        const child = spawn(command, args, { cwd });

        let stdout = '';
        let stderr = '';

        // STRICT 15-SECOND TIMEOUT: Prevent infinite loops in AI-generated code
        const timeoutId = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error("Foundry Execution Timed Out. Infinite loop detected in AI exploit."));
        }, 15000);

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('error', (err) => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to start subprocess: ${err.message}`));
        });

        child.on('close', (code) => {
            clearTimeout(timeoutId);
            resolve({ code, stdout, stderr });
        });
    });
}