import { MongoClient } from 'mongodb';
import { Documents, database_management, database_documents } from './definitions';

class Database {
    public client: database_documents;
    public management_access_key: string;
    public management_route_key: string;
    constructor (connection_uri: string, database_name: string, desired_management_keys: database_management) {
        new MongoClient(connection_uri, { useUnifiedTopology: true }).connect((error, result) => {
            if (error) {
                console.log(`[Couldn't Connect to Database]\n[Reason]: [${ error.errmsg }]`);
                process.exit(1);
            } else {
                try {
                    const database = result.db(database_name);
                    database.createCollection(Documents.licenses, () => {
                        database.createCollection(Documents.sessions, () => {
                            database.createCollection(Documents.tokens, () => {
                                this.client = {
                                    licenses: database.collection(Documents.licenses),
                                    sessions: database.collection(Documents.sessions),
                                    tokens: database.collection(Documents.tokens)
                                };
                                console.log(`[Connected to Database]\n[Database Name]: [${ database_name }]`);
                            });
                        });
                    });
                } catch (error) {
                    console.log(`[Couldn't Initialize Database]\n[Reason]: [${ error }]`);
                    process.exit(1);
                }
            }
        });
        this.management_access_key = desired_management_keys.management_access_key;
        this.management_route_key = desired_management_keys.management_route_key;
    }
};

export { Database }