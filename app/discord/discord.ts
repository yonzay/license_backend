import { Client } from 'discord.js';

class Discord {
    private client: Client;
    constructor (discord_token: string) {
        this.client = new Client();
        this.client.login(discord_token).then(() => {
            console.log(`[Successfully Logged Into Discord]\n[Username]: [${ this.client.user?.username }]`);
        }).catch((error) => {
            console.log(`[Couldn't Log Into Discord]`);
            console.log(`[Reason]: [${ error }]`);
            process.exit(1);
        });
    }
    fetch_user_from_id = (guild_id: string, discord_id: string, callback: (username: string | null) => void): void => {
        if (discord_id.length == 0) { return callback(null); }
        this.client.guilds.fetch(guild_id).then((result) => {
            result.members.fetch(discord_id).then((result) => {
                callback(result.user.tag);
            }).catch(() => {
                callback(null);
            });
        }).catch(() => {
            callback(null);
        });
    };
};

export { Discord }