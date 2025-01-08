import * as vs from 'vscode';

export class Log {
    constructor() {
        this.channel = vs.window.createOutputChannel('TurboGerrit');
    }

    channel: vs.OutputChannel;
    i(message: string) { this.channel.appendLine(`${this.now()} I: ${message}`); }
    e(message: string) { this.channel.appendLine(`${this.now()} E: ${message}`); }
    vsI(message: string) {
        this.i(message);
        vs.window.showInformationMessage(message);
    }
    vsE(message: string) {
        this.e(message);
        vs.window.showErrorMessage(message); 
    }

    private now(): string {
        const date = new Date();
        const options: Intl.DateTimeFormatOptions = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        };
        return `[${date.toLocaleTimeString('en', options)}]`;
    }
}
