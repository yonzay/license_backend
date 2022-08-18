import { RecognizedString, HttpResponse, HttpRequest } from 'uWebSockets.js';

enum RouteAuthorities {
    application = 'application',
    user = 'user',
    admin = 'admin'
}

interface route {
    pattern: RecognizedString;
    handler: (response: HttpResponse, request: HttpRequest) => void;
}

export { RouteAuthorities, route }

