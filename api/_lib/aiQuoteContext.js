import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
export const currentAIQuote = () => storage.getStore();
export const withAIQuote = (quote, callback) => storage.run({ ...quote, used: new Set() }, callback);

