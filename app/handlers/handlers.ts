import { HttpResponse } from 'uWebSockets.js';
import { ResponseCodes, admin_data, decrypted_data, proof_data } from '../controllers/definitons';
import { Server } from '../server';

class Handlers {
    public static admin_data_handler = (response: HttpResponse, callback: (data: admin_data) => void): void => {
        response.onData((chunk, isLast) => {
            if (isLast) {
                try {
                    let data: any = JSON.parse(Buffer.from(chunk).toString());
                    callback({
                        access_key: data.access_key,
                        licenses: data.licenses,
                        creator: data.creator,
                        license_tier: data.license_tier,
                        action: data.action
                    });
                } catch (error) {
                    return Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            }
        });
    };
    public static encrypted_data_handler = (response: HttpResponse, callback: (data: decrypted_data) => void): void => {
        response.onData((chunk, isLast) => {
            if (isLast) {
                try {
                    let data: any = JSON.parse(Server.config.server_rsa_key.decrypt(JSON.parse(Buffer.from(chunk).toString()).encrypted, 'utf8'));
                    callback({
                        decrypted: {
                            license: data.license ?? JSON.parse(Server.config.server_rsa_key.decrypt(JSON.parse(Buffer.from(chunk).toString()).encrypted_authentication, 'utf8')).license,
                            desired_rental_license: data.desired_rental_license,
                            desired_rental_action: data.desired_rental_action,
                            session: data.session,
                            discord_id: data.discord_id ?? JSON.parse(Server.config.server_rsa_key.decrypt(JSON.parse(Buffer.from(chunk).toString()).encrypted_authentication, 'utf8')).discord_id,
                            discord_tag: data.discord_tag,
                            hwid: data.hwid,
                            nonce: data.nonce
                        }
                    });
                } catch (error) {
                    return Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            }
        });
    };
    public static proof_data_handler = (response: HttpResponse, callback: (data: proof_data) => void): void => {
        response.onData((chunk, isLast) => {
            if (isLast) {
                try {
                    let data: any = JSON.parse(Server.config.server_rsa_key.decrypt(JSON.parse(Buffer.from(chunk).toString()).encrypted, 'utf8'));
                    callback({
                        decrypted: {
                            session: data.session,
                            hwid: data.hwid,
                            nonce: data.nonce
                        }
                    });
                } catch (error) {
                    return Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            }
        });
    };
    public static good_response_handler = (response: HttpResponse, json: object): void => {
        if (!response.aborted) {
            response.cork(() => {
                response.writeStatus('200 OK').end(JSON.stringify(json));
            });
        }
    };
    public static bad_response_handler = (response: HttpResponse, code: number): void => {
        if (!response.aborted) {
            response.cork(() => {
                response.writeStatus('400 Bad Request').end(JSON.stringify({ success: false, code: code }));
            });
        }
    };
};

export { Handlers }