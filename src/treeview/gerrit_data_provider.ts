import * as vs from 'vscode';
import * as cp from 'child_process';
import { ExtensionConfig } from '../config/extension_config';
import * as path from 'path';
import { GerritTreeItem } from './items/gerrit_tree_item';
import { GerritReviewDetailItem } from './items/gerrit_review_detail_item';
import { GerritURLItem } from './items/gerrit_url_item';
import { GerritEmptyItem } from './items/gerrit_empty_item';
import { GerritLoadingItem } from './items/gerrit_loading_item';
import { GerritErrorItem } from './items/gerrit_error_item';
import { GerritDiffItem } from './items/gerrit_diff_item';
import { GerritReplyItem } from './items/gerrit_reply_item';
import { GerritFileItem } from './items/gerrit_file_item';
import { GerritReviewItem, GerritSectionItem } from './items/gerrit_review_item';
import { GerritReviewFilter } from './gerrit_review_filter';
import { Log } from '../class/log';

export class GerritDataProvider implements vs.TreeDataProvider<GerritTreeItem> {
    constructor(
        private readonly log: Log,
    ) {
        this.log = log;
        this.startAutoRefresh();
    }

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

    async refresh(): Promise<void> {
        this.items = [new GerritLoadingItem()];
        this._onDidChangeTreeData.fire();
        await this.fetchGerritData();
    }

    getTreeItem(element: GerritTreeItem): vs.TreeItem {
        return element;
    }

    async getChildren(element?: GerritTreeItem): Promise<GerritTreeItem[]> {
        if (!element) {
            return this.items;
        }

        if (element instanceof GerritSectionItem) {
            return element.children;
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

    private async fetchGerritData(): Promise<void> {
        const c = new ExtensionConfig().prepare(this.log);
        if (c === null) return;
        const commandOutgoing = `ssh -p ${c.gitReview.port} ${c.username}@${c.gitReview.host} gerrit query --format=json owner:self status:open --patch-sets`;
        const commandIncoming = `ssh -p ${c.gitReview.port} ${c.username}@${c.gitReview.host} gerrit query --format=json reviewer:${c.email} status:open --patch-sets`;
        try {
            this.log.i(`executing "${commandIncoming}"`);
            const incoming = await this.execCommand(commandIncoming);
            this.log.i(`executing "${commandOutgoing}"`);
            const outgoing = await this.execCommand(commandOutgoing);

            const incomingResults = this.onFetchedRemote(incoming);
            const outgoingResults = this.onFetchedRemote(outgoing);
            if (incomingResults === undefined || outgoingResults === undefined) {
                this.log.e(`Error parsing Gerrit data.`);
                this.items = [new GerritErrorItem('Error parsing data')];
                this._onDidChangeTreeData.fire();
                return;
            }

            this.items = [
                new GerritSectionItem(incomingResults.length === 0 ? [new GerritEmptyItem(GerritReviewFilter.incoming)] : incomingResults, GerritReviewFilter.incoming),
                new GerritSectionItem(outgoingResults.length === 0 ? [new GerritEmptyItem(GerritReviewFilter.outgoing)] : outgoingResults, GerritReviewFilter.outgoing),
            ];
            if (incomingResults.length !== 0) {
                vs.window.setStatusBarMessage(`Review requested (${this.items.length}) `);
            } else {
                vs.window.setStatusBarMessage('');
            }
        } catch (err) {
            if (err instanceof Error) {
                if (err.message.includes('Could not resolve hostname')) {
                    vs.window.setStatusBarMessage('Gerrit fetch failed');
                    this.log.e(`Failed to fetch Gerrit data: ${err.message}`);
                    this.items = [new GerritErrorItem('No connection (WI-FI or VPN?)')];
                } else {
                    this.log.e(`Error parsing Gerrit data: ${err.message}`);
                    this.items = [new GerritErrorItem('Error loading data')];
                }
            } else {
                this.log.e(`Unknown error: ${err}`);
                this.items = [new GerritErrorItem('Error parsing data')];
            }
            this._onDidChangeTreeData.fire();
        }
        this._onDidChangeTreeData.fire();
    }

    private execCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(command, { encoding: "utf8" }, (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    private onFetchedRemote(stdout: string) {
        const results = stdout
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .filter(result => result.subject);

        this.log.i(`got response: ${JSON.stringify(results)}`);
        const items = results.map(
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
        return items;
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
