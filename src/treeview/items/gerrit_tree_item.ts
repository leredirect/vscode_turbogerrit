import * as vs from 'vscode';

export abstract class GerritTreeItem extends vs.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vs.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}
