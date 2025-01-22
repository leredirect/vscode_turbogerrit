import * as path from 'path';
import * as vs from 'vscode';
import { GerritTreeItem } from './gerrit_tree_item';


export class GerritReviewDetailItem extends GerritTreeItem {
    constructor(
        public readonly key?: string,
        public readonly value?: string
    ) {
        super(`${key}: ${value}`, vs.TreeItemCollapsibleState.None);
        this.iconPath = {
            light: vs.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'review_item.svg')),
            dark: vs.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'review_item_dark.svg')),
        };
    }
}
