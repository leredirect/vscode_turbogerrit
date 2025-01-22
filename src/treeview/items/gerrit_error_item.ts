import * as vs from 'vscode';
import { GerritTreeItem } from './gerrit_tree_item';


export class GerritErrorItem extends GerritTreeItem {
    constructor(
        error: string
    ) {
        super(`${error}, see Output > TurboGerrit for details`, vs.TreeItemCollapsibleState.None);
    }
}
