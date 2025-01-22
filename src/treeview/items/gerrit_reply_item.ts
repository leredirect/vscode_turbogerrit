import * as vs from 'vscode';
import * as path from 'path';
import { GerritTreeItem } from './gerrit_tree_item';


export class GerritReplyItem extends GerritTreeItem {
    constructor(
        public readonly commitId: number,
        public readonly patchSet: number
    ) {
        super(`Reply on #${commitId}${patchSet !== 1 ? `, patch set ${patchSet}` : ''}`, vs.TreeItemCollapsibleState.None);

        this.iconPath = {
            light: vs.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'reply.svg')),
            dark: vs.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'reply_dark.svg')),
        };
        this.contextValue = 'reply';
    }
}
