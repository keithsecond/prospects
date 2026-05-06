import { execSync } from 'child_process';

/**
 * Utility to validate Chrome Debug Protocol (CDP) availability.
 * Checks port connectivity and JSON endpoint response.
 */
export class CDPValidator {
    private static readonly CDP_HOST = '127.0.0.1';
    private static readonly CDP_PORT = 9222;
    private static readonly CDP_ENDPOINT = `http://${CDPValidator.CDP_HOST}:${CDPValidator.CDP_PORT}/json/list`;

    /**
     * Checks if CDP is available by verifying port connectivity and JSON response.
     * If unavailable, attempts to launch Chrome debugger and retries.
     *
     * @returns true if CDP is NOT available (noCdp flag), false if available
     */
    static async isUnavailable(): Promise<boolean> {
        if (this.isPortOpen() && (await this.isJsonEndpointValid())) {
            return false;
        }
        this.launchChromeDebugger();
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!this.isPortOpen()) {
            return true;
        }
        if (!(await this.isJsonEndpointValid())) {
            return true;
        }
        return false;
    }

    private static launchChromeDebugger(): void {
        try {
            execSync(
                `nohup "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/.config/google-chrome" &>/dev/null &`
            );
        } catch (error) {
            console.error('Failed to launch Chrome debugger:', error);
        }
    }

    private static isPortOpen(): boolean {
        try {
            const output = execSync(`nc -zv ${this.CDP_HOST} ${this.CDP_PORT} ; echo $?`).toString();
            return output.trim() === '0';
        } catch (error) {
            console.error(`Port check failed:`, error);
            return false;
        }    
    }    

    private static async isJsonEndpointValid(): Promise<boolean> {
        try {
            const response = await fetch(this.CDP_ENDPOINT);
            if (!response.ok) {
                return false;
            }
            const jsonData = await response.json();
            return jsonData && Object.keys(jsonData).length > 0;
        } catch (error) {
            console.error(`CDP endpoint check failed:`, error);
            return false;
        }
    }
}