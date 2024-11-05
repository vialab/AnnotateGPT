// import { getAuth, deleteUser } from "firebase/auth";
import { getAuth } from "firebase-admin/auth";
import * as admin from "firebase-admin";
import fs from "fs";

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
const app = admin.apps.length ? admin.apps[0] : admin.initializeApp({
    credential: admin.credential.cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key
    }),
}, "service");

const auth = getAuth(app);
const db = admin.firestore(app);

async function getAllCollectionsAndDocuments(db) {
    const result = {};
    await traverseCollectionsAndDocuments(db, result);
    return result;
}

async function traverseCollectionsAndDocuments(db, parentObj, ref = null, parentPath = "") {
    const collections = ref ? await ref.listCollections() : await db.listCollections();

    for (const collection of collections) {
        const collectionPath = parentPath ? `${parentPath}/${collection.id}` : collection.id;
        parentObj[collection.id] = {};

        const documents = await collection.listDocuments();
        for (const docRef of documents) {
            const docSnapshot = await docRef.get();

            if (docSnapshot.exists) {
                parentObj[collection.id][docRef.id] = await docSnapshot.data();

                // Recursively traverse subcollections
                await traverseCollectionsAndDocuments(db, parentObj[collection.id][docRef.id], docRef, `${collectionPath}/${docRef.id}`);
            } else {
                parentObj[collection.id][docRef.id] = {};
                await traverseCollectionsAndDocuments(db, parentObj[collection.id][docRef.id], docRef, `${collectionPath}/${docRef.id}`);
            }
        }
    }
}

// (async () => {
//     console.log("Fetching all collections and documents...");
//     const data = await getAllCollectionsAndDocuments(db);
//     // Write the data to a file, if file already exists create a new filename with numbers appended
//     console.log("Writing data to file...");
    
//     if (!fs.existsSync("data.json")) {
//         fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
//     } else {
//         let i = 1;
//         while (fs.existsSync(`data (${i}).json`)) {
//             i++;
//         }
//         fs.writeFileSync(`data (${i}).json`, JSON.stringify(data, null, 2));
//     }
// })();
  

export default async function handler(req, res) {
    let uid = req.body.id;

    if (uid) {
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

// const deleteAllUsers = (nextPageToken) => {
//     let allUsers = [];

//     auth
//     .listUsers(1000, nextPageToken)
//     .then((listUsersResult) => {
//         listUsersResult.users.forEach((userRecord) => {
//             allUsers.push(userRecord.uid);
//         });
//         if (listUsersResult.pageToken) {
//             // List next batch of users.
//             deleteAllUsers(listUsersResult.pageToken);
//         }

//         auth
//         .deleteUsers(allUsers)
//         .then((deleteUsersResult) => {
//             console.log(`Successfully deleted ${deleteUsersResult.successCount} users`);
//             console.log(`Failed to delete ${deleteUsersResult.failureCount} users`);
//             deleteUsersResult.errors.forEach((err) => {
//                 console.log(err.error.toJSON());
//             });
//         })
//         .catch((error) => {
//             console.log('Error deleting users:', error);
//         });
//     })
//     .catch((error) => {
//         console.log('Error listing users:', error);
//     });
// };

// deleteAllUsers();