import * as vs from 'vscode';
import { GerritTreeItem } from './gerrit_tree_item';


export class GerritDiffItem extends GerritTreeItem {
    public children: GerritTreeItem[] = [];

    constructor(
        public readonly revision: string,
        public readonly commitId: number,
        public readonly patchSet: number
    ) {
        super(`Load diff #${commitId}${patchSet !== 1 ? `, patch set ${patchSet}` : ''}`, vs.TreeItemCollapsibleState.Collapsed);
    }
}
