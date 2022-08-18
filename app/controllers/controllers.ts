import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { RouteAuthorities } from '../routes/definitions';
import { Endpoints, ResponseCodes, ActionType, AdminAction, RentalAction } from './definitons';
import { LicenseTier, license, AccessTier, session } from '../database/definitions';
import { Server } from '../server';
import { Handlers } from '../handlers/handlers';
import { Nonce } from '../utility/nonce';
import { v4 } from 'uuid';

class Controllers {
    public static director = (response: HttpResponse, request: HttpRequest): void => {
        if (request.getMethod() == 'get') {
            if (request.getParameter(0) == RouteAuthorities.application) {
                switch (request.getParameter(1)) {
                    case Endpoints.health:
                        return Controllers.health(response, request);
                    case Endpoints.check:
                        return Controllers.check(response, request);
                }
            }
            if (request.getParameter(0) == RouteAuthorities.user) {
                if (request.getParameter(1) == Endpoints.token) { return Controllers.token(response, request); }
            }
            Handlers.bad_response_handler(response, ResponseCodes.bad);
        } else if (request.getMethod() == 'post') {
            if (request.getParameter(0) == RouteAuthorities.user) {
                switch (request.getParameter(1)) {
                    case Endpoints.license:
                        return Controllers.license(response, request);
                    case Endpoints.reset:
                        return Controllers.reset(response, request);
                    case Endpoints.rental:
                        return Controllers.rental(response, request);
                    case Endpoints.dashboard:
                        return Controllers.dashboard(response, request);
                    case Endpoints.extend:
                        return Controllers.extend(response, request);
                    case Endpoints.end:
                        return Controllers.end(response, request);
                }
            }
            if (request.getParameter(0) == RouteAuthorities.admin && request.getParameter(1) == Server.database.management_route_key) {
                switch (request.getParameter(2)) {
                    case Endpoints.admin_action:
                        return Controllers.admin_action(response, request);
                }
            }
            Handlers.bad_response_handler(response, ResponseCodes.bad);
        } else {
            Handlers.bad_response_handler(response, ResponseCodes.bad);
        }
    };
    public static health = (response: HttpResponse, request: HttpRequest): void => {
        Handlers.good_response_handler(response, { success: true, notice: 'Copyright © 2020-2021 DeadLocker, LLC | All rights reserved.'});
    };
    public static check = (response: HttpResponse, request: HttpRequest): void => {
        const version_instance: string = request.getQuery('version');
        if (version_instance == Server.config.application_version) {
            Handlers.good_response_handler(response, { success: true });
        } else {
            Handlers.bad_response_handler(response, ResponseCodes.incorrect_version);
        }
    };
    public static token = (response: HttpResponse, request: HttpRequest): void => {
        response.onAborted(() => { response.aborted = true; });
        const key: string = Nonce.create_token();
        Server.database.client?.tokens.insertOne({
            token: key,
            expiry_time: new Date().getTime() + 60000
        }).then(() => {
            Handlers.good_response_handler(response, {
                success: true,
                token: key,
                time: Nonce.create_instance(new Date)
            });
        });
    };
    public static license = (response: HttpResponse, request: HttpRequest): void => {
        response.onAborted(() => { response.aborted = true; });
        const token_instance: string = request.getQuery('token');
        Handlers.encrypted_data_handler(response, (data) => {
            Server.database.client.tokens.findOne({ token: token_instance }).then((result) => {
                if (result) {
                    if (Nonce.verify(data.decrypted.nonce, token_instance, 10)) {
                            Server.discord.fetch_user_from_id('802997512205762591', data.decrypted.discord_id, (discord_username) => {
                                if (discord_username) {
                                    Server.database.client.licenses.findOne({ current_license: data.decrypted.license }).then((license_instance: license) => {
                                        if (license_instance) {
                                            if (license_instance.registered && license_instance.binded) {// login
                                                if (data.decrypted.hwid != license_instance.hwid) { 
                                                    Handlers.bad_response_handler(response, ResponseCodes.other_machine_owns_license); 
                                                } else {
                                                    Server.database.client.sessions.findOne({ license: data.decrypted.license }).then((result) => {
                                                        if (result) {
                                                            Handlers.bad_response_handler(response, ResponseCodes.session_in_use);
                                                        } else {
                                                            const unique = v4();
                                                            Server.database.client.sessions.insertOne({
                                                                license: data.decrypted.license,
                                                                session_id: unique,
                                                                hwid: data.decrypted.hwid,
                                                                expiry_time: new Date().getTime() + 300000
                                                            }).then(() => {
                                                                Handlers.good_response_handler(response, {
                                                                    success: true,
                                                                    current_license: data.decrypted.license,
                                                                    session: unique,
                                                                    license_tier: license_instance.license_tier,
                                                                    previous_license: license_instance.previous_license,
                                                                    owner: discord_username,
                                                                    creator: license_instance.creator,
                                                                    date_created: new Date (license_instance.date_created),
                                                                    date_registered: new Date(license_instance.date_registered),
                                                                    last_renewal: new Date(license_instance.last_renewal),
                                                                    next_renewal: new Date(license_instance.renewal_date),
                                                                    grace_starts: new Date(license_instance.grace_starts),
                                                                    grace_ends: new Date(license_instance.grace_ends),
                                                                    rented: license_instance.rented,
                                                                    renewal: license_instance.renewal_elasped,
                                                                    access: license_instance.access_tier,
                                                                    action_type: ActionType.login
                                                                });
                                                            });
                                                        }
                                                    });
                                                }
                                            } else {
                                                Server.database.client.licenses.findOne({ hwid: data.decrypted.hwid }).then((result) => {// check if you own another license before rebind or register
                                                    if (result) {
                                                        Handlers.bad_response_handler(response, ResponseCodes.already_owns_license);
                                                    } else {
                                                        if (!license_instance.registered) {
                                                            if (license_instance.license_tier == LicenseTier.renewal) {
                                                                Server.database.client.licenses.updateOne({ current_license: data.decrypted.license }, {$set:{
                                                                    hwid: data.decrypted.hwid,
                                                                    discord_id: data.decrypted.discord_id,
                                                                    date_registered: new Date().getTime(),
                                                                    renewal_date: new Date().getTime() + 2592000000,// 30 days
                                                                    grace_starts: new Date().getTime() + 2678000000,// 1 day after renewal
                                                                    grace_ends: new Date().getTime() + 3024000000,// 5 days after renewal
                                                                    registered: true,
                                                                    binded: true,
                                                                    access_tier: AccessTier.full
                                                                }}).then(() => {
                                                                    const unique = v4();
                                                                    Server.database.client.sessions.insertOne({
                                                                        license: data.decrypted.license,
                                                                        session_id: unique,
                                                                        hwid: data.decrypted.hwid,
                                                                        expiry_time: new Date().getTime() + 300000
                                                                    }).then(() => {
                                                                        Server.database.client.licenses.findOne({ current_license: data.decrypted.license }).then((license_instance: license) => {
                                                                            Handlers.good_response_handler(response, {
                                                                                success: true,
                                                                                current_license: data.decrypted.license,
                                                                                session: unique,
                                                                                license_tier: license_instance.license_tier,
                                                                                previous_license: license_instance.previous_license,
                                                                                owner: discord_username,
                                                                                creator: license_instance.creator,
                                                                                date_created: new Date (license_instance.date_created),
                                                                                date_registered: new Date(license_instance.date_registered),
                                                                                last_renewal: new Date(license_instance.last_renewal),
                                                                                next_renewal: new Date(license_instance.renewal_date),
                                                                                grace_starts: new Date(license_instance.grace_starts),
                                                                                grace_ends: new Date(license_instance.grace_ends),
                                                                                rented: license_instance.rented,
                                                                                access: license_instance.access_tier,
                                                                                action_type: ActionType.register
                                                                            });
                                                                        });
                                                                    });
                                                                });
                                                            } else if (license_instance.license_tier == LicenseTier.rental) {
                                                                Server.database.client.licenses.findOne({ _id: license_instance.parent }).then((parent_instance: license) => {
                                                                    if (parent_instance.rented) {
                                                                        Handlers.bad_response_handler(response, ResponseCodes.other_rental_license_in_use);
                                                                    } else {
                                                                        Server.database.client.licenses.updateOne({ current_license: parent_instance.current_license }, {$set:{
                                                                            rented: true,
                                                                            access_tier: AccessTier.selective
                                                                        }}).then(() => {
                                                                            Server.database.client.sessions.deleteOne({ license: parent_instance.current_license }).catch(e => void e);
                                                                            Server.database.client.licenses.updateOne({ current_license: data.decrypted.license }, {$set:{
                                                                                hwid: data.decrypted.hwid,
                                                                                discord_id: data.decrypted.discord_id,
                                                                                date_registered: new Date().getTime(),
                                                                                registered: true,
                                                                                binded: true,
                                                                                access_tier: AccessTier.incomplete
                                                                            }}).then(() => {
                                                                                const unique = v4();
                                                                                Server.database.client.sessions.insertOne({
                                                                                    license: data.decrypted.license,
                                                                                    session_id: unique,
                                                                                    hwid: data.decrypted.hwid,
                                                                                    expiry_time: new Date().getTime() + 300000
                                                                                }).then(() => {
                                                                                    Server.database.client.licenses.findOne({ current_license: data.decrypted.license }).then((license_instance: license) => {
                                                                                        Handlers.good_response_handler(response, {
                                                                                            success: true,
                                                                                            current_license: data.decrypted.license,
                                                                                            session: unique,
                                                                                            license_tier: license_instance.license_tier,
                                                                                            previous_license: license_instance.previous_license,
                                                                                            owner: discord_username,
                                                                                            creator: license_instance.creator,
                                                                                            date_created: new Date (license_instance.date_created),
                                                                                            date_registered: new Date(license_instance.date_registered),
                                                                                            last_renewal: new Date(license_instance.last_renewal),
                                                                                            next_renewal: new Date(license_instance.renewal_date),
                                                                                            grace_starts: new Date(license_instance.grace_starts),
                                                                                            grace_ends: new Date(license_instance.grace_ends),
                                                                                            rented: license_instance.rented,
                                                                                            access: license_instance.access_tier,
                                                                                            action_type: ActionType.register
                                                                                        });
                                                                                    });
                                                                                });
                                                                            });
                                                                        });
                                                                    }
                                                                });
                                                            } else {
                                                                let ends: number;
                                                                switch (license_instance.license_tier) {
                                                                    case LicenseTier.beta: 
                                                                        ends = new Date().getTime() + 2592000000;
                                                                        break;
                                                                    case LicenseTier.monthly:
                                                                        ends = new Date().getTime() + 2592000000;
                                                                        break;
                                                                    case LicenseTier.weekly:
                                                                        ends = new Date().getTime() + 604800000;
                                                                        break;
                                                                    case LicenseTier.daily:
                                                                        ends = new Date().getTime() + 86400000;
                                                                        break;
                                                                    default:
                                                                        ends = new Date().getTime() + 86400000;
                                                                        break;
                                                                }
                                                                Server.database.client.licenses.updateOne({ current_license: data.decrypted.license }, {$set:{
                                                                    hwid: data.decrypted.hwid,
                                                                    discord_id: data.decrypted.discord_id,
                                                                    date_registered: new Date().getTime(),
                                                                    grace_ends: ends,
                                                                    registered: true,
                                                                    binded: true,
                                                                    access_tier: AccessTier.incomplete
                                                                }}).then(() => {
                                                                    const unique = v4();
                                                                    Server.database.client.sessions.insertOne({
                                                                        license: data.decrypted.license,
                                                                        session_id: unique,
                                                                        hwid: data.decrypted.hwid,
                                                                        expiry_time: new Date().getTime() + 300000
                                                                    }).then(() => {
                                                                        Server.database.client.licenses.findOne({ current_license: data.decrypted.license }).then((license_instance: license) => {
                                                                            Handlers.good_response_handler(response, {
                                                                                success: true,
                                                                                current_license: data.decrypted.license,
                                                                                session: unique,
                                                                                license_tier: license_instance.license_tier,
                                                                                previous_license: license_instance.previous_license,
                                                                                owner: discord_username,
                                                                                creator: license_instance.creator,
                                                                                date_created: new Date (license_instance.date_created),
                                                                                date_registered: new Date(license_instance.date_registered),
                                                                                last_renewal: new Date(license_instance.last_renewal),
                                                                                next_renewal: new Date(license_instance.renewal_date),
                                                                                grace_starts: new Date(license_instance.grace_starts),
                                                                                grace_ends: new Date(license_instance.grace_ends),
                                                                                rented: license_instance.rented,
                                                                                access: license_instance.access_tier,
                                                                                action_type: ActionType.register
                                                                            });
                                                                        });
                                                                    });
                                                                });
                                                            }
                                                        } else if (!license_instance.binded) {
                                                            let new_license: string = '';
                                                            for (let x = 0; x < 23; x++) { 
                                                                if (x == 5 || x == 11 || x == 17) {
                                                                    new_license = new_license + '-';
                                                                } else {
                                                                    new_license = new_license + v4().substr(3, 1).toUpperCase(); 
                                                                }
                                                            }
                                                            Server.database.client.licenses.updateOne({ current_license: data.decrypted.license }, {$set:{
                                                                previous_license: data.decrypted.license,
                                                                current_license: new_license,
                                                                hwid: data.decrypted.hwid,
                                                                discord_id: data.decrypted.discord_id,
                                                                binded: true
                                                            }}).then(() => {
                                                                const unique = v4();
                                                                Server.database.client.sessions.insertOne({
                                                                    license: new_license,
                                                                    session_id: unique,
                                                                    hwid: data.decrypted.hwid,
                                                                    expiry_time: new Date().getTime() + 300000
                                                                }).then(() => {
                                                                    Server.database.client.licenses.findOne({ current_license: new_license }).then((license_instance: license) => {
                                                                        Handlers.good_response_handler(response, {
                                                                            success: true,
                                                                            current_license: new_license,
                                                                            session: unique,
                                                                            license_tier: license_instance.license_tier,
                                                                            previous_license: license_instance.previous_license,
                                                                            owner: discord_username,
                                                                            creator: license_instance.creator,
                                                                            date_created: new Date (license_instance.date_created),
                                                                            date_registered: new Date(license_instance.date_registered),
                                                                            last_renewal: new Date(license_instance.last_renewal),
                                                                            next_renewal: new Date(license_instance.renewal_date),
                                                                            grace_starts: new Date(license_instance.grace_starts),
                                                                            grace_ends: new Date(license_instance.grace_ends),
                                                                            rented: license_instance.rented,
                                                                            renewal: license_instance.renewal_elasped,
                                                                            access: license_instance.access_tier,
                                                                            action_type: ActionType.bind
                                                                        });
                                                                    });
                                                                });
                                                            });
                                                        }
                                                    }
                                                });
                                            }
                                        } else {
                                            Handlers.bad_response_handler(response, ResponseCodes.license_does_not_exist);
                                        }
                                    });
                                } else {
                                    Handlers.bad_response_handler(response, ResponseCodes.not_in_discord_server);
                                }
                            });
                    } else {
                        Handlers.bad_response_handler(response, ResponseCodes.bad);
                    }
                } else {
                    Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            });
        });
    };
    public static reset = (response: HttpResponse, request: HttpRequest): void => {
        response.onAborted(() => { response.aborted = true; });
        const token_instance: string = request.getQuery('token');
        Handlers.encrypted_data_handler(response, (data) => {
            Server.database.client.tokens.findOne({ token: token_instance }).then((result) => {
                if (result) {
                    if (Nonce.verify(data.decrypted.nonce, token_instance, 10)) {
                        Server.database.client.sessions.findOne({ session_id: data.decrypted.session }).then((result: session) => {
                            if (result) {
                                if (data.decrypted.hwid != result.hwid) {
                                    Handlers.bad_response_handler(response, ResponseCodes.hwid_does_not_match_session);
                                } else {
                                    Server.database.client.licenses.findOne({ current_license: data.decrypted.license }).then((license_instance: license) => {
                                        if (license_instance.access_tier != AccessTier.full && license_instance.access_tier != AccessTier.selective) {
                                            Handlers.bad_response_handler(response, ResponseCodes.low_access_authority);
                                        } else {
                                            Server.database.client.licenses.updateOne({ current_license: data.decrypted.license }, {$set:{
                                                hwid: '',
                                                discord_id: '',
                                                binded: false
                                            }}).then(() => {
                                                Server.database.client.sessions.deleteOne({ session_id: data.decrypted.session }).then(() => {
                                                    Handlers.good_response_handler(response, { success: true });
                                                });
                                            });
                                        }
                                    });
                                }
                            } else {
                                Handlers.bad_response_handler(response, ResponseCodes.session_does_not_exist);
                            }
                        });
                    } else {
                        Handlers.bad_response_handler(response, ResponseCodes.bad);
                    }
                } else {
                    Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            });
        });
    };
    public static rental = (response: HttpResponse, request: HttpRequest): void => {
        response.onAborted(() => { response.aborted = true; });
        const token_instance: string = request.getQuery('token');
        Handlers.encrypted_data_handler(response, (data) => {
            Server.database.client.tokens.findOne({ token: token_instance }).then((result) => {
                if (result) {
                    if (Nonce.verify(data.decrypted.nonce, token_instance, 10)) {
                        Server.database.client.sessions.findOne({ session_id: data.decrypted.session }).then((result: session) => {
                            if (result) {
                                if (data.decrypted.hwid != result.hwid) {
                                    Handlers.bad_response_handler(response, ResponseCodes.hwid_does_not_match_session);
                                } else {
                                    Server.database.client.licenses.findOne({ current_license: data.decrypted.license }).then((license_instance: license) => {
                                        if (license_instance.access_tier != AccessTier.full && license_instance.access_tier != AccessTier.selective) {
                                            Handlers.bad_response_handler(response, ResponseCodes.low_access_authority);
                                        } else {
                                            if (data.decrypted.desired_rental_action == RentalAction.create) {
                                                Server.database.client.licenses.findOne({ current_license: data.decrypted.desired_rental_license }).then((result) => {
                                                    if (result) {
                                                        Handlers.bad_response_handler(response, ResponseCodes.this_rental_license_exists);
                                                    } else {
                                                        Server.database.client.licenses.insertOne({
                                                            license_tier: LicenseTier.rental,
                                                            parent: license_instance._id,
                                                            previous_license: 'Null',
                                                            current_license: data.decrypted.desired_rental_license,
                                                            hwid: '',
                                                            discord_id: '',
                                                            creator: data.decrypted.discord_tag,
                                                            date_created: new Date().getTime(),
                                                            date_registered: 'Null',
                                                            last_renewal: 'Null',
                                                            renewal_date: 'Null',
                                                            grace_starts: 'Null',
                                                            grace_ends: 'Null',
                                                            registered: false,
                                                            binded: false,
                                                            rented: false,
                                                            renewal_elasped: false,
                                                            access_tier: 'Null'
                                                        }).then(() => {
                                                            Handlers.good_response_handler(response, { success: true });
                                                        });
                                                    }
                                                });
                                            } else if (data.decrypted.desired_rental_action == RentalAction.delete) {
                                                Server.database.client.licenses.findOne({ current_license: data.decrypted.desired_rental_license }).then((result: license) => {
                                                    if (result.discord_id.toString().length != 0) {
                                                        Server.database.client.licenses.findOne({ current_license: data.decrypted.license }).then((result: license) => {
                                                            if (!result.renewal_elasped) {
                                                                Server.database.client.licenses.updateOne({ current_license: data.decrypted.license }, {$set:{
                                                                    rented: false,
                                                                    access_tier: AccessTier.full
                                                                }}).then(() => {
                                                                    Server.database.client.sessions.deleteOne({ license: data.decrypted.desired_rental_license }).catch(e => void e);
                                                                    Server.database.client.licenses.deleteOne({ current_license: data.decrypted.desired_rental_license }).then(() => {
                                                                        Handlers.good_response_handler(response, { success: true, restored: true });
                                                                    });
                                                                });
                                                            } else {
                                                                Server.database.client.licenses.updateOne({ current_license: data.decrypted.license }, {$set:{
                                                                    rented: false
                                                                }}).then(() => {
                                                                    Server.database.client.sessions.deleteOne({ license: data.decrypted.desired_rental_license }).catch(e => void e);
                                                                    Server.database.client.licenses.deleteOne({ current_license: data.decrypted.desired_rental_license }).then(() => {
                                                                        Handlers.good_response_handler(response, { success: true, restored: false });
                                                                    });
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        Server.database.client.sessions.deleteOne({ license: data.decrypted.desired_rental_license }).catch(e => void e);
                                                        Server.database.client.licenses.deleteOne({ current_license: data.decrypted.desired_rental_license }).then(() => {
                                                            Handlers.good_response_handler(response, { success: true, restored: false });
                                                        });
                                                    }
                                                });
                                            }
                                        }
                                    });
                                }
                            } else {
                                Handlers.bad_response_handler(response, ResponseCodes.session_does_not_exist);
                            }
                        });
                    } else {
                        Handlers.bad_response_handler(response, ResponseCodes.bad);
                    }
                } else {
                    Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            });
        });
    };
    public static dashboard = (response: HttpResponse, request: HttpRequest): void => {
        response.onAborted(() => { response.aborted = true; });
        const token_instance: string = request.getQuery('token');
        Handlers.encrypted_data_handler(response, (data) => {
            Server.database.client.tokens.findOne({ token: token_instance }).then((result) => {
                if (result) {
                    if (Nonce.verify(data.decrypted.nonce, token_instance, 10)) {
                        Server.database.client.sessions.findOne({ session_id: data.decrypted.session }).then((result: session) => {
                            if (result) {
                                if (data.decrypted.hwid != result.hwid) {
                                    Handlers.bad_response_handler(response, ResponseCodes.hwid_does_not_match_session);
                                } else {
                                    Server.database.client.licenses.findOne({ current_license: data.decrypted.license }).then((license_instance: license) => {
                                        if (license_instance.access_tier != AccessTier.full && license_instance.access_tier != AccessTier.selective) {
                                            Handlers.bad_response_handler(response, ResponseCodes.low_access_authority);
                                        } else {
                                            Server.database.client.licenses.find({ parent: license_instance._id }).toArray().then((result: Array<license>) => {
                                                let license_key: Array<string> = [];
                                                let date_created: Array<Date> = [];
                                                let date_registered: Array<Date> = [];
                                                let owner_id: Array<number> = [];
                                                for (let x: number = 0; x < result.length; x++) {
                                                    license_key.push(result[x].current_license);
                                                    date_created.push(new Date(result[x].date_created));
                                                    date_registered.push(new Date(result[x].date_registered));
                                                    owner_id.push(result[x].discord_id);
                                                }
                                                Handlers.good_response_handler(response, {success: true, column_license_key: license_key, column_date_created: date_created, column_date_registered: date_registered, column_owner_id: owner_id});
                                            });
                                        }
                                    });
                                }
                            } else {
                                Handlers.bad_response_handler(response, ResponseCodes.session_does_not_exist);
                            }
                        });
                    } else {
                        Handlers.bad_response_handler(response, ResponseCodes.bad);
                    }
                } else {
                    Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            });
        });
    };
    public static extend = (response: HttpResponse, request: HttpRequest): void => {
        response.onAborted(() => { response.aborted = true; });
        const token_instance: string = request.getQuery('token');
        Handlers.proof_data_handler(response, (data) => {
            Server.database.client.tokens.findOne({ token: token_instance }).then((result) => {
                if (result) {
                    if (Nonce.verify(data.decrypted.nonce, token_instance, 60)) {
                        Server.database.client.sessions.updateOne({ session_id: data.decrypted.session }, {$set:{ expiry_time: new Date().getTime() + 300000 }}).then(() => {
                            Handlers.good_response_handler(response, { success: true });
                        });
                    } else {
                        Handlers.bad_response_handler(response, ResponseCodes.bad);
                    }
                } else {
                    Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            });
        });
    };
    public static end = (response: HttpResponse, request: HttpRequest): void => {
        response.onAborted(() => { response.aborted = true; });
        const token_instance: string = request.getQuery('token');
        Handlers.proof_data_handler(response, (data) => {
            Server.database.client.tokens.findOne({ token: token_instance }).then((result) => {
                if (result) {
                    if (Nonce.verify(data.decrypted.nonce, token_instance, 10)) {
                        Server.database.client.sessions.findOne({ session_id: data.decrypted.session }).then((result: session) => {
                            if (result) {
                                if (data.decrypted.hwid != result.hwid) {
                                    Handlers.bad_response_handler(response, ResponseCodes.hwid_does_not_match_session);
                                } else {
                                    Server.database.client.sessions.deleteOne({ session_id: data.decrypted.session }).then(() => {
                                        Handlers.good_response_handler(response, { success: true });
                                    });
                                }
                            } else {
                                Handlers.bad_response_handler(response, ResponseCodes.session_does_not_exist);
                            }
                        });
                    } else {
                        Handlers.bad_response_handler(response, ResponseCodes.bad);
                    }
                } else {
                    Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            });
        });
    };
    public static admin_action = (response: HttpResponse, request: HttpRequest): void => {
        response.onAborted(() => { response.aborted = true; });
        Handlers.admin_data_handler(response, (data) => {
            if (data.access_key == Server.database.management_access_key) {
                if (data.action == AdminAction.create) {
                    for (let x = 0; x < data.licenses.length; x++) {
                        Server.database.client.licenses.insertOne({
                            license_tier: data.license_tier,
                            parent: "Null",
                            previous_license: 'Null',
                            current_license: data.licenses[x],
                            hwid: '',
                            discord_id: '',
                            creator: data.creator,
                            date_created: new Date().getTime(),
                            date_registered: '',
                            last_renewal: 'Null',
                            renewal_date: 'Null',
                            grace_starts: 'Null',
                            grace_ends: 'Null',
                            registered: false,
                            binded: false,
                            rented: false,
                            renewal_elasped: false,
                            access_tier: 'Null'
                        }).catch(e => void e);
                    }
                    Handlers.good_response_handler(response, { success: true });
                } else if (data.action == AdminAction.renew) {
                    for (let x = 0; x < data.licenses.length; x++) {
                        Server.database.client.licenses.findOne({ current_license: data.licenses[x] }).then((result: license) => {
                            if (result) {
                                if (result.renewal_elasped) {
                                    Server.database.client.licenses.updateOne({ current_license: data.licenses[x] }, {$set:{
                                        last_renewal: result.renewal_date,
                                        renewal_date: new Date().getTime() + 2592000000,// 30 days
                                        grace_starts: new Date().getTime() + 2678000000,// 1 day after renewal
                                        grace_ends: new Date().getTime() + 3024000000,// 5 days after renewal
                                        renewal_elasped: false
                                    }}).catch(e => void e);
                                }
                            }
                        }).catch(e => void e);
                    }
                    Handlers.good_response_handler(response, { success: true });
                } else if (data.action == AdminAction.delete) {
                    for (let x = 0; x < data.licenses.length; x++) { Server.database.client.licenses.deleteOne({ current_license: data.licenses[x] }); }
                    Handlers.good_response_handler(response, { success: true });
                } else if (data.action == AdminAction.extend_beta) {
                    Server.database.client.licenses.find().forEach((result: license) => {
                        if (result) {
                            if (result.license_tier == LicenseTier.beta && result.registered) {
                                Server.database.client.licenses.updateOne({ current_license: result.current_license }, {$set:{
                                    grace_ends: new Date().getTime() + 2592000000
                                }}).catch(e => void e);
                            }
                        }
                    }).catch(e => void e);
                    Handlers.good_response_handler(response, { success: true });
                } else {
                    Handlers.bad_response_handler(response, ResponseCodes.bad);
                }
            } else {
                Handlers.bad_response_handler(response, ResponseCodes.bad);
            }
        });
    };
};

export { Controllers }