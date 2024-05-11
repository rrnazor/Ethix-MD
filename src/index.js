import dotenv from 'dotenv';
dotenv.config();
import { makeWASocket, jidDecode, DisconnectReason, useMultiFileAuthState,getAggregateVotesInPollMessage, makeInMemoryStore } from '@whiskeysockets/baileys';
import { Handler, Callupdate, GroupUpdate } from './event/index.js'
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import axios from 'axios';
import moment from 'moment-timezone';
import express from 'express';
const app = express();
const port = 8000;

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startsock() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session');

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            browser: ['Ethix-MD', 'Safari', '1.0.0'],
            auth: state,
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg.message || undefined;
                }
                return {
                    conversation: "Hai Im Ethix-MD"
                };
            }
        });

        store.bind(sock.ev);
        
        if (!sock.authState.creds.registered ) {
    const sessionID = process.env.SESSION_ID.split('Ethix-MD&')[1];
    const pasteUrl = `https://pastebin.com/raw/${sessionID}`;
    const response = await fetch(pasteUrl);
    const text = await response.text();
    if (typeof text === 'string') {
      fs.writeFile('./session/creds.json', text, (err) => {
  if (err) {
    console.error('Error writing creds file:', err);
  } else {
    console.log('Creds file written successfully.');
  }
});
      await startsock() 
    }
  }

        // Handle Incoming Messages
        sock.ev.on("messages.upsert", async chatUpdate => await Handler(chatUpdate, sock));
        sock.ev.on("call", async (json) => await Callupdate(json, sock));
        sock.ev.on("group-participants.update", async (messag) => await GroupUpdate(sock, messag));

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                let reason = new DisconnectReason(lastDisconnect?.error)?.output.statusCode;

                if (reason === DisconnectReason.badSession) {
                    console.log("Bad Session File, Please Delete Session and Scan Again");
                    sock.logout();
                } else if (reason === DisconnectReason.connectionClosed) {
                    console.log("Connection closed, reconnecting...");
                    startsock();
                } else if (reason === DisconnectReason.connectionLost) {
                    console.log("Connection Lost from Server, reconnecting...");
                    startsock();
                } else if (reason === DisconnectReason.connectionReplaced) {
                    console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                    sock.logout();
                } else if (reason === DisconnectReason.loggedOut) {
                    console.log("Device Logged Out, Please Scan Again And Run.");
                    sock.logout();
                } else if (reason === DisconnectReason.restartRequired) {
                    console.log("Restart Required, Restarting...");
                    startsock();
                } else if (reason === DisconnectReason.timedOut) {
                    console.log("Connection TimedOut, Reconnecting...");
                    startsock();
                } else if (reason === DisconnectReason.Multidevicemismatch) {
                    console.log("Multi device mismatch, please scan again");
                    sock.logout();
                } else {
                    sock.end(`Unknown DisconnectReason: ${reason}|${connection}`);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
    } catch (error) {
        console.error('Error starting socket:', error);
        // Handle error as needed
    }
}

startsock();

app.get('/', (req, res) => {
    res.send('Server Running');
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
