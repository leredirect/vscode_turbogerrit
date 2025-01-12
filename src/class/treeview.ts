import * as vs from 'vscode';
import cp from 'child_process';
import { ExtensionConfig } from './extension_config';
import { Log } from './log';
import * as path from 'path';

abstract class GerritTreeItem extends vs.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vs.TreeItemCollapsibleState,
    ) {
        super(label, collapsibleState);
        //     this.tooltip = `Commit by: ${data.author}\nBranch: ${data.branch}\n${data.url}`;
        //     this.description = `Author: ${data.author}`;

    }
}



export class GerritReviewItem extends GerritTreeItem {
    constructor(
        public readonly data: GerritCommitData,
        public readonly subject?: string,
    ) {
        super(`${subject}`, vs.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'review';
    }
}

export class GerritReviewDetailItem extends GerritTreeItem {
    constructor(
        public readonly key?: string,
        public readonly value?: string,
    ) {
        super(`${key}: ${value}`, vs.TreeItemCollapsibleState.None);
        this.iconPath = {
            light: vs.Uri.file(path.join(__dirname, '..', '..', 'resources', 'review_item.svg')),
            dark: vs.Uri.file(path.join(__dirname, '..', '..', 'resources', 'review_item_dark.svg')),
        };
    }
}

export class GerritURLItem extends GerritTreeItem {
    constructor(
        public readonly url?: string,
    ) {
        super('Open Gerrit dashboard', vs.TreeItemCollapsibleState.None);
        this.iconPath = {
            light: vs.Uri.file(path.join(__dirname, '..', '..', 'resources', 'web.svg')),
            dark: vs.Uri.file(path.join(__dirname, '..', '..', 'resources', 'web_dark.svg')),
        };
        this.contextValue = 'url';
    }
}

export class GerritEmptyChild extends GerritTreeItem {
    constructor(
    ) {
        super("No reviews assigned to you", vs.TreeItemCollapsibleState.None);
    }
}

export class GerritLoadingItem extends GerritTreeItem {
    constructor(
    ) {
        super("Loading...", vs.TreeItemCollapsibleState.None);
    }
}

export class GerritErrorItem extends GerritTreeItem {
    constructor(
        error: string
    ) {
        super(`${error}, see Output > TurboGerrit for details'`, vs.TreeItemCollapsibleState.None);
    }
}

export class GerritDiffItem extends GerritTreeItem {
    public children: GerritTreeItem[] = [];

    constructor(
        public readonly revision: string,
        public readonly commitId: number,
        public readonly patchSet: number,
    ) {
        super(`Load diff #${commitId}${patchSet !== 1 ? `, patch set ${patchSet}` : ''}`, vs.TreeItemCollapsibleState.Collapsed);
    }
}

export class GerritReplyItem extends GerritTreeItem {
    constructor(
        public readonly commitId: number,
        public readonly patchSet: number,
    ) {
        super(`Reply on #${commitId}${patchSet !== 1 ? `, patch set ${patchSet}` : ''}`, vs.TreeItemCollapsibleState.None);
        this.contextValue = 'reply';
    }
}

export class GerritFileItem extends GerritTreeItem {
    constructor(
        public readonly fileName: string,
        public readonly revision: string,
        public readonly modification: string,
        public readonly fileExt: string,
    ) {
        super(fileName, vs.TreeItemCollapsibleState.None);
        const iconLight = (() => {
            switch (modification) {
                case 'M': return 'm.svg';
                case 'A': return 'a.svg';
                case 'D': return 'd.svg';
                case 'R': return 'r.svg';
                default: return 'unknown.svg';
            }
        })();
        const iconDark = (() => {
            switch (modification) {
                case 'M': return 'm_dark.svg';
                case 'A': return 'a_dark.svg';
                case 'D': return 'd_dark.svg';
                case 'R': return 'r_dark.svg';
                default: return 'unknown_dark.svg';
            }
        })();
        this.iconPath = {
            light: vs.Uri.file(path.join(__dirname, '..', '..', 'resources', iconLight)),
            dark: vs.Uri.file(path.join(__dirname, '..', '..', 'resources', iconDark)),
        };
        this.contextValue = 'diff';
    }
}

interface GerritCommitData {
    author: string;
    branch: string;
    commitMsg: string;
    url: string;
    id: number;
    patchSet: number;
    ref: string;
    revision: string;

}

export class GerritDataProvider implements vs.TreeDataProvider<GerritTreeItem> {
    constructor(log: Log) {
        this.log = log;
        this.startAutoRefresh();
    }

    log: Log;

    private _onDidChangeTreeData: vs.EventEmitter<GerritTreeItem | undefined | void> =
        new vs.EventEmitter<GerritTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vs.Event<GerritTreeItem | undefined | void> =
        this._onDidChangeTreeData.event;

    private items: GerritTreeItem[] = [
        new GerritLoadingItem(),
    ];

    private intervalId: NodeJS.Timeout | undefined;
    private startAutoRefresh() {
        setTimeout(() => {
            this.refresh();
            this.intervalId = setInterval(() => this.refresh(), 300000);
        }, 5000);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
        this.fetchGerritData();
    }

    getTreeItem(element: GerritTreeItem): vs.TreeItem {
        return element;
    }

    async getChildren(element?: GerritTreeItem): Promise<GerritTreeItem[]> {
        if (!element) {
            return this.items;
        }

        if (element instanceof GerritReviewItem) {
            return [
                new GerritReviewDetailItem('Author', element.data.author),
                new GerritReviewDetailItem('Branch', element.data.branch),
                new GerritReviewDetailItem('Commit Message', element.data.commitMsg),
                new GerritURLItem(element.data.url),
                new GerritDiffItem(element.data.revision, element.data.id, element.data.patchSet),
                new GerritReplyItem(element.data.id, element.data.patchSet),
            ];
        }

        if (element instanceof GerritDiffItem) {
            if (element.children.length > 0) {
                return element.children;
            }

            this.fetchDiffData(element.revision, element.patchSet).then((children) => {
                element.children = children;
                this._onDidChangeTreeData.fire(element);
            });

            return [new GerritLoadingItem()];
        }

        return [];
    }

    private fetchGerritData(): void {
        this.items = [new GerritLoadingItem()];
        const c = new ExtensionConfig().prepare(this.log);
        if (c === null) return;

        this.log.i(`executing "ssh -p ${c.gitReview.port} ${c.username}@${c.gitReview.host} gerrit query --format=json reviewer:${c.email} status:open --patch-sets"`);
        cp.exec(
            `ssh -p ${c.gitReview.port} ${c.username}@${c.gitReview.host} gerrit query --format=json reviewer:${c.email} status:open --patch-sets`,
            (error, stdout) => {
                if (error) {
                    vs.window.setStatusBarMessage('Gerrit fetch failed');
                    this.log.e(`Failed to fetch Gerrit data: ${error.message}`);
                    this.items = [new GerritErrorItem(error.message.includes('Could not resolve hostname') ? 'No connection (WI-FI or VPN?)' : 'Error loading data')];
                    this._onDidChangeTreeData.fire();
                    return;
                }

                try {
                    const results = stdout
                        .split('\n')
                        .filter(line => line.trim())
                        .map(line => JSON.parse(line))
                        .filter(result => result.subject);

                    this.log.i(`got response: ${JSON.stringify(results)}`);

                    if (results.length === 0) {
                        this.items = [
                            new GerritEmptyChild(),
                        ];
                        vs.window.setStatusBarMessage('');
                        return;
                    }

                    this.items = results.map(
                        result =>
                            new GerritReviewItem(
                                {
                                    author: result.owner.name || 'Unknown',
                                    branch: result.branch || 'Unknown',
                                    commitMsg: result.commitMessage.replace(result.subject, '').trim(),
                                    url: result.url || 'No URL',
                                    id: result.number || -1,
                                    patchSet: result.patchSets.length || -1,
                                    ref: result.patchSets[result.patchSets.length - 1].ref || 'No ref',
                                    revision: result.patchSets[result.patchSets.length - 1].revision || 'No revision'
                                },
                                result.subject,
                            )
                    );
                    vs.window.setStatusBarMessage(`Review requested (${this.items.length}) `);
                } catch (err) {
                    this.log.e(`Error parsing Gerrit data: ${err}`);
                    this.items = [new GerritErrorItem('Error parsing data')];
                }

                this._onDidChangeTreeData.fire();
            }
        );
    }


    private async fetchDiffData(revision: string, patchSet: number): Promise<GerritFileItem[]> {
        return new Promise(async (resolve, reject) => {
            const c = new ExtensionConfig().prepare(this.log);
            if (!c) {
                reject('Configuration is not prepared.');
                return;
            }

            const command = `cd ${c.cwd} && git show --name-status ${revision} --format=""`;
            this.log.i(`Executing: ${command}`);

            cp.exec(command, (error, stdout) => {
                if (error) {
                    this.log.e(`Failed to fetch diff data: ${error.message}`);
                    reject(error);
                    return;
                }

                try {
                    this.log.i(stdout);
                    const lines = stdout.trim().split('\n');
                    const files: GerritFileItem[] = lines.map(line => {
                        const [status, ...filePathParts] = line.trim().split(/\s+/);
                        const fileExt = filePathParts.join();
                        return new GerritFileItem(filePathParts.join(' '), revision, status, path.extname(fileExt).substring(1, fileExt.length));
                    });
                    resolve(files);
                } catch (parseError) {
                    this.log.e(`Error parsing diff data: ${parseError}`);
                    reject(parseError);
                }
            });
        });
    }

}
