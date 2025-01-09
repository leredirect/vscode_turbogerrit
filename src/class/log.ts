import * as vs from 'vscode';
import cp from 'child_process';

export class Log {
    constructor() {
        this.channel = vs.window.createOutputChannel('TurboGerrit');
    }

    channel: vs.OutputChannel;
    i(message: string) { this.channel.appendLine(`${this.now()} I: ${message}`); }
    e(message: string) { this.channel.appendLine(`${this.now()} E: ${message}`); }
    vsI(message: string) {
        this.i(message);
        vs.window.showInformationMessage(`TurboGerrit: ${message}`);
    }
    vsE(message: string) {
        this.e(message);
        vs.window.showErrorMessage(`TurboGerrit: ${message}`);
    }

    logCpContent(err: cp.ExecException | null, stdout: string, stderr: string) {
        if (stdout !== undefined && stdout.length > 0) this.e(`STDOUT: ${stdout}`);
        if (err !== undefined && err !== null) this.e(`ERR CODE: ${err.code}`);
        if (err !== undefined && err !== null) this.e(`ERR: ${err.message}`);
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
