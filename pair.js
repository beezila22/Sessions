import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';
import crypto from 'crypto';

const router = express.Router();

// Function to generate random session string
function generateSessionString() {
    const prefix = 'sila~';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
    
    for (let i = 0; i < 40; i++) {
        randomString += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return prefix + randomString;
}

// Function to convert session data to encrypted string
function sessionToEncryptedString(sessionData) {
    try {
        const sessionJSON = JSON.stringify(sessionData);
        // Using simple Base64 encoding (unaweza kubadilisha kwa encryption stronger)
        const encrypted = Buffer.from(sessionJSON).toString('base64');
        return encrypted;
    } catch (error) {
        console.error('Error encrypting session:', error);
        return null;
    }
}

// Function to save session as string instead of file
function saveSessionAsString(sessionDir) {
    try {
        const credsPath = sessionDir + '/creds.json';
        if (!fs.existsSync(credsPath)) return null;
        
        const credsData = fs.readFileSync(credsPath, 'utf8');
        const sessionData = JSON.parse(credsData);
        
        // Convert session to encrypted string
        const sessionString = sessionToEncryptedString(sessionData);
        return sessionString;
    } catch (error) {
        console.error('Error converting session to string:', error);
        return null;
    }
}

// Ensure the session directory exists
function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    let dirs = './' + (num || `session`);

    // Remove existing session if present
    await removeFile(dirs);

    // Clean the phone number - remove any non-digit characters
    num = num.replace(/[^0-9]/g, '');

    // Validate the phone number using awesome-phonenumber
    const phone = pn('+' + num);
    if (!phone.isValid()) {
        if (!res.headersSent) {
            return res.status(400).send({ code: 'Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, 84987654321 for Vietnam, etc.) without + or spaces.' });
        }
        return;
    }
    // Use the international number format (E.164, without '+')
    num = phone.getNumber('e164').replace('+', '');

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version, isLatest } = await fetchLatestBaileysVersion();
            let SilaBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.windows('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            });

            SilaBot.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, isNewLogin, isOnline } = update;

                if (connection === 'open') {
                    console.log("✅ Connected successfully!");
                    console.log("📱 Generating session string...");
                    
                    try {
                        // Generate session string instead of sending file
                        const sessionString = saveSessionAsString(dirs);
                        
                        if (sessionString) {
                            // Generate final session ID with sila~ prefix
                            const finalSessionId = generateSessionString();
                            
                            // Store the mapping (in production, use database)
                            // Hii ni mfano tu, katika production tumia database
                            console.log(`Session Mapping: ${finalSessionId} -> ${sessionString.substring(0, 20)}...`);
                            
                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            
                            // Send session ID to user
                            await SilaBot.sendMessage(userJid, {
                                text: `✅ *SESSION CREATED SUCCESSFULLY!*\n\n📱 *Your Session ID:*\n\`\`\`${finalSessionId}\`\`\`\n\n💾 *Save this ID carefully!*\n\n⚠️ *Important Instructions:*\n• Do not share this ID with anyone\n• Use this ID to restore your session\n• Keep it safe and secure\n\n┌┤✑ Thanks for using Sila Tech 
│└────────────┈ ⳹        
│©2024 Mr Sila Hacker 
└─────────────────┈ ⳹`
                            });
                            console.log("📄 Session ID sent successfully");

                            // Send video thumbnail with caption
                            await SilaBot.sendMessage(userJid, {
                                image: { url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' },
                                caption: `🎬 *SILATRIX MD V2.0 Full Setup Guide!*\n\n🚀 Bug Fixes + New Commands + Fast AI Chat\n📺 Watch Now: https://youtu.be/-oz_u1iMgf8`
                            });
                            console.log("🎬 Video guide sent successfully");

                            // Clean up session files after use
                            console.log("🧹 Cleaning up session files...");
                            await delay(1000);
                            removeFile(dirs);
                            console.log("✅ Session files cleaned up successfully");
                            console.log("🎉 Process completed successfully!");
                        } else {
                            console.error("❌ Failed to generate session string");
                            await SilaBot.sendMessage(userJid, {
                                text: "❌ Failed to create session. Please try again."
                            });
                        }
                    } catch (error) {
                        console.error("❌ Error during session creation:", error);
                        // Clean up session even if sending fails
                        removeFile(dirs);
                    }
                }

                if (isNewLogin) {
                    console.log("🔐 New login via pair code");
                }

                if (isOnline) {
                    console.log("📶 Client is online");
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode === 401) {
                        console.log("❌ Logged out from WhatsApp. Need to generate new pair code.");
                    } else {
                        console.log("🔁 Connection closed — restarting...");
                        initiateSession();
                    }
                }
            });

            if (!SilaBot.authState.creds.registered) {
                await delay(3000); // Wait 3 seconds before requesting pairing code
                num = num.replace(/[^\d+]/g, '');
                if (num.startsWith('+')) num = num.substring(1);

                try {
                    let code = await SilaBot.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) {
                        console.log({ num, code });
                        await res.send({ code });
                    }
                } catch (error) {
                    console.error('Error requesting pairing code:', error);
                    if (!res.headersSent) {
                        res.status(503).send({ code: 'Failed to get pairing code. Please check your phone number and try again.' });
                    }
                }
            }

            SilaBot.ev.on('creds.update', saveCreds);
        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service Unavailable' });
            }
        }
    }

    await initiateSession();
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    if (e.includes("Stream Errored")) return;
    if (e.includes("Stream Errored (restart required)")) return;
    if (e.includes("statusCode: 515")) return;
    if (e.includes("statusCode: 503")) return;
    console.log('Caught exception: ', err);
});

export default router;
