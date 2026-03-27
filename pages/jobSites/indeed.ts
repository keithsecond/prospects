import { test, expect } from '@playwright/test';
import { SpecialContextPage } from '@classes/specialContextPage';

export class IndeedPage extends SpecialContextPage {

    constructor(page: SpecialContextPage) {
        super(page.browser, page.page);
    }
};

export {test , expect };