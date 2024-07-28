// import { getAuth, deleteUser } from "firebase/auth";
import { getAuth } from "firebase-admin/auth";
import * as admin from "firebase-admin";

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
const app = admin.apps.length ? admin.apps[0] : admin.initializeApp({
    credential: admin.credential.cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key
    }),
}, "service");

const auth = getAuth(app);

export default async function handler(req, res) {
    let uid = req.body.id;

    if (uid) {
        // Delete the user, if fail retry 3 times
        const retry = async (retriesLeft = 3, interval = 500) => {
            try {
                return await auth.deleteUser(uid);
            } catch (error) {
                if (retriesLeft === 0) 
                    throw error;
                console.log(`Retrying deleting user... attempts left: ${retriesLeft}`);
                await new Promise(res => setTimeout(res, interval));
                return retry(retriesLeft - 1, interval);
            }
        };

        retry()
        .then(() => {
            res.status(200).send("User deleted successfully");
        })
        .catch((error) => {
            console.error("Error deleting user:", error);
            res.status(500).send("Error deleting user");
        });
    }
}