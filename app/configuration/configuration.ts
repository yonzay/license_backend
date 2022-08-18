import NodeRSA from 'node-rsa';

class Configuration {
    public server_address: string;
    public server_port: number;
    public server_version: string;
    public application_version: string;
    public server_rsa_key: NodeRSA;
    constructor (server_address: string, server_port: number, server_version: string, application_verison: string, server_rsa_key: string) {
        this.server_address = server_address;
        this.server_port = server_port;
        this.server_version = server_version;
        this.application_version = application_verison;
        try {
            this.server_rsa_key = new NodeRSA(server_rsa_key, 'pkcs8', {
                "environment": 'node',
                "encryptionScheme": 'pkcs1'
            });
            console.log(`[Successfully Using RSA]`);
            console.log(`[Size]: [${ this.server_rsa_key.getKeySize() }]`);
        } catch (error) {
            console.log(`[Failed to Use RSA]`);
            console.log(`[Reason]: [${ error }]`);
            process.exit(1);
        }
    }
};

export { Configuration }
