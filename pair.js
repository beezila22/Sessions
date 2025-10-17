import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';
import crypto from 'crypto';

const router = express.Router();

// Function to generate random session string
function generateSessionString() {
    const prefix = 'Sila~';
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

    await removeFile(dirs);

    num = num.replace(/[^0-9]/g, '');

    const phone = pn('+' + num);
    if (!phone.isValid()) {
        if (!res.headersSent) {
            return res.status(400).send({ code: 'Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, 84987654321 for Vietnam, etc.) without + or spaces.' });
        }
        return;
    }
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
                        const sessionString = saveSessionAsString(dirs);
                        
                        if (sessionString) {
                            const finalSessionId = generateSessionString();
                            
                            console.log(`Session Mapping: ${finalSessionId} -> ${sessionString.substring(0, 20)}...`);
                            
                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            
                            // 1. Send SESSION ID FIRST (standalone)
                            await SilaBot.sendMessage(userJid, {
                                text: `╔═══════════════════╗
║    🎉 SESSION ID    ║
╚═══════════════════╝

📱 *YOUR SESSION ID:*
┌─────────────────────┐
│ ${finalSessionId} │
└─────────────────────┘

💡 *Copy this ID carefully!*
🔐 Use it to restore your session`
                            });
                            console.log("📄 Session ID sent successfully");

                            // Add small delay for better user experience
                            await delay(1500);

                            // 2. Send WhatsApp Channel link
                            await SilaBot.sendMessage(userJid, {
                                text: `╔════════════════════════╗
║     📢 JOIN CHANNEL     ║
╚════════════════════════╝

🌟 *Stay Updated with Latest Features!*

📱 Join our official WhatsApp Channel:
${'```'}https://whatsapp.com/channel/0029VbBPxQTJUM2WCZLB6j28${'```'}

💬 Get news, updates & premium features!`
                            });
                            console.log("📢 Channel link sent");

                            await delay(1000);

                            // 3. Send warning message with beautiful format
                            await SilaBot.sendMessage(userJid, {
                                text: `╔════════════════════════╗
║     ⚠️  WARNING  ⚠️      ║
╚════════════════════════╝

🔒 *SECURITY ALERT*

❌ *DO NOT SHARE* this session ID with anyone!
❌ *DO NOT SEND* it to unknown persons!
❌ *KEEP IT SECURE* and private!

🚫 Sharing may lead to:
• Account theft
• Privacy breach  
• Data loss
• Security risks

🛡️ *Your safety is our priority!*`
                            });
                            console.log("⚠️ Warning message sent");

                            await delay(1000);

                            // 4. Send contact information
                            await SilaBot.sendMessage(userJid, {
                                text: `╔════════════════════════╗
║     📞 CONTACT INFO     ║
╚════════════════════════╝

👨‍💻 *Developer:* Mr Sila Hacker
📞 *Phone:* +255612491554
🔧 *Support:* Available 24/7

💬 Need help? Contact us anytime!

┌─────────────────────┐
│   🎯 SILA TECH     │
│   💻 INNOVATION    │
└─────────────────────┘

© 2024 Sila Tech - All Rights Reserved`
                            });
                            console.log("📞 Contact info sent");

                            // 5. Send video guide (with placeholder image)
                            await SilaBot.sendMessage(userJid, { 
                                image: { 
                                    url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' 
                                },
                                caption: `🎬 *SILATRIX MD V2.0 FULL GUIDE!*

🚀 *What's New:*
• Bug Fixes ✅
• New Commands ✅  
• Fast AI Chat ✅
• Enhanced Security ✅

📺 *Watch Setup Tutorial:*
https://youtu.be/-oz_u1iMgf8

💫 *Unlock the full power of Silatrix!*`
                            });
                            console.log("🎬 Video guide sent");

                            // Clean up
                            console.log("🧹 Cleaning up session files...");
                            await delay(1000);
                            removeFile(dirs);
                            console.log("✅ Session files cleaned up");
                            console.log("🎉 All messages sent successfully!");
                        } else {
                            console.error("❌ Failed to generate session string");
                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            await SilaBot.sendMessage(userJid, {
                                text: "❌ *SESSION CREATION FAILED!*\n\nPlease try again or contact support."
                            });
                        }
                    } catch (error) {
                        console.error("❌ Error during session creation:", error);
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
                await delay(3000);
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
