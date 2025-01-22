import * as path from 'path';
import * as vs from 'vscode';
import { GerritTreeItem } from './gerrit_tree_item';


export class GerritURLItem extends GerritTreeItem {
    constructor(
        public readonly url?: string
    ) {
        super('Open Gerrit dashboard', vs.TreeItemCollapsibleState.None);
        this.iconPath = {
            light: vs.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'web.svg')),
            dark: vs.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'web_dark.svg')),
        };
        this.contextValue = 'url';
    }
}
