import { Collection } from 'mongodb'

enum Documents {
    licenses = 'Licenses',
    sessions = 'Sessions',
    tokens = 'Tokens'
}

enum LicenseTier {
    beta = 'Beta',
    daily = 'Daily',
    weekly = 'Weekly',
    monthly = 'Monthly',
    rental = 'Rental',
    renewal = 'Renewal'
}
 
enum AccessTier {
    incomplete = 'Incomplete',
    selective = 'Selective',
    full = 'Full'
} 

interface database_management {
    management_access_key: string;
    management_route_key: string;
}

interface database_documents {
    licenses: Collection;
    sessions: Collection;
    tokens: Collection;
}

interface license {
    _id: string;
    license_tier: LicenseTier;
    parent: string;
    previous_license: string;
    current_license: string;
    hwid: string;
    discord_id: number;
    creator: string;
    date_created: string;
    date_registered: number;
    last_renewal: number;
    renewal_date: number;
    grace_starts: number;
    grace_ends: number;
    registered: boolean;
    binded: boolean;
    rented: boolean;
    renewal_elasped: boolean;
    access_tier: AccessTier;
}

interface session {
    license: string;
    session_id: string;
    hwid: string;
    expiry_time: number;
}

export { Documents, LicenseTier, AccessTier, database_management, database_documents, license, session }
