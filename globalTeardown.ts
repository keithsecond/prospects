import { Utilities } from './classes/utilities';

    async function globalTeardown() {
        const utils = new Utilities();
        await utils.consolidateBatchWrites();
    }

export default globalTeardown;