import { Admin } from "mongodb";
import { LicenseTier } from "../database/definitions";

enum Endpoints {
    health = 'health',
    check = 'check',
    token = 'token',
    license = 'license',
    reset = 'reset',
    rental = 'rental',
    dashboard = 'dashboard',
    extend = 'extend',
    end = 'end',
    admin_action = 'admin_action'
}

enum ResponseCodes {
    bad,
    already_owns_license,
    license_does_not_exist,
    other_machine_owns_license,
    other_rental_license_in_use,
    not_in_discord_server,
    session_in_use,
    session_does_not_exist,
    hwid_does_not_match_session,
    low_access_authority,
    this_rental_license_exists,
    incorrect_version
}

enum ActionType {
    register,
    login,
    bind
}

enum RentalAction {
    create = 'create',
    delete = 'delete'
}

enum AdminAction {
    create = 'create',
    delete = 'delete',
    renew = 'renew',
    extend_beta = 'extend_beta'
}

interface admin_data {
    access_key: string;
    licenses: Array<string>;
    creator: string;
    license_tier: LicenseTier;
    action: AdminAction;
}

interface decrypted_data {
    decrypted: {
        license: string;
        desired_rental_license: string;
        desired_rental_action: RentalAction;
        session: string;
        discord_id: string;
        discord_tag: string;
        hwid: string;
        nonce: string;
    }
}

interface proof_data {
    decrypted: {
        session: string;
        hwid: string;
        nonce: string;
    }
}

export { Endpoints, ResponseCodes, ActionType, AdminAction, RentalAction, admin_data, decrypted_data, proof_data }