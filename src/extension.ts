import * as vs from 'vscode';
import cp from 'child_process';
import { ExtensionConfig } from './config/extension_config';
import { GerritDataProvider } from './treeview/gerrit_data_provider';
import { GerritFileItem } from './treeview/items/gerrit_file_item';
import { GerritReplyItem } from './treeview/items/gerrit_reply_item';
import { GerritURLItem } from './treeview/items/gerrit_url_item';
import { MemFS } from './external/fs';
import { Log } from './class/log';
import { GerritReviewItem } from './treeview/items/gerrit_review_item';

const log = new Log();
export async function activate(context: vs.ExtensionContext) {
    await registerCommands(context);
}

export function deactivate() { }

async function registerCommands(context: vs.ExtensionContext) {
    const memFs = new MemFS();
    const gerritDataProvider = new GerritDataProvider(log);
    const treeView = vs.window.createTreeView('turbogerrit.scmView', {
        treeDataProvider: gerritDataProvider,
    });

    const pushToGerritCommand =
        vs.commands.registerCommand('turbogerrit.pushToGerrit', pushToGerrit);
    const initialSetupCommand =
        vs.commands.registerCommand('turbogerrit.initialSetup', initialSetup);
    const openDiffCommand =
        vs.commands.registerCommand('turbogerrit.openDiff', (node: GerritFileItem) => {
            if (node.modification.startsWith('D') || node.modification.startsWith('A')) {
                return openFile(node, memFs);
            }
            openDiff(node, memFs);
        });
    const openUrlCommand = vs.commands.registerCommand('turbogerrit.openGerritUrl', openUrl);
    const mangeNotificationCommand = vs.commands.registerCommand('turbogerrit.mangeNotification', (node: GerritReviewItem[]) => { manageNotification(node, context); });

    const myScheme = 'turbodiff';
    const myProvider = new (class implements vs.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vs.Uri): string {
            return `${uri.path}`;
        }
    })();


    const refreshCommand = vs.commands.registerCommand('turbogerrit.refresh', async () => {
        await gerritDataProvider.refresh(true);
    });
    const gitReviewVerifiedCommand = vs.commands.registerCommand('turbogerrit.gitReview+1', gitReviewVerified);
    const gitReviewReviewedCommand = vs.commands.registerCommand('turbogerrit.gitReview+2', gitReviewReviewed);
    const gitReviewSubmitCommand = vs.commands.registerCommand('turbogerrit.gitReviewSubmit', gitReviewSubmit);
    const createBranchCommand = vs.commands.registerCommand('turbogerrit.createBranch', createBranch);

    context.subscriptions.push(vs.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }));
    context.subscriptions.push(vs.workspace.registerTextDocumentContentProvider(myScheme, myProvider));
    context.subscriptions.push(treeView);
    context.subscriptions.push(pushToGerritCommand);
    context.subscriptions.push(initialSetupCommand);
    context.subscriptions.push(openUrlCommand);
    context.subscriptions.push(openDiffCommand);
    context.subscriptions.push(gitReviewVerifiedCommand);
    context.subscriptions.push(gitReviewReviewedCommand);
    context.subscriptions.push(gitReviewSubmitCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(createBranchCommand);
    context.subscriptions.push(mangeNotificationCommand);

}

async function initialSetup() {
    const config = new ExtensionConfig();
    await config.setUsername();
    await config.setEmail();
}

async function pushToGerrit() {
    let config = new ExtensionConfig().prepare(log);
    if (config === null) {
        return;
    }
    const command = `cd ${config.cwd} && git push ssh://${config.username}@${config.gitReview.host}:${config.gitReview.port}/${config.gitReview.project} HEAD:refs/for/${config.currentBranch}${config.reviewersAttribute}`;
    log.i('Executing:');
    log.i(command);
    await vs.window.withProgress({
        location: vs.ProgressLocation.Notification,
        title: `Pushing to refs/for/${config.currentBranch}`,
    }, () => {
        return new Promise<void>(async resolve => {
            cp.exec(command,
                (err, stdout, stderr) => {
                    onPushExecuted(err, stdout, stderr, config.currentBranch);
                    resolve();
                });
        });
    });

}

function onPushExecuted(err: cp.ExecException | null, stdout: string, stderr: string, currentBranch: string) {
    log.logCpContent(err, stdout, stderr);
    let exitCode = err?.code;
    if (stderr?.includes('Could not resolve hostname')) {
        log.vsE('Could not connect to Gerrit. Maybe you forgot to turn on the VPN?');
        return;
    }
    if (stderr?.includes('no new changes')) {
        log.vsE('Rejected from remote, nothing to push.');
        return;
    }
    if (exitCode === undefined) {
        log.vsI(`Sucsessfully pushed to refs/for/${currentBranch}`);
        return;
    }
    switch (exitCode) {
        case 0:
            log.vsI(`Sucsessfully pushed to refs/for/${currentBranch}`);
            return;
        case 127:
        case 9009:
            log.vsE('"ssh" is not installed');
            return;
        default:
            log.vsE('Something went wrong, see Output > TurboGerrit for more info...');
            return;
    }
}

async function openFile(node: GerritFileItem, memFs: MemFS) {
    const c = new ExtensionConfig().prepare(log);
    if (!c) {
        log.vsE('Can\'t launch "open diff", workspace is not ready yet. Try again in a minute');
        return;
    }

    let isAdding: boolean = node.modification.startsWith('A');

    try {
        let command = `cd ${c.cwd} && git show ${node.revision}${isAdding ? '' : '^'}:${node.fileName}`;

        const fileContent = await new Promise<string>((resolve, reject) => {
            cp.exec(command, (error, stdout) => {
                if (error) {
                    log.e(`Failed to fetch original diff data: ${error.message}`);
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });

        const orig = vs.Uri.parse(`memfs:/original.${node.fileExt}`);
        const mod = vs.Uri.parse(`memfs:/modified.${node.fileExt}`);

        memFs.writeFile(orig, Buffer.from(isAdding ? '' : fileContent), {
            create: true,
            overwrite: true,
        });

        memFs.writeFile(mod, Buffer.from(isAdding ? fileContent : ''), {
            create: true,
            overwrite: true,
        });

        await vs.commands.executeCommand('vscode.diff', orig, mod, `diff for ${node.fileName}`);
    } catch (error) {
        log.vsE(`Error during "diff" operation: ${error}`);
    }
}

async function openDiff(node: GerritFileItem, memFs: MemFS) {
    const c = new ExtensionConfig().prepare(log);
    if (!c) {
        log.vsE('Can\'t launch "open diff", workspace is not ready yet. Try again in a minute');
        return;
    }

    try {
        const originalContent = await new Promise<string>((resolve, reject) => {
            cp.exec(`cd ${c.cwd} && git show ${node.revision}^:${node.fileName}`, (error, stdout) => {
                if (error) {
                    log.e(`Failed to fetch original diff data: ${error.message}`);
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });

        const modifiedContent = await new Promise<string>((resolve, reject) => {
            cp.exec(`cd ${c.cwd} && git show ${node.revision}:${node.fileName}`, (error, stdout) => {
                if (error) {
                    log.e(`Failed to fetch modified diff data: ${error.message}`);
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });

        const orig = vs.Uri.parse(`memfs:/original.${node.fileExt}`);
        const mod = vs.Uri.parse(`memfs:/modified.${node.fileExt}`);
        memFs.writeFile(orig, Buffer.from(originalContent), {
            create: true,
            overwrite: true,
        });
        memFs.writeFile(mod, Buffer.from(modifiedContent), {
            create: true,
            overwrite: true,
        });

        await vs.commands.executeCommand('vscode.diff', orig, mod, `diff for ${node.fileName}`);

    } catch (error) {
        log.vsE(`Error during "diff" operation: ${error}`);
    }
}

async function openUrl(node: GerritURLItem) {
    const url = node.url;
    if (url === undefined || url === null) {
        log.vsE('Cannot open url: ${url}');
        return;
    }
    vs.env.openExternal(vs.Uri.parse(url));
}


async function gitReviewVerified(node: GerritReplyItem) {
    const c = new ExtensionConfig().prepare(log);
    if (!c) {
        log.vsE('Can\'t launch "review +1", workspace is not ready yet. Try again in a minute');
        return;
    }

    try {
        await vs.window.withProgress({
            location: vs.ProgressLocation.Notification,
            title: `Sending reply (+1)...`,
        }, () => {
            return new Promise<string>((resolve, reject) => {
                let command = `ssh -p ${c.gitReview.port} ${c.username}@${c.gitReview.host} gerrit review --project ${c.gitReview.project} --code-review +1 ${node.commitId},${node.patchSet}`;
                log.i(`Executing: ${command}`);
                cp.exec(command, (error, stdout) => {
                    if (error) {
                        log.e(`Failed to send reply: ${error.message}`);
                        reject(error);
                    } else {
                        log.vsI('Successfully reviewed (+1)!');
                        resolve(stdout);
                    }
                });
            });
        });

    } catch (error) {
        log.vsE(`Error during "review +1" operation: ${error}`);
    }
}
async function gitReviewReviewed(node: GerritReplyItem) {
    const c = new ExtensionConfig().prepare(log);
    if (!c) {
        log.vsE('Can\'t launch "review +2", workspace is not ready yet. Try again in a minute');
        return;
    }
    try {
        await vs.window.withProgress({
            location: vs.ProgressLocation.Notification,
            title: `Sending reply (+2)...`,
        }, () => {
            return new Promise<string>((resolve, reject) => {
                let command = `ssh -p ${c.gitReview.port} ${c.username}@${c.gitReview.host} gerrit review --project ${c.gitReview.project} --code-review +2 ${node.commitId},${node.patchSet}`;
                log.i(`Executing: ${command}`);
                cp.exec(command, (error, stdout) => {
                    if (error) {
                        log.e(`Failed to send reply: ${error.message}`);
                        reject(error);
                    } else {
                        log.vsI('Successfully reviewed (+2)!');
                        resolve(stdout);
                    }
                });
            });
        });
    } catch (error) {
        log.vsE(`Error during "review +2" operation: ${error}`);
    }
}
async function gitReviewSubmit(node: GerritReplyItem) {
    const c = new ExtensionConfig().prepare(log);
    if (!c) {
        log.vsE('Can\'t launch "submit", workspace is not ready yet. Try again in a minute');
        return;
    }
    try {
        await vs.window.withProgress({
            location: vs.ProgressLocation.Notification,
            title: `Sending submission...`,
        }, () => {
            return new Promise<string>((resolve, reject) => {
                let command = `ssh -p ${c.gitReview.port} ${c.username}@${c.gitReview.host} gerrit review --project ${c.gitReview.project} --code-review +2 ${node.commitId},${node.patchSet}`;
                log.i(`Executing: ${command}`);
                cp.exec(command, (error, stdout) => {
                    if (error) {
                        log.e(`Failed to send reply: ${error.message}`);
                        reject(error);
                    } else {
                        log.vsI('Successfully submitted!');
                        resolve(stdout);
                    }
                });
            });
        });
    } catch (error) {
        log.vsE(`Error during "submit" operation: ${error}`);
    }
}

async function createBranch() {
    const c = new ExtensionConfig().prepare(log);
    if (c === null) {
        log.vsE('Can\'t launch "create branch", workspace is not ready yet. Try again in a minute');
        return;
    }

    let newBranchName = await vs.window.showInputBox({
        title: 'Enter branch name:',
    });

    if (!newBranchName) {
        log.vsE('Can\'t proceed with "create branch": empty branch name');
        return;
    }

    let newBranchRevision = await vs.window.showInputBox({
        title: 'Enter revision (just hit "Enter" to create branch from master):',
        placeHolder: 'master',
    });

    if (!newBranchRevision) {
        newBranchRevision = 'master';
    }
    cp.exec(`ssh -p ${c.gitReview.port} ${c.username}@${c.gitReview.host} gerrit create-branch ${c.gitReview.project} ${newBranchName} ${newBranchRevision}`, (err, stdout) => {
        if (err) {
            if (err.message.includes('Could not resolve hostname')) {
                log.vsE(`Failed to create ${newBranchName}: Can't connect to remote.`);
            } else {
                log.vsE(`Failed to create ${newBranchName}: ${err.message}`);
            }
        } else {
            vs.window.showInformationMessage(`Successfully created ${newBranchName}! Do you want to checkout ${newBranchName}?`, 'Sure!').then(async (selected) => {
                if (selected === "Sure!") {
                    cp.exec(`cd ${c.cwd} && git fetch && git checkout ${newBranchName}`, (err, stdout) => {
                        if (err) {
                            log.vsE(`Failed to checkout ${newBranchName}: ${err.message}`);
                            return;
                        } else {
                            log.vsI(`Successfully checked out ${newBranchName}!`);
                            return;
                        }
                    });
                }
            });
        }
    });
}

const seenStorageKey = 'turbogerritSeenReviews';

async function manageNotification(node: GerritReviewItem[], context: vs.ExtensionContext) {

    if (node.length === 0) {
        if (context.workspaceState.get(seenStorageKey)) {
            context.workspaceState.update(seenStorageKey, undefined);
        }
        return;
    }
    const stored = context.workspaceState.get<number[]>(seenStorageKey);
    const seen = [];
    for (const item of node) {
        if (stored?.includes(item.data.id)) {
            continue;
        } else {
            seen.push(item.data.id);
        }
    }
    if (seen.length !== 0) {
        vs.window.showInformationMessage(`TurboGerrit: Review requested`, 'View', 'Hide').then((selected) => {
            switch (selected) {
                case 'View': vs.commands.executeCommand('turbogerrit.scmView.focus');
            }
        });
        context.workspaceState.update(seenStorageKey, seen);
    }
}

exports = {
    activate,
    deactivate,
};
