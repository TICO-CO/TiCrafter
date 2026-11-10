export type TransportFailure =
    | { type: 'INVALID_FRAME'; message: string }
    | { type: 'UNKNOWN_MESSAGE'; messageType: string }
    | { type: 'INVALID_PAYLOAD'; messageType: string; message: string }
    | { type: 'NOT_CONNECTED' }
    | { type: 'CONNECT_FAILED'; message: string }
    | { type: 'DISCONNECTED'; message: string }
    | { type: 'LISTEN_FAILED'; message: string }
    | { type: 'TIMEOUT'; requestType: string }
    | { type: 'AUTH_FAILED'; message: string }
    | { type: 'SEND_FAILED'; message: string };
