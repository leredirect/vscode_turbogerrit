import * as vs from 'vscode';
import { GerritTreeItem } from './gerrit_tree_item';


export class GerritLoadingItem extends GerritTreeItem {
    constructor() {
        super("Loading...", vs.TreeItemCollapsibleState.None);
    }
}
