import { createHmac, BinaryLike } from 'crypto'; 

class Nonce {
    public static create = (token: BinaryLike, time: BinaryLike): string => {
        return createHmac('sha256', token).update(time).digest('hex');
    };
    public static create_token = (): string => {
        let bytes: Buffer = Buffer.alloc(32);
        for (let i: number = 0; i < bytes.length; i++) { bytes.set([Math.floor(Math.random() * 256)], i); }
        return bytes.toString('hex');
    };
    public static create_instance = (date: Date): string => {
        let M: string = (date.getMonth() + 1).toString();
        let d: string = date.getDate().toString();
        let h: string = date.getHours().toString();
        let m: string = date.getMinutes().toString();
        let s: string = date.getSeconds().toString();
        h = ((parseInt(h) + 11) % 12 + 1).toString();
        if (parseInt(M) < 10) { M = "0" + M; }
        if (parseInt(d) < 10) { d = "0" + d; }
        if (parseInt(h) < 10) { h = "0" + h; }
        if (parseInt(m) < 10) { m = "0" + m; }
        if (parseInt(s) < 10) { s = "0" + s; }
        return M + ':' + d + ':' + h + ':' + m + ':' + s + ':' + date.getFullYear().toString();
    };
    public static verify = (nonce: BinaryLike, token: BinaryLike, range: number): boolean => {
        let session:Array<string> = [];
        let time: Date = new Date;
        for (let i: number = 0; i < range; i++) {
            time.setSeconds(time.getSeconds() - i);
            session.push(createHmac('sha256', token).update(Nonce.create_instance(time)).digest('hex'));
            time.setSeconds(time.getSeconds() + i);
        }
        if (session.indexOf(nonce.toString()) == -1) {
            return false;
        } else {
            return true;
        }
    };
};

export { Nonce }