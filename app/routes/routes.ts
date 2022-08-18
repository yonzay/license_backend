import { Controllers } from '../controllers/controllers';
import { route } from './definitions';

class Routes {
    public static director: route = {
        pattern: '/',
        handler: Controllers.director
    };
};

export { Routes }