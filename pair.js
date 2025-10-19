import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';
import crypto from 'crypto';
import { Storage } from "megajs";

const router = express.Router();

// Function to generate random ID for Mega storage
function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

// Function to upload credentials to Mega storage
async function uploadCredsToMega(credsPath) {
    try {
        const storage = await new Storage({
            email: 'techobed4@gmail.com',
            password: 'Trippleo1802obed'
        }).ready;
        console.log('Mega storage initialized.');
        
        if (!fs.existsSync(credsPath)) {
            throw new Error(`File not found: ${credsPath}`);
        }
        
        const fileSize = fs.statSync(credsPath).size;
        const uploadResult = await storage.upload({
            name: `${randomMegaId()}.json`,
            size: fileSize
        }, fs.createReadStream(credsPath)).complete;
        
        console.log('Session successfully uploaded to Mega.');
        const fileNode = storage.files[uploadResult.nodeId];
        const megaUrl = await fileNode.link();
        console.log(`Session Url: ${megaUrl}`);
        return megaUrl;
    } catch (error) {
        console.error('Error uploading to Mega:', error);
        throw error;
    }
}

// Function to generate session string for bot hosting
function generateSessionString() {
    const prefix = 'Sila~';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
    
    for (let i = 0; i < 40; i++) {
        randomString += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return prefix + randomString;
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
    const sessionId = generateSessionString();
    let dirs = './temp/' + sessionId;

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
                    console.log("📱 Uploading session to Mega storage...");
                    
                    try {
                        const credsPath = dirs + '/creds.json';
                        
                        if (fs.existsSync(credsPath)) {
                            // Upload session to Mega
                            const megaUrl = await uploadCredsToMega(credsPath);
                            
                            // Generate Session ID for bot hosting
                            const hostingSessionId = megaUrl.includes("https://mega.nz/file/")
                                ? 'http://session.sila.xibs.space/' + megaUrl.split("https://mega.nz/file/")[1]
                                : megaUrl;

                            console.log(`🎯 Session ID for Hosting: ${hostingSessionId}`);
                            
                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            
                            // 1. Send SESSION ID for bot hosting
                            const sidMsg = await SilaBot.sendMessage(userJid, {
                                text: `╔════════════════════════╗
║     🚀 BOT SESSION ID     ║
╚════════════════════════╝

🔐 *YOUR BOT SESSION ID:*
┌─────────────────────────┐
│ ${hostingSessionId} │
└─────────────────────────┘

💻 *Use this to host your bot!*
📝 Copy and save it securely!`
                            });
                            console.log("📄 Session ID for hosting sent successfully");

                            await delay(1500);

                            // 2. Send deployment instructions
                            await SilaBot.sendMessage(userJid, {
                                text: `╔════════════════════════╗
║     🎯 DEPLOYMENT GUIDE    ║
╚════════════════════════╝

🚀 *How to Use Your Session ID:*

1. *Go to your bot hosting platform*
2. *Paste the Session ID in config*
3. *Start your bot deployment*
4. *Enjoy your WhatsApp bot!*

📖 *Full Tutorial:* 
${'```'}https://youtu.be/-oz_u1iMgf8${'```'}

💫 *Your bot will be ready in minutes!*`
                            }, { quoted: sidMsg });
                            console.log("🎯 Deployment guide sent");

                            await delay(1000);

                            // 3. Send important warnings
                            await SilaBot.sendMessage(userJid, {
                                text: `╔════════════════════════╗
║     ⚠️ SECURITY ALERT     ║
╚════════════════════════╝

🔒 *PROTECT YOUR SESSION ID!*

❌ *NEVER SHARE* with anyone!
❌ *DON'T POST* publicly!
❌ *KEEP PRIVATE* and secure!

🚫 *Risks of sharing:*
• Bot takeover
• Data theft
• Privacy breach
• Account misuse

🛡️ *Your security is important!*`
                            });
                            console.log("⚠️ Security warning sent");

                            await delay(1000);

                            // 4. Send support information
                            await SilaBot.sendMessage(userJid, {
                                text: `╔════════════════════════╗
║     📞 SUPPORT & HELP     ║
╚════════════════════════╝

👨‍💻 *Developer:* Mr Sila Hacker
📞 *Phone:* +255612491554
🕒 *Support:* 24/7 Available

🌐 *WhatsApp Channel:*
${'```'}https://whatsapp.com/channel/0029VbBPxQTJUM2WCZLB6j28${'```'}

💬 *Need help? Contact us anytime!*

┌─────────────────────┐
│   🎯 SILA TECH     │
│   🔥 INNOVATION    │
└─────────────────────┘`
                            });
                            console.log("📞 Support info sent");

                            // Clean up temporary files
                            console.log("🧹 Cleaning up temporary files...");
                            await delay(1000);
                            removeFile(dirs);
                            console.log("✅ Temporary files cleaned up");
                            
                            // Close connection
                            await SilaBot.ws.close();
                            console.log("🎉 All messages sent successfully! Connection closed.");
                        } else {
                            console.error("❌ Credentials file not found");
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
