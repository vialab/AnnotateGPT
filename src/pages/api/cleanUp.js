import { getAuth } from "firebase-admin/auth";
import * as admin from "firebase-admin";

const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) : null;
    
const app = credentials ? (admin.apps.length ? admin.apps[0] : admin.initializeApp({
    credential: admin.credential.cert({
        projectId: credentials.project_id,
        client_email: credentials.client_email,
        private_key: credentials.private_key,
    }),
}, "service")) : null;

const auth = app ? getAuth(app) : null;
const db = app ? admin.firestore(app) : null;

export default async function handler(req, res) {
    let uid = req.body.id;

    if (uid) {
        const retry = async (retriesLeft = 3, interval = 500) => {
            try {
                return await auth?.deleteUser(uid);
            } catch (error) {
                if (retriesLeft === 0) 
                    throw error;
                await new Promise(res => setTimeout(res, interval));
                return retry(retriesLeft - 1, interval);
            }
        };

        await retry()
        .then(() => {
            res.status(200).send("User deleted successfully");
        })
        .catch((error) => {
            console.error("Error deleting user:", error);
            res.status(500).send("Error deleting user");
        });
    }
}